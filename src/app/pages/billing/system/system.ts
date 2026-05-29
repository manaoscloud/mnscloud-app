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
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { SnackbarService } from '../../../services/snackbar.service';
import {
  BillingPrice,
  BillingProduct,
  BillingService,
  BillingSubscription,
} from '../shared/billing.service';

export type BillingSystemSection =
  | 'dashboard'
  | 'products'
  | 'prices'
  | 'subscriptions'
  | 'wallets';

export const BILLING_SYSTEM_IMPORTS = [
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
  TranslatePipe,
];

@Component({
  selector: 'app-billing-system',
  standalone: true,
  imports: BILLING_SYSTEM_IMPORTS,
  templateUrl: './system.html',
  styleUrls: ['./system.scss'],
  animations: [fadeIn],
})
export class BillingSystemPage implements AfterViewInit, OnDestroy {
  private readonly billing = inject(BillingService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @Input() section: BillingSystemSection = 'dashboard';

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingPrice = signal<BillingPrice | null>(null);
  readonly products = signal<BillingProduct[]>([]);

  readonly productSource = new MatTableDataSource<BillingProduct>([]);
  readonly priceSource = new MatTableDataSource<BillingPrice>([]);
  readonly subscriptionSource = new MatTableDataSource<BillingSubscription>([]);

  readonly productColumns = ['code', 'name', 'module', 'scope', 'prices', 'status'];
  readonly priceColumns = [
    'select',
    'product',
    'name',
    'mode',
    'unitPrice',
    'setup',
    'status',
    'actions',
  ];
  readonly subscriptionColumns = [
    'select',
    'tenant',
    'product',
    'resource',
    'quantity',
    'status',
    'price',
    'actions',
  ];

  searchInput = '';
  priceProductFilter = '';
  statusFilter: number | null = null;
  subscriptionStatusFilter = '';
  priceProductSearchInput = '';
  priceFormProductSearchInput = '';

  readonly selectedPriceUUIDs = new Set<string>();
  readonly selectedSubscriptionUUIDs = new Set<string>();

  readonly priceForm = this.fb.nonNullable.group({
    productUUID: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    currency: [''],
    billingMode: ['MONTHLY', [Validators.required]],
    unitCode: ['UNIT', [Validators.required]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    setupAmount: [0, [Validators.required, Validators.min(0)]],
    includedQuantity: [0, [Validators.required, Validators.min(0)]],
    minimumCommitment: [0, [Validators.required, Validators.min(0)]],
    configJson: [''],
    status: [1],
  });

  readonly creditForm = this.fb.nonNullable.group({
    environmentUUID: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.000001)]],
    currency: [''],
    reason: ['', [Validators.required, Validators.minLength(4)]],
    reference: [''],
    idempotencyKey: [''],
  });

  @ViewChild('priceDialog') priceDialog?: TemplateRef<unknown>;
  @ViewChild('creditDialog') creditDialog?: TemplateRef<unknown>;
  @ViewChild('productPaginator') productPaginator?: MatPaginator;
  @ViewChild('pricePaginator') pricePaginator?: MatPaginator;
  @ViewChild('subscriptionPaginator') subscriptionPaginator?: MatPaginator;
  @ViewChild('productSort') productSort?: MatSort;
  @ViewChild('priceSort') priceSort?: MatSort;
  @ViewChild('subscriptionSort') subscriptionSort?: MatSort;
  private activeDialogRef: MatDialogRef<unknown> | null = null;
  private activeDialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.productSource.paginator = this.productPaginator ?? null;
    this.priceSource.paginator = this.pricePaginator ?? null;
    this.subscriptionSource.paginator = this.subscriptionPaginator ?? null;
    this.productSource.sort = this.productSort ?? null;
    this.priceSource.sort = this.priceSort ?? null;
    this.subscriptionSource.sort = this.subscriptionSort ?? null;
    this.productSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.priceSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.subscriptionSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    setTimeout(() => this.refresh(), 0);
  }

  ngOnDestroy() {
    this.closeActiveDialog();
  }

  async refresh() {
    const startedAt = Date.now();
    this.loading.set(true);
    this.error.set(null);
    try {
      const [products, prices, subscriptions] = await Promise.all([
        this.billing.listProducts(this.searchInput, this.statusFilter),
        this.billing.listPrices(this.searchInput, this.priceProductFilter, this.statusFilter),
        this.billing.listSystemSubscriptions(this.searchInput, this.subscriptionStatusFilter),
      ]);
      this.products.set(products);
      this.productSource.data = products;
      this.priceSource.data = prices;
      this.subscriptionSource.data = subscriptions;
      this.reconcileSelections();
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
    this.priceProductFilter = '';
    this.statusFilter = null;
    this.subscriptionStatusFilter = '';
    void this.refresh();
  }

  isSection(section: BillingSystemSection) {
    return this.section === section;
  }

  get activeProductCount() {
    return this.productSource.data.filter((row) => row.BprStatus === 1).length;
  }

  get activePriceCount() {
    return this.priceSource.data.filter((row) => row.BpcStatus === 1).length;
  }

  get activeSystemSubscriptionCount() {
    return this.subscriptionSource.data.filter((row) => row.BsuStatus === 'ACTIVE').length;
  }

  get tenantSubscriptionCount() {
    return new Set(this.subscriptionSource.data.map((row) => row.EnvironmentUUID).filter(Boolean))
      .size;
  }

  openPriceCreate() {
    this.editingPrice.set(null);
    this.resetPriceForm();
    this.openDialog(this.priceDialog, '860px');
  }

  openPriceEdit(row: BillingPrice) {
    this.editingPrice.set(row);
    this.priceForm.reset({
      productUUID: row.BillingProductBprUUID,
      name: row.BpcName,
      currency: row.BpcCurrency,
      billingMode: row.BpcBillingMode,
      unitCode: row.BpcUnitCode,
      unitPrice: Number(row.BpcUnitPrice ?? 0),
      setupAmount: Number(row.BpcSetupAmount ?? 0),
      includedQuantity: Number(row.BpcIncludedQuantity ?? 0),
      minimumCommitment: Number(row.BpcMinimumCommitment ?? 0),
      configJson: row.BpcConfigJson ?? '',
      status: row.BpcStatus,
    });
    this.openDialog(this.priceDialog, '860px');
  }

  async savePrice(keepOpen = false) {
    if (this.priceForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.priceForm.getRawValue();
    const config = this.parseJson(value.configJson);
    if (config === false) {
      this.saving.set(false);
      this.snack.error('Config JSON is invalid.');
      return;
    }
    const payload = {
      productUUID: value.productUUID,
      name: value.name,
      currency: this.emptyToNull(value.currency),
      billingMode: value.billingMode,
      unitCode: value.unitCode,
      unitPrice: Number(value.unitPrice),
      setupAmount: Number(value.setupAmount),
      includedQuantity: Number(value.includedQuantity),
      minimumCommitment: Number(value.minimumCommitment),
      config,
      status: Number(value.status),
    };
    try {
      const current = this.editingPrice();
      if (current) await this.billing.updatePrice(current.BpcUUID, payload);
      else await this.billing.createPrice(payload);
      this.snack.success(current ? 'Price updated.' : 'Price created.');
      if (!keepOpen) this.closeActiveDialog();
      await this.refresh();
      if (keepOpen && !current) this.resetPriceForm();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to save price.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNewPrice() {
    await this.savePrice(true);
  }

  async deletePrice(row: BillingPrice) {
    if (!(await this.confirm('Delete price', `Delete ${row.BpcName}?`, 'Delete'))) return;
    try {
      await this.billing.deletePrice(row.BpcUUID);
      this.selectedPriceUUIDs.delete(row.BpcUUID);
      this.snack.success('Price deleted.');
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to delete price.');
    }
  }

  openCreditDialog() {
    this.creditForm.reset({
      environmentUUID: '',
      amount: 0,
      currency: '',
      reason: '',
      reference: '',
      idempotencyKey: crypto.randomUUID(),
    });
    this.openDialog(this.creditDialog, '720px');
  }

  async saveManualCredit() {
    if (this.creditForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.creditForm.getRawValue();
    try {
      await this.billing.manualCredit({
        environmentUUID: value.environmentUUID,
        amount: Number(value.amount),
        currency: this.emptyToNull(value.currency),
        reason: value.reason,
        reference: this.emptyToNull(value.reference),
        idempotencyKey: this.emptyToNull(value.idempotencyKey),
      });
      this.snack.success('Credit added.');
      this.closeActiveDialog();
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to add credit.');
    } finally {
      this.saving.set(false);
    }
  }

  async cancelSubscription(row: BillingSubscription) {
    const label = row.BsuResourceLabel || row.BprName || row.BprCode || 'subscription';
    if (!(await this.confirm('Cancel subscription', `Cancel ${label}?`, 'Cancel subscription')))
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

  productName(uuid: string) {
    return this.products().find((product) => product.BprUUID === uuid)?.BprName ?? uuid;
  }

  filteredProducts(search: string) {
    const term = search.trim().toLowerCase();
    if (!term) return this.products();
    return this.products().filter((product) =>
      [product.BprName, product.BprCode, product.BprModule]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }

  clearProductSelectSearch() {
    this.priceProductSearchInput = '';
    this.priceFormProductSearchInput = '';
  }

  closeDialog() {
    this.closeActiveDialog();
  }

  get selectedPriceCount() {
    return this.selectedPriceUUIDs.size;
  }

  get selectedSubscriptionCount() {
    return this.selectedSubscriptionUUIDs.size;
  }

  priceVisibleRows() {
    return this.visibleRows(this.priceSource);
  }

  subscriptionVisibleRows() {
    return this.visibleRows(this.subscriptionSource).filter((row) => row.BsuStatus !== 'CANCELED');
  }

  isPriceSelected(row: BillingPrice) {
    return this.selectedPriceUUIDs.has(row.BpcUUID);
  }

  isSubscriptionSelected(row: BillingSubscription) {
    return this.selectedSubscriptionUUIDs.has(row.BsuUUID);
  }

  isAllVisiblePricesSelected() {
    const rows = this.priceVisibleRows();
    return rows.length > 0 && rows.every((row) => this.isPriceSelected(row));
  }

  isSomeVisiblePricesSelected() {
    const rows = this.priceVisibleRows();
    return rows.some((row) => this.isPriceSelected(row)) && !this.isAllVisiblePricesSelected();
  }

  isAllVisibleSubscriptionsSelected() {
    const rows = this.subscriptionVisibleRows();
    return rows.length > 0 && rows.every((row) => this.isSubscriptionSelected(row));
  }

  isSomeVisibleSubscriptionsSelected() {
    const rows = this.subscriptionVisibleRows();
    return (
      rows.some((row) => this.isSubscriptionSelected(row)) &&
      !this.isAllVisibleSubscriptionsSelected()
    );
  }

  togglePriceSelection(row: BillingPrice, checked: boolean) {
    if (checked) this.selectedPriceUUIDs.add(row.BpcUUID);
    else this.selectedPriceUUIDs.delete(row.BpcUUID);
  }

  toggleSubscriptionSelection(row: BillingSubscription, checked: boolean) {
    if (checked) this.selectedSubscriptionUUIDs.add(row.BsuUUID);
    else this.selectedSubscriptionUUIDs.delete(row.BsuUUID);
  }

  toggleVisiblePrices(checked: boolean) {
    this.priceVisibleRows().forEach((row) => this.togglePriceSelection(row, checked));
  }

  toggleVisibleSubscriptions(checked: boolean) {
    this.subscriptionVisibleRows().forEach((row) => this.toggleSubscriptionSelection(row, checked));
  }

  async deleteSelectedPrices() {
    const ids = Array.from(this.selectedPriceUUIDs);
    if (!ids.length) return;
    const labels = this.priceSource.data
      .filter((row) => this.selectedPriceUUIDs.has(row.BpcUUID))
      .slice(0, 3)
      .map((row) => row.BpcName);
    const detail = labels.length
      ? ` Selected: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';
    if (
      !(await this.confirm(
        'Delete selected prices',
        `Delete ${ids.length} selected price record(s)?${detail}`,
        'Delete selected',
      ))
    )
      return;
    await this.runBulkAction(
      ids,
      (uuid) => this.billing.deletePrice(uuid),
      this.selectedPriceUUIDs,
      'price',
      'deleted',
    );
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
    await this.runBulkAction(
      ids,
      (uuid) => this.billing.cancelSubscription(uuid),
      this.selectedSubscriptionUUIDs,
      'subscription',
      'canceled',
    );
  }

  formatMoney(value: unknown, currency = '') {
    const amount = Number(value ?? 0);
    return `${currency ? `${currency} ` : ''}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  }

  label(value: unknown) {
    return String(value ?? '').replace(/_/g, ' ');
  }

  private openDialog(template: TemplateRef<unknown> | undefined, width: string) {
    if (!template) return;
    this.closeActiveDialog();
    this.activeDialogBinding = openCrudTemplateDialog(this.dialog, template, 'crud-dialog-panel', {
      onEscape: () => this.closeActiveDialog(),
    });
    this.activeDialogRef = this.activeDialogBinding.ref;
    if (width && window.innerWidth > 900)
      this.activeDialogRef.updateSize(width, 'min(92vh, 980px)');
    this.activeDialogRef.afterClosed().subscribe(() => {
      this.activeDialogBinding?.stop();
      this.activeDialogBinding = null;
      this.activeDialogRef = null;
      this.saving.set(false);
      this.clearProductSelectSearch();
    });
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

  private closeActiveDialog() {
    this.activeDialogBinding?.stop();
    this.activeDialogRef?.close();
    this.activeDialogBinding = null;
    this.activeDialogRef = null;
  }

  private resetPriceForm() {
    this.editingPrice.set(null);
    this.priceForm.reset({
      productUUID: this.products()[0]?.BprUUID ?? '',
      name: '',
      currency: '',
      billingMode: 'MONTHLY',
      unitCode: 'UNIT',
      unitPrice: 0,
      setupAmount: 0,
      includedQuantity: 0,
      minimumCommitment: 0,
      configJson: '',
      status: 1,
    });
  }

  private visibleRows<T>(source: MatTableDataSource<T>) {
    const filtered = source.filter ? source.filteredData : source.data;
    const paginator = source.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  private async runBulkAction(
    ids: string[],
    action: (uuid: string) => Promise<void>,
    selection: Set<string>,
    label: string,
    verb: string,
  ) {
    this.loading.set(true);
    const failed = new Set<string>();
    try {
      for (const uuid of ids) {
        try {
          await action(uuid);
          selection.delete(uuid);
        } catch {
          failed.add(uuid);
        }
      }
      await this.refresh();
      if (failed.size) {
        failed.forEach((uuid) => selection.add(uuid));
        this.snack.error(`${failed.size} selected ${label} record(s) could not be ${verb}.`);
      } else {
        this.snack.success(`${ids.length} ${label} record(s) ${verb}.`);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private reconcileSelections() {
    this.keepValidSelection(this.selectedPriceUUIDs, this.priceSource.data, (row) => row.BpcUUID);
    this.keepValidSelection(
      this.selectedSubscriptionUUIDs,
      this.subscriptionSource.data.filter((row) => row.BsuStatus !== 'CANCELED'),
      (row) => row.BsuUUID,
    );
  }

  private keepValidSelection<T>(selection: Set<string>, rows: T[], uuidOf: (row: T) => string) {
    const valid = new Set(rows.map(uuidOf));
    Array.from(selection).forEach((uuid) => {
      if (!valid.has(uuid)) selection.delete(uuid);
    });
  }

  private async finishLoading(startedAt: number) {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 600 - elapsed);
    if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
    this.loading.set(false);
  }

  private emptyToNull(value: unknown) {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private parseJson(value: string) {
    const text = value.trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return false;
    }
  }

  private sortValue(row: any, column: string) {
    return String(
      row?.[column] ?? row?.BprName ?? row?.BpcName ?? row?.EnvironmentName ?? '',
    ).toLowerCase();
  }
}
