import { Component, computed, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import {
  DataViewerTone,
  openDataViewerDialog,
} from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import type { HostingVpsPlan } from '../vps.types';

const ENDPOINT = 'system/hosting/vps/platform-pools';

type PoolMember = {
  HviUUID: string;
  name: string;
  status: string | null;
  node: string | null;
  agentStatus: string | null;
  runtimeStatus: string | null;
  adopted: boolean;
  live: boolean;
  failure?: PoolMemberFailure | null;
};

type PoolMemberFailure = {
  reason?: string | null;
  since?: string | null;
  replacedBy?: string | null;
  suspect?: boolean;
};

type PoolState = {
  status?: string | null;
  message?: string | null;
  createAttempts?: number | null;
  lastCreatedName?: string | null;
};

/** Translated labels of `HpoState.status`; the English `HpoState.message` is never shown. */
const STATE_LABELS: Record<string, string> = {
  converged: 'Converged',
  degraded: 'Degraded',
  replacing: 'Replacing server',
  creating: 'Creating server',
  paused: 'Paused',
  excess: 'Extra servers',
  blocked: 'Blocked',
  failed: 'Failed',
};

const STATE_TONES: Record<string, DataViewerTone> = {
  converged: 'success',
  degraded: 'warning',
  replacing: 'info',
  creating: 'info',
  paused: 'warning',
  excess: 'warning',
  blocked: 'warning',
  failed: 'danger',
};

/** Reconcile creates at most this many attempts before the pool is marked as failed. */
const MAX_CREATE_ATTEMPTS = 3;

const NO_STATE_LABEL = 'Waiting for reconcile';

const MODE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'paused', label: 'Paused' },
];

const FAILURE_LABELS: Record<string, string> = {
  vm_missing: 'VM missing in the cluster',
  node_down: 'Node down',
  vm_not_running: 'VM stopped in Proxmox',
  agent_silent: 'Agent not responding',
};

const REPAIR_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'automatic', label: 'Repair automatic' },
  { value: 'paused', label: 'Repair paused' },
];

const MEMBERS_ACTION: ConfigurableCrudRowAction = {
  key: 'members',
  label: 'Members',
  icon: 'dns',
  tooltip: 'Show the servers of this pool',
};

const AGENT_LABELS: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  enrolled: 'Installed',
  installing: 'Installing',
  failed: 'Install failed',
};

const RUNTIME_LABELS: Record<string, string> = {
  installing: 'Installing',
  operational: 'In operation',
  failed: 'Install failed',
};

function stateOf(row: ConfigurableCrudRecord): PoolState | null {
  const state = row['HpoState'];
  return state && typeof state === 'object' ? (state as PoolState) : null;
}

function templateOf(row: ConfigurableCrudRecord): Record<string, unknown> {
  const template = row['HpoTemplate'];
  return template && typeof template === 'object' ? (template as Record<string, unknown>) : {};
}

function membersOf(row: ConfigurableCrudRecord): PoolMember[] {
  const members = row['members'];
  return Array.isArray(members) ? (members as PoolMember[]) : [];
}

function failureText(
  failure: PoolMemberFailure | null | undefined,
  translate: (text: string) => string,
  formatDateTime: (value: string) => string,
): string {
  if (!failure) return '-';
  const reason = String(failure.reason ?? '');
  const parts = [translate(FAILURE_LABELS[reason] ?? reason)];
  if (failure.since)
    parts.push(`${translate('Since')} ${formatDateTime(failure.since) || failure.since}`);
  if (failure.suspect) parts.push(translate('suspect'));
  if (failure.replacedBy) {
    parts.push(translate('replaced by {{name}}').replace('{{name}}', failure.replacedBy));
  }
  return parts.join(' · ');
}

function stateLabel(row: ConfigurableCrudRecord): string {
  const status = String(stateOf(row)?.status ?? '');
  return STATE_LABELS[status] ?? NO_STATE_LABEL;
}

