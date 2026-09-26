import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';

type CyberSection = 'servers' | 'decisions' | 'alerts' | 'lists' | 'security-events';

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
        span: 4,
      },
    ],
    payload: (values) => ({
      agentUUID: row['agentUUID'],
      profileUUID: values['profileUUID'] || null,
    }),
  });
}

const CONFIGS: Record<CyberSection, ConfigurableCrudConfig> = {
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
    pageTitle: 'Decisions',
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
      { key: 'reason', source: 'reason', label: 'Reason', span: 4 },
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
    const section = inject(ActivatedRoute).snapshot.paramMap.get('section') as CyberSection | null;
    super(CONFIGS[section ?? 'servers'] ?? CONFIGS.servers);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'jobs') await this.showJobs(row);
    if (action.key === 'details') this.showDetails(row);
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
