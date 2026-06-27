import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatNativeDateModule } from '@angular/material/core';
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
} from '../../../../../shared/forms';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type PayableStatus = 'open' | 'paid' | 'overdue' | 'canceled';
type PaymentMethod = 'pix' | 'bank_transfer' | 'cash' | 'boleto' | 'card' | 'other';

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
  PaymentDate?: string | null;
  PaidAmount?: number | null;
  PaymentMethod?: string | null;
  PaymentReference?: string | null;
  PaymentNotes?: string | null;
  Notes?: string | null;
};

type SupplierOption = MnsSearchSelectFieldOption & { value: string };

type PayablesSnapshot = {
  items: Payable[];
  suppliers: SupplierOption[];
};

@Component({
  selector: 'app-financial-payables',
  standalone: true,
  imports: [
    CurrencyMaskDirective,
    DateMaskDirective,
    MnsSearchSelectFieldComponent,
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
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(TranslocoService);
  private readonly parameters = inject(SystemParameterService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly payableFormDialog = viewChild<TemplateRef<unknown>>('payableFormDialog');
  readonly payableSettleDialog = viewChild<TemplateRef<unknown>>('payableSettleDialog');

  private formDialogBinding: CrudDialogBinding | null = null;
  private settleDialogBinding: CrudDialogBinding | null = null;

  readonly searchInput = signal('');
  readonly statusInput = signal<PayableStatus | ''>('');
  readonly search = signal('');
  readonly status = signal<PayableStatus | ''>('');
  readonly sortActive = signal('dueDate');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly editing = signal<Payable | null>(null);
  readonly settlingPayable = signal<Payable | null>(null);

  readonly statusOptions: { value: PayableStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];
  readonly statusFilterOptions = [{ value: '', label: 'All' }, ...this.statusOptions];
  readonly paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'pix', label: 'PIX' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'card', label: 'Card' },
    { value: 'other', label: 'Other' },
  ];

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

  form = this.emptyForm();
  settleForm = this.emptySettleForm();

  readonly currencyResource = resource({
    defaultValue: 'BRL',
    loader: () => this.parameters.resolveDefaultCurrency('BRL'),
  });

  private readonly snapshotResource = resource({
    params: () => ({ search: this.search(), status: this.status() }),
    defaultValue: { items: [], suppliers: [] } as PayablesSnapshot,
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
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.ErpFinAccPayableUUID));
  });
  readonly someVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return (
      rows.some((row) => this.selectedIds().has(row.ErpFinAccPayableUUID)) &&
      !this.allVisibleSelected()
    );
  });

  private readonly cleanup = this.destroyRef.onDestroy(() => {
    this.closeFormDialog();
    this.closeSettleDialog();
  });

  refreshList() {
    this.snapshotResource.reload();
  }

  applySearchFilters() {
    this.pageIndex.set(0);
    this.clearSelection();
    this.search.set(this.searchInput().trim());
    this.status.set(this.statusInput());
    this.snapshotResource.reload();
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.search.set('');
    this.status.set('');
    this.pageIndex.set(0);
    this.clearSelection();
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

  isSelected(row: Payable) {
    return this.selectedIds().has(row.ErpFinAccPayableUUID);
  }

  toggleRow(row: Payable, checked: boolean) {
    const next = new Set(this.selectedIds());
    if (checked) next.add(row.ErpFinAccPayableUUID);
    else next.delete(row.ErpFinAccPayableUUID);
    this.selectedIds.set(next);
  }

  toggleVisibleRows(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.visibleRows()) {
      if (checked) next.add(row.ErpFinAccPayableUUID);
      else next.delete(row.ErpFinAccPayableUUID);
    }
    this.selectedIds.set(next);
  }

  startCreate() {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.openFormDialog();
  }

  startEdit(row: Payable) {
    this.editing.set(row);
    this.form = {
      supplierUUID: row.SupplierUUID,
      description: row.Description ?? '',
      docNumber: row.DocNumber ?? '',
      dueDate: this.parseDate(row.DueDate),
      amount: Number(row.Amount ?? 0),
      status: row.Status ?? 'open',
      notes: row.Notes ?? '',
    };
    this.openFormDialog();
  }

  cancelForm() {
    this.closeFormDialog();
    this.editing.set(null);
    this.form = this.emptyForm();
  }

  async savePayable(closeAfterSave = true) {
    const payload = this.buildPayload();
    if (!payload) return;

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
      if (closeAfterSave || editing) this.cancelForm();
      else this.form = this.emptyForm();
    } catch (error) {
      this.showError(error, 'Failed to save payable.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNewPayable() {
    if (this.editing()) return;
    await this.savePayable(false);
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
      this.snack.success(this.t('Payable deleted successfully.'));
      this.clearSelection();
      this.snapshotResource.reload();
    }, 'Failed to delete payable.');
  }

  async deleteSelectedPayables() {
    const ids = [...this.selectedIds()];
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
      const failed = Array.isArray(response?.data?.failed) ? response.data.failed : [];
      this.selectedIds.set(
        new Set(failed.map((item: any) => String(item?.ErpFinAccPayableUUID ?? item?.id ?? ''))),
      );
      this.snack.success(this.t('Payables bulk delete completed.'));
      this.snapshotResource.reload();
    }, 'Failed to delete selected payables.');
  }

  startSettle(row: Payable) {
    this.settlingPayable.set(row);
    this.settleForm = {
      paymentDate: this.parseDate(row.PaymentDate ?? row.DueDate),
      paidAmount: Number(row.PaidAmount ?? row.Amount ?? 0),
      paymentMethod: (row.PaymentMethod as PaymentMethod) || 'pix',
      paymentReference: row.PaymentReference ?? '',
      paymentNotes: row.PaymentNotes ?? '',
    };
    this.openSettleDialog();
  }

  closePaymentDetails() {
    this.closeSettleDialog();
    this.settlingPayable.set(null);
    this.settleForm = this.emptySettleForm();
  }

  async settlePayable() {
    const payable = this.settlingPayable();
    const paymentDate = this.settleForm.paymentDate;
    if (!payable) return;
    if (!paymentDate) {
      this.snack.warning(this.t('Payment date is required.'));
      return;
    }
    if (this.toAmount(this.settleForm.paidAmount) <= 0) {
      this.snack.warning(this.t('Paid amount must be greater than zero.'));
      return;
    }

    await this.runMutation(async () => {
      await this.api.post(
        `erp/financial/accounts/payables/${payable.ErpFinAccPayableUUID}/settle`,
        {
          paymentDate: this.formatDate(paymentDate),
          paidAmount: this.toAmount(this.settleForm.paidAmount),
          paymentMethod: this.settleForm.paymentMethod,
          paymentReference: this.clean(this.settleForm.paymentReference),
          paymentNotes: this.clean(this.settleForm.paymentNotes),
        },
      );
      this.snack.success(this.t('Payable settled successfully.'));
      this.closePaymentDetails();
      this.snapshotResource.reload();
    }, 'Failed to settle payable.');
  }

  async reopenPayable(row: Payable) {
    const confirmed = await this.confirm(
      'Reopen payable',
      'Do you want to reopen this payable and clear payment data?',
      'Reopen',
    );
    if (!confirmed) return;

    await this.runMutation(async () => {
      await this.api.post(`erp/financial/accounts/payables/${row.ErpFinAccPayableUUID}/reopen`, {});
      this.snack.success(this.t('Payable reopened successfully.'));
      this.snapshotResource.reload();
    }, 'Failed to reopen payable.');
  }

  supplierLabel(row: Payable) {
    return this.clean(row.SupplierName) ?? row.SupplierUUID ?? '-';
  }

  statusLabel(status: PayableStatus) {
    return this.t(
      this.statusOptions.find((item) => item.value === status)?.label ?? status,
    ).toUpperCase();
  }

  amountLabel(value: number) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.currencyResource.value(),
    }).format(Number(value ?? 0));
  }

  dateLabel(value?: string | null) {
    const date = this.parseDate(value);
    return date ? new Intl.DateTimeFormat(undefined).format(date) : '-';
  }

  isStatusInactive(status: PayableStatus) {
    return status === 'canceled';
  }

  supplierChanged(value: string | number | boolean | null) {
    this.form.supplierUUID = String(value ?? '').trim();
  }

  supplierOpened(opened: boolean) {
    if (opened && !this.supplierOptions().length && !this.snapshotResource.isLoading()) {
      this.snapshotResource.reload();
    }
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
      return {
        value,
        label,
        description,
        searchText: `${label} ${description} ${value}`,
      };
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
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
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
      all.push(
        ...items.flatMap((item) => {
          const mapped = mapItem(item);
          return mapped ? [mapped] : [];
        }),
      );
      if (items.length < this.listLimit) break;
    }
    return all;
  }

  private sortRows(rows: Payable[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const result = this.compare(this.sortValue(a, active), this.sortValue(b, active));
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: Payable, column: string) {
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

  private buildPayload() {
    if (!this.form.supplierUUID) {
      this.snack.warning(this.t('Supplier is required.'));
      return null;
    }
    if (!this.form.description.trim()) {
      this.snack.warning(this.t('Description is required.'));
      return null;
    }
    if (!this.form.dueDate) {
      this.snack.warning(this.t('Due date is required.'));
      return null;
    }
    if (this.toAmount(this.form.amount) <= 0) {
      this.snack.warning(this.t('Amount must be greater than zero.'));
      return null;
    }

    return {
      supplierUUID: this.form.supplierUUID,
      description: this.form.description.trim(),
      docNumber: this.clean(this.form.docNumber),
      dueDate: this.formatDate(this.form.dueDate),
      amount: this.toAmount(this.form.amount),
      status: this.form.status,
      notes: this.clean(this.form.notes),
    };
  }

  private emptyForm() {
    return {
      supplierUUID: '',
      description: '',
      docNumber: '',
      dueDate: null as Date | null,
      amount: 0,
      status: 'open' as PayableStatus,
      notes: '',
    };
  }

  private emptySettleForm() {
    return {
      paymentDate: null as Date | null,
      paidAmount: 0,
      paymentMethod: 'pix' as PaymentMethod,
      paymentReference: '',
      paymentNotes: '',
    };
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
    bindDialogClosed(this.formDialogBinding.ref, () => {
      this.formDialogBinding?.stop();
      this.formDialogBinding = null;
    });
  }

  private closeFormDialog() {
    if (!this.formDialogBinding) return;
    const ref = this.formDialogBinding.ref;
    this.formDialogBinding.stop();
    this.formDialogBinding = null;
    ref.close();
  }

  private openSettleDialog() {
    const template = this.payableSettleDialog();
    if (!template || this.settleDialogBinding) return;
    this.settleDialogBinding = openCrudTemplateDialog(
      this.dialog,
      template,
      'erp-payable-form-dialog',
      {
        onEscape: () => this.closePaymentDetails(),
      },
    );
    bindDialogClosed(this.settleDialogBinding.ref, () => {
      this.settleDialogBinding?.stop();
      this.settleDialogBinding = null;
    });
  }

  private closeSettleDialog() {
    if (!this.settleDialogBinding) return;
    const ref = this.settleDialogBinding.ref;
    this.settleDialogBinding.stop();
    this.settleDialogBinding = null;
    ref.close();
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
      this.showError(error, fallbackMessage);
    } finally {
      this.mutating.set(false);
    }
  }

  private clearSelection() {
    this.selectedIds.set(new Set());
  }

  private extractItems<T>(response: any): T[] {
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  }

  private compare(left: string | number, right: string | number) {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const [datePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toAmount(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value ?? '')
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  private clean(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private showError(error: unknown, fallbackMessage: string) {
    this.snack.error(
      error instanceof Error && error.message ? error.message : this.t(fallbackMessage),
    );
  }

  private t(key: string, params?: Record<string, unknown>) {
    return this.i18n.translate(key, params);
  }
}
