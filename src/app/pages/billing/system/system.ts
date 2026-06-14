import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, min, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
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
import { CurrencyMaskDirective } from '../../../shared/currency-mask/currency-mask.directive';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { SnackbarService } from '../../../services/snackbar.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { SystemParameterService } from '../../../services/system-parameter.service';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import {
  BillingPrice,
  BillingPackage,
  BillingProduct,
  BillingProductDefinition,
  BillingPromotion,
  BillingService,
  BillingSubscription,
  BillingTenantLookupItem,
} from '../shared/billing.service';

export type BillingSystemSection =
  | 'dashboard'
  | 'products'
  | 'prices'
  | 'packages'
  | 'promotions'
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

type BillingSystemFilters = {
  search: string;
  priceProductUUID: string;
  status: '' | 0 | 1;
  subscriptionStatus: string;
};

type BillingSystemSnapshot = {
  definitions: BillingProductDefinition[];
  products: BillingProduct[];
  prices: BillingPrice[];
  packages: BillingPackage[];
  promotions: BillingPromotion[];
  subscriptions: BillingSubscription[];
};

type ProductFormModel = {
  code: string;
  name: string;
  module: string;
  billingScope: 'MODULE' | 'RESOURCE' | 'USAGE';
  description: string;
  entitlementPattern: string;
  requiresEntitlementCode: string;
  resourceType: string;
  isPublic: number;
  publicSlug: string;
  publicName: string;
  publicSummary: string;
  publicDescription: string;
  publicFeaturesJson: string;
  publicSortOrder: number | null;
  sortOrder: number | null;
  status: number;
};

type PriceFormModel = {
  productUUID: string;
  name: string;
  currency: string;
  billingMode: string;
  unitCode: string;
  unitPrice: number;
  setupAmount: number;
  includedQuantity: number;
  minimumCommitment: number;
  configJson: string;
  status: number;
};

type PackageFormModel = {
  code: string;
  name: string;
  description: string;
  productUUID: string;
  isPublic: number;
  sortOrder: number;
  status: number;
  itemProductUUID: string;
  itemEntitlementCode: string;
  itemIncludedQuantity: number;
  itemRequired: number;
  itemConfigJson: string;
};

type PromotionFormModel = {
  code: string;
  name: string;
  description: string;
  currency: string;
  requiresCoupon: number;
  maxRedemptions: number | null;
  maxRedemptionsPerTenant: number | null;
  stackingPolicy: string;
  eligibilityJson: string;
  isPublic: number;
  startsAt: string;
  endsAt: string;
  status: number;
  ruleProductUUID: string;
  rulePriceUUID: string;
  discountType: string;
  appliesTo: string;
  discountValue: number;
  cycles: number | null;
  couponCode: string;
  couponMaxUses: number | null;
  couponMaxUsesPerTenant: number | null;
  couponExpiresAt: string;
};

type CreditFormModel = {
  tenantSearch: string;
  environmentUUID: string;
  amount: number;
  currency: string;
  reason: string;
  reference: string;
  idempotencyKey: string;
};

const EMPTY_BILLING_SYSTEM_SNAPSHOT: BillingSystemSnapshot = {
  definitions: [],
  products: [],
  prices: [],
  packages: [],
  promotions: [],
  subscriptions: [],
};

