import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingPackage, BillingService } from '../../shared/billing.service';
import {
  BILLING_STATUS_OPTIONS,
  BillingLookupState,
  YES_NO_OPTIONS,
  cleanPayload,
  numberOrNull,
} from '../../shared/billing-crud';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';

const PACKAGE_PAYLOAD_KEYS = [
  'code',
  'name',
  'description',
  'productUUID',
  'isPublic',
  'sortOrder',
  'status',
] as const;

const PACKAGE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/packages',
  uuidField: 'BpaUUID',
  pageTitle: 'Billing packages',
  pageDescription: 'Bundle products and entitlements into one commercial offer.',
  createTitle: 'New billing package',
  editTitle: 'Edit billing package',
  dialogDescription: 'Maintain package identity and initial included product.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No billing packages found.',
  deleteTitle: 'Delete billing package',
  deleteMessage: 'Delete this billing package?',
  deleteSelectedTitle: 'Delete selected billing packages',
  deleteSelectedMessage: 'Delete {count} selected billing packages?',
  savedMessage: 'Billing package saved successfully.',
  deletedMessage: 'Billing package deleted successfully.',
  deleteFailedMessage: 'Failed to delete billing package.',
  bulkDelete: false,
  serverSidePagination: true,
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    code: 'package.',
    name: '',
    description: '',
    productUUID: '',
    isPublic: 0,
    sortOrder: 1000,
    itemProductUUID: '',
    itemEntitlementCode: '',
    itemIncludedQuantity: 1,
    itemRequired: 1,
    itemConfig: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BpaName', uuidField: 'BpaUUID' },
    { id: 'code', label: 'Code', field: 'BpaCode' },
    {
      id: 'product',
      label: 'Product',
      kind: 'related',
      uuidField: 'BillingProductBprUUID',
      lookupKey: 'productUUID',
    },
    { id: 'items', label: 'Items', field: 'ItemCount' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpaStatus', className: 'status-col' },
  ],
  relatedCollections: [
    {
      key: 'packageItems',
      label: 'Items',
      emptyLabel: 'No package items yet.',
      addLabel: 'Add',
      savedMessage: 'Billing package item saved successfully.',
      deletedMessage: 'Billing package item deleted successfully.',
      endpoint: (packageUUID) => `system/billing/packages/${packageUUID}/items?limit=200`,
      deleteEndpoint: (_packageUUID, row) => `system/billing/package-items/${row['BkiUUID']}`,
      uuidField: 'BkiUUID',
      initialValues: {
        itemProductUUID: '',
        itemEntitlementCode: '',
        itemIncludedQuantity: 1,
        itemRequired: 1,
      },
      fields: [
        {
          key: 'itemProductUUID',
          payloadKey: 'productUUID',
          label: 'Product',
          type: 'search-select',
          quickCreate: quickCreateFor('BillingProductBprUUID'),
          required: true,
          span: 2,
        },
        {
          key: 'itemEntitlementCode',
          payloadKey: 'entitlementCode',
          label: 'Entitlement',
          span: 2,
        },
        {
          key: 'itemIncludedQuantity',
          payloadKey: 'includedQuantity',
          label: 'Included quantity',
          type: 'number',
          span: 1,
        },
        {
          key: 'itemRequired',
          payloadKey: 'required',
          label: 'Required',
          type: 'select',
          options: YES_NO_OPTIONS,
          span: 1,
        },
      ],
      columns: [
        {
          id: 'product',
          label: 'Product',
          kind: 'related',
          field: 'BillingProductBprUUID',
          lookupKey: 'itemProductUUID',
        },
        { id: 'entitlement', label: 'Entitlement', field: 'BkiEntitlementCode' },
        {
          id: 'quantity',
          label: 'Included quantity',
          kind: 'number',
          field: 'BkiIncludedQuantity',
        },
        { id: 'status', label: 'Status', kind: 'status', field: 'BkiStatus' },
      ],
      payload: (values) => ({
        productUUID: values['itemProductUUID'],
        entitlementCode: values['itemEntitlementCode'] || null,
        includedQuantity: numberOrNull(values['itemIncludedQuantity']) ?? 1,
        required: Number(values['itemRequired'] ?? 1),
        status: 1,
      }),
    },
  ],
  fields: [
    { key: 'status', source: 'BpaStatus', payloadKey: 'status', label: 'Status', type: 'status' },
    {
      key: 'code',
      source: 'BpaCode',
      payloadKey: 'code',
      label: 'Code',
      required: true,
      span: 1,
    },
    {
      key: 'productUUID',
      source: 'BillingProductBprUUID',
      payloadKey: 'productUUID',
      label: 'Product',
      type: 'search-select',
      required: true,
      span: 2,
    },
    {
      key: 'name',
      source: 'BpaName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 2,
    },
    {
      key: 'isPublic',
      source: 'BpaIsPublic',
      payloadKey: 'isPublic',
      label: 'Public',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'sortOrder',
      source: 'BpaSortOrder',
      payloadKey: 'sortOrder',
      label: 'Sort order',
      type: 'number',
      span: 1,
    },
    {
      key: 'itemProductUUID',
      payloadKey: 'itemProductUUID',
      label: 'Initial item product',
      type: 'search-select',
      quickCreate: quickCreateFor('BillingProductBprUUID'),
      requiredWhen: ({ editing }) => !editing,
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 2,
    },
    {
      key: 'itemEntitlementCode',
      payloadKey: 'itemEntitlementCode',
      label: 'Initial item entitlement',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 2,
    },
    {
      key: 'itemIncludedQuantity',
      payloadKey: 'itemIncludedQuantity',
      label: 'Included quantity',
      type: 'number',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'itemRequired',
      payloadKey: 'itemRequired',
      label: 'Required',
      type: 'select',
      options: YES_NO_OPTIONS,
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'description',
      source: 'BpaDescription',
      payloadKey: 'description',
      label: 'Description',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
    {
      key: 'itemConfig',
      payloadKey: 'itemConfig',
      label: 'Initial item config JSON',
      type: 'textarea',
      format: 'json',
      hiddenWhen: ({ editing }) => editing,
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-billing-system-packages',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingSystemPackagesPage extends ConfigurableCrudPageBase<
  BillingPackage & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);
  private readonly lookups = new BillingLookupState(this.billing);

  constructor() {
    super(PACKAGE_CONFIG);
    void this.lookups.load();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'productUUID' || key === 'itemProductUUID') return this.lookups.productOptions();
    return [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    if (key === 'productUUID' || key === 'itemProductUUID') return this.lookups.productLabel(value);
    return super.lookupLabel(key, value);
  }

  /** The optional initial item is created by the API in the same transaction as the package. */
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = cleanPayload(payload, PACKAGE_PAYLOAD_KEYS);
    next['sortOrder'] = numberOrNull(next['sortOrder']) ?? 1000;
    if (!this.editingRecord() && payload['itemProductUUID']) {
      next['initialItem'] = {
        productUUID: payload['itemProductUUID'],
        entitlementCode: payload['itemEntitlementCode'] || null,
        includedQuantity: numberOrNull(payload['itemIncludedQuantity']) ?? 1,
        required: Number(payload['itemRequired'] ?? 1),
        config: payload['itemConfig'] || null,
      };
    }
    return next;
  }
}
