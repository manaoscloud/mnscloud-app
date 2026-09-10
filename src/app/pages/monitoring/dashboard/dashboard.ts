import { NgClass } from '@angular/common';
import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';

import { AppI18nService } from '../../../services/app-i18n.service';
import { ApiService } from '../../../services/api.service';
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
  mode?: string | null;
  strategy?: string | null;
  batchSize?: number | null;
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

type ActivitySortColumn = 'created' | 'level' | 'status' | 'action' | 'resource' | 'message';
type SortDirection = 'asc' | 'desc';

type MonitoringDashboardSnapshot = {
  agents: MonitoringAgent[];
  runtimeProducts: RuntimeProductFleet[];
  latestLogs: ActivityLog[];
  failedTotal: number | null;
  errorTotal: number | null;
  generatedAt: string | null;
};

const EMPTY_DASHBOARD: MonitoringDashboardSnapshot = {
  agents: [],
  runtimeProducts: [],
  latestLogs: [],
  failedTotal: null,
  errorTotal: null,
  generatedAt: null,
};

@Component({
  selector: 'app-monitoring-dashboard',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatIconModule,
    MatPaginatorModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class MonitoringDashboardPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);

  private readonly dashboardResource = resource({
    defaultValue: EMPTY_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly loadError = this.dashboardResource.error;
  readonly dashboard = linkedSignal<
    MonitoringDashboardSnapshot | null,
    MonitoringDashboardSnapshot
  >({
    source: () => (this.dashboardResource.hasValue() ? this.dashboardResource.value() : null),
    computation: (value, previous) => value ?? previous?.value ?? EMPTY_DASHBOARD,
  });
  readonly agents = computed(() => this.dashboard().agents);
  readonly runtimeProducts = computed(() => this.dashboard().runtimeProducts);
  readonly latestLogs = computed(() => this.dashboard().latestLogs);
  readonly failedTotal = computed(() => this.dashboard().failedTotal);
  readonly errorTotal = computed(() => this.dashboard().errorTotal);
  readonly generatedAt = computed(() => this.dashboard().generatedAt);
  readonly activityPageIndex = signal(0);
  readonly activityPageSize = signal(5);
  readonly activitySortColumn = signal<ActivitySortColumn>('created');
  readonly activitySortDirection = signal<SortDirection>('desc');
  readonly activityColumns = [
    { id: 'created' as const, label: 'Created' },
    { id: 'level' as const, label: 'Level' },
    { id: 'status' as const, label: 'Status' },
    { id: 'action' as const, label: 'Action' },
    { id: 'resource' as const, label: 'Resource' },
    { id: 'message' as const, label: 'Message' },
  ];

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
        icon: 'system_update_alt',
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
        value: this.failedTotal() === null ? '—' : String(this.failedTotal()),
        detailValue: this.errorTotal() === null ? '—' : String(this.errorTotal()),
        detailLabel: 'error level',
        icon: 'error',
        state:
          (this.failedTotal() ?? 0) > 0 || (this.errorTotal() ?? 0) > 0
            ? 'bad'
            : this.failedTotal() === null || this.errorTotal() === null
              ? 'neutral'
              : 'good',
      },
    ];
  });

  readonly sortedActivityLogs = computed(() =>
    [...this.latestLogs()].sort((left, right) => this.compareActivityRows(left, right)),
  );
  readonly displayedActivityColumns = this.activityColumns.map((column) => column.id);

  readonly pagedActivityLogs = computed(() => {
    const start = this.activityPageIndex() * this.activityPageSize();
    return this.sortedActivityLogs().slice(start, start + this.activityPageSize());
  });

  refreshList() {
    this.dashboardResource.reload();
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

  activityLabel(value: string | null | undefined) {
    const labels: Readonly<Record<string, string>> = {
      success: 'Success',
      completed: 'Completed',
      failed: 'Failed',
      pending: 'Pending',
      cancelled: 'Cancelled',
      info: 'Info',
      warn: 'Warning',
      warning: 'Warning',
      error: 'Error',
      critical: 'Critical',
    };
    this.i18n.language();
    const key = String(value ?? '').toLowerCase();
    return this.i18n.t(labels[key] ?? value ?? '-');
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

  changeActivitySort(sort: Sort) {
    this.activitySortColumn.set(sort.active as ActivitySortColumn);
    this.activitySortDirection.set(sort.direction === 'asc' ? 'asc' : 'desc');
  }

  onActivityPageChange(event: PageEvent) {
    this.activityPageIndex.set(event.pageIndex);
    this.activityPageSize.set(event.pageSize);
  }

  private ratio(value: number, total: number) {
    return `${Number(value || 0)} / ${Number(total || 0)}`;
  }

  private compareActivityRows(left: ActivityLog, right: ActivityLog) {
    const column = this.activitySortColumn();
    const direction = this.activitySortDirection() === 'asc' ? 1 : -1;
    const leftValue = this.activitySortValue(left, column);
    const rightValue = this.activitySortValue(right, column);
    return (
      leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * direction
    );
  }

  private activitySortValue(row: ActivityLog, column: ActivitySortColumn) {
    if (column === 'created') return row.dateCreated ?? '';
    if (column === 'level') return this.activityLabel(row.level);
    if (column === 'status') return this.activityLabel(row.status);
    if (column === 'action') return row.action ?? '';
    if (column === 'resource') return this.resourceLabel(row);
    if (column === 'message') return row.message ?? '';
    return '';
  }

  private async loadDashboardSnapshot(): Promise<MonitoringDashboardSnapshot> {
    const [agentsResult, runtimeResult, logsResult, failedResult, errorsResult] =
      await Promise.allSettled([
        this.api.get<any>('monitoring/agents?limit=1000', { timeout: 30000 }),
        this.api.get<any>('monitoring/agents/runtime-products', { timeout: 30000 }),
        this.api.get<any>('monitoring/activity-logs?limit=12&offset=0', { timeout: 30000 }),
        this.api.get<any>('monitoring/activity-logs?status=failed&limit=1&offset=0', {
          timeout: 30000,
        }),
        this.api.get<any>('monitoring/activity-logs?level=error&limit=1&offset=0', {
          timeout: 30000,
        }),
      ]);

    if (agentsResult.status === 'rejected') throw agentsResult.reason;
    if (runtimeResult.status === 'rejected') throw runtimeResult.reason;
    if (logsResult.status === 'rejected') throw logsResult.reason;

    return {
      agents: agentsResult.value?.data?.items ?? [],
      runtimeProducts: runtimeResult.value?.data ?? [],
      latestLogs: logsResult.value?.data?.items ?? [],
      failedTotal:
        failedResult.status === 'fulfilled' ? Number(failedResult.value?.data?.total ?? 0) : null,
      errorTotal:
        errorsResult.status === 'fulfilled' ? Number(errorsResult.value?.data?.total ?? 0) : null,
      generatedAt: new Date().toISOString(),
    };
  }
}
