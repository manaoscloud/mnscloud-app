import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  effect,
  inject,
  resource,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

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
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';

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

type CustomerOption = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-financial-receivables',
  standalone: true,
  imports: [
    FormsModule,
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
  templateUrl: './receivables.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./receivables.scss'],
})
export class FinancialReceivablesPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);

  private readonly receivablesResource = resource({
    defaultValue: [] as ErpFinAccReceivable[],
    loader: async () => {
      const res = await this.api.get<{ data?: { items?: ErpFinAccReceivable[] } }>(
        'erp/financial/accounts/receivables',
      );
      return res?.data?.items ?? [];
    },
  });

  receivables: ErpFinAccReceivable[] = [];
  dataSource = new MatTableDataSource<ErpFinAccReceivable>([]);
  displayedColumns: string[] = [
    'description',
    'customer',
    'docNumber',
    'dueDate',
    'amount',
    'status',
    'actions',
  ];
  saving = false;
  error = '';
  search = '';
  searchInput = '';
  editingReceivable: ErpFinAccReceivable | null = null;
  issuingBoletoUUID: string | null = null;

  customers: CustomerOption[] = [];
  customerMap = new Map<string, CustomerOption>();
  customerSearch = '';
  amountPrefix = '';

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly receivableFormDialog = viewChild<TemplateRef<unknown>>('receivableFormDialog');
  private receivableFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  statusOptions: { value: ReceivableStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];

  form = {
    customerUUID: '',
    description: '',
    docNumber: '',
    dueDate: null as Date | null,
    amount: 0,
    status: 'open' as ReceivableStatus,
    notes: '',
  };

  get loading() {
    return this.receivablesResource.isLoading();
  }

  private readonly syncReceivables = effect(() => {
    this.receivables = this.receivablesResource.value();
    this.dataSource.data = [...this.receivables];
    this.applyFilter();
  });

  private readonly reportReceivablesError = effect(() => {
    const error = this.receivablesResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load receivables.'));
      this.dataSource.data = [];
    }
  });

  ngOnInit() {
    this.amountPrefix = this.getCurrencyAffixes().prefix;
    this.startCreate();
    void this.loadCustomers();
  }

  ngOnDestroy() {
    this.closeReceivableDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'description':
          return data.Description ?? '';
        case 'customer':
          return this.customerLabel(data.CustomerUUID) ?? '';
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
      const customer = this.customerLabel(data.CustomerUUID);
      return [data.Description, data.DocNumber, customer]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

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
    this.receivablesResource.reload();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadCustomers() {
    try {
      const res = await this.api.get<any>('erp/customers');
      const items = res?.data?.items ?? [];
      this.customers = items.map((item: any) => ({
        value: item.CustomerUUID,
        label: item.Name,
      }));
      this.customerMap = new Map(this.customers.map((c) => [c.value, c]));
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

  startEdit(receivable: ErpFinAccReceivable) {
    this.editingReceivable = receivable;
    this.form.customerUUID = receivable.CustomerUUID ?? '';
    this.form.description = receivable.Description ?? '';
    this.form.docNumber = receivable.DocNumber ?? '';
    this.form.dueDate = this.parseDateInput(receivable.DueDate);
    this.form.amount = receivable.Amount ?? 0;
    this.form.status = receivable.Status ?? 'open';
    this.form.notes = receivable.Notes ?? '';
  }

  openEditDialog(receivable: ErpFinAccReceivable) {
    this.startEdit(receivable);
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
    this.error = '';

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
          this.resetCreateForm();
        }
      }
      this.receivablesResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save receivable.');
    } finally {
      this.saving = false;
    }
  }

  cancelReceivableForm() {
    this.closeReceivableDialog();
    this.startCreate();
  }

  async saveAndNewReceivable() {
    if (this.editingReceivable) return;
    await this.saveReceivable(false);
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
    this.error = '';
    try {
      await this.api.delete(`erp/financial/accounts/receivables/${receivableUUID}`);
      this.snack.success('Receivable deleted successfully.');
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

    this.error = '';
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

  get filteredCustomers() {
    const value = this.customerSearch.trim().toLowerCase();
    if (!value) return this.customers;
    return this.customers.filter((customer) =>
      (customer.label ?? '').toLowerCase().includes(value),
    );
  }

  onCustomerOpened(opened: boolean) {
    if (opened) {
      this.customerSearch = '';
    }
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

  isStatusInactive(status: ReceivableStatus) {
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

  private openReceivableDialog() {
    const receivableFormDialog = this.receivableFormDialog();
    if (!receivableFormDialog || this.receivableFormDialogRef) return;
    this.error = '';
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      receivableFormDialog,
      'erp-receivable-form-dialog',
    );
    this.receivableFormDialogRef = this.dialogBinding.ref;
    this.receivableFormDialogRef.keydownEvents().pipe(takeUntil(this.receivableFormDialogRef.afterClosed())).subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancelReceivableForm();
      }
    });
    this.receivableFormDialogRef.afterClosed().subscribe(() => {
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

  private resetCreateForm() {
    this.editingReceivable = null;
    this.form.customerUUID = '';
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
