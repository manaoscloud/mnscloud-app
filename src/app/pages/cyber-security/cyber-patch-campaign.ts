import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilterActionMenu,
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
 * Patch campaigns (emergency patching, E1): one approval for one patch run per server, executed by
 * the platform in waves (canary, waves, parallelism, halt after N failures). Created from a CVE row
 * ("fix on every server"), from the emergency header action, and followed in Updates › Campaigns.
 */

const PREFIX = 'cyberSecurity.patch.campaign';
const key = (suffix: string) => `${PREFIX}.${suffix}`;

export const campaignsEndpoint = 'cyber-security/patch/campaigns';
export const campaignPreviewEndpoint = `${campaignsEndpoint}/preview`;
const campaignEndpoint = (row: ConfigurableCrudRecord, action = '') =>
  `${campaignsEndpoint}/${encodeURIComponent(String(row['campaignUUID']))}${action ? `/${action}` : ''}`;

export const CONFIRM_WORD = 'CORRIGIR';

export type CampaignTarget = {
  scope: 'all' | 'cves' | 'priority' | 'selection';
  cves?: string[];
  priority?: 'P0' | 'P1' | 'kev';
  agentUUIDs?: string[];
  cyberAccountUUID?: string;
};

export const campaignStatuses = [
  'requested',
  'running',
  'paused',
  'halted',
  'aborted',
  'completed',
  'rejected',
] as const;

export const campaignStatusOptions: ConfigurableCrudOption[] = campaignStatuses.map((status) => ({
  value: status,
  label: key(`status.${status}`),
}));

export const campaignModeOptions: ConfigurableCrudOption[] = ['immediate', 'window'].map(
  (mode) => ({ value: mode, label: key(`mode.${mode}`) }),
);

export function campaignStatusTone(value: unknown) {
  switch (String(value ?? '')) {
    case 'completed':
      return 'chip-success';
    case 'requested':
      return 'chip-queued';
    case 'running':
      return 'chip-running';
    case 'paused':
    case 'halted':
      return 'chip-warning';
    case 'aborted':
    case 'rejected':
      return 'chip-failed';
    default:
      return 'chip-skipped';
  }
}

export function campaignModeTone(value: unknown) {
  return value === 'immediate' ? 'chip-failed' : 'chip-queued';
}

/** Reason codes of a server left out of a campaign (preview and skipped list). */
export const skipReasons = [
  'no_policy',
  'no_inventory',
  'macos',
  'platform_windows',
  'agent_outdated',
  'open_run',
  'windows_scope',
  'nothing_fixable',
] as const;

export const skipReasonKey = (reason: unknown) =>
  (skipReasons as readonly string[]).includes(String(reason))
    ? key(`reason.${reason}`)
    : key('reason.unknown');

export type CampaignAction = 'approve' | 'reject' | 'pause' | 'resume' | 'abort';

const ACTION_STATES: Record<CampaignAction, readonly string[]> = {
  approve: ['requested'],
  reject: ['requested'],
  pause: ['running', 'halted'],
  resume: ['paused', 'halted'],
  abort: ['requested', 'running', 'paused', 'halted'],
};

const ACTION_ICONS: Record<CampaignAction, string> = {
  approve: 'task_alt',
  reject: 'block',
  pause: 'pause_circle',
  resume: 'play_circle',
  abort: 'cancel',
};

/** Actions available to a campaign in this status. */
export function campaignActionsFor(status: unknown): CampaignAction[] {
  return (Object.keys(ACTION_STATES) as CampaignAction[]).filter((action) =>
    ACTION_STATES[action].includes(String(status)),
  );
}

/** What the campaign targets: the CVE codes, the priority or "every server". */
export function campaignDescription(
  row: ConfigurableCrudRecord,
  t: (key: string) => string,
): string {
  const scope = String(row['scope'] ?? '');
  if (scope === 'cves') {
    const cves = Array.isArray(row['cves']) ? (row['cves'] as string[]) : [];
    return cves.length > 3 ? `${cves.slice(0, 3).join(', ')} +${cves.length - 3}` : cves.join(', ');
  }
  if (scope === 'priority') return t(key(`priority.${row['priority']}`));
  return t(key(`scope.${scope === 'selection' ? 'selection' : 'all'}`));
}

const num = (value: unknown) => Number(value ?? 0);

