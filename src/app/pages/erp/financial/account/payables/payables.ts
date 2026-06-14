import {
  Component,
  TemplateRef,
  effect,
  inject,
  resource,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { DateMaskDirective } from '../../../../../shared/date-mask/date-mask.directive';
import { CurrencyMaskDirective } from '../../../../../shared/currency-mask/currency-mask.directive';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';
import {
  bindDialogClosed,
  bindDialogEscape,
} from '../../../../../shared/dialog/dialog-events.util';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';

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
  MimeType?: string | null;
  FileSizeBytes?: number | null;
  DateCreated?: string | null;
};

type SupplierOption = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-financial-payables',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    DateMaskDirective,
    CurrencyMaskDirective,
  ],
  templateUrl: './payables.html',
  styleUrls: ['./payables.scss'],
})
export class FinancialPayablesPage {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);

  private readonly payablesResource = resource({
    defaultValue: [] as ErpFinAccPayable[],
    loader: async () => {
      const res = await this.api.get<{ data?: { items?: ErpFinAccPayable[] } }>(
        'erp/financial/accounts/payables',
      );
      return res?.data?.items ?? [];
    },
  });

  payables: ErpFinAccPayable[] = [];
  dataSource = new MatTableDataSource<ErpFinAccPayable>([]);
  displayedColumns: string[] = [
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
  error = '';
  search = '';
  searchInput = '';
  editingPayable: ErpFinAccPayable | null = null;
  selectedSettlePayable: ErpFinAccPayable | null = null;

  suppliers: SupplierOption[] = [];
  supplierMap = new Map<string, SupplierOption>();
  supplierSearch = '';
  amountPrefix = '';
  settleAttachments: ErpFinAccPayableAttachment[] = [];
  settleFiles: File[] = [];

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly payableFormDialog = viewChild<TemplateRef<unknown>>('payableFormDialog');
  readonly payableSettleDialog = viewChild<TemplateRef<unknown>>('payableSettleDialog');
  private payableFormDialogRef: MatDialogRef<unknown> | null = null;
  private payableSettleDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private settleDialogBinding: CrudDialogBinding | null = null;

  statusOptions: { value: PayableStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];
  paymentMethodOptions: { value: PayablePaymentMethod; label: string }[] = [
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

  get loading() {
    return this.payablesResource.isLoading();
  }

  private readonly syncPayables = effect(() => {
    this.payables = this.payablesResource.value();
    this.dataSource.data = [...this.payables];
    this.applyFilter();
  });

  private readonly reportPayablesError = effect(() => {
    const error = this.payablesResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load payables.'));
      this.dataSource.data = [];
    }
  });

  private readonly initializePage = (() => {
    this.amountPrefix = this.getCurrencyAffixes().prefix;
    this.startCreate();
    void this.fetchSuppliers();

    return true;
  })();

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closePayableDialog();
    this.closeSettleDialog();
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'description':
          return data.Description ?? '';
        case 'supplier':
          return this.supplierLabel(data.SupplierUUID) ?? '';
        case 'docNumber':
          return data.DocNumber ?? '';
        case 'dueDate':
          return data.DueDate ?? '';
        case 'amount':
          return data.Amount ?? 0;
        case 'status':
          return data.Status ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const supplier = this.supplierLabel(data.SupplierUUID);
      return [data.Description, data.DocNumber, supplier]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.applyFilter();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.applyFilter();
  }

  refreshList() {
    this.payablesResource.reload();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async fetchSuppliers() {
    try {
      const res = await this.api.get<any>('erp/suppliers');
      const items = res?.data?.items ?? [];
      this.suppliers = items.map((item: any) => ({
        value: item.SupplierUUID,
        label: item.Name,
      }));
      this.supplierMap = new Map(this.suppliers.map((s) => [s.value, s]));
    } catch (err) {
      console.error('Failed to load suppliers.', err);
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

  startEdit(payable: ErpFinAccPayable) {
    this.editingPayable = payable;
    this.form.supplierUUID = payable.SupplierUUID ?? '';
    this.form.description = payable.Description ?? '';
    this.form.docNumber = payable.DocNumber ?? '';
    this.form.dueDate = this.parseDateInput(payable.DueDate);
    this.form.amount = payable.Amount ?? 0;
    this.form.status = payable.Status ?? 'open';
    this.form.notes = payable.Notes ?? '';
  }

  openEditDialog(payable: ErpFinAccPayable) {
    this.startEdit(payable);
    this.openPayableDialog();
  }

  async savePayable(closeAfterSave = true) {
    if (!this.form.description.trim()) {
      this.showWarning('Description is required.');
      return;
    }

    if (!this.form.supplierUUID) {
      this.showWarning('Supplier is required.');
      return;
    }

    if (!this.form.dueDate) {
      this.showWarning('Due date is required.');
      return;
    }

    if (!Number.isFinite(Number(this.form.amount)) || Number(this.form.amount) <= 0) {
      this.showWarning('Amount must be greater than zero.');
      return;
    }

    this.saving = true;
    this.error = '';

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
        this.snack.success('Payable updated successfully.');
        this.closePayableDialog();
        this.startCreate();
      } else {
        await this.api.post('erp/financial/accounts/payables', payload);
        this.snack.success('Payable created successfully.');
        if (closeAfterSave) {
          this.closePayableDialog();
          this.startCreate();
        } else {
          this.resetCreateForm();
        }
      }
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save payable.');
    } finally {
      this.saving = false;
    }
  }

  cancelPayableForm() {
    this.closePayableDialog();
    this.startCreate();
  }

  async saveAndNewPayable() {
    if (this.editingPayable) return;
    await this.savePayable(false);
  }

  async deletePayable(payableUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete payable',
        message: 'Are you sure you want to delete this payable?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.error = '';
    try {
      await this.api.delete(`erp/financial/accounts/payables/${payableUUID}`);
      this.snack.success('Payable deleted successfully.');
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete payable.');
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
    this.error = '';
    void this.fetchSettleAttachments();
    this.openSettleDialogInternal();
  }

  async reopenPayable(payable: ErpFinAccPayable) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Reopen payable',
        message: 'Do you want to reopen this payable and clear payment data?',
        confirmLabel: 'Reopen',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.error = '';
    try {
      await this.api.post(
        `erp/financial/accounts/payables/${payable.ErpFinAccPayableUUID}/reopen`,
        {},
      );
      this.snack.success('Payable reopened successfully.');
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to reopen payable.');
    }
  }

  async saveSettle() {
    if (!this.selectedSettlePayable) return;
    if (!this.settleForm.paymentDate) {
      this.showWarning('Payment date is required.');
      return;
    }
    if (
      !Number.isFinite(Number(this.settleForm.paidAmount)) ||
      Number(this.settleForm.paidAmount) <= 0
    ) {
      this.showWarning('Paid amount must be greater than zero.');
      return;
    }

    this.settling = true;
    this.error = '';
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
      this.snack.success('Payable settled successfully.');
      await this.fetchSettleAttachments();
      this.payablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to settle payable.');
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
    if (index < 0 || index >= this.settleFiles.length) return;
    this.settleFiles.splice(index, 1);
  }

  async deleteSettleAttachment(attachment: ErpFinAccPayableAttachment) {
    if (!this.selectedSettlePayable) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete attachment',
        message: 'Are you sure you want to delete this attachment?',
        confirmLabel: 'Delete',
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
      this.snack.success('Attachment deleted successfully.');
      await this.fetchSettleAttachments();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete attachment.');
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
      this.showError(err?.message ?? 'Failed to load attachments.');
    }
  }

  supplierLabel(uuid: string) {
    return this.supplierMap.get(uuid)?.label ?? '-';
  }

  get filteredSuppliers() {
    const value = this.supplierSearch.trim().toLowerCase();
    if (!value) return this.suppliers;
    return this.suppliers.filter((supplier) =>
      (supplier.label ?? '').toLowerCase().includes(value),
    );
  }

  onSupplierOpened(opened: boolean) {
    if (opened) {
      this.supplierSearch = '';
    }
  }

  formatAmount(value: number) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  statusLabel(status: PayableStatus) {
    return status.toUpperCase();
  }

  isStatusInactive(status: PayableStatus) {
    return status === 'canceled';
  }

  private parseDateInput(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    const [datePart] = trimmed.split('T');
    if (!datePart) return null;
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

    let prefix = '';

    if (currencyIndex > -1 && integerIndex > -1 && currencyIndex < integerIndex) {
      const literal = parts[currencyIndex + 1];
      prefix = currencyPart + (literal?.type === 'literal' ? literal.value : ' ');
    } else {
      prefix = `${currencyPart} `;
    }

    return { prefix };
  }

  private getCurrencyFromLocale(locale: string) {
    let region = '';
    try {
      region = new Intl.Locale(locale).region ?? '';
    } catch {
      region = '';
    }
    const map: Record<string, string> = {
      BR: 'BRL',
      US: 'USD',
      PT: 'EUR',
      ES: 'EUR',
      FR: 'EUR',
      DE: 'EUR',
      IT: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      IE: 'EUR',
      AT: 'EUR',
      FI: 'EUR',
      GR: 'EUR',
      LU: 'EUR',
      LT: 'EUR',
      LV: 'EUR',
      EE: 'EUR',
      SK: 'EUR',
      SI: 'EUR',
      CY: 'EUR',
      MT: 'EUR',
      GB: 'GBP',
      MX: 'MXN',
      AR: 'ARS',
      CL: 'CLP',
      CO: 'COP',
      PE: 'PEN',
      UY: 'UYU',
      PY: 'PYG',
      CA: 'CAD',
      AU: 'AUD',
      NZ: 'NZD',
      JP: 'JPY',
    };
    return map[region] ?? 'USD';
  }

  private openPayableDialog() {
    const payableFormDialog = this.payableFormDialog();
    if (!payableFormDialog || this.payableFormDialogRef) return;
    this.error = '';
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      payableFormDialog,
      'erp-payable-form-dialog',
    );
    this.payableFormDialogRef = this.dialogBinding.ref;
    bindDialogEscape(this.payableFormDialogRef, () => {
      this.cancelPayableForm();
    });
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
    bindDialogEscape(this.payableSettleDialogRef, () => {
      this.closeSettleDialog();
    });
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

  private resetCreateForm() {
    this.editingPayable = null;
    this.form.supplierUUID = '';
    this.form.description = '';
    this.form.docNumber = '';
    this.form.dueDate = null;
    this.form.amount = 0;
    this.form.status = 'open';
    this.form.notes = '';
    this.error = '';
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
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { error?: string; message?: string } }).error;
      return payload?.error || payload?.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }
}
