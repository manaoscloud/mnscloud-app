import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AppI18nService } from '../../../../services/app-i18n.service';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';
import { cleanPayload, numberOrNull } from '../../shared/billing-crud';

const ADJUSTMENT_ENDPOINT = 'system/billing/price-adjustments';

const ADJUSTMENT_PAYLOAD_KEYS = [
  'priceUUID',
  'name',
  'type',
  'indexCode',
  'percent',
  'newUnitPrice',
  'effectiveAt',
  'noticeDays',
  'minContractMonths',
  'reason',
] as const;

const ADJUSTMENT_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'INDEX', label: 'Inflation index' },
  { value: 'PERCENT', label: 'Percentage' },
  { value: 'NEW_PRICE', label: 'New price' },
];

const ADJUSTMENT_INDEX_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'IPCA', label: 'IPCA' },
  { value: 'IGPM', label: 'IGP-M' },
  { value: 'INPC', label: 'INPC' },
  { value: 'OTHER', label: 'Other index' },
];

/** Indexes with an official BCB SGS series the API can accumulate for the last 12 months. */
const FETCHABLE_INDEXES = new Set(['IPCA', 'IGPM', 'INPC']);

const ADJUSTMENT_STATUS_OPTIONS = {
  statusMode: 'string' as const,
  activeValue: 'ACTIVE',
  inactiveValue: 'CANCELED',
  activeStatusValues: ['SCHEDULED', 'ACTIVE'] as const,
  statusOptions: [
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'CANCELED', label: 'Canceled' },
  ] as const,
};

const typeLabel = (value: unknown, translate: (key: string) => string): string => {
  const option = ADJUSTMENT_TYPE_OPTIONS.find((candidate) => candidate.value === value);
  return option ? translate(option.label) : String(value ?? '');
};

const adjustmentTerms = (row: ConfigurableCrudRecord): string => {
  if (row['BpjType'] === 'NEW_PRICE') return String(row['BpjNewUnitPrice'] ?? '');
  const percent = Number(row['BpjPercent'] ?? 0);
  const index = row['BpjType'] === 'INDEX' && row['BpjIndexCode'] ? `${row['BpjIndexCode']} ` : '';
  return `${index}${percent > 0 ? '+' : ''}${percent.toLocaleString(undefined, { maximumFractionDigits: 4 })}%`;
};

const affectedSubscriptions = (row: ConfigurableCrudRecord): ConfigurableCrudConfig =>
  defineCrud({
    endpoint: `${ADJUSTMENT_ENDPOINT}/${row['BpjUUID']}/subscriptions`,
    uuidField: 'BsuUUID',
    pageTitle: 'Affected subscriptions',
    pageDescription:
      'Live monthly subscriptions of this price. Each one changes at its first renewal on or after the effective date.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    searchPlaceholder: 'Search subscribers',
    statusFilter: false,
    emptyLabel: 'No affected subscriptions found.',
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
        id: 'current',
        label: 'Current price',
        kind: 'currency',
        field: 'CurrentUnitPrice',
        currencyField: 'BsuCurrency',
      },
      {
        id: 'new',
        label: 'New price',
        kind: 'currency',
        field: 'NewUnitPrice',
        currencyField: 'BsuCurrency',
      },
      { id: 'appliesAt', label: 'Applies at', kind: 'datetime', field: 'AppliesAt' },
      {
        id: 'eligible',
        label: 'Eligible at first renewal',
        kind: 'boolean',
        field: 'EligibleAtFirstRenewal',
      },
    ],
    fields: [],
  });