/** "success+partial+nothing / targetCount". */
export function campaignProgress(row: ConfigurableCrudRecord): string {
  const done = num(row['successCount']) + num(row['partialCount']) + num(row['nothingCount']);
  return `${done} / ${num(row['targetCount'])}`;
}

/** "42 min" (or "1 h 5 min"); empty while the API has no duration yet. */
export function campaignDuration(value: unknown, t: (key: string) => string): string {
  const minutes = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(minutes)) return '';
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  const min = t(key('minutesShort'));
  return hours > 0 ? `${hours} h ${rest} ${min}` : `${rest} ${min}`;
}

export const campaignWave = (row: ConfigurableCrudRecord) =>
  `${num(row['currentWave'])} / ${num(row['waveCount'])}`;

const optionalNumber = (value: unknown): number | undefined => {
  const text = String(value ?? '').trim();
  return text === '' || !Number.isFinite(Number(text)) ? undefined : Number(text);
};

/** Body of `campaigns/preview`: only what selects the servers. */
export function campaignPreviewBody(target: CampaignTarget): Record<string, unknown> {
  return campaignTargetBody(target);
}

function campaignTargetBody(target: CampaignTarget): Record<string, unknown> {
  return {
    scope: target.scope,
    ...(target.cves?.length ? { cves: target.cves } : {}),
    ...(target.priority ? { priority: target.priority } : {}),
    ...(target.agentUUIDs?.length ? { agentUUIDs: target.agentUUIDs } : {}),
    ...(target.cyberAccountUUID ? { cyberAccountUUID: target.cyberAccountUUID } : {}),
  };
}

/** Emergency menu entries: the key suffix → the campaign target. */
export const emergencyKeys = ['P0', 'kev', 'P1', 'all'] as const;
export const EMERGENCY_PREFIX = 'campaignEmergency_';

export function targetFromEmergencyKey(actionKey: string): CampaignTarget | null {
  const pick = actionKey.startsWith(EMERGENCY_PREFIX)
    ? actionKey.slice(EMERGENCY_PREFIX.length)
    : '';
  switch (pick) {
    case 'P0':
    case 'P1':
    case 'kev':
      return { scope: 'priority', priority: pick };
    case 'all':
      return { scope: 'all' };
    default:
      return null;
  }
}

/** Header menu "Emergency fix": P0, KEV, P0+P1 or every server with a fix. */
export const emergencyMenu: ConfigurableCrudFilterActionMenu = {
  label: key('emergency'),
  icon: 'emergency',
  tooltip: key('emergencyHelp'),
  actions: emergencyKeys.map((pick) => ({
    key: `${EMERGENCY_PREFIX}${pick}`,
    label: pick === 'all' ? key('scope.all') : key(`priority.${pick}`),
    icon: pick === 'all' ? 'select_all' : 'priority_high',
  })),
};

/** Body of `campaigns`: the target plus the form values (platform scope never reboots/approves now). */
export function campaignPayload(
  target: CampaignTarget,
  values: ConfigurableCrudRecord,
  platform = false,
): Record<string, unknown> {
  const immediate = values['mode'] !== 'window';
  const chosen = String(values['cyberAccountUUID'] ?? '');
  return {
    ...campaignTargetBody(
      !platform && 'cyberAccountUUID' in values
        ? { ...target, cyberAccountUUID: chosen || undefined }
        : target,
    ),
    mode: immediate ? 'immediate' : 'window',
    rebootPolicy:
      !platform && values['rebootPolicy'] === 'server_policy' ? 'server_policy' : 'never',
    canarySize: optionalNumber(values['canarySize']),
    maxParallel: optionalNumber(values['maxParallel']),
    maxFailures: optionalNumber(values['maxFailures']),
    reason: String(values['reason'] ?? '').trim(),
    ...(immediate ? { confirm: String(values['confirm'] ?? '').trim() } : {}),
    approveNow: !platform && values['approveNow'] === 'yes',
  };
}

const isImmediate = (values: ConfigurableCrudRecord) => values['mode'] !== 'window';