const POOL_FIELDS: ConfigurableCrudField[] = [
  {
    key: 'group',
    source: 'HpoGroup',
    payloadKey: 'group',
    label: 'Group',
    placeholder: 'dns-prod',
    required: true,
    span: 1,
    disabledWhen: ({ editing }) => editing,
    help: 'Platform group in the format role-environment, for example dns-prod. It cannot be changed after creation.',
  },
  {
    key: 'desiredCount',
    source: 'HpoDesiredCount',
    payloadKey: 'desiredCount',
    label: 'Desired servers',
    type: 'number',
    required: true,
    span: 1,
    help: 'Number of servers the platform keeps in this group (1 to 9). It creates the missing ones, one at a time, and never removes any.',
  },
  {
    key: 'mode',
    source: 'HpoMode',
    payloadKey: 'mode',
    label: 'Mode',
    type: 'select',
    options: MODE_OPTIONS,
    translateOptions: true,
    required: true,
    span: 1,
  },
  {
    key: 'repair',
    source: 'HpoRepair',
    payloadKey: 'repair',
    label: 'Automatic repair',
    type: 'select',
    options: REPAIR_OPTIONS,
    translateOptions: true,
    span: 1,
    help: 'When a server of the group stops responding for 30 minutes, the platform creates another one in its place. The failed server is never deleted: retire it afterwards.',
  },
  {
    key: 'planUUID',
    source: 'HostingVpsPlanHvpUUID',
    payloadKey: 'planUUID',
    label: 'Plan',
    type: 'search-select',
    required: true,
    span: 1,
    quickCreate: false,
    quickCreateExemptReason: 'Plans of the platform catalog are managed in their own page.',
  },
  {
    key: 'providerImageId',
    payloadKey: 'providerImageId',
    label: 'Image',
    placeholder: 'ubuntu-24.04',
    span: 1,
    fromRecord: (_value, record) => String(templateOf(record)['providerImageId'] ?? ''),
    help: 'Provider image identifier. Empty uses the image of the plan.',
  },
  {
    key: 'username',
    payloadKey: 'username',
    label: 'User',
    placeholder: 'root',
    span: 1,
    fromRecord: (_value, record) => String(templateOf(record)['username'] ?? ''),
  },
  {
    key: 'sshKey',
    payloadKey: 'sshKey',
    label: 'SSH Key',
    placeholder: 'ssh-ed25519 AAAA... comment',
    required: true,
    type: 'textarea',
    rows: 4,
    span: 4,
    fromRecord: (_value, record) => String(templateOf(record)['sshKey'] ?? ''),
    help: 'Public keys only, one per line. New servers are created with these keys.',
  },
];

/** Service pools of the platform: desired number of servers per group (master). */
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'HpoUUID',
  pageTitle: 'Platform server pools',
  pageDescription:
    'Desired number of platform servers per group. The platform creates the missing servers automatically.',
  createTitle: 'New service pool',
  editTitle: 'Edit service pool',
  dialogDescription:
    'The platform creates missing servers with this plan and template and never removes existing ones.',
  searchPlaceholder: 'Group',
  emptyLabel: 'No service pools found.',
  deleteTitle: 'Delete service pool',
  deleteMessage:
    'Delete this pool? Only the pool record is removed: no server is removed or stopped, and the platform will not recreate the pool automatically.',
  deleteSelectedTitle: 'Delete selected service pools',
  deleteSelectedMessage: 'Delete {count} selected service pool(s)?',
  savedMessage: 'Service pool saved successfully.',
  deletedMessage: 'Service pool deleted.',
  deleteFailedMessage: 'Failed to delete service pool.',
  bulkDelete: false,
  rowActions: [MEMBERS_ACTION],
  pageSizeOptions: [10, 25, 100],
  initialValues: {
    group: '',
    desiredCount: 1,
    mode: 'automatic',
    repair: 'automatic',
    planUUID: '',
    providerImageId: '',
    username: '',
    sshKey: '',
  },
  fields: [],
  columns: [
    { id: 'group', label: 'Group', kind: 'identity', field: 'HpoGroup', uuidField: 'HpoUUID' },
    {
      id: 'members',
      label: 'Members',
      rowAction: 'members',
      value: (row) => `${Number(row['liveCount'] ?? 0)}/${Number(row['HpoDesiredCount'] ?? 0)}`,
    },
    {
      id: 'state',
      label: 'State',
      value: (row, translate) => translate(stateLabel(row)),
      detail: (row, translate) => {
        const state = stateOf(row);
        const parts: string[] = [];
        if (state?.status === 'blocked' || state?.status === 'failed') {
          parts.push(translate('Save the pool to try again'));
        }
        if (state?.lastCreatedName) {
          parts.push(`${translate('Last created')}: ${state.lastCreatedName}`);
        }
        const attempts = Number(state?.createAttempts ?? 0);
        if (attempts > 0) {
          parts.push(
            translate('Attempts: {{attempts}} of {{max}}')
              .replace('{{attempts}}', String(attempts))
              .replace('{{max}}', String(MAX_CREATE_ATTEMPTS)),
          );
        }
        return parts.join(' · ');
      },
    },
    {
      id: 'repair',
      label: 'Repair',
      field: 'HpoRepair',
      options: REPAIR_OPTIONS,
      translateValue: true,
      value: (row, translate) =>
        translate(
          String(row['HpoRepair'] ?? '') === 'paused' ? 'Repair paused' : 'Repair automatic',
        ),
    },
    { id: 'plan', label: 'Plan', field: 'PlanName' },
    {
      id: 'mode',
      label: 'Mode',
      field: 'HpoMode',
      options: MODE_OPTIONS,
      translateValue: true,
      value: (row, translate) =>
        translate(String(row['HpoMode'] ?? '') === 'paused' ? 'Paused' : 'Automatic'),
    },
    {
      id: 'source',
      label: 'Origin',
      value: (row, translate) =>
        translate(String(row['HpoSource'] ?? '') === 'master' ? 'Master' : 'Default'),
    },
    { id: 'updated', label: 'Updated', kind: 'datetime', field: 'HpoDateUpdated' },
  ],
});

