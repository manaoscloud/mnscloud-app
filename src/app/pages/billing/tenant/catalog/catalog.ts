import { billingComposition } from '../../shared/billing-composition';
import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingCatalogItem, BillingService } from '../../shared/billing.service';
import { BILLING_STRING_STATUS_OPTIONS } from '../../shared/billing-crud';

const CATALOG_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'billing/catalog',
  uuidField: 'BpcUUID',
  pageTitle: 'Billing catalog',
  pageDescription: 'Review products available for this tenant.',
  createTitle: 'New catalog item',
  editTitle: 'Edit catalog item',
  dialogDescription: 'Maintain catalog item.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No catalog products found.',
  deleteTitle: 'Delete catalog item',
  deleteMessage: 'Delete this catalog item?',
  deleteSelectedTitle: 'Delete selected catalog items',
  deleteSelectedMessage: 'Delete {count} selected catalog items?',
  savedMessage: 'Catalog item saved successfully.',
  deletedMessage: 'Catalog item deleted successfully.',
  deleteFailedMessage: 'Failed to delete catalog item.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  serverSidePagination: true,
  rowActions: [
    {
      key: 'composition',
      label: 'Package composition',
      icon: 'list',
      visible: (row) => row['OfferType'] === 'PACKAGE',
      collection: (row) => billingComposition(`billing/catalog/${row['BpcUUID']}/items`, false),
    },
    {
      key: 'subscribe',
      label: 'Subscribe',
      icon: 'add_shopping_cart',
      visible: (row) =>
        row['OfferBillingScope'] === 'MODULE' && row['SubscriptionStatus'] === 'AVAILABLE',
    },
  ],
  ...BILLING_STRING_STATUS_OPTIONS,
  activeStatusValues: ['AVAILABLE', 'ACTIVE', 'PENDING_CANCEL'] as const,
  statusOptions: [
    { value: 'AVAILABLE', label: 'Available' },
    ...BILLING_STRING_STATUS_OPTIONS.statusOptions,
  ],
  initialValues: {},
  columns: [
    { id: 'offer', label: 'Offer', kind: 'identity', field: 'OfferName', uuidField: 'OfferUUID' },
    {
      id: 'offerType',
      label: 'Offer type',
      field: 'OfferType',
      value: (row, t) => t(row['OfferType'] === 'PACKAGE' ? 'Package' : 'Product'),
    },
    {
      id: 'coverage',
      label: 'Coverage',
      field: 'CoverageStatus',
      value: (row, t) =>
        t(row['CoverageStatus'] === 'INCLUDED' ? 'Included in a package' : 'Additional offer'),
    },
    { id: 'plan', label: 'Plan', field: 'BpcName' },
    {
      id: 'price',
      label: 'Price',
      kind: 'currency',
      field: 'BpcUnitPrice',
      currencyField: 'BpcCurrency',
    },
    { id: 'mode', label: 'Billing mode', field: 'BpcBillingMode', translateValue: true },
    { id: 'promotion', label: 'Promotion', field: 'PromotionName' },
    {
      id: 'subscriptionStatus',
      label: 'Subscription status',
      kind: 'status',
      field: 'SubscriptionStatus',
      className: 'status-col',
    },
  ],
  fields: [],
};

@Component({
  selector: 'app-billing-tenant-catalog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingTenantCatalogPage extends ConfigurableCrudPageBase<
  BillingCatalogItem & ConfigurableCrudRecord
> {
  private readonly checkoutKeys = new Map<string, string>();
  private readonly billing = inject(BillingService);

  constructor() {
    super(CATALOG_CONFIG);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: BillingCatalogItem & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'subscribe') return super.handleRowAction(action, row);
    if (this.mutating()) return;

    const confirmed = await this.confirmAction(
      'Subscribe',
      'Subscribe to this offer?',
      'Subscribe',
    );
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const priceUUID = this.recordUUID(row);
      const requestKey = `${localStorage.getItem('mc_current_env')}:${priceUUID}`;
      const idempotencyKey = this.checkoutKeys.get(requestKey) ?? crypto.randomUUID();
      this.checkoutKeys.set(requestKey, idempotencyKey);
      await this.billing.createSubscription({
        priceUUID,
        offerType: row.OfferType,
        offerUUID: row.OfferUUID,
        idempotencyKey,
      });
      this.checkoutKeys.delete(requestKey);
      this.snack.success('Subscription created.');
      this.refreshList();
    } catch {
      // The API interceptor already presents the server-side billing rejection.
      // Do not overwrite it with a generic message here.
    } finally {
      this.mutating.set(false);
    }
  }
}
