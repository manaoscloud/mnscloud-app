import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export interface BillingProduct {
  BprUUID: string;
  BpdUUID?: string | null;
  BprCode: string;
  BprName: string;
  BprModule: string;
  BprBillingScope: 'MODULE' | 'RESOURCE' | 'USAGE';
  BprDescription?: string | null;
  BprEntitlementPattern?: string | null;
  BprRequiresEntitlementCode?: string | null;
  BprResourceType?: string | null;
  BprIsPublic?: number | null;
  BprPublicSlug?: string | null;
  BprPublicName?: string | null;
  BprPublicSummary?: string | null;
  BprPublicDescription?: string | null;
  BprPublicFeaturesJson?: string | null;
  BprPublicSortOrder?: number | null;
  BpdSortOrder?: number | null;
  BprStatus: number;
  ActivePrices?: number;
  PriceCount?: number;
}

export interface BillingPrice {
  BpcUUID: string;
  BillingProductBprUUID: string;
  BprCode?: string | null;
  BprName?: string | null;
  BpcName: string;
  BpcCurrency: string;
  BpcBillingMode: string;
  BpcUnitCode: string;
  BpcUnitPrice: number;
  BpcSetupAmount: number;
  BpcIncludedQuantity: number;
  BpcMinimumCommitment: number;
  BpcConfigJson?: string | null;
  BpcStatus: number;
}

export interface BillingPackage {
  BpaUUID: string;
  BpaID: string;
  BpaCode: string;
  BpaName: string;
  BpaDescription?: string | null;
  BillingProductBprUUID: string;
  BprCode?: string | null;
  BprName?: string | null;
  BpaIsPublic: number;
  BpaSortOrder: number;
  BpaStatus: number;
  ItemCount?: number | null;
}

export interface BillingPackageItem {
  BkiUUID: string;
  BkiID: string;
  BillingPackageBpaUUID: string;
  BpaCode?: string | null;
  BpaName?: string | null;
  BillingProductBprUUID: string;
  BprCode?: string | null;
  BprName?: string | null;
  BkiEntitlementCode?: string | null;
  BkiIncludedQuantity: number;
  BkiRequired: number;
  BkiSortOrder: number;
  BkiConfigJson?: string | null;
  BkiStatus: number;
}

export interface BillingPromotion {
  BpmUUID: string;
  BpmID: string;
  BpmCode: string;
  BpmName: string;
  BpmDescription?: string | null;
  BpmCurrency?: string | null;
  BpmRequiresCoupon: number;
  BpmMaxRedemptions?: number | null;
  BpmMaxRedemptionsPerTenant?: number | null;
  BpmStackingPolicy: string;
  BpmEligibilityJson?: string | null;
  BpmIsPublic: number;
  BpmStartsAt?: string | null;
  BpmEndsAt?: string | null;
  BpmStatus: number;
  RuleCount?: number | null;
  CouponCount?: number | null;
}

export interface BillingPromotionRule {
  BrlUUID: string;
  BrlID: string;
  BillingPromotionBpmUUID: string;
  BpmCode?: string | null;
  BpmName?: string | null;
  BillingProductBprUUID?: string | null;
  BprCode?: string | null;
  BprName?: string | null;
  BillingPriceBpcUUID?: string | null;
  BpcName?: string | null;
  BrlDiscountType: string;
  BrlAppliesTo: string;
  BrlDiscountValue: number;
  BrlCycles?: number | null;
  BrlStatus: number;
}

export interface BillingPromotionCoupon {
  BcoUUID: string;
  BcoID: string;
  BillingPromotionBpmUUID: string;
  BpmCode?: string | null;
  BpmName?: string | null;
  BcoCode: string;
  BcoMaxUses?: number | null;
  BcoMaxUsesPerTenant?: number | null;
  BcoExpiresAt?: string | null;
  BcoStatus: number;
}

export interface BillingWallet {
  BwaUUID: string;
  BwaCurrency: string;
  BwaBalance: number;
  BwaReservedBalance: number;
  BwaStatus: number;
}

export interface BillingTenantLookupItem {
  EnvironmentUUID: string;
  EnvironmentName?: string | null;
  TenantEmail?: string | null;
  TenantStatus: number;
  DefaultCurrency?: string | null;
  WalletCount?: number | null;
  WalletSummary?: string | null;
}

export interface BillingLedgerEntry {
  BleUUID: string;
  BleType: string;
  BleDirection: string;
  BleAmount: number;
  BleCurrency: string;
  BleBalanceBefore: number;
  BleBalanceAfter: number;
  BleReference?: string | null;
  BleReason?: string | null;
  BleDateCreated?: string | null;
}

