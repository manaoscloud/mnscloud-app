import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormField, email, form as createForm, min, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { SnackbarService } from '../../../services/snackbar.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { CurrencyMaskDirective } from '../../../shared/currency-mask/currency-mask.directive';
import {
  BillingCatalogItem,
  BillingLedgerEntry,
  BillingPaymentIntent,
  BillingService,
  BillingSubscription,
  BillingWallet,
} from '../shared/billing.service';

export type BillingTenantSection = 'dashboard' | 'catalog' | 'subscriptions' | 'ledger';

type BillingWalletSnapshot = {
  wallets: BillingWallet[];
  catalog: BillingCatalogItem[];
  subscriptions: BillingSubscription[];
  ledger: BillingLedgerEntry[];
  topups: BillingPaymentIntent[];
};

export const BILLING_WALLET_IMPORTS = [
  DatePipe,
  FormField,
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
  RefreshButtonComponent,
  TranslocoPipe,
  CurrencyMaskDirective,
];

@Component({
  selector: 'app-billing-wallet',
  standalone: true,
  imports: BILLING_WALLET_IMPORTS,
  templateUrl: './wallet.html',
  styleUrls: ['./wallet.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingWalletPage {
  private readonly billing = inject(BillingService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly i18n = inject(AppI18nService);
  private readonly destroyRef = inject(DestroyRef);

  section: BillingTenantSection = 'dashboard';

  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly wallets = signal<BillingWallet[]>([]);
  readonly topups = signal<BillingPaymentIntent[]>([]);
  readonly selectedCatalogItem = signal<BillingCatalogItem | null>(null);

  readonly catalogSource = new MatTableDataSource<BillingCatalogItem>([]);
  readonly subscriptionSource = new MatTableDataSource<BillingSubscription>([]);
  readonly ledgerSource = new MatTableDataSource<BillingLedgerEntry>([]);
  private readonly walletResource = resource({
    defaultValue: {
      wallets: [],
      catalog: [],
      subscriptions: [],
      ledger: [],
      topups: [],
    } as BillingWalletSnapshot,
    loader: () => this.fetchWalletSnapshot(),
  });
  readonly loading = computed(() => this.walletResource.isLoading() || this.mutating());

  readonly catalogColumns = ['product', 'mode', 'price', 'setup', 'actions'];
  readonly subscriptionColumns = [
    'select',
    'product',
    'resource',
    'quantity',
    'status',
    'price',
    'reserved',
    'actions',
  ];
  readonly ledgerColumns = ['date', 'type', 'direction', 'amount', 'balance', 'reason'];

  searchInput = '';
  ledgerSearchInput = '';
  statusFilter = '';
  readonly selectedSubscriptionUUIDs = new Set<string>();

  readonly subscriptionFormModel = signal({
    priceUUID: '',
    quantity: 1,
    promotionCode: '',
  });
  readonly subscriptionForm = createForm(this.subscriptionFormModel, (schema) => {
    required(schema.priceUUID);
    required(schema.quantity);
    min(schema.quantity, 0.000001);
  });

  readonly topupFormModel = signal({
    amount: 0,
    reference: '',
    payerName: '',
    payerDocument: '',
    payerEmail: '',
    payerType: 'FISICA',
    dueDate: '',
    idempotencyKey: '',
  });
  readonly topupForm = createForm(this.topupFormModel, (schema) => {
    required(schema.amount);
    min(schema.amount, 0.000001);
    required(schema.payerName);
    required(schema.payerDocument);
    required(schema.payerEmail);
    email(schema.payerEmail);
  });

  readonly subscriptionDialog = viewChild<TemplateRef<unknown>>('subscriptionDialog');
  readonly topupDialog = viewChild<TemplateRef<unknown>>('topupDialog');
  readonly catalogPaginator = viewChild<MatPaginator>('catalogPaginator');
  readonly subscriptionPaginator = viewChild<MatPaginator>('subscriptionPaginator');
  readonly ledgerPaginator = viewChild<MatPaginator>('ledgerPaginator');
  readonly catalogSort = viewChild<MatSort>('catalogSort');
  readonly subscriptionSort = viewChild<MatSort>('subscriptionSort');
  readonly ledgerSort = viewChild<MatSort>('ledgerSort');
  private subscriptionDialogRef: MatDialogRef<unknown> | null = null;
  private subscriptionDialogBinding: CrudDialogBinding | null = null;
  private readonly walletEffect = effect(() => {
    const snapshot = this.walletResource.value();
    this.wallets.set(snapshot.wallets);
    this.topups.set(snapshot.topups);
    this.catalogSource.data = snapshot.catalog;
    this.subscriptionSource.data = snapshot.subscriptions;
    this.ledgerSource.data = snapshot.ledger;
    this.reconcileSelection();
  });
  private readonly walletErrorEffect = effect(() => {
    const error = this.walletResource.error();
    if (!error) return;
    this.error.set(
      error instanceof Error ? error.message : this.i18n.t('Failed to load billing data.'),
    );
  });

  private readonly setupTables = afterNextRender(() => {
    this.catalogSource.paginator = this.catalogPaginator() ?? null;
    this.subscriptionSource.paginator = this.subscriptionPaginator() ?? null;
    this.ledgerSource.paginator = this.ledgerPaginator() ?? null;
    this.catalogSource.sort = this.catalogSort() ?? null;
    this.subscriptionSource.sort = this.subscriptionSort() ?? null;
    this.ledgerSource.sort = this.ledgerSort() ?? null;
    this.catalogSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.subscriptionSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.ledgerSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.refresh();
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeSubscriptionDialog());
  }

  refresh() {
    this.error.set(null);
    this.walletResource.reload();
  }

  applyFilters() {
    void this.refresh();
  }

  clearFilters() {
    this.searchInput = '';
    this.ledgerSearchInput = '';
    this.statusFilter = '';
    void this.refresh();
  }

  isSection(section: BillingTenantSection) {
    return this.section === section;
  }

  get activeSubscriptionCount() {
    return this.subscriptionSource.data.filter((row) => row.BsuStatus === 'ACTIVE').length;
  }

  get availableCatalogCount() {
    return this.catalogSource.data.length;
  }

  get ledgerEntryCount() {
    return this.ledgerSource.data.length;
  }

  get pendingTopupCount() {
    return this.topups().filter((row) => row.BpiStatus === 'PENDING').length;
  }

  openTopupDialog() {
    this.topupFormModel.set({
      amount: 0,
      reference: '',
      payerName: '',
      payerDocument: '',
      payerEmail: '',
      payerType: 'FISICA',
      dueDate: '',
      idempotencyKey: crypto.randomUUID(),
    });
    const topupDialog = this.topupDialog();
    if (!topupDialog) return;
    this.closeSubscriptionDialog();
    this.subscriptionDialogBinding = openCrudTemplateDialog(
      this.dialog,
      topupDialog,
      'crud-dialog-panel',
      { onEscape: () => this.closeSubscriptionDialog() },
    );
    this.subscriptionDialogRef = this.subscriptionDialogBinding.ref;
    if (window.innerWidth > 900) this.subscriptionDialogRef.updateSize('640px', 'min(92vh, 620px)');
    this.subscriptionDialogRef.afterClosed().subscribe(() => {
      this.subscriptionDialogBinding?.stop();
      this.subscriptionDialogBinding = null;
      this.subscriptionDialogRef = null;
      this.saving.set(false);
    });
  }

  async saveTopupIntent() {
    if (!this.topupForm().valid() || this.saving()) return;
    this.saving.set(true);
    const value = this.topupFormModel();
    try {
      await this.billing.createTopup({
        amount: Number(value.amount),
        currency: null,
        reference: this.emptyToNull(value.reference),
        dueDate: this.emptyToNull(value.dueDate),
        payer: {
          nome: value.payerName,
          cpfCnpj: value.payerDocument.replace(/\D/g, ''),
          email: value.payerEmail,
          tipoPessoa: value.payerType,
        },
        idempotencyKey: this.emptyToNull(value.idempotencyKey),
      });
      this.snack.success(
        this.i18n.t('Top-up request created. Credit will be applied after payment confirmation.'),
      );
      this.closeSubscriptionDialog();
      this.refresh();
    } catch (error) {
      this.snack.error(
        this.extractErrorMessage(error, this.i18n.t('Failed to create top-up request.')),
      );
    } finally {
      this.saving.set(false);
    }
  }

  openSubscribeDialog(row: BillingCatalogItem) {
    this.selectedCatalogItem.set(row);
    this.subscriptionFormModel.set({
      priceUUID: row.BpcUUID,
      quantity: 1,
      promotionCode: row.PromotionCode ?? '',
    });
    const subscriptionDialog = this.subscriptionDialog();
    if (!subscriptionDialog) return;
    this.closeSubscriptionDialog();
    this.subscriptionDialogBinding = openCrudTemplateDialog(
      this.dialog,
      subscriptionDialog,
      'crud-dialog-panel',
      { onEscape: () => this.closeSubscriptionDialog() },
    );
    this.subscriptionDialogRef = this.subscriptionDialogBinding.ref;
    if (window.innerWidth > 900) this.subscriptionDialogRef.updateSize('720px', 'min(92vh, 760px)');
    this.subscriptionDialogRef.afterClosed().subscribe(() => {
      this.subscriptionDialogBinding?.stop();
      this.subscriptionDialogBinding = null;
      this.subscriptionDialogRef = null;
      this.saving.set(false);
    });
  }

  async saveSubscription(keepOpen = false) {
    if (!this.subscriptionForm().valid() || this.saving()) return;
    const showQuantity = this.shouldShowSubscriptionQuantity();
    const values = this.subscriptionFormModel();
    const payload: Record<string, unknown> = {
      priceUUID: values.priceUUID,
      quantity: showQuantity ? values.quantity : 1,
      promotionCode: this.emptyToNull(values.promotionCode),
    };
    this.saving.set(true);
    try {
      await this.billing.createSubscription(payload);
      this.snack.success(this.i18n.t('Subscription created.'));
      if (!keepOpen) this.closeSubscriptionDialog();
      this.refresh();
      if (keepOpen) this.resetSubscriptionForm();
    } catch (error) {
      this.snack.error(
        this.extractErrorMessage(error, this.i18n.t('Failed to create subscription.')),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNewSubscription() {
    await this.saveSubscription(true);
  }

  async cancelSubscription(row: BillingSubscription) {
    if (
      !(await this.confirm(
        'Cancel subscription',
        this.i18n.t('Cancel subscription confirmation', {
          name: row.BprName ?? row.BprCode ?? this.i18n.t('this subscription'),
        }),
        'Cancel subscription',
      ))
    )
      return;
    try {
      await this.billing.cancelSubscription(row.BsuUUID);
      this.selectedSubscriptionUUIDs.delete(row.BsuUUID);
      this.snack.success(this.i18n.t('Subscription canceled.'));
      this.refresh();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to cancel subscription.'),
      );
    }
  }

  formatMoney(value: unknown, currency = '') {
    const amount = Number(value ?? 0);
    return `${currency ? `${currency} ` : ''}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  }

  statusLabel(value: unknown) {
    const code = String(value ?? '')
      .trim()
      .toUpperCase();
    const labels: Record<string, string> = {
      ACTIVE: 'Active',
      PENDING_CANCEL: 'Pending cancellation',
      SUSPENDED: 'Suspended',
      CANCELED: 'Canceled',
      PENDING: 'Pending',
      PENDING_PAYMENT: 'Pending payment',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      EXPIRED: 'Expired',
      ONE_TIME: 'One time',
      MONTHLY: 'Monthly',
      HOURLY: 'Hourly',
      MINUTELY: 'Minutely',
      SECONDLY: 'Secondly',
      USAGE_UNIT: 'Usage unit',
      GB_HOUR: 'GB hour',
      GB_MONTH: 'GB month',
      MODULE_MONTHLY: 'Module monthly',
      TIERED_USAGE: 'Tiered usage',
      CREDIT: 'Credit',
      DEBIT: 'Debit',
      CREDIT_MANUAL: 'Manual credit',
      CREDIT_TOPUP: 'Top-up credit',
      CREDIT_REFUND: 'Refund credit',
      DEBIT_SUBSCRIPTION: 'Subscription debit',
      IN: 'Incoming',
      OUT: 'Outgoing',
    };
    return this.i18n.t(labels[code] ?? String(value ?? '').replace(/_/g, ' '));
  }

  billingScopeLabel(row: BillingCatalogItem | null = this.selectedCatalogItem()) {
    return String(row?.BprBillingScope ?? '').toUpperCase();
  }

  isModuleCatalogItem(row: BillingCatalogItem | null = this.selectedCatalogItem()) {
    return this.billingScopeLabel(row) === 'MODULE';
  }

  shouldShowSubscriptionQuantity() {
    return !this.isModuleCatalogItem();
  }

  isCatalogItemAlreadySubscribed(row: BillingCatalogItem) {
    if (!this.isModuleCatalogItem(row)) return false;
    return this.subscriptionSource.data.some(
      (subscription) =>
        subscription.BsuStatus === 'ACTIVE' &&
        (subscription.BprCode === row.BprCode || subscription.BpcName === row.BpcName),
    );
  }

  closeDialog() {
    this.closeSubscriptionDialog();
  }

  get selectedSubscriptionCount() {
    return this.selectedSubscriptionUUIDs.size;
  }

  visibleSubscriptionRows() {
    return this.visibleRows(this.subscriptionSource).filter(
      (row) => !this.isSubscriptionCanceled(row),
    );
  }

  isSubscriptionSelected(row: BillingSubscription) {
    return this.selectedSubscriptionUUIDs.has(row.BsuUUID);
  }

  isSubscriptionCanceled(row: BillingSubscription) {
    return ['CANCELED', 'PENDING_CANCEL'].includes(String(row.BsuStatus ?? '').toUpperCase());
  }

  topupCurrency() {
    return this.wallets()[0]?.BwaCurrency ?? null;
  }

  isAllVisibleSubscriptionsSelected() {
    const rows = this.visibleSubscriptionRows();
    return rows.length > 0 && rows.every((row) => this.isSubscriptionSelected(row));
  }

  isSomeVisibleSubscriptionsSelected() {
    const rows = this.visibleSubscriptionRows();
    return (
      rows.some((row) => this.isSubscriptionSelected(row)) &&
      !this.isAllVisibleSubscriptionsSelected()
    );
  }

  toggleSubscriptionSelection(row: BillingSubscription, checked: boolean) {
    if (checked) this.selectedSubscriptionUUIDs.add(row.BsuUUID);
    else this.selectedSubscriptionUUIDs.delete(row.BsuUUID);
  }

  toggleVisibleSubscriptions(checked: boolean) {
    this.visibleSubscriptionRows().forEach((row) => this.toggleSubscriptionSelection(row, checked));
  }

  subscriptionSelectLabel(row: BillingSubscription) {
    return this.i18n.t('Select subscription', {
      name: row.BprName || row.BprCode || this.i18n.t('subscription'),
    });
  }

  async cancelSelectedSubscriptions() {
    const ids = Array.from(this.selectedSubscriptionUUIDs);
    if (!ids.length) return;
    if (
      !(await this.confirm(
        'Cancel selected subscriptions',
        this.i18n.t('Cancel selected subscriptions confirmation', { count: ids.length }),
        'Cancel selected',
      ))
    )
      return;

    this.mutating.set(true);
    const failed = new Set<string>();
    try {
      for (const uuid of ids) {
        try {
          await this.billing.cancelSubscription(uuid);
          this.selectedSubscriptionUUIDs.delete(uuid);
        } catch {
          failed.add(uuid);
        }
      }
      this.refresh();
      if (failed.size) {
        failed.forEach((uuid) => this.selectedSubscriptionUUIDs.add(uuid));
        this.snack.error(
          this.i18n.t('Selected subscriptions could not be canceled.', { count: failed.size }),
        );
      } else {
        this.snack.success(this.i18n.t('Subscriptions canceled.', { count: ids.length }));
      }
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchWalletSnapshot(): Promise<BillingWalletSnapshot> {
    this.error.set(null);
    const [wallets, catalog, subscriptions, ledger, topups] = await Promise.all([
      this.billing.listWallets(),
      this.billing.listCatalog(this.searchInput),
      this.billing.listSubscriptions(this.searchInput, this.statusFilter),
      this.billing.listLedger(this.ledgerSearchInput),
      this.billing.listTopups('PENDING'),
    ]);
    return { wallets, catalog, subscriptions, ledger, topups };
  }

  private sortValue(row: any, column: string) {
    const mapped: Record<string, unknown> = {
      product: row?.BprName ?? row?.BprCode,
      resource: row?.BsuResourceLabel ?? row?.BsuResourceType,
      quantity: row?.BsuQuantity,
      price: row?.BsuUnitPriceSnapshot,
      reserved: row?.BsuReservedAmountSnapshot,
      date: row?.BleDateCreated,
      amount: row?.BleAmount,
      balance: row?.BleBalanceAfter,
    };
    return String(
      mapped[column] ?? row?.[column] ?? row?.BprName ?? row?.BleDateCreated ?? '',
    ).toLowerCase();
  }

  private emptyToNull(value: unknown) {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private async confirm(title: string, message: string, confirmText: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.i18n.t(title),
        message,
        confirmText: this.i18n.t(confirmText),
        confirmLabel: this.i18n.t(confirmText),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private closeSubscriptionDialog() {
    this.subscriptionDialogBinding?.stop();
    this.subscriptionDialogRef?.close();
    this.subscriptionDialogBinding = null;
    this.subscriptionDialogRef = null;
  }

  private resetSubscriptionForm() {
    const item = this.selectedCatalogItem();
    this.subscriptionFormModel.set({
      priceUUID: item?.BpcUUID ?? '',
      quantity: 1,
      promotionCode: item?.PromotionCode ?? '',
    });
  }

  private visibleRows<T>(source: MatTableDataSource<T>) {
    const filtered = source.filter ? source.filteredData : source.data;
    const paginator = source.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  private reconcileSelection() {
    const valid = new Set(
      this.subscriptionSource.data
        .filter((row) => row.BsuStatus !== 'CANCELED')
        .map((row) => row.BsuUUID),
    );
    Array.from(this.selectedSubscriptionUUIDs).forEach((uuid) => {
      if (!valid.has(uuid)) this.selectedSubscriptionUUIDs.delete(uuid);
    });
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.error || error.error?.message;
      if (typeof message === 'string' && message.trim()) return this.i18n.t(message.trim());
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
