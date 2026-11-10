import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudFilterAction,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';
import { AuthService } from '../../services/auth.service';
import { hasEffectivePermission } from '../../core/guards/permission.guard';
import {
  aiFailureKey,
  aiLanguage,
  digestView,
  explanationView,
  exposureView,
  triageView,
} from './cyber-ai';
import {
  findingPatchAction,
  patchRunsCollection,
  patchServerActions,
  rebootOptions,
  runStateOptions,
  runStateTone,
  runView,
  windowLabel,
} from './cyber-patch';
import { priorities, priorityTone } from './cyber-priority';
import {
  exposureFindingsCollection,
  exposureFindingView,
  exposureTargetActions,
  frequencyOptions,
  scanStatusOptions,
  scanStatusTone,
  targetFields,
  targetPayload,
  targetsEndpoint,
} from './cyber-exposure';
import {
  hardeningCheckView,
  postureColumns,
  postureEndpoint,
  postureServerActions,
} from './cyber-posture';

type CyberSection =
  | 'servers'
  | 'decisions'
  | 'alerts'
  | 'lists'
  | 'security-events'
  | 'vulnerabilities'
  | 'inventory'
  | 'patches'
  | 'exposure'
  | 'hardening';

const options = (values: string[]): ConfigurableCrudOption[] =>
  values.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

const alertStatuses = options(['open', 'acknowledged', 'resolved', 'ignored']);
const decisionStatuses = options(['active', 'expired', 'removed']);
const levels = options(['info', 'warning', 'error', 'critical']);
const decisionActions = options(['ban', 'allow', 'captcha', 'none']);
const origins = options(['crowdsec', 'manual', 'import', 'system']);
const listTypes = [
  { value: 'allowlist', label: 'Allowlist' },
  { value: 'blocklist', label: 'Blocklist' },
];
const listScopes = [
  { value: 'ip', label: 'IP' },
  { value: 'range', label: 'Range' },
  { value: 'country', label: 'Country' },
  { value: 'asn', label: 'ASN' },
];

const tone = (value: unknown) => {
  switch (String(value ?? '')) {
    case 'active':
    case 'protected':
    case 'healthy':
    case 'online':
    case 'completed':
    case 'done':
    case 'resolved':
      return 'chip-success';
    case 'queued':
    case 'pending':
    case 'acknowledged':
      return 'chip-queued';
    case 'running':
    case 'installing':
      return 'chip-running';
    case 'warning':
    case 'open':
      return 'chip-warning';
    case 'failed':
    case 'error':
    case 'critical':
    case 'offline':
    case 'ban':
      return 'chip-failed';
    default:
      return 'chip-skipped';
  }
};

const readOnly = { canCreate: false, canEdit: false, canDelete: false, bulkDelete: false } as const;

const jobRequest = (
  command: string,
  successMessage: string,
  extra: (row: ConfigurableCrudRecord) => Record<string, unknown> = () => ({}),
) => ({
  method: 'post' as const,
  endpoint: () => 'cyber-security/servers/jobs',
  body: (row: ConfigurableCrudRecord) => ({
    agentUUID: row['agentUUID'],
    command,
    payload: {},
    ...extra(row),
  }),
  successMessage,
});

// Assigning a profile is a one-shot form posted to the server profile endpoint.
function assignProfile(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'cyber-security/servers/profile',
    uuidField: 'agentUUID',
    pageTitle: 'Assign security profile',
    pageDescription: 'cyberSecurity.description.assignProfile',
    createTitle: 'Assign security profile',
    savedMessage: 'Security profile assigned.',
    ...readOnly,
    canCreate: true,
    initialValues: { profileUUID: row['profileUUID'] ?? '' },
    columns: [{ id: 'profile', label: 'Profile', field: 'profileUUID' }],
    fields: [
      {
        key: 'profileUUID',
        label: 'Profile',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'cyber-security/profiles',
          uuidField: 'uuid',
          labelField: 'name',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Security profiles carry rules and services; create them on the Profiles page.',
      },
    ],
    payload: (values) => ({
      agentUUID: row['agentUUID'],
      profileUUID: values['profileUUID'] || null,
    }),
  });
}

// Tenant servers belong to a Cyber Security account; alerts and decisions follow their server's.
const CYBER_ACCOUNT_LOOKUP = {
  endpoint: 'cyber-security/accounts?status=1',
  uuidField: 'CyaUUID',
  labelField: 'CyaName',
};

const CYBER_ACCOUNT_FILTER: ConfigurableCrudListFilter = {
  key: 'cyberAccountUUID',
  label: 'cyberSecurity.account',
  paramKey: 'cyberAccountUUID',
  type: 'search-select',
  span: 1,
  remoteLookup: CYBER_ACCOUNT_LOOKUP,
};

const CYBER_ACCOUNT_COLUMN: ConfigurableCrudColumn = {
  id: 'cyberAccount',
  label: 'cyberSecurity.account',
  field: 'cyberAccountName',
};

/** Read-only server list keyed by Agent, shared by the inventory and patch pages. */
function agentServerList(
  endpoint: string,
  page: { pageTitle: string; pageDescription: string },
  action: ConfigurableCrudFilterAction,
) {
  return {
    ...readOnly,
    ...page,
    endpoint,
    uuidField: 'agentUUID',
    serverSidePagination: true,
    statusFilter: false,
    filterActions: [action],
  };
}

const agentServerColumns: ConfigurableCrudColumn[] = [
  { id: 'agent', label: 'Agent', field: 'agentName', uuidField: 'agentUUID', kind: 'identity' },
  { id: 'os', label: 'cyberSecurity.inventory.os', field: 'osName', translateValue: false },
];

