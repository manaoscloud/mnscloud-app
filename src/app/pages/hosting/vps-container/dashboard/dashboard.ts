import { NgClass } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  HostingVpsContainerInstance,
  HostingVpsContainerInstanceConfig,
  HostingVpsContainerPlan,
  HostingVpsContainerPlanConfig,
  HostingVpsContainerProvider,
  VpsContainerProviderConfig,
} from '../vps-container.types';

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

type StatusRow = {
  status: string;
  total: number;
  active: number;
  issues: number;
};

type ProviderRow = {
  uuid: string;
  name: string;
  provider: string;
  active: boolean;
  isDefault: boolean;
  plans: number;
  instances: number;
  issues: number;
};

type PlanRow = {
  uuid: string;
  name: string;
  provider: string;
  cpu: string;
  memory: string;
  disk: string;
  profile: string;
  price: string;
  active: boolean;
  instances: number;
};

type VpsContainerDashboardSnapshot = {
  providers: HostingVpsContainerProvider[];
  plans: HostingVpsContainerPlan[];
  instances: HostingVpsContainerInstance[];
  failedSections: number;
};

const EMPTY_VPS_CONTAINER_DASHBOARD: VpsContainerDashboardSnapshot = {
  providers: [],
  plans: [],
  instances: [],
  failedSections: 0,
};

