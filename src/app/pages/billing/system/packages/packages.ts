import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingPackage, BillingService } from '../../shared/billing.service';
import {
  BILLING_STATUS_OPTIONS,
  BillingLookupState,
  YES_NO_OPTIONS,
  cleanPayload,
  numberOrNull,
} from '../../shared/billing-crud';

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
})
export class BillingSystemPackagesPage extends ConfigurableCrudPageBase<
  BillingPackage & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);
  private readonly lookups = new BillingLookupState(this.billing);
  private pendingInitialItem: ConfigurableCrudRecord | null = null;

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

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    this.pendingInitialItem = {
      itemProductUUID: payload['itemProductUUID'],
      itemEntitlementCode: payload['itemEntitlementCode'],
      itemIncludedQuantity: payload['itemIncludedQuantity'],
      itemRequired: payload['itemRequired'],
      itemConfig: payload['itemConfig'],
    };
    const next = cleanPayload(payload, PACKAGE_PAYLOAD_KEYS);
    next['sortOrder'] = numberOrNull(next['sortOrder']) ?? 1000;
    return next;
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<BillingPackage & ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const response = context.response as { data?: { item?: BillingPackage } };
    const packageUUID = response?.data?.item?.BpaUUID;
    const values = this.pendingInitialItem ?? {};
    this.pendingInitialItem = null;
    if (!packageUUID || !values['itemProductUUID']) return;
    await this.billing.createPackageItem(packageUUID, {
      productUUID: values['itemProductUUID'],
      entitlementCode: values['itemEntitlementCode'] || null,
      includedQuantity: numberOrNull(values['itemIncludedQuantity']) ?? 1,
      required: Number(values['itemRequired'] ?? 1),
      config: values['itemConfig'] || null,
      status: 1,
    });
    this.refreshList();
  }
}