const PRICE_ADJUSTMENT_CONFIG: ConfigurableCrudConfig = {
  endpoint: ADJUSTMENT_ENDPOINT,
  uuidField: 'BpjUUID',
  pageTitle: 'Price adjustments',
  pageDescription:
    'Schedule catalog price adjustments with advance tenant notice, applied to existing subscriptions at their next renewal.',
  createTitle: 'New price adjustment',
  editTitle: 'Price adjustment',
  dialogDescription:
    'Increases require the notice period. Existing subscriptions change at their first renewal on or after the effective date.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No price adjustments found.',
  deleteTitle: 'Cancel price adjustment',
  deleteMessage: 'Cancel this price adjustment?',
  deleteSelectedTitle: 'Cancel selected price adjustments',
  deleteSelectedMessage: 'Cancel {count} selected price adjustments?',
  savedMessage: 'Price adjustment scheduled successfully.',
  deletedMessage: 'Price adjustment canceled successfully.',
  deleteFailedMessage: 'Failed to cancel price adjustment.',
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  ...ADJUSTMENT_STATUS_OPTIONS,
  initialValues: {
    priceUUID: '',
    name: '',
    type: 'INDEX',
    indexCode: 'IPCA',
    percent: null,
    newUnitPrice: null,
    effectiveAt: '',
    noticeDays: 30,
    minContractMonths: 12,
    reason: '',
    status: 'SCHEDULED',
  },
  fieldChange: (key, value, current) => {
    if (key !== 'type') return current;
    // Index adjustments follow the annual Brazilian practice; other types apply to any age.
    return { ...current, minContractMonths: value === 'INDEX' ? 12 : 0 };
  },
  rowActions: [
    {
      key: 'subscriptions',
      label: 'Affected subscriptions',
      icon: 'groups',
      tooltip: 'List the subscriptions affected by this adjustment.',
      visible: (row) => row['BpjStatus'] !== 'CANCELED',
      collection: affectedSubscriptions,
    },
    {
      key: 'cancel',
      label: 'Cancel adjustment',
      icon: 'event_busy',
      tooltip: 'Cancel before the effective date; unsent notices are discarded.',
      visible: (row) => row['BpjStatus'] === 'SCHEDULED',
      request: {
        method: 'post',
        endpoint: (row) => `${ADJUSTMENT_ENDPOINT}/${row['BpjUUID']}/cancel`,
        successMessage: 'Price adjustment canceled successfully.',
        confirm: {
          title: 'Cancel price adjustment',
          message:
            'Cancel this scheduled price adjustment? Tenants already notified keep their current price.',
          confirmLabel: 'Cancel adjustment',
        },
      },
    },
  ],
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BpjName', uuidField: 'BpjUUID' },
    { id: 'price', label: 'Price', field: 'OfferPriceLabel' },
    {
      id: 'type',
      label: 'Type',
      field: 'BpjType',
      value: (row, translate) => typeLabel(row['BpjType'], translate),
    },
    { id: 'terms', label: 'Adjustment', field: 'BpjPercent', value: adjustmentTerms },
    {
      id: 'previous',
      label: 'Previous price',
      kind: 'currency',
      field: 'BpjPreviousCatalogUnitPrice',
      currencyField: 'BpcCurrency',
    },
    {
      id: 'newPrice',
      label: 'New price',
      kind: 'currency',
      field: 'BpjNewCatalogUnitPrice',
      currencyField: 'BpcCurrency',
    },
    { id: 'effectiveAt', label: 'Effective at', kind: 'datetime', field: 'BpjEffectiveAt' },
    { id: 'applied', label: 'Applied', kind: 'number', field: 'AppliedCount' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpjStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'priceUUID',
      source: 'BillingPriceBpcUUID',
      payloadKey: 'priceUUID',
      label: 'Price',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'system/billing/prices?status=1',
        uuidField: 'BpcUUID',
        labelField: 'OfferPriceLabel',
      },
      quickCreate: quickCreateFor('BillingPriceBpcUUID'),
      help: 'Monthly recurring product or package price.',
    },
    {
      key: 'name',
      source: 'BpjName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      placeholder: 'Annual adjustment 2027',
    },
    {
      key: 'type',
      source: 'BpjType',
      payloadKey: 'type',
      label: 'Type',
      type: 'select',
      options: ADJUSTMENT_TYPE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'indexCode',
      source: 'BpjIndexCode',
      payloadKey: 'indexCode',
      label: 'Index',
      type: 'select',
      options: ADJUSTMENT_INDEX_OPTIONS,
      hiddenWhen: ({ values }) => values['type'] !== 'INDEX',
      requiredWhen: ({ values }) => values['type'] === 'INDEX',
      span: 1,
      help: 'IPCA, IGP-M and INPC fill the last 12-month accumulated percentage from the Central Bank.',
    },
    {
      key: 'percent',
      source: 'BpjPercent',
      payloadKey: 'percent',
      label: 'Percentage (%)',
      type: 'number',
      hiddenWhen: ({ values }) => values['type'] === 'NEW_PRICE',
      requiredWhen: ({ values }) => values['type'] !== 'NEW_PRICE',
      span: 1,
    },
    {
      key: 'newUnitPrice',
      source: 'BpjNewUnitPrice',
      payloadKey: 'newUnitPrice',
      label: 'New unit price',
      type: 'number',
      hiddenWhen: ({ values }) => values['type'] !== 'NEW_PRICE',
      requiredWhen: ({ values }) => values['type'] === 'NEW_PRICE',
      span: 1,
    },
    {
      key: 'effectiveAt',
      source: 'BpjEffectiveAt',
      payloadKey: 'effectiveAt',
      label: 'Effective at',
      type: 'date',
      required: true,
      span: 1,
      breakBefore: true,
      help: 'Increases need at least the notice period from today.',
    },
    {
      key: 'noticeDays',
      source: 'BpjNoticeDays',
      payloadKey: 'noticeDays',
      label: 'Notice days',
      type: 'number',
      span: 1,
      help: 'Tenants receive an e-mail when scheduled and a reminder 7 days before.',
    },
    {
      key: 'minContractMonths',
      source: 'BpjMinContractMonths',
      payloadKey: 'minContractMonths',
      label: 'Minimum contract months',
      type: 'number',
      span: 1,
      help: 'Subscriptions younger than this (or adjusted more recently) wait for a later renewal.',
    },
    {
      key: 'reason',
      source: 'BpjReason',
      payloadKey: 'reason',
      label: 'Reason shown to tenants',
      type: 'textarea',
      span: 4,
    },
  ],
};

