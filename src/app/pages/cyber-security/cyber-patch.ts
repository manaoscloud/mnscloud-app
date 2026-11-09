import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import type {
  DataViewerDialogData,
  DataViewerSection,
} from '../../shared/data-viewer-dialog/data-viewer-dialog';

/**
 * Cyber Security patch management (V6): servers with managed patching (weekly window and reboot
 * policy, contracted per server), patch runs requested from findings, approved or rejected, run by
 * the Agent inside the window. Nothing is patched without an approval.
 */

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const weekDayOptions: ConfigurableCrudOption[] = WEEK_DAYS.map((day) => ({
  value: day,
  label: `cyberSecurity.patch.day.${day}`,
}));

export const rebootOptions: ConfigurableCrudOption[] = [
  { value: 'if_required', label: 'cyberSecurity.patch.reboot.if_required' },
  { value: 'never', label: 'cyberSecurity.patch.reboot.never' },
  { value: 'always', label: 'cyberSecurity.patch.reboot.always' },
];

export const runStates = [
  'requested',
  'approved',
  'running',
  'success',
  'partial',
  'nothing',
  'failed',
  'rejected',
  'cancelled',
] as const;

export const runStateOptions: ConfigurableCrudOption[] = runStates.map((state) => ({
  value: state,
  label: `cyberSecurity.patch.state.${state}`,
}));

export function runStateTone(value: unknown) {
  switch (String(value ?? '')) {
    case 'success':
      return 'chip-success';
    case 'requested':
    case 'approved':
      return 'chip-queued';
    case 'running':
      return 'chip-running';
    case 'partial':
    case 'nothing':
      return 'chip-warning';
    case 'failed':
      return 'chip-failed';
    default:
      return 'chip-skipped';
  }
}

const runsEndpoint = 'cyber-security/patch/runs';
const runEndpoint = (row: ConfigurableCrudRecord, action: string) =>
  `${runsEndpoint}/${encodeURIComponent(String(row['runUUID']))}/${action}`;

/** "Mon, Wed · 02:00 · 3 h" from the policy row; empty when managed patching is off. */
export function windowLabel(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  if (!row['enabled']) return '';
  const days = Array.isArray(row['windowDays']) ? (row['windowDays'] as string[]) : [];
  const dayText =
    days.length === 7
      ? t('cyberSecurity.patch.everyDay')
      : days.map((day) => t(`cyberSecurity.patch.dayShort.${day}`)).join(', ');
  const minutes = Number(row['windowMinutes'] ?? 0);
  const duration = minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
  return [dayText, String(row['windowStart'] ?? ''), duration].filter(Boolean).join(' · ');
}

/** Body of the policy form: the checkbox list of days, the policy revision and enabled = true. */
export function policyPayload(values: ConfigurableCrudRecord, row: ConfigurableCrudRecord) {
  const days = Array.isArray(values['windowDays'])
    ? values['windowDays']
    : String(values['windowDays'] ?? '')
        .split(',')
        .filter(Boolean);
  return {
    enabled: true,
    windowDays: days,
    windowStart: String(values['windowStart'] ?? '').slice(0, 5),
    windowMinutes: Number(values['windowMinutes']),
    rebootPolicy: values['rebootPolicy'],
    revision: row['enabled'] ? (row['revision'] ?? null) : null,
  };
}

/** Turn on or edit managed patching of one server (POST saves; first enable contracts the unit). */
export function patchPolicyForm(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const enabled = Boolean(row['enabled']);
  return defineCrud({
    endpoint: `cyber-security/patch/servers/${encodeURIComponent(String(row['agentUUID']))}`,
    uuidField: 'agentUUID',
    pageTitle: 'cyberSecurity.patch.policy',
    pageDescription: enabled
      ? 'cyberSecurity.patch.policyDescription'
      : 'cyberSecurity.patch.enableDescription',
    createTitle: enabled ? 'cyberSecurity.patch.policy' : 'cyberSecurity.patch.enable',
    savedMessage: 'cyberSecurity.patch.policySaved',
    statusFilter: false,
    initialValues: {
      windowDays: enabled ? row['windowDays'] : ['sat', 'sun'],
      windowStart: enabled ? row['windowStart'] : '02:00',
      windowMinutes: enabled ? row['windowMinutes'] : 180,
      rebootPolicy: enabled ? row['rebootPolicy'] : 'if_required',
    },
    payload: (values) => policyPayload(values, row),
    columns: [],
    fields: [
      {
        key: 'windowDays',
        label: 'cyberSecurity.patch.windowDays',
        type: 'checkbox-group',
        options: weekDayOptions,
        required: true,
        span: 4,
        help: 'cyberSecurity.patch.windowDaysHelp',
      },
      {
        key: 'windowStart',
        label: 'cyberSecurity.patch.windowStart',
        type: 'time',
        required: true,
        span: 1,
        help: 'cyberSecurity.patch.windowStartHelp',
      },
      {
        key: 'windowMinutes',
        label: 'cyberSecurity.patch.windowMinutes',
        type: 'number',
        required: true,
        span: 1,
        positive: true,
        help: 'cyberSecurity.patch.windowMinutesHelp',
      },
      {
        key: 'rebootPolicy',
        label: 'cyberSecurity.patch.rebootPolicy',
        type: 'select',
        options: rebootOptions,
        required: true,
        span: 1,
        help: 'cyberSecurity.patch.rebootPolicyHelp',
      },
    ],
  });
}

