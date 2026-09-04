import { Component, computed, inject, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilterAction,
  ConfigurableCrudFilterActionMenu,
  ConfigurableCrudFilters,
  ConfigurableCrudListParams,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { InstallCommandDialogComponent } from '../../../shared/install-command-dialog/install-command-dialog';
import { AuthService } from '../../../services/auth.service';

type MonitoringAgent = ConfigurableCrudRecord & {
  uuid: string;
  name?: string | null;
  installLabel?: string | null;
  type?: string | null;
  capabilities?: string | null;
  resourceType?: string | null;
  resourceUUID?: string | null;
  resourceLabel?: string | null;
  hostname?: string | null;
  version?: string | null;
  buildRef?: string | null;
  latestVersion?: string | null;
  latestBuildRef?: string | null;
  updateStatus?: string | null;
  remoteUpdateSupported?: boolean | null;
  runtimeUpdates?: RuntimeUpdateTarget[] | null;
  status?: number | null;
  connectionStatus?: string | null;
  lastHeartbeatAt?: string | null;
  uptimeSeconds?: number | null;
};

type RuntimeUpdateTarget = {
  product: string;
  label: string;
  capability: string;
  hasCapability: boolean;
  installedVersion?: string | null;
  installedBuildRef?: string | null;
  latestVersion?: string | null;
  latestBuildRef?: string | null;
  targetRef?: string | null;
  updateStatus?: string | null;
  available?: boolean | null;
};

type RuntimeProductFleet = {
  product: string;
  label: string;
  canRequest: boolean;
  latestVersion?: string | null;
  targetRef?: string | null;
  nodeCount: number;
  availableCount: number;
  pendingCount?: number | null;
  runningCount?: number | null;
  failedCount?: number | null;
  rolloutStatus?: string | null;
};

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'online', label: 'Online' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'offline', label: 'Offline' },
];

const RECORD_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'linux.status', label: 'linux.status' },
  { value: 'mnscloud.agent.update', label: 'mnscloud.agent.update' },
  { value: 'mnscloud.api.update', label: 'mnscloud.api.update' },
  { value: 'mnscloud.app.update', label: 'mnscloud.app.update' },
  { value: 'security.nftables.manage', label: 'security.nftables.manage' },
  { value: 'security.crowdsec.manage', label: 'security.crowdsec.manage' },
  { value: 'security.logs.read', label: 'security.logs.read' },
  { value: 'voip.asterisk.manage', label: 'voip.asterisk.manage' },
  { value: 'voip.freeswitch.manage', label: 'voip.freeswitch.manage' },
  { value: 'realtime.turn.manage', label: 'realtime.turn.manage' },
  { value: 'docker.manage', label: 'docker.manage' },
];

const INSTALL_ACTION: ConfigurableCrudRowAction = {
  key: 'install',
  label: 'Install command',
  icon: 'terminal',
  tooltip: 'Generate install command',
};

const UPDATE_AGENT_ACTION: ConfigurableCrudRowAction = {
  key: 'update-agent',
  label: 'Update Agent',
  icon: 'published_with_changes',
  tooltip: 'Queue Agent update',
};

