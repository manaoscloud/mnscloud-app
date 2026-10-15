import type {
  ConfigurableCrudField,
  ConfigurableCrudFieldContext,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from './configurable-crud/configurable-crud-page-base';

/**
 * Logs tab shared by PABX, Softswitch, SBC and Media servers: detailed engine log on/off,
 * normalized level and node retention. The API stores one contract and each managed runtime
 * translates the level for its engine; engines without a managed runtime keep the tab read-only.
 */
export const SERVER_LOG_LEVEL_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'error', label: 'serverLogs.levelError' },
  { value: 'warning', label: 'serverLogs.levelWarning' },
  { value: 'notice', label: 'serverLogs.levelNotice' },
  { value: 'info', label: 'serverLogs.levelInfo' },
  { value: 'debug', label: 'serverLogs.levelDebug' },
];

const SERVER_LOG_ENABLED_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const LOG_KEYS = ['logEnabled', 'logLevel', 'logRetentionDays'] as const;

export const SERVER_LOG_INITIAL_VALUES = {
  logEnabled: 1,
  logLevel: 'notice',
  logRetentionDays: 7,
} as const;

function managed(values: ConfigurableCrudRecord, engines: readonly string[]): boolean {
  return engines.includes(String(values['engine'] ?? '').toLowerCase());
}

function debugUntil(values: ConfigurableCrudRecord, prefix: string): string {
  const raw = values[`${prefix}LogDebugUntil`];
  if (!raw) return '';
  const date = new Date(
    String(raw).includes('T') ? String(raw) : `${String(raw).replace(' ', 'T')}Z`,
  );
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

/** Fields of the Logs tab (rendered in the shared `diagnostics` slot, relabelled `Logs`). */
export function serverLogFields(
  prefix: string,
  managedEngines: readonly string[],
): ConfigurableCrudField[] {
  const disabledWhen = ({ values }: ConfigurableCrudFieldContext) =>
    !managed(values, managedEngines);
  const notManagedHelp = 'serverLogs.engineNotManaged';
  return [
    {
      key: 'logEnabled',
      source: `${prefix}LogEnabled`,
      payloadKey: 'logEnabled',
      label: 'serverLogs.enabled',
      type: 'select',
      options: SERVER_LOG_ENABLED_OPTIONS,
      tab: 'diagnostics',
      span: 1,
      disabledWhen,
      helpWhen: ({ values }) =>
        managed(values, managedEngines) ? 'serverLogs.enabledHelp' : notManagedHelp,
    },
    {
      key: 'logLevel',
      source: `${prefix}LogLevel`,
      payloadKey: 'logLevel',
      label: 'serverLogs.level',
      type: 'select',
      options: SERVER_LOG_LEVEL_OPTIONS,
      tab: 'diagnostics',
      span: 1,
      required: true,
      disabledWhen,
      helpWhen: ({ values }) => {
        if (!managed(values, managedEngines)) return notManagedHelp;
        if (values['logLevel'] !== 'debug') return 'serverLogs.levelHelp';
        return debugUntil(values, prefix) ? 'serverLogs.debugActiveHelp' : 'serverLogs.debugHelp';
      },
      helpParams: ({ values }) => ({ until: debugUntil(values, prefix) }),
    },
    {
      key: 'logRetentionDays',
      source: `${prefix}LogRetentionDays`,
      payloadKey: 'logRetentionDays',
      label: 'serverLogs.retentionDays',
      type: 'number',
      tab: 'diagnostics',
      span: 1,
      required: true,
      disabledWhen,
      helpWhen: ({ values }) =>
        managed(values, managedEngines) ? 'serverLogs.retentionHelp' : notManagedHelp,
    },
  ];
}

/**
 * Normalizes the Logs tab values. Engines without a managed runtime never send them, so the API
 * keeps the stored defaults and does not reject the save.
 */
export function serverLogPayload(
  payload: ConfigurableCrudRecord,
  managedEngines: readonly string[],
): ConfigurableCrudRecord {
  const next = { ...payload };
  if (!managed(next, managedEngines)) {
    for (const key of LOG_KEYS) delete next[key];
    return next;
  }
  next['logEnabled'] = Number(next['logEnabled'] ?? SERVER_LOG_INITIAL_VALUES.logEnabled) ? 1 : 0;
  next['logLevel'] = String(next['logLevel'] || SERVER_LOG_INITIAL_VALUES.logLevel);
  const days = Number(next['logRetentionDays']);
  next['logRetentionDays'] =
    Number.isFinite(days) && days > 0
      ? Math.trunc(days)
      : SERVER_LOG_INITIAL_VALUES.logRetentionDays;
  return next;
}