function assignAccount(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'cyber-security/servers/account',
    uuidField: 'agentUUID',
    pageTitle: 'cyberSecurity.assignServerAccount',
    pageDescription: 'cyberSecurity.assignServerAccountDescription',
    createTitle: 'cyberSecurity.assignServerAccount',
    savedMessage: 'cyberSecurity.serverAccountAssigned',
    ...readOnly,
    canCreate: true,
    initialValues: { cyberAccountUUID: row['cyberAccountUUID'] ?? '' },
    columns: [{ id: 'account', label: 'cyberSecurity.account', field: 'cyberAccountUUID' }],
    fields: [
      {
        key: 'cyberAccountUUID',
        label: 'cyberSecurity.account',
        type: 'search-select',
        required: true,
        remoteLookup: CYBER_ACCOUNT_LOOKUP,
        quickCreate: false,
        quickCreateExemptReason:
          'Cyber Security accounts are created by account administrators in Customer accounts.',
        span: 1,
      },
    ],
    payload: (values) => ({
      agentUUID: row['agentUUID'],
      cyberAccountUUID: values['cyberAccountUUID'],
    }),
  });
}

/** Account filter, column and (for servers) assignment, only in the tenant area. */
function withCyberAccount(section: CyberSection, config: ConfigurableCrudConfig) {
  if (!['servers', 'alerts', 'decisions'].includes(section)) return config;
  const [first, ...rest] = config.columns;
  return {
    ...config,
    listFilters: [CYBER_ACCOUNT_FILTER, ...(config.listFilters ?? [])],
    columns: [first, CYBER_ACCOUNT_COLUMN, ...rest],
    rowActions:
      section === 'servers'
        ? [
            ...(config.rowActions ?? []),
            {
              key: 'assignAccount',
              label: 'cyberSecurity.assignServerAccount',
              icon: 'business',
              visible: (row: ConfigurableCrudRecord) => Boolean(row['agentUUID']),
              form: assignAccount,
            },
          ]
        : config.rowActions,
  };
}

// ----- Vulnerabilities and software inventory (vulnerability management V3) -----

const findingStatuses: ConfigurableCrudOption[] = [
  { value: 'open', label: 'cyberSecurity.vuln.status.open' },
  { value: 'fixed', label: 'cyberSecurity.vuln.status.fixed' },
  { value: 'accepted_risk', label: 'cyberSecurity.vuln.status.accepted_risk' },
  { value: 'false_positive', label: 'cyberSecurity.vuln.status.false_positive' },
];
const fixStates: ConfigurableCrudOption[] = [
  { value: 'fixed', label: 'cyberSecurity.vuln.fixState.fixed' },
  { value: 'no_fix', label: 'cyberSecurity.vuln.fixState.no_fix' },
];

const decimal = (value: unknown, digits: number) =>
  value === null || value === undefined || value === '' ? '' : Number(value).toFixed(digits);

/** Servers affected by one vulnerability (collection dialog of the vulnerability row). */
function vulnerabilityFindings(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    ...readOnly,
    endpoint: `cyber-security/vulnerabilities/${encodeURIComponent(String(row['code']))}/findings`,
    uuidField: 'findingUUID',
    pageTitle: String(row['code']),
    pageDescription: 'cyberSecurity.vuln.findingsDescription',
    serverSidePagination: true,
    statusMode: 'string',
    activeValue: 'open',
    inactiveValue: 'fixed',
    statusOptions: findingStatuses,
    columns: [
      {
        id: 'agent',
        label: 'Agent',
        field: 'agentName',
        uuidField: 'findingUUID',
        kind: 'identity',
      },
      {
        id: 'package',
        label: 'cyberSecurity.vuln.package',
        field: 'package',
        translateValue: false,
      },
      {
        id: 'installed',
        label: 'cyberSecurity.vuln.installed',
        field: 'installedVersion',
        translateValue: false,
      },
      {
        id: 'fixed',
        label: 'cyberSecurity.vuln.fixedVersion',
        field: 'fixedVersion',
        translateValue: false,
      },
      {
        id: 'priority',
        label: 'cyberSecurity.vuln.priority',
        field: 'priority',
        kind: 'status',
        options: priorities,
        chipClass: priorityTone,
      },
      { id: 'due', label: 'cyberSecurity.vuln.due', field: 'dueAt', kind: 'datetime' },
      { id: 'status', label: 'Status', field: 'status', kind: 'status', options: findingStatuses },
    ],
    fields: [],
    initialValues: {},
    rowActions: [
      {
        key: 'fix',
        label: 'cyberSecurity.vuln.howToFix',
        icon: 'build',
        inline: true,
        run: (finding) => showRemediation(finding),
      },
      {
        key: 'aiExplain',
        label: 'cyberSecurity.ai.explain',
        icon: 'auto_awesome',
        visible: (finding) => Boolean(finding['agentUUID']),
        run: (finding) => aiExplainDialog?.(finding),
      },
      findingPatchAction,
      {
        key: 'acceptRisk',
        label: 'cyberSecurity.vuln.acceptRisk',
        icon: 'verified_user',
        visible: (finding) => finding['status'] === 'open',
        form: (finding) => riskAcceptanceForm(finding),
      },
      {
        key: 'revokeRisk',
        label: 'cyberSecurity.vuln.revokeRisk',
        icon: 'undo',
        visible: (finding) => finding['status'] === 'accepted_risk',
        request: {
          method: 'delete',
          endpoint: (finding) => riskAcceptanceEndpoint(finding),
          successMessage: 'cyberSecurity.vuln.riskRevoked',
          confirm: {
            title: 'cyberSecurity.vuln.revokeRisk',
            message: 'cyberSecurity.vuln.revokeRiskConfirm',
            confirmLabel: 'cyberSecurity.vuln.revokeRisk',
          },
        },
      },
    ],
  });
}

const riskAcceptanceEndpoint = (finding: ConfigurableCrudRecord) =>
  `cyber-security/vulnerabilities/findings/${encodeURIComponent(String(finding['findingUUID']))}/risk-acceptance`;

