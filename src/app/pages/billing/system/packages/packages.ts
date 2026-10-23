import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
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

/** "Name (CODE)" of a package row, shown read-only as the migration source. */
export function packageDisplayName(row: ConfigurableCrudRecord): string {
  const name = String(row['BpaName'] ?? '').trim();
  const code = String(row['BpaCode'] ?? '').trim();
  return name && code ? `${name} (${code})` : name || code;
}

export const PACKAGE_CONFIG: ConfigurableCrudConfig = {
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
  tabLabels: { financial: 'Items' },
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
    itemIncludedQuantity: -1,
    itemRequired: 1,
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BpaName', uuidField: 'BpaUUID' },
    { id: 'code', label: 'Code', field: 'BpaCode' },
    { id: 'items', label: 'Items', field: 'ItemCount' },
    {
      id: 'requirements',
      label: 'Missing required modules',
      kind: 'number',
      field: 'UnmetRequirementCount',
    },
    {
      id: 'subscribers',
      label: 'Subscribers',
      kind: 'number',
      field: 'SubscriptionCount',
      rowAction: 'subscribers',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpaStatus', className: 'status-col' },
  ],
  rowActions: [
    {
      key: 'subscribers',
      label: 'Subscribers',
      icon: 'groups',
      tooltip: 'List the current subscribers of this package.',
      visible: (row) => Number(row['SubscriptionCount'] ?? 0) > 0,
      collection: (row) =>
        defineCrud({
          endpoint: `system/billing/packages/${row['BpaUUID']}/subscribers`,
          uuidField: 'BsuUUID',
          pageTitle: 'Package subscribers',
          pageDescription:
            'Current subscriptions of this package and the composition each one holds.',
          canCreate: false,
          canEdit: false,
          canDelete: false,
          bulkDelete: false,
          searchPlaceholder: 'Search subscribers',
          statusFilter: false,
          emptyLabel: 'No subscribers found.',
          initialValues: {},
          columns: [
            {
              id: 'tenant',
              label: 'Tenant',
              kind: 'identity',
              field: 'TenantLabel',
              uuidField: 'BsuUUID',
              detail: (subscription) => String(subscription['TenantEmail'] ?? ''),
            },
            { id: 'status', label: 'Status', field: 'BsuStatus', translateValue: true },
            {
              id: 'price',
              label: 'Contracted price',
              kind: 'currency',
              field: 'BsuUnitPriceSnapshot',
              currencyField: 'BsuCurrency',
            },
            {
              id: 'renewal',
              label: 'Current period end',
              kind: 'datetime',
              field: 'BsuCurrentPeriodEnd',
            },
            { id: 'items', label: 'Items', field: 'ItemNames' },
            {
              id: 'missing',
              label: 'Missing package items',
              kind: 'number',
              field: 'MissingItemCount',
            },
          ],
          fields: [],
        }),
    },
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
          pageDescription:
            'Choose the subscribers that accepted the change and the package that receives them. The target price applies from the next cycle.',
          createTitle: 'Migrate subscribers',
          dialogDescription:
            'Choose the subscribers that accepted the change and the package that receives them. The target price applies from the next cycle.',
          canEdit: false,
          canDelete: false,
          bulkDelete: false,
          columns: [],
          initialValues: {
            subscriptionUUIDs: [],
            sourcePackage: packageDisplayName(row),
            targetPackageUUID: '',
            targetPriceUUID: '',
          },
          payload: ({ sourcePackage: _sourcePackage, ...values }) => values,
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
                descriptionField: 'TenantEmail',
              },
              autoSelectAll: true,
              quickCreate: false,
              quickCreateExemptReason:
                'Only existing live subscriptions of this package can be migrated.',
              help: 'Every live subscription of this package starts selected (up to 200 per migration). Untick the subscribers that stay; reopen the action to migrate the rest.',
              tab: 'record',
              span: 2,
            },
            {
              key: 'sourcePackage',
              label: 'Source package',
              type: 'text',
              disabledWhen: () => true,
              help: 'Current package of the selected subscriptions. Read-only reference for choosing the target package.',
              tab: 'record',
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
                exclude: [String(row['BpaUUID'] ?? '')],
              },
              quickCreate: quickCreateFor('BillingPackageBpaUUID'),
              help: 'Active package that receives the selected subscriptions. Choose its target price for the next billing cycle.',
              tab: 'record',
              span: 2,
              breakBefore: true,
            },
            {
              key: 'targetPriceUUID',
              payloadKey: 'targetPriceUUID',
              label: 'Target price',
              type: 'search-select',
              required: true,
              tab: 'record',
              span: 2,
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
      createTitle: 'New package item',
      editTitle: 'Edit package item',
      savedMessage: 'Billing package item saved successfully.',
      deletedMessage: 'Billing package item deleted successfully.',
      endpoint: (packageUUID) => `system/billing/packages/${packageUUID}/items?limit=200`,
      updateEndpoint: () => 'system/billing/package-items',
      deleteEndpoint: (_packageUUID, row) => `system/billing/package-items/${row['BkiUUID']}`,
      uuidField: 'BkiUUID',
      initialValues: {
        itemProductUUID: '',
        itemEntitlementCode: '',
        itemIncludedQuantity: -1,
        itemRequired: 1,
      },
      fields: [
        {
          key: 'itemProductUUID',
          source: 'BillingProductBprUUID',
          payloadKey: 'productUUID',
          label: 'Product',
          type: 'search-select',
          quickCreate: quickCreateFor('BillingProductBprUUID'),
          required: true,
          help: 'Product included in the package. A product that requires a module (for example DNS requires Hosting) is accepted only when the package also includes that module.',
          span: 1,
        },
        {
          key: 'itemEntitlementCode',
          source: 'BkiEntitlementCode',
          payloadKey: 'entitlementCode',
          label: 'Item entitlement',
          span: 1,
          help: 'What this item releases to subscribers. Leave empty to use the product own entitlement, or enter an exact code (module.voip.pabx.account) or a wildcard (module.isp.*) to release a specific scope.',
        },
        {
          key: 'itemIncludedQuantity',
          source: 'BkiIncludedQuantity',
          payloadKey: 'includedQuantity',
          label: 'Included quantity (-1 = unlimited)',
          type: 'number',
          help: 'How much of this item the package releases: -1 = unlimited (default); a positive number = that limit (for example 10 extensions). 0 is not accepted.',
          span: 1,
        },
        {
          key: 'itemRequired',
          source: 'BkiRequired',
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
          id: 'requires',
          label: 'Required module',
          field: 'BprRequiresEntitlementCode',
          value: (row, t) => {
            const required = String(row['BprRequiresEntitlementCode'] ?? '');
            if (!required) return '-';
            return Number(row['RequirementMet'] ?? 1) === 0
              ? `${required} · ${t('Not included in the package')}`
              : required;
          },
        },
        {
          id: 'quantity',
          label: 'Included quantity',
          kind: 'number',
          field: 'BkiIncludedQuantity',
          value: (row, t) =>
            Number(row['BkiIncludedQuantity']) === -1
              ? t('Unlimited')
              : String(Number(row['BkiIncludedQuantity'] ?? 0)),
        },
        {
          id: 'pending',
          label: 'Subscribers without this item',
          kind: 'number',
          field: 'PendingSubscriptionCount',
        },
        { id: 'status', label: 'Status', kind: 'status', field: 'BkiStatus' },
      ],
      rowActions: [
        {
          key: 'applySubscribers',
          label: 'Apply to current subscribers',
          icon: 'group_add',
          visible: (row) => Number(row['PendingSubscriptionCount'] ?? 0) > 0,
          request: {
            method: 'post',
            endpoint: (row) => `system/billing/package-items/${row['BkiUUID']}/apply-subscriptions`,
            successMessage: 'Package item applied to current subscribers.',
            confirm: {
              title: 'Apply to current subscribers',
              message:
                'Add this item to every current subscriber of the package? Their price and billing cycle do not change.',
              confirmLabel: 'Apply',
            },
          },
        },
      ],
      payload: (values) => ({
        productUUID: values['productUUID'] ?? values['itemProductUUID'],
        entitlementCode: (values['entitlementCode'] ?? values['itemEntitlementCode']) || null,
        includedQuantity:
          numberOrNull(values['includedQuantity'] ?? values['itemIncludedQuantity']) ?? -1,
        required: Number(values['required'] ?? values['itemRequired'] ?? 1),
        status: 1,
      }),
    },
  ],
  fields: [
    // Record: Status, Code, Name on one row
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
    // Public: catalog visibility, name, slug, sort order; summary; description.
    {
      key: 'isPublic',
      source: 'BpaIsPublic',
      payloadKey: 'isPublic',
      label: 'Public',
      type: 'select',
      options: YES_NO_OPTIONS,
      help: 'Publish this package on the public internet website/catalogs. Unchecked packages are still available to authenticated tenants in the platform catalog.',
      tab: 'public',
      span: 1,
    },
    {
      key: 'publicName',
      source: 'BpaPublicName',
      payloadKey: 'publicName',
      label: 'Public name',
      tab: 'public',
      span: 1,
    },
    {
      key: 'publicSlug',
      source: 'BpaPublicSlug',
      payloadKey: 'publicSlug',
      label: 'Public slug',
      tab: 'public',
      span: 1,
    },
    {
      key: 'sortOrder',
      source: 'BpaSortOrder',
      payloadKey: 'sortOrder',
      label: 'Sort order',
      type: 'number',
      help: 'Position of the package in lists and in the catalog. Lower numbers appear first.',
      tab: 'public',
      span: 1,
    },
    {
      key: 'publicSummary',
      source: 'BpaPublicSummary',
      payloadKey: 'publicSummary',
      label: 'Public summary',
      tab: 'public',
      span: 4,
    },
    {
      key: 'publicDescription',
      source: 'BpaPublicDescription',
      payloadKey: 'publicDescription',
      label: 'Public description',
      type: 'textarea',
      tab: 'public',
      span: 4,
      rows: 3,
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
      help: 'First product included in the package, created together with it. Add more items later in the package Items list. A product that requires another module cannot be the first item; add the module first.',
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
      label: 'Included quantity (-1 = unlimited)',
      type: 'number',
      hiddenWhen: ({ editing }) => editing,
      help: 'How much of this item the package releases: -1 = unlimited (default); a positive number = that limit (for example 10 extensions). 0 is not accepted.',
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
    {
      key: 'notes',
      source: 'BpaNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      help: 'Internal annotations about the package, visible only to the platform team.',
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
    if (key === 'itemProductUUID' || key === 'productUUID') return this.lookups.productOptions();
    return [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    if (key === 'itemProductUUID' || key === 'productUUID') return this.lookups.productLabel(value);
    return super.lookupLabel(key, value);
  }

  /** A new item reaches current subscribers only when the master confirms it (prices never change). */
  protected override async afterRelatedCollectionRowAdded(
    collection: ConfigurableCrudRelatedCollection,
    _parentUUID: string,
    created: ConfigurableCrudRecord | null,
  ): Promise<void> {
    if (collection.key !== 'packageItems') return;
    const itemUUID = String(created?.['BkiUUID'] ?? '');
    const pending = Number(created?.['PendingSubscriptionCount'] ?? 0);
    if (!itemUUID || pending <= 0) return;
    const confirmed = await this.confirmAction(
      'Apply to current subscribers',
      this.t(
        'Also add this item to the {{count}} current subscribers of the package? Their price and billing cycle do not change. New subscriptions always include it.',
        { count: pending },
      ),
      'Apply',
    );
    if (!confirmed) return;
    try {
      await this.billing.applyPackageItemToSubscriptions(itemUUID);
      this.snack.success(this.t('Package item applied to current subscribers.'));
      this.reloadRelatedCollection(collection);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  /** The optional initial item is created by the API in the same transaction as the package. */
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = cleanPayload(payload, PACKAGE_PAYLOAD_KEYS);
    next['sortOrder'] = numberOrNull(next['sortOrder']) ?? 1000;
    if (!this.editingRecord() && payload['itemProductUUID']) {
      next['initialItem'] = {
        productUUID: payload['itemProductUUID'],
        entitlementCode: payload['itemEntitlementCode'] || null,
        includedQuantity: numberOrNull(payload['itemIncludedQuantity']) ?? -1,
        required: Number(payload['itemRequired'] ?? 1),
      };
    }
    return next;
  }
}
