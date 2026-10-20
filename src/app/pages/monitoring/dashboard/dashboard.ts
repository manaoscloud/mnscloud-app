import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';
import { NgClass } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppI18nService } from '../../../services/app-i18n.service';
import { ApiService } from '../../../services/api.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';

/** Fleet counts computed by the API over every Agent in scope (GET monitoring/agents/summary). */
type AgentSummary = {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  outdated: number;
  unsupported: number;
};

const EMPTY_AGENT_SUMMARY: AgentSummary = {
  total: 0,
  online: 0,
  degraded: 0,
  offline: 0,
  outdated: 0,
  unsupported: 0,
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

type MonitoringDashboardSnapshot = {
  agentSummary: AgentSummary;
  runtimeProducts: RuntimeProductFleet[];
  latestLogs: ActivityLog[];
  failedTotal: number | null;
  errorTotal: number | null;
  generatedAt: string | null;
};

const EMPTY_DASHBOARD: MonitoringDashboardSnapshot = {
  agentSummary: EMPTY_AGENT_SUMMARY,
  runtimeProducts: [],
  latestLogs: [],
  failedTotal: null,
  errorTotal: null,
  generatedAt: null,
};

@Component({
  selector: 'app-monitoring-dashboard',
  standalone: true,
  imports: [DashboardPageComponent, MatIconModule, TranslocoPipe, NgClass, GlobalTableComponent],
  templateUrl: './dashboard.html',
})
export class MonitoringDashboardPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);

  readonly dashboardResource = dashboardResource({
    defaultValue: EMPTY_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly runtimeProducts = computed(() => this.dashboard().runtimeProducts);
  readonly latestLogs = computed(() => this.dashboard().latestLogs);
  readonly failedTotal = computed(() => this.dashboard().failedTotal);
  readonly errorTotal = computed(() => this.dashboard().errorTotal);
  readonly generatedAt = computed(() => this.dashboard().generatedAt);
  readonly activityTable = defineGlobalTable({
    key: 'monitoring/dashboard/activity',
    uuidField: 'uuid',
    emptyLabel: 'No activity logs found.',
    pageSizeOptions: [5, 10, 25, 100],
    columns: [
      { id: 'created', label: 'Created', field: 'dateCreated', kind: 'datetime' },
      {
        id: 'level',
        label: 'Level',
        field: 'level',
        kind: 'status',
        value: (row) => this.activityLabel(row['level'] as string | null),
        chipClass: (value) => this.chipClass(value as string | null),
      },
      {
        id: 'status',
        label: 'Status',
        field: 'status',
        kind: 'status',
        value: (row) => this.activityLabel(row['status'] as string | null),
        chipClass: (value) => this.chipClass(value as string | null),
      },
      {
        id: 'action',
        label: 'Action',
        field: 'action',
        kind: 'related',
        detail: (row) => String(row['category'] || row['hostname'] || '-'),
      },
      {
        id: 'resource',
        label: 'Resource',
        field: 'resourceLabel',
        value: (row) => this.resourceLabel(row as ActivityLog),
      },
      {
        id: 'message',
        label: 'Message',
        field: 'message',
        kind: 'related',
        value: (row) => String(row['message'] || row['errorCode'] || '-'),
        detail: (row) => this.formatDuration(row['durationMs'] as number | null),
      },
    ],
  });

  readonly agentSummary = computed(() => this.dashboard().agentSummary);

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

  private ratio(value: number, total: number) {
    return `${Number(value || 0)} / ${Number(total || 0)}`;
  }

  private async loadDashboardSnapshot(): Promise<MonitoringDashboardSnapshot> {
    const [agentsResult, runtimeResult, logsResult, failedResult, errorsResult] =
      await Promise.allSettled([
        this.api.get<any>('monitoring/agents/summary', { timeout: 30000 }),
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
      agentSummary: { ...EMPTY_AGENT_SUMMARY, ...agentsResult.value?.data },
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
