import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { fadeIn } from '../../../shared/animations/fade.animation';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { SnackbarService } from '../../../services/snackbar.service';
import {
  BillingCatalogItem,
  BillingLedgerEntry,
  BillingPaymentIntent,
  BillingService,
  BillingSubscription,
  BillingWallet,
} from '../shared/billing.service';

export type BillingTenantSection = 'dashboard' | 'catalog' | 'subscriptions' | 'ledger';

export const BILLING_WALLET_IMPORTS = [
  CommonModule,
  FormsModule,
  ReactiveFormsModule,
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
  TranslocoPipe,
];

@Component({
  selector: 'app-billing-wallet',
  standalone: true,
  imports: BILLING_WALLET_IMPORTS,
  templateUrl: './wallet.html',
  styleUrls: ['./wallet.scss'],
  animations: [fadeIn],
})
export class BillingWalletPage implements AfterViewInit, OnDestroy {
  private readonly billing = inject(BillingService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(SnackbarService);

  @Input() section: BillingTenantSection = 'dashboard';

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly wallets = signal<BillingWallet[]>([]);
  readonly topups = signal<BillingPaymentIntent[]>([]);
  readonly selectedCatalogItem = signal<BillingCatalogItem | null>(null);

  readonly catalogSource = new MatTableDataSource<BillingCatalogItem>([]);
  readonly subscriptionSource = new MatTableDataSource<BillingSubscription>([]);
  readonly ledgerSource = new MatTableDataSource<BillingLedgerEntry>([]);

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

  readonly subscriptionForm = this.fb.nonNullable.group({
    priceUUID: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.000001)]],
    resourceType: [''],
    resourceUUID: [''],
    resourceLabel: [''],
  });

  readonly topupForm = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.000001)]],
    currency: [''],
    reference: [''],
    payerName: ['', Validators.required],
    payerDocument: ['', Validators.required],
    payerEmail: ['', [Validators.required, Validators.email]],
    payerType: ['FISICA'],
    dueDate: [''],
    idempotencyKey: [''],
  });

  @ViewChild('subscriptionDialog') subscriptionDialog?: TemplateRef<unknown>;
  @ViewChild('topupDialog') topupDialog?: TemplateRef<unknown>;
  @ViewChild('catalogPaginator') catalogPaginator?: MatPaginator;
  @ViewChild('subscriptionPaginator') subscriptionPaginator?: MatPaginator;
  @ViewChild('ledgerPaginator') ledgerPaginator?: MatPaginator;
  @ViewChild('catalogSort') catalogSort?: MatSort;
  @ViewChild('subscriptionSort') subscriptionSort?: MatSort;
  @ViewChild('ledgerSort') ledgerSort?: MatSort;
  private subscriptionDialogRef: MatDialogRef<unknown> | null = null;
  private subscriptionDialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.catalogSource.paginator = this.catalogPaginator ?? null;
    this.subscriptionSource.paginator = this.subscriptionPaginator ?? null;
    this.ledgerSource.paginator = this.ledgerPaginator ?? null;
    this.catalogSource.sort = this.catalogSort ?? null;
    this.subscriptionSource.sort = this.subscriptionSort ?? null;
    this.ledgerSource.sort = this.ledgerSort ?? null;
    this.catalogSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.subscriptionSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.ledgerSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    setTimeout(() => this.refresh(), 0);
  }

  ngOnDestroy() {
    this.closeSubscriptionDialog();
  }

  async refresh() {
    const startedAt = Date.now();
    this.loading.set(true);
    this.error.set(null);
    try {
      const [wallets, catalog, subscriptions, ledger, topups] = await Promise.all([
        this.billing.listWallets(),
        this.billing.listCatalog(this.searchInput),
        this.billing.listSubscriptions(this.searchInput, this.statusFilter),
        this.billing.listLedger(this.ledgerSearchInput),
        this.billing.listTopups('PENDING'),
      ]);
      this.wallets.set(wallets);
      this.topups.set(topups);
      this.catalogSource.data = catalog;
      this.subscriptionSource.data = subscriptions;
      this.ledgerSource.data = ledger;
      this.reconcileSelection();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load billing data.');
    } finally {
      await this.finishLoading(startedAt);
    }
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
    this.topupForm.reset({
      amount: 0,
      currency: this.wallets()[0]?.BwaCurrency ?? '',
      reference: '',
      payerName: '',
      payerDocument: '',
      payerEmail: '',
      payerType: 'FISICA',
      dueDate: '',
      idempotencyKey: crypto.randomUUID(),
    });
    if (!this.topupDialog) return;
    this.closeSubscriptionDialog();
    this.subscriptionDialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.topupDialog,
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
    if (this.topupForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.topupForm.getRawValue();
    try {
      await this.billing.createTopup({
        amount: Number(value.amount),
        currency: this.emptyToNull(value.currency),
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
        'Top-up request created. Credit will be applied after payment confirmation.',
      );
      this.closeSubscriptionDialog();
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to create top-up request.');
    } finally {
      this.saving.set(false);
    }
  }

  openSubscribeDialog(row: BillingCatalogItem) {
    this.selectedCatalogItem.set(row);
    this.subscriptionForm.reset({
      priceUUID: row.BpcUUID,
      quantity: 1,
      resourceType: '',
      resourceUUID: '',
      resourceLabel: '',
    });
    if (!this.subscriptionDialog) return;
    this.closeSubscriptionDialog();
    this.subscriptionDialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.subscriptionDialog,
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
    if (this.subscriptionForm.invalid || this.saving()) return;
    this.saving.set(true);
    try {
      await this.billing.createSubscription({
        priceUUID: this.subscriptionForm.value.priceUUID,
        quantity: this.subscriptionForm.value.quantity,
        resourceType: this.emptyToNull(this.subscriptionForm.value.resourceType),
        resourceUUID: this.emptyToNull(this.subscriptionForm.value.resourceUUID),
        resourceLabel: this.emptyToNull(this.subscriptionForm.value.resourceLabel),
      });
      this.snack.success('Subscription created.');
      if (!keepOpen) this.closeSubscriptionDialog();
      await this.refresh();
      if (keepOpen) this.resetSubscriptionForm();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to create subscription.');
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
        `Cancel ${row.BprName ?? row.BprCode ?? 'this subscription'}?`,
        'Cancel subscription',
      ))
    )
      return;
    try {
      await this.billing.cancelSubscription(row.BsuUUID);
      this.selectedSubscriptionUUIDs.delete(row.BsuUUID);
      this.snack.success('Subscription canceled.');
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to cancel subscription.');
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
    return String(value ?? '').replace(/_/g, ' ');
  }

  closeDialog() {
    this.closeSubscriptionDialog();
  }

  get selectedSubscriptionCount() {
    return this.selectedSubscriptionUUIDs.size;
  }

  visibleSubscriptionRows() {
    return this.visibleRows(this.subscriptionSource).filter((row) => row.BsuStatus !== 'CANCELED');
  }

  isSubscriptionSelected(row: BillingSubscription) {
    return this.selectedSubscriptionUUIDs.has(row.BsuUUID);
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

  async cancelSelectedSubscriptions() {
    const ids = Array.from(this.selectedSubscriptionUUIDs);
    if (!ids.length) return;
    if (
      !(await this.confirm(
        'Cancel selected subscriptions',
        `Cancel ${ids.length} selected active subscription record(s)?`,
        'Cancel selected',
      ))
    )
      return;

    this.loading.set(true);
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
      await this.refresh();
      if (failed.size) {
        failed.forEach((uuid) => this.selectedSubscriptionUUIDs.add(uuid));
        this.snack.error(`${failed.size} selected subscription record(s) could not be canceled.`);
      } else {
        this.snack.success(`${ids.length} subscription record(s) canceled.`);
      }
    } finally {
      this.loading.set(false);
    }
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
      data: { title, message, confirmText, confirmLabel: confirmText },
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
    this.subscriptionForm.reset({
      priceUUID: item?.BpcUUID ?? '',
      quantity: 1,
      resourceType: '',
      resourceUUID: '',
      resourceLabel: '',
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

  private async finishLoading(startedAt: number) {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 600 - elapsed);
    if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
    this.loading.set(false);
  }
}
