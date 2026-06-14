import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormField, form as createForm, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTableDataSource } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SystemParameterService } from '../../../services/system-parameter.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { DateMaskDirective } from '../../../shared/date-mask/date-mask.directive';
import { CurrencyMaskDirective } from '../../../shared/currency-mask/currency-mask.directive';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type SaleQuotation = {
  SqtUUID: string;
  CustomerCusUUID: string;
  SqtNumber?: string | null;
  SqtTitle: string;
  SqtDescription?: string | null;
  SqtCurrency: string;
  SqtSubtotal: number;
  SqtDiscount: number;
  SqtTotal: number;
  SqtStatus: string;
  SqtValidUntil?: string | null;
  SqtNotes?: string | null;
  SqtDateCreated?: string | null;
  SqtDateUpdated?: string | null;
};

type SaleQuotationItem = {
  SqiUUID: string;
  SaleQuotationSqtUUID: string;
  SaleProductSprUUID: string;
  SqiDescription?: string | null;
  SqiQuantity: number;
  SqiUnitPrice: number;
  SqiDiscount: number;
  SqiTotal: number;
  SqiDateCreated?: string | null;
  SqiDateUpdated?: string | null;
};

type OptionItem = {
  uuid: string;
  label: string;
  price?: number;
};

type QuotationFilters = {
  search: string;
  status: string;
  customerUUID: string;
};

type QuotationFormModel = {
  customerUUID: string;
  number: string;
  title: string;
  description: string;
  currency: string;
  status: string;
  validUntil: Date | null;
  notes: string;
};