const decision = (
  key: string,
  icon: string,
  action: 'approve' | 'reject' | 'cancel',
  states: string[],
  body: Record<string, unknown> = {},
): ConfigurableCrudRowAction => ({
  key,
  label: `cyberSecurity.patch.${key}`,
  icon,
  visible: (row) => states.includes(String(row['state'])),
  request: {
    method: 'post',
    endpoint: (row) => runEndpoint(row, action),
    body: () => body,
    successMessage: `cyberSecurity.patch.${key}Done`,
    confirm: {
      title: `cyberSecurity.patch.${key}`,
      message: `cyberSecurity.patch.${key}Confirm`,
      confirmLabel: `cyberSecurity.patch.${key}`,
    },
  },
});

/** Patch runs, newest first; of one server when the row is given. */
export function patchRunsCollection(
  showRun: (run: ConfigurableCrudRecord) => void,
  server?: ConfigurableCrudRecord,
): ConfigurableCrudConfig {
  const agent = server ? `?agentUUID=${encodeURIComponent(String(server['agentUUID']))}` : '';
  return defineCrud({
    endpoint: `${runsEndpoint}${agent}`,
    uuidField: 'runUUID',
    pageTitle: server
      ? String(server['agentName'] ?? server['agentUUID'])
      : 'cyberSecurity.patch.runs',
    pageDescription: 'cyberSecurity.patch.runsDescription',
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: [
      {
        id: 'created',
        label: 'cyberSecurity.patch.requestedAt',
        field: 'createdAt',
        uuidField: 'runUUID',
        kind: 'datetime',
      },
      { id: 'agent', label: 'Agent', field: 'agentName', translateValue: false },
      {
        id: 'state',
        label: 'Status',
        field: 'state',
        kind: 'status',
        options: runStateOptions,
        chipClass: runStateTone,
      },
      {
        id: 'findings',
        label: 'cyberSecurity.patch.findings',
        field: 'findingCount',
        kind: 'number',
      },
      {
        id: 'fixed',
        label: 'cyberSecurity.patch.fixedFindings',
        field: 'fixedFindings',
        kind: 'number',
      },
      {
        id: 'reboot',
        label: 'cyberSecurity.patch.rebootPolicy',
        field: 'rebootPolicy',
        kind: 'status',
        options: rebootOptions,
      },
      {
        id: 'requestedBy',
        label: 'cyberSecurity.patch.requestedBy',
        field: 'requestedBy',
        translateValue: false,
      },
      {
        id: 'decidedBy',
        label: 'cyberSecurity.patch.decidedBy',
        field: 'decidedBy',
        translateValue: false,
      },
      {
        id: 'finished',
        label: 'cyberSecurity.patch.finishedAt',
        field: 'finishedAt',
        kind: 'datetime',
      },
    ],
    rowActions: [
      {
        key: 'runDetail',
        label: 'cyberSecurity.patch.detail',
        icon: 'receipt_long',
        inline: true,
        run: (row) => showRun(row),
      },
      decision('approve', 'task_alt', 'approve', ['requested']),
      decision('approveNow', 'bolt', 'approve', ['requested'], { immediate: true }),
      decision('reject', 'block', 'reject', ['requested']),
      decision('cancel', 'cancel', 'cancel', ['requested', 'approved']),
    ],
  });
}