const yesNo: ConfigurableCrudOption[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

const numberField = (name: string, extra: Partial<ConfigurableCrudField> = {}) =>
  ({
    key: name,
    label: key(`field.${name}`),
    type: 'number',
    span: 1,
    tab: 'advanced',
    positive: true,
    help: key(`field.${name}Help`),
    ...extra,
  }) as ConfigurableCrudField;

export type AccountLookup = NonNullable<ConfigurableCrudField['remoteLookup']>;

function campaignFields(accountLookup?: AccountLookup): ConfigurableCrudField[] {
  const account: ConfigurableCrudField[] = accountLookup
    ? [
        {
          key: 'cyberAccountUUID',
          label: 'cyberSecurity.account',
          type: 'search-select',
          remoteLookup: accountLookup,
          quickCreate: false,
          quickCreateExemptReason:
            'Cyber Security accounts are created by account administrators in Customer accounts.',
          span: 1,
          help: key('field.accountHelp'),
        },
      ]
    : [];
  return [
    ...account,
    {
      key: 'mode',
      label: key('field.mode'),
      type: 'select',
      options: campaignModeOptions,
      required: true,
      span: 1,
      help: key('field.modeHelp'),
    },
    {
      key: 'confirm',
      label: key('field.confirm'),
      type: 'text',
      span: 1,
      hiddenWhen: ({ values }) => !isImmediate(values),
      requiredWhen: ({ values }) => isImmediate(values),
      placeholder: CONFIRM_WORD,
      help: key('field.confirmHelp'),
    },
    {
      key: 'reason',
      label: key('field.reason'),
      type: 'textarea',
      required: true,
      span: 4,
      help: key('field.reasonHelp'),
    },
    numberField('canarySize'),
    numberField('maxParallel'),
    numberField('maxFailures'),
    {
      key: 'rebootPolicy',
      label: key('field.rebootPolicy'),
      type: 'select',
      options: [
        { value: 'never', label: key('reboot.never') },
        { value: 'server_policy', label: key('reboot.server_policy') },
      ],
      span: 1,
      tab: 'advanced',
      help: key('field.rebootPolicyHelp'),
    },
    {
      key: 'approveNow',
      label: key('field.approveNow'),
      type: 'select',
      options: yesNo,
      span: 1,
      tab: 'advanced',
      help: key('field.approveNowHelp'),
    },
  ];
}

/** Platform and master scope: no reboot choice and no self approval (a second person approves). */
export function platformCampaignForm(form: ConfigurableCrudConfig): ConfigurableCrudConfig {
  return {
    ...form,
    fields: form.fields.filter(
      (field) => field.key !== 'rebootPolicy' && field.key !== 'approveNow',
    ),
  };
}

/** The campaign form: settings of the run; it posts the campaign when saved. */
export function campaignForm(
  target: CampaignTarget,
  platform = false,
  accountLookup?: AccountLookup,
): ConfigurableCrudConfig {
  const form = defineCrud({
    endpoint: campaignsEndpoint,
    uuidField: 'campaignUUID',
    pageTitle: key('new'),
    pageDescription: key('newDescription'),
    createTitle: key('new'),
    dialogDescription: key('newDescription'),
    savedMessage: key('created'),
    statusFilter: false,
    tabLabels: { advanced: key('advanced') },
    initialValues: {
      mode: 'immediate',
      canarySize: 1,
      maxParallel: '',
      maxFailures: '',
      rebootPolicy: 'never',
      approveNow: 'no',
      reason: '',
      confirm: '',
      ...(accountLookup && !platform ? { cyberAccountUUID: target.cyberAccountUUID ?? '' } : {}),
    },
    payload: (values) => campaignPayload(target, values, platform),
    columns: [],
    fields: campaignFields(accountLookup && !platform ? accountLookup : undefined),
  });
  return platform ? platformCampaignForm(form) : form;
}

/** Summary shown before the settings: how many servers are fixed and which are left out. */
export function previewSummary(
  data: ConfigurableCrudRecord,
  t: (key: string, params?: Record<string, string | number>) => string,
  maxListed = 8,
): { eligible: number; message: string } {
  const items = Array.isArray(data['items']) ? (data['items'] as ConfigurableCrudRecord[]) : [];
  const eligible = items.filter((item) => item['eligible']).length || num(data['eligible']);
  const left = items.filter((item) => !item['eligible']);
  const listed = left
    .slice(0, maxListed)
    .map((item) => `${item['agentName'] ?? item['hostname']}: ${t(skipReasonKey(item['reason']))}`);
  const more = left.length - listed.length;
  const parts = [t(key('previewSummary'), { eligible, skipped: left.length })];
  if (listed.length) {
    parts.push(
      `${t(key('previewLeftOut'))} ${listed.join('; ')}${more > 0 ? `; ${t(key('previewMore'), { count: more })}` : ''}`,
    );
  }
  return { eligible, message: parts.join(' ') };
}

/** One decision (approve, reject, pause, resume, abort) with an optional note, behind a dialog. */
function decisionForm(action: CampaignAction, row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: campaignEndpoint(row, action),
    uuidField: 'campaignUUID',
    pageTitle: key(`action.${action}`),
    pageDescription: key(`action.${action}Confirm`),
    createTitle: key(`action.${action}`),
    dialogDescription: key(`action.${action}Confirm`),
    savedMessage: key(`action.${action}Done`),
    statusFilter: false,
    initialValues: { note: '' },
    payload: (values) => {
      const note = String(values['note'] ?? '').trim();
      return note ? { note } : {};
    },
    columns: [],
    fields: [
      {
        key: 'note',
        label: key('field.note'),
        type: 'textarea',
        span: 4,
        help: key('field.noteHelp'),
      },
    ],
  });
}