const AGENTS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'monitoring/agents',
  createEndpoint: 'monitoring/agents/enrollments',
  uuidField: 'uuid',
  pageTitle: 'Agents',
  pageDescription: 'Register agents, assign resources, and monitor heartbeat health.',
  createTitle: 'New agent',
  editTitle: 'Edit agent',
  dialogDescription: 'Update the agent identity, capabilities, and assigned resource.',
  searchPlaceholder: 'Name, UUID, host, resource',
  emptyLabel: 'No agents found.',
  deleteTitle: 'Confirm delete',
  deleteMessage: 'Delete this agent?',
  deleteSelectedTitle: 'Confirm delete',
  deleteSelectedMessage: 'Delete {count} selected agent(s)?',
  savedMessage: 'Agent saved.',
  deletedMessage: 'Agent deleted.',
  deleteFailedMessage: 'Failed to delete agent.',
  initialValues: {
    agentUUID: '',
    name: '',
    hostname: '',
    status: 1,
    capabilitiesText: 'linux.status',
    resourceType: '',
    resourceUUID: '',
  },
  statusMode: 'string',
  activeValue: 'online',
  inactiveValue: 'offline',
  activeStatusValues: ['online'],
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  bulkDelete: true,
  rowActions: [INSTALL_ACTION],
  filterActionMenu: {
    label: 'Runtime updates',
    icon: 'published_with_changes',
    tooltip: 'Queue runtime product updates',
    actions: [],
  },
  listFilters: [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: TYPE_OPTIONS,
    },
  ],
  fields: [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: RECORD_STATUS_OPTIONS,
      tab: 'record',
      span: 1,
      required: true,
    },
    { key: 'name', label: 'Name', type: 'text', tab: 'record', span: 1, required: true },
    { key: 'hostname', label: 'Hostname', type: 'text', tab: 'record', span: 1 },
    {
      key: 'agentUUID',
      label: 'Agent UUID',
      type: 'text',
      tab: 'record',
      span: 1,
      placeholder: 'Optional for new enrollments; the installer creates the UUID.',
    },
    {
      key: 'resourceType',
      label: 'Resource Type',
      type: 'text',
      tab: 'routing',
      span: 1,
      placeholder: 'e.g. voip.pabx.server',
    },
    { key: 'resourceUUID', label: 'Resource UUID', type: 'text', tab: 'routing', span: 1 },
    {
      key: 'capabilitiesText',
      label: 'Capabilities',
      type: 'textarea',
      tab: 'routing',
      span: 4,
      rows: 4,
      placeholder: 'linux.status\nsecurity.nftables.manage\nsecurity.crowdsec.manage',
    },
  ],
  tabLabels: {
    routing: 'Assignment',
  },
  columns: [
    {
      id: 'connectionStatus',
      label: 'Status',
      field: 'connectionStatus',
      kind: 'status',
      options: STATUS_OPTIONS,
      chipClass: (value) => agentStatusClass(value),
    },
    {
      id: 'name',
      label: 'Name',
      field: 'name',
      uuidField: 'uuid',
      kind: 'identity',
      copyable: true,
    },
    { id: 'type', label: 'Type', field: 'type' },
    {
      id: 'resource',
      label: 'Resource',
      field: 'resourceLabel',
      uuidField: 'resourceType',
      kind: 'related',
    },
    { id: 'hostname', label: 'Host', field: 'hostname' },
    { id: 'agentVersion', label: 'Agent', field: 'agentVersionText' },
    { id: 'uptime', label: 'Uptime', field: 'uptimeText' },
    { id: 'heartbeat', label: 'Heartbeat', field: 'lastHeartbeatAt', kind: 'datetime' },
  ],
  initialPageSize: 10,
  pageSizeOptions: [5, 10, 25, 100],
};

