import {
  AfterViewInit,
  Component,
  DestroyRef,
  effect,
  OnDestroy,
  OnInit,
  resource,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, merge, takeUntil } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type CompanyStatus = 'active' | 'inactive';

type Company = {
  CompanyUUID: string;
  Name: string;
  LegalName?: string | null;
  Document?: string | null;
  Email?: string | null;
  Phone?: string | null;
  AddressStreet?: string | null;
  AddressNumber?: string | null;
  AddressDistrict?: string | null;
  AddressCity?: string | null;
  AddressState?: string | null;
  AddressZip?: string | null;
  AddressCountry?: string | null;
  Notes?: string | null;
  Status: CompanyStatus;
};

@Component({
  selector: 'app-erp-companies',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatCheckboxModule,
    MatMenuModule,
    PhoneInputComponent,
  ],
  templateUrl: './companies.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./companies.scss'],
})
export class ErpCompaniesPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listLimit = 200;

  companies: Company[] = [];
  dataSource = new MatTableDataSource<Company>([]);
  displayedColumns: string[] = [
    'select',
    'name',
    'document',
    'email',
    'phone',
    'status',
    'actions',
  ];
  private readonly appliedSearch = signal('');
  private readonly companiesResource = resource({
    params: () => this.appliedSearch(),
    defaultValue: [] as Company[],
    loader: ({ params }) => this.fetchCompanies(params),
  });
  get loading() {
    return this.companiesResource.isLoading();
  }
  saving = false;
  error = '';
  search = '';
  searchInput = '';
  editingCompany: Company | null = null;
  selectedCompanyUUIDs = new Set<string>();
  readonly emailControl = new FormControl('', [Validators.email]);
  readonly emailError = signal('');

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly companyFormDialog = viewChild<TemplateRef<unknown>>('companyFormDialog');
  private companyFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  private readonly syncCompanies = effect(() => {
    this.companies = this.companiesResource.value();
    this.dataSource.data = [...this.companies];
    this.reconcileSelection();
    this.applyFilter();
  });
  private readonly reportCompaniesError = effect(() => {
    const error = this.companiesResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load companies.'));
      this.dataSource.data = [];
    }
  });

  statusOptions: { value: CompanyStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  form = {
    name: '',
    legalName: '',
    document: '',
    phone: '',
    addressStreet: '',
    addressNumber: '',
    addressDistrict: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    addressCountry: '',
    notes: '',
    status: 'active' as CompanyStatus,
  };

  constructor() {
    merge(this.emailControl.statusChanges, this.emailControl.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateEmailError());
  }

  ngOnInit() {
    this.resetForm();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeCompanyDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'document':
          return data.Document ?? '';
        case 'email':
          return data.Email ?? '';
        case 'phone':
          return data.Phone ?? '';
        case 'status':
          return data.Status ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.LegalName, data.Document, data.Email, data.Phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    const nextSearch = this.searchInput.trim();
    this.search = nextSearch;
    if (nextSearch === this.appliedSearch()) {
      this.companiesResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
    }
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    if (this.appliedSearch()) {
      this.appliedSearch.set('');
    } else {
      this.companiesResource.reload();
    }
  }

  refreshList() {
    this.companiesResource.reload();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private async fetchCompanies(search: string) {
    this.error = '';
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (search) params.set('q', search);
    const res = await this.api.get<any>(`erp/companies?${params.toString()}`);
    return res?.data?.items ?? [];
  }

  startCreate() {
    this.resetForm();
    this.openCompanyDialog();
  }

  startEdit(company: Company) {
    this.editingCompany = company;
    this.form.name = company.Name ?? '';
    this.form.legalName = company.LegalName ?? '';
    this.form.document = company.Document ?? '';
    this.emailControl.setValue(company.Email ?? '', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = company.Phone ?? '';
    this.form.addressStreet = company.AddressStreet ?? '';
    this.form.addressNumber = company.AddressNumber ?? '';
    this.form.addressDistrict = company.AddressDistrict ?? '';
    this.form.addressCity = company.AddressCity ?? '';
    this.form.addressState = company.AddressState ?? '';
    this.form.addressZip = company.AddressZip ?? '';
    this.form.addressCountry = company.AddressCountry ?? '';
    this.form.notes = company.Notes ?? '';
    this.form.status = company.Status ?? 'active';
    this.openCompanyDialog();
  }

  async saveCompany(saveAndNew = false) {
    if (!this.form.name.trim()) {
      this.showWarning('Name is required.');
      return;
    }

    if (this.emailControl.value && this.emailControl.invalid) {
      this.showWarning('Email is invalid.');
      return;
    }

    if (this.form.phone && !/^\d{8,15}$/.test(this.form.phone)) {
      this.showWarning('Phone must contain 8 to 15 digits.');
      return;
    }

    this.saving = true;
    this.error = '';
    const isCreateMode = !this.editingCompany;

    try {
      const payload = {
        name: this.form.name.trim(),
        legalName: this.form.legalName?.trim() || null,
        document: this.form.document?.trim() || null,
        email: this.emailControl.value?.trim() || null,
        phone: this.form.phone?.trim() || null,
        addressStreet: this.form.addressStreet?.trim() || null,
        addressNumber: this.form.addressNumber?.trim() || null,
        addressDistrict: this.form.addressDistrict?.trim() || null,
        addressCity: this.form.addressCity?.trim() || null,
        addressState: this.form.addressState?.trim() || null,
        addressZip: this.form.addressZip?.trim() || null,
        addressCountry: this.form.addressCountry?.trim() || null,
        notes: this.form.notes?.trim() || null,
        status: this.form.status,
      };

      if (this.editingCompany) {
        await this.api.put(`erp/companies/${this.editingCompany.CompanyUUID}`, payload);
        this.snack.success('Company updated successfully.');
      } else {
        await this.api.post('erp/companies', payload);
        this.snack.success('Company created successfully.');
      }

      this.companiesResource.reload();

      if (saveAndNew && isCreateMode) {
        this.resetForm();
        this.error = '';
        return;
      }

      this.closeCompanyDialog();
      this.resetForm();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save company.');
    } finally {
      this.saving = false;
    }
  }

  cancelCompanyForm() {
    this.closeCompanyDialog();
    this.resetForm();
  }

  async deleteCompany(companyUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete company',
        message: 'Are you sure you want to delete this company?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.error = '';
    try {
      await this.api.delete(`erp/companies/${companyUUID}`);
      this.selectedCompanyUUIDs.delete(companyUUID);
      this.companiesResource.reload();
      this.snack.success('Company deleted successfully.');
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete company.');
    }
  }

  statusClass(status?: string) {
    const normalized = (status ?? '').toLowerCase();
    return normalized === 'active' ? 'is-active' : 'is-inactive';
  }

  get selectedCount() {
    return this.selectedCompanyUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(company: Company) {
    return this.selectedCompanyUUIDs.has(company.CompanyUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleCompanySelection(company: Company, checked: boolean) {
    if (checked) {
      this.selectedCompanyUUIDs.add(company.CompanyUUID);
    } else {
      this.selectedCompanyUUIDs.delete(company.CompanyUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleCompanySelection(row, checked));
  }

  async removeSelectedCompanies() {
    const ids = Array.from(this.selectedCompanyUUIDs);
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((row) => this.selectedCompanyUUIDs.has(row.CompanyUUID))
      .slice(0, 3)
      .map((row) => row.Name)
      .filter(Boolean);
    const detail = labels.length
      ? ` Selected: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected companies',
        message: `Are you sure you want to delete ${ids.length} selected company record(s)?${detail}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.error = '';
    try {
      const response = await this.api.delete<any>('erp/companies/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.CompanyUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.CompanyUUID));
      this.companies = this.companies.filter((row) => !deleted.has(row.CompanyUUID));
      this.selectedCompanyUUIDs.clear();
      failed.forEach((uuid) => this.selectedCompanyUUIDs.add(uuid));
      this.companiesResource.reload();
      if (failed.size) {
        this.showError(`${failed.size} selected company record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} company record(s) deleted.`);
      }
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected companies.');
    }
  }

  saveAndNewCompany() {
    if (this.editingCompany) return;
    void this.saveCompany(true);
  }

  private updateEmailError() {
    if (this.emailControl.hasError('email')) {
      this.emailError.set('Not a valid email');
    } else {
      this.emailError.set('');
    }
  }

  private showError(message: string) {
    this.error = '';
    this.snack.error(message);
  }

  private showWarning(message: string) {
    this.error = '';
    this.snack.warning(message);
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  private resetForm() {
    this.editingCompany = null;
    this.form.name = '';
    this.form.legalName = '';
    this.form.document = '';
    this.emailControl.setValue('', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = '';
    this.form.addressStreet = '';
    this.form.addressNumber = '';
    this.form.addressDistrict = '';
    this.form.addressCity = '';
    this.form.addressState = '';
    this.form.addressZip = '';
    this.form.addressCountry = '';
    this.form.notes = '';
    this.form.status = 'active';
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.CompanyUUID));
    Array.from(this.selectedCompanyUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedCompanyUUIDs.delete(uuid);
    });
  }

  private openCompanyDialog() {
    const companyFormDialog = this.companyFormDialog();
    if (!companyFormDialog || this.companyFormDialogRef) return;
    this.error = '';
    this.companyFormDialogRef = this.dialog.open(companyFormDialog, {
      ...this.getCompanyDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-company-form-dialog',
    });
    this.companyFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.companyFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.closeCompanyDialog();
        }
      });
    this.startDialogViewportObserver();
    this.companyFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.companyFormDialogRef = null;
    });
  }

  private closeCompanyDialog() {
    if (!this.companyFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.companyFormDialogRef.close();
    this.companyFormDialogRef = null;
  }

  private getCompanyDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: 'calc(100vw - 24px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'calc(100dvh - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        position: {
          left: '12px',
          top: '12px',
        },
      };
    }

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) {
      return {
        width: 'min(1280px, calc(100vw - 1.5rem))',
        maxWidth: '99vw',
        maxHeight: '95vh',
      };
    }

    const rect = pageContent.getBoundingClientRect();
    const spacing = 8;
    const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
    const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));
    const leftPx = Math.max(0, Math.floor(rect.left + spacing));
    const topPx = Math.max(0, Math.floor(rect.top + spacing));

    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${leftPx}px`,
        top: `${topPx}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.companyFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateCompanyDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateCompanyDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateCompanyDialogViewport() {
    if (!this.companyFormDialogRef) return;
    const config = this.getCompanyDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    this.companyFormDialogRef.updateSize(width, height);
    if (config.position) {
      this.companyFormDialogRef.updatePosition(config.position);
    } else {
      this.companyFormDialogRef.updatePosition();
    }
  }
}