/** Server row actions of the patch page. */
export function patchServerActions(
  showRun: (run: ConfigurableCrudRecord) => void = () => undefined,
): ConfigurableCrudRowAction[] {
  return [
    {
      key: 'patchRuns',
      label: 'cyberSecurity.patch.runs',
      icon: 'history',
      inline: true,
      visible: (row) => Boolean(row['enabled']) || Boolean(row['lastRunStatus']),
      collection: (row) => patchRunsCollection(showRun, row),
    },
    {
      key: 'patchEnable',
      label: 'cyberSecurity.patch.enable',
      icon: 'system_update_alt',
      visible: (row) => !row['enabled'],
      disabledReason: (row) => (row['patchSupported'] ? null : 'cyberSecurity.patch.agentOutdated'),
      form: (row) => patchPolicyForm(row),
    },
    {
      key: 'patchPolicy',
      label: 'cyberSecurity.patch.policy',
      icon: 'schedule',
      visible: (row) => Boolean(row['enabled']),
      form: (row) => patchPolicyForm(row),
    },
    {
      key: 'patchRequest',
      label: 'cyberSecurity.patch.request',
      icon: 'healing',
      visible: (row) =>
        Boolean(row['enabled']) &&
        (row['packageManager'] === 'windows' || Number(row['openFixable'] ?? 0) > 0),
      request: {
        method: 'post',
        endpoint: () => runsEndpoint,
        body: (row) => ({ agentUUID: row['agentUUID'] }),
        successMessage: 'cyberSecurity.patch.requested',
        confirm: {
          title: 'cyberSecurity.patch.request',
          message: 'cyberSecurity.patch.requestConfirm',
          confirmLabel: 'cyberSecurity.patch.request',
        },
      },
    },
    {
      key: 'patchDisable',
      label: 'cyberSecurity.patch.disable',
      icon: 'cancel',
      visible: (row) => Boolean(row['enabled']),
      request: {
        method: 'post',
        endpoint: (row) =>
          `cyber-security/patch/servers/${encodeURIComponent(String(row['agentUUID']))}`,
        body: (row) => ({ enabled: false, revision: row['revision'] }),
        successMessage: 'cyberSecurity.patch.disabled',
        confirm: {
          title: 'cyberSecurity.patch.disable',
          message: 'cyberSecurity.patch.disableConfirm',
          confirmLabel: 'cyberSecurity.patch.disable',
        },
      },
    },
  ];
}

/** "Fix" on a finding: requests a patch run of that finding (it still needs an approval). */
export const findingPatchAction: ConfigurableCrudRowAction = {
  key: 'patchFix',
  label: 'cyberSecurity.patch.fix',
  icon: 'healing',
  visible: (finding) =>
    finding['status'] === 'open' &&
    finding['fixState'] === 'fixed' &&
    Boolean(finding['agentUUID']),
  request: {
    method: 'post',
    endpoint: () => runsEndpoint,
    body: (finding) => ({
      agentUUID: finding['agentUUID'],
      findingUUIDs: [finding['findingUUID']],
    }),
    successMessage: 'cyberSecurity.patch.requested',
    confirm: {
      title: 'cyberSecurity.patch.fix',
      message: 'cyberSecurity.patch.fixConfirm',
      confirmLabel: 'cyberSecurity.patch.fix',
    },
  },
};

/** Detail of one run: states, packages and the Agent result (data viewer). */
export function runView(
  run: ConfigurableCrudRecord,
  t: (key: string) => string,
): DataViewerDialogData {
  const result = (run['result'] ?? null) as Record<string, unknown> | null;
  const updated = Array.isArray(result?.['updated'])
    ? (result!['updated'] as Record<string, unknown>[])
    : [];
  const windows = (result?.['windows'] ?? null) as Record<string, unknown> | null;
  const installed = Array.isArray(windows?.['installed'])
    ? (windows!['installed'] as Record<string, unknown>[])
    : [];
  const sections: DataViewerSection[] = [
    {
      title: t('cyberSecurity.patch.summary'),
      message: [
        `${t('Status')}: ${t(`cyberSecurity.patch.state.${run['state']}`)}`,
        `${t('cyberSecurity.patch.fixedFindings')}: ${run['fixedFindings'] ?? 0} / ${run['findingCount'] ?? 0}`,
        `${t('cyberSecurity.patch.rebootPolicy')}: ${t(`cyberSecurity.patch.reboot.${run['rebootPolicy']}`)}`,
        result
          ? `${t('cyberSecurity.patch.rebootScheduled')}: ${result['rebootScheduled'] ? t('Yes') : t('No')}`
          : '',
        run['errorMessage'] ? `${t('cyberSecurity.patch.error')}: ${run['errorMessage']}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
  const packages = Array.isArray(run['packages']) ? (run['packages'] as string[]) : [];
  if (updated.length) {
    sections.push({
      title: t('cyberSecurity.patch.updated'),
      table: {
        columns: [
          { key: 'name', label: t('cyberSecurity.vuln.package') },
          { key: 'from', label: t('cyberSecurity.patch.from') },
          { key: 'to', label: t('cyberSecurity.patch.to') },
        ],
        rows: updated.map((item) => ({
          name: item['name'],
          from: item['from'] ?? '',
          to: item['to'] ?? '',
        })),
      },
    });
  } else if (installed.length) {
    sections.push({
      title: t('cyberSecurity.patch.updated'),
      table: {
        columns: [
          { key: 'kb', label: t('cyberSecurity.patch.kb') },
          { key: 'title', label: t('cyberSecurity.patch.updateTitle') },
        ],
        rows: installed.map((item) => ({ kb: item['kb'], title: item['title'] })),
      },
    });
  } else if (packages.length) {
    sections.push({ title: t('cyberSecurity.vuln.packages'), message: packages.join(', ') });
  }
  const output = typeof result?.['output'] === 'string' ? (result!['output'] as string) : '';
  if (output) sections.push({ title: t('cyberSecurity.patch.output'), code: { value: output } });
  return {
    title: t('cyberSecurity.patch.detail'),
    description: String(run['agentName'] ?? ''),
    sections,
  };
}
