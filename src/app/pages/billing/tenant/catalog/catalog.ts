import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingCatalogItem } from '../../shared/billing.service';
import { BILLING_STATUS_OPTIONS } from '../../shared/billing-crud';

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
  ...BILLING_STATUS_OPTIONS,
  initialValues: {},
  columns: [
    { id: 'product', label: 'Product', kind: 'identity', field: 'BprName', uuidField: 'BprUUID' },
    { id: 'price', label: 'Price', field: 'BpcName' },
    { id: 'mode', label: 'Billing mode', field: 'BpcBillingMode' },
    { id: 'currency', label: 'Currency', field: 'BpcCurrency' },
    { id: 'unitPrice', label: 'Unit price', field: 'BpcUnitPrice' },
    { id: 'promotion', label: 'Promotion', field: 'PromotionName' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpcStatus', className: 'status-col' },
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
  constructor() {
    super(CATALOG_CONFIG);
  }
}
