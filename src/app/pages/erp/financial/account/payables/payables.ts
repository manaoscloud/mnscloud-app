import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { DateTimeFormatService } from '../../../../../services/date-time-format.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SystemParameterService } from '../../../../../services/system-parameter.service';
import { CurrencyMaskDirective } from '../../../../../shared/currency-mask/currency-mask.directive';
import { DateMaskDirective } from '../../../../../shared/date-mask/date-mask.directive';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../../../shared/dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  type MnsSearchSelectFieldOption,
  MnsSelectFieldComponent,
  MnsTextFieldComponent,
  MnsTextareaFieldComponent,
} from '../../../../../shared/forms';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type PayableStatus = 'open' | 'paid' | 'overdue' | 'canceled';

type Payable = {
  ErpFinAccPayableUUID: string;
  SupplierUUID: string;
  SupplierName?: string | null;
  SupplierDocument?: string | null;
  SupplierEmail?: string | null;
  Description: string;
  DocNumber?: string | null;
  DueDate: string;
  Amount: number;
  Status: PayableStatus;
  Notes?: string | null;
};

type PayableFormModel = {
  supplierUUID: string;
  status: PayableStatus;
  description: string;
  docNumber: string;
  dueDate: string;
  amount: number;
  notes: string;
};

type SupplierOption = MnsSearchSelectFieldOption & { value: string };

type PayableSnapshot = {
  items: Payable[];
  suppliers: SupplierOption[];
};

