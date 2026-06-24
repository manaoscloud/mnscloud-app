import {
  Component,
  computed,
  DestroyRef,
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
  readonly suppliers = computed(() => this.normalizeRows(this.suppliersResource.value()));
  displayedColumns: string[] = ['select', 'name', 'type', 'document', 'email', 'status', 'actions'];
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  private readonly appliedFilters = signal({ search: '', status: '' });
  private readonly suppliersResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as Supplier[],
    loader: ({ params }) => this.fetchSuppliers(params),
  });
  readonly sortedRows = computed(() => this.sortRows(this.suppliers()));
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
  readonly loading = computed(() => this.suppliersResource.isLoading());
  saving = false;
  searchingPostalCode = false;
  error = '';
  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusFilter = signal('');
  editingSupplier: Supplier | null = null;
  readonly selectedSupplierUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedSupplierUUIDs().size);
  readonly emailError = signal('');

  readonly supplierFormDialog = viewChild<TemplateRef<unknown>>('supplierFormDialog');
  readonly addressNumberInput = viewChild<ElementRef<HTMLInputElement>>('addressNumberInput');
  private supplierDialogBinding: CrudDialogBinding | null = null;
  private readonly syncSuppliers = effect(() => {
    this.suppliers();
    this.reconcileSelection();
  });
  private readonly reportSuppliersError = effect(() => {
    const error = this.suppliersResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load suppliers.'));
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
      this.closeSupplierDialog();
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
      this.suppliersResource.reload();
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
      this.suppliersResource.reload();
    }
  }

  refreshList() {
    this.suppliersResource.reload();
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

  private sortRows(rows: Supplier[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => this.compareValues(this.sortValue(a, active), this.sortValue(b, active), direction));
  }

  private sortValue(row: Supplier, column: string) {
    switch (column) {
      case 'name':
        return row.Name ?? "";
      case 'type':
        return row.Type ?? "";
      case 'document':
        return row.Document ?? "";
      case 'email':
        return row.Email ?? "";
      case 'status':
        return row.Status ?? 0;
      default:
        return '';
    }
  }

  private compareValues(a: string | number, b: string | number, direction: SortDirection) {
    const modifier = direction === 'asc' ? 1 : -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * modifier;
    return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * modifier;
  }

  private matchesLocalFilters(row: Supplier) {
    const filters = this.appliedFilters();
    if (filters.status && String((row as any).Status ?? '') !== filters.status) return false;
    const search = filters.search.trim().toLowerCase();
    if (!search) return true;
    return [row.Name, row.Document, row.Email, row.Phone]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(search));
  }

  private normalizeRows(rows: Supplier[]) {
    return rows.filter((row) => this.matchesLocalFilters(row));
  }
  private async fetchSuppliers(filters: { search: string; status: string }) {
    this.error = '';
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (filters.search) params.set('q', filters.search);
    if (filters.status) params.set('status', filters.status);
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
      this.selectedSupplierUUIDs.update((current) => { const next = new Set(current); next.delete(supplierUUID); return next; });
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


  isSelected(supplier: Supplier) {
    return this.selectedSupplierUUIDs().has(supplier.SupplierUUID);
  }

  isAllVisibleSelected() {
    return this.allVisibleSelected();
  }

  isSomeVisibleSelected() {
    return this.someVisibleSelected();
  }

  toggleSupplierSelection(supplier: Supplier, checked: boolean) {
    this.selectedSupplierUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(supplier.SupplierUUID);
      } else {
        next.delete(supplier.SupplierUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedSupplierUUIDs.update((current) => {
      const next = new Set(current);
      this.visibleRows().forEach((row) => {
        if (checked) next.add(row.SupplierUUID);
        else next.delete(row.SupplierUUID);
      });
      return next;
    });
  }
  async removeSelectedSuppliers() {
    const ids = Array.from(this.selectedSupplierUUIDs());
    if (!ids.length) return;

    const labels = this.suppliers()
      .filter((row) => this.selectedSupplierUUIDs().has(row.SupplierUUID))
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
      this.selectedSupplierUUIDs.set(failed);
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

  statusLabel(status?: number | string | null) {
    return String(status ?? '') === '1' || String(status ?? '').toLowerCase() === 'active'
      ? 'Active'
      : 'Inactive';
  }

  private reconcileSelection() {
    const validIds = new Set(this.suppliers().map((row) => row.SupplierUUID));
    this.selectedSupplierUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (validIds.has(uuid)) next.add(uuid);
      });
      return next;
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
    const dialog = this.supplierFormDialog();
    if (!dialog || this.supplierDialogBinding) return;
    this.error = '';
    this.supplierDialogBinding = openCrudTemplateDialog(this.dialog, dialog, 'erp-supplier-form-dialog', {
      onEscape: () => this.closeSupplierDialog(),
    });
    bindDialogClosed(this.supplierDialogBinding.ref, () => {
      this.supplierDialogBinding?.stop();
      this.supplierDialogBinding = null;
    });
  }

  private closeSupplierDialog() {
    if (!this.supplierDialogBinding) return;
    const binding = this.supplierDialogBinding;
    this.supplierDialogBinding = null;
    binding.stop();
    binding.ref.close();
  }
}