export function campaignRowActions(
  showCampaign: (row: ConfigurableCrudRecord) => void,
): ConfigurableCrudRowAction[] {
  return [
    {
      key: 'campaignDetail',
      label: key('detail'),
      icon: 'receipt_long',
      inline: true,
      run: (row) => showCampaign(row),
    },
    ...(Object.keys(ACTION_STATES) as CampaignAction[]).map((action) => ({
      key: `campaign_${action}`,
      label: key(`action.${action}`),
      icon: ACTION_ICONS[action],
      visible: (row: ConfigurableCrudRecord) => campaignActionsFor(row['status']).includes(action),
      form: (row: ConfigurableCrudRecord) => decisionForm(action, row),
    })),
  ];
}

/** Campaigns, newest first (Updates › Campaigns). */
export function campaignsCollection(
  showCampaign: (row: ConfigurableCrudRecord) => void,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: campaignsEndpoint,
    uuidField: 'campaignUUID',
    pageTitle: key('title'),
    pageDescription: key('description'),
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: [
      {
        id: 'created',
        label: 'cyberSecurity.patch.requestedAt',
        field: 'createdAt',
        uuidField: 'campaignUUID',
        kind: 'datetime',
      },
      {
        id: 'scope',
        label: key('col.scope'),
        value: (row, t) => campaignDescription(row, t),
      },
      {
        id: 'mode',
        label: key('field.mode'),
        field: 'mode',
        kind: 'status',
        options: campaignModeOptions,
        chipClass: campaignModeTone,
      },
      {
        id: 'status',
        label: 'Status',
        field: 'status',
        kind: 'status',
        options: campaignStatusOptions,
        chipClass: campaignStatusTone,
      },
      { id: 'progress', label: key('col.progress'), value: (row) => campaignProgress(row) },
      { id: 'failed', label: key('col.failed'), field: 'failedCount', kind: 'number' },
      { id: 'wave', label: key('col.wave'), value: (row) => campaignWave(row) },
      {
        id: 'requestedBy',
        label: 'cyberSecurity.patch.requestedBy',
        field: 'requestedBy',
        translateValue: false,
      },
    ],
    rowActions: campaignRowActions(showCampaign),
  });
}

type Translate = (key: string) => string;

const sortedByWave = (runs: ConfigurableCrudRecord[]) =>
  [...runs].sort((a, b) => num(a['wave']) - num(b['wave']));

