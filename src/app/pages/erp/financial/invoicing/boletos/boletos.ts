import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  inject,
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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { DateMaskDirective } from '../../../../../shared/date-mask/date-mask.directive';
import { CurrencyMaskDirective } from '../../../../../shared/currency-mask/currency-mask.directive';
import { TranslocoPipe } from '@jsverse/transloco';

type BoletoStatus = 'open' | 'paid' | 'overdue' | 'canceled';

type ErpFinInvBoleto = {
  ErpFinInvBoletoUUID: string;
  CustomerUUID?: string | null;
  Title: string;
  Amount: number;
  Status: BoletoStatus;
  DueDate: string;
  Notes?: string | null;
};

type PaymentGatewayProvider = 'pagarme' | 'asaas' | 'stripe' | 'efi' | 'inter_business';
type PaymentGatewayAccount = {
  EfgUUID: string;
  EfgName: string;
  EfgProvider: PaymentGatewayProvider;
};
type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
};

@Component({
  selector: 'app-invoicing-boletos',
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
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatSlideToggleModule,
    DateMaskDirective,
    CurrencyMaskDirective,
  ],
  templateUrl: './boletos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./boletos.scss'],
})
export class InvoicingBoletosPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  boletos: ErpFinInvBoleto[] = [];
  dataSource = new MatTableDataSource<ErpFinInvBoleto>([]);
  displayedColumns: string[] = ['title', 'dueDate', 'amount', 'status', 'actions'];
  loading = false;
  saving = false;
  error = '';
  search = '';
  searchInput = '';
  editingBoleto: ErpFinInvBoleto | null = null;
  amountPrefix = '';

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly boletoFormDialog = viewChild<TemplateRef<unknown>>('boletoFormDialog');
  private boletoFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  statusOptions: { value: BoletoStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'canceled', label: 'Canceled' },
  ];

  form = {
    title: '',
    dueDate: null as Date | null,
    amount: 0,
    status: 'open' as BoletoStatus,
    notes: '',
    issueAtGateway: true,
    gatewayAccountUUID: '',
    customerUUID: '',
  };
  gatewayOptions: PaymentGatewayAccount[] = [];
  customerOptions: CustomerOption[] = [];

  ngOnInit() {
    this.amountPrefix = this.getCurrencyAffixes().prefix;
    this.startCreate();
    void this.loadGatewayOptions();
    void this.loadCustomerOptions();
    void this.loadBoletos();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeBoletoDialog();
  }

  private providerLabel(provider: PaymentGatewayProvider) {
    switch (provider) {
      case 'inter_business':
        return 'Inter Empresas';
      case 'pagarme':
        return 'Pagar.me';
      case 'asaas':
        return 'Asaas';
      case 'stripe':
        return 'Stripe';
      case 'efi':
        return 'Efi';
      default:
        return provider;
    }
  }

  gatewayOptionLabel(item: PaymentGatewayAccount) {
    return `${item.EfgName} (${this.providerLabel(item.EfgProvider)})`;
  }

  async loadGatewayOptions() {
    try {
      const rows = await this.api.get<PaymentGatewayAccount[]>('erp/financial/payment/gateways');
      this.gatewayOptions = Array.isArray(rows) ? rows : [];
    } catch {
      this.gatewayOptions = [];
    }
  }

  async loadCustomerOptions() {
    try {
      const res = await this.api.get<any>('erp/customers?status=1&limit=200');
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      this.customerOptions = items
        .map((row: any) => ({
          CustomerUUID: row?.CustomerUUID ?? row?.customerUUID ?? '',
          Name: row?.Name ?? row?.name ?? '',
          Document: row?.Document ?? row?.document ?? null,
        }))
        .filter((item: CustomerOption) => item.CustomerUUID && item.Name);
    } catch {
      this.customerOptions = [];
    }
  }

  customerOptionLabel(item: CustomerOption) {
    const document =
      typeof item.Document === 'string' && item.Document.trim() ? ` • ${item.Document}` : '';
    return `${item.Name}${document}`;
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'title':
          return data.Title ?? '';
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
      return [data.Title, data.Status, data.Notes]
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
    void this.loadBoletos();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadBoletos() {
    this.loading = true;
    this.error = '';
    const start = performance.now();
    try {
      const res = await this.api.get<any>('erp/financial/invoicing/boletos');
      this.boletos = res?.data?.items ?? [];
      this.dataSource.data = [...this.boletos];
      this.applySearchFilters();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to load boletos.');
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
    this.editingBoleto = null;
    this.form.title = '';
    this.form.dueDate = null;
    this.form.amount = 0;
    this.form.status = 'open';
    this.form.notes = '';
    this.form.issueAtGateway = true;
    this.form.gatewayAccountUUID = '';
    this.form.customerUUID = '';
  }

  openCreateDialog() {
    this.startCreate();
    this.openBoletoDialog();
  }

  startEdit(boleto: ErpFinInvBoleto) {
    this.editingBoleto = boleto;
    this.form.title = boleto.Title ?? '';
    this.form.dueDate = this.parseDateInput(boleto.DueDate);
    this.form.amount = boleto.Amount ?? 0;
    this.form.status = boleto.Status ?? 'open';
    this.form.notes = boleto.Notes ?? '';
    this.form.issueAtGateway = true;
    this.form.customerUUID = boleto.CustomerUUID ?? '';
  }

  openEditDialog(boleto: ErpFinInvBoleto) {
    this.startEdit(boleto);
    this.openBoletoDialog();
  }

  async saveBoleto(keepOpenForNew = false) {
    if (!this.form.title.trim()) {
      this.showWarning('Title is required.');
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
      const issueAtGateway = !this.editingBoleto ? Boolean(this.form.issueAtGateway) : true;
      const payload = {
        title: this.form.title.trim(),
        dueDate: this.formatDateInput(this.form.dueDate),
        amount: Number(this.form.amount),
        status: this.form.status,
        notes: this.form.notes?.trim() || null,
        customerUUID: this.form.customerUUID || null,
        gatewayAccountUUID: issueAtGateway ? this.form.gatewayAccountUUID || null : null,
        issueAtGateway,
        gatewayPayload: null,
      };

      if (this.editingBoleto) {
        await this.api.put(
          `erp/financial/invoicing/boletos/${this.editingBoleto.ErpFinInvBoletoUUID}`,
          payload,
        );
        this.snack.success('Boleto updated successfully.');
      } else {
        const response = await this.api.post<any>('erp/financial/invoicing/boletos', payload);
        this.snack.success(this.buildCreateSuccessMessage(response, issueAtGateway));
      }

      if (!this.editingBoleto && keepOpenForNew) {
        this.startCreate();
        this.cdr.detectChanges();
      } else {
        this.closeBoletoDialog();
        this.startCreate();
        this.cdr.detectChanges();
      }
      await this.loadBoletos();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save boleto.');
    } finally {
      this.saving = false;
    }
  }

  private buildCreateSuccessMessage(response: any, issueAtGateway: boolean) {
    const message = typeof response?.message === 'string' ? response.message.trim() : '';
    if (!issueAtGateway) {
      return message || 'Boleto created successfully.';
    }

    const sourceRaw = response?.data?.gatewaySource;
    const source = typeof sourceRaw === 'string' ? sourceRaw.trim() : '';
    const sourceLabel = this.gatewaySourceLabel(source);
    if (sourceLabel) {
      return `${message || 'Boleto created successfully.'} Gateway source: ${sourceLabel}.`;
    }

    return message || 'Boleto created successfully.';
  }

  private gatewaySourceLabel(source: string) {
    switch (source) {
      case 'preferred':
        return 'selected gateway';
      case 'tenant_default':
        return 'tenant default gateway';
      case 'master_default':
        return 'master default gateway';
      default:
        return '';
    }
  }

  saveAndNewBoleto() {
    if (this.editingBoleto) return;
    void this.saveBoleto(true);
  }

  cancelBoletoForm() {
    this.closeBoletoDialog();
    this.startCreate();
  }

  async deleteBoleto(boletoUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete boleto',
        message: 'Are you sure you want to delete this boleto?',
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
      await this.api.delete(`erp/financial/invoicing/boletos/${boletoUUID}`);
      this.snack.success('Boleto deleted successfully.');
      await this.loadBoletos();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete boleto.');
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

  private openBoletoDialog() {
    const boletoFormDialog = this.boletoFormDialog();
    if (!boletoFormDialog || this.boletoFormDialogRef) return;
    this.error = '';
    this.boletoFormDialogRef = this.dialog.open(boletoFormDialog, {
      ...this.getBoletoDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-boleto-form-dialog',
    });
    this.boletoFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancelBoletoForm();
      }
    });
    this.startDialogViewportObserver();
    this.boletoFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.boletoFormDialogRef = null;
    });
  }

  private closeBoletoDialog() {
    if (!this.boletoFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.boletoFormDialogRef.close();
    this.boletoFormDialogRef = null;
  }

  private getBoletoDialogViewportConfig() {
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
    if (!this.boletoFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateBoletoDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateBoletoDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateBoletoDialogViewport() {
    if (!this.boletoFormDialogRef) return;
    const config = this.getBoletoDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.boletoFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.boletoFormDialogRef.updatePosition(config.position);
    } else {
      this.boletoFormDialogRef.updatePosition();
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
