import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
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
  templateUrl: './complex.html',
  styleUrls: ['./complex.scss'],
})
export class ErpComplexPage {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listLimit = 200;

  readonly complexes = computed(() => this.normalizeRows(this.complexesResource.value()));
  displayedColumns: string[] = ['select', 'name', 'document', 'cityState', 'status', 'actions'];
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  private readonly appliedFilters = signal({ search: '', status: '' });
  private readonly complexesResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as ErpComplex[],
    loader: ({ params }) => this.fetchComplexes(params),
  });
  readonly sortedRows = computed(() => this.sortRows(this.complexes()));
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
  readonly loading = computed(() => this.complexesResource.isLoading());
  saving = false;
  searchingPostalCode = false;
  error = '';
  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusFilter = signal('');
  editingComplex: ErpComplex | null = null;
  readonly selectedComplexUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedComplexUUIDs().size);
  readonly emailError = signal('');

  readonly complexFormDialog = viewChild<TemplateRef<unknown>>('complexFormDialog');
  readonly addressNumberInput = viewChild<ElementRef<HTMLInputElement>>('addressNumberInput');
  private complexDialogBinding: CrudDialogBinding | null = null;
  private readonly syncComplexes = effect(() => {
    this.complexes();
    this.reconcileSelection();
  });
  private readonly reportComplexesError = effect(() => {
    const error = this.complexesResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load complexes.'));
    }
  });

  statusOptions: { value: ComplexStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  form = {
    name: '',
    alias: '',
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
    status: 'active' as ComplexStatus,
  };

  constructor() {
    this.resetForm();
    this.destroyRef.onDestroy(() => {
      this.closeComplexDialog();
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
      this.complexesResource.reload();
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
      this.complexesResource.reload();
    }
  }

  refreshList() {
    this.complexesResource.reload();
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

  private sortRows(rows: ErpComplex[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => this.compareValues(this.sortValue(a, active), this.sortValue(b, active), direction));
  }

  private sortValue(row: ErpComplex, column: string) {
    switch (column) {
      case 'name':
        return row.Name ?? "";
      case 'document':
        return row.Document ?? "";
      case 'cityState':
        return `${row.City ?? ""} ${row.State ?? ""}`;
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

  private matchesLocalFilters(row: ErpComplex) {
    const filters = this.appliedFilters();
    if (filters.status && String((row as any).Status ?? '') !== filters.status) return false;
    const search = filters.search.trim().toLowerCase();
    if (!search) return true;
    return [row.Name, row.Document, row.City, row.State, row.Zip]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(search));
  }

  private normalizeRows(rows: ErpComplex[]) {
    return rows.filter((row) => this.matchesLocalFilters(row));
  }
  private async fetchComplexes(filters: { search: string; status: string }) {
    this.error = '';
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (filters.search) params.set('q', filters.search);
    if (filters.status) params.set('status', filters.status);
    const res = await this.api.get<any>(`erp/complexes?${params.toString()}`);
    return res?.data?.items ?? [];
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
    this.form.status = 'active';
  }

  startEdit(complex: ErpComplex) {
    this.editingComplex = complex;
    this.form.name = complex.Name ?? '';
    this.form.alias = complex.Alias ?? '';
    this.form.document = complex.Document ?? '';
    this.form.email = complex.Email ?? '';
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
        name: this.form.name.trim(),
        alias: this.form.alias?.trim() || null,
        document: this.form.document?.trim() || null,
        email: this.form.email?.trim() || null,
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
      } else {
        this.closeComplexDialog();
        this.resetForm();
      }
      this.complexesResource.reload();
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
    this.error = '';
    try {
      await this.api.delete(`erp/complexes/${complexUUID}`);
      this.selectedComplexUUIDs.update((current) => { const next = new Set(current); next.delete(complexUUID); return next; });
      this.complexesResource.reload();
      this.snack.success('Complex deleted successfully.');
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete complex.');
    }
  }

  cancelComplexForm() {
    this.closeComplexDialog();
    this.resetForm();
  }

  statusClass(status?: string) {
    return status ? `is-${status}` : '';
  }

  statusLabel(status?: string | null) {
    return (status ?? '').toLowerCase() === 'active' ? 'Active' : 'Inactive';
  }

  private parseTableFilter(filter: string) {
    try {
      const parsed = JSON.parse(filter || '{}') as { search?: string; status?: ComplexStatus | '' };
      return {
        search: (parsed.search ?? '').trim().toLowerCase(),
        status: parsed.status ?? '',
      };
    } catch {
      return { search: filter.trim().toLowerCase(), status: '' as const };
    }
  }

  formatCityState(complex: ErpComplex) {
    const city = complex.City?.trim() ?? '';
    const state = complex.State?.trim() ?? '';
    if (city && state) return `${city} / ${state}`;
    return city || state || '-';
  }

  isSelected(row: ErpComplex) {
    return this.selectedComplexUUIDs().has(row.ComplexUUID);
  }

  isAllVisibleSelected() {
    return this.allVisibleSelected();
  }

  isSomeVisibleSelected() {
    return this.someVisibleSelected();
  }

  toggleComplexSelection(row: ErpComplex, checked: boolean) {
    this.selectedComplexUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(row.ComplexUUID);
      } else {
        next.delete(row.ComplexUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedComplexUUIDs.update((current) => {
      const next = new Set(current);
      this.visibleRows().forEach((row) => {
        if (checked) next.add(row.ComplexUUID);
        else next.delete(row.ComplexUUID);
      });
      return next;
    });
  }

  async removeSelectedComplexes() {
    const ids = Array.from(this.selectedComplexUUIDs());
    if (!ids.length) return;

    const labels = this.complexes()
      .filter((row) => this.selectedComplexUUIDs().has(row.ComplexUUID))
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

    this.error = '';
    try {
      const response = await this.api.delete<any>('erp/complexes/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.ComplexUUID),
      );
      this.selectedComplexUUIDs.set(failed);
      this.complexesResource.reload();
      if (failed.size) {
        this.showError(`${failed.size} selected complex record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} complex record(s) deleted.`);
      }
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected complexes.');
    }
  }

  private legacyAddress() {
    const street = this.form.street?.trim();
    const number = this.form.number?.trim();
    if (!street && !number) return null;
    if (street && number) return `${street}, ${number}`;
    return street || number || null;
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

  private reconcileSelection() {
    const validIds = new Set(this.complexes().map((row) => row.ComplexUUID));
    this.selectedComplexUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (validIds.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private openComplexDialog() {
    const dialog = this.complexFormDialog();
    if (!dialog || this.complexDialogBinding) return;
    this.error = '';
    this.complexDialogBinding = openCrudTemplateDialog(this.dialog, dialog, 'erp-complex-form-dialog', {
      onEscape: () => this.closeComplexDialog(),
    });
    bindDialogClosed(this.complexDialogBinding.ref, () => {
      this.complexDialogBinding?.stop();
      this.complexDialogBinding = null;
    });
  }

  private closeComplexDialog() {
    if (!this.complexDialogBinding) return;
    const binding = this.complexDialogBinding;
    this.complexDialogBinding = null;
    binding.stop();
    binding.ref.close();
  }
}
