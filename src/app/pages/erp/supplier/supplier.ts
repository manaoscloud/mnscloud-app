import {
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  ElementRef,
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
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { bindDialogClosed, bindDialogEscape } from '../../../shared/dialog/dialog-events.util';

type Supplier = {
  SupplierUUID: string;
  Type: 'company' | 'person';
  Name: string;
  Document?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Street?: string | null;
  Number?: string | null;
  District?: string | null;
  City?: string | null;
  State?: string | null;
  Zip?: string | null;
  Country?: string | null;
  Status: number;
  Notes?: string | null;
};

type PostalCodeLookupItem = {
  street?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

@Component({
  selector: 'app-erp-supplier',
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
  templateUrl: './supplier.html',
  styleUrls: ['./supplier.scss'],
})
export class ErpSupplierPage {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listLimit = 200;
  suppliers: Supplier[] = [];
  dataSource = new MatTableDataSource<Supplier>([]);
  displayedColumns: string[] = ['select', 'name', 'type', 'document', 'email', 'status', 'actions'];
  private readonly appliedSearch = signal('');
  private readonly suppliersResource = resource({
    params: () => this.appliedSearch(),
    defaultValue: [] as Supplier[],
    loader: ({ params }) => this.fetchSuppliers(params),
  });
  get loading() {
    return this.suppliersResource.isLoading();
  }
  saving = false;
  searchingPostalCode = false;
  error = '';
  search = '';
  searchInput = '';
  editingSupplier: Supplier | null = null;
  selectedSupplierUUIDs = new Set<string>();
  readonly emailError = signal('');

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly supplierFormDialog = viewChild<TemplateRef<unknown>>('supplierFormDialog');
  readonly addressNumberInput = viewChild<ElementRef<HTMLInputElement>>('addressNumberInput');
  private supplierFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  private readonly syncSuppliers = effect(() => {
    this.suppliers = this.suppliersResource.value();
    this.dataSource.data = [...this.suppliers];
    this.reconcileSelection();
    this.applyFilter();
  });
  private readonly reportSuppliersError = effect(() => {
    const error = this.suppliersResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load suppliers.'));
      this.dataSource.data = [];
    }
  });

  form = {
    type: 'company' as 'company' | 'person',
    name: '',
    document: '',
    email: '',
    phone: '',
    street: '',
    number: '',
    district: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    notes: '',
    status: 1,
  };

  constructor() {
    this.resetForm();
    this.destroyRef.onDestroy(() => {
      this.stopDialogViewportObserver();
      this.closeSupplierDialog();
    });
  }

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'type':
          return data.Type ?? '';
        case 'document':
          return data.Document ?? '';
        case 'email':
          return data.Email ?? '';
        case 'status':
          return data.Status ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.Document, data.Email, data.Phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    const nextSearch = this.searchInput.trim();
    this.search = nextSearch;
    if (nextSearch === this.appliedSearch()) {
      this.suppliersResource.reload();
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
      this.suppliersResource.reload();
    }
  }

  refreshList() {
    this.suppliersResource.reload();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private async fetchSuppliers(search: string) {
    this.error = '';
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (search) params.set('q', search);
    const res = await this.api.get<any>(`erp/suppliers?${params.toString()}`);
    return res?.data?.items ?? [];
  }

  startCreate() {
    this.resetForm();
    this.openSupplierDialog();
  }

  private resetForm() {
    this.editingSupplier = null;
    this.form.type = 'company';
    this.form.name = '';
    this.form.document = '';
    this.form.email = '';
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
    this.form.status = 1;
  }

  startEdit(supplier: Supplier) {
    this.editingSupplier = supplier;
    this.form.type = supplier.Type;
    this.form.name = supplier.Name ?? '';
    this.form.document = supplier.Document ?? '';
    this.form.email = supplier.Email ?? '';
    this.updateEmailError();
    this.form.phone = supplier.Phone ?? '';
    this.form.street = supplier.Street ?? '';
    this.form.number = supplier.Number ?? '';
    this.form.district = supplier.District ?? '';
    this.form.city = supplier.City ?? '';
    this.form.state = supplier.State ?? '';
    this.form.zip = supplier.Zip ?? '';
    this.form.country = supplier.Country ?? '';
    this.form.notes = supplier.Notes ?? '';
    this.form.status = supplier.Status ?? 1;
    this.openSupplierDialog();
  }

  async saveSupplier(keepOpenForNew = false) {
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

    try {
      const payload = {
        type: this.form.type,
        name: this.form.name.trim(),
        document: this.form.document?.trim() || null,
        email: this.form.email?.trim() || null,
        phone: this.form.phone?.trim() || null,
        street: this.form.street?.trim() || null,
        number: this.form.number?.trim() || null,
        district: this.form.district?.trim() || null,
        city: this.form.city?.trim() || null,
        state: this.form.state?.trim() || null,
        zip: this.form.zip?.trim() || null,
        country: this.form.country?.trim() || null,
        notes: this.form.notes?.trim() || null,
        status: this.form.status,
      };

      if (this.editingSupplier) {
        await this.api.put(`erp/suppliers/${this.editingSupplier.SupplierUUID}`, payload);
        this.snack.success('Supplier updated successfully.');
      } else {
        await this.api.post('erp/suppliers', payload);
        this.snack.success('Supplier created successfully.');
      }

      if (!this.editingSupplier && keepOpenForNew) {
        this.resetForm();
      } else {
        this.closeSupplierDialog();
        this.resetForm();
      }
      this.suppliersResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save supplier.');
    } finally {
      this.saving = false;
    }
  }

  saveAndNewSupplier() {
    if (this.editingSupplier) return;
    void this.saveSupplier(true);
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
      this.form.street = item.street ?? this.form.street;
      this.form.district = item.district ?? this.form.district;
      this.form.city = item.city ?? this.form.city;
      this.form.state = item.state ?? this.form.state;
      this.searchingPostalCode = false;
      queueMicrotask(() => this.addressNumberInput()?.nativeElement?.focus());
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to search postal code.');
      this.searchingPostalCode = false;
    }
  }

  async deleteSupplier(supplierUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete supplier',
        message: 'Are you sure you want to delete this supplier?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.error = '';
    try {
      await this.api.delete(`erp/suppliers/${supplierUUID}`);
      this.selectedSupplierUUIDs.delete(supplierUUID);
      this.suppliersResource.reload();
      this.snack.success('Supplier deleted successfully.');
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete supplier.');
    }
  }

  cancelSupplierForm() {
    this.closeSupplierDialog();
    this.resetForm();
  }

  get selectedCount() {
    return this.selectedSupplierUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(supplier: Supplier) {
    return this.selectedSupplierUUIDs.has(supplier.SupplierUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleSupplierSelection(supplier: Supplier, checked: boolean) {
    if (checked) {
      this.selectedSupplierUUIDs.add(supplier.SupplierUUID);
    } else {
      this.selectedSupplierUUIDs.delete(supplier.SupplierUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSupplierSelection(row, checked));
  }

  async removeSelectedSuppliers() {
    const ids = Array.from(this.selectedSupplierUUIDs);
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((row) => this.selectedSupplierUUIDs.has(row.SupplierUUID))
      .slice(0, 3)
      .map((row) => row.Name)
      .filter(Boolean);
    const detail = labels.length
      ? ` Selected: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected suppliers',
        message: `Are you sure you want to delete ${ids.length} selected supplier record(s)?${detail}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.error = '';
    try {
      const response = await this.api.delete<any>('erp/suppliers/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.SupplierUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.SupplierUUID));
      this.suppliers = this.suppliers.filter((row) => !deleted.has(row.SupplierUUID));
      this.selectedSupplierUUIDs.clear();
      failed.forEach((uuid) => this.selectedSupplierUUIDs.add(uuid));
      this.suppliersResource.reload();
      if (failed.size) {
        this.showError(`${failed.size} selected supplier record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} supplier record(s) deleted.`);
      }
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected suppliers.');
    }
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.SupplierUUID));
    Array.from(this.selectedSupplierUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedSupplierUUIDs.delete(uuid);
    });
  }

  updateEmailError() {
    const value = this.form.email?.trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      this.emailError.set('Not a valid email');
    } else {
      this.emailError.set('');
    }
  }

  private showError(message: string) {
    this.error = '';
    this.snack.error(message);
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }

  private showWarning(message: string) {
    this.error = '';
    this.snack.warning(message);
  }

  private openSupplierDialog() {
    const supplierFormDialog = this.supplierFormDialog();
    if (!supplierFormDialog || this.supplierFormDialogRef) return;
    this.error = '';
    this.supplierFormDialogRef = this.dialog.open(supplierFormDialog, {
      ...this.getSupplierDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-supplier-form-dialog',
    });
    bindDialogEscape(this.supplierFormDialogRef, () => {
      this.closeSupplierDialog();
    });
    this.startDialogViewportObserver();
    bindDialogClosed(this.supplierFormDialogRef, () => {
      this.stopDialogViewportObserver();
      this.supplierFormDialogRef = null;
    });
  }

  private closeSupplierDialog() {
    if (!this.supplierFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.supplierFormDialogRef.close();
    this.supplierFormDialogRef = null;
  }

  private getSupplierDialogViewportConfig() {
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
    if (!this.supplierFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateSupplierDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateSupplierDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateSupplierDialogViewport() {
    if (!this.supplierFormDialogRef) return;
    const config = this.getSupplierDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    this.supplierFormDialogRef.updateSize(width, height);
    if (config.position) {
      this.supplierFormDialogRef.updatePosition(config.position);
    } else {
      this.supplierFormDialogRef.updatePosition();
    }
  }
}