export interface BillingPaymentIntent {
  BpiUUID: string;
  BpiID: string;
  UserUsrUUID: string;
  BpiAmount: number;
  BpiCurrency: string;
  BpiStatus: string;
  BpiProvider?: string | null;
  PaymentProviderAccountPpaUUID?: string | null;
  BpiGatewaySource?: string | null;
  BpiProviderReference?: string | null;
  BpiCheckoutUrl?: string | null;
  BpiReference?: string | null;
  BpiExpiresAt?: string | null;
  BpiDateCreated?: string | null;
}

export interface BillingSubscription {
  BsuUUID: string;
  BsuStatus: string;
  BsuQuantity: number;
  BsuCurrency: string;
  BsuBillingModeSnapshot: string;
  BsuUnitPriceSnapshot: number;
  BsuSetupAmountSnapshot: number;
  BsuReservedAmountSnapshot: number;
  BsuResourceType?: string | null;
  BsuResourceUUID?: string | null;
  BsuResourceLabel?: string | null;
  BsuDateCreated?: string | null;
  EnvironmentUUID?: string | null;
  EnvironmentName?: string | null;
  BprCode?: string | null;
  BprName?: string | null;
  BpcName?: string | null;
  BillingPromotionBpmUUID?: string | null;
  BillingPromotionCouponBcoUUID?: string | null;
  BpmCode?: string | null;
  BpmName?: string | null;
  BsuPromotionCodeSnapshot?: string | null;
  BsuOriginalUnitPriceSnapshot?: number | null;
  BsuOriginalSetupAmountSnapshot?: number | null;
  BsuDiscountTypeSnapshot?: string | null;
  BsuDiscountValueSnapshot?: number | null;
  BsuDiscountCyclesSnapshot?: number | null;
}

export interface BillingEntitlementGrant {
  entitlementCode: string;
  productCode?: string | null;
  module?: string | null;
  billingScope?: string | null;
  resourceType?: string | null;
}

export type BillingCatalogItem = BillingProduct &
  Omit<BillingPrice, 'BprCode' | 'BprName'> & {
    PromotionCode?: string | null;
    PromotionName?: string | null;
    PromotionDiscountType?: string | null;
    PromotionDiscountValue?: number | null;
  };

interface ApiListResponse<T> {
  data?: {
    items?: T[];
    item?: T;
  };
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly api = inject(ApiService);

