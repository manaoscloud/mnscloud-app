import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingProduct, BillingService } from '../../shared/billing.service';
import {
  BILLING_SCOPE_OPTIONS,
  BILLING_STATUS_OPTIONS,
  BillingLookupState,
  YES_NO_OPTIONS,
  cleanPayload,
  numberOrNull,
} from '../../shared/billing-crud';

const PRODUCT_PAYLOAD_KEYS = [
  'code',
  'name',
  'module',
  'billingScope',
  'description',
  'entitlementPattern',
  'requiresEntitlementCode',
  'resourceType',
  'isPublic',
  'publicSlug',
  'publicName',
  'publicSummary',
  'publicDescription',
  'publicFeatures',
  'publicSortOrder',
  'sortOrder',
  'status',
] as const;

const PRODUCT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/products',
  uuidField: 'BprUUID',
  pageTitle: 'Billing products',
  pageDescription: 'Configure commercial products and entitlement metadata.',
  createTitle: 'New billing product',
  editTitle: 'Edit billing product',
  dialogDescription: 'Maintain the official billing product definition.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No billing products found.',
  deleteTitle: 'Delete billing product',
  deleteMessage: 'Delete this billing product?',
  deleteSelectedTitle: 'Delete selected billing products',
  deleteSelectedMessage: 'Delete {count} selected billing products?',
  savedMessage: 'Billing product saved successfully.',
  deletedMessage: 'Billing product deleted successfully.',
  deleteFailedMessage: 'Failed to delete billing product.',
  bulkDelete: false,
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    code: '',
    name: '',
    module: '',
    billingScope: 'RESOURCE',
    description: '',
    entitlementPattern: '',
    requiresEntitlementCode: '',
    resourceType: '',
    isPublic: 0,
    publicSlug: '',
    publicName: '',
    publicSummary: '',
    publicDescription: '',
    publicFeatures: '',
    publicSortOrder: 1000,
    sortOrder: 1000,
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BprName', uuidField: 'BprUUID' },
    { id: 'code', label: 'Code', field: 'BprCode' },
    { id: 'module', label: 'Module', field: 'BprModule' },
    { id: 'scope', label: 'Billing scope', field: 'BprBillingScope' },
    { id: 'prices', label: 'Prices', field: 'ActivePrices' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BprStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'code',
      source: 'BprCode',
      payloadKey: 'code',
      label: 'Code',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'status', source: 'BprStatus', payloadKey: 'status', label: 'Status', type: 'status' },
    {
      key: 'billingScope',
      source: 'BprBillingScope',
      payloadKey: 'billingScope',
      label: 'Billing scope',
      type: 'select',
      options: BILLING_SCOPE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'module',
      source: 'BprModule',
      payloadKey: 'module',
      label: 'Module',
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'BprName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 2,
    },
    {
      key: 'entitlementPattern',
      source: 'BprEntitlementPattern',
      payloadKey: 'entitlementPattern',
      label: 'Entitlement pattern',
      span: 2,
    },
    {
      key: 'requiresEntitlementCode',
      source: 'BprRequiresEntitlementCode',
      payloadKey: 'requiresEntitlementCode',
      label: 'Requires entitlement',
      span: 1,
    },
    {
      key: 'resourceType',
      source: 'BprResourceType',
      payloadKey: 'resourceType',
      label: 'Resource type',
      span: 1,
    },
    {
      key: 'isPublic',
      source: 'BprIsPublic',
      payloadKey: 'isPublic',
      label: 'Public',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'publicSortOrder',
      source: 'BprPublicSortOrder',
      payloadKey: 'publicSortOrder',
      label: 'Public sort order',
      type: 'number',
      span: 1,
    },
    {
      key: 'sortOrder',
      source: 'BpdSortOrder',
      payloadKey: 'sortOrder',
      label: 'Sort order',
      type: 'number',
      span: 1,
    },
    {
      key: 'publicSlug',
      source: 'BprPublicSlug',
      payloadKey: 'publicSlug',
      label: 'Public slug',
      span: 1,
    },
    {
      key: 'publicName',
      source: 'BprPublicName',
      payloadKey: 'publicName',
      label: 'Public name',
      span: 2,
    },
    {
      key: 'publicSummary',
      source: 'BprPublicSummary',
      payloadKey: 'publicSummary',
      label: 'Public summary',
      span: 2,
    },
    {
      key: 'description',
      source: 'BprDescription',
      payloadKey: 'description',
      label: 'Description',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
    {
      key: 'publicDescription',
      source: 'BprPublicDescription',
      payloadKey: 'publicDescription',
      label: 'Public description',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
    {
      key: 'publicFeatures',
      source: 'BprPublicFeaturesJson',
      payloadKey: 'publicFeatures',
      label: 'Public features JSON',
      type: 'textarea',
      tab: 'notes',
      format: 'json',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-billing-system-products',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
})
export class BillingSystemProductsPage extends ConfigurableCrudPageBase<
  BillingProduct & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);
  private readonly lookups = new BillingLookupState(this.billing);

  constructor() {
    super(PRODUCT_CONFIG);
    void this.lookups.load();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'code') return this.lookups.productDefinitionCodeOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = cleanPayload(payload, PRODUCT_PAYLOAD_KEYS);
    next['publicSortOrder'] = numberOrNull(next['publicSortOrder']);
    next['sortOrder'] = numberOrNull(next['sortOrder']);
    return next;
  }
}
