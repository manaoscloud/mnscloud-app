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
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(TranslocoService);
  private readonly parameters = inject(SystemParameterService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly receivableFormDialog = viewChild<TemplateRef<unknown>>('receivableFormDialog');
  private formDialogBinding: CrudDialogBinding | null = null;

  readonly searchInput = signal('');
  readonly statusInput = signal<ReceivableStatus | ''>('');
  readonly search = signal('');
  readonly status = signal<ReceivableStatus | ''>('');
  readonly sortActive = signal('dueDate');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly editing = signal<Receivable | null>(null);
  readonly issuingBoletoUUID = signal<string | null>(null);

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

  form = this.emptyForm();

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
  readonly rows = computed(() => this.snapshotResource.value().items);
  readonly customerOptions = computed(() => this.snapshotResource.value().customers);
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
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

  private readonly cleanup = this.destroyRef.onDestroy(() => this.closeFormDialog());

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

  isSelected(row: Receivable) {
    return this.selectedIds().has(row.ErpFinAccReceivableUUID);
  }

  toggleRow(row: Receivable, checked: boolean) {
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

  startCreate() {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.openFormDialog();
  }

  startEdit(row: Receivable) {
    this.editing.set(row);
    this.form = {
      customerUUID: row.CustomerUUID,
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

  async saveReceivable(closeAfterSave = true) {
    const payload = this.buildPayload();
    if (!payload) return;

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
      if (closeAfterSave || editing) this.cancelForm();
      else this.form = this.emptyForm();
    } catch (error) {
      this.showError(error, 'Failed to save receivable.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNewReceivable() {
    if (this.editing()) return;
    await this.saveReceivable(false);
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
      this.snack.success(this.t('Receivable deleted successfully.'));
      this.clearSelection();
      this.snapshotResource.reload();
    }, 'Failed to delete receivable.');
  }

  async deleteSelectedReceivables() {
    const ids = [...this.selectedIds()];
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
      const failed = Array.isArray(response?.data?.failed) ? response.data.failed : [];
      this.selectedIds.set(
        new Set(failed.map((item: any) => String(item?.ErpFinAccReceivableUUID ?? item?.id ?? ''))),
      );
      this.snack.success(this.t('Receivables bulk delete completed.'));
      this.snapshotResource.reload();
    }, 'Failed to delete selected receivables.');
  }

  async issueBoleto(row: Receivable) {
    const confirmed = await this.confirm(
      'Issue boleto',
      'Issue a boleto from this receivable now?',
      'Issue boleto',
    );
    if (!confirmed) return;

    this.issuingBoletoUUID.set(row.ErpFinAccReceivableUUID);
    await this.runMutation(async () => {
      await this.api.post(
        `erp/financial/accounts/receivables/${row.ErpFinAccReceivableUUID}/issue-boleto`,
        {},
      );
      this.snack.success(this.t('Boleto issued successfully.'));
      this.snapshotResource.reload();
    }, 'Failed to issue boleto from receivable.');
    this.issuingBoletoUUID.set(null);
  }

  customerLabel(row: Receivable) {
    return this.clean(row.CustomerName) ?? row.CustomerUUID ?? '-';
  }

  statusLabel(status: ReceivableStatus) {
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

  isStatusInactive(status: ReceivableStatus) {
    return status === 'canceled';
  }

  customerChanged(value: string | number | boolean | null) {
    this.form.customerUUID = String(value ?? '').trim();
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
      return {
        value,
        label,
        description,
        searchText: `${label} ${description} ${value}`,
      };
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

  private sortRows(rows: Receivable[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const result = this.compare(this.sortValue(a, active), this.sortValue(b, active));
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: Receivable, column: string) {
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

  private buildPayload() {
    if (!this.form.customerUUID) {
      this.snack.warning(this.t('Customer is required.'));
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
      customerUUID: this.form.customerUUID,
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
      customerUUID: '',
      description: '',
      docNumber: '',
      dueDate: null as Date | null,
      amount: 0,
      status: 'open' as ReceivableStatus,
      notes: '',
    };
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
