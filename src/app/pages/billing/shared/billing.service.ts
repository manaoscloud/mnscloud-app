import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export interface BillingProduct {
  BprUUID: string;
  BpdUUID?: string | null;
  BprCode: string;
  BprName: string;
  BprModule: string;
  BprBillingScope: 'SERVICE' | 'MODULE';
  BprDescription?: string | null;
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
  BsuResourceType?: string | null;
  BsuResourceUUID?: string | null;
  BsuResourceLabel?: string | null;
  BsuDateCreated?: string | null;
  EnvironmentUUID?: string | null;
  EnvironmentName?: string | null;
  BprCode?: string | null;
  BprName?: string | null;
  BpcName?: string | null;
}

export type BillingCatalogItem = BillingProduct & Omit<BillingPrice, 'BprCode' | 'BprName'>;

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