/** Accept the risk of an open finding until a date (at most one year) with a reason (V4). */
function riskAcceptanceForm(finding: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: riskAcceptanceEndpoint(finding),
    uuidField: 'findingUUID',
    pageTitle: 'cyberSecurity.vuln.acceptRisk',
    pageDescription: 'cyberSecurity.vuln.acceptRiskDescription',
    createTitle: 'cyberSecurity.vuln.acceptRisk',
    savedMessage: 'cyberSecurity.vuln.riskAccepted',
    statusFilter: false,
    initialValues: { until: '', reason: '' },
    columns: [],
    fields: [
      {
        key: 'until',
        label: 'cyberSecurity.vuln.riskUntil',
        type: 'date',
        required: true,
        span: 1,
        help: 'cyberSecurity.vuln.riskUntilHelp',
      },
      {
        key: 'reason',
        label: 'cyberSecurity.vuln.riskReason',
        type: 'textarea',
        required: true,
        span: 4,
        rows: 4,
        help: 'cyberSecurity.vuln.riskReasonHelp',
      },
    ],
  });
}

/** Findings of one server (collection dialog of the inventory row). */
function vulnerabilityFindingsOfAgent(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const base = vulnerabilityFindings({ code: '' });
  return {
    ...base,
    endpoint: `cyber-security/inventory/${encodeURIComponent(String(row['agentUUID']))}/findings`,
    pageTitle: String(row['agentName'] ?? row['agentUUID']),
    columns: [
      {
        id: 'code',
        label: 'CVE',
        field: 'code',
        uuidField: 'findingUUID',
        kind: 'identity',
        translateValue: false,
      },
      ...base.columns.slice(1),
    ],
  };
}

let remediationDialog: ((finding: ConfigurableCrudRecord) => void) | null = null;
let aiExplainDialog: ((finding: ConfigurableCrudRecord) => Promise<void>) | null = null;
let platformMaster: () => boolean = () => false;
let patchRunDialog: ((run: ConfigurableCrudRecord) => Promise<void>) | null = null;
const showPatchRun = (run: ConfigurableCrudRecord) => void patchRunDialog?.(run);
let exposureFindingDialog: ((finding: ConfigurableCrudRecord) => void) | null = null;
const showExposureFinding = (finding: ConfigurableCrudRecord) => exposureFindingDialog?.(finding);
let hardeningCheckDialog: ((check: ConfigurableCrudRecord) => void) | null = null;
const showHardeningCheck = (check: ConfigurableCrudRecord) => hardeningCheckDialog?.(check);
function showRemediation(finding: ConfigurableCrudRecord) {
  remediationDialog?.(finding);
}

