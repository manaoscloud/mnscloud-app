import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
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

function priceConfig(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const PRICE_PAYLOAD_KEYS = [
  'productUUID',
  'packageUUID',
  'name',
  'currency',
  'billingMode',
  'unitCode',
  'unitPrice',
  'setupAmount',
  'minimumCommitment',
  'config',
  'status',
] as const;

const PRICE_CURRENCY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'BRL', label: 'BRL - Brazilian real' },
  { value: 'USD', label: 'USD - US dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Pound sterling' },
  { value: 'CAD', label: 'CAD - Canadian dollar' },
  { value: 'AUD', label: 'AUD - Australian dollar' },
  { value: 'MXN', label: 'MXN - Mexican peso' },
  { value: 'CLP', label: 'CLP - Chilean peso' },
  { value: 'COP', label: 'COP - Colombian peso' },
  { value: 'ARS', label: 'ARS - Argentine peso' },
];

const PRICE_UNIT_CODE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'UNIT', label: 'Unit' },
  { value: 'USER', label: 'User' },
  { value: 'SEAT', label: 'Seat' },
  { value: 'LICENSE', label: 'License' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'INSTANCE', label: 'Instance' },
  { value: 'NODE', label: 'Node' },
  { value: 'SERVER', label: 'Server' },
  { value: 'DEVICE', label: 'Device' },
  { value: 'DOMAIN', label: 'Domain' },
  { value: 'DID', label: 'DID' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'EXTENSION', label: 'Extension' },
  { value: 'TRUNK', label: 'Trunk' },
  { value: 'MINUTE', label: 'Minute' },
  { value: 'HOUR', label: 'Hour' },
  { value: 'MONTH', label: 'Month' },
  { value: 'GB', label: 'GB' },
  { value: 'TB', label: 'TB' },
  { value: 'REQUEST', label: 'Request' },
  { value: 'MESSAGE', label: 'Message' },
  { value: 'TRANSACTION', label: 'Transaction' },
];

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
  serverSidePagination: true,
  tabLabels: {
    financial: 'Pricing',
  },
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    offerType: 'PRODUCT',
    productUUID: '',
    packageUUID: '',
    name: '',
    currency: 'BRL',
    billingMode: 'MONTHLY',
    unitCode: 'UNIT',
    unitPrice: 0,
    setupAmount: 0,
    minimumCommitment: 0,
    config: '',
    priceAudience: 'all',
    allowedTenantUUIDs: [],
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BpcName', uuidField: 'BpcUUID' },
    { id: 'offer', label: 'Offer', field: 'OfferName' },
    {
      id: 'offerType',
      label: 'Offer type',
      field: 'OfferType',
      value: (row, t) => t(row['OfferType'] === 'PACKAGE' ? 'Package' : 'Product'),
    },
    { id: 'mode', label: 'Billing mode', field: 'BpcBillingMode', options: BILLING_MODE_OPTIONS },
    { id: 'currency', label: 'Currency', field: 'BpcCurrency' },
    { id: 'unitPrice', label: 'Unit price', field: 'BpcUnitPrice' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpcStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'BpcStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      tab: 'record',
      span: 1,
    },
    {
      key: 'offerType',
      source: 'OfferType',
      label: 'Offer type',
      type: 'select',
      options: [
        { value: 'PRODUCT', label: 'Product' },
        { value: 'PACKAGE', label: 'Package' },
      ],
      required: true,
      disabledWhen: ({ editing }) => editing,
      span: 1,
    },
    {
      key: 'productUUID',
      source: 'BillingProductBprUUID',
      payloadKey: 'productUUID',
      label: 'Product',
      type: 'search-select',
      hiddenWhen: ({ values }) => values['offerType'] !== 'PRODUCT',
      requiredWhen: ({ values }) => values['offerType'] === 'PRODUCT',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'system/billing/products',
        uuidField: 'BprUUID',
        labelField: 'BprName',
      },
      tab: 'record',
      span: 1,
    },
    {
      key: 'packageUUID',
      source: 'BillingPackageBpaUUID',
      payloadKey: 'packageUUID',
      label: 'Package',
      type: 'search-select',
      hiddenWhen: ({ values }) => values['offerType'] !== 'PACKAGE',
      requiredWhen: ({ values }) => values['offerType'] === 'PACKAGE',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'system/billing/packages',
        uuidField: 'BpaUUID',
        labelField: 'BpaName',
      },
      tab: 'record',
      span: 1,
    },
    {
      key: 'billingMode',
      source: 'BpcBillingMode',
      payloadKey: 'billingMode',
      label: 'Billing mode',
      type: 'select',
      options: BILLING_MODE_OPTIONS,
      required: true,
      tab: 'record',
      span: 1,
    },
    {
      key: 'name',
      source: 'BpcName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      tab: 'record',
      span: 1,
    },
    {
      key: 'unitCode',
      source: 'BpcUnitCode',
      payloadKey: 'unitCode',
      label: 'Unit code',
      type: 'select',
      options: PRICE_UNIT_CODE_OPTIONS,
      required: true,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'currency',
      source: 'BpcCurrency',
      payloadKey: 'currency',
      label: 'Currency',
      type: 'select',
      options: PRICE_CURRENCY_OPTIONS,
      required: true,
      tab: 'financial',
      span: 1,
      lineFillAfter: 2,
    },
    {
      key: 'unitPrice',
      source: 'BpcUnitPrice',
      payloadKey: 'unitPrice',
      label: 'Unit price',
      type: 'currency',
      currencyKey: 'currency',
      required: true,
      tab: 'financial',
      breakBefore: true,
      span: 1,
    },
    {
      key: 'setupAmount',
      source: 'BpcSetupAmount',
      payloadKey: 'setupAmount',
      label: 'Setup amount',
      type: 'currency',
      currencyKey: 'currency',
      tab: 'financial',
      span: 1,
    },
    // The cycle charge is max(unit price x quantity, this amount); 0 means no minimum.
    {
      key: 'minimumCommitment',
      source: 'BpcMinimumCommitment',
      payloadKey: 'minimumCommitment',
      label: 'Minimum charge per cycle',
      type: 'currency',
      currencyKey: 'currency',
      help: 'Lowest amount billed each cycle: the charge is the greater of unit price x quantity and this value. Use 0 for no minimum. It is not a loyalty period.',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'priceAudience',
      source: 'BpcConfigJson',
      label: 'billing.priceAudience',
      type: 'select',
      span: 1,
      options: [
        { value: 'all', label: 'billing.allTenants' },
        { value: 'selected', label: 'billing.selectedTenants' },
      ],
      fromRecord: (value) =>
        Object.hasOwn(priceConfig(value), 'allowedTenantUUIDs') ? 'selected' : 'all',
      help: 'billing.priceAudienceHelp',
    },
    {
      key: 'allowedTenantUUIDs',
      source: 'BpcConfigJson',
      label: 'billing.allowedTenants',
      type: 'search-select',
      multiple: true,
      span: 1,
      remoteLookup: {
        endpoint: 'system/billing/tenants',
        uuidField: 'EnvironmentUUID',
        labelField: 'EnvironmentName',
        descriptionField: 'TenantEmail',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Existing tenants only; tenant identities are created through onboarding.',
      hiddenWhen: ({ values }) => values['priceAudience'] !== 'selected',
      fromRecord: (value) => priceConfig(value)['allowedTenantUUIDs'] ?? [],
    },
    {
      key: 'config',
      source: 'BpcConfigJson',
      payloadKey: 'config',
      label: 'Configuration JSON',
      type: 'textarea',
      tab: 'notes',
      format: 'json',
      fromRecord: (value) => {
        const config = { ...priceConfig(value) };
        delete config['allowedTenantUUIDs'];
        return JSON.stringify(config, null, 2);
      },
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
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
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

  override fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    const options = super.fieldOptions(field);
    return field.key === 'billingMode' && this.formValues()['offerType'] === 'PACKAGE'
      ? options.filter((option) =>
          ['MONTHLY', 'MODULE_MONTHLY', 'ONE_TIME'].includes(String(option.value)),
        )
      : options;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'productUUID') return this.lookups.productOptions();
    return [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    if (key === 'productUUID') return this.lookups.productLabel(value);
    return super.lookupLabel(key, value);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const config = payload['config'];
    if (config != null && (typeof config !== 'object' || Array.isArray(config))) {
      return this.rejectField('config', 'Enter a valid JSON object.');
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = cleanPayload(payload, PRICE_PAYLOAD_KEYS);
    const config = { ...priceConfig(next['config']) };
    delete config['allowedTenantUUIDs'];
    if (payload['priceAudience'] === 'selected')
      config['allowedTenantUUIDs'] = payload['allowedTenantUUIDs'] ?? [];
    next['config'] = config;
    if (this.editingRecord()) {
      delete next['productUUID'];
      delete next['packageUUID'];
    } else if (this.formValues()['offerType'] === 'PACKAGE') {
      next['productUUID'] = null;
    } else {
      next['packageUUID'] = null;
    }
    next['currency'] = String(next['currency'] ?? 'BRL').toUpperCase();
    for (const key of ['unitPrice', 'setupAmount', 'minimumCommitment']) {
      next[key] = numberOrNull(next[key]) ?? 0;
    }
    return next;
  }
}