  async listProducts(search = '', status: number | null = null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status !== null) params.set('status', String(status));
    const response = await this.api.get<ApiListResponse<BillingProduct>>(
      `system/billing/products${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createProductDefinition(payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingProduct>>(
      'system/billing/product-definitions',
      payload,
    );
    return response.data?.item ?? null;
  }

  async updateProductDefinition(uuid: string, payload: Record<string, unknown>) {
    const response = await this.api.put<ApiListResponse<BillingProduct>>(
      `system/billing/product-definitions/${uuid}`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async deleteProductDefinition(uuid: string) {
    await this.api.delete(`system/billing/product-definitions/${uuid}`);
  }

  async listPrices(search = '', productUUID = '', status: number | null = null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (productUUID) params.set('productUUID', productUUID);
    if (status !== null) params.set('status', String(status));
    const response = await this.api.get<ApiListResponse<BillingPrice>>(
      `system/billing/prices${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createPrice(payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingPrice>>(
      'system/billing/prices',
      payload,
    );
    return response.data?.item ?? null;
  }

  async updatePrice(uuid: string, payload: Record<string, unknown>) {
    const response = await this.api.put<ApiListResponse<BillingPrice>>(
      `system/billing/prices/${uuid}`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async deletePrice(uuid: string) {
    await this.api.delete(`system/billing/prices/${uuid}`);
  }

  async listPackages(search = '', status: number | null = null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status !== null) params.set('status', String(status));
    const response = await this.api.get<ApiListResponse<BillingPackage>>(
      `system/billing/packages${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createPackage(payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingPackage>>(
      'system/billing/packages',
      payload,
    );
    return response.data?.item ?? null;
  }

  async updatePackage(uuid: string, payload: Record<string, unknown>) {
    const response = await this.api.put<ApiListResponse<BillingPackage>>(
      `system/billing/packages/${uuid}`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async deletePackage(uuid: string) {
    await this.api.delete(`system/billing/packages/${uuid}`);
  }

  async listPackageItems(packageUUID = '', search = '', status: number | null = null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status !== null) params.set('status', String(status));
    const base = packageUUID
      ? `system/billing/packages/${packageUUID}/items`
      : 'system/billing/package-items';
    const response = await this.api.get<ApiListResponse<BillingPackageItem>>(
      `${base}${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createPackageItem(packageUUID: string, payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingPackageItem>>(
      `system/billing/packages/${packageUUID}/items`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async updatePackageItem(uuid: string, payload: Record<string, unknown>) {
    const response = await this.api.put<ApiListResponse<BillingPackageItem>>(
      `system/billing/package-items/${uuid}`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async deletePackageItem(uuid: string) {
    await this.api.delete(`system/billing/package-items/${uuid}`);
  }

  async listPromotions(search = '', status: number | null = null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status !== null) params.set('status', String(status));
    const response = await this.api.get<ApiListResponse<BillingPromotion>>(
      `system/billing/promotions${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createPromotion(payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingPromotion>>(
      'system/billing/promotions',
      payload,
    );
    return response.data?.item ?? null;
  }

  async updatePromotion(uuid: string, payload: Record<string, unknown>) {
    const response = await this.api.put<ApiListResponse<BillingPromotion>>(
      `system/billing/promotions/${uuid}`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async deletePromotion(uuid: string) {
    await this.api.delete(`system/billing/promotions/${uuid}`);
  }

  async listPromotionRules(promotionUUID = '', search = '', status: number | null = null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status !== null) params.set('status', String(status));
    const base = promotionUUID
      ? `system/billing/promotions/${promotionUUID}/rules`
      : 'system/billing/promotion-rules';
    const response = await this.api.get<ApiListResponse<BillingPromotionRule>>(
      `${base}${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createPromotionRule(promotionUUID: string, payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingPromotionRule>>(
      `system/billing/promotions/${promotionUUID}/rules`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async updatePromotionRule(uuid: string, payload: Record<string, unknown>) {
    const response = await this.api.put<ApiListResponse<BillingPromotionRule>>(
      `system/billing/promotion-rules/${uuid}`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async deletePromotionRule(uuid: string) {
    await this.api.delete(`system/billing/promotion-rules/${uuid}`);
  }

  async listPromotionCoupons(promotionUUID = '', search = '', status: number | null = null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status !== null) params.set('status', String(status));
    const base = promotionUUID
      ? `system/billing/promotions/${promotionUUID}/coupons`
      : 'system/billing/promotion-coupons';
    const response = await this.api.get<ApiListResponse<BillingPromotionCoupon>>(
      `${base}${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createPromotionCoupon(promotionUUID: string, payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingPromotionCoupon>>(
      `system/billing/promotions/${promotionUUID}/coupons`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async updatePromotionCoupon(uuid: string, payload: Record<string, unknown>) {
    const response = await this.api.put<ApiListResponse<BillingPromotionCoupon>>(
      `system/billing/promotion-coupons/${uuid}`,
      payload,
    );
    return response.data?.item ?? null;
  }

  async deletePromotionCoupon(uuid: string) {
    await this.api.delete(`system/billing/promotion-coupons/${uuid}`);
  }

  async manualCredit(payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingLedgerEntry>>(
      'system/billing/wallets/manual-credit',
      payload,
    );
    return response.data?.item ?? null;
  }

  async searchTenants(search = '') {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    const response = await this.api.get<ApiListResponse<BillingTenantLookupItem>>(
      `system/billing/tenants${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async listSystemSubscriptions(search = '', status = '') {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status.trim()) params.set('status', status.trim());
    const response = await this.api.get<ApiListResponse<BillingSubscription>>(
      `system/billing/subscriptions${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async listWallets() {
    const response = await this.api.get<ApiListResponse<BillingWallet>>('billing/wallet');
    return response.data?.items ?? [];
  }

  async listEntitlementGrants() {
    const response = await this.api.get<ApiListResponse<BillingEntitlementGrant>>(
      'billing/entitlements/grants',
    );
    return response.data?.items ?? [];
  }

  async listLedger(search = '', currency = '') {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (currency.trim()) params.set('currency', currency.trim());
    const response = await this.api.get<ApiListResponse<BillingLedgerEntry>>(
      `billing/ledger${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async listTopups(status = '') {
    const params = new URLSearchParams();
    if (status.trim()) params.set('status', status.trim());
    const response = await this.api.get<ApiListResponse<BillingPaymentIntent>>(
      `billing/topups${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createTopup(payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingPaymentIntent>>(
      'billing/topups',
      payload,
    );
    return response.data?.item ?? null;
  }

  async listCatalog(search = '') {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    const response = await this.api.get<ApiListResponse<BillingCatalogItem>>(
      `billing/catalog${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async listSubscriptions(search = '', status = '') {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status.trim()) params.set('status', status.trim());
    const response = await this.api.get<ApiListResponse<BillingSubscription>>(
      `billing/subscriptions${this.query(params)}`,
    );
    return response.data?.items ?? [];
  }

  async createSubscription(payload: Record<string, unknown>) {
    const response = await this.api.post<ApiListResponse<BillingSubscription>>(
      'billing/subscriptions',
      payload,
    );
    return response.data?.item ?? null;
  }

  async cancelSubscription(uuid: string) {
    await this.api.delete(`billing/subscriptions/${uuid}`);
  }

  private query(params: URLSearchParams) {
    const value = params.toString();
    return value ? `?${value}` : '';
  }
}