/** Detail of one campaign: settings, left-out servers, runs by wave and the timeline. */
export function campaignView(campaign: ConfigurableCrudRecord, t: Translate): DataViewerDialogData {
  const list = (name: string) =>
    Array.isArray(campaign[name]) ? (campaign[name] as ConfigurableCrudRecord[]) : [];
  const auto = t(key('auto'));
  const sections: DataViewerSection[] = [
    {
      title: t('cyberSecurity.patch.summary'),
      details: [
        { label: key('col.scope'), value: campaignDescription(campaign, t), translate: false },
        { label: key('field.mode'), value: t(key(`mode.${campaign['mode']}`)), translate: false },
        { label: key('col.progress'), value: campaignProgress(campaign), translate: false },
        {
          label: key('col.duration'),
          value: campaignDuration(campaign['durationMinutes'], t),
          translate: false,
        },
        { label: key('col.failed'), value: num(campaign['failedCount']), translate: false },
        { label: key('col.wave'), value: campaignWave(campaign), translate: false },
        { label: key('field.canarySize'), value: campaign['canarySize'] ?? '', translate: false },
        { label: key('field.waveSize'), value: campaign['waveSize'] ?? auto, translate: false },
        {
          label: key('field.maxParallel'),
          value: campaign['maxParallel'] ?? auto,
          translate: false,
        },
        {
          label: key('field.maxFailures'),
          value: campaign['maxFailures'] ?? auto,
          translate: false,
        },
        {
          label: key('field.rebootPolicy'),
          value: t(
            key(
              `reboot.${campaign['rebootPolicy'] === 'server_policy' ? 'server_policy' : 'never'}`,
            ),
          ),
          translate: false,
        },
        { label: key('col.findings'), value: num(campaign['findingCount']), translate: false },
        {
          label: 'cyberSecurity.patch.requestedBy',
          value: campaign['requestedBy'] ?? '',
          translate: false,
        },
        {
          label: 'cyberSecurity.patch.decidedBy',
          value: campaign['decidedBy'] ?? '',
          translate: false,
        },
        {
          label: key('field.reason'),
          value: campaign['reason'] ?? '',
          translate: false,
          wide: true,
        },
      ],
    },
  ];
  const skipped = list('skipped');
  if (skipped.length) {
    sections.push({
      title: t(key('skipped')),
      table: {
        columns: [
          { key: 'name', label: 'Agent', translate: false },
          { key: 'reason', label: key('col.reason'), translate: false },
        ],
        rows: skipped.map((item) => ({
          name: item['agentName'] ?? item['agentUUID'],
          reason: t(skipReasonKey(item['reason'])),
        })),
      },
    });
  }
  sections.push(runsSection(sortedByWave(list('runs')), t), eventsSection(list('events'), t));
  return {
    title: t(key('detail')),
    description: campaignDescription(campaign, t),
    status: {
      label: 'Status',
      value: t(key(`status.${campaign['status']}`)),
      tone: statusTone(campaign['status']),
    },
    sections,
  };
}

function statusTone(status: unknown) {
  switch (campaignStatusTone(status)) {
    case 'chip-success':
      return 'success' as const;
    case 'chip-failed':
      return 'danger' as const;
    case 'chip-warning':
      return 'warning' as const;
    default:
      return 'info' as const;
  }
}

function runsSection(runs: ConfigurableCrudRecord[], t: Translate): DataViewerSection {
  return {
    title: t(key('runs')),
    table: {
      emptyLabel: key('noRuns'),
      columns: [
        { key: 'wave', label: key('col.wave'), translate: false },
        { key: 'agent', label: 'Agent', translate: false },
        { key: 'state', label: 'Status', translate: false },
        { key: 'fixed', label: 'cyberSecurity.patch.fixedFindings', translate: false },
        { key: 'error', label: 'cyberSecurity.patch.error', translate: false },
      ],
      rows: runs.map((run) => ({
        wave: run['wave'] ?? '',
        agent: run['agentName'] ?? run['hostname'] ?? '',
        state: t(`cyberSecurity.patch.state.${run['state']}`),
        fixed: `${num(run['fixedFindings'])} / ${num(run['findingCount'])}`,
        error: run['errorMessage'] ?? '',
      })),
    },
  };
}

function eventsSection(events: ConfigurableCrudRecord[], t: Translate): DataViewerSection {
  return {
    title: t(key('timeline')),
    table: {
      columns: [
        { key: 'at', label: key('col.when'), kind: 'datetime' },
        { key: 'type', label: key('col.event'), translate: false },
        { key: 'wave', label: key('col.wave'), translate: false },
        { key: 'user', label: key('col.user'), translate: false },
        { key: 'detail', label: key('col.detail'), translate: false },
      ],
      rows: events.map((event) => ({
        at: event['createdAt'] ?? '',
        type: t(key(`event.${event['type']}`)),
        wave: event['wave'] ?? '',
        user: event['userName'] ?? '',
        detail: event['detail'] ?? '',
      })),
    },
  };
}

/** "Fix on every server" on a CVE row. */
export function fixEverywhereAction(
  start: (target: CampaignTarget) => void,
): ConfigurableCrudRowAction {
  return {
    key: 'campaignFix',
    label: key('fixEverywhere'),
    icon: 'healing',
    visible: (row) => num(row['serverCount']) > 0 && row['fixState'] !== 'no_fix',
    run: (row) => start({ scope: 'cves', cves: [String(row['code'])] }),
  };
}
