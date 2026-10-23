import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { logSelectFilter, READ_ONLY_LOG_CRUD } from '../platform-provider-crud';
import { LOOKUP_TYPE_OPTIONS, lookupTypeLabel } from '../lookup-providers/lookup-providers';

const OUTCOME_OPTIONS = [
  { value: 'success', label: 'Found' },
  { value: 'not_found', label: 'Not found' },
  { value: 'error', label: 'Error' },
  { value: 'rejected', label: 'Refused' },
];

const SOURCE_OPTIONS = [
  { value: 'provider', label: 'Active provider' },
  { value: 'failover', label: 'Failover provider' },
  { value: 'cache', label: 'Cache' },
  { value: 'none', label: 'Not called' },
];

/** Billing of a found lookup (master product module.lookup.<type>). */
const BILLING_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'master', label: 'Platform (not billed)' },
  { value: 'repeat', label: 'Repeated (not billed)' },
  { value: 'included', label: 'Monthly allowance' },
  { value: 'charged', label: 'Charged' },
  { value: 'failed', label: 'Not paid' },
];

/** Read-only lookup log (the CEP/CNPJ/CPF itself is never stored). */
const config = defineCrud({
  endpoint: 'system/lookups/usage',
  uuidField: 'DataLookupUsageLogUUID',
  pageTitle: 'Lookup usage',
  pageDescription:
    'Every CEP, CNPJ, state registration and CPF lookup: tenant, user, provider, source and result. The looked-up value is never stored.',
  searchPlaceholder: 'Tenant, screen, provider or error',
  emptyLabel: 'No lookups recorded.',
  ...READ_ONLY_LOG_CRUD,
  listFilters: [
    logSelectFilter('type', 'Lookup type', LOOKUP_TYPE_OPTIONS),
    logSelectFilter('outcome', 'Result', OUTCOME_OPTIONS),
  ],
  columns: [
    { id: 'date', field: 'DateCreated', label: 'Date', kind: 'datetime' },
    {
      id: 'type',
      field: 'TypeCode',
      label: 'Lookup type',
      kind: 'identity',
      value: (row, translate) => translate(lookupTypeLabel(row['TypeCode'])),
      detail: (row) => String(row['Feature'] ?? ''),
    },
    {
      id: 'tenant',
      field: 'TenantName',
      label: 'Tenant',
      value: (row, translate) => String(row['TenantName'] ?? '') || translate('Platform'),
      detail: (row) => String(row['ActorName'] ?? ''),
    },
    {
      id: 'provider',
      field: 'ProviderName',
      label: 'Provider',
      kind: 'related',
      value: (row) => String(row['ProviderName'] ?? row['ProviderKind'] ?? '') || '-',
    },
    {
      id: 'source',
      field: 'ServedFrom',
      label: 'Answered by',
      value: (row, translate) =>
        translate(
          SOURCE_OPTIONS.find((option) => option.value === row['ServedFrom'])?.label ??
            String(row['ServedFrom'] ?? ''),
        ),
    },
    { id: 'latency', field: 'LatencyMs', label: 'Latency (ms)', kind: 'number', optional: true },
    {
      id: 'billing',
      field: 'BillingStatus',
      label: 'Billing',
      value: (row, translate) =>
        translate(
          BILLING_OPTIONS.find((option) => option.value === row['BillingStatus'])?.label ?? '-',
        ),
    },
    {
      id: 'amount',
      field: 'BilledAmount',
      label: 'Amount',
      kind: 'currency',
      currencyField: 'Currency',
      maximumFractionDigits: 4,
    },
    {
      id: 'outcome',
      field: 'Outcome',
      label: 'Result',
      kind: 'status',
      options: OUTCOME_OPTIONS,
      translateValue: true,
      chipClass: (value) =>
        value === 'success'
          ? 'chip-success'
          : value === 'not_found'
            ? 'chip-skipped'
            : value === 'rejected'
              ? 'chip-warning'
              : 'chip-failed',
      detail: (row) => String(row['ErrorCode'] ?? ''),
    },
  ],
  fields: [],
});

@Component({
  selector: 'app-lookup-usage',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LookupUsagePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