@Component({
  selector: 'app-hosting-vps-platform-pools',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsPlatformPoolsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly plans = signal<HostingVpsPlan[]>([]);
  private readonly planOptions = computed<ConfigurableCrudOption[]>(() => {
    const selected = String(this.formValues()['planUUID'] ?? '');
    return this.plans()
      .filter((plan) => plan.HvpIsActive === 1 || plan.HvpUUID === selected)
      .map((plan) => ({
        value: plan.HvpUUID,
        label: plan.HvpName,
        description: [plan.HvpProvider, plan.HvpRegion, plan.HvpSize].filter(Boolean).join(' · '),
        searchText: [plan.HvpName, plan.HvpProvider, plan.HvpRegion, plan.HvpSize]
          .filter(Boolean)
          .join(' '),
      }));
  });

  constructor() {
    super({ ...config, fields: POOL_FIELDS });
    void this.fetchPlans();
  }

  override rowActions(): readonly ConfigurableCrudRowAction[] {
    return [MEMBERS_ACTION];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'members') this.showMembers(row);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'planUUID' ? this.planOptions() : [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.plans().length) await this.fetchPlans();
    const response = await this.api.get(ENDPOINT);
    const items = (response as { data?: { items?: ConfigurableCrudRecord[] } })?.data?.items ?? [];
    const search = String(filters.search ?? '')
      .trim()
      .toLowerCase();
    const planNames = new Map(this.plans().map((plan) => [plan.HvpUUID, plan.HvpName]));
    const rows: ConfigurableCrudRecord[] = items.map((item) => ({
      ...item,
      PlanName: planNames.get(String(item['HostingVpsPlanHvpUUID'] ?? '')) ?? '-',
    }));
    return search
      ? rows.filter((item) =>
          String(item['HpoGroup'] ?? '')
            .toLowerCase()
            .includes(search),
        )
      : rows;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const template: Record<string, string> = {
      sshKey: String(payload['sshKey'] ?? '').trim(),
    };
    const providerImageId = String(payload['providerImageId'] ?? '').trim();
    const username = String(payload['username'] ?? '').trim();
    if (providerImageId) template['providerImageId'] = providerImageId;
    if (username) template['username'] = username;
    const body: ConfigurableCrudRecord = {
      desiredCount: Number(payload['desiredCount']),
      mode: payload['mode'] || 'automatic',
      repair: payload['repair'] || 'automatic',
      planUUID: payload['planUUID'],
      template,
    };
    const group = String(payload['group'] ?? '').trim();
    if (group) body['group'] = group;
    return body;
  }

  private showMembers(row: ConfigurableCrudRecord) {
    const state = stateOf(row);
    const status = String(state?.status ?? '');
    const members = membersOf(row);
    openDataViewerDialog(this.dialog, {
      title: this.t('Pool members'),
      description: this.t('Servers of this group and the Agent and runtime of each one.'),
      status: {
        label: 'State',
        value: this.t(stateLabel(row)),
        tone: STATE_TONES[status] ?? 'info',
      },
      details: [
        { label: 'Group', value: row['HpoGroup'] },
        {
          label: 'Members',
          value: `${Number(row['liveCount'] ?? 0)}/${Number(row['HpoDesiredCount'] ?? 0)}`,
        },
      ],
      sections: [
        {
          title: this.t('Members'),
          table: {
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status' },
              { key: 'node', label: 'Node' },
              { key: 'failure', label: 'Failure' },
              { key: 'agent', label: 'Agent', translate: true },
              { key: 'runtime', label: 'Runtime', translate: true },
            ],
            rows: members.map((member) => ({
              name: member.name,
              status: member.status ?? '-',
              node: member.node ?? '-',
              failure: failureText(
                member.failure,
                (text) => this.t(text),
                (value) => this.dateTime.formatDateTime(value),
              ),
              agent: AGENT_LABELS[String(member.agentStatus ?? '')] ?? member.agentStatus ?? '-',
              runtime:
                RUNTIME_LABELS[String(member.runtimeStatus ?? '')] ?? member.runtimeStatus ?? '-',
            })),
          },
        },
      ],
    });
  }

  private async fetchPlans() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsPlan[] } }>(
        'system/hosting/vps/plans?limit=500&offset=0',
      );
      this.plans.set(Array.isArray(result?.data?.items) ? result.data.items : []);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS plans.'));
    }
  }
}