@Component({
  selector: 'app-hosting-vps-container-dashboard',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class HostingVpsContainerDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly statusSort = viewChild<MatSort>('statusSort');
  readonly statusPaginator = viewChild<MatPaginator>('statusPaginator');
  readonly providerSort = viewChild<MatSort>('providerSort');
  readonly providerPaginator = viewChild<MatPaginator>('providerPaginator');
  readonly planSort = viewChild<MatSort>('planSort');
  readonly planPaginator = viewChild<MatPaginator>('planPaginator');

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  private readonly dashboardResource = resource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_VPS_CONTAINER_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly providers = computed(() => this.dashboard().providers);
  readonly plans = computed(() => this.dashboard().plans);
  readonly instances = computed(() => this.dashboard().instances);

  readonly statusDataSource = new MatTableDataSource<StatusRow>([]);
  readonly providerDataSource = new MatTableDataSource<ProviderRow>([]);
  readonly planDataSource = new MatTableDataSource<PlanRow>([]);

  readonly statusColumns = ['status', 'total', 'active', 'issues', 'actions'];
  readonly providerColumns = [
    'provider',
    'type',
    'active',
    'default',
    'plans',
    'instances',
    'issues',
    'actions',
  ];
  readonly planColumns = [
    'plan',
    'provider',
    'cpu',
    'memory',
    'disk',
    'profile',
    'price',
    'instances',
    'active',
  ];

  private readonly syncDashboardTables = effect(() => {
    this.statusDataSource.data = this.statusRows();
    this.providerDataSource.data = this.providerRows();
    this.planDataSource.data = this.planRows();
  });

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load VPS Container dashboard.'));
      return;
    }

    const failedSections = this.dashboard().failedSections;
    if (failedSections > 0 && !this.loading()) {
      this.snack.warning('Some VPS Container dashboard sections could not be loaded.');
    }
  });

  readonly instanceSummary = computed(() => {
    const rows = this.instances();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HciIsActive, row.HciStatus)).length;
    const issues = rows.filter((row) => this.hasIssue(row)).length;
    return { total, active, issues };
  });

  readonly providerSummary = computed(() => {
    const rows = this.providers();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HcpIsActive)).length;
    const defaults = rows.filter((row) => Number(row.HcpIsDefault ?? 0) === 1).length;
    return { total, active, defaults };
  });

  readonly planSummary = computed(() => {
    const rows = this.plans();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HcnIsActive)).length;
    const linked = rows.filter((row) =>
      this.instances().some((item) => item.HostingVpsContainerPlanHcnUUID === row.HcnUUID),
    ).length;
    return { total, active, linked };
  });

  readonly capacitySummary = computed(() => {
    return this.plans().reduce(
      (acc, plan) => {
        const config = this.normalizePlanConfig(plan.HcnConfig);
        if (this.isActive(plan.HcnIsActive)) {
          acc.cpu += Number(config.cpu ?? 0);
          acc.memoryMb += Number(config.memoryMb ?? 0);
          acc.diskGb += Number(config.diskGb ?? 0);
        }
        return acc;
      },
      { cpu: 0, memoryMb: 0, diskGb: 0 },
    );
  });

  readonly kpis = computed<KpiTile[]>(() => [
    {
      label: 'Container Instances',
      value: String(this.instanceSummary().total),
      detailValue: String(this.instanceSummary().issues),
      detailLabel: 'issues',
      icon: 'apps',
      state: this.instanceSummary().issues > 0 ? 'warn' : 'good',
    },
    {
      label: 'Container Providers',
      value: `${this.providerSummary().active} / ${this.providerSummary().total}`,
      detailValue: String(this.providerSummary().defaults),
      detailLabel: 'defaults',
      icon: 'cloud_sync',
      state: this.providerSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'Container Plans',
      value: `${this.planSummary().active} / ${this.planSummary().total}`,
      detailValue: String(this.planSummary().linked),
      detailLabel: 'in use',
      icon: 'view_list',
      state: this.planSummary().active > 0 ? 'good' : 'neutral',
    },
    {
      label: 'Container Capacity',
      value: `${this.capacitySummary().cpu} vCPU`,
      detailValue: this.formatMemory(this.capacitySummary().memoryMb),
      detailLabel: 'RAM catalog',
      icon: 'memory',
      state: 'neutral',
    },
  ]);

  private readonly setupTables = afterNextRender(() => {
    this.statusDataSource.sortingDataAccessor = (row, column) => this.statusSortValue(row, column);
    this.providerDataSource.sortingDataAccessor = (row, column) =>
      this.providerSortValue(row, column);
    this.planDataSource.sortingDataAccessor = (row, column) => this.planSortValue(row, column);

    this.statusDataSource.sort = this.statusSort() ?? null;
    this.statusDataSource.paginator = this.statusPaginator() ?? null;
    this.providerDataSource.sort = this.providerSort() ?? null;
    this.providerDataSource.paginator = this.providerPaginator() ?? null;
    this.planDataSource.sort = this.planSort() ?? null;
    this.planDataSource.paginator = this.planPaginator() ?? null;
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<VpsContainerDashboardSnapshot> {
    const [providersResult, plansResult, instancesResult] = await Promise.allSettled([
      this.api.get<{ data?: { items?: HostingVpsContainerProvider[] } }>(
        `${this.providerEndpoint()}?limit=500&offset=0`,
      ),
      this.api.get<{ data?: { items?: HostingVpsContainerPlan[] } }>(
        `${this.planEndpoint()}?limit=500&offset=0`,
      ),
      this.api.get<{ data?: { items?: HostingVpsContainerInstance[] } }>(
        `${this.instanceEndpoint()}?limit=500&offset=0`,
      ),
    ]);

    const results = [providersResult, plansResult, instancesResult];
    const failedSections = results.filter((result) => result.status === 'rejected').length;

    if (failedSections === results.length) {
      throw new Error('Failed to load VPS Container dashboard.');
    }

    return {
      providers:
        providersResult.status === 'fulfilled'
          ? this.items(providersResult.value).map((item) => ({
              ...item,
              HcpConfig: this.parseJson<VpsContainerProviderConfig>(item.HcpConfig),
            }))
          : [],
      plans:
        plansResult.status === 'fulfilled'
          ? this.items(plansResult.value).map((item) => ({
              ...item,
              HcnConfig: this.parseJson<HostingVpsContainerPlanConfig>(item.HcnConfig),
            }))
          : [],
      instances:
        instancesResult.status === 'fulfilled'
          ? this.items(instancesResult.value).map((item) => ({
              ...item,
              HciConfig: this.parseJson<HostingVpsContainerInstanceConfig>(item.HciConfig),
            }))
          : [],
      failedSections,
    };
  }

  routeTo(section: 'instances' | 'provider' | 'plans') {
    return this.isMaster()
      ? ['/system/vps-container', section]
      : ['/hosting/vps-container', section];
  }

  chipClass(value: boolean | number) {
    return Boolean(value) ? 'chip-success is-active' : 'chip-skipped is-inactive';
  }

  issueChipClass(issues: number) {
    return issues > 0 ? 'chip-warning' : 'chip-success is-active';
  }

  statusChipClass(status: string) {
    const normalized = status.toLowerCase();
    if (['failed', 'error', 'suspended', 'cancelled', 'canceled'].includes(normalized)) {
      return 'chip-danger';
    }
    if (['pending', 'queued', 'provisioning', 'creating', 'running'].includes(normalized)) {
      return 'chip-warning';
    }
    return 'chip-success is-active';
  }

  providerLabel(uuid: string) {
    const provider = this.providers().find((item) => item.HcpUUID === uuid);
    return provider?.HcpName || '-';
  }

  formatMemory(value: number | null | undefined) {
    const mb = Number(value ?? 0);
    if (!Number.isFinite(mb) || mb <= 0) return '-';
    if (mb >= 1024) return `${Math.round((mb / 1024) * 10) / 10} GB`;
    return `${mb} MB`;
  }

  private providerEndpoint() {
    return this.isMaster()
      ? 'system/hosting/vps-container/providers'
      : 'hosting/vps-container/providers';
  }

  private planEndpoint() {
    return this.isMaster() ? 'system/hosting/vps-container/plans' : 'hosting/vps-container/plans';
  }

  private instanceEndpoint() {
    return this.isMaster()
      ? 'system/hosting/vps-container/instances'
      : 'hosting/vps-container/instances';
  }

  private statusRows(): StatusRow[] {
    const map = new Map<string, HostingVpsContainerInstance[]>();
    this.instances().forEach((item) => {
      const status = String(item.HciStatus || 'unknown');
      map.set(status, [...(map.get(status) ?? []), item]);
    });
    return [...map.entries()]
      .map(([status, rows]) => ({
        status,
        total: rows.length,
        active: rows.filter((row) => this.isActive(row.HciIsActive, row.HciStatus)).length,
        issues: rows.filter((row) => this.hasIssue(row)).length,
      }))
      .sort((a, b) => b.total - a.total || a.status.localeCompare(b.status));
  }

  private providerRows(): ProviderRow[] {
    return this.providers().map((provider) => {
      const plans = this.plans().filter(
        (plan) => plan.HostingVpsContainerProviderHcpUUID === provider.HcpUUID,
      );
      const instances = this.instances().filter(
        (instance) => instance.HostingVpsContainerProviderHcpUUID === provider.HcpUUID,
      );
      return {
        uuid: provider.HcpUUID,
        name: provider.HcpName,
        provider: provider.HcpProvider,
        active: this.isActive(provider.HcpIsActive),
        isDefault: Number(provider.HcpIsDefault ?? 0) === 1,
        plans: plans.length,
        instances: instances.length,
        issues: instances.filter((instance) => this.hasIssue(instance)).length,
      };
    });
  }

  private planRows(): PlanRow[] {
    return this.plans().map((plan) => {
      const config = this.normalizePlanConfig(plan.HcnConfig);
      return {
        uuid: plan.HcnUUID,
        name: plan.HcnName,
        provider: this.providerLabel(plan.HostingVpsContainerProviderHcpUUID),
        cpu: config.cpu ? `${config.cpu} vCPU` : '-',
        memory: this.formatMemory(config.memoryMb),
        disk: config.diskGb ? `${config.diskGb} GB` : '-',
        profile: config.profile || '-',
        price: this.formatPrice(plan.HcnPrice, plan.HcnCurrency),
        active: this.isActive(plan.HcnIsActive),
        instances: this.instances().filter(
          (item) => item.HostingVpsContainerPlanHcnUUID === plan.HcnUUID,
        ).length,
      };
    });
  }

  private normalizePlanConfig(value: HostingVpsContainerPlanConfig | string | null | undefined) {
    return this.parseJson<HostingVpsContainerPlanConfig>(value) ?? {};
  }

  private hasIssue(row: HostingVpsContainerInstance) {
    const config = this.parseJson<HostingVpsContainerInstanceConfig>(row.HciConfig) ?? {};
    return this.isIssueStatus(row.HciStatus) || Boolean(config.provisionError);
  }

  private isActive(value: unknown, status?: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string' && value.trim()) {
      return ['1', 'true', 'active', 'running', 'ready'].includes(value.toLowerCase());
    }
    const normalized = String(status ?? '').toLowerCase();
    return ['active', 'running', 'ready'].includes(normalized);
  }

  private isIssueStatus(value: unknown) {
    const normalized = String(value ?? '').toLowerCase();
    return ['failed', 'error', 'suspended', 'cancelled', 'canceled'].includes(normalized);
  }

  private items<T>(response: { data?: { items?: T[] } }) {
    return Array.isArray(response?.data?.items) ? response.data.items : [];
  }

  private parseJson<T>(value: T | string | null | undefined): T | null {
    if (!value) return null;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private formatPrice(
    value: number | string | null | undefined,
    currency: string | null | undefined,
  ) {
    const amount = Number(value ?? 0);
    const code = currency || 'BRL';
    if (!Number.isFinite(amount)) return '-';
    return `${code} ${amount.toFixed(2)}`;
  }

  private statusSortValue(row: StatusRow, column: string) {
    if (column === 'status') return row.status;
    if (column === 'total') return row.total;
    if (column === 'active') return row.active;
    if (column === 'issues') return row.issues;
    return '';
  }

  private providerSortValue(row: ProviderRow, column: string) {
    if (column === 'provider') return row.name;
    if (column === 'type') return row.provider;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'default') return row.isDefault ? 1 : 0;
    if (column === 'plans') return row.plans;
    if (column === 'instances') return row.instances;
    if (column === 'issues') return row.issues;
    return '';
  }

  private planSortValue(row: PlanRow, column: string) {
    if (column === 'plan') return row.name;
    if (column === 'provider') return row.provider;
    if (column === 'cpu') return Number(row.cpu.split(' ')[0] || 0);
    if (column === 'memory') return row.memory;
    if (column === 'disk') return Number(row.disk.split(' ')[0] || 0);
    if (column === 'profile') return row.profile;
    if (column === 'price') return row.price;
    if (column === 'instances') return row.instances;
    if (column === 'active') return row.active ? 1 : 0;
    return '';
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
