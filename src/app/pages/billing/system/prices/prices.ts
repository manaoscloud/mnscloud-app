import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingPrice, BillingService } from '../../shared/billing.service';
import {
  BILLING_MODE_OPTIONS,
  BILLING_STATUS_OPTIONS,
  BillingLookupState,
  cleanPayload,
  numberOrNull,
} from '../../shared/billing-crud';

const PRICE_PAYLOAD_KEYS = [
  'productUUID',
  'name',
  'currency',
  'billingMode',
  'unitCode',
  'unitPrice',
  'setupAmount',
  'includedQuantity',
  'minimumCommitment',
  'config',
  'status',
] as const;

const PRICE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/prices',
  uuidField: 'BpcUUID',
  pageTitle: 'Billing prices',
  pageDescription: 'Configure billing units, recurrence and commercial values.',
  createTitle: 'New billing price',
  editTitle: 'Edit billing price',
  dialogDescription: 'Maintain product price, currency and billing mode.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No billing prices found.',
  deleteTitle: 'Delete billing price',
  deleteMessage: 'Delete this billing price?',
  deleteSelectedTitle: 'Delete selected billing prices',
  deleteSelectedMessage: 'Delete {count} selected billing prices?',
  savedMessage: 'Billing price saved successfully.',
  deletedMessage: 'Billing price deleted successfully.',
  deleteFailedMessage: 'Failed to delete billing price.',
  bulkDelete: false,
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    productUUID: '',
    name: '',
    currency: 'BRL',
    billingMode: 'MONTHLY',
    unitCode: 'UNIT',
    unitPrice: 0,
    setupAmount: 0,
    includedQuantity: 0,
    minimumCommitment: 0,
    config: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BpcName', uuidField: 'BpcUUID' },
    {
      id: 'product',
      label: 'Product',
      kind: 'related',
      uuidField: 'BillingProductBprUUID',
      lookupKey: 'productUUID',
    },
    { id: 'mode', label: 'Billing mode', field: 'BpcBillingMode' },
    { id: 'currency', label: 'Currency', field: 'BpcCurrency' },
    { id: 'unitPrice', label: 'Unit price', field: 'BpcUnitPrice' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpcStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'productUUID',
      source: 'BillingProductBprUUID',
      payloadKey: 'productUUID',
      label: 'Product',
      type: 'search-select',
      required: true,
      span: 2,
    },
    { key: 'status', source: 'BpcStatus', payloadKey: 'status', label: 'Status', type: 'status' },
    {
      key: 'billingMode',
      source: 'BpcBillingMode',
      payloadKey: 'billingMode',
      label: 'Billing mode',
      type: 'select',
      options: BILLING_MODE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'BpcName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 2,
    },
    {
      key: 'currency',
      source: 'BpcCurrency',
      payloadKey: 'currency',
      label: 'Currency',
      required: true,
      span: 1,
    },
    {
      key: 'unitCode',
      source: 'BpcUnitCode',
      payloadKey: 'unitCode',
      label: 'Unit code',
      required: true,
      span: 1,
    },
    {
      key: 'unitPrice',
      source: 'BpcUnitPrice',
      payloadKey: 'unitPrice',
      label: 'Unit price',
      type: 'number',
      required: true,
      span: 1,
    },
    {
      key: 'setupAmount',
      source: 'BpcSetupAmount',
      payloadKey: 'setupAmount',
      label: 'Setup amount',
      type: 'number',
      span: 1,
    },
    {
      key: 'includedQuantity',
      source: 'BpcIncludedQuantity',
      payloadKey: 'includedQuantity',
      label: 'Included quantity',
      type: 'number',
      span: 1,
    },
    {
      key: 'minimumCommitment',
      source: 'BpcMinimumCommitment',
      payloadKey: 'minimumCommitment',
      label: 'Minimum commitment',
      type: 'number',
      span: 1,
    },
    {
      key: 'config',
      source: 'BpcConfigJson',
      payloadKey: 'config',
      label: 'Configuration JSON',
      type: 'textarea',
      tab: 'notes',
      format: 'json',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-billing-system-prices',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
})
export class BillingSystemPricesPage extends ConfigurableCrudPageBase<
  BillingPrice & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);
  private readonly lookups = new BillingLookupState(this.billing);

  constructor() {
    super(PRICE_CONFIG);
    void this.lookups.load();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'productUUID') return this.lookups.productOptions();
    return [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    if (key === 'productUUID') return this.lookups.productLabel(value);
    return super.lookupLabel(key, value);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = cleanPayload(payload, PRICE_PAYLOAD_KEYS);
    next['currency'] = String(next['currency'] ?? 'BRL').toUpperCase();
    for (const key of ['unitPrice', 'setupAmount', 'includedQuantity', 'minimumCommitment']) {
      next[key] = numberOrNull(next[key]) ?? 0;
    }
    return next;
  }
}
