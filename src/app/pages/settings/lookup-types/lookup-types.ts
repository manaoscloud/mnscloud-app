import { Component, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { lookupTypeLabel } from '../lookup-providers/lookup-providers';

export const LOOKUP_AVAILABILITY_OPTIONS = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'showcase', label: 'Locked (available in production)' },
  { value: 'hidden', label: 'Hidden' },
];

export type ProviderRow = {
  DataLookupProviderUUID: string;
  Name: string;
  KindLabel?: string;
  Types?: string[];
};

/** Providers loaded once by the page; the selects show only the ones that answer the type. */
const providers = signal<ProviderRow[]>([]);

export function setLookupTypeProviders(rows: ProviderRow[]): void {
  providers.set(rows);
}

export function providerOptions(type: unknown, exclude: unknown): ConfigurableCrudOption[] {
  return providers()
    .filter((row) => (row.Types ?? []).includes(String(type ?? '')))
    .filter((row) => row.DataLookupProviderUUID !== exclude)
    .map((row) => ({
      value: row.DataLookupProviderUUID,
      label: row.Name,
      description: row.KindLabel ?? '',
    }));
}

/** Seconds of the API shown as minutes in the form. */
const minutes = (value: unknown) => Math.round(Number(value ?? 0) / 60);

export function durationLabel(seconds: unknown): string {
  const value = Number(seconds ?? 0);
  if (!value) return '-';
  if (value % 86400 === 0) return `${value / 86400} d`;
  if (value % 3600 === 0) return `${value / 3600} h`;
  return `${Math.round(value / 60)} min`;
}