@Component({
  selector: 'app-financial-payables',
  standalone: true,
  imports: [
    CurrencyMaskDirective,
    DateMaskDirective,
    FormField,
    MnsSearchSelectFieldComponent,
    MnsSelectFieldComponent,
    MnsTextFieldComponent,
    MnsTextareaFieldComponent,
    RefreshButtonComponent,
    TranslocoPipe,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './payables.html',
  styleUrls: ['./payables.scss'],
})
export class FinancialPayablesPage {
  private readonly api = inject(ApiService);
  private readonly dateTime = inject(DateTimeFormatService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(TranslocoService);
  private readonly parameters = inject(SystemParameterService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly payableFormDialog = viewChild<TemplateRef<unknown>>('payableFormDialog');
  private formDialogBinding: CrudDialogBinding | null = null;

  readonly searchInput = signal('');
  readonly statusInput = signal<PayableStatus | ''>('');
  readonly search = signal('');
  readonly status = signal<PayableStatus | ''>('');
  readonly sortActive = signal('dueDate');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly selectedPayableUUIDs = signal<Set<string>>(new Set());
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly editing = signal<Payable | null>(null);

  readonly formModel = signal<PayableFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.supplierUUID);
    required(schema.description);
    required(schema.dueDate);
    required(schema.amount);
  });

  readonly statusOptions: { value: PayableStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];
  readonly statusFilterOptions = [{ value: '', label: 'All' }, ...this.statusOptions];
  readonly displayedColumns = [
    'select',
    'description',
    'supplier',
    'docNumber',
    'dueDate',
    'amount',
    'status',
    'actions',
  ];

  readonly currencyResource = resource({
    defaultValue: 'BRL',
    loader: () => this.parameters.resolveDefaultCurrency('BRL'),
  });

  private readonly snapshotResource = resource({
    params: () => ({ search: this.search(), status: this.status() }),
    defaultValue: { items: [], suppliers: [] } as PayableSnapshot,
    loader: async ({ params }) => {
      const [items, suppliers] = await Promise.all([
        this.fetchPayables(params.search, params.status),
        this.fetchSuppliers(),
      ]);
      return { items, suppliers: this.mergeSuppliers(suppliers, items) };
    },
  });

  readonly loading = computed(() => this.snapshotResource.isLoading() || this.mutating());
  readonly referenceLoading = computed(() => this.snapshotResource.isLoading());
  readonly rows = computed(() => this.snapshotResource.value().items);
  readonly supplierOptions = computed(() => this.snapshotResource.value().suppliers);
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly selectedCount = computed(() => this.selectedPayableUUIDs().size);
  readonly allVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });
  readonly someVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.allVisibleSelected();
  });

  private readonly cleanup = this.destroyRef.onDestroy(() => this.closeFormDialog());

  private readonly syncSelection = effect(() => {
    this.rows();
    queueMicrotask(() => this.reconcileSelection());
  });

  private readonly reportLoadError = effect(() => {
    const error = this.snapshotResource.error();
    if (!error) return;
    this.snack.error(this.extractErrorMessage(error, this.t('Failed to load payables.')));
  });

  refreshList() {
    this.snapshotResource.reload();
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.pageIndex.set(0);
    this.clearSelection();
    if (nextSearch === this.search() && nextStatus === this.status()) {
      this.snapshotResource.reload();
      return;
    }
    this.search.set(nextSearch);
    this.status.set(nextStatus);
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.pageIndex.set(0);
    this.clearSelection();
    if (this.search() || this.status()) {
      this.search.set('');
      this.status.set('');
      return;
    }
    this.snapshotResource.reload();
  }

  setSort(sort: Sort) {
    this.sortActive.set(sort.active || '');
    this.sortDirection.set(sort.direction || '');
    this.pageIndex.set(0);
  }

  setPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set(this.emptyFormModel());
    this.openFormDialog();
  }

  startEdit(row: Payable) {
    this.editing.set(row);
    this.formModel.set({
      supplierUUID: row.SupplierUUID ?? '',
      status: row.Status ?? 'open',
      description: row.Description ?? '',
      docNumber: row.DocNumber ?? '',
      dueDate: this.dateInputValue(row.DueDate),
      amount: Number(row.Amount ?? 0),
      notes: row.Notes ?? '',
    });
    this.openFormDialog();
  }

  cancelForm() {
    this.closeFormDialog();
    this.editing.set(null);
    this.formModel.set(this.emptyFormModel());
  }

  async savePayable(saveAndNew = false) {
    const payload = this.buildPayload();
    if (!payload) return;

    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(
          `erp/financial/accounts/payables/${editing.ErpFinAccPayableUUID}`,
          payload,
        );
        this.snack.success(this.t('Payable updated successfully.'));
      } else {
        await this.api.post('erp/financial/accounts/payables', payload);
        this.snack.success(this.t('Payable created successfully.'));
      }
      this.snapshotResource.reload();
      if (saveAndNew && createMode) {
        this.editing.set(null);
        this.formModel.set(this.emptyFormModel());
        return;
      }
      this.cancelForm();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, this.t('Failed to save payable.')));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewPayable() {
    if (this.editing()) return;
    void this.savePayable(true);
  }

  async deletePayable(row: Payable) {
    const confirmed = await this.confirm(
      'Delete payable',
      'Are you sure you want to delete this payable?',
      'Delete',
    );
    if (!confirmed) return;

    await this.runMutation(async () => {
      await this.api.delete(`erp/financial/accounts/payables/${row.ErpFinAccPayableUUID}`);
      this.clearSelection();
      this.snapshotResource.reload();
      this.snack.success(this.t('Payable deleted successfully.'));
    }, 'Failed to delete payable.');
  }

  async deleteSelectedPayables() {
    const ids = [...this.selectedPayableUUIDs()];
    if (!ids.length) return;

    const confirmed = await this.confirm(
      'Delete selected payables',
      'Delete selected payables confirmation',
      'Delete selected',
      { count: ids.length },
    );
    if (!confirmed) return;

    await this.runMutation(async () => {
      const response = await this.api.delete<any>('erp/financial/accounts/payables/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.selectedPayableUUIDs.set(failed);
      this.snapshotResource.reload();
      if (failed.size) {
        this.snack.error(
          this.t('Payables bulk delete partial failure', {
            deleted: deleted.size,
            failed: failed.size,
          }),
        );
        return;
      }
      this.snack.success(
        this.t('Payables bulk deleted successfully', { count: deleted.size || ids.length }),
      );
    }, 'Failed to delete selected payables.');
  }

  isSelected(row: Payable) {
    return this.selectedPayableUUIDs().has(row.ErpFinAccPayableUUID);
  }

  toggleRow(row: Payable, checked: boolean) {
    this.selectedPayableUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) next.add(row.ErpFinAccPayableUUID);
      else next.delete(row.ErpFinAccPayableUUID);
      return next;
    });
  }

  toggleVisibleRows(checked: boolean) {
    this.selectedPayableUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        if (checked) next.add(row.ErpFinAccPayableUUID);
        else next.delete(row.ErpFinAccPayableUUID);
      }
      return next;
    });
  }

  supplierOpened(opened: boolean) {
    if (opened && !this.supplierOptions().length && !this.snapshotResource.isLoading()) {
      this.snapshotResource.reload();
    }
  }

  datePickerValue(value: string) {
    return this.parseDate(value);
  }

  updateDueDate(value: Date | null) {
    this.formModel.update((current) => ({
      ...current,
      dueDate: value ? this.formatDate(value) : '',
    }));
  }

  supplierLabel(row: Payable) {
    return this.clean(row.SupplierName) ?? row.SupplierUUID ?? '-';
  }

  statusLabel(status: PayableStatus) {
    return this.t(this.statusOptions.find((option) => option.value === status)?.label ?? status);
  }

  amountLabel(value: number) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.currencyResource.value(),
    }).format(Number(value ?? 0));
  }

  dateLabel(value?: string | null) {
    const date = this.parseDate(value);
    return date ? this.dateTime.formatDate(date) || '-' : '-';
  }

  private buildPayload() {
    const value = this.formModel();
    if (!value.supplierUUID) {
      this.snack.warning(this.t('Supplier is required.'));
      return null;
    }
    if (!value.description.trim()) {
      this.snack.warning(this.t('Description is required.'));
      return null;
    }
    if (!value.dueDate) {
      this.snack.warning(this.t('Due date is required.'));
      return null;
    }
    if (this.toAmount(value.amount) <= 0) {
      this.snack.warning(this.t('Amount must be greater than zero.'));
      return null;
    }
    return {
      supplierUUID: value.supplierUUID,
      description: value.description.trim(),
      docNumber: this.clean(value.docNumber),
      dueDate: value.dueDate,
      amount: this.toAmount(value.amount),
      status: value.status,
      notes: this.clean(value.notes),
    };
  }

  private async fetchPayables(search: string, status: PayableStatus | '') {
    const params = new URLSearchParams({ limit: String(this.listLimit), offset: '0' });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    return this.extractItems<Payable>(
      await this.api.get<any>(`erp/financial/accounts/payables?${params.toString()}`),
    );
  }

  private async fetchSuppliers() {
    return this.fetchPaged('erp/suppliers', (item) => {
      const value = String(item.SupplierUUID ?? item.supplierUUID ?? item.uuid ?? '').trim();
      const label = String(item.Name ?? item.name ?? item.SupplierName ?? '').trim();
      if (!value || !label) return null;
      const description = [item.Document ?? item.document, item.Email ?? item.email]
        .filter(Boolean)
        .join(' - ');
      return { value, label, description, searchText: `${label} ${description} ${value}` };
    });
  }

  private mergeSuppliers(options: SupplierOption[], rows: Payable[]) {
    const map = new Map(options.map((option) => [option.value, option]));
    for (const row of rows) {
      if (!row.SupplierUUID || map.has(row.SupplierUUID)) continue;
      map.set(row.SupplierUUID, {
        value: row.SupplierUUID,
        label: this.supplierLabel(row),
        description: [row.SupplierDocument, row.SupplierEmail].filter(Boolean).join(' - '),
        searchText: `${this.supplierLabel(row)} ${row.SupplierDocument ?? ''} ${row.SupplierEmail ?? ''} ${
          row.SupplierUUID
        }`,
      });
    }
    return [...map.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  private async fetchPaged<T extends MnsSearchSelectFieldOption>(
    endpoint: string,
    mapItem: (item: any) => T | null,
  ) {
    const all: T[] = [];
    for (let offset = 0; offset < 5000; offset += this.listLimit) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.api.get<any>(
        `${endpoint}${separator}limit=${this.listLimit}&offset=${offset}`,
      );
      const items = this.extractItems<any>(response);
      all.push(...items.flatMap((item) => (mapItem(item) ? [mapItem(item) as T] : [])));
      if (items.length < this.listLimit) break;
    }
    return all;
  }

  private sortRows(rows: Payable[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((left, right) => {
      const result = this.compare(this.sortValue(left, active), this.sortValue(right, active));
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: Payable, column: string): string | number {
    switch (column) {
      case 'description':
        return row.Description ?? '';
      case 'supplier':
        return this.supplierLabel(row);
      case 'docNumber':
        return row.DocNumber ?? '';
      case 'dueDate':
        return row.DueDate ?? '';
      case 'amount':
        return Number(row.Amount ?? 0);
      case 'status':
        return this.statusLabel(row.Status);
      default:
        return '';
    }
  }

  private openFormDialog() {
    const template = this.payableFormDialog();
    if (!template || this.formDialogBinding) return;
    this.formDialogBinding = openCrudTemplateDialog(
      this.dialog,
      template,
      'erp-payable-form-dialog',
      {
        onEscape: () => this.cancelForm(),
      },
    );
    bindDialogClosed(
      this.formDialogBinding.ref,
      () => {
        this.formDialogBinding?.stop();
        this.formDialogBinding = null;
      },
      this.destroyRef,
    );
  }

  private closeFormDialog() {
    if (!this.formDialogBinding) return;
    this.formDialogBinding.ref.close();
    this.formDialogBinding.stop();
    this.formDialogBinding = null;
  }

  private async confirm(
    title: string,
    message: string,
    confirmLabel: string,
    params?: Record<string, unknown>,
  ) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t(title),
        message: this.t(message, params),
        confirmLabel: this.t(confirmLabel),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private async runMutation(action: () => Promise<void>, fallbackMessage: string) {
    this.mutating.set(true);
    try {
      await action();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, this.t(fallbackMessage)));
    } finally {
      this.mutating.set(false);
    }
  }

  private reconcileSelection() {
    const available = new Set(this.rows().map((row) => row.ErpFinAccPayableUUID));
    this.selectedPayableUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private clearSelection() {
    this.selectedPayableUUIDs.set(new Set());
  }

  private emptyFormModel(): PayableFormModel {
    return {
      supplierUUID: '',
      status: 'open',
      description: '',
      docNumber: '',
      dueDate: '',
      amount: 0,
      notes: '',
    };
  }

  private extractItems<T>(response: any): T[] {
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.ErpFinAccPayableUUID === 'string') return item.ErpFinAccPayableUUID;
    if (typeof item.UUID === 'string') return item.UUID;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private compare(left: string | number, right: string | number) {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private dateInputValue(value?: string | null) {
    return value?.split('T')[0] ?? '';
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const [datePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  }

  private toAmount(value: unknown) {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  private clean(value?: string | null) {
    const cleanValue = String(value ?? '').trim();
    return cleanValue || null;
  }

  private t(key: string, params?: Record<string, unknown>) {
    return this.i18n.translate(key, params);
  }

  private extractErrorMessage(error: any, fallback: string) {
    return error?.error?.error || error?.error?.message || error?.message || fallback;
  }
}
