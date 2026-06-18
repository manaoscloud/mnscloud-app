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
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';

type MonitoringAgent = {
  uuid: string;
  name?: string | null;
  type?: string | null;
  hostname?: string | null;
  connectionStatus?: 'online' | 'degraded' | 'offline' | string | null;
  updateStatus?: 'current' | 'outdated' | 'unsupported' | 'unknown' | string | null;
  remoteUpdateSupported?: boolean | null;
  lastHeartbeatAt?: string | null;
  uptimeSeconds?: number | null;
};

type RuntimeProductFleet = {
  product: string;
  label: string;
  latestVersion?: string | null;
  latestBuildRef?: string | null;
  nodeCount: number;
  currentCount: number;
  outdatedCount: number;
  unknownCount: number;
  availableCount: number;
  pendingCount?: number | null;
  runningCount?: number | null;
  failedCount?: number | null;
  rolloutStatus?: string | null;
};

type ActivityLog = {
  uuid: string;
  level?: string | null;
  status?: string | null;
  category?: string | null;
  action?: string | null;
  resourceType?: string | null;
  resourceLabel?: string | null;
  message?: string | null;
  errorCode?: string | null;
  hostname?: string | null;
  durationMs?: number | null;
  dateCreated?: string | null;
};

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

type MonitoringDashboardSnapshot = {
  agents: MonitoringAgent[];
  runtimeProducts: RuntimeProductFleet[];
  latestLogs: ActivityLog[];
  failedTotal: number;
  errorTotal: number;
  generatedAt: string | null;
};

const EMPTY_DASHBOARD: MonitoringDashboardSnapshot = {
  agents: [],
  runtimeProducts: [],
  latestLogs: [],
  failedTotal: 0,
  errorTotal: 0,
  generatedAt: null,
};

