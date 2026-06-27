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

type ReceivableStatus = 'open' | 'paid' | 'overdue' | 'canceled';

type Receivable = {
  ErpFinAccReceivableUUID: string;
  CustomerUUID: string;
  CustomerName?: string | null;
  CustomerLegalName?: string | null;
  CustomerDocument?: string | null;
  CustomerEmail?: string | null;
  Description: string;
  DocNumber?: string | null;
  DueDate: string;
  Amount: number;
  Status: ReceivableStatus;
  Notes?: string | null;
};

type ReceivableFormModel = {
  customerUUID: string;
  status: ReceivableStatus;
  description: string;
  docNumber: string;
  dueDate: string;
  amount: number;
  notes: string;
};

type CustomerOption = MnsSearchSelectFieldOption & { value: string };

type ReceivablesSnapshot = {
  items: Receivable[];
  customers: CustomerOption[];
};

@Component({
  selector: 'app-financial-receivables',
  standalone: true,
  imports: [
    CurrencyMaskDirective,
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
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './receivables.html',
  styleUrls: ['./receivables.scss'],
})
export class FinancialReceivablesPage {
  private readonly api = inject(ApiService);
  private readonly dateTime = inject(DateTimeFormatService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(TranslocoService);
  private readonly parameters = inject(SystemParameterService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly receivableFormDialog = viewChild<TemplateRef<unknown>>('receivableFormDialog');

  private formDialogBinding: CrudDialogBinding | null = null;
  private readonly mutating = signal(false);

  readonly searchInput = signal('');
  readonly statusInput = signal<ReceivableStatus | ''>('');
  readonly search = signal('');
  readonly status = signal<ReceivableStatus | ''>('');
  readonly sortActive = signal('dueDate');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly selectedReceivableUUIDs = signal<Set<string>>(new Set());
  readonly saving = signal(false);
  readonly editing = signal<Receivable | null>(null);

  readonly formModel = signal<ReceivableFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.customerUUID);
    required(schema.description);
    required(schema.dueDate);
    required(schema.amount);
  });

  readonly statusOptions: { value: ReceivableStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];
  readonly statusFilterOptions = [{ value: '', label: 'All' }, ...this.statusOptions];

  readonly displayedColumns = [
    'select',
    'description',
    'customer',
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
    defaultValue: { items: [], customers: [] } as ReceivablesSnapshot,
    loader: async ({ params }) => {
      const [items, customers] = await Promise.all([
        this.fetchReceivables(params.search, params.status),
        this.fetchCustomers(),
      ]);
      return { items, customers: this.mergeCustomers(customers, items) };
    },
  });

  readonly loading = computed(() => this.snapshotResource.isLoading() || this.mutating());
  readonly referenceLoading = computed(() => this.snapshotResource.isLoading());
  readonly rows = computed(() => this.snapshotResource.value().items);
  readonly customerOptions = computed(() => this.snapshotResource.value().customers);
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly selectedCount = computed(() => this.selectedReceivableUUIDs().size);
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
    this.snack.error(this.extractErrorMessage(error, this.t('Failed to load receivables.')));
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

  startEdit(row: Receivable) {
    this.editing.set(row);
    this.formModel.set({
      customerUUID: row.CustomerUUID ?? '',
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

  async saveReceivable(saveAndNew = false) {
    const payload = this.buildPayload();
    if (!payload) return;

    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(
          `erp/financial/accounts/receivables/${editing.ErpFinAccReceivableUUID}`,
          payload,
        );
        this.snack.success(this.t('Receivable updated successfully.'));
      } else {
        await this.api.post('erp/financial/accounts/receivables', payload);
        this.snack.success(this.t('Receivable created successfully.'));
      }

      this.snapshotResource.reload();
      if (saveAndNew && createMode) {
        this.editing.set(null);
        this.formModel.set(this.emptyFormModel());
        return;
      }
      this.cancelForm();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, this.t('Failed to save receivable.')));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewReceivable() {
    if (this.editing()) return;
    void this.saveReceivable(true);
  }

  async deleteReceivable(row: Receivable) {
    const confirmed = await this.confirm(
      'Delete receivable',
      'Are you sure you want to delete this receivable?',
      'Delete',
    );
    if (!confirmed) return;

    await this.runMutation(async () => {
      await this.api.delete(`erp/financial/accounts/receivables/${row.ErpFinAccReceivableUUID}`);
      this.clearSelection();
      this.snapshotResource.reload();
      this.snack.success(this.t('Receivable deleted successfully.'));
    }, 'Failed to delete receivable.');
  }

  async deleteSelectedReceivables() {
    const ids = [...this.selectedReceivableUUIDs()];
    if (!ids.length) return;

    const confirmed = await this.confirm(
      'Delete selected receivables',
      'Delete selected receivables confirmation',
      'Delete selected',
      { count: ids.length },
    );
    if (!confirmed) return;

    await this.runMutation(async () => {
      const response = await this.api.delete<any>('erp/financial/accounts/receivables/bulk', {
        ids,
      });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.selectedReceivableUUIDs.set(failed);
      this.snapshotResource.reload();

      if (failed.size) {
        this.snack.error(
          this.t('Receivables bulk delete partial failure', {
            deleted: deleted.size,
            failed: failed.size,
          }),
        );
        return;
      }
      this.snack.success(
        this.t('Receivables bulk deleted successfully', { count: deleted.size || ids.length }),
      );
    }, 'Failed to delete selected receivables.');
  }

  isSelected(row: Receivable) {
    return this.selectedReceivableUUIDs().has(row.ErpFinAccReceivableUUID);
  }

  toggleRow(row: Receivable, checked: boolean) {
    this.selectedReceivableUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) next.add(row.ErpFinAccReceivableUUID);
      else next.delete(row.ErpFinAccReceivableUUID);
      return next;
    });
  }

  toggleVisibleRows(checked: boolean) {
    this.selectedReceivableUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        if (checked) next.add(row.ErpFinAccReceivableUUID);
        else next.delete(row.ErpFinAccReceivableUUID);
      }
      return next;
    });
  }

  customerOpened(opened: boolean) {
    if (opened && !this.customerOptions().length && !this.snapshotResource.isLoading()) {
      this.snapshotResource.reload();
    }
  }

  customerLabel(row: Receivable) {
    return (
      this.clean(row.CustomerName) ?? this.clean(row.CustomerLegalName) ?? row.CustomerUUID ?? '-'
    );
  }

  statusLabel(status: ReceivableStatus) {
    return this.t(this.statusOptions.find((item) => item.value === status)?.label ?? status);
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
    if (!value.customerUUID) {
      this.snack.warning(this.t('Customer is required.'));
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
      customerUUID: value.customerUUID,
      description: value.description.trim(),
      docNumber: this.clean(value.docNumber),
      dueDate: value.dueDate,
      amount: this.toAmount(value.amount),
      status: value.status,
      notes: this.clean(value.notes),
    };
  }

  private async fetchReceivables(search: string, status: ReceivableStatus | '') {
    const params = new URLSearchParams({ limit: String(this.listLimit), offset: '0' });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    return this.extractItems<Receivable>(
      await this.api.get<any>(`erp/financial/accounts/receivables?${params.toString()}`),
    );
  }

  private async fetchCustomers() {
    return this.fetchPaged('erp/customers', (item) => {
      const value = String(item.CustomerUUID ?? item.customerUUID ?? item.uuid ?? '').trim();
      const label = String(item.Name ?? item.name ?? item.CustomerName ?? '').trim();
      if (!value || !label) return null;
      const description = [item.Document ?? item.document, item.Email ?? item.email]
        .filter(Boolean)
        .join(' - ');
      return { value, label, description, searchText: `${label} ${description} ${value}` };
    });
  }

  private mergeCustomers(options: CustomerOption[], rows: Receivable[]) {
    const map = new Map(options.map((option) => [option.value, option]));
    for (const row of rows) {
      if (!row.CustomerUUID || map.has(row.CustomerUUID)) continue;
      map.set(row.CustomerUUID, {
        value: row.CustomerUUID,
        label: this.customerLabel(row),
        description: [row.CustomerDocument, row.CustomerEmail].filter(Boolean).join(' - '),
        searchText: `${this.customerLabel(row)} ${row.CustomerDocument ?? ''} ${row.CustomerEmail ?? ''} ${
          row.CustomerUUID
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

  private sortRows(rows: Receivable[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((left, right) => {
      const result = this.compare(this.sortValue(left, active), this.sortValue(right, active));
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: Receivable, column: string): string | number {
    switch (column) {
      case 'description':
        return row.Description ?? '';
      case 'customer':
        return this.customerLabel(row);
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
    const template = this.receivableFormDialog();
    if (!template || this.formDialogBinding) return;
    this.formDialogBinding = openCrudTemplateDialog(
      this.dialog,
      template,
      'erp-receivable-form-dialog',
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
    const available = new Set(this.rows().map((row) => row.ErpFinAccReceivableUUID));
    this.selectedReceivableUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private clearSelection() {
    this.selectedReceivableUUIDs.set(new Set());
  }

  private emptyFormModel(): ReceivableFormModel {
    return {
      customerUUID: '',
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
    if (typeof item.ErpFinAccReceivableUUID === 'string') return item.ErpFinAccReceivableUUID;
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