type PreviewRow = { CurrentUnitPrice?: number; NewUnitPrice?: number; BsuCurrency?: string };
type PreviewResponse = { data?: { items?: PreviewRow[]; total?: number } };
type IndexResponse = { data?: { item?: { percent?: number; from?: string; to?: string } } };

@Component({
  selector: 'app-billing-system-price-adjustments',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingSystemPriceAdjustmentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly i18n = inject(AppI18nService);

  constructor() {
    super(PRICE_ADJUSTMENT_CONFIG);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'indexCode' && FETCHABLE_INDEXES.has(String(value))) {
      void this.fillIndexPercent(String(value));
    } else if (key === 'type' && value === 'INDEX') {
      const index = String(this.formValues()['indexCode'] ?? '');
      if (FETCHABLE_INDEXES.has(index)) void this.fillIndexPercent(index);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = cleanPayload(payload, ADJUSTMENT_PAYLOAD_KEYS);
    if (next['type'] !== 'INDEX') next['indexCode'] = null;
    next['percent'] = next['type'] === 'NEW_PRICE' ? null : numberOrNull(next['percent']);
    next['newUnitPrice'] = next['type'] === 'NEW_PRICE' ? numberOrNull(next['newUnitPrice']) : null;
    next['noticeDays'] = numberOrNull(next['noticeDays']) ?? 30;
    next['minContractMonths'] = numberOrNull(next['minContractMonths']) ?? 0;
    next['reason'] = String(next['reason'] ?? '').trim() || null;
    return next;
  }

  protected override async confirmBeforeSave(payload: ConfigurableCrudRecord): Promise<boolean> {
    let preview: PreviewResponse;
    try {
      preview = (await this.api.post(`${ADJUSTMENT_ENDPOINT}/preview`, {
        ...this.augmentPayload(payload),
        limit: 500,
      })) as PreviewResponse;
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
      return false;
    }
    const items = preview.data?.items ?? [];
    const total = Number(preview.data?.total ?? items.length);
    const impact = items.reduce(
      (sum, row) => sum + Number(row.NewUnitPrice ?? 0) - Number(row.CurrentUnitPrice ?? 0),
      0,
    );
    const currency = items[0]?.BsuCurrency ?? 'BRL';
    const amount = new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency,
    }).format(impact);
    return this.confirmAction(
      'Schedule price adjustment',
      this.t(
        '{count} live subscriptions will be affected, changing monthly revenue by {amount}. Tenants are notified by e-mail. Schedule this adjustment?',
        { count: total, amount },
      ),
      'Schedule',
    );
  }

  private async fillIndexPercent(code: string): Promise<void> {
    try {
      const response = (await this.api.get(
        `system/billing/price-indexes/${code}`,
      )) as IndexResponse;
      const percent = response.data?.item?.percent;
      if (percent === undefined || percent === null) return;
      if (this.formValues()['indexCode'] !== code) return;
      this.patchFormValues({ percent: Number(Number(percent).toFixed(4)) });
      this.snack.success(
        this.t('{index} accumulated in 12 months: {percent}%', {
          index: code,
          percent: Number(percent).toFixed(2),
        }),
      );
    } catch {
      this.snack.error(this.t('Could not load the index; type the percentage manually.'));
    }
  }
}