const CONFIGS: Record<CyberSection, ConfigurableCrudConfig> = {
  vulnerabilities: defineCrud({
    ...readOnly,
    endpoint: 'cyber-security/vulnerabilities',
    uuidField: 'code',
    pageTitle: 'Vulnerabilities',
    pageDescription: 'cyberSecurity.vuln.pageDescription',
    serverSidePagination: true,
    statusMode: 'string',
    activeValue: 'open',
    inactiveValue: 'fixed',
    statusOptions: findingStatuses,
    listFilters: [
      {
        key: 'priority',
        label: 'cyberSecurity.vuln.priority',
        type: 'select',
        span: 1,
        options: priorities,
      },
    ],
    columns: [
      {
        id: 'code',
        label: 'CVE',
        field: 'code',
        uuidField: 'code',
        kind: 'identity',
        translateValue: false,
      },
      {
        id: 'summary',
        label: 'cyberSecurity.vuln.summary',
        field: 'summary',
        translateValue: false,
      },
      {
        id: 'priority',
        label: 'cyberSecurity.vuln.priority',
        field: 'priority',
        kind: 'status',
        options: priorities,
        chipClass: priorityTone,
      },
      { id: 'kev', label: 'KEV', field: 'kev', kind: 'boolean' },
      {
        id: 'cvss',
        label: 'CVSS',
        field: 'cvssScore',
        value: (row: ConfigurableCrudRecord) => decimal(row['cvssScore'], 1),
      },
      {
        id: 'epss',
        label: 'EPSS',
        field: 'epssScore',
        value: (row: ConfigurableCrudRecord) => decimal(row['epssScore'], 3),
      },
      { id: 'servers', label: 'cyberSecurity.vuln.servers', field: 'serverCount', kind: 'number' },
      {
        id: 'packages',
        label: 'cyberSecurity.vuln.packages',
        field: 'packages',
        translateValue: false,
      },
      { id: 'fixState', label: 'cyberSecurity.vuln.fix', field: 'fixState', options: fixStates },
      { id: 'due', label: 'cyberSecurity.vuln.due', field: 'dueAt', kind: 'datetime' },
    ],
    fields: [],
    initialValues: {},
    rowActions: [
      {
        key: 'findings',
        label: 'cyberSecurity.vuln.affectedServers',
        icon: 'dns',
        inline: true,
        collection: vulnerabilityFindings,
      },
      { key: 'vulnerability', label: 'Details', icon: 'visibility', tooltip: 'Details' },
      {
        key: 'platformExposure',
        label: 'cyberSecurity.ai.platformExposure',
        icon: 'public',
        visible: () => platformMaster(),
      },
    ],
    filterActions: [
      {
        key: 'aiDigest',
        label: 'cyberSecurity.ai.digest',
        icon: 'auto_awesome',
        tooltip: 'cyberSecurity.ai.digestHelp',
      },
    ],
  }),
  inventory: defineCrud({
    ...agentServerList(
      'cyber-security/inventory',
      {
        pageTitle: 'cyberSecurity.inventory.title',
        pageDescription: 'cyberSecurity.inventory.pageDescription',
      },
      {
        key: 'enableAll',
        label: 'cyberSecurity.inventory.enableAll',
        icon: 'playlist_add_check',
        tooltip: 'cyberSecurity.inventory.enableAllHelp',
      },
    ),
    columns: [
      ...agentServerColumns,
      {
        id: 'enabled',
        label: 'cyberSecurity.inventory.collection',
        field: 'enabled',
        kind: 'status',
        options: [
          { value: 1, label: 'cyberSecurity.inventory.on' },
          { value: 0, label: 'cyberSecurity.inventory.off' },
        ],
        chipClass: (value: unknown) => (Number(value) === 1 ? 'chip-success' : 'chip-skipped'),
      },
      {
        id: 'packages',
        label: 'cyberSecurity.vuln.packages',
        field: 'packageCount',
        kind: 'number',
      },
      {
        id: 'open',
        label: 'cyberSecurity.vuln.openFindings',
        field: 'openFindings',
        kind: 'number',
      },
      { id: 'p0', label: 'P0', field: 'findingsP0', kind: 'number' },
      { id: 'p1', label: 'P1', field: 'findingsP1', kind: 'number' },
      {
        id: 'overdue',
        label: 'cyberSecurity.vuln.overdue',
        field: 'findingsOverdue',
        kind: 'number',
      },
      { id: 'eol', label: 'cyberSecurity.inventory.endOfLife', field: 'endOfLife', kind: 'date' },
      {
        id: 'reboot',
        label: 'cyberSecurity.inventory.reboot',
        field: 'rebootRequired',
        kind: 'boolean',
      },
      {
        id: 'received',
        label: 'cyberSecurity.inventory.received',
        field: 'receivedAt',
        kind: 'datetime',
      },
    ],
    fields: [],
    initialValues: {},
    rowActions: [
      {
        key: 'agentFindings',
        label: 'Vulnerabilities',
        icon: 'bug_report',
        inline: true,
        visible: (row) => Number(row['openFindings'] ?? 0) > 0,
        collection: (row) => ({
          ...vulnerabilityFindingsOfAgent(row),
        }),
      },
      {
        key: 'inventoryOn',
        label: 'cyberSecurity.inventory.turnOn',
        icon: 'toggle_on',
        visible: (row) => Number(row['enabled']) !== 1,
        request: {
          method: 'put',
          endpoint: (row) => `cyber-security/inventory/${row['agentUUID']}`,
          body: () => ({ enabled: true }),
          successMessage: 'cyberSecurity.inventory.turnedOn',
        },
      },
      {
        key: 'inventoryOff',
        label: 'cyberSecurity.inventory.turnOff',
        icon: 'toggle_off',
        visible: (row) => Number(row['enabled']) === 1,
        request: {
          method: 'put',
          endpoint: (row) => `cyber-security/inventory/${row['agentUUID']}`,
          body: () => ({ enabled: false }),
          successMessage: 'cyberSecurity.inventory.turnedOff',
          confirm: {
            title: 'cyberSecurity.inventory.turnOff',
            message: 'cyberSecurity.inventory.turnOffConfirm',
            confirmLabel: 'cyberSecurity.inventory.turnOff',
          },
        },
      },
    ],
  }),

  patches: defineCrud({
    ...agentServerList(
      'cyber-security/patch/servers',
      {
        pageTitle: 'cyberSecurity.patch.title',
        pageDescription: 'cyberSecurity.patch.pageDescription',
      },
      {
        key: 'patchRuns',
        label: 'cyberSecurity.patch.runs',
        icon: 'history',
        tooltip: 'cyberSecurity.patch.runsDescription',
      },
    ),
    columns: [
      ...agentServerColumns,
      {
        id: 'enabled',
        label: 'cyberSecurity.patch.managed',
        field: 'enabled',
        kind: 'status',
        options: [
          { value: true, label: 'cyberSecurity.inventory.on' },
          { value: false, label: 'cyberSecurity.inventory.off' },
        ],
        chipClass: (value: unknown) => (value === true ? 'chip-success' : 'chip-skipped'),
      },
      {
        id: 'window',
        label: 'cyberSecurity.patch.window',
        value: (row, t) => windowLabel(row, t),
      },
      {
        id: 'reboot',
        label: 'cyberSecurity.patch.rebootPolicy',
        field: 'rebootPolicy',
        kind: 'status',
        options: rebootOptions,
      },
      {
        id: 'next',
        label: 'cyberSecurity.patch.nextWindow',
        field: 'nextWindowAt',
        translateValue: false,
      },
      {
        id: 'fixable',
        label: 'cyberSecurity.patch.openFixable',
        field: 'openFixable',
        kind: 'number',
      },
      {
        id: 'last',
        label: 'cyberSecurity.patch.lastRun',
        field: 'lastRunStatus',
        kind: 'status',
        options: runStateOptions,
        chipClass: runStateTone,
      },
    ],
    fields: [],
    initialValues: {},
    rowActions: patchServerActions(showPatchRun),
  }),

  exposure: defineCrud({
    ...readOnly,
    canCreate: true,
    endpoint: targetsEndpoint,
    uuidField: 'targetUUID',
    pageTitle: 'cyberSecurity.exposure.title',
    pageDescription: 'cyberSecurity.exposure.pageDescription',
    createTitle: 'cyberSecurity.exposure.create',
    savedMessage: 'cyberSecurity.exposure.saved',
    serverSidePagination: true,
    statusFilter: false,
    filterActions: [
      {
        key: 'exposureFindings',
        label: 'cyberSecurity.exposure.findings',
        icon: 'report',
        tooltip: 'cyberSecurity.exposure.findingsDescription',
      },
    ],
    initialValues: { frequency: 'weekly', authorize: [] },
    payload: (values) => targetPayload(values),
    fields: targetFields(true),
    columns: [
      { id: 'label', label: 'Name', field: 'label', uuidField: 'targetUUID', kind: 'identity' },
      {
        id: 'address',
        label: 'cyberSecurity.exposure.address',
        field: 'address',
        translateValue: false,
      },
      { id: 'account', label: 'cyberSecurity.account', field: 'cyberAccountName' },
      {
        id: 'frequency',
        label: 'cyberSecurity.exposure.frequency',
        field: 'frequency',
        kind: 'status',
        options: frequencyOptions,
      },
      {
        id: 'lastScan',
        label: 'cyberSecurity.exposure.lastScan',
        field: 'lastScanAt',
        kind: 'datetime',
      },
      {
        id: 'lastScanStatus',
        label: 'cyberSecurity.exposure.lastScanStatus',
        field: 'lastScanStatus',
        kind: 'status',
        options: scanStatusOptions,
        chipClass: scanStatusTone,
      },
      {
        id: 'services',
        label: 'cyberSecurity.exposure.openServices',
        field: 'openServices',
        kind: 'number',
      },
      {
        id: 'findings',
        label: 'cyberSecurity.exposure.openFindings',
        field: 'openFindings',
        kind: 'number',
      },
      {
        id: 'urgent',
        label: 'cyberSecurity.exposure.urgentFindings',
        field: 'urgentFindings',
        kind: 'number',
      },
      {
        id: 'owner',
        label: 'cyberSecurity.exposure.ownerName',
        field: 'ownerName',
        translateValue: false,
      },
      {
        id: 'authorization',
        label: 'cyberSecurity.exposure.authorizationExpires',
        field: 'authorizationExpiresAt',
        kind: 'date',
      },
    ],
    rowActions: exposureTargetActions(showExposureFinding),
  }),

  hardening: defineCrud({
    ...readOnly,
    endpoint: postureEndpoint,
    uuidField: 'agentUUID',
    pageTitle: 'cyberSecurity.hardening.title',
    pageDescription: 'cyberSecurity.hardening.pageDescription',
    serverSidePagination: true,
    statusFilter: false,
    columns: [...agentServerColumns, ...postureColumns],
    fields: [],
    initialValues: {},
    rowActions: postureServerActions(showHardeningCheck),
  }),

  servers: defineCrud({
    ...readOnly,
    endpoint: 'cyber-security/servers',
    uuidField: 'uuid',
    pageTitle: 'Servers',
    pageDescription: 'Agents, protection state, CrowdSec and bouncer health.',
    serverSidePagination: true,
    statusFilter: false,
    columns: [
      { id: 'agent', label: 'Agent', field: 'agentName', uuidField: 'agentUUID', kind: 'identity' },
      { id: 'profile', label: 'Profile', field: 'profileName' },
      {
        id: 'protection',
        label: 'Protection',
        field: 'protectionStatus',
        kind: 'status',
        chipClass: tone,
      },
      { id: 'job', label: 'Last job', field: 'lastJobStatus', kind: 'status', chipClass: tone },
      {
        id: 'crowdsec',
        label: 'CrowdSec',
        field: 'crowdsecStatus',
        kind: 'status',
        chipClass: tone,
      },
      { id: 'bouncer', label: 'Bouncer', field: 'bouncerStatus', kind: 'status', chipClass: tone },
      { id: 'lastSync', label: 'Last sync', field: 'lastSyncAt', kind: 'datetime' },
    ],
    fields: [],
    initialValues: {},
    rowActions: [
      { key: 'jobs', label: 'Job details', icon: 'manage_search', tooltip: 'Job details' },
      {
        key: 'status',
        label: 'Refresh security status',
        icon: 'fact_check',
        tooltip: 'Refresh security status',
        visible: (row) => Boolean(row['agentUUID']),
        request: jobRequest('cyber.security.status', 'Security status refresh started.'),
      },
      {
        key: 'install',
        label: 'Install protection',
        icon: 'admin_panel_settings',
        tooltip: 'Install protection',
        visible: (row) => Boolean(row['agentUUID']),
        request: {
          ...jobRequest('cyber.security.install', 'Protection install job started.', () => ({
            payload: { collections: ['crowdsecurity/linux', 'crowdsecurity/sshd'] },
          })),
          confirm: {
            title: 'Install protection',
            message: 'Queue the CrowdSec protection install on this server?',
            confirmLabel: 'Install',
          },
        },
      },
      {
        key: 'apply',
        label: 'Apply security profile',
        icon: 'policy',
        tooltip: 'Apply security profile',
        visible: (row) => Boolean(row['agentUUID'] && row['profileUUID']),
        request: jobRequest(
          'cyber.security.profile.apply',
          'Security profile apply job started.',
          (row) => ({
            profileUUID: row['profileUUID'],
          }),
        ),
      },
      { key: 'assign', label: 'Assign security profile', icon: 'shield', form: assignProfile },
    ],
  }),
  decisions: defineCrud({
    ...readOnly,
    endpoint: 'cyber-security/decisions',
    uuidField: 'uuid',
    pageTitle: 'Protection Decisions',
    pageDescription: 'Active security decisions currently enforced by CrowdSec.',
    serverSidePagination: true,
    statusMode: 'string',
    activeValue: 'active',
    inactiveValue: 'expired',
    statusOptions: decisionStatuses,
    listFilters: [
      { key: 'action', label: 'Action', type: 'select', span: 1, options: decisionActions },
      { key: 'origin', label: 'Origin', type: 'select', span: 1, options: origins },
    ],
    columns: [
      {
        id: 'value',
        label: 'Value',
        field: 'value',
        uuidField: 'uuid',
        kind: 'identity',
        translateValue: false,
      },
      { id: 'server', label: 'Server', field: 'serverName' },
      {
        id: 'action',
        label: 'Action',
        field: 'action',
        kind: 'status',
        options: decisionActions,
        chipClass: tone,
      },
      { id: 'origin', label: 'Origin', field: 'origin', options: origins },
      { id: 'service', label: 'Service', field: 'serviceSlug', translateValue: false },
      { id: 'expires', label: 'Expires', field: 'expiresAt', kind: 'datetime' },
      { id: 'status', label: 'Status', field: 'status', kind: 'status', chipClass: tone },
    ],
    fields: [],
    initialValues: {},
    rowActions: [{ key: 'details', label: 'Details', icon: 'visibility', tooltip: 'Details' }],
  }),
  alerts: defineCrud({
    ...readOnly,
    endpoint: 'cyber-security/alerts',
    uuidField: 'uuid',
    pageTitle: 'Alerts',
    pageDescription: 'Open security findings that need operator review.',
    serverSidePagination: true,
    statusMode: 'string',
    activeValue: 'open',
    inactiveValue: 'resolved',
    statusOptions: alertStatuses,
    listFilters: [{ key: 'level', label: 'Level', type: 'select', span: 1, options: levels }],
    filterActions: [
      {
        key: 'aiTriage',
        label: 'cyberSecurity.ai.triage',
        icon: 'auto_awesome',
        tooltip: 'cyberSecurity.ai.triageHelp',
      },
    ],
    columns: [
      { id: 'message', label: 'Message', field: 'message', uuidField: 'uuid', kind: 'identity' },
      { id: 'server', label: 'Server', field: 'serverName' },
      {
        id: 'level',
        label: 'Level',
        field: 'level',
        kind: 'status',
        options: levels,
        chipClass: tone,
      },
      { id: 'service', label: 'Service', field: 'serviceSlug', translateValue: false },
      { id: 'detectedAt', label: 'Detected at', field: 'detectedAt', kind: 'datetime' },
      { id: 'status', label: 'Status', field: 'status', kind: 'status', chipClass: tone },
    ],
    fields: [],
    initialValues: {},
    rowActions: [
      { key: 'details', label: 'Details', icon: 'visibility', tooltip: 'Details' },
      ...(
        [
          ['acknowledged', 'Acknowledge', 'done'],
          ['resolved', 'Resolve', 'task_alt'],
          ['ignored', 'Ignore', 'visibility_off'],
        ] as const
      ).map(([status, label, icon]) => ({
        key: status,
        label,
        icon,
        tooltip: label,
        visible: (row: ConfigurableCrudRecord) => row['status'] !== status,
        request: {
          method: 'put' as const,
          endpoint: (row: ConfigurableCrudRecord) => `cyber-security/alerts/${row['uuid']}/status`,
          body: () => ({ status }),
          successMessage: 'Alert updated.',
        },
      })),
    ],
  }),
  lists: defineCrud({
    endpoint: 'cyber-security/lists',
    uuidField: 'uuid',
    pageTitle: 'Allowlist / Blocklist',
    pageDescription: 'Explicit allow and block entries for trusted operations.',
    serverSidePagination: true,
    // No bulk list-entry endpoint exists; individual delete keeps the audited single-entry path.
    bulkDelete: false,
    listFilters: [
      { key: 'listType', label: 'List type', type: 'select', span: 1, options: listTypes },
    ],
    initialValues: { enabled: 1, listType: 'allowlist', value: '', scope: 'ip', reason: '' },
    columns: [
      {
        id: 'value',
        label: 'Value',
        field: 'value',
        uuidField: 'uuid',
        kind: 'identity',
        translateValue: false,
      },
      { id: 'type', label: 'List type', field: 'listType', options: listTypes },
      { id: 'scope', label: 'Scope', field: 'scope', options: listScopes },
      { id: 'reason', label: 'Reason', field: 'reason' },
      { id: 'status', label: 'Status', field: 'enabled', kind: 'status' },
    ],
    fields: [
      { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'listType',
        source: 'listType',
        label: 'List type',
        type: 'select',
        options: listTypes,
        required: true,
        span: 1,
      },
      {
        key: 'scope',
        source: 'scope',
        label: 'Scope',
        type: 'select',
        options: listScopes,
        required: true,
        span: 1,
      },
      { key: 'value', source: 'value', label: 'Value', required: true, span: 1 },
      { key: 'reason', source: 'reason', label: 'Reason', span: 1 },
    ],
  }),
  'security-events': defineCrud({
    ...readOnly,
    endpoint: 'cyber-security/security-events',
    uuidField: 'uuid',
    pageTitle: 'Security Events',
    pageDescription: 'Audited decisions for trusted access, deny, rate limit and monitor events.',
    serverSidePagination: true,
    statusFilter: false,
    columns: [
      {
        id: 'detectedAt',
        label: 'Detected at',
        field: 'detectedAt',
        uuidField: 'uuid',
        kind: 'identity',
      },
      { id: 'decision', label: 'Decision', field: 'decision', kind: 'status', chipClass: tone },
      {
        id: 'endpointGroup',
        label: 'Endpoint group',
        field: 'endpointGroup',
        translateValue: false,
      },
      { id: 'source', label: 'Source', field: 'sourceIP', translateValue: false },
      { id: 'node', label: 'Trusted node', field: 'trustedNodeName' },
      { id: 'reason', label: 'Reason', field: 'reason' },
    ],
    fields: [],
    initialValues: {},
  }),
};