@Component({
  selector: 'app-monitoring-dashboard',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
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
export class MonitoringDashboardPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);

  readonly activitySort = viewChild(MatSort);
  readonly activityPaginator = viewChild(MatPaginator);

  private readonly dashboardResource = resource({
    defaultValue: EMPTY_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly agents = computed(() => this.dashboard().agents);
  readonly runtimeProducts = computed(() => this.dashboard().runtimeProducts);
  readonly latestLogs = computed(() => this.dashboard().latestLogs);
  readonly failedTotal = computed(() => this.dashboard().failedTotal);
  readonly errorTotal = computed(() => this.dashboard().errorTotal);
  readonly generatedAt = computed(() => this.dashboard().generatedAt);
  readonly dashboardSearchInput = signal('');
  private readonly dashboardSearch = signal('');


  readonly activityDataSource = new MatTableDataSource<ActivityLog>([]);
  readonly activityColumns = ['created', 'level', 'status', 'action', 'resource', 'message'];

  private readonly syncActivityTable = effect(() => {
    this.activityDataSource.data = this.latestLogs();
  });

  private readonly reportDashboardError = effect(() => {
    const error = this.dashboardResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load monitoring dashboard.'));
  });

  readonly agentSummary = computed(() => {
    const rows = this.agents();
    const total = rows.length;
    const online = rows.filter((row) => row.connectionStatus === 'online').length;
    const degraded = rows.filter((row) => row.connectionStatus === 'degraded').length;
    const offline = rows.filter((row) => row.connectionStatus === 'offline').length;
    const outdated = rows.filter((row) => row.updateStatus === 'outdated').length;
    const unsupported = rows.filter((row) => row.updateStatus === 'unsupported').length;
    return { total, online, degraded, offline, outdated, unsupported };
  });

  readonly runtimeSummary = computed(() => {
    const products = this.runtimeProducts();
    const totalNodes = products.reduce((sum, item) => sum + Number(item.nodeCount ?? 0), 0);
    const current = products.reduce((sum, item) => sum + Number(item.currentCount ?? 0), 0);
    const outdated = products.reduce((sum, item) => sum + Number(item.outdatedCount ?? 0), 0);
    const updating = products.reduce(
      (sum, item) => sum + Number(item.pendingCount ?? 0) + Number(item.runningCount ?? 0),
      0,
    );
    const failed = products.reduce((sum, item) => sum + Number(item.failedCount ?? 0), 0);
    return { totalNodes, current, outdated, updating, failed };
  });

  readonly kpis = computed<KpiTile[]>(() => {
    const agents = this.agentSummary();
    const runtime = this.runtimeSummary();
    return [
      {
        label: 'Online agents',
        value: this.ratio(agents.online, agents.total),
        detailValue: String(agents.degraded + agents.offline),
        detailLabel: 'attention',
        icon: 'sensors',
        state: agents.offline > 0 || agents.degraded > 0 ? 'warn' : 'good',
      },
      {
        label: 'Runtime health',
        value: this.ratio(runtime.current, runtime.totalNodes),
        detailValue: String(runtime.outdated),
        detailLabel: 'outdated',
        icon: 'deployed_code_update',
        state: runtime.outdated > 0 || runtime.failed > 0 ? 'warn' : 'good',
      },
      {
        label: 'Updates in progress',
        value: String(runtime.updating),
        detailValue: String(runtime.failed),
        detailLabel: 'failed',
        icon: 'published_with_changes',
        state: runtime.failed > 0 ? 'bad' : runtime.updating > 0 ? 'neutral' : 'good',
      },
      {
        label: 'Failed events',
        value: String(this.failedTotal()),
        detailValue: String(this.errorTotal()),
        detailLabel: 'error level',
        icon: 'error',
        state: this.failedTotal() > 0 || this.errorTotal() > 0 ? 'bad' : 'good',
      },
    ];
  });

  private readonly setupTable = afterNextRender(() => {
    this.activityDataSource.sortingDataAccessor = (row, column) =>
      this.activitySortValue(row, column);
    this.activityDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);
    this.activityDataSource.sort = this.activitySort() ?? null;
    this.activityDataSource.paginator = this.activityPaginator() ?? null;
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
    this.dashboardSearch.set('');
    this.applyTableFilters();
  }

  monitoringRoute(path: 'agents' | 'activity-logs') {
    return this.auth.user()?.role === 'MASTER'
      ? ['/system/monitoring', path]
      : ['/monitoring', path];
  }

  runtimeProductStatus(product: RuntimeProductFleet) {
    if ((product.pendingCount ?? 0) > 0 || (product.runningCount ?? 0) > 0) return 'Updating';
    if ((product.failedCount ?? 0) > 0 || product.rolloutStatus === 'failed') return 'Failed';
    if ((product.outdatedCount ?? 0) > 0 || (product.availableCount ?? 0) > 0) return 'Outdated';
    if ((product.unknownCount ?? 0) > 0) return 'Check';
    return 'Up to date';
  }

  runtimeProductClass(product: RuntimeProductFleet) {
    const status = this.runtimeProductStatus(product);
    if (status === 'Up to date') return 'chip-success is-active';
    if (status === 'Failed') return 'chip-danger';
    if (status === 'Updating') return 'chip-skipped is-inactive';
    return 'chip-warning';
  }

  chipClass(value: string | null | undefined) {
    const normalized = String(value ?? 'unknown').toLowerCase();
    if (['success', 'completed', 'online', 'info'].includes(normalized))
      return 'chip-success is-active';
    if (['failed', 'error', 'critical'].includes(normalized)) return 'chip-danger';
    if (['warn', 'warning', 'outdated', 'degraded'].includes(normalized)) return 'chip-warning';
    return 'chip-skipped is-inactive';
  }

  metricPercent(value: number, total: number) {
    return total > 0 ? Math.round((Number(value || 0) / Number(total)) * 100) : 0;
  }

  resourceLabel(row: ActivityLog) {
    return row.resourceLabel || row.resourceType || '-';
  }

  formatDuration(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
    const ms = Number(value);
    return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;
  }

  shortBuildRef(value: string | null | undefined) {
    return value ? value.slice(0, 12) : '-';
  }

  private ratio(value: number, total: number) {
    return `${Number(value || 0)} / ${Number(total || 0)}`;
  }
  private applyTableFilters() {
    const filter = this.dashboardSearch().trim().toLowerCase();
    this.activityDataSource.filter = filter;
    this.activityDataSource.paginator?.firstPage();
  }

  private matchesDashboardFilter(row: object, filter: string) {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return Object.values(row).some((value) =>
      value !== null && value !== undefined && String(value).toLowerCase().includes(term),
    );
  }


  private activitySortValue(row: ActivityLog, column: string) {
    if (column === 'created') return row.dateCreated ?? '';
    if (column === 'level') return row.level ?? '';
    if (column === 'status') return row.status ?? '';
    if (column === 'action') return row.action ?? '';
    if (column === 'resource') return this.resourceLabel(row);
    if (column === 'message') return row.message ?? '';
    return '';
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }

  private async loadDashboardSnapshot(): Promise<MonitoringDashboardSnapshot> {
    const [agentsResult, runtimeResult, logsResult, failedResult, errorsResult] =
      await Promise.allSettled([
        this.api.get<any>('monitoring/agents?limit=1000'),
        this.api.get<any>('monitoring/agents/runtime-products'),
        this.api.get<any>('monitoring/activity-logs?limit=12&offset=0'),
        this.api.get<any>('monitoring/activity-logs?status=failed&limit=1&offset=0'),
        this.api.get<any>('monitoring/activity-logs?level=error&limit=1&offset=0'),
      ]);

    if (agentsResult.status === 'rejected') throw agentsResult.reason;
    if (runtimeResult.status === 'rejected') throw runtimeResult.reason;
    if (logsResult.status === 'rejected') throw logsResult.reason;

    return {
      agents: agentsResult.value?.data?.items ?? [],
      runtimeProducts: runtimeResult.value?.data ?? [],
      latestLogs: logsResult.value?.data?.items ?? [],
      failedTotal:
        failedResult.status === 'fulfilled' ? Number(failedResult.value?.data?.total ?? 0) : 0,
      errorTotal:
        errorsResult.status === 'fulfilled' ? Number(errorsResult.value?.data?.total ?? 0) : 0,
      generatedAt: new Date().toISOString(),
    };
  }
}
