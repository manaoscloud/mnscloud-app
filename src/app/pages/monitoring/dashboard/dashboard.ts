import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ViewChild, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { fadeIn } from '../../../shared/animations/fade.animation';
import { TranslocoPipe } from '@jsverse/transloco';

type MonitoringAgent = {
  uuid: string;
  name?: string | null;
  type?: string | null;
  hostname?: string | null;
  connectionStatus?: 'online' | 'offline' | string | null;
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

@Component({
  selector: 'app-monitoring-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class MonitoringDashboardPage implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);
  private loadingStarted = 0;

  @ViewChild(MatSort) activitySort?: MatSort;
  @ViewChild(MatPaginator) activityPaginator?: MatPaginator;

  readonly loading = signal(false);
  readonly agents = signal<MonitoringAgent[]>([]);
  readonly runtimeProducts = signal<RuntimeProductFleet[]>([]);
  readonly latestLogs = signal<ActivityLog[]>([]);
  readonly failedTotal = signal(0);
  readonly errorTotal = signal(0);
  readonly generatedAt = signal<string | null>(null);

  readonly activityDataSource = new MatTableDataSource<ActivityLog>([]);
  readonly activityColumns = ['created', 'level', 'status', 'action', 'resource', 'message'];

  readonly agentSummary = computed(() => {
    const rows = this.agents();
    const total = rows.length;
    const online = rows.filter((row) => row.connectionStatus === 'online').length;
    const offline = rows.filter((row) => row.connectionStatus === 'offline').length;
    const outdated = rows.filter((row) => row.updateStatus === 'outdated').length;
    const unsupported = rows.filter((row) => row.updateStatus === 'unsupported').length;
    return { total, online, offline, outdated, unsupported };
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
        detailValue: String(agents.offline),
        detailLabel: 'offline',
        icon: 'sensors',
        state: agents.offline > 0 ? 'warn' : 'good',
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

  ngAfterViewInit() {
    this.activityDataSource.sortingDataAccessor = (row, column) =>
      this.activitySortValue(row, column);
    this.activityDataSource.sort = this.activitySort ?? null;
    this.activityDataSource.paginator = this.activityPaginator ?? null;
    void this.load();
  }

  refreshList() {
    void this.load();
  }

  monitoringRoute(path: 'agents' | 'activity-logs') {
    return this.auth.user()?.role === 'MASTER'
      ? ['/system/monitoring', path]
      : ['/monitoring', path];
  }

  async load() {
    this.loadingStarted = performance.now();
    this.loading.set(true);
    try {
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

      this.agents.set(agentsResult.value?.data?.items ?? []);
      this.runtimeProducts.set(runtimeResult.value?.data ?? []);
      this.latestLogs.set(logsResult.value?.data?.items ?? []);
      this.activityDataSource.data = this.latestLogs();
      this.failedTotal.set(
        failedResult.status === 'fulfilled' ? Number(failedResult.value?.data?.total ?? 0) : 0,
      );
      this.errorTotal.set(
        errorsResult.status === 'fulfilled' ? Number(errorsResult.value?.data?.total ?? 0) : 0,
      );
      this.generatedAt.set(new Date().toISOString());
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load monitoring dashboard.'));
      this.agents.set([]);
      this.runtimeProducts.set([]);
      this.latestLogs.set([]);
      this.activityDataSource.data = [];
      this.failedTotal.set(0);
      this.errorTotal.set(0);
    } finally {
      const elapsed = performance.now() - this.loadingStarted;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
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
    if (['warn', 'warning', 'outdated'].includes(normalized)) return 'chip-warning';
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
}
