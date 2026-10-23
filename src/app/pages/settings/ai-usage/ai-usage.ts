import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { logSelectFilter, READ_ONLY_LOG_CRUD } from '../platform-provider-crud';
import { AI_FEATURE_OPTIONS, aiFeatureLabel } from '../ai-features/ai-features';
import { aiProviderKindLabel } from '../ai-providers/ai-providers';

const OUTCOME_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
];

/** Read-only call log of the platform AI gateway (no prompt or answer text is stored). */
const config = defineCrud({
  endpoint: 'system/ai/usage',
  uuidField: 'AiUsageLogUUID',
  pageTitle: 'AI usage',
  pageDescription:
    'Every call made by an AI feature: tenant, provider, model, tokens and result, to follow cost and failures.',
  searchPlaceholder: 'Model, feature, reference or error',
  emptyLabel: 'No AI calls recorded.',
  ...READ_ONLY_LOG_CRUD,
  listFilters: [
    logSelectFilter('feature', 'Feature', AI_FEATURE_OPTIONS),
    logSelectFilter('outcome', 'Result', OUTCOME_OPTIONS),
  ],
  columns: [
    { id: 'date', field: 'DateCreated', label: 'Date', kind: 'datetime' },
    {
      id: 'feature',
      field: 'Feature',
      label: 'Feature',
      kind: 'identity',
      value: (row, translate) => translate(aiFeatureLabel(row['Feature'])),
      detail: (row) => String(row['Reference'] ?? ''),
    },
    {
      id: 'tenant',
      field: 'TenantName',
      label: 'Tenant',
      value: (row, translate) => String(row['TenantName'] ?? '') || translate('Platform'),
    },
    {
      id: 'provider',
      field: 'ProviderName',
      label: 'Provider',
      kind: 'related',
      detail: (row, translate) => translate(aiProviderKindLabel(row['ProviderKind'])),
    },
    { id: 'model', field: 'Model', label: 'Model' },
    { id: 'input', field: 'InputTokens', label: 'Input tokens', kind: 'number' },
    { id: 'output', field: 'OutputTokens', label: 'Output tokens', kind: 'number' },
    { id: 'latency', field: 'LatencyMs', label: 'Latency (ms)', kind: 'number', optional: true },
    {
      id: 'cached',
      field: 'CacheReadTokens',
      label: 'Cached tokens',
      kind: 'number',
      optional: true,
    },
    {
      // Cost recorded at call time (cache included); empty when the model has no price.
      id: 'cost',
      field: 'EstimatedCostUsd',
      label: 'Estimated cost',
      kind: 'currency',
      currencyCode: 'USD',
      maximumFractionDigits: 6,
    },
    {
      id: 'outcome',
      field: 'Outcome',
      label: 'Result',
      kind: 'status',
      options: OUTCOME_OPTIONS,
      translateValue: true,
      chipClass: (value) => (value === 'success' ? 'chip-success' : 'chip-failed'),
      detail: (row) => String(row['ErrorCode'] ?? ''),
    },
  ],
  fields: [],
});

@Component({
  selector: 'app-ai-usage',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AiUsagePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