@Component({
  selector: 'app-cyber-security',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const data = inject(ActivatedRoute).snapshot.data;
    const section = (data['section'] as CyberSection | undefined) ?? 'servers';
    const config = CONFIGS[section] ?? CONFIGS.servers;
    super(data['scope'] === 'master' ? config : withCyberAccount(section, config));
    const auth = inject(AuthService);
    remediationDialog = (finding) => this.showRemediation(finding);
    aiExplainDialog = (finding) => this.explainFinding(finding);
    patchRunDialog = (run) => this.showPatchRun(run);
    exposureFindingDialog = (finding) =>
      openDataViewerDialog(this.dialog, exposureFindingView(finding, this.t.bind(this)));
    hardeningCheckDialog = (check) =>
      openDataViewerDialog(this.dialog, hardeningCheckView(check, this.t.bind(this)));
    platformMaster = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'platform.master.access');
  }

  private language(): string {
    return aiLanguage(this.transloco.getActiveLang());
  }

  private aiError(error: unknown, fallback: string): void {
    this.snack.error(this.t(aiFailureKey(error) ?? (this.errorMessage(error) || fallback)));
  }

  /** cyber_security.vuln_explain: plain-language explanation beside the rule-based fix. */
  async explainFinding(finding: ConfigurableCrudRecord): Promise<void> {
    try {
      const response = await this.api.post<{ data?: Record<string, unknown> }>(
        `cyber-security/vulnerabilities/findings/${encodeURIComponent(String(finding['findingUUID']))}/ai-explain`,
        { code: finding['code'], agentUUID: finding['agentUUID'], language: this.language() },
      );
      openDataViewerDialog(
        this.dialog,
        explanationView(finding, response?.data ?? {}, this.t.bind(this)),
      );
    } catch (error) {
      this.aiError(error, 'cyberSecurity.ai.failed');
    }
  }

  private async showDigest(): Promise<void> {
    try {
      const response = await this.api.post<{ data?: Record<string, unknown> }>(
        'cyber-security/vulnerabilities/ai-digest',
        { language: this.language() },
      );
      const data = response?.data ?? {};
      if (!data['digest']) {
        this.snack.success(this.t('cyberSecurity.ai.nothingOpen'));
        return;
      }
      openDataViewerDialog(this.dialog, digestView(data, this.t.bind(this)));
    } catch (error) {
      this.aiError(error, 'cyberSecurity.ai.failed');
    }
  }

  private async showTriage(): Promise<void> {
    const account = this.listFilterValues()['cyberAccountUUID'];
    try {
      const response = await this.api.post<{ data?: Record<string, unknown> }>(
        'cyber-security/alerts/ai-triage',
        { cyberAccountUUID: account ? String(account) : null, language: this.language() },
      );
      const data = response?.data ?? {};
      if (!((data['groups'] as unknown[] | undefined) ?? []).length) {
        this.snack.success(this.t('cyberSecurity.ai.nothingToTriage'));
        return;
      }
      openDataViewerDialog(this.dialog, triageView(data, this.t.bind(this)));
    } catch (error) {
      this.aiError(error, 'cyberSecurity.ai.failed');
    }
  }

  /** cyber_security.platform_watch, with the exposure table alone when AI is unavailable. */
  private async showPlatformExposure(row: ConfigurableCrudRecord): Promise<void> {
    const code = String(row['code'] ?? '');
    const path = `system/cyber-security/vulnerabilities/${encodeURIComponent(code)}/exposure`;
    try {
      let data: Record<string, unknown> | undefined;
      try {
        data = (
          await this.api.post<{ data?: Record<string, unknown> }>(`${path}/ai-watch`, {
            language: this.language(),
          })
        )?.data;
      } catch (error) {
        if (!aiFailureKey(error)) throw error;
        data = (await this.api.get<{ data?: Record<string, unknown> }>(path))?.data;
      }
      openDataViewerDialog(this.dialog, exposureView(code, data ?? {}, this.t.bind(this)));
    } catch (error) {
      this.aiError(error, 'cyberSecurity.ai.failed');
    }
  }

  /** Patch run detail with the Agent result (V6). */
  async showPatchRun(run: ConfigurableCrudRecord): Promise<void> {
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `cyber-security/patch/runs/${encodeURIComponent(String(run['runUUID']))}`,
      );
      openDataViewerDialog(this.dialog, runView(response?.data ?? run, this.t.bind(this)));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'cyberSecurity.patch.loadFailed'));
    }
  }

  override async handleFilterAction(action: { key: string }): Promise<void> {
    if (action.key === 'exposureFindings') {
      return this.runRowAction(
        {
          key: 'exposureFindings',
          label: 'cyberSecurity.exposure.findings',
          icon: 'report',
          collection: () => exposureFindingsCollection(showExposureFinding),
        },
        {},
      );
    }
    if (action.key === 'patchRuns') {
      return this.runRowAction(
        {
          key: 'patchRuns',
          label: 'cyberSecurity.patch.runs',
          icon: 'history',
          collection: () => patchRunsCollection(showPatchRun),
        },
        {},
      );
    }
    if (action.key === 'aiDigest') return this.showDigest();
    if (action.key === 'aiTriage') return this.showTriage();
    if (action.key !== 'enableAll') return;
    const ok = await this.confirmAction(
      'cyberSecurity.inventory.enableAll',
      'cyberSecurity.inventory.enableAllConfirm',
      'cyberSecurity.inventory.enableAll',
    );
    if (!ok) return;
    try {
      const result = await this.api.post<{ data?: { count?: number } }>(
        'cyber-security/inventory/enable-all',
        {},
      );
      this.snack.success(
        this.t('cyberSecurity.inventory.enabledAll').replace(
          '{{count}}',
          String(result?.data?.count ?? 0),
        ),
      );
      this.refreshList();
    } catch (error) {
      this.snack.error(
        this.t(this.errorMessage(error) || 'cyberSecurity.inventory.enableAllFailed'),
      );
    }
  }

  private async showVulnerability(row: ConfigurableCrudRecord): Promise<void> {
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `cyber-security/vulnerabilities/${encodeURIComponent(String(row['code']))}`,
      );
      const item = response?.data ?? row;
      const code = String(item['code'] ?? '');
      const links = [
        ...(code.startsWith('CVE-') ? [`https://nvd.nist.gov/vuln/detail/${code}`] : []),
        `https://osv.dev/vulnerability/${encodeURIComponent(code)}`,
      ];
      openDataViewerDialog(this.dialog, {
        title: code,
        description: String(item['kevName'] ?? item['summary'] ?? ''),
        status: { label: 'cyberSecurity.vuln.priority', value: String(row['priority'] ?? '') },
        details: [
          { label: 'CVSS', value: item['cvssScore'] ?? '', translate: false },
          {
            label: 'cyberSecurity.vuln.vector',
            value: item['cvssVector'] ?? '',
            monospace: true,
            translate: false,
          },
          { label: 'EPSS', value: item['epssScore'] ?? '', translate: false },
          {
            label: 'cyberSecurity.vuln.epssPercentile',
            value: item['epssPercentile'] ?? '',
            translate: false,
          },
          { label: 'KEV', value: item['kev'] ? this.t('Yes') : this.t('No') },
          { label: 'cyberSecurity.vuln.kevDue', value: item['kevDueDate'] ?? '', translate: false },
          {
            label: 'cyberSecurity.vuln.kevRansomware',
            value: item['kevRansomware'] ? this.t('Yes') : this.t('No'),
          },
          {
            label: 'cyberSecurity.vuln.published',
            value: item['publishedAt'] ?? '',
            kind: 'datetime',
          },
        ],
        sections: [
          ...(item['details'] || item['summary']
            ? [
                {
                  title: 'cyberSecurity.vuln.description',
                  message: item['details'] ?? item['summary'],
                },
              ]
            : []),
          ...(item['kevAction']
            ? [{ title: 'cyberSecurity.vuln.kevAction', message: item['kevAction'] }]
            : []),
          {
            title: 'cyberSecurity.vuln.references',
            code: { value: links.join('\n'), format: 'text', copy: true },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'cyberSecurity.vuln.loadFailed'));
    }
  }

  /** Rule-based "how to fix" of one finding (command, restart, advisory and links from the API). */
  showRemediation(finding: ConfigurableCrudRecord): void {
    const fix = (finding['remediation'] ?? {}) as {
      action?: string;
      command?: string | null;
      restart?: string;
      advisory?: string | null;
      advisoryUrl?: string | null;
      links?: Array<{ kind: string; url: string }>;
    };
    const update = fix.action === 'update';
    const links = [
      ...(fix.advisoryUrl ? [fix.advisoryUrl] : []),
      ...(fix.links ?? []).map((link) => link.url),
    ];
    openDataViewerDialog(this.dialog, {
      title: 'cyberSecurity.vuln.howToFix',
      description: `${finding['code'] ?? ''} · ${finding['agentName'] ?? ''}`,
      details: [
        { label: 'cyberSecurity.vuln.package', value: finding['package'] ?? '', translate: false },
        {
          label: 'cyberSecurity.vuln.installed',
          value: finding['installedVersion'] ?? '',
          monospace: true,
          translate: false,
        },
        {
          label: 'cyberSecurity.vuln.fixedVersion',
          value: finding['fixedVersion'] ?? '',
          monospace: true,
          translate: false,
        },
        { label: 'cyberSecurity.vuln.advisory', value: fix.advisory ?? '', translate: false },
        {
          label: 'cyberSecurity.vuln.exposed',
          value: finding['exposed'] ? this.t('Yes') : this.t('No'),
        },
        {
          label: 'cyberSecurity.vuln.attacked',
          value: finding['attacked'] ? this.t('Yes') : this.t('No'),
        },
        ...(finding['status'] === 'accepted_risk'
          ? [
              {
                label: 'cyberSecurity.vuln.riskUntil',
                value: finding['riskAcceptedUntil'] ?? '',
                kind: 'datetime' as const,
              },
              { label: 'cyberSecurity.vuln.riskReason', value: finding['riskReason'] ?? '' },
              {
                label: 'cyberSecurity.vuln.riskAcceptedVia',
                value: this.t(`cyberSecurity.vuln.riskVia.${finding['riskAcceptedVia'] ?? 'app'}`),
              },
            ]
          : []),
      ],
      sections: [
        update && fix.command
          ? {
              title: 'cyberSecurity.vuln.updateCommand',
              code: { value: fix.command, format: 'shell', copy: true },
            }
          : {
              title: 'cyberSecurity.vuln.mitigate',
              message: this.t('cyberSecurity.vuln.mitigateSteps'),
            },
        {
          title: 'cyberSecurity.vuln.restart',
          message: this.t(`cyberSecurity.vuln.restart.${fix.restart ?? 'service'}`),
        },
        ...(links.length
          ? [
              {
                title: 'cyberSecurity.vuln.references',
                code: { value: links.join('\n'), format: 'text' as const, copy: true },
              },
            ]
          : []),
      ],
    });
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'jobs') await this.showJobs(row);
    if (action.key === 'details') this.showDetails(row);
    if (action.key === 'vulnerability') await this.showVulnerability(row);
    if (action.key === 'platformExposure') await this.showPlatformExposure(row);
  }

  private async showJobs(row: ConfigurableCrudRecord): Promise<void> {
    if (!row['agentUUID']) return;
    try {
      const params = new URLSearchParams({ agentUUID: String(row['agentUUID']), limit: '20' });
      const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        `cyber-security/jobs?${params.toString()}`,
      );
      openDataViewerDialog(this.dialog, {
        title: 'Job details',
        description: String(row['agentName'] ?? row['agentUUID']),
        sections: [
          {
            title: 'Recent jobs',
            table: {
              columns: [
                { key: 'command', label: 'Command', monospace: true, translate: false },
                { key: 'status', label: 'Status' },
                { key: 'progressPercent', label: 'Progress' },
                { key: 'progressMessage', label: 'Message', translate: false },
                { key: 'dateCreated', label: 'Created at', kind: 'datetime' },
              ],
              rows: response?.data?.items ?? [],
              emptyLabel: 'No jobs found.',
            },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'Failed to load job details.'));
    }
  }

  private showDetails(row: ConfigurableCrudRecord): void {
    openDataViewerDialog(this.dialog, {
      title: 'Details',
      sections: [{ title: 'Record', code: { value: row, format: 'json', copy: true } }],
    });
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled'] ?? 1),
      reason: payload['reason'] || null,
    };
  }
}
