import { NgClass, DatePipe } from '@angular/common';
import { ClipboardModule } from '@angular/cdk/clipboard';
import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type MonitoringAgent = {
  uuid: string;
  id?: string;
  name?: string | null;
  installLabel?: string | null;
  type?: string | null;
  capabilities?: string | null;
  resourceType?: string | null;
  resourceUUID?: string | null;
  resourceLabel?: string | null;
  engine?: string | null;
  hostname?: string | null;
  version?: string | null;
  buildRef?: string | null;
  buildDate?: string | null;
  updateChannel?: string | null;
  latestVersion?: string | null;
  latestBuildRef?: string | null;
  updateStatus?: 'current' | 'outdated' | 'unsupported' | 'unknown' | string | null;
  remoteUpdateSupported?: boolean | null;
  runtimeUpdates?: RuntimeUpdateTarget[] | null;
  status?: number | null;
  connectionStatus: 'online' | 'offline';
  lastHeartbeatAt?: string | null;
  uptimeSeconds?: number | null;
};

type RuntimeUpdateTarget = {
  product: 'mnscloud-agent' | 'mnscloud-api' | 'mnscloud-app' | string;
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
  product: 'mnscloud-agent' | 'mnscloud-api' | 'mnscloud-app' | string;
  label: string;
  capability: string;
  channel: string;
  mode: 'single' | 'cluster' | string;
  strategy: string;
  canRequest: boolean;
  latestVersion?: string | null;
  latestBuildRef?: string | null;
  targetRef?: string | null;
  nodeCount: number;
  currentCount: number;
  outdatedCount: number;
  unknownCount: number;
  availableCount: number;
  pendingCount?: number | null;
  runningCount?: number | null;
  failedCount?: number | null;
  rolloutStatus?: 'current' | 'outdated' | 'updating' | 'failed' | 'unknown' | string | null;
};

type AgentFilters = {
  search: string;
  type: string;
  status: string;
};

type AgentFormModel = {
  agentUUID: string;
  name: string;
  hostname: string;
  status: number;
  capabilitiesText: string;
  resourceType: string;
  resourceUUID: string;
};

type MonitoringAgentsSnapshot = {
  agents: MonitoringAgent[];
  runtimeProducts: RuntimeProductFleet[];
  runtimeProductsError?: string | null;
};

const EMPTY_AGENT_FILTERS: AgentFilters = {
  search: '',
  type: '',
  status: '',
};

const EMPTY_AGENTS_SNAPSHOT: MonitoringAgentsSnapshot = {
  agents: [],
  runtimeProducts: [],
  runtimeProductsError: null,
};