export const BILLING_SYSTEM_IMPORTS = [
  RefreshButtonComponent,
  FormField,
  MatAutocompleteModule,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingSystemPage {
  private readonly billing = inject(BillingService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly i18n = inject(AppI18nService);
  private readonly parameters = inject(SystemParameterService);
  private readonly destroyRef = inject(DestroyRef);

  section: BillingSystemSection = 'dashboard';

  private readonly appliedFilters = signal<BillingSystemFilters>({
    search: '',
    priceProductUUID: '',
    status: '',
    subscriptionStatus: '',
  });
  private readonly billingResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: EMPTY_BILLING_SYSTEM_SNAPSHOT,
    loader: ({ params }) => this.fetchBillingSnapshot(params),
  });

  private readonly mutating = signal(false);
  readonly loading = computed(() => this.billingResource.isLoading() || this.mutating());
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingProduct = signal<BillingProduct | null>(null);
  readonly productDefinitions = signal<BillingProductDefinition[]>([]);
  readonly editingPrice = signal<BillingPrice | null>(null);
  readonly editingPackage = signal<BillingPackage | null>(null);
  readonly editingPromotion = signal<BillingPromotion | null>(null);
  readonly products = signal<BillingProduct[]>([]);
  readonly tenantOptions = signal<BillingTenantLookupItem[]>([]);
  readonly selectedCreditTenant = signal<BillingTenantLookupItem | null>(null);
  readonly tenantSearchLoading = signal(false);
  readonly defaultCurrency = signal('');
  readonly priceProductSearchInput = signal('');
  readonly priceFormProductSearchInput = signal('');
  readonly packageFormProductSearchInput = signal('');
  readonly promotionRuleProductSearchInput = signal('');
  readonly productCodeFilter = signal('');
  readonly priceProductOptions = computed(() =>
    this.filterProducts(this.priceProductSearchInput()),
  );
  readonly priceFormProductOptions = computed(() =>
    this.filterProducts(this.priceFormProductSearchInput()),
  );
  readonly packageFormProductOptions = computed(() =>
    this.filterProducts(this.packageFormProductSearchInput()),
  );
  readonly promotionRuleProductOptions = computed(() =>
    this.filterProducts(this.promotionRuleProductSearchInput()),
  );
  readonly defaultPriceProductUUID = linkedSignal<BillingProduct[], string>({
    source: this.products,
    computation: (products, previous) => {
      const previousValue = previous?.value ?? '';
      if (previousValue && products.some((product) => product.BprUUID === previousValue)) {
        return previousValue;
      }
      return products[0]?.BprUUID ?? '';
    },
  });

  readonly productSource = new MatTableDataSource<BillingProduct>([]);
  readonly priceSource = new MatTableDataSource<BillingPrice>([]);
  readonly packageSource = new MatTableDataSource<BillingPackage>([]);
  readonly promotionSource = new MatTableDataSource<BillingPromotion>([]);
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
  readonly packageColumns = ['code', 'name', 'product', 'items', 'public', 'status', 'actions'];
  readonly promotionColumns = [
    'code',
    'name',
    'currency',
    'coupon',
    'rules',
    'period',
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

  readonly searchInput = signal('');
  readonly priceProductFilter = signal('');
  readonly statusFilter = signal<'' | 0 | 1>('');
  readonly subscriptionStatusFilter = signal('');

  readonly productFormModel = signal<ProductFormModel>(this.emptyProductForm());
  readonly productForm = createForm(this.productFormModel, (schema) => {
    required(schema.code);
    minLength(schema.code, 2);
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.module);
    minLength(schema.module, 2);
    required(schema.billingScope);
    min(schema.publicSortOrder, 0);
    min(schema.sortOrder, 0);
  });

  readonly priceFormModel = signal<PriceFormModel>(this.emptyPriceForm());
  readonly priceForm = createForm(this.priceFormModel, (schema) => {
    required(schema.productUUID);
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.billingMode);
    required(schema.unitCode);
    required(schema.unitPrice);
    min(schema.unitPrice, 0);
    required(schema.setupAmount);
    min(schema.setupAmount, 0);
    required(schema.includedQuantity);
    min(schema.includedQuantity, 0);
    required(schema.minimumCommitment);
    min(schema.minimumCommitment, 0);
  });

  readonly packageFormModel = signal<PackageFormModel>(this.emptyPackageForm());
  readonly packageForm = createForm(this.packageFormModel, (schema) => {
    required(schema.code);
    minLength(schema.code, 9);
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.productUUID);
    min(schema.sortOrder, 0);
    required(schema.itemProductUUID);
    required(schema.itemEntitlementCode);
    minLength(schema.itemEntitlementCode, 4);
    required(schema.itemIncludedQuantity);
    min(schema.itemIncludedQuantity, 0);
  });

  readonly promotionFormModel = signal<PromotionFormModel>(this.emptyPromotionForm());
  readonly promotionForm = createForm(this.promotionFormModel, (schema) => {
    required(schema.code);
    minLength(schema.code, 7);
    required(schema.name);
    minLength(schema.name, 2);
    min(schema.maxRedemptions, 0);
    min(schema.maxRedemptionsPerTenant, 0);
    required(schema.stackingPolicy);
    min(schema.discountValue, 0);
    min(schema.cycles, 0);
    min(schema.couponMaxUses, 0);
    min(schema.couponMaxUsesPerTenant, 0);
  });

  readonly creditFormModel = signal<CreditFormModel>(this.emptyCreditForm());
  readonly creditForm = createForm(this.creditFormModel, (schema) => {
    required(schema.tenantSearch);
    required(schema.environmentUUID);
    required(schema.amount);
    min(schema.amount, 0.000001);
    required(schema.reason);
    minLength(schema.reason, 4);
  });

  readonly selectedProductUUIDs = new Set<string>();
  readonly selectedPriceUUIDs = new Set<string>();
  readonly selectedSubscriptionUUIDs = new Set<string>();

  readonly productDialog = viewChild<TemplateRef<unknown>>('productDialog');
  readonly priceDialog = viewChild<TemplateRef<unknown>>('priceDialog');
  readonly packageDialog = viewChild<TemplateRef<unknown>>('packageDialog');
  readonly promotionDialog = viewChild<TemplateRef<unknown>>('promotionDialog');
  readonly creditDialog = viewChild<TemplateRef<unknown>>('creditDialog');
  readonly productPaginator = viewChild<MatPaginator>('productPaginator');
  readonly pricePaginator = viewChild<MatPaginator>('pricePaginator');
  readonly subscriptionPaginator = viewChild<MatPaginator>('subscriptionPaginator');
  readonly productSort = viewChild<MatSort>('productSort');
  readonly priceSort = viewChild<MatSort>('priceSort');
  readonly subscriptionSort = viewChild<MatSort>('subscriptionSort');
  private activeDialogRef: MatDialogRef<unknown> | null = null;
  private activeDialogBinding: CrudDialogBinding | null = null;

  private readonly syncBillingData = effect(() => {
    const snapshot = this.billingResource.value();
    this.productDefinitions.set(snapshot.definitions);
    this.products.set(snapshot.products);
    this.productSource.data = snapshot.products;
    this.priceSource.data = snapshot.prices;
    this.packageSource.data = snapshot.packages;
    this.promotionSource.data = snapshot.promotions;
    this.subscriptionSource.data = snapshot.subscriptions;
    this.reconcileSelections();
  });

  private readonly reportBillingError = effect(() => {
    const error = this.billingResource.error();
    if (!error) return;
    this.error.set(error instanceof Error ? error.message : 'Failed to load billing data.');
  });

  private readonly setupTables = afterNextRender(() => {
    this.productSource.paginator = this.productPaginator() ?? null;
    this.priceSource.paginator = this.pricePaginator() ?? null;
    this.subscriptionSource.paginator = this.subscriptionPaginator() ?? null;
    this.productSource.sort = this.productSort() ?? null;
    this.priceSource.sort = this.priceSort() ?? null;
    this.subscriptionSource.sort = this.subscriptionSort() ?? null;
    this.productSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.priceSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.subscriptionSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.loadDefaultCurrency();
    this.refresh();
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeActiveDialog());
  }

  refresh() {
    this.billingResource.reload();
  }

  private async fetchBillingSnapshot(
    filters: BillingSystemFilters,
  ): Promise<BillingSystemSnapshot> {
    this.error.set(null);
    const status = filters.status === '' ? null : filters.status;
    const [definitions, products, prices, packages, promotions, subscriptions] = await Promise.all([
      this.billing.listProductDefinitions('', null),
      this.billing.listProducts(filters.search, status),
      this.billing.listPrices(filters.search, filters.priceProductUUID, status),
      this.billing.listPackages(filters.search, status),
      this.billing.listPromotions(filters.search, status),
      this.billing.listSystemSubscriptions(filters.search, filters.subscriptionStatus),
    ]);
    return { definitions, products, prices, packages, promotions, subscriptions };
  }

  applyFilters() {
    this.appliedFilters.set(this.currentFilters());
  }

  clearFilters() {
    this.searchInput.set('');
    this.priceProductFilter.set('');
    this.statusFilter.set('');
    this.subscriptionStatusFilter.set('');
    this.applyFilters();
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

  get activePackageCount() {
    return this.packageSource.data.filter((row) => row.BpaStatus === 1).length;
  }

  get activePromotionCount() {
    return this.promotionSource.data.filter((row) => row.BpmStatus === 1).length;
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
    this.productCodeFilter.set('');
    this.openDialog(this.productDialog(), '980px');
  }

  openProductEdit(row: BillingProduct) {
    this.editingProduct.set(row);
    this.productFormModel.set({
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
    this.productCodeFilter.set(row.BprCode);
    this.openDialog(this.productDialog(), '980px');
  }

  async saveProduct(keepOpen = false) {
    if (!this.productForm().valid() || this.saving()) return;
    this.saving.set(true);
    const value = this.productFormModel();
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
      publicSortOrder: this.optionalNumber(value.publicSortOrder),
      sortOrder: this.optionalNumber(value.sortOrder),
      status: Number(value.status),
    };
    try {
      const current = this.editingProduct();
      if (current) {
        if (!current.BprUUID) throw new Error(this.i18n.t('Product UUID is missing.'));
        await this.billing.updateProduct(current.BprUUID, payload);
      } else {
        await this.billing.createProduct(payload);
      }
      this.snack.success(this.i18n.t(current ? 'Product updated.' : 'Product created.'));
      if (!keepOpen) this.closeActiveDialog();
      this.refresh();
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

  productDefinitionOptions() {
    const term = String(this.productCodeFilter() || this.productFormModel().code || '')
      .trim()
      .toLowerCase();
    const definitions = this.productDefinitions();
    const options = term
      ? definitions.filter((definition) =>
          [
            definition.BpdCode,
            definition.BpdName,
            definition.BpdModule,
            definition.BpdBillingScope,
            definition.BpdDescription,
            definition.BpdEntitlementPattern,
            definition.BpdResourceType,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term)),
        )
      : definitions;
    return options.slice(0, 80);
  }

  selectProductDefinitionCode(code: string) {
    const definition = this.productDefinitions().find((item) => item.BpdCode === code);
    if (!definition || this.editingProduct()) return;
    const current = this.productFormModel();
    this.productCodeFilter.set(definition.BpdCode);
    this.productFormModel.set({
      code: definition.BpdCode,
      name: current.name || definition.BpdName,
      module: current.module || definition.BpdModule,
      billingScope: definition.BpdBillingScope,
      description: current.description || definition.BpdDescription || '',
      entitlementPattern:
        current.entitlementPattern || definition.BpdEntitlementPattern || definition.BpdCode,
      requiresEntitlementCode:
        current.requiresEntitlementCode || definition.BpdRequiresEntitlementCode || '',
      resourceType: current.resourceType || definition.BpdResourceType || '',
      isPublic: Number(current.isPublic || definition.BpdIsPublic || 0),
      publicSlug: current.publicSlug || definition.BpdPublicSlug || '',
      publicName: current.publicName || definition.BpdPublicName || '',
      publicSummary: current.publicSummary || definition.BpdPublicSummary || '',
      publicDescription: current.publicDescription || definition.BpdPublicDescription || '',
      publicFeaturesJson: current.publicFeaturesJson || definition.BpdPublicFeaturesJson || '',
      publicSortOrder: current.publicSortOrder ?? definition.BpdPublicSortOrder ?? null,
      sortOrder: current.sortOrder ?? definition.BpdSortOrder ?? null,
      status: Number(current.status ?? definition.BpdStatus ?? 1),
    });
  }

  async deleteProduct(row: BillingProduct) {
    if (!row.BprUUID) {
      this.snack.error(this.i18n.t('Product UUID is missing.'));
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
      await this.billing.deleteProduct(row.BprUUID);
      this.selectedProductUUIDs.delete(row.BprUUID);
      this.snack.success(this.i18n.t('Product deleted.'));
      this.refresh();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to delete product.'),
      );
    }
  }

  openPriceCreate() {
    this.editingPrice.set(null);
    this.resetPriceForm();
    this.openDialog(this.priceDialog(), '860px');
  }

  openPriceEdit(row: BillingPrice) {
    this.editingPrice.set(row);
    this.priceFormModel.set({
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
    this.openDialog(this.priceDialog(), '860px');
  }

  async savePrice(keepOpen = false) {
    if (!this.priceForm().valid() || this.saving()) return;
    this.saving.set(true);
    const value = this.priceFormModel();
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
      this.refresh();
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

  openPackageCreate() {
    this.editingPackage.set(null);
    this.resetPackageForm();
    this.openDialog(this.packageDialog(), '860px');
  }

  openPackageEdit(row: BillingPackage) {
    this.editingPackage.set(row);
    this.packageFormModel.set({
      code: row.BpaCode,
      name: row.BpaName,
      description: row.BpaDescription ?? '',
      productUUID: row.BillingProductBprUUID,
      isPublic: Number(row.BpaIsPublic ?? 0),
      sortOrder: Number(row.BpaSortOrder ?? 1000),
      status: Number(row.BpaStatus ?? 1),
      itemProductUUID: row.BillingProductBprUUID,
      itemEntitlementCode: '',
      itemIncludedQuantity: 1,
      itemRequired: 1,
      itemConfigJson: '',
    });
    this.openDialog(this.packageDialog(), '860px');
  }

  async savePackage(keepOpen = false) {
    if (!this.packageForm().valid() || this.saving()) return;
    this.saving.set(true);
    const value = this.packageFormModel();
    const itemConfig = this.parseJson(value.itemConfigJson);
    if (itemConfig === false) {
      this.saving.set(false);
      this.snack.error(this.i18n.t('Item config JSON is invalid.'));
      return;
    }
    const payload = {
      code: value.code,
      name: value.name,
      description: this.emptyToNull(value.description),
      productUUID: value.productUUID,
      isPublic: Number(value.isPublic),
      sortOrder: Number(value.sortOrder ?? 1000),
      status: Number(value.status),
    };
    try {
      const current = this.editingPackage();
      const saved = current
        ? await this.billing.updatePackage(current.BpaUUID, payload)
        : await this.billing.createPackage(payload);
      const packageUUID = current?.BpaUUID ?? saved?.BpaUUID;
      if (!current && packageUUID) {
        await this.billing.createPackageItem(packageUUID, {
          productUUID: value.itemProductUUID,
          entitlementCode: value.itemEntitlementCode,
          includedQuantity: this.parseLocalizedNumber(value.itemIncludedQuantity),
          required: Number(value.itemRequired),
          config: itemConfig,
          status: 1,
        });
      }
      this.snack.success(this.i18n.t(current ? 'Package updated.' : 'Package created.'));
      if (!keepOpen) this.closeActiveDialog();
      this.refresh();
      if (keepOpen && !current) this.resetPackageForm();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to save package.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNewPackage() {
    await this.savePackage(true);
  }

  async deletePackage(row: BillingPackage) {
    if (
      !(await this.confirm(
        this.i18n.t('Delete package'),
        `${this.i18n.t('Delete')} ${row.BpaName}?`,
        this.i18n.t('Delete'),
      ))
    )
      return;
    try {
      await this.billing.deletePackage(row.BpaUUID);
      this.snack.success(this.i18n.t('Package deleted.'));
      this.refresh();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to delete package.'),
      );
    }
  }

  openPromotionCreate() {
    this.editingPromotion.set(null);
    this.resetPromotionForm();
    this.openDialog(this.promotionDialog(), '980px');
  }

  openPromotionEdit(row: BillingPromotion) {
    this.editingPromotion.set(row);
    this.promotionFormModel.set({
      code: row.BpmCode,
      name: row.BpmName,
      description: row.BpmDescription ?? '',
      currency: row.BpmCurrency ?? this.defaultCurrency(),
      requiresCoupon: Number(row.BpmRequiresCoupon ?? 0),
      maxRedemptions: row.BpmMaxRedemptions ?? null,
      maxRedemptionsPerTenant: row.BpmMaxRedemptionsPerTenant ?? null,
      stackingPolicy: row.BpmStackingPolicy || 'EXCLUSIVE',
      eligibilityJson: row.BpmEligibilityJson ?? '',
      isPublic: Number(row.BpmIsPublic ?? 0),
      startsAt: this.datetimeLocalValue(row.BpmStartsAt),
      endsAt: this.datetimeLocalValue(row.BpmEndsAt),
      status: Number(row.BpmStatus ?? 1),
      ruleProductUUID: '',
      rulePriceUUID: '',
      discountType: 'PERCENT',
      appliesTo: 'ALL',
      discountValue: 0,
      cycles: null,
      couponCode: '',
      couponMaxUses: null,
      couponMaxUsesPerTenant: null,
      couponExpiresAt: '',
    });
    this.openDialog(this.promotionDialog(), '980px');
  }

  async savePromotion(keepOpen = false) {
    if (!this.promotionForm().valid() || this.saving()) return;
    this.saving.set(true);
    const value = this.promotionFormModel();
    const eligibility = this.parseJson(value.eligibilityJson);
    if (eligibility === false) {
      this.saving.set(false);
      this.snack.error(this.i18n.t('Eligibility JSON is invalid.'));
      return;
    }
    const current = this.editingPromotion();
    if (!current && !value.ruleProductUUID && !value.rulePriceUUID) {
      this.saving.set(false);
      this.snack.error(this.i18n.t('Promotion rule requires a product or price.'));
      return;
    }
    const payload = {
      code: value.code,
      name: value.name,
      description: this.emptyToNull(value.description),
      currency: this.normalizeCurrencyInput(value.currency),
      requiresCoupon: Number(value.requiresCoupon),
      maxRedemptions: this.optionalNumber(value.maxRedemptions),
      maxRedemptionsPerTenant: this.optionalNumber(value.maxRedemptionsPerTenant),
      stackingPolicy: value.stackingPolicy,
      eligibility,
      isPublic: Number(value.isPublic),
      startsAt: this.emptyToNull(value.startsAt),
      endsAt: this.emptyToNull(value.endsAt),
      status: Number(value.status),
    };
    try {
      const saved = current
        ? await this.billing.updatePromotion(current.BpmUUID, payload)
        : await this.billing.createPromotion(payload);
      const promotionUUID = current?.BpmUUID ?? saved?.BpmUUID;
      if (!current && promotionUUID && (value.ruleProductUUID || value.rulePriceUUID)) {
        await this.billing.createPromotionRule(promotionUUID, {
          productUUID: this.emptyToNull(value.ruleProductUUID),
          priceUUID: this.emptyToNull(value.rulePriceUUID),
          discountType: value.discountType,
          appliesTo: value.appliesTo,
          discountValue: this.parseLocalizedNumber(value.discountValue),
          cycles: this.optionalNumber(value.cycles),
          status: 1,
        });
      }
      if (!current && promotionUUID && value.couponCode.trim()) {
        await this.billing.createPromotionCoupon(promotionUUID, {
          code: value.couponCode,
          maxUses: this.optionalNumber(value.couponMaxUses),
          maxUsesPerTenant: this.optionalNumber(value.couponMaxUsesPerTenant),
          expiresAt: this.emptyToNull(value.couponExpiresAt),
          status: 1,
        });
      }
      this.snack.success(this.i18n.t(current ? 'Promotion updated.' : 'Promotion created.'));
      if (!keepOpen) this.closeActiveDialog();
      this.refresh();
      if (keepOpen && !current) this.resetPromotionForm();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to save promotion.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNewPromotion() {
    await this.savePromotion(true);
  }

  async deletePromotion(row: BillingPromotion) {
    if (
      !(await this.confirm(
        this.i18n.t('Delete promotion'),
        `${this.i18n.t('Delete')} ${row.BpmName}?`,
        this.i18n.t('Delete'),
      ))
    )
      return;
    try {
      await this.billing.deletePromotion(row.BpmUUID);
      this.snack.success(this.i18n.t('Promotion deleted.'));
      this.refresh();
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to delete promotion.'),
      );
    }
  }

  async deletePrice(row: BillingPrice) {
    if (!(await this.confirm('Delete price', `Delete ${row.BpcName}?`, 'Delete'))) return;
    try {
      await this.billing.deletePrice(row.BpcUUID);
      this.selectedPriceUUIDs.delete(row.BpcUUID);
      this.snack.success('Price deleted.');
      this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to delete price.');
    }
  }

  openCreditDialog() {
    this.creditFormModel.set({
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
    this.openDialog(this.creditDialog(), '720px');
  }

  clearCreditTenantSelection() {
    this.selectedCreditTenant.set(null);
    this.creditFormModel.update((value) => ({ ...value, environmentUUID: '' }));
  }

  async searchCreditTenants() {
    const term = this.creditFormModel().tenantSearch.trim();

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
    this.creditFormModel.update((value) => ({
      ...value,
      tenantSearch: this.tenantLabel(tenant),
      environmentUUID: tenant.EnvironmentUUID,
      currency: tenant.DefaultCurrency ?? value.currency,
    }));
  }

  tenantLabel(tenant: BillingTenantLookupItem) {
    const name = tenant.EnvironmentName?.trim() || 'Tenant';
    return `${name} - ${tenant.TenantEmail ?? tenant.EnvironmentUUID}`;
  }

  async saveManualCredit() {
    if (!this.creditForm().valid() || this.saving()) return;
    this.saving.set(true);
    const value = this.creditFormModel();
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
      this.refresh();
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
      this.refresh();
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
      PENDING_CANCEL: 'Pending cancellation',
      SUSPENDED: 'Suspended',
      CANCELED: 'Canceled',
      PENDING_PAYMENT: 'Pending payment',
    };

    return this.i18n.t(labels[status] ?? status);
  }

  clearProductSelectSearch() {
    this.priceProductSearchInput.set('');
    this.priceFormProductSearchInput.set('');
    this.packageFormProductSearchInput.set('');
    this.promotionRuleProductSearchInput.set('');
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
    return this.visibleRows(this.subscriptionSource).filter(
      (row) => !this.isSubscriptionCanceled(row),
    );
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

  isSubscriptionCanceled(row: BillingSubscription) {
    return ['CANCELED', 'PENDING_CANCEL'].includes(String(row.BsuStatus ?? '').toUpperCase());
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
      (uuid) => this.billing.deleteProduct(uuid),
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

  resolvedPriceCurrency() {
    return this.normalizeCurrencyInput(this.priceFormModel().currency) ?? this.defaultCurrency();
  }

  resolvedCreditCurrency() {
    return this.normalizeCurrencyInput(this.creditFormModel().currency) ?? this.defaultCurrency();
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
    this.priceFormModel.set(this.emptyPriceForm());
  }

  private resetPackageForm() {
    this.editingPackage.set(null);
    this.packageFormModel.set(this.emptyPackageForm());
  }

  private resetPromotionForm() {
    this.editingPromotion.set(null);
    this.promotionFormModel.set(this.emptyPromotionForm());
  }

  private resetProductForm() {
    this.editingProduct.set(null);
    this.productCodeFilter.set('');
    this.productFormModel.set(this.emptyProductForm());
  }

  private optionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private filterProducts(search: string) {
    const term = search.trim().toLowerCase();
    if (!term) return this.products();
    return this.products().filter((product) =>
      [product.BprName, product.BprCode, product.BprModule]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }

  private async loadDefaultCurrency() {
    try {
      this.defaultCurrency.set(await this.parameters.resolveDefaultCurrency());
      if (!this.editingPrice() && !this.priceFormModel().currency) {
        this.priceFormModel.update((value) => ({ ...value, currency: this.defaultCurrency() }));
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
    this.mutating.set(true);
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
      this.refresh();
      if (failed.size) {
        failed.forEach((uuid) => selection.add(uuid));
        this.snack.error(`${failed.size} selected ${label} record(s) could not be ${verb}.`);
      } else {
        this.snack.success(`${ids.length} ${label} record(s) ${verb}.`);
      }
    } finally {
      this.mutating.set(false);
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
    return row.BprUUID ?? null;
  }

  private emptyToNull(value: unknown) {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private currentFilters(): BillingSystemFilters {
    return {
      search: this.searchInput(),
      priceProductUUID: this.priceProductFilter(),
      status: this.statusFilter(),
      subscriptionStatus: this.subscriptionStatusFilter(),
    };
  }

  private emptyProductForm(): ProductFormModel {
    return {
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
      publicSortOrder: null,
      sortOrder: null,
      status: 1,
    };
  }

  private emptyPriceForm(): PriceFormModel {
    return {
      productUUID: this.defaultPriceProductUUID?.() ?? '',
      name: '',
      currency: this.defaultCurrency?.() ?? '',
      billingMode: 'MONTHLY',
      unitCode: 'UNIT',
      unitPrice: 0,
      setupAmount: 0,
      includedQuantity: 0,
      minimumCommitment: 0,
      configJson: '',
      status: 1,
    };
  }

  private emptyPackageForm(): PackageFormModel {
    const productUUID = this.defaultPriceProductUUID?.() ?? '';
    return {
      code: 'package.',
      name: '',
      description: '',
      productUUID,
      isPublic: 0,
      sortOrder: 1000,
      status: 1,
      itemProductUUID: productUUID,
      itemEntitlementCode: '',
      itemIncludedQuantity: 1,
      itemRequired: 1,
      itemConfigJson: '',
    };
  }

  private emptyPromotionForm(): PromotionFormModel {
    return {
      code: 'promo.',
      name: '',
      description: '',
      currency: this.defaultCurrency?.() ?? '',
      requiresCoupon: 0,
      maxRedemptions: null,
      maxRedemptionsPerTenant: null,
      stackingPolicy: 'EXCLUSIVE',
      eligibilityJson: '',
      isPublic: 0,
      startsAt: '',
      endsAt: '',
      status: 1,
      ruleProductUUID: this.defaultPriceProductUUID?.() ?? '',
      rulePriceUUID: '',
      discountType: 'PERCENT',
      appliesTo: 'ALL',
      discountValue: 0,
      cycles: null,
      couponCode: '',
      couponMaxUses: null,
      couponMaxUsesPerTenant: null,
      couponExpiresAt: '',
    };
  }

  private emptyCreditForm(): CreditFormModel {
    return {
      tenantSearch: '',
      environmentUUID: '',
      amount: 0,
      currency: this.defaultCurrency?.() ?? '',
      reason: '',
      reference: '',
      idempotencyKey:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '',
    };
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
      code: row?.BpaCode ?? row?.BpmCode ?? row?.BprCode,
      name: row?.BprName ?? row?.BpcName,
      module: row?.BprModule,
      scope: row?.BprBillingScope,
      entitlement: row?.BprEntitlementPattern,
      resourceType: row?.BprResourceType,
      public: row?.BpaIsPublic ?? row?.BpmIsPublic ?? row?.BprIsPublic,
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
      currency: row?.BpmCurrency,
      coupon: row?.BpmRequiresCoupon,
      rules: row?.RuleCount,
      items: row?.ItemCount,
      period: row?.BpmStartsAt ?? row?.BpmEndsAt,
    };
    const value = productColumns[column] ?? row?.[column] ?? '';
    return String(value).toLowerCase();
  }

  private datetimeLocalValue(value: string | null | undefined) {
    if (!value) return '';
    return value.replace(' ', 'T').slice(0, 16);
  }
}
