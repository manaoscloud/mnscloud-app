import {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import type { DataViewerDialogData } from '../../shared/data-viewer-dialog/data-viewer-dialog';
import { patchPolicyForm } from './cyber-patch';

/**
 * Cyber Security hardening baseline and native antivirus (V8): part of the Advanced plan of a
 * server (the same unit as managed patching). The Agent checks a fixed list of CIS-based settings
 * once a day without changing the host and manages Microsoft Defender (Windows) or ClamAV (Linux); on a Mac (V10a) it reports XProtect.
 */

export const postureEndpoint = 'cyber-security/posture/servers';

const serverEndpoint = (row: ConfigurableCrudRecord, action: string) =>
  `${postureEndpoint}/${encodeURIComponent(String(row['agentUUID']))}/${action}`;

/** Every check code the Agent reports; the App shows its translated title and advice. */
export const HARDENING_CODES = [
  'ssh.root_login',
  'ssh.password_auth',
  'ssh.empty_passwords',
  'ssh.max_auth_tries',
  'ssh.x11_forwarding',
  'accounts.uid0',
  'accounts.empty_password',
  'accounts.pass_max_days',
  'files.shadow_permissions',
  'files.passwd_permissions',
  'sysctl.aslr',
  'sysctl.suid_dumpable',
  'sysctl.dmesg_restrict',
  'sysctl.accept_redirects',
  'sysctl.source_route',
  'sysctl.send_redirects',
  'sysctl.rp_filter',
  'sysctl.syncookies',
  'firewall.active',
  'time.sync',
  'audit.auditd',
  'win.firewall_profiles',
  'win.smb1_disabled',
  'win.smb_signing',
  'win.rdp_nla',
  'win.guest_disabled',
  'win.password_length',
  'win.password_complexity',
  'win.lockout_threshold',
  'win.uac_enabled',
  'win.llmnr_disabled',
  'win.autorun_disabled',
  'win.update_service',
  'win.tls10_disabled',
  'win.lsa_protection',
  'win.wdigest_disabled',
  'mac.filevault',
  'mac.firewall',
  'mac.firewall_stealth',
  'mac.gatekeeper',
  'mac.sip',
  'mac.update_check',
  'mac.security_updates',
  'mac.auto_install',
  'mac.updates_pending',
  'mac.ssh_password_auth',
  'mac.screen_sharing',
  'mac.guest_account',
  'mac.auto_login',
] as const;

const known = (code: unknown) =>
  (HARDENING_CODES as readonly string[]).includes(String(code ?? ''));

/** Translated title of a check (the code itself when this App does not know it yet). */
export function checkTitle(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  const code = String(row['code'] ?? '');
  return known(code) ? t(`cyberSecurity.hardening.check.${code}`) : code;
}

/** Translated advice of a check. */
export function checkAdvice(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  const code = String(row['code'] ?? '');
  return known(code) ? t(`cyberSecurity.hardening.advice.${code}`) : '';
}

export const checkStatusOptions: ConfigurableCrudOption[] = [
  { value: 'fail', label: 'cyberSecurity.hardening.status.fail' },
  { value: 'pass', label: 'cyberSecurity.hardening.status.pass' },
  { value: 'not_applicable', label: 'cyberSecurity.hardening.status.not_applicable' },
  { value: 'error', label: 'cyberSecurity.hardening.status.error' },
];

export const severityOptions: ConfigurableCrudOption[] = [
  { value: 'high', label: 'cyberSecurity.hardening.severity.high' },
  { value: 'medium', label: 'cyberSecurity.hardening.severity.medium' },
  { value: 'low', label: 'cyberSecurity.hardening.severity.low' },
];

export const engineOptions: ConfigurableCrudOption[] = [
  { value: 'defender', label: 'Microsoft Defender' },
  { value: 'clamav', label: 'ClamAV' },
  { value: 'xprotect', label: 'cyberSecurity.antivirus.engine.xprotect' },
  { value: 'none', label: 'cyberSecurity.antivirus.engine.none' },
];

export const threatStatusOptions: ConfigurableCrudOption[] = [
  { value: 'active', label: 'cyberSecurity.antivirus.threat.active' },
  { value: 'resolved', label: 'cyberSecurity.antivirus.threat.resolved' },
];

export const actionOptions: ConfigurableCrudOption[] = [
  { value: 'update', label: 'cyberSecurity.antivirus.update' },
  { value: 'quick_scan', label: 'cyberSecurity.antivirus.quickScan' },
  { value: 'full_scan', label: 'cyberSecurity.antivirus.fullScan' },
  { value: 'install', label: 'cyberSecurity.antivirus.install' },
];

export const jobStatusOptions: ConfigurableCrudOption[] = [
  { value: 'pending', label: 'cyberSecurity.antivirus.job.pending' },
  { value: 'leased', label: 'cyberSecurity.antivirus.job.running' },
  { value: 'running', label: 'cyberSecurity.antivirus.job.running' },
  { value: 'success', label: 'cyberSecurity.antivirus.job.success' },
  { value: 'failed', label: 'cyberSecurity.antivirus.job.failed' },
  { value: 'cancelled', label: 'cyberSecurity.antivirus.job.cancelled' },
];

export function checkStatusTone(value: unknown) {
  switch (String(value ?? '')) {
    case 'pass':
      return 'chip-success';
    case 'fail':
      return 'chip-failed';
    case 'error':
      return 'chip-warning';
    default:
      return 'chip-skipped';
  }
}

export function severityTone(value: unknown) {
  if (value === 'high') return 'chip-failed';
  return value === 'medium' ? 'chip-warning' : 'chip-skipped';
}

/** Score chip: 90+ good, 70+ attention, below that weak. */
export function scoreTone(value: unknown) {
  if (value === null || value === undefined || value === '') return 'chip-skipped';
  const score = Number(value);
  if (score >= 90) return 'chip-success';
  return score >= 70 ? 'chip-warning' : 'chip-failed';
}

const ANTIVIRUS_NAMES: Record<string, (t: (key: string) => string) => string> = {
  defender: () => 'Microsoft Defender',
  clamav: () => 'ClamAV',
  xprotect: (t) => t('cyberSecurity.antivirus.engine.xprotect'),
};

/** Antivirus state of a server row in one short label. */
export function antivirusLabel(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  if (!row['advanced'] || !row['antivirusEngine']) return '';
  if (!row['antivirusInstalled']) {
    return t(
      row['antivirusInstallable']
        ? 'cyberSecurity.antivirus.state.installable'
        : 'cyberSecurity.antivirus.state.missing',
    );
  }
  const engine = ANTIVIRUS_NAMES[String(row['antivirusEngine'])]?.(t) ?? 'ClamAV';
  if (!row['antivirusRunning']) return `${engine}: ${t('cyberSecurity.antivirus.state.stopped')}`;
  const realtime = row['antivirusRealtime']
    ? t('cyberSecurity.antivirus.state.realtime')
    : t('cyberSecurity.antivirus.state.onDemand');
  return `${engine}: ${realtime}`;
}

export function antivirusTone(_value: unknown, row?: ConfigurableCrudRecord) {
  if (!row?.['advanced'] || !row['antivirusEngine']) return 'chip-skipped';
  if (Number(row['activeThreats'] ?? 0) > 0 || !row['antivirusInstalled']) return 'chip-failed';
  return row['antivirusRunning'] ? 'chip-success' : 'chip-warning';
}

export const postureColumns: ConfigurableCrudColumn[] = [
  {
    id: 'advanced',
    label: 'cyberSecurity.hardening.advanced',
    field: 'advanced',
    kind: 'status',
    options: [
      { value: true, label: 'cyberSecurity.inventory.on' },
      { value: false, label: 'cyberSecurity.inventory.off' },
    ],
    chipClass: (value: unknown) => (value === true ? 'chip-success' : 'chip-skipped'),
  },
  {
    id: 'score',
    label: 'cyberSecurity.hardening.score',
    field: 'score',
    kind: 'status',
    value: (row) => (row['score'] === null || row['score'] === undefined ? '' : `${row['score']}%`),
    translateValue: false,
    chipClass: scoreTone,
  },
  { id: 'failed', label: 'cyberSecurity.hardening.failed', field: 'checksFailed', kind: 'number' },
  {
    id: 'highFailed',
    label: 'cyberSecurity.hardening.highFailed',
    field: 'checksHighFailed',
    kind: 'number',
  },
  {
    id: 'antivirus',
    label: 'cyberSecurity.antivirus.title',
    field: 'antivirusEngine',
    kind: 'status',
    value: (row, t) => antivirusLabel(row, t),
    translateValue: false,
    chipClass: antivirusTone,
  },
  {
    id: 'signatures',
    label: 'cyberSecurity.antivirus.signatures',
    field: 'antivirusSignatureUpdatedAt',
    kind: 'datetime',
  },
  {
    id: 'threats',
    label: 'cyberSecurity.antivirus.activeThreats',
    field: 'activeThreats',
    kind: 'number',
  },
  {
    id: 'checked',
    label: 'cyberSecurity.hardening.lastCheck',
    field: 'lastCheckedAt',
    kind: 'datetime',
  },
];

const advancedOn = (row: ConfigurableCrudRecord) => Boolean(row['advanced']);
const agentReason = (row: ConfigurableCrudRecord) =>
  row['supported'] ? null : 'cyberSecurity.hardening.agentOutdated';

/** Hardening checks of one server, failed high severity first. */
export function hardeningChecksCollection(
  server: ConfigurableCrudRecord,
  showCheck: (check: ConfigurableCrudRecord) => void,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: serverEndpoint(server, 'checks'),
    uuidField: 'checkUUID',
    pageTitle: String(server['agentName'] ?? server['hostname'] ?? ''),
    pageDescription: 'cyberSecurity.hardening.checksDescription',
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: [
      {
        id: 'check',
        label: 'cyberSecurity.hardening.check',
        field: 'code',
        uuidField: 'checkUUID',
        value: (row, t) => checkTitle(row, t),
        translateValue: false,
      },
      {
        id: 'severity',
        label: 'cyberSecurity.hardening.severity',
        field: 'severity',
        kind: 'status',
        options: severityOptions,
        chipClass: severityTone,
      },
      {
        id: 'status',
        label: 'Status',
        field: 'status',
        kind: 'status',
        options: checkStatusOptions,
        chipClass: checkStatusTone,
      },
      {
        id: 'evidence',
        label: 'cyberSecurity.hardening.evidence',
        field: 'evidence',
        translateValue: false,
      },
      {
        id: 'benchmark',
        label: 'cyberSecurity.hardening.benchmark',
        field: 'benchmark',
        translateValue: false,
      },
      {
        id: 'since',
        label: 'cyberSecurity.hardening.failingSince',
        field: 'failingSince',
        kind: 'datetime',
      },
    ],
    rowActions: [
      {
        key: 'hardeningCheckDetail',
        label: 'cyberSecurity.hardening.checkDetail',
        icon: 'info',
        inline: true,
        run: (row) => showCheck(row),
      },
    ],
  });
}

