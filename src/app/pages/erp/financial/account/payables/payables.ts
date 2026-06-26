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
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
import {
  bindDialogClosed,
  bindDialogEscape,
} from '../../../../../shared/dialog/dialog-events.util';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { CurrencyMaskDirective } from '../../../../../shared/currency-mask/currency-mask.directive';
import { DateMaskDirective } from '../../../../../shared/date-mask/date-mask.directive';
import { MnsSearchSelectFieldComponent } from '../../../../../shared/forms/mns-search-select-field/mns-search-select-field';
import type { MnsSearchSelectFieldOption } from '../../../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type PayableStatus = 'open' | 'paid' | 'overdue' | 'canceled';
type PayablePaymentMethod = 'cash' | 'bank_transfer' | 'pix' | 'boleto' | 'card' | 'other';

type ErpFinAccPayable = {
  ErpFinAccPayableUUID: string;
  SupplierUUID: string;
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

type ErpFinAccPayableAttachment = {
  ErpFinAccPayableAttachmentUUID: string;
  ErpFinAccPayableUUID: string;
  StorageKey: string;
  Url: string;
  FileName?: string | null;
  FileSizeBytes?: number | null;
};

type SupplierOption = MnsSearchSelectFieldOption & {
  value: string;
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
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);
  private i18n = inject(TranslocoService);

  readonly payableFormDialog = viewChild<TemplateRef<unknown>>('payableFormDialog');
  readonly payableSettleDialog = viewChild<TemplateRef<unknown>>('payableSettleDialog');
  private payableFormDialogRef: MatDialogRef<unknown> | null = null;
  private payableSettleDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private settleDialogBinding: CrudDialogBinding | null = null;

  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusFilter = signal<PayableStatus | ''>('');
  readonly sortActive = signal('dueDate');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly selectedIds = signal<Set<string>>(new Set());

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

  saving = false;
  settling = false;
  deletingMany = false;
  editingPayable: ErpFinAccPayable | null = null;
  selectedSettlePayable: ErpFinAccPayable | null = null;
  suppliers: SupplierOption[] = [];
  supplierMap = new Map<string, SupplierOption>();
  amountPrefix = '';
  settleAttachments: ErpFinAccPayableAttachment[] = [];
  settleFiles: File[] = [];

  readonly statusOptions: { value: PayableStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];
  readonly statusFilterOptions = [{ value: '', label: 'All' }, ...this.statusOptions];
  readonly paymentMethodOptions: { value: PayablePaymentMethod; label: string }[] = [
    { value: 'pix', label: 'PIX' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'card', label: 'Card' },
    { value: 'other', label: 'Other' },
  ];

  form = {
    supplierUUID: '',
    description: '',
    docNumber: '',
    dueDate: null as Date | null,
    amount: 0,
    status: 'open' as PayableStatus,
    notes: '',
  };

  settleForm = {
    paymentDate: null as Date | null,
    paidAmount: 0,
    paymentMethod: 'pix' as PayablePaymentMethod,
    paymentReference: '',
    paymentNotes: '',
  };

  private readonly payablesResource = resource({
    defaultValue: [] as ErpFinAccPayable[],
    loader: async () => {
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      const q = this.search().trim();
      const status = this.statusFilter();
      if (q) params.set('q', q);
      if (status) params.set('status', status);

      const res = await this.api.get<{ data?: { items?: ErpFinAccPayable[] } }>(
        `erp/financial/accounts/payables?${params.toString()}`,
      );
      return res?.data?.items ?? [];
    },
  });

  readonly filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.payablesResource.value().filter((row) => {
      if (status && row.Status !== status) return false;
      if (!q) return true;
      return [row.Description, row.DocNumber, this.supplierLabel(row.SupplierUUID)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  });

  readonly sortedRows = computed(() => {
    const active = this.sortActive();
    const direction = this.sortDirection();
    const rows = [...this.filteredRows()];
    if (!active || !direction) return rows;
    return rows.sort((left, right) => {
      const result = this.compareValues(
        this.sortValue(left, active),
        this.sortValue(right, active),
      );
      return direction === 'asc' ? result : -result;
    });
  });

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

  get loading() {
    return this.payablesResource.isLoading();
  }

  constructor() {
    this.amountPrefix = this.getCurrencyAffixes().prefix;
    this.startCreate();
    void this.fetchSuppliers();
    inject(DestroyRef).onDestroy(() => {
      this.closePayableDialog();
      this.closeSettleDialog();
    });
  }

  refreshList() {
    this.payablesResource.reload();
  }

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    this.pageIndex.set(0);
    this.clearSelection();
    this.payablesResource.reload();
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set('');
    this.pageIndex.set(0);
    this.clearSelection();
    this.payablesResource.reload();
  }

  setSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.pageIndex.set(0);
  }

  setPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  isSelected(row: ErpFinAccPayable) {
    return this.selectedIds().has(row.ErpFinAccPayableUUID);
  }

  toggleRow(row: ErpFinAccPayable, checked: boolean) {
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

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  async deleteManyPayables() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete selected payables'),
        message: this.t('Delete selected payables confirmation', { count: ids.length }),
        confirmLabel: this.t('Delete selected'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingMany = true;
    try {
      const response = await this.api.delete('erp/financial/accounts/payables/bulk', { ids });
      const result = this.parseBulkDeleteResult(response, ids);
      const failedIds = new Set<string>(
        result.failed.map((item: { ErpFinAccPayableUUID: string }) => item.ErpFinAccPayableUUID),
      );
      this.selectedIds.set(failedIds);
      if (result.failed.length) {
        this.snack.warning(
          this.t('Payables bulk delete partial failure', {
            deleted: result.deleted.length,
            failed: result.failed.length,
          }),
        );
      } else {
        this.snack.success(
          this.t('Payables bulk deleted successfully', { count: result.deleted.length }),
        );
      }
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? this.t('Failed to delete selected payables.'));
    } finally {
      this.deletingMany = false;
    }
  }

  async fetchSuppliers() {
    try {
      const res = await this.api.get<any>('erp/suppliers?limit=500&offset=0');
      const items = res?.data?.items ?? [];
      this.suppliers = items.map((item: any) => ({
        value: item.SupplierUUID,
        label: item.Name,
        searchText: [item.Document, item.Email].filter(Boolean).join(' '),
      }));
      this.supplierMap = new Map(this.suppliers.map((supplier) => [supplier.value, supplier]));
    } catch (err) {
      console.error(this.t('Failed to load suppliers.'), err);
    }
  }

  startCreate() {
    this.editingPayable = null;
    this.form.supplierUUID = '';
    this.form.description = '';
    this.form.docNumber = '';
    this.form.dueDate = null;
    this.form.amount = 0;
    this.form.status = 'open';
    this.form.notes = '';
  }

  openCreateDialog() {
    this.startCreate();
    this.openPayableDialog();
  }

  openEditDialog(payable: ErpFinAccPayable) {
    this.editingPayable = payable;
    this.form.supplierUUID = payable.SupplierUUID ?? '';
    this.form.description = payable.Description ?? '';
    this.form.docNumber = payable.DocNumber ?? '';
    this.form.dueDate = this.parseDateInput(payable.DueDate);
    this.form.amount = payable.Amount ?? 0;
    this.form.status = payable.Status ?? 'open';
    this.form.notes = payable.Notes ?? '';
    this.openPayableDialog();
  }

  async savePayable(closeAfterSave = true) {
    if (!this.form.description.trim()) {
      this.showWarning(this.t('Description is required.'));
      return;
    }
    if (!this.form.supplierUUID) {
      this.showWarning(this.t('Supplier is required.'));
      return;
    }
    if (!this.form.dueDate) {
      this.showWarning(this.t('Due date is required.'));
      return;
    }
    if (!Number.isFinite(Number(this.form.amount)) || Number(this.form.amount) <= 0) {
      this.showWarning(this.t('Amount must be greater than zero.'));
      return;
    }

    this.saving = true;
    try {
      const payload = {
        supplierUUID: this.form.supplierUUID,
        description: this.form.description.trim(),
        docNumber: this.form.docNumber?.trim() || null,
        dueDate: this.formatDateInput(this.form.dueDate),
        amount: Number(this.form.amount),
        status: this.form.status,
        notes: this.form.notes?.trim() || null,
      };

      if (this.editingPayable) {
        await this.api.put(
          `erp/financial/accounts/payables/${this.editingPayable.ErpFinAccPayableUUID}`,
          payload,
        );
        this.snack.success(this.t('Payable updated successfully.'));
        this.closePayableDialog();
        this.startCreate();
      } else {
        await this.api.post('erp/financial/accounts/payables', payload);
        this.snack.success(this.t('Payable created successfully.'));
        if (closeAfterSave) {
          this.closePayableDialog();
          this.startCreate();
        } else {
          this.startCreate();
        }
      }
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? this.t('Failed to save payable.'));
    } finally {
      this.saving = false;
    }
  }

  async saveAndNewPayable() {
    if (this.editingPayable) return;
    await this.savePayable(false);
  }

  cancelPayableForm() {
    this.closePayableDialog();
    this.startCreate();
  }

  async deletePayable(payableUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete payable'),
        message: this.t('Are you sure you want to delete this payable?'),
        confirmLabel: this.t('Delete'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.delete(`erp/financial/accounts/payables/${payableUUID}`);
      this.snack.success(this.t('Payable deleted successfully.'));
      this.clearSelection();
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? this.t('Failed to delete payable.'));
    }
  }

  openSettleDialog(payable: ErpFinAccPayable) {
    this.selectedSettlePayable = payable;
    this.settleForm.paymentDate = this.parseDateInput(payable.PaymentDate ?? payable.DueDate);
    this.settleForm.paidAmount = Number(payable.PaidAmount ?? payable.Amount ?? 0);
    this.settleForm.paymentMethod = (payable.PaymentMethod as PayablePaymentMethod) || 'pix';
    this.settleForm.paymentReference = payable.PaymentReference ?? '';
    this.settleForm.paymentNotes = payable.PaymentNotes ?? '';
    this.settleFiles = [];
    void this.fetchSettleAttachments();
    this.openSettleDialogInternal();
  }

  async reopenPayable(payable: ErpFinAccPayable) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Reopen payable'),
        message: this.t('Do you want to reopen this payable and clear payment data?'),
        confirmLabel: this.t('Reopen'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.post(
        `erp/financial/accounts/payables/${payable.ErpFinAccPayableUUID}/reopen`,
        {},
      );
      this.snack.success(this.t('Payable reopened successfully.'));
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? this.t('Failed to reopen payable.'));
    }
  }

  async saveSettle() {
    if (!this.selectedSettlePayable) return;
    if (!this.settleForm.paymentDate) {
      this.showWarning(this.t('Payment date is required.'));
      return;
    }
    if (
      !Number.isFinite(Number(this.settleForm.paidAmount)) ||
      Number(this.settleForm.paidAmount) <= 0
    ) {
      this.showWarning(this.t('Paid amount must be greater than zero.'));
      return;
    }

    this.settling = true;
    const payableUUID = this.selectedSettlePayable.ErpFinAccPayableUUID;
    try {
      await this.api.post(`erp/financial/accounts/payables/${payableUUID}/settle`, {
        paymentDate: this.formatDateInput(this.settleForm.paymentDate),
        paidAmount: Number(this.settleForm.paidAmount),
        paymentMethod: this.settleForm.paymentMethod || null,
        paymentReference: this.settleForm.paymentReference?.trim() || null,
        paymentNotes: this.settleForm.paymentNotes?.trim() || null,
      });

      for (const file of this.settleFiles) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        await this.api.post(`erp/financial/accounts/payables/${payableUUID}/attachments`, formData);
      }

      this.settleFiles = [];
      this.snack.success(this.t('Payable settled successfully.'));
      await this.fetchSettleAttachments();
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? this.t('Failed to settle payable.'));
    } finally {
      this.settling = false;
    }
  }

  onSettleFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.settleFiles = files.filter(
      (file) => file.type.startsWith('image/') || file.type === 'application/pdf',
    );
    input.value = '';
  }

  removePendingSettleFile(index: number) {
    this.settleFiles.splice(index, 1);
  }

  async deleteSettleAttachment(attachment: ErpFinAccPayableAttachment) {
    if (!this.selectedSettlePayable) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete attachment'),
        message: this.t('Are you sure you want to delete this attachment?'),
        confirmLabel: this.t('Delete'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(
        `erp/financial/accounts/payables/${this.selectedSettlePayable.ErpFinAccPayableUUID}/attachments/${attachment.ErpFinAccPayableAttachmentUUID}`,
      );
      this.snack.success(this.t('Attachment deleted successfully.'));
      await this.fetchSettleAttachments();
    } catch (err: any) {
      this.showError(err?.message ?? this.t('Failed to delete attachment.'));
    }
  }

  async fetchSettleAttachments() {
    if (!this.selectedSettlePayable) {
      this.settleAttachments = [];
      return;
    }
    try {
      const res = await this.api.get<any>(
        `erp/financial/accounts/payables/${this.selectedSettlePayable.ErpFinAccPayableUUID}/attachments`,
      );
      this.settleAttachments = res?.data?.items ?? [];
    } catch (err: any) {
      this.settleAttachments = [];
      this.showError(err?.message ?? this.t('Failed to load attachments.'));
    }
  }

  supplierLabel(uuid: string) {
    return this.supplierMap.get(uuid)?.label ?? '-';
  }

  formatAmount(value: number) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  statusLabel(status: PayableStatus) {
    return this.t(
      this.statusOptions.find((option) => option.value === status)?.label ?? status,
    ).toUpperCase();
  }

  statusChipClass(status: PayableStatus) {
    const map: Record<PayableStatus, string> = {
      open: 'chip-queued',
      paid: 'chip-success',
      overdue: 'chip-failed',
      canceled: 'chip-skipped',
    };
    return map[status] ?? 'chip-queued';
  }

  isStatusInactive(status: PayableStatus) {
    return status === 'canceled';
  }

  private sortValue(row: ErpFinAccPayable, key: string): string | number {
    switch (key) {
      case 'description':
        return row.Description ?? '';
      case 'supplier':
        return this.supplierLabel(row.SupplierUUID);
      case 'docNumber':
        return row.DocNumber ?? '';
      case 'dueDate':
        return row.DueDate ?? '';
      case 'amount':
        return Number(row.Amount ?? 0);
      case 'status':
        return row.Status ?? '';
      default:
        return '';
    }
  }

  private compareValues(left: string | number, right: string | number) {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
  }

  private parseBulkDeleteResult(response: any, requestedIds: string[]) {
    const data = response?.data ?? response ?? {};
    const deleted = Array.isArray(data.deleted) ? data.deleted : requestedIds;
    const failed = Array.isArray(data.failed) ? data.failed : [];
    return {
      deleted: deleted.filter((id: unknown): id is string => typeof id === 'string'),
      failed: failed
        .map((item: any) => ({
          ErpFinAccPayableUUID: String(item?.ErpFinAccPayableUUID ?? item?.uuid ?? item?.id ?? ''),
          message: String(item?.message ?? 'Failed to delete payable.'),
        }))
        .filter((item: { ErpFinAccPayableUUID: string }) => item.ErpFinAccPayableUUID),
    };
  }

  private parseDateInput(value?: string | null) {
    if (!value) return null;
    const [datePart] = value.trim().split('T');
    const [year, month, day] = datePart.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatDateInput(value: Date | null) {
    if (!value) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getCurrencyAffixes() {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    const currency = this.getCurrencyFromLocale(locale);
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const parts = formatter.formatToParts(1.1);
    const currencyPart = parts.find((part) => part.type === 'currency')?.value ?? '$';
    const integerIndex = parts.findIndex((part) => part.type === 'integer');
    const currencyIndex = parts.findIndex((part) => part.type === 'currency');
    const prefix =
      currencyIndex > -1 && integerIndex > -1 && currencyIndex < integerIndex
        ? currencyPart +
          (parts[currencyIndex + 1]?.type === 'literal' ? parts[currencyIndex + 1].value : ' ')
        : `${currencyPart} `;
    return { prefix };
  }

  private getCurrencyFromLocale(locale: string) {
    let region = '';
    try {
      region = new Intl.Locale(locale).region ?? '';
    } catch {
      region = '';
    }
    return (
      {
        BR: 'BRL',
        US: 'USD',
        PT: 'EUR',
        ES: 'EUR',
        GB: 'GBP',
        MX: 'MXN',
        AR: 'ARS',
        CL: 'CLP',
        CO: 'COP',
        PE: 'PEN',
        CA: 'CAD',
      }[region] ?? 'USD'
    );
  }

  private openPayableDialog() {
    const payableFormDialog = this.payableFormDialog();
    if (!payableFormDialog || this.payableFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      payableFormDialog,
      'erp-payable-form-dialog',
    );
    this.payableFormDialogRef = this.dialogBinding.ref;
    bindDialogEscape(this.payableFormDialogRef, () => this.cancelPayableForm());
    bindDialogClosed(this.payableFormDialogRef, () => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
      this.payableFormDialogRef = null;
    });
  }

  private closePayableDialog() {
    if (!this.payableFormDialogRef) return;
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.payableFormDialogRef.close();
    this.payableFormDialogRef = null;
  }

  private openSettleDialogInternal() {
    const payableSettleDialog = this.payableSettleDialog();
    if (!payableSettleDialog || this.payableSettleDialogRef) return;
    this.settleDialogBinding = openCrudTemplateDialog(
      this.dialog,
      payableSettleDialog,
      'erp-payable-form-dialog',
    );
    this.payableSettleDialogRef = this.settleDialogBinding.ref;
    bindDialogEscape(this.payableSettleDialogRef, () => this.closeSettleDialog());
    bindDialogClosed(this.payableSettleDialogRef, () => {
      this.settleDialogBinding?.stop();
      this.settleDialogBinding = null;
      this.payableSettleDialogRef = null;
      this.selectedSettlePayable = null;
      this.settleAttachments = [];
      this.settleFiles = [];
    });
  }

  closeSettleDialog() {
    if (!this.payableSettleDialogRef) return;
    this.settleDialogBinding?.stop();
    this.settleDialogBinding = null;
    this.payableSettleDialogRef.close();
    this.payableSettleDialogRef = null;
    this.selectedSettlePayable = null;
    this.settleAttachments = [];
    this.settleFiles = [];
  }

  private showError(message: string) {
    this.snack.error(message);
  }

  private showWarning(message: string) {
    this.snack.warning(message);
  }

  private t(key: string, params?: Record<string, unknown>) {
    return this.i18n.translate(key, params);
  }
}
