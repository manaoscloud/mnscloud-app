import {
  Component,
  computed,
  DestroyRef,
  effect,
  resource,
  TemplateRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';

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
  styleUrls: ['./companies.scss'],
})
export class ErpCompaniesPage {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listLimit = 200;

  readonly companies = computed(() => this.normalizeRows(this.companiesResource.value()));
  displayedColumns: string[] = [
    'select',
    'name',
    'document',
    'email',
    'phone',
    'status',
    'actions',
  ];
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  private readonly appliedFilters = signal({ search: '', status: '' });
  private readonly companiesResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as Company[],
    loader: ({ params }) => this.fetchCompanies(params),
  });
  readonly sortedRows = computed(() => this.sortRows(this.companies()));
  readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly allVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });
  readonly someVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.allVisibleSelected();
  });
  readonly loading = computed(() => this.companiesResource.isLoading());
  saving = false;
  error = '';
  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusFilter = signal('');
  editingCompany: Company | null = null;
  readonly selectedCompanyUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedCompanyUUIDs().size);
  readonly emailError = signal('');

  readonly companyFormDialog = viewChild<TemplateRef<unknown>>('companyFormDialog');
  private companyDialogBinding: CrudDialogBinding | null = null;
  private readonly syncCompanies = effect(() => {
    this.companies();
    this.reconcileSelection();
  });
  private readonly reportCompaniesError = effect(() => {
    const error = this.companiesResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load companies.'));
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
    email: '',
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
    this.resetForm();
    this.destroyRef.onDestroy(() => {
      this.closeCompanyDialog();
    });
  }



  onSearchChange(value: string) {
    this.searchInput.set(value);
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusFilter();
    this.search.set(nextSearch);
    this.pageIndex.set(0);
    const current = this.appliedFilters();
    if (nextSearch === current.search && nextStatus === current.status) {
      this.companiesResource.reload();
    } else {
      this.appliedFilters.set({ search: nextSearch, status: nextStatus });
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set('');
    this.pageIndex.set(0);
    const current = this.appliedFilters();
    if (current.search || current.status) {
      this.appliedFilters.set({ search: '', status: '' });
    } else {
      this.companiesResource.reload();
    }
  }

  refreshList() {
    this.companiesResource.reload();
  }

  setSort(sort: Sort) {
    this.sortActive.set(sort.active || '');
    this.sortDirection.set(sort.direction || '');
    this.pageIndex.set(0);
  }

  setPage(page: PageEvent) {
    this.pageIndex.set(page.pageIndex);
    this.pageSize.set(page.pageSize);
  }

  private sortRows(rows: Company[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => this.compareValues(this.sortValue(a, active), this.sortValue(b, active), direction));
  }

  private sortValue(row: Company, column: string) {
    switch (column) {
      case 'name':
        return row.Name ?? "";
      case 'document':
        return row.Document ?? "";
      case 'email':
        return row.Email ?? "";
      case 'phone':
        return row.Phone ?? "";
      case 'status':
        return row.Status ?? "";
      default:
        return '';
    }
  }

  private compareValues(a: string | number, b: string | number, direction: SortDirection) {
    const modifier = direction === 'asc' ? 1 : -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * modifier;
    return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * modifier;
  }

  private matchesLocalFilters(row: Company) {
    const filters = this.appliedFilters();
    if (filters.status && String((row as any).Status ?? '') !== filters.status) return false;
    const search = filters.search.trim().toLowerCase();
    if (!search) return true;
    return [row.Name, row.LegalName, row.Document, row.Email, row.Phone]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(search));
  }

  private normalizeRows(rows: Company[]) {
    return rows.filter((row) => this.matchesLocalFilters(row));
  }
  private async fetchCompanies(filters: { search: string; status: string }) {
    this.error = '';
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (filters.search) params.set('q', filters.search);
    if (filters.status) params.set('status', filters.status);
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
    this.form.email = company.Email ?? '';
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

    this.updateEmailError();
    if (this.emailError()) {
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
        email: this.form.email?.trim() || null,
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
      this.selectedCompanyUUIDs.update((current) => { const next = new Set(current); next.delete(companyUUID); return next; });
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

  statusLabel(status?: string | null) {
    return (status ?? '').toLowerCase() === 'active' ? 'Active' : 'Inactive';
  }

  private parseTableFilter(filter: string) {
    try {
      const parsed = JSON.parse(filter || '{}') as { search?: string; status?: CompanyStatus | '' };
      return {
        search: (parsed.search ?? '').trim().toLowerCase(),
        status: parsed.status ?? '',
      };
    } catch {
      return { search: filter.trim().toLowerCase(), status: '' as const };
    }
  }

  isSelected(row: Company) {
    return this.selectedCompanyUUIDs().has(row.CompanyUUID);
  }

  isAllVisibleSelected() {
    return this.allVisibleSelected();
  }

  isSomeVisibleSelected() {
    return this.someVisibleSelected();
  }

  toggleCompanySelection(row: Company, checked: boolean) {
    this.selectedCompanyUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(row.CompanyUUID);
      } else {
        next.delete(row.CompanyUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedCompanyUUIDs.update((current) => {
      const next = new Set(current);
      this.visibleRows().forEach((row) => {
        if (checked) next.add(row.CompanyUUID);
        else next.delete(row.CompanyUUID);
      });
      return next;
    });
  }

  async removeSelectedCompanies() {
    const ids = Array.from(this.selectedCompanyUUIDs());
    if (!ids.length) return;

    const labels = this.companies()
      .filter((row) => this.selectedCompanyUUIDs().has(row.CompanyUUID))
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
      this.selectedCompanyUUIDs.set(failed);
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

  updateEmailError() {
    const value = this.form.email?.trim();
    if (value && !this.isValidEmail(value)) {
      this.emailError.set('Not a valid email');
    } else {
      this.emailError.set('');
    }
  }

  private isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    this.form.email = '';
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
    const validIds = new Set(this.companies().map((row) => row.CompanyUUID));
    this.selectedCompanyUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (validIds.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private openCompanyDialog() {
    const dialog = this.companyFormDialog();
    if (!dialog || this.companyDialogBinding) return;
    this.error = '';
    this.companyDialogBinding = openCrudTemplateDialog(this.dialog, dialog, 'erp-company-form-dialog', {
      onEscape: () => this.closeCompanyDialog(),
    });
    bindDialogClosed(this.companyDialogBinding.ref, () => {
      this.companyDialogBinding?.stop();
      this.companyDialogBinding = null;
    });
  }

  private closeCompanyDialog() {
    if (!this.companyDialogBinding) return;
    const binding = this.companyDialogBinding;
    this.companyDialogBinding = null;
    binding.stop();
    binding.ref.close();
  }
}