/** Threats found by the antivirus of one server (active first). */
export function antivirusThreatsCollection(server: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: serverEndpoint(server, 'threats'),
    uuidField: 'threatUUID',
    pageTitle: String(server['agentName'] ?? server['hostname'] ?? ''),
    pageDescription: 'cyberSecurity.antivirus.threatsDescription',
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: [
      {
        id: 'name',
        label: 'cyberSecurity.antivirus.threat',
        field: 'name',
        uuidField: 'threatUUID',
        translateValue: false,
      },
      { id: 'path', label: 'cyberSecurity.antivirus.path', field: 'path', translateValue: false },
      {
        id: 'status',
        label: 'Status',
        field: 'status',
        kind: 'status',
        options: threatStatusOptions,
        chipClass: (value: unknown) => (value === 'active' ? 'chip-failed' : 'chip-success'),
      },
      {
        id: 'action',
        label: 'cyberSecurity.antivirus.engineAction',
        field: 'action',
        translateValue: false,
      },
      {
        id: 'detected',
        label: 'cyberSecurity.antivirus.detectedAt',
        field: 'detectedAt',
        kind: 'datetime',
      },
    ],
  });
}

/** Antivirus actions of one server, newest first. */
export function antivirusActionsCollection(server: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: serverEndpoint(server, 'antivirus-actions'),
    uuidField: 'jobUUID',
    pageTitle: String(server['agentName'] ?? server['hostname'] ?? ''),
    pageDescription: 'cyberSecurity.antivirus.actionsDescription',
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: [
      {
        id: 'action',
        label: 'cyberSecurity.antivirus.action',
        field: 'action',
        uuidField: 'jobUUID',
        kind: 'status',
        options: actionOptions,
      },
      {
        id: 'status',
        label: 'Status',
        field: 'status',
        kind: 'status',
        options: jobStatusOptions,
      },
      {
        id: 'message',
        label: 'cyberSecurity.antivirus.message',
        field: 'message',
        translateValue: false,
      },
      {
        id: 'requested',
        label: 'cyberSecurity.antivirus.requestedAt',
        field: 'requestedAt',
        kind: 'datetime',
      },
      {
        id: 'finished',
        label: 'cyberSecurity.antivirus.finishedAt',
        field: 'finishedAt',
        kind: 'datetime',
      },
    ],
  });
}

