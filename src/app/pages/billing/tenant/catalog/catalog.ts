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
  rowActions: [{ key: 'subscribe', label: 'Subscribe', icon: 'add_shopping_cart' }],
  ...BILLING_STRING_STATUS_OPTIONS,
  activeStatusValues: ['AVAILABLE', 'ACTIVE', 'PENDING_CANCEL'] as const,
  statusOptions: [
    { value: 'AVAILABLE', label: 'Available' },
    ...BILLING_STRING_STATUS_OPTIONS.statusOptions,
  ],
  initialValues: {},
  columns: [
    { id: 'product', label: 'Product', kind: 'identity', field: 'BprName', uuidField: 'BprUUID' },
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
})
export class BillingTenantCatalogPage extends ConfigurableCrudPageBase<
  BillingCatalogItem & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);

  constructor() {
    super(CATALOG_CONFIG);
  }

  override rowActions(
    row: BillingCatalogItem & ConfigurableCrudRecord,
  ): readonly ConfigurableCrudRowAction[] {
    return row.BprBillingScope === 'MODULE' && row.SubscriptionStatus === 'AVAILABLE'
      ? (CATALOG_CONFIG.rowActions ?? [])
      : [];
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: BillingCatalogItem & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'subscribe') return;

    const confirmed = await this.confirmAction(
      'Subscribe',
      'Subscribe to this product?',
      'Subscribe',
    );
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.billing.createSubscription({ priceUUID: this.recordUUID(row) });
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
