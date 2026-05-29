import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { DateMaskDirective } from '../../../../../shared/date-mask/date-mask.directive';
import { CurrencyMaskDirective } from '../../../../../shared/currency-mask/currency-mask.directive';
import { TranslatePipe } from '../../../../../shared/i18n/translate.pipe';

type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'canceled';

type ErpFinInvInvoice = {
  ErpFinInvInvoiceUUID: string;
  Number: string;
  Amount: number;
  Status: InvoiceStatus;
  IssueDate: string;
  Notes?: string | null;
};

@Component({
  selector: 'app-invoicing-invoices',
  standalone: true,
  imports: [
    CommonModule,
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
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslatePipe,
    DateMaskDirective,
    CurrencyMaskDirective,
  ],
  templateUrl: './invoices.html',
  styleUrls: ['./invoices.scss'],
})
export class InvoicingInvoicesPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  invoices: ErpFinInvInvoice[] = [];
  dataSource = new MatTableDataSource<ErpFinInvInvoice>([]);
  displayedColumns: string[] = ['number', 'issueDate', 'amount', 'status', 'actions'];
  loading = false;
  saving = false;
  error = '';
  search = '';
  searchInput = '';
  editingInvoice: ErpFinInvInvoice | null = null;
  amountPrefix = '';

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('invoiceFormDialog') invoiceFormDialog?: TemplateRef<unknown>;
  private invoiceFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  statusOptions: { value: InvoiceStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'issued', label: 'Issued' },
    { value: 'paid', label: 'Paid' },
    { value: 'canceled', label: 'Canceled' },
  ];

  form = {
    number: '',
    issueDate: null as Date | null,
    amount: 0,
    status: 'draft' as InvoiceStatus,
    notes: '',
  };

  ngOnInit() {
    this.amountPrefix = this.getCurrencyAffixes().prefix;
    this.startCreate();
    void this.loadInvoices();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeInvoiceDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'number':
          return data.Number ?? '';
        case 'issueDate':
          return data.IssueDate ?? '';
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
      return [data.Number, data.Status, data.Notes]
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
    void this.loadInvoices();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadInvoices() {
    this.loading = true;
    this.error = '';
    const start = performance.now();
    try {
      const res = await this.api.get<any>('erp/financial/invoicing/invoices');
      this.invoices = res?.data?.items ?? [];
      this.dataSource.data = [...this.invoices];
      this.applySearchFilters();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to load invoices.');
      this.dataSource.data = [];
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, waitMs);
      } else {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  startCreate() {
    this.editingInvoice = null;
    this.form.number = '';
    this.form.issueDate = null;
    this.form.amount = 0;
    this.form.status = 'draft';
    this.form.notes = '';
  }

  openCreateDialog() {
    this.startCreate();
    this.openInvoiceDialog();
  }

  startEdit(invoice: ErpFinInvInvoice) {
    this.editingInvoice = invoice;
    this.form.number = invoice.Number ?? '';
    this.form.issueDate = this.parseDateInput(invoice.IssueDate);
    this.form.amount = invoice.Amount ?? 0;
    this.form.status = invoice.Status ?? 'draft';
    this.form.notes = invoice.Notes ?? '';
  }

  openEditDialog(invoice: ErpFinInvInvoice) {
    this.startEdit(invoice);
    this.openInvoiceDialog();
  }

  async saveInvoice() {
    if (!this.form.number.trim()) {
      this.showWarning('Number is required.');
      return;
    }

    if (!this.form.issueDate) {
      this.showWarning('Issue date is required.');
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
        number: this.form.number.trim(),
        issueDate: this.formatDateInput(this.form.issueDate),
        amount: Number(this.form.amount),
        status: this.form.status,
        notes: this.form.notes?.trim() || null,
      };

      if (this.editingInvoice) {
        await this.api.put(
          `erp/financial/invoicing/invoices/${this.editingInvoice.ErpFinInvInvoiceUUID}`,
          payload,
        );
        this.snack.success('Invoice updated successfully.');
      } else {
        await this.api.post('erp/financial/invoicing/invoices', payload);
        this.snack.success('Invoice created successfully.');
      }

      this.closeInvoiceDialog();
      this.startCreate();
      this.cdr.detectChanges();
      await this.loadInvoices();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save invoice.');
    } finally {
      this.saving = false;
    }
  }

  cancelInvoiceForm() {
    this.closeInvoiceDialog();
    this.startCreate();
  }

  async deleteInvoice(invoiceUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete invoice',
        message: 'Are you sure you want to delete this invoice?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.loading = true;
    this.error = '';
    try {
      await this.api.delete(`erp/financial/invoicing/invoices/${invoiceUUID}`);
      this.snack.success('Invoice deleted successfully.');
      await this.loadInvoices();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete invoice.');
    } finally {
      this.loading = false;
    }
  }

  formatAmount(value: number) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  statusClass(status?: string) {
    return status ? `is-${status}` : '';
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

  private openInvoiceDialog() {
    if (!this.invoiceFormDialog || this.invoiceFormDialogRef) return;
    this.error = '';
    this.invoiceFormDialogRef = this.dialog.open(this.invoiceFormDialog, {
      ...this.getInvoiceDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-invoice-form-dialog',
    });
    this.invoiceFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancelInvoiceForm();
      }
    });
    this.startDialogViewportObserver();
    this.invoiceFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.invoiceFormDialogRef = null;
    });
  }

  private closeInvoiceDialog() {
    if (!this.invoiceFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.invoiceFormDialogRef.close();
    this.invoiceFormDialogRef = null;
  }

  private getInvoiceDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: '100vw',
        maxWidth: '100vw',
        maxHeight: '100dvh',
      };
    }

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) {
      return {
        width: 'min(1280px, calc(100vw - 1.5rem))',
        maxWidth: '99vw',
        maxHeight: '95vh',
      };
    }

    const rect = pageContent.getBoundingClientRect();
    const spacing = 8;
    const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
    const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));
    const leftPx = Math.max(0, Math.floor(rect.left + spacing));
    const topPx = Math.max(0, Math.floor(rect.top + spacing));

    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${leftPx}px`,
        top: `${topPx}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.invoiceFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateInvoiceDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateInvoiceDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateInvoiceDialogViewport() {
    if (!this.invoiceFormDialogRef) return;
    const config = this.getInvoiceDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.invoiceFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.invoiceFormDialogRef.updatePosition(config.position);
    } else {
      this.invoiceFormDialogRef.updatePosition();
    }
  }
  private showError(message: string) {
    this.error = '';
    this.snack.error(message);
  }

  private showWarning(message: string) {
    this.error = '';
    this.snack.warning(message);
  }
}
