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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  HostingVpsInstance,
  HostingVpsInstanceConfig,
  HostingVpsPlan,
  HostingVpsPlanConfig,
  HostingVpsProvider,
  VpsProviderConfig,
} from '../vps.types';

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
  price: string;
  active: boolean;
  instances: number;
};

type VpsDashboardSnapshot = {
  providers: HostingVpsProvider[];
  plans: HostingVpsPlan[];
  instances: HostingVpsInstance[];
  failedSections: number;
};

const EMPTY_VPS_DASHBOARD: VpsDashboardSnapshot = {
  providers: [],
  plans: [],
  instances: [],
  failedSections: 0,
};

@Component({
  selector: 'app-hosting-vps-dashboard',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class HostingVpsDashboardPage {
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
    defaultValue: EMPTY_VPS_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly providers = computed(() => this.dashboard().providers);
  readonly plans = computed(() => this.dashboard().plans);
  readonly instances = computed(() => this.dashboard().instances);
  readonly dashboardSearchInput = signal('');
  readonly statusInput = signal('');
  private readonly dashboardSearch = signal('');


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
      this.snack.error(this.errorMessage(error, 'Failed to load VPS dashboard.'));
      return;
    }

    const failedSections = this.dashboard().failedSections;
    if (failedSections > 0 && !this.loading()) {
      this.snack.warning('Some VPS dashboard sections could not be loaded.');
    }
  });

  readonly instanceSummary = computed(() => {
    const rows = this.instances();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HviIsActive, row.HviStatus)).length;
    const issues = rows.filter((row) => this.hasIssue(row)).length;
    return { total, active, issues };
  });

  readonly providerSummary = computed(() => {
    const rows = this.providers();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HvrIsActive)).length;
    const defaults = rows.filter((row) => Number(row.HvrIsDefault ?? 0) === 1).length;
    return { total, active, defaults };
  });

  readonly planSummary = computed(() => {
    const rows = this.plans();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HvpIsActive)).length;
    const linked = rows.filter((row) =>
      this.instances().some((item) => item.HostingVpsPlanHvpUUID === row.HvpUUID),
    ).length;
    return { total, active, linked };
  });

  readonly capacitySummary = computed(() => {
    return this.plans().reduce(
      (acc, plan) => {
        const config = this.normalizePlanConfig(plan.HvpConfig);
        if (this.isActive(plan.HvpIsActive)) {
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
      label: 'VPS Instances',
      value: String(this.instanceSummary().total),
      detailValue: String(this.instanceSummary().issues),
      detailLabel: 'issues',
      icon: 'dns',
      state: this.instanceSummary().issues > 0 ? 'warn' : 'good',
    },
    {
      label: 'VPS Providers',
      value: `${this.providerSummary().active} / ${this.providerSummary().total}`,
      detailValue: String(this.providerSummary().defaults),
      detailLabel: 'defaults',
      icon: 'cloud_sync',
      state: this.providerSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'VPS Plans',
      value: `${this.planSummary().active} / ${this.planSummary().total}`,
      detailValue: String(this.planSummary().linked),
      detailLabel: 'in use',
      icon: 'view_list',
      state: this.planSummary().active > 0 ? 'good' : 'neutral',
    },
    {
      label: 'Catalog Capacity',
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
    this.statusDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);
    this.providerDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);
    this.planDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);

    this.statusDataSource.sort = this.statusSort() ?? null;
    this.statusDataSource.paginator = this.statusPaginator() ?? null;
    this.providerDataSource.sort = this.providerSort() ?? null;
    this.providerDataSource.paginator = this.providerPaginator() ?? null;
    this.planDataSource.sort = this.planSort() ?? null;
    this.planDataSource.paginator = this.planPaginator() ?? null;
    this.applyTableFilters();
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  onDashboardSearchChange(value: string) {
    this.dashboardSearchInput.set(value);
  }

  applyDashboardFilters() {
    this.dashboardSearch.set(this.dashboardSearchInput().trim());
    this.applyTableFilters();
  }

  clearDashboardFilters() {
    this.dashboardSearchInput.set('');
    this.statusInput.set('');
    this.dashboardSearch.set('');
    this.applyTableFilters();
  }

  async loadDashboardSnapshot(): Promise<VpsDashboardSnapshot> {
    const [providersResult, plansResult, instancesResult] = await Promise.allSettled([
      this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        `${this.providerEndpoint()}?limit=500&offset=0`,
      ),
      this.api.get<{ data?: { items?: HostingVpsPlan[] } }>(
        `${this.planEndpoint()}?limit=500&offset=0`,
      ),
      this.api.get<{ data?: { items?: HostingVpsInstance[] } }>(
        `${this.instanceEndpoint()}?limit=500&offset=0`,
      ),
    ]);

    const results = [providersResult, plansResult, instancesResult];
    const failedSections = results.filter((result) => result.status === 'rejected').length;

    if (failedSections === results.length) {
      throw new Error('Failed to load VPS dashboard.');
    }

    return {
      providers:
        providersResult.status === 'fulfilled'
          ? this.items(providersResult.value).map((item) => ({
              ...item,
              HvrConfig: this.parseJson<VpsProviderConfig>(item.HvrConfig),
            }))
          : [],
      plans:
        plansResult.status === 'fulfilled'
          ? this.items(plansResult.value).map((item) => ({
              ...item,
              HvpConfig: this.parseJson<HostingVpsPlanConfig>(item.HvpConfig),
            }))
          : [],
      instances:
        instancesResult.status === 'fulfilled'
          ? this.items(instancesResult.value).map((item) => ({
              ...item,
              HviConfig: this.parseJson<HostingVpsInstanceConfig>(item.HviConfig),
            }))
          : [],
      failedSections,
    };
  }

  routeTo(section: 'instances' | 'provider' | 'plans') {
    return this.isMaster() ? ['/system/vps', section] : ['/hosting/vps', section];
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
    const provider = this.providers().find((item) => item.HvrUUID === uuid);
    return provider?.HvrName || '-';
  }

  formatMemory(value: number | null | undefined) {
    const mb = Number(value ?? 0);
    if (!Number.isFinite(mb) || mb <= 0) return '-';
    if (mb >= 1024) return `${Math.round((mb / 1024) * 10) / 10} GB`;
    return `${mb} MB`;
  }

  private providerEndpoint() {
    return this.isMaster() ? 'system/hosting/vps/providers' : 'hosting/vps/providers';
  }

  private planEndpoint() {
    return this.isMaster() ? 'system/hosting/vps/plans' : 'hosting/vps/plans';
  }

  private instanceEndpoint() {
    return this.isMaster() ? 'system/hosting/vps/instances' : 'hosting/vps/instances';
  }
  private applyTableFilters() {
    const filter = this.dashboardSearch().trim().toLowerCase();
    this.statusDataSource.filter = filter;
    this.providerDataSource.filter = filter;
    this.planDataSource.filter = filter;
    this.statusDataSource.paginator?.firstPage();
    this.providerDataSource.paginator?.firstPage();
    this.planDataSource.paginator?.firstPage();
  }

  private matchesDashboardFilter(row: object, filter: string) {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return Object.values(row).some((value) =>
      value !== null && value !== undefined && String(value).toLowerCase().includes(term),
    );
  }


  private statusRows(): StatusRow[] {
    const map = new Map<string, HostingVpsInstance[]>();
    this.instances().forEach((item) => {
      const status = String(item.HviStatus || 'unknown');
      map.set(status, [...(map.get(status) ?? []), item]);
    });
    return [...map.entries()]
      .map(([status, rows]) => ({
        status,
        total: rows.length,
        active: rows.filter((row) => this.isActive(row.HviIsActive, row.HviStatus)).length,
        issues: rows.filter((row) => this.hasIssue(row)).length,
      }))
      .sort((a, b) => b.total - a.total || a.status.localeCompare(b.status));
  }

  private providerRows(): ProviderRow[] {
    return this.providers().map((provider) => {
      const plans = this.plans().filter(
        (plan) => plan.HostingVpsProviderHvrUUID === provider.HvrUUID,
      );
      const instances = this.instances().filter(
        (instance) => instance.HostingVpsProviderHvrUUID === provider.HvrUUID,
      );
      return {
        uuid: provider.HvrUUID,
        name: provider.HvrName,
        provider: provider.HvrProvider,
        active: this.isActive(provider.HvrIsActive),
        isDefault: Number(provider.HvrIsDefault ?? 0) === 1,
        plans: plans.length,
        instances: instances.length,
        issues: instances.filter((instance) => this.hasIssue(instance)).length,
      };
    });
  }

  private planRows(): PlanRow[] {
    return this.plans().map((plan) => {
      const config = this.normalizePlanConfig(plan.HvpConfig);
      return {
        uuid: plan.HvpUUID,
        name: plan.HvpName,
        provider: this.providerLabel(plan.HostingVpsProviderHvrUUID),
        cpu: config.cpu ? `${config.cpu} vCPU` : '-',
        memory: this.formatMemory(config.memoryMb),
        disk: config.diskGb ? `${config.diskGb} GB` : '-',
        price: this.formatPrice(plan.HvpPrice, plan.HvpCurrency),
        active: this.isActive(plan.HvpIsActive),
        instances: this.instances().filter((item) => item.HostingVpsPlanHvpUUID === plan.HvpUUID)
          .length,
      };
    });
  }

  private normalizePlanConfig(value: HostingVpsPlanConfig | string | null | undefined) {
    return this.parseJson<HostingVpsPlanConfig>(value) ?? {};
  }

  private hasIssue(row: HostingVpsInstance) {
    const config = this.parseJson<HostingVpsInstanceConfig>(row.HviConfig) ?? {};
    const resize = config.resize ?? null;
    return (
      this.isIssueStatus(row.HviStatus) ||
      Boolean(config.provisionError) ||
      Boolean(resize?.error) ||
      this.isIssueStatus(resize?.status)
    );
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
