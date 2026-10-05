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
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';

const PACKAGE_PAYLOAD_KEYS = [
  'code',
  'name',
  'notes',
  'publicSlug',
  'publicName',
  'publicSummary',
  'publicDescription',
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
    notes: '',
    publicSlug: '',
    publicName: '',
    publicSummary: '',
    publicDescription: '',
    isPublic: 0,
    sortOrder: 1000,
    itemProductUUID: '',
    itemEntitlementCode: '',
    itemIncludedQuantity: 1,
    itemRequired: 1,
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BpaName', uuidField: 'BpaUUID' },
    { id: 'code', label: 'Code', field: 'BpaCode' },
    { id: 'items', label: 'Items', field: 'ItemCount' },
    { id: 'subscribers', label: 'Subscribers', kind: 'number', field: 'SubscriptionCount' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpaStatus', className: 'status-col' },
  ],
  rowActions: [
    {
      key: 'migrateSubscribers',
      label: 'Migrate subscribers',
      icon: 'move_down',
      tooltip: 'Move selected subscriptions to another active package.',
      visible: (row) => Number(row['SubscriptionCount'] ?? 0) > 0,
      form: (row) =>
        defineCrud({
          endpoint: `system/billing/packages/${row['BpaUUID']}/migrate-subscriptions`,
          uuidField: 'BpaUUID',
          pageTitle: 'Migrate subscribers',
          createTitle: 'Migrate subscribers',
          dialogDescription:
            'Choose the subscribers that accepted the change and the package that receives them. The target price applies from the next cycle.',
          canEdit: false,
          canDelete: false,
          bulkDelete: false,
          columns: [],
          initialValues: { subscriptionUUIDs: [], targetPackageUUID: '', targetPriceUUID: '' },
          fields: [
            {
              key: 'subscriptionUUIDs',
              payloadKey: 'subscriptionUUIDs',
              label: 'Subscribers',
              type: 'search-select',
              multiple: true,
              required: true,
              remoteLookup: {
                endpoint: `system/billing/packages/${row['BpaUUID']}/subscriptions`,
                uuidField: 'BsuUUID',
                labelField: 'TenantLabel',
              },
              quickCreate: false,
              quickCreateExemptReason:
                'Only existing live subscriptions of this package can be migrated.',
              help: 'Subscribers that accepted the change. Only the selected subscriptions move; the others stay on this package.',
              span: 2,
            },
            {
              key: 'targetPackageUUID',
              payloadKey: 'targetPackageUUID',
              label: 'Target package',
              type: 'search-select',
              required: true,
              remoteLookup: {
                endpoint: 'system/billing/packages?status=1',
                uuidField: 'BpaUUID',
                labelField: 'BpaName',
              },
              quickCreate: quickCreateFor('BillingPackageBpaUUID'),
              help: 'Active package that receives the selected subscriptions. Choose its target price for the next billing cycle.',
              span: 2,
            },
            {
              key: 'targetPriceUUID',
              payloadKey: 'targetPriceUUID',
              label: 'Target price',
              type: 'search-select',
              required: true,
              span: 1,
              remoteLookup: {
                endpoint: 'system/billing/prices?status=1',
                uuidField: 'BpcUUID',
                labelField: 'OfferPriceLabel',
                parameters: { packageUUID: 'targetPackageUUID' },
              },
              quickCreate: quickCreateFor('BillingPriceBpcUUID'),
              help: 'Price and composition are fixed when the change is scheduled. The current paid period stays unchanged; setup is waived for the replacement.',
            },
          ],
          savedMessage: 'Package changes scheduled.',
        }),
    },
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
          help: 'Product included in the package.',
          span: 1,
        },
        {
          key: 'itemEntitlementCode',
          payloadKey: 'entitlementCode',
          label: 'Item entitlement',
          span: 1,
          help: 'What this item releases to subscribers. Leave empty to use the product own entitlement, or enter an exact code (module.voip.pabx.account) or a wildcard (module.isp.*) to release a specific scope.',
        },
        {
          key: 'itemIncludedQuantity',
          payloadKey: 'includedQuantity',
          label: 'Included quantity',
          type: 'number',
          help: 'Quantity included by this item: -1 is unlimited; a positive number sets the package limit.',
          span: 1,
        },
        {
          key: 'itemRequired',
          payloadKey: 'required',
          label: 'Required',
          type: 'select',
          options: YES_NO_OPTIONS,
          help: 'Marks the item as a mandatory part of the offer. Informational only: the entitlement is granted either way.',
          span: 1,
        },
      ],
      columns: [
        { id: 'product', label: 'Product', field: 'BprName' },
        { id: 'entitlement', label: 'Item entitlement', field: 'BkiEntitlementCode' },
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
    // Record row 1: Status, Code, Name
    {
      key: 'status',
      source: 'BpaStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      help: 'Only active packages can receive new subscriptions or be chosen as a migration target. Deactivating a package does not cancel its current subscriptions.',
      span: 1,
    },
    {
      key: 'code',
      source: 'BpaCode',
      payloadKey: 'code',
      label: 'Code',
      required: true,
      help: 'Permanent unique identifier of the package, for example package.erp.starter. The API, audit logs and integrations use it; avoid changing it after the package is in use.',
      span: 1,
    },
    {
      key: 'name',
      source: 'BpaName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      help: 'Commercial name of the package shown to operators and tenants.',
      span: 2,
    },
    // Record row 2: Public, Sort order, Public slug
    {
      key: 'isPublic',
      source: 'BpaIsPublic',
      payloadKey: 'isPublic',
      label: 'Public',
      type: 'select',
      options: YES_NO_OPTIONS,
      help: 'Publish this package on the public internet website/catalogs. Unchecked packages are still available to authenticated tenants in the platform catalog.',
      span: 1,
    },
    {
      key: 'sortOrder',
      source: 'BpaSortOrder',
      payloadKey: 'sortOrder',
      label: 'Sort order',
      type: 'number',
      help: 'Position of the package in lists and in the catalog. Lower numbers appear first.',
      span: 1,
    },
    {
      key: 'publicSlug',
      source: 'BpaPublicSlug',
      payloadKey: 'publicSlug',
      label: 'Public slug',
      span: 2,
    },
    // Record row 3: Public name, Public summary
    {
      key: 'publicName',
      source: 'BpaPublicName',
      payloadKey: 'publicName',
      label: 'Public name',
      span: 2,
    },
    {
      key: 'publicSummary',
      source: 'BpaPublicSummary',
      payloadKey: 'publicSummary',
      label: 'Public summary',
      span: 2,
    },
    // Financial (create only): the first package item, created in the same transaction.
    {
      key: 'itemProductUUID',
      payloadKey: 'itemProductUUID',
      label: 'Initial item product',
      type: 'search-select',
      quickCreate: quickCreateFor('BillingProductBprUUID'),
      requiredWhen: ({ editing }) => !editing,
      hiddenWhen: ({ editing }) => editing,
      help: 'First product included in the package, created together with it. Add more items later in the package Items list.',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'itemEntitlementCode',
      payloadKey: 'itemEntitlementCode',
      label: 'Initial item entitlement',
      hiddenWhen: ({ editing }) => editing,
      help: 'What this item releases to subscribers. Leave empty to use the product own entitlement, or enter an exact code (module.voip.pabx.account) or a wildcard (module.isp.*) to release a specific scope.',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'itemIncludedQuantity',
      payloadKey: 'itemIncludedQuantity',
      label: 'Included quantity',
      type: 'number',
      hiddenWhen: ({ editing }) => editing,
      help: 'Quantity included by this item: -1 is unlimited; a positive number sets the package limit.',
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
      help: 'Marks the item as a mandatory part of the offer. Informational only: the entitlement is granted either way.',
      tab: 'financial',
      span: 1,
    },
    // Notes & Public Description:
    {
      key: 'publicDescription',
      source: 'BpaPublicDescription',
      payloadKey: 'publicDescription',
      label: 'Public description',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
    {
      key: 'notes',
      source: 'BpaNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      help: 'Internal annotations about the package, visible only to the platform team.',
      tab: 'notes',
      span: 4,
      rows: 3,
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
    if (key === 'itemProductUUID') return this.lookups.productOptions();
    return [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    if (key === 'itemProductUUID') return this.lookups.productLabel(value);
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
      };
    }
    return next;
  }
}
