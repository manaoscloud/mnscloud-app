import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';

import { Component, computed, effect, inject, signal } from '@angular/core';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import { MnsDateTimePipe } from '../../../../shared/date-time/date-time.pipe';
import {
  PabxDashboardMetric,
  PabxDashboardQueue,
  PabxDashboardServer,
  PabxDashboardSummary,
  PabxDashboardTrunk,
  VoipPabxDashboardService,
} from './dashboard.service';

type PabxDashboardSnapshot = {
  summary: PabxDashboardSummary;
  generatedAt: string | null;
  startAt: string | null;
  callBreakdown: PabxDashboardMetric[];
  agentBreakdown: PabxDashboardMetric[];
  servers: PabxDashboardServer[];
  queues: PabxDashboardQueue[];
  trunks: PabxDashboardTrunk[];
};

const EMPTY_PABX_DASHBOARD: PabxDashboardSnapshot = {
  summary: {},
  generatedAt: null,
  startAt: null,
  callBreakdown: [],
  agentBreakdown: [],
  servers: [],
  queues: [],
  trunks: [],
};

@Component({
  selector: 'app-voip-pabx-dashboard',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    DashboardPageComponent,
    RouterModule,
    MatIconModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
})
export class VoipPabxDashboardPage {
  private readonly api = inject(VoipPabxDashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly period = () => 'today';
  readonly pabxUUID = () => '';
  readonly serverUUID = () => '';
  readonly domainUUID = () => '';
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly dashboardResource = dashboardResource({
    params: () => ({
      period: this.period(),
      pabxUUID: this.pabxUUID(),
      serverUUID: this.serverUUID(),
      domainUUID: this.domainUUID(),
      isMaster: this.isMaster(),
    }),
    defaultValue: EMPTY_PABX_DASHBOARD,
    loader: ({ params }) => this.loadDashboardSnapshot(params),
  });

  readonly loading = computed(() => this.dashboardResource.isLoading());
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly summary = computed(() => this.dashboard().summary);
  readonly generatedAt = computed(() => this.dashboard().generatedAt);
  readonly startAt = computed(() => this.dashboard().startAt);
  readonly callBreakdown = computed(() => this.dashboard().callBreakdown);
  readonly agentBreakdown = computed(() => this.dashboard().agentBreakdown);
  readonly serverRows = computed(() => this.dashboard().servers);
  readonly queueRows = computed(() => this.dashboard().queues);
  readonly trunkRows = computed(() => this.dashboard().trunks);

  readonly serverColumns = ['health', 'name', 'engine', 'hostname', 'pabxAccounts', 'lastSeenAt'];
  readonly queueColumns = ['name', 'pabxName', 'strategy', 'members', 'availableAgents', 'status'];
  readonly trunkColumns = ['name', 'pabxName', 'direction', 'host', 'transport', 'status'];
  readonly serverTable = createSignalCrudTable<PabxDashboardServer>(
    this.serverRows,
    (row, column) => this.serverSortValue(row, column),
  );
  readonly queueTable = createSignalCrudTable<PabxDashboardQueue>(this.queueRows, (row, column) =>
    this.defaultSortValue(row, column),
  );
  readonly trunkTable = createSignalCrudTable<PabxDashboardTrunk>(this.trunkRows, (row, column) =>
    this.defaultSortValue(row, column),
  );
  readonly kpis = computed(() => {
    const item = this.summary();
    return [
      {
        label: 'Servers online',
        value: this.ratio(item.serversOnline, item.serversTotal),
        icon: 'dns',
      },
      {
        label: 'Extensions registered',
        value: this.ratio(item.extensionsActive, item.extensionsTotal),
        icon: 'dialpad',
      },
      {
        label: 'Trunks active',
        value: this.ratio(item.trunksActive, item.trunksTotal),
        icon: 'settings_input_component',
      },
      { label: 'Queues', value: this.number(item.queuesTotal), icon: 'groups' },
      {
        label: 'Agents available',
        value: this.number(item.agentsAvailable),
        icon: 'support_agent',
      },
      {
        label: 'Calls answered',
        value: this.ratio(item.callsAnswered, item.callsTotal),
        icon: 'call',
      },
    ];
  });

  private readonly reportDashboardState = effect(() => {
    const dashboardError = this.dashboardResource.error();
    if (dashboardError) {
      this.snack.error(this.errorMessage(dashboardError, 'Failed to load PABX dashboard.'));
    }
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  setServerSort(sort: Sort) {
    this.serverTable.setSort(sort);
  }

  setServerPage(page: PageEvent) {
    this.serverTable.setPage(page);
  }

  setQueueSort(sort: Sort) {
    this.queueTable.setSort(sort);
  }

  setQueuePage(page: PageEvent) {
    this.queueTable.setPage(page);
  }

  setTrunkSort(sort: Sort) {
    this.trunkTable.setSort(sort);
  }

  setTrunkPage(page: PageEvent) {
    this.trunkTable.setPage(page);
  }

  metricPercent(item: PabxDashboardMetric, items: PabxDashboardMetric[]) {
    const total = items.reduce((sum, metric) => sum + Number(metric.value ?? 0), 0);
    return total > 0 ? Math.round((Number(item.value ?? 0) / total) * 100) : 0;
  }

  healthLabel(value: string) {
    const labels: Record<string, string> = {
      online: 'ONLINE',
      offline: 'OFFLINE',
      inactive: 'INACTIVE',
      unknown: 'UNKNOWN',
    };
    return labels[value] ?? value.toUpperCase();
  }

  private async loadDashboardSnapshot(params: {
    period: string;
    pabxUUID: string;
    serverUUID: string;
    domainUUID: string;
    isMaster: boolean;
  }): Promise<PabxDashboardSnapshot> {
    const response = await this.api.get(
      {
        period: params.period,
        pabxUUID: params.pabxUUID,
        serverUUID: params.serverUUID,
        domainUUID: params.domainUUID,
      },
      params.isMaster,
    );
    const data = response?.data;
    return {
      summary: data?.summary ?? {},
      generatedAt: data?.generatedAt ?? null,
      startAt: data?.startAt ?? null,
      callBreakdown: data?.callBreakdown ?? [],
      agentBreakdown: data?.agentBreakdown ?? [],
      servers: data?.servers ?? [],
      queues: data?.queues ?? [],
      trunks: data?.trunks ?? [],
    };
  }

  private ratio(value?: number, total?: number) {
    return `${this.number(value)} / ${this.number(total)}`;
  }

  private number(value?: number | null) {
    return String(Number(value ?? 0));
  }

  private serverSortValue(row: PabxDashboardServer, column: string): string | number {
    if (column === 'lastSeenAt') return row.lastSeenAt ?? '';
    return this.defaultSortValue(row, column);
  }

  private defaultSortValue(row: Record<string, unknown>, column: string): string | number {
    const value = row[column];
    return typeof value === 'number' ? value : String(value ?? '').toLowerCase();
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    const apiError = error as { error?: { error?: string }; message?: string } | null;
    return apiError?.error?.error || apiError?.message || fallback;
  }
}