@Component({
  selector: 'app-monitoring-agents',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    ClipboardModule,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    TranslocoPipe,
    MatTooltipModule,
    DatePipe,
    NgClass,
  ],
  templateUrl: './agents.html',
  styleUrls: ['./agents.scss'],
})
export class MonitoringAgentsPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly agentDialog = viewChild<TemplateRef<unknown>>('agentDialog');
  readonly tokenDialog = viewChild<TemplateRef<unknown>>('tokenDialog');
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private dialogBinding: CrudDialogBinding | null = null;
  private lastRuntimeProductsError = '';

  readonly saving = signal(false);
  readonly editing = signal<MonitoringAgent | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly updatingIds = signal<Set<string>>(new Set());
  readonly updatingProducts = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly isMaster = computed(() => this.auth.user()?.role === 'MASTER');
  readonly canUpdateTenantAgent = computed(() =>
    ['MASTER', 'OWNER', 'ADMIN'].includes(this.auth.user()?.role ?? ''),
  );
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly generatedToken = signal('');
  readonly dataSource = new MatTableDataSource<MonitoringAgent>([]);
  private readonly appliedFilters = signal<AgentFilters>({ ...EMPTY_AGENT_FILTERS });
  private readonly agentsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: EMPTY_AGENTS_SNAPSHOT,
    loader: ({ params }) => this.loadAgentsSnapshot(params),
  });

  readonly loading = this.agentsResource.isLoading;
  readonly agentsSnapshot = computed(() => this.agentsResource.value());
  readonly agents = computed(() => this.agentsSnapshot().agents);
  readonly runtimeProducts = computed(() => this.agentsSnapshot().runtimeProducts);

  readonly displayedColumns = [
    'select',
    'status',
    'name',
    'type',
    'resource',
    'hostname',
    'version',
    'uptime',
    'heartbeat',
    'actions',
  ];

  readonly statusOptions = ['', 'online', 'offline'];
  readonly typeOptions = [
    '',
    'linux.status',
    'mnscloud.agent.update',
    'mnscloud.api.update',
    'mnscloud.app.update',
    'security.nftables.manage',
    'security.crowdsec.manage',
    'security.logs.read',
    'voip.asterisk.manage',
    'voip.freeswitch.manage',
    'docker.manage',
  ];

  readonly filterFormModel = signal<AgentFilters>({ ...EMPTY_AGENT_FILTERS });
  readonly agentFormModel = signal<AgentFormModel>({
    agentUUID: '',
    name: '',
    hostname: '',
    status: 1,
    capabilitiesText: 'linux.status',
    resourceType: '',
    resourceUUID: '',
  });

  readonly filterForm = createForm(this.filterFormModel);
  readonly form = createForm(this.agentFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
  });

  readonly filteredAgents = computed(() => this.sortRows(this.agents()));

  readonly pagedAgents = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredAgents().slice(start, start + this.pageSize());
  });

  private readonly syncTable = effect(() => {
    this.dataSource.data = this.agents();
    queueMicrotask(() => this.reconcileSelection());
  });

  private readonly reportLoadErrors = effect(() => {
    const error = this.agentsResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load agents.'));
      return;
    }

    const runtimeProductsError = this.agentsSnapshot().runtimeProductsError ?? '';
    if (runtimeProductsError && runtimeProductsError !== this.lastRuntimeProductsError) {
      this.lastRuntimeProductsError = runtimeProductsError;
      this.snack.error(runtimeProductsError);
    } else if (!runtimeProductsError) {
      this.lastRuntimeProductsError = '';
    }
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.destroyRef.onDestroy(() => this.closeDialog());
  }

  refreshList() {
    this.agentsResource.reload();
  }

  async queueRuntimeProductUpdate(product: RuntimeProductFleet) {
    if (!this.canUpdateRuntimeProduct(product)) return;
    const target = product.targetRef || product.latestVersion || 'the latest release';
    const modeLabel = product.mode === 'cluster' ? 'cluster' : 'runtime';
    const ok = await this.confirm(
      `Update ${product.label}`,
      `Queue ${product.label} ${modeLabel} update to ${target}? The API will update every eligible online node for this product.`,
      'Queue update',
    );
    if (!ok) return;
    const next = new Set(this.updatingProducts());
    next.add(product.product);
    this.updatingProducts.set(next);
    try {
      const response = await this.api.post<any>(
        `monitoring/agents/runtime-products/${product.product}/update`,
        {},
      );
      const queued = response?.data?.jobs?.length ?? 0;
      const skipped = response?.data?.skipped?.length ?? 0;
      if (queued > 0) {
        this.snack.success(`${product.label} rollout queued for ${queued} node(s).`);
      } else if (skipped > 0) {
        this.snack.success(`${product.label} rollout already has pending or current node(s).`);
      } else {
        this.snack.success(`${product.label} is already up to date.`);
      }
      this.agentsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, `Failed to queue ${product.label} rollout.`));
    } finally {
      const current = new Set(this.updatingProducts());
      current.delete(product.product);
      this.updatingProducts.set(current);
    }
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.appliedFilters.set(this.normalizedFilters());
  }

  clearFilters() {
    this.filterFormModel.set({ ...EMPTY_AGENT_FILTERS });
    this.pageIndex.set(0);
    this.appliedFilters.set({ ...EMPTY_AGENT_FILTERS });
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.pageIndex.set(0);
  }

  startCreate() {
    this.editing.set(null);
    this.agentFormModel.set({
      agentUUID: '',
      name: '',
      hostname: '',
      status: 1,
      capabilitiesText: 'linux.status',
      resourceType: '',
      resourceUUID: '',
    });
    this.openDialog();
  }

  startEdit(row: MonitoringAgent) {
    this.editing.set(row);
    this.agentFormModel.set({
      agentUUID: row.uuid,
      name: row.name ?? '',
      hostname: row.hostname ?? '',
      status: row.status === 0 ? 0 : 1,
      capabilitiesText: this.capabilitiesText(row),
      resourceType: row.resourceType ?? '',
      resourceUUID: row.resourceUUID ?? '',
    });
    this.openDialog();
  }

  private openDialog() {
    const agentDialog = this.agentDialog();
    if (!agentDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, agentDialog, 'crud-dialog-panel', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogBinding = binding;
    binding.ref.afterClosed().subscribe(() => {
      binding.stop();
      if (this.dialogBinding === binding) this.dialogBinding = null;
    });
  }

  closeDialog() {
    const binding = this.dialogBinding;
    this.dialogBinding = null;
    binding?.ref.close();
    binding?.stop();
    this.editing.set(null);
  }

  async save(keepOpen = false) {
    if (!this.form().valid()) return;
    const raw = this.agentFormModel();
    const payload = {
      agentUUID: raw.agentUUID,
      name: raw.name.trim(),
      hostname: raw.hostname.trim() || null,
      status: raw.status,
      capabilities: this.parseCapabilities(raw.capabilitiesText),
      resourceType: raw.resourceType.trim() || null,
      resourceUUID: raw.resourceUUID.trim() || null,
    };
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`monitoring/agents/${editing.uuid}`, payload);
        this.snack.success('Agent updated.');
      } else {
        const response = await this.api.post<any>('monitoring/agents/enrollments', payload);
        this.generatedToken.set(response?.data?.enrollmentToken ?? '');
        this.snack.success('Agent enrollment created. Copy the install command.');
        this.openTokenDialog();
      }
      this.agentsResource.reload();
      if (keepOpen && !editing) {
        this.startCreate();
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save agent.'));
    } finally {
      this.saving.set(false);
    }
  }

  async generateInstallCommand(row: MonitoringAgent) {
    const ok = await this.confirm(
      'Generate install command',
      `Generate a short-lived install command for agent ${row.name || row.uuid}? The runtime token will be issued directly to the server when the enrollment is consumed.`,
      'Generate command',
    );
    if (!ok) return;
    try {
      const response = await this.api.post<any>(`monitoring/agents/${row.uuid}/enrollments`, {});
      this.generatedToken.set(response?.data?.enrollmentToken ?? '');
      this.openTokenDialog();
      this.snack.success('Agent enrollment command generated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to generate install command.'));
    }
  }

  async queueRuntimeUpdate(row: MonitoringAgent, target: RuntimeUpdateTarget) {
    if (!this.canUpdateTarget(row, target)) return;
    const targetRef =
      target.targetRef || (target.latestVersion ? `v${target.latestVersion}` : null);
    const ok = await this.confirm(
      `Update ${target.label}`,
      `Queue remote update for ${row.name || row.uuid} to ${
        targetRef || 'the latest release'
      }? The selected runtime will update by explicit release tag.`,
      'Queue update',
    );
    if (!ok) return;
    const next = new Set(this.updatingIds());
    next.add(this.updateKey(row, target));
    this.updatingIds.set(next);
    try {
      const response = await this.api.post<any>(`monitoring/agents/${row.uuid}/update`, {
        product: target.product,
      });
      const status = response?.data?.status;
      if (status === 'current') {
        this.snack.success(`${target.label} is already up to date.`);
      } else if (status === 'pending') {
        this.snack.success(`${target.label} update is already pending.`);
      } else {
        this.snack.success(`${target.label} update queued.`);
      }
      this.agentsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, `Failed to queue ${target.label} update.`));
    } finally {
      const current = new Set(this.updatingIds());
      current.delete(this.updateKey(row, target));
      this.updatingIds.set(current);
    }
  }

  async deleteAgent(row: MonitoringAgent) {
    const ok = await this.confirm(
      'Confirm delete',
      `Delete agent ${row.name || row.uuid}?`,
      'Delete',
    );
    if (!ok) return;
    try {
      await this.api.delete(`monitoring/agents/${row.uuid}`);
      this.snack.success('Agent deleted.');
      this.agentsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete agent.'));
    }
  }

  async deleteSelectedAgents() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const ok = await this.confirm(
      'Confirm delete',
      `Delete ${ids.length} selected agent(s)?`,
      'Delete',
    );
    if (!ok) return;
    try {
      const response = await this.api.delete<any>('monitoring/agents/bulk', { ids });
      const failedIds = (response?.data?.failed ?? [])
        .map((item: any) => item.uuid)
        .filter(Boolean);
      this.selectedIds.set(new Set(failedIds));
      failedIds.length
        ? this.snack.warning(
            `${ids.length - failedIds.length} agent(s) deleted; ${failedIds.length} failed.`,
          )
        : this.snack.success('Selected agents deleted.');
      this.agentsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete selected agents.'));
    }
  }

  openTokenDialog() {
    const tokenDialog = this.tokenDialog();
    if (!tokenDialog) return;
    this.dialog.open(tokenDialog, {
      width: 'min(760px, calc(100vw - 32px))',
      maxWidth: '760px',
      disableClose: false,
    });
  }

  tokenCommand() {
    const token = this.generatedToken();
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

  notifyCommandCopied(copied: boolean) {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }

  isSelected(row: MonitoringAgent) {
    return this.selectedIds().has(row.uuid);
  }

  toggleSelection(row: MonitoringAgent, checked: boolean) {
    const next = new Set(this.selectedIds());
    checked ? next.add(row.uuid) : next.delete(row.uuid);
    this.selectedIds.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.pagedAgents()) {
      checked ? next.add(row.uuid) : next.delete(row.uuid);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.pagedAgents();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.uuid));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedAgents();
    return rows.some((row) => this.selectedIds().has(row.uuid)) && !this.isAllVisibleSelected();
  }

  chipClass(value: string | null | undefined) {
    return value === 'online' ? 'chip-success is-active' : 'chip-skipped is-inactive';
  }

  formatUptime(value: number | null | undefined) {
    const seconds = Number(value ?? 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  updateLabel(row: MonitoringAgent) {
    const status = row.updateStatus || 'unknown';
    if (status === 'current') return 'Up to date';
    if (status === 'outdated' && row.remoteUpdateSupported === false) {
      return 'Manual';
    }
    if (status === 'outdated') return 'Update';
    if (status === 'unsupported') return 'Unsupported';
    return 'Unknown';
  }

  updateChipClass(row: MonitoringAgent) {
    const status = row.updateStatus || 'unknown';
    if (status === 'current') return 'chip-success is-active';
    if (status === 'outdated') return 'chip-warning';
    if (status === 'unsupported') return 'chip-danger';
    return 'chip-skipped is-inactive';
  }

  runtimeUpdateTargets(row: MonitoringAgent) {
    return (row.runtimeUpdates ?? []).filter((target) => target.available);
  }

  agentUpdateTarget(row: MonitoringAgent) {
    const target = this.runtimeUpdateTargets(row).find((item) => item.product === 'mnscloud-agent');
    return target && this.canUpdateTarget(row, target) ? target : null;
  }

  canUpdateTarget(row: MonitoringAgent, target: RuntimeUpdateTarget) {
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
    const leftParts = left
      .replace(/^v/i, '')
      .split(/[+-]/)[0]
      .split('.')
      .map((item) => Number(item));
    const rightParts = right
      .replace(/^v/i, '')
      .split(/[+-]/)[0]
      .split('.')
      .map((item) => Number(item));
    for (let index = 0; index < 3; index += 1) {
      const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  isUpdatingTarget(row: MonitoringAgent, target: RuntimeUpdateTarget) {
    return this.updatingIds().has(this.updateKey(row, target));
  }

  canUpdateRuntimeProduct(product: RuntimeProductFleet) {
    return (
      product.canRequest === true &&
      product.availableCount > 0 &&
      !this.runtimeProductBusy(product) &&
      Boolean(product.latestVersion || product.targetRef) &&
      !this.isUpdatingRuntimeProduct(product)
    );
  }

  isUpdatingRuntimeProduct(product: RuntimeProductFleet) {
    return this.updatingProducts().has(product.product);
  }

  runtimeProductStatus(product: RuntimeProductFleet) {
    if (this.runtimeProductBusy(product)) return 'Updating';
    if ((product.failedCount ?? 0) > 0 || product.rolloutStatus === 'failed') return 'Failed';
    if (product.availableCount > 0) return 'Update';
    if (product.outdatedCount > 0 || product.rolloutStatus === 'outdated') return 'Outdated';
    if (product.unknownCount > 0) return 'Check';
    return 'Up to date';
  }

  runtimeProductClass(product: RuntimeProductFleet) {
    if (this.runtimeProductBusy(product)) return 'chip-skipped is-inactive';
    if ((product.failedCount ?? 0) > 0 || product.rolloutStatus === 'failed') return 'chip-danger';
    if (
      product.availableCount > 0 ||
      product.outdatedCount > 0 ||
      product.rolloutStatus === 'outdated'
    ) {
      return 'chip-warning';
    }
    if (product.unknownCount > 0) return 'chip-skipped is-inactive';
    return 'chip-success is-active';
  }

  private runtimeProductBusy(product: RuntimeProductFleet) {
    return (
      (product.pendingCount ?? 0) > 0 ||
      (product.runningCount ?? 0) > 0 ||
      product.rolloutStatus === 'updating'
    );
  }

  private updateKey(row: MonitoringAgent, target: RuntimeUpdateTarget) {
    return `${row.uuid}:${target.product}`;
  }

  shortBuildRef(value: string | null | undefined) {
    return value ? value.slice(0, 12) : '-';
  }

  private async loadAgentsSnapshot(filters: AgentFilters): Promise<MonitoringAgentsSnapshot> {
    const [agentsResult, runtimeProductsResult] = await Promise.allSettled([
      this.api.get<any>(`monitoring/agents${this.queryString(filters)}`),
      this.api.get<any>('monitoring/agents/runtime-products'),
    ]);

    if (agentsResult.status === 'rejected') throw agentsResult.reason;

    const runtimeProducts =
      runtimeProductsResult.status === 'fulfilled'
        ? (runtimeProductsResult.value?.data ?? [])
        : this.runtimeProducts();

    return {
      agents: agentsResult.value?.data?.items ?? [],
      runtimeProducts,
      runtimeProductsError:
        runtimeProductsResult.status === 'rejected'
          ? this.errorMessage(runtimeProductsResult.reason, 'Failed to load runtime products.')
          : null,
    };
  }

  private normalizedFilters(): AgentFilters {
    const value = this.filterFormModel();
    return {
      search: value.search.trim(),
      type: value.type,
      status: value.status,
    };
  }

  private queryString(value: AgentFilters) {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    if (value.search) params.set('search', value.search);
    if (value.type) params.set('type', value.type);
    if (value.status) params.set('status', value.status);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  private sortRows(rows: MonitoringAgent[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const av = this.sortValue(a, active);
      const bv = this.sortValue(b, active);
      const result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: MonitoringAgent, column: string) {
    if (column === 'status') return row.connectionStatus ?? '';
    if (column === 'name') return row.name ?? '';
    if (column === 'type') return row.type ?? '';
    if (column === 'resource') return row.resourceLabel ?? '';
    if (column === 'hostname') return row.hostname ?? '';
    if (column === 'version') return `${row.updateStatus ?? ''} ${row.version ?? ''}`;
    if (column === 'uptime') return String(row.uptimeSeconds ?? 0);
    if (column === 'heartbeat') return row.lastHeartbeatAt ?? '';
    return '';
  }

  private capabilitiesText(row: MonitoringAgent) {
    return (row.capabilities ?? row.type ?? 'linux.status')
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

  private reconcileSelection() {
    const valid = new Set(this.agents().map((row) => row.uuid));
    this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => valid.has(id))));
  }

  private async confirm(title: string, message: string, confirmLabel = 'Confirm') {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
