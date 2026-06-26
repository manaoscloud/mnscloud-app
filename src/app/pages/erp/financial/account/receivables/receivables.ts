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
import { TranslocoPipe } from '@jsverse/transloco';
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

type ReceivableStatus = 'open' | 'paid' | 'overdue' | 'canceled';

type ErpFinAccReceivable = {
  ErpFinAccReceivableUUID: string;
  CustomerUUID: string;
  Description: string;
  DocNumber?: string | null;
  DueDate: string;
  Amount: number;
  Status: ReceivableStatus;
  Notes?: string | null;
};

type CustomerOption = MnsSearchSelectFieldOption & {
  value: string;
};

@Component({
  selector: 'app-financial-receivables',
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
  templateUrl: './receivables.html',
  styleUrls: ['./receivables.scss'],
})
export class FinancialReceivablesPage {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);

  readonly receivableFormDialog = viewChild<TemplateRef<unknown>>('receivableFormDialog');
  private receivableFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusFilter = signal<ReceivableStatus | ''>('');
  readonly sortActive = signal('dueDate');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly selectedIds = signal<Set<string>>(new Set());

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

  saving = false;
  deletingMany = false;
  issuingBoletoUUID: string | null = null;
  editingReceivable: ErpFinAccReceivable | null = null;
  customers: CustomerOption[] = [];
  customerMap = new Map<string, CustomerOption>();
  amountPrefix = '';

  readonly statusOptions: { value: ReceivableStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];

  readonly statusFilterOptions = [{ value: '', label: 'All' }, ...this.statusOptions];

  form = {
    customerUUID: '',
    description: '',
    docNumber: '',
    dueDate: null as Date | null,
    amount: 0,
    status: 'open' as ReceivableStatus,
    notes: '',
  };

  private readonly receivablesResource = resource({
    defaultValue: [] as ErpFinAccReceivable[],
    loader: async () => {
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      const q = this.search().trim();
      const status = this.statusFilter();
      if (q) params.set('q', q);
      if (status) params.set('status', status);

      const res = await this.api.get<{ data?: { items?: ErpFinAccReceivable[] } }>(
        `erp/financial/accounts/receivables?${params.toString()}`,
      );
      return res?.data?.items ?? [];
    },
  });

  readonly filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.receivablesResource.value().filter((row) => {
      if (status && row.Status !== status) return false;
      if (!q) return true;
      return [row.Description, row.DocNumber, this.customerLabel(row.CustomerUUID)]
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
    return (
      rows.length > 0 && rows.every((row) => this.selectedIds().has(row.ErpFinAccReceivableUUID))
    );
  });
  readonly someVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return (
      rows.some((row) => this.selectedIds().has(row.ErpFinAccReceivableUUID)) &&
      !this.allVisibleSelected()
    );
  });

  get loading() {
    return this.receivablesResource.isLoading();
  }

  constructor() {
    this.amountPrefix = this.getCurrencyAffixes().prefix;
    this.startCreate();
    void this.fetchCustomers();
    inject(DestroyRef).onDestroy(() => this.closeReceivableDialog());
  }

  refreshList() {
    this.receivablesResource.reload();
  }

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    this.pageIndex.set(0);
    this.clearSelection();
    this.receivablesResource.reload();
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set('');
    this.pageIndex.set(0);
    this.clearSelection();
    this.receivablesResource.reload();
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

  isSelected(row: ErpFinAccReceivable) {
    return this.selectedIds().has(row.ErpFinAccReceivableUUID);
  }

  toggleRow(row: ErpFinAccReceivable, checked: boolean) {
    const next = new Set(this.selectedIds());
    if (checked) next.add(row.ErpFinAccReceivableUUID);
    else next.delete(row.ErpFinAccReceivableUUID);
    this.selectedIds.set(next);
  }

  toggleVisibleRows(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.visibleRows()) {
      if (checked) next.add(row.ErpFinAccReceivableUUID);
      else next.delete(row.ErpFinAccReceivableUUID);
    }
    this.selectedIds.set(next);
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  async deleteManyReceivables() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected receivables',
        message: `Delete ${ids.length} selected receivable(s)?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingMany = true;
    try {
      const response = await this.api.delete('erp/financial/accounts/receivables/bulk', { ids });
      const result = this.parseBulkDeleteResult(response, ids);
      const failedIds = new Set<string>(
        result.failed.map(
          (item: { ErpFinAccReceivableUUID: string }) => item.ErpFinAccReceivableUUID,
        ),
      );
      this.selectedIds.set(failedIds);

      if (result.failed.length) {
        this.snack.warning(
          `${result.deleted.length} receivable(s) deleted. ${result.failed.length} failed.`,
        );
      } else {
        this.snack.success(`${result.deleted.length} receivable(s) deleted successfully.`);
      }
      this.receivablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected receivables.');
    } finally {
      this.deletingMany = false;
    }
  }

  async fetchCustomers() {
    try {
      const res = await this.api.get<any>('erp/customers?limit=500&offset=0');
      const items = res?.data?.items ?? [];
      this.customers = items.map((item: any) => ({
        value: item.CustomerUUID,
        label: item.Name,
        searchText: [item.Document, item.Email].filter(Boolean).join(' '),
      }));
      this.customerMap = new Map(this.customers.map((customer) => [customer.value, customer]));
    } catch (err) {
      console.error('Failed to load customers.', err);
    }
  }

  startCreate() {
    this.editingReceivable = null;
    this.form.customerUUID = '';
    this.form.description = '';
    this.form.docNumber = '';
    this.form.dueDate = null;
    this.form.amount = 0;
    this.form.status = 'open';
    this.form.notes = '';
  }

  openCreateDialog() {
    this.startCreate();
    this.openReceivableDialog();
  }

  openEditDialog(receivable: ErpFinAccReceivable) {
    this.editingReceivable = receivable;
    this.form.customerUUID = receivable.CustomerUUID ?? '';
    this.form.description = receivable.Description ?? '';
    this.form.docNumber = receivable.DocNumber ?? '';
    this.form.dueDate = this.parseDateInput(receivable.DueDate);
    this.form.amount = receivable.Amount ?? 0;
    this.form.status = receivable.Status ?? 'open';
    this.form.notes = receivable.Notes ?? '';
    this.openReceivableDialog();
  }

  async saveReceivable(closeAfterSave = true) {
    if (!this.form.description.trim()) {
      this.showWarning('Description is required.');
      return;
    }
    if (!this.form.customerUUID) {
      this.showWarning('Customer is required.');
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
    try {
      const payload = {
        customerUUID: this.form.customerUUID,
        description: this.form.description.trim(),
        docNumber: this.form.docNumber?.trim() || null,
        dueDate: this.formatDateInput(this.form.dueDate),
        amount: Number(this.form.amount),
        status: this.form.status,
        notes: this.form.notes?.trim() || null,
      };

      if (this.editingReceivable) {
        await this.api.put(
          `erp/financial/accounts/receivables/${this.editingReceivable.ErpFinAccReceivableUUID}`,
          payload,
        );
        this.snack.success('Receivable updated successfully.');
        this.closeReceivableDialog();
        this.startCreate();
      } else {
        await this.api.post('erp/financial/accounts/receivables', payload);
        this.snack.success('Receivable created successfully.');
        if (closeAfterSave) {
          this.closeReceivableDialog();
          this.startCreate();
        } else {
          this.startCreate();
        }
      }
      this.receivablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save receivable.');
    } finally {
      this.saving = false;
    }
  }

  async saveAndNewReceivable() {
    if (this.editingReceivable) return;
    await this.saveReceivable(false);
  }

  cancelReceivableForm() {
    this.closeReceivableDialog();
    this.startCreate();
  }

  async deleteReceivable(receivableUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete receivable',
        message: 'Are you sure you want to delete this receivable?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.delete(`erp/financial/accounts/receivables/${receivableUUID}`);
      this.snack.success('Receivable deleted successfully.');
      this.clearSelection();
      this.receivablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete receivable.');
    }
  }

  async issueBoletoFromReceivable(receivable: ErpFinAccReceivable) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Issue boleto',
        message: 'Issue a boleto from this receivable now?',
        confirmLabel: 'Issue boleto',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.issuingBoletoUUID = receivable.ErpFinAccReceivableUUID;
    try {
      await this.api.post(
        `erp/financial/accounts/receivables/${receivable.ErpFinAccReceivableUUID}/issue-boleto`,
        {},
      );
      this.snack.success('Boleto issued successfully.');
      this.receivablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to issue boleto from receivable.');
    } finally {
      this.issuingBoletoUUID = null;
    }
  }

  customerLabel(uuid: string) {
    return this.customerMap.get(uuid)?.label ?? '-';
  }

  formatAmount(value: number) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  statusLabel(status: ReceivableStatus) {
    return status.toUpperCase();
  }

  statusChipClass(status: ReceivableStatus) {
    const map: Record<ReceivableStatus, string> = {
      open: 'chip-queued',
      paid: 'chip-success',
      overdue: 'chip-failed',
      canceled: 'chip-skipped',
    };
    return map[status] ?? 'chip-queued';
  }

  isStatusInactive(status: ReceivableStatus) {
    return status === 'canceled';
  }

  private sortValue(row: ErpFinAccReceivable, key: string): string | number {
    switch (key) {
      case 'description':
        return row.Description ?? '';
      case 'customer':
        return this.customerLabel(row.CustomerUUID);
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
          ErpFinAccReceivableUUID: String(
            item?.ErpFinAccReceivableUUID ?? item?.uuid ?? item?.id ?? '',
          ),
          message: String(item?.message ?? 'Failed to delete receivable.'),
        }))
        .filter((item: { ErpFinAccReceivableUUID: string }) => item.ErpFinAccReceivableUUID),
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

  private openReceivableDialog() {
    const receivableFormDialog = this.receivableFormDialog();
    if (!receivableFormDialog || this.receivableFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      receivableFormDialog,
      'erp-receivable-form-dialog',
    );
    this.receivableFormDialogRef = this.dialogBinding.ref;
    bindDialogEscape(this.receivableFormDialogRef, () => this.cancelReceivableForm());
    bindDialogClosed(this.receivableFormDialogRef, () => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
      this.receivableFormDialogRef = null;
    });
  }

  private closeReceivableDialog() {
    if (!this.receivableFormDialogRef) return;
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.receivableFormDialogRef.close();
    this.receivableFormDialogRef = null;
  }

  private showError(message: string) {
    this.snack.error(message);
  }

  private showWarning(message: string) {
    this.snack.warning(message);
  }
}