type QuotationItemFormModel = {
  productUUID: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

const emptyQuotationFilters = (): QuotationFilters => ({
  search: '',
  status: '',
  customerUUID: '',
});

const emptyQuotationForm = (currency = 'BRL'): QuotationFormModel => ({
  customerUUID: '',
  number: '',
  title: '',
  description: '',
  currency,
  status: 'draft',
  validUntil: null,
  notes: '',
});

const emptyQuotationItemForm = (): QuotationItemFormModel => ({
  productUUID: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
});

@Component({
  selector: 'app-sale-quotation',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    DateMaskDirective,
    CurrencyMaskDirective,
    DecimalPipe,
  ],
  templateUrl: './quotation.html',
  styleUrls: ['./quotation.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleQuotationPage {
  private readonly api = inject(ApiService);
  private readonly parameters = inject(SystemParameterService);
  private readonly dialog = inject(MatDialog);

  amountPrefix = '';
  readonly saving = signal(false);
  readonly itemSaving = signal(false);
  readonly error = signal<string | null>(null);
  readonly quotations = signal<SaleQuotation[]>([]);
  readonly items = signal<SaleQuotationItem[]>([]);
  readonly editing = signal<SaleQuotation | null>(null);
  readonly editingItem = signal<SaleQuotationItem | null>(null);
  readonly defaultCurrency = signal('BRL');

  readonly customers = signal<OptionItem[]>([]);
  readonly products = signal<OptionItem[]>([]);
  readonly customerSearch = signal('');
  readonly filterCustomerSearch = signal('');
  readonly productSearch = signal('');
  readonly filterProductSearch = signal('');

  readonly filterFormModel = signal<QuotationFilters>(emptyQuotationFilters());
  readonly filterForm = createForm(this.filterFormModel);

  readonly quotationFormModel = signal<QuotationFormModel>(emptyQuotationForm());
  readonly quotationForm = createForm(this.quotationFormModel, (schema) => {
    required(schema.customerUUID);
    required(schema.title);
    required(schema.currency);
    required(schema.status);
  });

  readonly itemFormModel = signal<QuotationItemFormModel>(emptyQuotationItemForm());
  readonly itemForm = createForm(this.itemFormModel, (schema) => {
    required(schema.productUUID);
    required(schema.quantity);
    required(schema.unitPrice);
  });

  readonly displayedColumns = [
    'number',
    'title',
    'customer',
    'total',
    'status',
    'validUntil',
    'actions',
  ];
  readonly itemColumns = ['product', 'quantity', 'unitPrice', 'discount', 'total', 'actions'];
  readonly dataSource = new MatTableDataSource<SaleQuotation>([]);
  private readonly appliedFilters = signal<QuotationFilters>(emptyQuotationFilters());
  private readonly quotationsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as SaleQuotation[],
    loader: ({ params }) => this.fetchQuotations(params),
  });
  private readonly syncQuotations = effect(() => {
    const items = this.quotationsResource.value();
    this.quotations.set(items);
    this.dataSource.data = items;
    this.error.set(null);
  });
  private readonly reportQuotationsError = effect(() => {
    const error = this.quotationsResource.error();
    if (error) this.error.set(this.extractErrorMessage(error, 'Failed to load quotations.'));
  });
  readonly loading = this.quotationsResource.isLoading;
  readonly paginator = viewChild(MatPaginator);
  readonly quotationFormDialog = viewChild<TemplateRef<unknown>>('quotationFormDialog');
  private quotationFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  readonly itemTotals = computed(() => {
    const rows = this.items();
    const subtotal = rows.reduce(
      (sum, row) => sum + Number(row.SqiQuantity || 0) * Number(row.SqiUnitPrice || 0),
      0,
    );
    const discount = rows.reduce((sum, row) => sum + Number(row.SqiDiscount || 0), 0);
    const total = Math.max(0, subtotal - discount);
    return { subtotal, discount, total };
  });

  private readonly initializePage = (() => {
    this.amountPrefix = this.getCurrencyAffixes(this.defaultCurrency()).prefix;
    void this.fetchDefaultCurrency();
    this.fetchLookups();

    return true;
  })();

  private async fetchDefaultCurrency() {
    const currency = await this.parameters.resolveDefaultCurrency('BRL');
    this.defaultCurrency.set(currency);
    this.amountPrefix = this.getCurrencyAffixes(currency).prefix;
    if (!this.editing()) {
      const current = this.quotationFormModel().currency;
      if (!current || current === 'BRL' || current === 'USD') {
        this.quotationFormModel.update((value) => ({ ...value, currency }));
      }
    }
  }

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
  });

  async fetchLookups() {
    try {
      const [customersRes, productsRes] = await Promise.all([
        this.api.get<any>('erp/customers'),
        this.api.get<any>('sale/products?limit=200'),
      ]);

      this.customers.set(
        (customersRes?.data?.items ?? []).map((item: any) => ({
          uuid: item.CustomerUUID,
          label: item.Name,
        })),
      );

      this.products.set(
        (productsRes?.data?.items ?? []).map((item: any) => ({
          uuid: item.SprUUID,
          label: item.SprName || item.SprDescription,
          price: Number(item.SprPrice ?? 0),
        })),
      );
    } catch (err) {
      console.error('Failed to load lookups.', err);
    }
  }

  private async fetchQuotations(filters: QuotationFilters): Promise<SaleQuotation[]> {
    const params = new URLSearchParams();
    if (filters.search) params.set('q', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.customerUUID) params.set('customerUUID', filters.customerUUID);

    const query = params.toString();
    const response = await this.api.get<any>(`sale/quotations${query ? `?${query}` : ''}`);
    return Array.isArray(response?.data?.items) ? response.data.items : [];
  }

  applyFilters() {
    const nextFilters = this.currentQuotationFilters();
    if (this.sameQuotationFilters(nextFilters, this.appliedFilters())) {
      this.quotationsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  clearFilters() {
    this.filterFormModel.set(emptyQuotationFilters());
    const nextFilters = emptyQuotationFilters();
    if (this.sameQuotationFilters(nextFilters, this.appliedFilters())) {
      this.quotationsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  refreshList() {
    this.quotationsResource.reload();
  }

  openCreateDialog() {
    this.cancelEdit();
    this.openQuotationDialog();
  }

  async openEditDialog(quotation: SaleQuotation) {
    await this.startEdit(quotation);
    this.openQuotationDialog();
  }

  async startEdit(quotation: SaleQuotation) {
    this.editing.set(quotation);
    this.quotationFormModel.set({
      customerUUID: quotation.CustomerCusUUID,
      number: quotation.SqtNumber ?? '',
      title: quotation.SqtTitle ?? '',
      description: quotation.SqtDescription ?? '',
      currency: quotation.SqtCurrency ?? this.defaultCurrency(),
      status: quotation.SqtStatus ?? 'draft',
      validUntil: this.parseDateInput(quotation.SqtValidUntil),
      notes: quotation.SqtNotes ?? '',
    });
    this.items.set([]);
    this.editingItem.set(null);
    await this.fetchQuotationItems(quotation.SqtUUID);
  }

  cancelEdit() {
    this.editing.set(null);
    this.items.set([]);
    this.editingItem.set(null);
    this.quotationFormModel.set(emptyQuotationForm(this.defaultCurrency()));
    this.closeQuotationDialog();
  }

  get filteredCustomers() {
    const value = this.customerSearch().trim().toLowerCase();
    if (!value) return this.customers();
    return this.customers().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredFilterCustomers() {
    const value = this.filterCustomerSearch().trim().toLowerCase();
    if (!value) return this.customers();
    return this.customers().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredProducts() {
    const value = this.productSearch().trim().toLowerCase();
    if (!value) return this.products();
    return this.products().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredFilterProducts() {
    const value = this.filterProductSearch().trim().toLowerCase();
    if (!value) return this.products();
    return this.products().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  onCustomerOpened(opened: boolean) {
    if (opened) {
      this.customerSearch.set('');
    }
  }

  onFilterCustomerOpened(opened: boolean) {
    if (opened) {
      this.filterCustomerSearch.set('');
    }
  }

  onProductOpened(opened: boolean) {
    if (opened) {
      this.productSearch.set('');
    }
  }

  onFilterProductOpened(opened: boolean) {
    if (opened) {
      this.filterProductSearch.set('');
    }
  }

  async saveQuotation() {
    if (!this.quotationForm().valid()) return;

    const payload = this.quotationFormModel();
    const totals = this.itemTotals();
    const data = {
      customerUUID: payload.customerUUID,
      number: payload.number?.trim() || null,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      currency: (payload.currency?.trim() || this.defaultCurrency()).toUpperCase(),
      status: payload.status,
      validUntil: this.formatDateForApi(payload.validUntil),
      notes: payload.notes?.trim() || null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
    };

    if (!data.customerUUID || !data.title) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`sale/quotations/${editing.SqtUUID}`, data);
      } else {
        await this.api.post<any>('sale/quotations', data);
      }

      this.cancelEdit();
      this.quotationsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save quotation.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteQuotation(quotation: SaleQuotation) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete quotation',
        message: 'Are you sure you want to delete this quotation?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/quotations/${quotation.SqtUUID}`);
      this.quotationsResource.reload();
      if (this.editing()?.SqtUUID === quotation.SqtUUID) {
        this.cancelEdit();
      }
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete quotation.'));
    }
  }

  async fetchQuotationItems(quotationUUID: string) {
    try {
      const response = await this.api.get<any>(`sale/quotations/${quotationUUID}/items`);
      this.items.set(response?.data?.items ?? []);
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load quotation items.'));
    }
  }

  startItemEdit(item: SaleQuotationItem) {
    this.editingItem.set(item);
    this.itemFormModel.set({
      productUUID: item.SaleProductSprUUID,
      description: item.SqiDescription ?? '',
      quantity: item.SqiQuantity ?? 1,
      unitPrice: item.SqiUnitPrice ?? 0,
      discount: item.SqiDiscount ?? 0,
    });
  }

  cancelItemEdit() {
    this.editingItem.set(null);
    this.itemFormModel.set(emptyQuotationItemForm());
  }

  syncUnitPrice(productUUID: string) {
    if (!productUUID) return;
    const product = this.products().find((item) => item.uuid === productUUID);
    if (!product) return;
    const current = Number(this.itemFormModel().unitPrice ?? 0);
    if (!current || current <= 0) {
      this.itemFormModel.update((value) => ({ ...value, unitPrice: product.price ?? 0 }));
    }
  }

  async saveItem() {
    if (!this.itemForm().valid()) return;
    const quotation = this.editing();
    if (!quotation) return;

    const payload = this.itemFormModel();
    const data = {
      productUUID: payload.productUUID,
      description: payload.description?.trim() || null,
      quantity: Number(payload.quantity ?? 0),
      unitPrice: Number(payload.unitPrice ?? 0),
      discount: Number(payload.discount ?? 0),
    };

    if (!data.productUUID || data.quantity <= 0) return;

    this.itemSaving.set(true);
    this.error.set(null);

    try {
      const editingItem = this.editingItem();
      if (editingItem) {
        await this.api.put<any>(
          `sale/quotations/${quotation.SqtUUID}/items/${editingItem.SqiUUID}`,
          data,
        );
      } else {
        await this.api.post<any>(`sale/quotations/${quotation.SqtUUID}/items`, data);
      }

      this.cancelItemEdit();
      await this.fetchQuotationItems(quotation.SqtUUID);
      this.quotationsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save quotation item.'));
    } finally {
      this.itemSaving.set(false);
    }
  }

  async deleteItem(item: SaleQuotationItem) {
    const quotation = this.editing();
    if (!quotation) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete item',
        message: 'Are you sure you want to delete this item?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/quotations/${quotation.SqtUUID}/items/${item.SqiUUID}`);
      await this.fetchQuotationItems(quotation.SqtUUID);
      this.quotationsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete item.'));
    }
  }

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeQuotationDialog();
  });

  private openQuotationDialog() {
    const quotationFormDialog = this.quotationFormDialog();
    if (!quotationFormDialog || this.quotationFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      quotationFormDialog,
      'sale-quotation-form-dialog',
    );
    this.quotationFormDialogRef = this.dialogBinding.ref;
    this.quotationFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.quotationFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelEdit();
      });
  }

  private closeQuotationDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.quotationFormDialogRef?.close();
    this.quotationFormDialogRef = null;
  }

  customerLabel(uuid: string) {
    return this.customers().find((item) => item.uuid === uuid)?.label ?? '-';
  }

  productLabel(uuid: string) {
    return this.products().find((item) => item.uuid === uuid)?.label ?? '-';
  }

  statusLabel(status: string) {
    switch (status) {
      case 'sent':
        return 'Sent';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'canceled':
        return 'Canceled';
      default:
        return 'Draft';
    }
  }

  private parseDateInput(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private formatDateForApi(value: unknown) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const date = new Date(trimmed);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString().slice(0, 10);
    }
    return null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }

  private currentQuotationFilters(): QuotationFilters {
    const { search, status, customerUUID } = this.filterFormModel();
    return {
      search: search?.trim() ?? '',
      status: status ?? '',
      customerUUID: customerUUID ?? '',
    };
  }

  private sameQuotationFilters(left: QuotationFilters, right: QuotationFilters) {
    return (
      left.search === right.search &&
      left.status === right.status &&
      left.customerUUID === right.customerUUID
    );
  }

  private getCurrencyAffixes(currency?: string) {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    const resolvedCurrency = currency ?? this.getCurrencyFromLocale(locale);
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: resolvedCurrency,
    });
    const parts = formatter.formatToParts(1.1);
    const currencyPart = parts.find((part) => part.type === 'currency')?.value ?? resolvedCurrency;
    const integerIndex = parts.findIndex((part) => part.type === 'integer');
    const currencyIndex = parts.findIndex((part) => part.type === 'currency');
    let prefix = '';

    if (currencyIndex > -1 && integerIndex > -1 && currencyIndex < integerIndex) {
      const literal = parts[currencyIndex + 1];
      prefix = currencyPart + (literal?.type === 'literal' ? literal.value : ' ');
    } else if (currencyIndex > -1) {
      prefix = `${currencyPart} `;
    } else if (currencyPart) {
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
}