function antivirusAction(
  key: string,
  action: 'update' | 'quick_scan' | 'full_scan' | 'install',
  icon: string,
  visible: (row: ConfigurableCrudRecord) => boolean,
  confirm?: string,
): ConfigurableCrudRowAction {
  const label = actionOptions.find((option) => option.value === action)?.label ?? key;
  return {
    key,
    label,
    icon,
    visible: (row) => advancedOn(row) && visible(row),
    disabledReason: agentReason,
    request: {
      method: 'post',
      endpoint: (row) => serverEndpoint(row, 'antivirus'),
      body: () => ({ action }),
      successMessage: 'cyberSecurity.antivirus.requested',
      ...(confirm ? { confirm: { title: label, message: confirm, confirmLabel: label } } : {}),
    },
  };
}

export function postureServerActions(
  showCheck: (check: ConfigurableCrudRecord) => void = () => undefined,
): ConfigurableCrudRowAction[] {
  // macOS runs XProtect by itself: no update or scan actions on a Mac.
  const installed = (row: ConfigurableCrudRecord) =>
    Boolean(row['antivirusInstalled']) && row['antivirusEngine'] !== 'xprotect';
  return [
    {
      key: 'hardeningChecks',
      label: 'cyberSecurity.hardening.checks',
      icon: 'fact_check',
      inline: true,
      visible: (row) => advancedOn(row) && Boolean(row['lastCheckedAt']),
      collection: (row) => hardeningChecksCollection(row, showCheck),
    },
    {
      key: 'advancedEnable',
      label: 'cyberSecurity.hardening.enableAdvanced',
      icon: 'workspace_premium',
      visible: (row) => !advancedOn(row),
      form: (row) => patchPolicyForm(row),
    },
    {
      key: 'hardeningCheckNow',
      label: 'cyberSecurity.hardening.checkNow',
      icon: 'refresh',
      visible: (row) => advancedOn(row) && !row['checkPending'],
      disabledReason: agentReason,
      request: {
        method: 'post',
        endpoint: (row) => serverEndpoint(row, 'check'),
        body: () => ({}),
        successMessage: 'cyberSecurity.hardening.checkRequested',
      },
    },
    {
      key: 'antivirusThreats',
      label: 'cyberSecurity.antivirus.threats',
      icon: 'coronavirus',
      visible: (row) => advancedOn(row) && Boolean(row['antivirusEngine']),
      collection: (row) => antivirusThreatsCollection(row),
    },
    antivirusAction('antivirusUpdate', 'update', 'system_update', installed),
    antivirusAction('antivirusQuickScan', 'quick_scan', 'search', installed),
    antivirusAction(
      'antivirusFullScan',
      'full_scan',
      'manage_search',
      installed,
      'cyberSecurity.antivirus.fullScanConfirm',
    ),
    antivirusAction(
      'antivirusInstall',
      'install',
      'download',
      (row) => !installed(row) && Boolean(row['antivirusInstallable']),
      'cyberSecurity.antivirus.installConfirm',
    ),
    {
      key: 'antivirusActions',
      label: 'cyberSecurity.antivirus.actions',
      icon: 'history',
      visible: (row) => advancedOn(row) && Boolean(row['lastActionType']),
      collection: (row) => antivirusActionsCollection(row),
    },
  ];
}

/** One check: what was found, why it matters and how to fix it. */
export function hardeningCheckView(
  check: ConfigurableCrudRecord,
  t: (key: string) => string,
): DataViewerDialogData {
  const lines = [
    `${t('cyberSecurity.hardening.severity')}: ${t(`cyberSecurity.hardening.severity.${check['severity']}`)}`,
    `${t('Status')}: ${t(`cyberSecurity.hardening.status.${check['status']}`)}`,
    check['evidence'] ? `${t('cyberSecurity.hardening.evidence')}: ${check['evidence']}` : '',
    check['benchmark'] ? `${t('cyberSecurity.hardening.benchmark')}: ${check['benchmark']}` : '',
  ].filter(Boolean);
  const advice = checkAdvice(check, t);
  return {
    title: checkTitle(check, t),
    description: String(check['code'] ?? ''),
    sections: [
      { title: t('cyberSecurity.hardening.summary'), message: lines.join('\n') },
      ...(advice ? [{ title: t('cyberSecurity.hardening.advice'), message: advice }] : []),
    ],
  };
}
