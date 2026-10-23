import type {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import type { ApiService } from '../../services/api.service';
import type { SnackbarService } from '../../services/snackbar.service';

/**
 * Pieces shared by the platform provider pages of Settings (AI providers, lookup providers) and
 * their read-only usage logs: connection health columns, the status/name fields, the read-only
 * log flags and the Test connection action.
 */
export const PROVIDER_HEALTH_OPTIONS = [
  { value: 'unknown', label: 'Not tested' },
  { value: 'healthy', label: 'Connected' },
  { value: 'failed', label: 'Connection failed' },
];

/** Connection status, failure reason, last test and record status columns. */
export function providerHealthColumns(): ConfigurableCrudColumn[] {
  return [
    {
      id: 'health',
      field: 'LastHealthStatus',
      label: 'Connection',
      kind: 'status',
      options: PROVIDER_HEALTH_OPTIONS,
      translateValue: true,
      chipClass: (value) =>
        value === 'healthy' ? 'chip-success' : value === 'failed' ? 'chip-failed' : 'chip-skipped',
    },
    {
      // Status chips show no detail line: the provider reason of the last failed test lives here.
      id: 'reason',
      field: 'LastHealthError',
      label: 'Failure reason',
      width: 'xl',
      value: (row) => String(row['LastHealthError'] ?? '') || '-',
    },
    { id: 'tested', field: 'LastHealthAt', label: 'Last test', kind: 'datetime', optional: true },
    { id: 'status', field: 'Status', label: 'Status', kind: 'status', className: 'status-col' },
  ];
}

/** Status and name fields that open every provider form. */
export function providerStatusNameFields(): ConfigurableCrudField[] {
  return [
    {
      key: 'status',
      source: 'Status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 1 },
  ];
}

/** Flags of a read-only, server-paginated log page (no create, edit, delete or status filter). */
export const READ_ONLY_LOG_CRUD = {
  bulkDelete: false,
  serverSidePagination: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  statusFilter: false,
  initialValues: {},
} as const;

/** A select filter of a log page with an `All` option first. */
export function logSelectFilter(
  key: string,
  label: string,
  options: readonly ConfigurableCrudOption[],
): ConfigurableCrudListFilter {
  return {
    key,
    paramKey: key,
    label,
    type: 'search-select',
    span: 1,
    options: [{ value: '', label: 'All' }, ...options],
    translateOptions: true,
  };
}

type ConnectionTestResult = {
  Healthy?: number;
  LatencyMs?: number | null;
  Error?: string | null;
  Suggestion?: string | null;
};

/** Test connection: shows the provider reason (and what to do) right away. */
export async function runProviderConnectionTest(
  host: {
    api: ApiService;
    snack: SnackbarService;
    t: (key: string, params?: Record<string, string | number>) => string;
  },
  endpoint: string,
): Promise<void> {
  const response = await host.api.post<{ data?: ConnectionTestResult }>(endpoint, {});
  const result = response.data;
  if (Number(result?.Healthy) === 1) {
    host.snack.success(host.t('Connection OK ({{ ms }} ms).', { ms: result?.LatencyMs ?? 0 }));
    return;
  }
  const suggestion = result?.Suggestion ? ` ${host.t(result.Suggestion)}` : '';
  host.snack.error(`${host.t('Connection failed')}: ${result?.Error ?? ''}.${suggestion}`, 15000);
}
