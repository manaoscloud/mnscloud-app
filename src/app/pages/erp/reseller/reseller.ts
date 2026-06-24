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

type Reseller = {
  ResellerUUID: string;
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
  selector: 'app-erp-reseller',
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
  templateUrl: './reseller.html',
  styleUrls: ['./reseller.scss'],
})
export class ErpResellerPage {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listLimit = 200;
  readonly resellers = computed(() => this.normalizeRows(this.resellersResource.value()));
  displayedColumns: string[] = ['select', 'name', 'type', 'document', 'email', 'status', 'actions'];
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  private readonly appliedFilters = signal({ search: '', status: '' });
  private readonly resellersResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as Reseller[],
    loader: ({ params }) => this.fetchResellers(params),
  });
  readonly sortedRows = computed(() => this.sortRows(this.resellers()));
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
  readonly loading = computed(() => this.resellersResource.isLoading());
  saving = false;
  searchingPostalCode = false;
  error = '';
  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusFilter = signal('');
  editingReseller: Reseller | null = null;
  readonly selectedResellerUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedResellerUUIDs().size);
  readonly emailError = signal('');

  readonly resellerFormDialog = viewChild<TemplateRef<unknown>>('resellerFormDialog');
  readonly addressNumberInput = viewChild<ElementRef<HTMLInputElement>>('addressNumberInput');
  private resellerDialogBinding: CrudDialogBinding | null = null;
  private readonly syncResellers = effect(() => {
    this.resellers();
    this.reconcileSelection();
  });
  private readonly reportResellersError = effect(() => {
    const error = this.resellersResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load resellers.'));
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
      this.closeResellerDialog();
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
      this.resellersResource.reload();
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
      this.resellersResource.reload();
    }
  }

  refreshList() {
    this.resellersResource.reload();
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

  private sortRows(rows: Reseller[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => this.compareValues(this.sortValue(a, active), this.sortValue(b, active), direction));
  }

  private sortValue(row: Reseller, column: string) {
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

  private matchesLocalFilters(row: Reseller) {
    const filters = this.appliedFilters();
    if (filters.status && String((row as any).Status ?? '') !== filters.status) return false;
    const search = filters.search.trim().toLowerCase();
    if (!search) return true;
    return [row.Name, row.Document, row.Email, row.Phone]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(search));
  }

  private normalizeRows(rows: Reseller[]) {
    return rows.filter((row) => this.matchesLocalFilters(row));
  }
  private async fetchResellers(filters: { search: string; status: string }) {
    this.error = '';
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (filters.search) params.set('q', filters.search);
    if (filters.status) params.set('status', filters.status);
    const res = await this.api.get<any>(`erp/resellers?${params.toString()}`);
    return res?.data?.items ?? [];
  }

  startCreate() {
    this.resetForm();
    this.openResellerDialog();
  }

  private resetForm() {
    this.editingReseller = null;
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

  startEdit(reseller: Reseller) {
    this.editingReseller = reseller;
    this.form.type = reseller.Type;
    this.form.name = reseller.Name ?? '';
    this.form.document = reseller.Document ?? '';
    this.form.email = reseller.Email ?? '';
    this.updateEmailError();
    this.form.phone = reseller.Phone ?? '';
    this.form.street = reseller.Street ?? '';
    this.form.number = reseller.Number ?? '';
    this.form.district = reseller.District ?? '';
    this.form.city = reseller.City ?? '';
    this.form.state = reseller.State ?? '';
    this.form.zip = reseller.Zip ?? '';
    this.form.country = reseller.Country ?? '';
    this.form.notes = reseller.Notes ?? '';
    this.form.status = reseller.Status ?? 1;
    this.openResellerDialog();
  }

  async saveReseller(keepOpenForNew = false) {
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

      if (this.editingReseller) {
        await this.api.put(`erp/resellers/${this.editingReseller.ResellerUUID}`, payload);
        this.snack.success('Reseller updated successfully.');
      } else {
        await this.api.post('erp/resellers', payload);
        this.snack.success('Reseller created successfully.');
      }

      if (!this.editingReseller && keepOpenForNew) {
        this.resetForm();
      } else {
        this.closeResellerDialog();
        this.resetForm();
      }
      this.resellersResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save reseller.');
    } finally {
      this.saving = false;
    }
  }

  saveAndNewReseller() {
    if (this.editingReseller) return;
    void this.saveReseller(true);
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

  async deleteReseller(resellerUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete reseller',
        message: 'Are you sure you want to delete this reseller?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.error = '';
    try {
      await this.api.delete(`erp/resellers/${resellerUUID}`);
      this.selectedResellerUUIDs.update((current) => { const next = new Set(current); next.delete(resellerUUID); return next; });
      this.resellersResource.reload();
      this.snack.success('Reseller deleted successfully.');
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete reseller.');
    }
  }

  cancelResellerForm() {
    this.closeResellerDialog();
    this.resetForm();
  }


  isSelected(reseller: Reseller) {
    return this.selectedResellerUUIDs().has(reseller.ResellerUUID);
  }

  isAllVisibleSelected() {
    return this.allVisibleSelected();
  }

  isSomeVisibleSelected() {
    return this.someVisibleSelected();
  }

  toggleResellerSelection(reseller: Reseller, checked: boolean) {
    this.selectedResellerUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(reseller.ResellerUUID);
      } else {
        next.delete(reseller.ResellerUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedResellerUUIDs.update((current) => {
      const next = new Set(current);
      this.visibleRows().forEach((row) => {
        if (checked) next.add(row.ResellerUUID);
        else next.delete(row.ResellerUUID);
      });
      return next;
    });
  }
  async removeSelectedResellers() {
    const ids = Array.from(this.selectedResellerUUIDs());
    if (!ids.length) return;

    const labels = this.resellers()
      .filter((row) => this.selectedResellerUUIDs().has(row.ResellerUUID))
      .slice(0, 3)
      .map((row) => row.Name)
      .filter(Boolean);
    const detail = labels.length
      ? ` Selected: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected resellers',
        message: `Are you sure you want to delete ${ids.length} selected reseller record(s)?${detail}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.error = '';
    try {
      const response = await this.api.delete<any>('erp/resellers/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.ResellerUUID),
      );
      this.selectedResellerUUIDs.set(failed);
      this.resellersResource.reload();
      if (failed.size) {
        this.showError(`${failed.size} selected reseller record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} reseller record(s) deleted.`);
      }
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected resellers.');
    }
  }

  statusLabel(status?: number | string | null) {
    return String(status ?? '') === '1' || String(status ?? '').toLowerCase() === 'active'
      ? 'Active'
      : 'Inactive';
  }

  private reconcileSelection() {
    const validIds = new Set(this.resellers().map((row) => row.ResellerUUID));
    this.selectedResellerUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (validIds.has(uuid)) next.add(uuid);
      });
      return next;
    });
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

  private openResellerDialog() {
    const dialog = this.resellerFormDialog();
    if (!dialog || this.resellerDialogBinding) return;
    this.error = '';
    this.resellerDialogBinding = openCrudTemplateDialog(this.dialog, dialog, 'erp-reseller-form-dialog', {
      onEscape: () => this.closeResellerDialog(),
    });
    bindDialogClosed(this.resellerDialogBinding.ref, () => {
      this.resellerDialogBinding?.stop();
      this.resellerDialogBinding = null;
    });
  }

  private closeResellerDialog() {
    if (!this.resellerDialogBinding) return;
    const binding = this.resellerDialogBinding;
    this.resellerDialogBinding = null;
    binding.stop();
    binding.ref.close();
  }
}