@Component({
  selector: 'app-monitoring-agents',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class MonitoringAgentsPage extends ConfigurableCrudPageBase<MonitoringAgent> {
  private readonly auth = inject(AuthService);

  readonly generatedToken = signal('');
  readonly runtimeProducts = signal<RuntimeProductFleet[]>([]);
  readonly updatingIds = signal(new Set<string>());
  readonly updatingProducts = signal(new Set<string>());

  private readonly isMaster = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('platform.master.access')
  );
  private readonly canUpdateTenantAgent = computed(() =>
    this.isMaster() ||
    (this.auth.user()?.permissions ?? []).includes('tenant.access.manage'),
  );

  constructor() {
    super(AGENTS_CONFIG);
  }

  override filterActionMenu(): ConfigurableCrudFilterActionMenu | null {
    return {
      label: 'Runtime updates',
      icon: 'published_with_changes',
      tooltip: 'Queue runtime product updates',
      actions: this.runtimeProducts()
        .filter((product) => this.canUpdateRuntimeProduct(product))
        .map((product) => ({
          key: `runtime:${product.product}`,
          label: `${product.label} ${product.latestVersion ?? product.targetRef ?? ''}`.trim(),
          icon: 'published_with_changes',
          tooltip: this.runtimeProductReason(product),
        })),
    };
  }

  override rowActions(row: MonitoringAgent): readonly ConfigurableCrudRowAction[] {
    const actions = [INSTALL_ACTION];
    const target = this.agentUpdateTarget(row);
    return target ? [...actions, UPDATE_AGENT_ACTION] : actions;
  }

  override isFilterActionDisabled(action: ConfigurableCrudFilterAction): boolean {
    if (!action.key.startsWith('runtime:')) return false;
    const product = this.runtimeProducts().find((item) => action.key === `runtime:${item.product}`);
    return !product || !this.canUpdateRuntimeProduct(product);
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction) {
    if (!action.key.startsWith('runtime:')) return;
    const productName = action.key.slice('runtime:'.length);
    const product = this.runtimeProducts().find((item) => item.product === productName);
    if (product) await this.queueRuntimeProductUpdate(product);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: MonitoringAgent) {
    if (action.key === 'install') {
      await this.generateInstallCommand(row);
      return;
    }
    if (action.key === 'update-agent') {
      const target = this.agentUpdateTarget(row);
      if (target) await this.queueRuntimeUpdate(row, target);
    }
  }

  override async deleteSelectedItems(): Promise<void> {
    const ids = [...this.selectedUUIDs()];
    if (!ids.length) return;
    const confirmed = await this.confirmAction(
      'Confirm delete',
      `Delete ${ids.length} selected agent(s)?`,
      'Delete',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      const response = await this.api.delete<{ data?: { failed?: { uuid?: string }[] } }>(
        'monitoring/agents/bulk',
        { ids },
      );
      const failedIds = (response.data?.failed ?? []).map((item) => item.uuid).filter(Boolean);
      this.selectedUUIDs.set(new Set(failedIds as string[]));
      if (failedIds.length) {
        this.snack.warning(
          `${ids.length - failedIds.length} ${this.transloco.translate('agent(s) deleted;')} ${failedIds.length} ${this.transloco.translate('failed.')}`,
        );
      } else {
        this.snack.success(this.transloco.translate('Selected agents deleted.'));
      }
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to delete selected agents.');
    } finally {
      this.mutating.set(false);
    }
  }

  protected override async fetchItems(
    filters: ConfigurableCrudFilters | ConfigurableCrudListParams,
  ): Promise<MonitoringAgent[]> {
    const [agentsResult, runtimeProductsResult] = await Promise.allSettled([
      this.api.get<{ data?: { items?: MonitoringAgent[] } }>(
        `monitoring/agents${this.queryString(filters)}`,
      ),
      this.api.get<{ data?: RuntimeProductFleet[] }>('monitoring/agents/runtime-products'),
    ]);

    if (runtimeProductsResult.status === 'fulfilled') {
      this.runtimeProducts.set(runtimeProductsResult.value.data ?? []);
    } else {
      this.snack.error(
        this.errorMessage(runtimeProductsResult.reason) || 'Failed to load runtime products.',
      );
    }

    if (agentsResult.status === 'rejected') throw agentsResult.reason;
    return (agentsResult.value.data?.items ?? []).map((row) => this.decorateAgent(row));
  }

  protected override formValuesFromRecord(row: MonitoringAgent): ConfigurableCrudRecord {
    return {
      agentUUID: row.uuid,
      name: row.name ?? '',
      hostname: row.hostname ?? '',
      status: row.status === 0 ? 0 : 1,
      capabilitiesText: this.capabilitiesText(row),
      resourceType: row.resourceType ?? '',
      resourceUUID: row.resourceUUID ?? '',
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      agentUUID: String(payload['agentUUID'] ?? '').trim() || null,
      name: String(payload['name'] ?? '').trim(),
      hostname: String(payload['hostname'] ?? '').trim() || null,
      status: Number(payload['status'] ?? 1),
      capabilities: this.parseCapabilities(String(payload['capabilitiesText'] ?? '')),
      resourceType: String(payload['resourceType'] ?? '').trim() || null,
      resourceUUID: String(payload['resourceUUID'] ?? '').trim() || null,
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!String(payload['name'] ?? '').trim()) {
      this.snack.error(this.transloco.translate('Name is required.'));
      return false;
    }
    return true;
  }

  protected override async afterSave(context: ConfigurableCrudSaveContext<MonitoringAgent>) {
    if (context.mode === 'create') {
      const response = context.response as { data?: { enrollmentToken?: string } };
      this.generatedToken.set(response.data?.enrollmentToken ?? '');
      this.snack.success(
        this.transloco.translate('Agent enrollment created. Copy the install command.'),
      );
      this.openTokenDialog();
    }
  }

  private async generateInstallCommand(row: MonitoringAgent) {
    const confirmed = await this.confirmAction(
      'Generate install command',
      `Generate a short-lived install command for agent ${row.name || row.uuid}? The runtime token will be issued directly to the server when the enrollment is consumed.`,
      'Generate command',
    );
    if (!confirmed) return;
    const response = await this.api.post<{ data?: { enrollmentToken?: string } }>(
      `monitoring/agents/${row.uuid}/enrollments`,
      {},
    );
    this.generatedToken.set(response.data?.enrollmentToken ?? '');
    this.openTokenDialog();
    this.snack.success(this.transloco.translate('Agent enrollment command generated.'));
  }

  private async queueRuntimeUpdate(row: MonitoringAgent, target: RuntimeUpdateTarget) {
    const targetRef =
      target.targetRef ||
      (target.latestVersion ? `v${target.latestVersion}` : 'the latest release');
    const confirmed = await this.confirmAction(
      `Update ${target.label}`,
      `Queue remote update for ${row.name || row.uuid} to ${targetRef}? The selected runtime will update by explicit release tag.`,
      'Queue update',
    );
    if (!confirmed) return;
    const key = this.updateKey(row, target);
    this.updatingIds.update((current) => new Set(current).add(key));
    try {
      await this.api.post(`monitoring/agents/${row.uuid}/update`, { product: target.product });
      this.snack.success(`${target.label} ${this.transloco.translate('update queued.')}`);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || `Failed to queue ${target.label} update.`);
    } finally {
      this.updatingIds.update((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  private async queueRuntimeProductUpdate(product: RuntimeProductFleet) {
    const target = product.targetRef || product.latestVersion || 'the latest release';
    const confirmed = await this.confirmAction(
      `Update ${product.label}`,
      `Queue ${product.label} runtime update to ${target}? The API will update the next eligible online batch for this product.`,
      'Queue update',
    );
    if (!confirmed) return;
    this.updatingProducts.update((current) => new Set(current).add(product.product));
    try {
      const response = await this.api.post<{ data?: { jobs?: unknown[]; skipped?: unknown[] } }>(
        `monitoring/agents/runtime-products/${product.product}/update`,
        {},
      );
      const queued = response.data?.jobs?.length ?? 0;
      const skipped = response.data?.skipped?.length ?? 0;
      if (queued > 0)
        this.snack.success(
          `${product.label} ${this.transloco.translate('rollout queued for')} ${queued} node(s).`,
        );
      else if (skipped > 0)
        this.snack.success(
          `${product.label} ${this.transloco.translate('rollout already has pending or current node(s).')}`,
        );
      else
        this.snack.success(
          `${product.label} ${this.transloco.translate('is already up to date.')}`,
        );
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || `Failed to queue ${product.label} rollout.`);
    } finally {
      this.updatingProducts.update((current) => {
        const next = new Set(current);
        next.delete(product.product);
        return next;
      });
    }
  }

  private openTokenDialog() {
    const token = this.generatedToken();
    if (!token) return;
    this.dialog.open(InstallCommandDialogComponent, {
      panelClass: 'install-command-dialog-panel',
      disableClose: true,
      maxWidth: '92vw',
      width: '920px',
      data: {
        title: 'Agent install command',
        description: 'Run this command on the server that should be enrolled as an Agent.',
        warning:
          'This enrollment token is short-lived and shown only once. The runtime Agent token is issued directly to the server and is never displayed in the browser.',
        details: [
          { label: 'API base', value: window.location.origin, monospace: true },
          { label: 'Resource type', value: 'mnscloud.agent', monospace: true },
        ],
        command: this.tokenCommand(token),
      },
    });
  }

  private decorateAgent(row: MonitoringAgent): MonitoringAgent {
    return {
      ...row,
      connectionStatus: row.connectionStatus || 'offline',
      resourceLabel: row.resourceLabel || row.resourceUUID || '-',
      agentVersionText: this.agentVersionText(row),
      uptimeText: this.formatUptime(row.uptimeSeconds),
    };
  }

  private queryString(filters: ConfigurableCrudFilters | ConfigurableCrudListParams) {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', String(filters.status));
    const type = filters.extra?.['type'];
    if (type) params.set('type', String(type));
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  private agentUpdateTarget(row: MonitoringAgent) {
    const target = (row.runtimeUpdates ?? []).find((item) => item.product === 'mnscloud-agent');
    return target && this.canUpdateTarget(row, target) ? target : null;
  }

  private canUpdateTarget(row: MonitoringAgent, target: RuntimeUpdateTarget) {
    const hasRole =
      target.product === 'mnscloud-agent' ? this.canUpdateTenantAgent() : this.isMaster();
    return (
      hasRole &&
      row.connectionStatus === 'online' &&
      row.remoteUpdateSupported === true &&
      target.available === true &&
      target.hasCapability === true &&
      this.isRuntimeTargetNewer(target)
    );
  }

  private canUpdateRuntimeProduct(product: RuntimeProductFleet) {
    return (
      product.canRequest === true &&
      product.availableCount > 0 &&
      !this.runtimeProductBusy(product) &&
      Boolean(product.latestVersion || product.targetRef) &&
      !this.updatingProducts().has(product.product)
    );
  }

  private runtimeProductBusy(product: RuntimeProductFleet) {
    return (
      (product.pendingCount ?? 0) > 0 ||
      (product.runningCount ?? 0) > 0 ||
      product.rolloutStatus === 'updating'
    );
  }

  private runtimeProductReason(product: RuntimeProductFleet) {
    if (this.runtimeProductBusy(product)) return 'Rollout job is already pending or running.';
    if ((product.failedCount ?? 0) > 0 || product.rolloutStatus === 'failed') {
      return 'Review the failed runtime update job before retrying.';
    }
    if (product.nodeCount <= 0) return 'No Agent has reported this runtime product as installed.';
    if (product.availableCount > 0)
      return 'Update available for nodes with the required capability.';
    return 'All reporting nodes are on the latest release.';
  }

  private isRuntimeTargetNewer(target: RuntimeUpdateTarget) {
    const installedVersion = target.installedVersion?.trim();
    const latestVersion = target.latestVersion?.trim();
    if (!installedVersion || !latestVersion) return true;
    const versionDiff = this.compareSemver(latestVersion, installedVersion);
    if (versionDiff !== 0) return versionDiff > 0;
    const latestBuildRef = target.latestBuildRef?.trim();
    const installedBuildRef = target.installedBuildRef?.trim();
    return Boolean(latestBuildRef && latestBuildRef !== installedBuildRef);
  }

  private compareSemver(left: string, right: string) {
    const leftParts = left.replace(/^v/i, '').split(/[+-]/)[0].split('.').map(Number);
    const rightParts = right.replace(/^v/i, '').split(/[+-]/)[0].split('.').map(Number);
    for (let index = 0; index < 3; index += 1) {
      const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  private updateKey(row: MonitoringAgent, target: RuntimeUpdateTarget) {
    return `${row.uuid}:${target.product}`;
  }

  private agentVersionText(row: MonitoringAgent) {
    const version = row.version || '-';
    const build = row.buildRef ? `Build ${row.buildRef.slice(0, 12)}` : 'Build -';
    const latest = row.latestVersion ? `Latest ${row.latestVersion}` : 'Latest -';
    return `${version} · ${build} · ${latest}`;
  }

  private formatUptime(value: unknown) {
    const seconds = Number(value ?? 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  private capabilitiesText(row: MonitoringAgent) {
    return String(row.capabilities ?? row.type ?? 'linux.status')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .join('\n');
  }

  private parseCapabilities(value: string) {
    return [
      ...new Set(
        value
          .split(/[,\n]/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  private tokenCommand(token: string) {
    const apiBase = window.location.origin;
    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-agent/.git ] && sudo git -C mnscloud-agent pull || sudo git clone https://github.com/manaoscloud/mnscloud-agent.git',
      `sudo bash /opt/mnscloud/mnscloud-agent/scripts/install-agent.sh --api-base ${this.shellQuote(apiBase)} --enrollment-token ${this.shellQuote(token)}`,
      'sudo systemctl status mnscloud-agent --no-pager -l',
    ].join(' && ');
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}

function agentStatusClass(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'online') return 'chip-success';
  if (normalized === 'degraded') return 'chip-warning';
  return 'chip-skipped';
}