const config = defineCrud({
  endpoint: 'system/lookups/types',
  uuidField: 'Code',
  pageTitle: 'Lookup types',
  pageDescription:
    'The one active provider of each lookup (CEP, CNPJ, state registration, CPF), its failover, availability, cache and limits.',
  editTitle: 'Edit lookup type',
  dialogDescription:
    'Choosing another active provider replaces the current one: each lookup type has only one active provider.',
  searchPlaceholder: 'Lookup type',
  emptyLabel: 'No lookup types found.',
  savedMessage: 'Lookup type saved successfully.',
  bulkDelete: false,
  canCreate: false,
  canDelete: false,
  statusFilter: false,
  initialValues: {},
  columns: [
    {
      id: 'type',
      field: 'Code',
      label: 'Lookup type',
      kind: 'identity',
      value: (row, translate) => translate(lookupTypeLabel(row['Code'])),
      detail: (row, translate) =>
        Number(row['Paid']) === 1 ? translate('Billed per query') : translate('Free source'),
    },
    {
      id: 'active',
      field: 'ActiveProviderName',
      label: 'Active provider',
      kind: 'related',
      value: (row) => String(row['ActiveProviderName'] ?? '') || '-',
    },
    {
      id: 'failover',
      field: 'FailoverProviderName',
      label: 'Failover provider',
      value: (row) => String(row['FailoverProviderName'] ?? '') || '-',
    },
    {
      id: 'availability',
      field: 'Availability',
      label: 'Availability',
      kind: 'status',
      options: LOOKUP_AVAILABILITY_OPTIONS,
      translateValue: true,
      chipClass: (value) =>
        value === 'enabled'
          ? 'chip-success'
          : value === 'showcase'
            ? 'chip-warning'
            : 'chip-skipped',
    },
    { id: 'lookups', field: 'Lookups24h', label: 'Lookups (24 h)', kind: 'number' },
    { id: 'errors', field: 'Errors24h', label: 'Errors (24 h)', kind: 'number' },
    {
      id: 'cache',
      field: 'CacheTtlSeconds',
      label: 'Cache',
      value: (row) => durationLabel(row['CacheTtlSeconds']),
      optional: true,
    },
    {
      // Price per query of the master product module.lookup.<type>; empty = free lookup.
      id: 'price',
      field: 'UnitPrice',
      label: 'Price per query',
      kind: 'currency',
      currencyField: 'Currency',
      maximumFractionDigits: 4,
    },
    {
      id: 'included',
      field: 'IncludedQuantity',
      label: 'Monthly allowance',
      kind: 'number',
      optional: true,
    },
    {
      id: 'limit',
      field: 'TenantLimitPerMinute',
      label: 'Limit per tenant (min)',
      kind: 'number',
      optional: true,
    },
  ],
  fields: [
    {
      key: 'code',
      source: 'Code',
      label: 'Lookup type',
      type: 'search-select',
      options: [
        { value: 'postal_code', label: 'Postal code (CEP)' },
        { value: 'company', label: 'Company (CNPJ)' },
        { value: 'company_realtime', label: 'Company in real time (CNPJ)' },
        { value: 'state_registration', label: 'State registration (IE)' },
        { value: 'person', label: 'Person (CPF)' },
      ],
      translateOptions: true,
      disabledWhen: () => true,
      help: 'Lookups of the platform are fixed; each one has its own answer format.',
      span: 1,
    },
    {
      key: 'availability',
      source: 'Availability',
      payloadKey: 'availability',
      label: 'Availability',
      type: 'search-select',
      options: LOOKUP_AVAILABILITY_OPTIONS,
      translateOptions: true,
      required: true,
      help: 'Enabled needs an active provider. Locked shows the button as available in production only (use it in DEV for paid lookups).',
      span: 1,
    },
    {
      key: 'activeProviderUUID',
      source: 'ActiveDataLookupProviderDlpUUID',
      payloadKey: 'activeProviderUUID',
      quickCreate: false,
      quickCreateExemptReason:
        'A provider needs its integration fields and a connection test: register it in Lookup providers.',
      label: 'Active provider',
      type: 'search-select',
      optionsWhen: ({ values }) => providerOptions(values['code'], null),
      requiredWhen: ({ values }) => values['availability'] === 'enabled',
      help: 'Providers that answer this lookup. Register them in Lookup providers.',
      span: 1,
    },
    {
      key: 'failoverProviderUUID',
      source: 'FailoverDataLookupProviderDlpUUID',
      payloadKey: 'failoverProviderUUID',
      quickCreate: false,
      quickCreateExemptReason:
        'A provider needs its integration fields and a connection test: register it in Lookup providers.',
      label: 'Failover provider',
      type: 'search-select',
      optionsWhen: ({ values }) => providerOptions(values['code'], values['activeProviderUUID']),
      help: 'Optional. Used only when the active provider fails or does not answer in time.',
      span: 1,
    },
    {
      key: 'cacheTtlMinutes',
      source: 'CacheTtlSeconds',
      fromRecord: minutes,
      label: 'Cache of found answers (minutes)',
      type: 'number',
      help: 'Repeated lookups inside this time are answered without calling the provider. 0 disables the cache.',
      span: 1,
    },
    {
      key: 'negativeCacheTtlMinutes',
      source: 'NegativeCacheTtlSeconds',
      fromRecord: minutes,
      label: 'Cache of not found (minutes)',
      type: 'number',
      help: 'How long a not found answer is reused. 0 disables it.',
      span: 1,
    },
    {
      key: 'tenantLimitPerMinute',
      source: 'TenantLimitPerMinute',
      payloadKey: 'tenantLimitPerMinute',
      label: 'Limit per tenant (per minute)',
      type: 'number',
      required: true,
      help: 'Lookups per minute of one tenant (1 to 10000). Free sources limit by IP for every tenant together.',
      span: 1,
    },
    {
      key: 'userLimitPerMinute',
      source: 'UserLimitPerMinute',
      payloadKey: 'userLimitPerMinute',
      label: 'Limit per user (per minute)',
      type: 'number',
      required: true,
      help: 'Lookups per minute of one user (1 to 10000). Blocks automated scraping.',
      span: 1,
    },
  ],
  payload: (values) => ({
    availability: values['availability'],
    activeProviderUUID: values['activeProviderUUID'] || null,
    failoverProviderUUID: values['failoverProviderUUID'] || null,
    cacheTtlSeconds: Math.max(Number(values['cacheTtlMinutes'] || 0), 0) * 60,
    negativeCacheTtlSeconds: Math.max(Number(values['negativeCacheTtlMinutes'] || 0), 0) * 60,
    tenantLimitPerMinute: Number(values['tenantLimitPerMinute'] || 1),
    userLimitPerMinute: Number(values['userLimitPerMinute'] || 1),
  }),
});

@Component({
  selector: 'app-lookup-types',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LookupTypesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    void this.loadProviders();
  }

  async loadProviders(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: ProviderRow[] } }>(
        'system/lookups/providers?limit=500&status=1',
        { silent: true },
      );
      setLookupTypeProviders(response.data?.items ?? []);
    } catch {
      setLookupTypeProviders([]);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return { ...payload, expectedRevision: this.editingRecord()?.['Revision'] };
  }
}
