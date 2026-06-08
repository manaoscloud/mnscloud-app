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
import { CurrencyMaskDirective } from '../../../shared/currency-mask/currency-mask.directive';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { SnackbarService } from '../../../services/snackbar.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { SystemParameterService } from '../../../services/system-parameter.service';
import {
  BillingPrice,
  BillingProduct,
  BillingService,
  BillingSubscription,
  BillingTenantLookupItem,
} from '../shared/billing.service';

export type BillingSystemSection =
  | 'dashboard'
  | 'products'
  | 'prices'
  | 'subscriptions'
  | 'wallets';

type BillingModeOption = {
  value: string;
  labelKey: string;
};

type BillingScopeOption = {
  value: 'MODULE' | 'RESOURCE' | 'USAGE';
  labelKey: string;
};

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
  TranslocoPipe,
  CurrencyMaskDirective,
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
  private readonly i18n = inject(AppI18nService);
  private readonly parameters = inject(SystemParameterService);

  @Input() section: BillingSystemSection = 'dashboard';

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingProduct = signal<BillingProduct | null>(null);
  readonly editingPrice = signal<BillingPrice | null>(null);
  readonly products = signal<BillingProduct[]>([]);
  readonly tenantOptions = signal<BillingTenantLookupItem[]>([]);
  readonly selectedCreditTenant = signal<BillingTenantLookupItem | null>(null);
  readonly tenantSearchLoading = signal(false);
  readonly defaultCurrency = signal('');

  readonly productSource = new MatTableDataSource<BillingProduct>([]);
  readonly priceSource = new MatTableDataSource<BillingPrice>([]);
  readonly subscriptionSource = new MatTableDataSource<BillingSubscription>([]);

  readonly productColumns = [
    'select',
    'code',
    'name',
    'module',
    'scope',
    'prices',
    'sortOrder',
    'status',
    'actions',
  ];
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
    'reserved',
    'actions',
  ];
  readonly billingModeOptions: BillingModeOption[] = [
    { value: 'ONE_TIME', labelKey: 'One time' },
    { value: 'MONTHLY', labelKey: 'Monthly' },
    { value: 'HOURLY', labelKey: 'Hourly' },
    { value: 'MINUTELY', labelKey: 'Minutely' },
    { value: 'SECONDLY', labelKey: 'Secondly' },
    { value: 'USAGE_UNIT', labelKey: 'Usage unit' },
    { value: 'GB_HOUR', labelKey: 'GB hour' },
    { value: 'GB_MONTH', labelKey: 'GB month' },
    { value: 'MODULE_MONTHLY', labelKey: 'Module monthly' },
    { value: 'TIERED_USAGE', labelKey: 'Tiered usage' },
  ];
  readonly billingScopeOptions: BillingScopeOption[] = [
    { value: 'MODULE', labelKey: 'Module' },
    { value: 'RESOURCE', labelKey: 'Resource' },
    { value: 'USAGE', labelKey: 'Usage' },
  ];

  searchInput = '';
  priceProductFilter = '';
  statusFilter: '' | 0 | 1 = '';
  subscriptionStatusFilter = '';
  priceProductSearchInput = '';
  priceFormProductSearchInput = '';

  readonly selectedProductUUIDs = new Set<string>();
  readonly selectedPriceUUIDs = new Set<string>();
  readonly selectedSubscriptionUUIDs = new Set<string>();

  readonly productForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(2)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    module: ['', [Validators.required, Validators.minLength(2)]],
    billingScope: ['RESOURCE', [Validators.required]],
    description: [''],
    entitlementPattern: [''],
    requiresEntitlementCode: [''],
    resourceType: [''],
    isPublic: [0],
    publicSlug: [''],
    publicName: [''],
    publicSummary: [''],
    publicDescription: [''],
    publicFeaturesJson: [''],
    publicSortOrder: [1000, [Validators.required, Validators.min(0)]],
    sortOrder: [1000, [Validators.required, Validators.min(0)]],
    status: [1],
  });

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
    tenantSearch: ['', [Validators.required]],
    environmentUUID: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.000001)]],
    currency: [''],
    reason: ['', [Validators.required, Validators.minLength(4)]],
    reference: [''],
    idempotencyKey: [''],
  });

  @ViewChild('productDialog') productDialog?: TemplateRef<unknown>;
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
    void this.loadDefaultCurrency();
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
        this.billing.listProducts(this.searchInput, this.normalizedStatusFilter()),
        this.billing.listPrices(
          this.searchInput,
          this.priceProductFilter,
          this.normalizedStatusFilter(),
        ),
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
    this.statusFilter = '';
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

  openProductCreate() {
    this.editingProduct.set(null);
    this.resetProductForm();
    this.productForm.controls.code.enable({ emitEvent: false });
    this.openDialog(this.productDialog, '980px');
  }

  openProductEdit(row: BillingProduct) {
    this.editingProduct.set(row);
    this.productForm.reset({
      code: row.BprCode,
      name: row.BprName,
      module: row.BprModule,
      billingScope: row.BprBillingScope,
      description: row.BprDescription ?? '',
      entitlementPattern: row.BprEntitlementPattern ?? row.BprCode,
      requiresEntitlementCode: row.BprRequiresEntitlementCode ?? '',
      resourceType: row.BprResourceType ?? '',
      isPublic: Number(row.BprIsPublic ?? 0),
      publicSlug: row.BprPublicSlug ?? '',
      publicName: row.BprPublicName ?? '',
      publicSummary: row.BprPublicSummary ?? '',
      publicDescription: row.BprPublicDescription ?? '',
      publicFeaturesJson: row.BprPublicFeaturesJson ?? '',
      publicSortOrder: Number(row.BprPublicSortOrder ?? row.BpdSortOrder ?? 1000),
      sortOrder: Number(row.BpdSortOrder ?? 1000),
      status: row.BprStatus,
    });
    this.productForm.controls.code.disable({ emitEvent: false });
    this.openDialog(this.productDialog, '980px');
  }

  async saveProduct(keepOpen = false) {
    if (this.productForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.productForm.getRawValue();
    const publicFeatures = this.parseJson(value.publicFeaturesJson);
    if (publicFeatures === false) {
      this.saving.set(false);
      this.snack.error(this.i18n.t('Public features JSON is invalid.'));
      return;
    }
    const payload = {
      code: value.code,
      name: value.name,
      module: value.module,
      billingScope: value.billingScope,
      description: this.emptyToNull(value.description),
      entitlementPattern: this.emptyToNull(value.entitlementPattern),
      requiresEntitlementCode: this.emptyToNull(value.requiresEntitlementCode),
      resourceType: this.emptyToNull(value.resourceType),
      isPublic: Number(value.isPublic),
      publicSlug: this.emptyToNull(value.publicSlug),
      publicName: this.emptyToNull(value.publicName),
      publicSummary: this.emptyToNull(value.publicSummary),
      publicDescription: this.emptyToNull(value.publicDescription),
      publicFeatures,
      publicSortOrder: Number(value.publicSortOrder),
      sortOrder: Number(value.sortOrder),
      status: Number(value.status),
    };
    try {
      const current = this.editingProduct();
      if (current) {
        if (!current.BpdUUID) throw new Error(this.i18n.t('Product definition UUID is missing.'));
        await this.billing.updateProductDefinition(current.BpdUUID, payload);
      } else {
        await this.billing.createProductDefinition(payload);
      }
      this.snack.success(this.i18n.t(current ? 'Product updated.' : 'Product created.'));
      if (!keepOpen) this.closeActiveDialog();
      await this.refresh();
      if (keepOpen && !current) this.resetProductForm();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to save product.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNewProduct() {
    await this.saveProduct(true);
  }

  async deleteProduct(row: BillingProduct) {
    if (!row.BpdUUID) {
      this.snack.error(this.i18n.t('Product definition UUID is missing.'));
      return;
    }
    if (
      !(await this.confirm(
        this.i18n.t('Delete product'),
        this.i18n.t('Delete product confirmation', { name: row.BprName }),
        this.i18n.t('Delete'),
      ))
    )
      return;
    try {
      await this.billing.deleteProductDefinition(row.BpdUUID);
      this.selectedProductUUIDs.delete(row.BpdUUID);
      this.snack.success(this.i18n.t('Product deleted.'));
      await this.refresh();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to delete product.'),
      );
    }
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
      currency: row.BpcCurrency || this.defaultCurrency(),
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
      currency: this.normalizeCurrencyInput(value.currency),
      billingMode: value.billingMode,
      unitCode: value.unitCode,
      unitPrice: this.parseLocalizedNumber(value.unitPrice),
      setupAmount: this.parseLocalizedNumber(value.setupAmount),
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
      tenantSearch: '',
      environmentUUID: '',
      amount: 0,
      currency: this.defaultCurrency(),
      reason: '',
      reference: '',
      idempotencyKey: crypto.randomUUID(),
    });
    this.selectedCreditTenant.set(null);
    this.tenantOptions.set([]);
    this.tenantSearchLoading.set(false);
    this.openDialog(this.creditDialog, '720px');
  }

  clearCreditTenantSelection() {
    this.selectedCreditTenant.set(null);
    this.creditForm.controls.environmentUUID.setValue('');
  }

  async searchCreditTenants() {
    const term = this.creditForm.controls.tenantSearch.value.trim();

    if (term.length < 3) {
      this.tenantOptions.set([]);
      this.snack.error('Type at least 3 characters to search tenants.');
      return;
    }

    this.clearCreditTenantSelection();
    this.tenantSearchLoading.set(true);
    try {
      const tenants = await this.billing.searchTenants(term);
      this.tenantOptions.set(tenants);
      if (tenants.length === 0) {
        this.snack.error('No tenant found for this search.');
      }
    } catch (error) {
      this.tenantOptions.set([]);
      this.snack.error(error instanceof Error ? error.message : 'Failed to search tenants.');
    } finally {
      this.tenantSearchLoading.set(false);
    }
  }

  selectCreditTenant(tenant: BillingTenantLookupItem) {
    this.selectedCreditTenant.set(tenant);
    this.creditForm.patchValue({
      tenantSearch: this.tenantLabel(tenant),
      environmentUUID: tenant.EnvironmentUUID,
      currency: tenant.DefaultCurrency ?? this.creditForm.controls.currency.value,
    });
  }

  tenantLabel(tenant: BillingTenantLookupItem) {
    const name = tenant.EnvironmentName?.trim() || 'Tenant';
    return `${name} - ${tenant.TenantEmail ?? tenant.EnvironmentUUID}`;
  }

  async saveManualCredit() {
    if (this.creditForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.creditForm.getRawValue();
    try {
      await this.billing.manualCredit({
        environmentUUID: value.environmentUUID,
        amount: this.parseLocalizedNumber(value.amount),
        currency: this.normalizeCurrencyInput(value.currency),
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

  subscriptionStatusLabel(status: string) {
    const labels: Record<string, string> = {
      ACTIVE: 'Active',
      SUSPENDED: 'Suspended',
      CANCELED: 'Canceled',
      PENDING_PAYMENT: 'Pending payment',
    };

    return this.i18n.t(labels[status] ?? status);
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

  get selectedProductCount() {
    return this.selectedProductUUIDs.size;
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

  productVisibleRows() {
    return this.visibleRows(this.productSource).filter((row) => !!this.productSelectionUUID(row));
  }

  subscriptionVisibleRows() {
    return this.visibleRows(this.subscriptionSource).filter((row) => row.BsuStatus !== 'CANCELED');
  }

  isProductSelected(row: BillingProduct) {
    const uuid = this.productSelectionUUID(row);
    return !!uuid && this.selectedProductUUIDs.has(uuid);
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

  isAllVisibleProductsSelected() {
    const rows = this.productVisibleRows();
    return rows.length > 0 && rows.every((row) => this.isProductSelected(row));
  }

  isSomeVisibleProductsSelected() {
    const rows = this.productVisibleRows();
    return rows.some((row) => this.isProductSelected(row)) && !this.isAllVisibleProductsSelected();
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

  toggleProductSelection(row: BillingProduct, checked: boolean) {
    const uuid = this.productSelectionUUID(row);
    if (!uuid) return;
    if (checked) this.selectedProductUUIDs.add(uuid);
    else this.selectedProductUUIDs.delete(uuid);
  }

  toggleSubscriptionSelection(row: BillingSubscription, checked: boolean) {
    if (checked) this.selectedSubscriptionUUIDs.add(row.BsuUUID);
    else this.selectedSubscriptionUUIDs.delete(row.BsuUUID);
  }

  toggleVisibleProducts(checked: boolean) {
    this.productVisibleRows().forEach((row) => this.toggleProductSelection(row, checked));
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

  async deleteSelectedProducts() {
    const ids = Array.from(this.selectedProductUUIDs);
    if (!ids.length) return;
    const labels = this.productSource.data
      .filter((row) => {
        const uuid = this.productSelectionUUID(row);
        return uuid ? this.selectedProductUUIDs.has(uuid) : false;
      })
      .slice(0, 3)
      .map((row) => row.BprName);
    const detail = labels.length
      ? ` ${this.i18n.t('Selected')}: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';
    if (
      !(await this.confirm(
        this.i18n.t('Delete selected products'),
        `${this.i18n.t('Delete selected products confirmation', { count: ids.length })}${detail}`,
        this.i18n.t('Delete selected'),
      ))
    )
      return;
    await this.runBulkAction(
      ids,
      (uuid) => this.billing.deleteProductDefinition(uuid),
      this.selectedProductUUIDs,
      this.i18n.t('product'),
      this.i18n.t('deleted'),
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

  billingModeLabel(value: unknown) {
    const mode = String(value ?? '');
    const option = this.billingModeOptions.find((item) => item.value === mode);
    return this.i18n.t(option?.labelKey ?? this.label(mode));
  }

  billingScopeLabel(value: unknown) {
    const scope = String(value ?? '') as BillingScopeOption['value'];
    const option = this.billingScopeOptions.find((item) => item.value === scope);
    return this.i18n.t(option?.labelKey ?? this.label(scope));
  }

  normalizedStatusFilter() {
    return this.statusFilter === '' ? null : this.statusFilter;
  }

  resolvedPriceCurrency() {
    return (
      this.normalizeCurrencyInput(this.priceForm.controls.currency.value) ?? this.defaultCurrency()
    );
  }

  resolvedCreditCurrency() {
    return (
      this.normalizeCurrencyInput(this.creditForm.controls.currency.value) ?? this.defaultCurrency()
    );
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
      currency: this.defaultCurrency(),
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

  private resetProductForm() {
    this.editingProduct.set(null);
    this.productForm.controls.code.enable({ emitEvent: false });
    this.productForm.reset({
      code: '',
      name: '',
      module: '',
      billingScope: 'RESOURCE',
      description: '',
      entitlementPattern: '',
      requiresEntitlementCode: '',
      resourceType: '',
      isPublic: 0,
      publicSlug: '',
      publicName: '',
      publicSummary: '',
      publicDescription: '',
      publicFeaturesJson: '',
      publicSortOrder: 1000,
      sortOrder: 1000,
      status: 1,
    });
  }

  private async loadDefaultCurrency() {
    try {
      this.defaultCurrency.set(await this.parameters.resolveDefaultCurrency());
      if (!this.editingPrice() && !this.priceForm.controls.currency.value) {
        this.priceForm.controls.currency.setValue(this.defaultCurrency(), { emitEvent: false });
      }
    } catch {
      // Keep the field empty when the API cannot resolve the platform default.
      // The API/DB remains responsible for the final currency fallback.
    }
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
    this.keepValidSelection(
      this.selectedProductUUIDs,
      this.productSource.data.filter((row) => !!this.productSelectionUUID(row)),
      (row) => this.productSelectionUUID(row) ?? '',
    );
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

  private productSelectionUUID(row: BillingProduct) {
    return row.BpdUUID ?? null;
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

  private normalizeCurrencyInput(value: unknown) {
    const text = String(value ?? '')
      .trim()
      .toUpperCase();
    return text || null;
  }

  private parseLocalizedNumber(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    const normalized = text.replace(/[^\d.,-]/g, '');
    const commaIndex = normalized.lastIndexOf(',');
    const dotIndex = normalized.lastIndexOf('.');
    const decimal = this.detectDecimalSeparator(normalized, commaIndex, dotIndex);

    if (!decimal) return Number(normalized.replace(/[^\d-]/g, '')) || 0;

    const decimalIndex = normalized.lastIndexOf(decimal);
    const integer = normalized.slice(0, decimalIndex).replace(/[^\d-]/g, '');
    const fraction = normalized.slice(decimalIndex + 1).replace(/[^\d]/g, '');
    return Number(`${integer || '0'}.${fraction}`) || 0;
  }

  private detectDecimalSeparator(value: string, commaIndex: number, dotIndex: number) {
    if (commaIndex === -1 && dotIndex === -1) return '';
    if (commaIndex !== -1 && dotIndex !== -1) return commaIndex > dotIndex ? ',' : '.';

    const separator = commaIndex !== -1 ? ',' : '.';
    const index = commaIndex !== -1 ? commaIndex : dotIndex;
    const fractionLength = value.slice(index + 1).replace(/[^\d]/g, '').length;
    return fractionLength > 0 && fractionLength <= 2 ? separator : '';
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
    const productColumns: Record<string, unknown> = {
      code: row?.BprCode,
      name: row?.BprName ?? row?.BpcName,
      module: row?.BprModule,
      scope: row?.BprBillingScope,
      entitlement: row?.BprEntitlementPattern,
      resourceType: row?.BprResourceType,
      public: row?.BprIsPublic,
      prices: row?.PriceCount ?? row?.ActivePrices ?? 0,
      sortOrder: row?.BpdSortOrder ?? 0,
      status: row?.BprStatus ?? row?.BpcStatus ?? row?.BsuStatus,
      product: row?.BprName ?? row?.BprCode,
      tenant: row?.EnvironmentName ?? row?.EnvironmentUUID,
      resource: row?.BsuResourceLabel ?? row?.BsuResourceType,
      quantity: row?.BsuQuantity,
      price: row?.BsuUnitPriceSnapshot,
      reserved: row?.BsuReservedAmountSnapshot,
      mode: row?.BpcBillingMode,
      unitPrice: row?.BpcUnitPrice,
      setup: row?.BpcSetupAmount,
    };
    const value = productColumns[column] ?? row?.[column] ?? '';
    return String(value).toLowerCase();
  }
}
