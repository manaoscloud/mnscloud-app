import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

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
import { firstValueFrom, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

type ComplexStatus = 'active' | 'inactive';

type ErpComplex = {
  ComplexUUID: string;
  Name: string;
  Alias?: string | null;
  Document?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Street?: string | null;
  Number?: string | null;
  District?: string | null;
  Address?: string | null;
  City?: string | null;
  State?: string | null;
  Zip?: string | null;
  Country?: string | null;
  Notes?: string | null;
  Status: ComplexStatus;
};

type PostalCodeLookupItem = {
  postalCode?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

@Component({
  selector: 'app-erp-complex',
  standalone: true,
  imports: [
    CommonModule,
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
    TranslatePipe,
    MatCheckboxModule,
    MatMenuModule,
    PhoneInputComponent,
  ],
  templateUrl: './complex.html',
  styleUrls: ['./complex.scss'],
})
export class ErpComplexPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private readonly listLimit = 200;

  complexes: ErpComplex[] = [];
  dataSource = new MatTableDataSource<ErpComplex>([]);
  displayedColumns: string[] = ['select', 'name', 'document', 'cityState', 'status', 'actions'];
  loading = true;
  saving = false;
  searchingPostalCode = false;
  error = '';
  search = '';
  searchInput = '';
  editingComplex: ErpComplex | null = null;
  selectedComplexUUIDs = new Set<string>();
  readonly emailControl = new FormControl('', [Validators.email]);
  readonly emailError = signal('');

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('complexFormDialog') complexFormDialog?: TemplateRef<unknown>;
  @ViewChild('addressNumberInput') addressNumberInput?: ElementRef<HTMLInputElement>;
  private complexFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  statusOptions: { value: ComplexStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  form = {
    name: '',
    alias: '',
    document: '',
    phone: '',
    street: '',
    number: '',
    district: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    notes: '',
    status: 'active' as ComplexStatus,
  };

  constructor() {
    merge(this.emailControl.statusChanges, this.emailControl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateEmailError());
  }

  ngOnInit() {
    this.resetForm();
    void this.loadComplexes();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeComplexDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'document':
          return data.Document ?? '';
        case 'cityState':
          return `${data.City ?? ''} ${data.State ?? ''}`.trim();
        case 'status':
          return data.Status ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.Alias, data.Document, data.Email, data.Phone, data.City, data.State]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadComplexes();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadComplexes();
  }

  refreshList() {
    void this.loadComplexes();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadComplexes() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.loading = true;
    this.cdr.detectChanges();
    this.error = '';
    const start = performance.now();
    try {
      const params = new URLSearchParams();
      params.set('limit', String(this.listLimit));
      if (this.search) params.set('q', this.search);
      const res = await this.api.get<any>(`erp/complexes?${params.toString()}`);
      this.complexes = res?.data?.items ?? [];
      this.dataSource.data = [...this.complexes];
      this.reconcileSelection();
      this.applyFilter();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to load complexes.');
      this.dataSource.data = [];
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, waitMs);
      } else {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  startCreate() {
    this.resetForm();
    this.openComplexDialog();
  }

  private resetForm() {
    this.editingComplex = null;
    this.form.name = '';
    this.form.alias = '';
    this.form.document = '';
    this.emailControl.setValue('', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = '';
    this.form.street = '';
    this.form.number = '';
    this.form.district = '';
    this.form.city = '';
    this.form.state = '';
    this.form.zip = '';
    this.form.country = '';
    this.form.notes = '';
    this.form.status = 'active';
  }

  startEdit(complex: ErpComplex) {
    this.editingComplex = complex;
    this.form.name = complex.Name ?? '';
    this.form.alias = complex.Alias ?? '';
    this.form.document = complex.Document ?? '';
    this.emailControl.setValue(complex.Email ?? '', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = complex.Phone ?? '';
    const fallbackAddress = complex.Address ?? '';
    this.form.street = complex.Street ?? fallbackAddress;
    this.form.number = complex.Number ?? '';
    this.form.district = complex.District ?? '';
    this.form.city = complex.City ?? '';
    this.form.state = complex.State ?? '';
    this.form.zip = complex.Zip ?? '';
    this.form.country = complex.Country ?? '';
    this.form.notes = complex.Notes ?? '';
    this.form.status = complex.Status ?? 'active';
    this.openComplexDialog();
  }

  async saveComplex(keepOpenForNew = false) {
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

    try {
      const payload = {
        name: this.form.name.trim(),
        alias: this.form.alias?.trim() || null,
        document: this.form.document?.trim() || null,
        email: this.emailControl.value?.trim() || null,
        phone: this.form.phone?.trim() || null,
        street: this.form.street?.trim() || null,
        number: this.form.number?.trim() || null,
        district: this.form.district?.trim() || null,
        address: this.legacyAddress(),
        city: this.form.city?.trim() || null,
        state: this.form.state?.trim() || null,
        zip: this.form.zip?.trim() || null,
        country: this.form.country?.trim() || null,
        notes: this.form.notes?.trim() || null,
        status: this.form.status,
      };

      if (this.editingComplex) {
        await this.api.put(`erp/complexes/${this.editingComplex.ComplexUUID}`, payload);
        this.snack.success('Complex updated successfully.');
      } else {
        await this.api.post('erp/complexes', payload);
        this.snack.success('Complex created successfully.');
      }

      if (!this.editingComplex && keepOpenForNew) {
        this.resetForm();
        this.cdr.detectChanges();
      } else {
        this.closeComplexDialog();
        this.resetForm();
        this.cdr.detectChanges();
      }
      await this.loadComplexes();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save complex.');
    } finally {
      this.saving = false;
    }
  }

  saveAndNewComplex() {
    if (this.editingComplex) return;
    void this.saveComplex(true);
  }

  async searchPostalCode() {
    const normalizedZip = (this.form.zip ?? '').replace(/\D/g, '');

    if (!normalizedZip) {
      this.showWarning('Inform a postal code to search.');
      return;
    }

    if (!/^\d{8}$/.test(normalizedZip)) {
      this.showWarning('Invalid postal code. Provide 8 digits.');
      return;
    }

    this.searchingPostalCode = true;
    this.error = '';
    this.form.zip = normalizedZip;

    try {
      const res = await this.api.get<any>(`postal-codes/${normalizedZip}`);
      const item = (res?.data?.item ?? {}) as PostalCodeLookupItem;
      setTimeout(() => {
        this.form.street = item.street ?? this.form.street;
        this.form.district = item.district ?? this.form.district;
        this.form.city = item.city ?? this.form.city;
        this.form.state = item.state ?? this.form.state;
        this.searchingPostalCode = false;
        this.cdr.detectChanges();

        setTimeout(() => {
          this.addressNumberInput?.nativeElement?.focus();
        }, 0);
      }, 0);
    } catch (err: any) {
      setTimeout(() => {
        this.showError(err?.message ?? 'Failed to search postal code.');
        this.searchingPostalCode = false;
        this.cdr.detectChanges();
      }, 0);
    }
  }

  async deleteComplex(complexUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete complex',
        message: 'Are you sure you want to delete this complex?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.loading = true;
    this.error = '';
    try {
      await this.api.delete(`erp/complexes/${complexUUID}`);
      this.selectedComplexUUIDs.delete(complexUUID);
      await this.loadComplexes();
      this.snack.success('Complex deleted successfully.');
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete complex.');
    } finally {
      this.loading = false;
    }
  }

  cancelComplexForm() {
    this.closeComplexDialog();
    this.resetForm();
  }

  statusClass(status?: string) {
    return status ? `is-${status}` : '';
  }

  formatCityState(complex: ErpComplex) {
    const city = complex.City?.trim() ?? '';
    const state = complex.State?.trim() ?? '';
    if (city && state) return `${city} / ${state}`;
    return city || state || '-';
  }

  get selectedCount() {
    return this.selectedComplexUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(complex: ErpComplex) {
    return this.selectedComplexUUIDs.has(complex.ComplexUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleComplexSelection(complex: ErpComplex, checked: boolean) {
    if (checked) {
      this.selectedComplexUUIDs.add(complex.ComplexUUID);
    } else {
      this.selectedComplexUUIDs.delete(complex.ComplexUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleComplexSelection(row, checked));
  }

  async removeSelectedComplexes() {
    const ids = Array.from(this.selectedComplexUUIDs);
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((row) => this.selectedComplexUUIDs.has(row.ComplexUUID))
      .slice(0, 3)
      .map((row) => row.Name)
      .filter(Boolean);
    const detail = labels.length
      ? ` Selected: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected complexes',
        message: `Are you sure you want to delete ${ids.length} selected complex record(s)?${detail}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading = true;
    this.error = '';
    try {
      const response = await this.api.delete<any>('erp/complexes/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.ComplexUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.ComplexUUID));
      this.complexes = this.complexes.filter((row) => !deleted.has(row.ComplexUUID));
      this.selectedComplexUUIDs.clear();
      failed.forEach((uuid) => this.selectedComplexUUIDs.add(uuid));
      await this.loadComplexes();
      if (failed.size) {
        this.showError(`${failed.size} selected complex record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} complex record(s) deleted.`);
      }
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected complexes.');
    } finally {
      this.loading = false;
    }
  }

  private legacyAddress() {
    const street = this.form.street?.trim();
    const number = this.form.number?.trim();
    if (!street && !number) return null;
    if (street && number) return `${street}, ${number}`;
    return street || number || null;
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

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.ComplexUUID));
    Array.from(this.selectedComplexUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedComplexUUIDs.delete(uuid);
    });
  }

  private openComplexDialog() {
    if (!this.complexFormDialog || this.complexFormDialogRef) return;
    this.error = '';
    this.complexFormDialogRef = this.dialog.open(this.complexFormDialog, {
      ...this.getComplexDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-complex-form-dialog',
    });
    this.complexFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeComplexDialog();
      }
    });
    this.startDialogViewportObserver();
    this.complexFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.complexFormDialogRef = null;
    });
  }

  private closeComplexDialog() {
    if (!this.complexFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.complexFormDialogRef.close();
    this.complexFormDialogRef = null;
  }

  private getComplexDialogViewportConfig() {
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
    if (!this.complexFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateComplexDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateComplexDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateComplexDialogViewport() {
    if (!this.complexFormDialogRef) return;
    const config = this.getComplexDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    this.complexFormDialogRef.updateSize(width, height);
    if (config.position) {
      this.complexFormDialogRef.updatePosition(config.position);
    } else {
      this.complexFormDialogRef.updatePosition();
    }
  }
}
