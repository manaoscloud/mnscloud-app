import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';

import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import { MnsDateTimePipe } from '../../../../shared/date-time/date-time.pipe';
import {
  RealtimeWebRtcDashboardService,
  WebRtcDashboardDomain,
  WebRtcDashboardData,
  WebRtcDashboardFilters,
  WebRtcDashboardMetric,
  WebRtcDashboardServer,
} from './dashboard.service';

type WebRtcDashboardRequest = Required<Pick<WebRtcDashboardFilters, 'period'>> &
  Omit<WebRtcDashboardFilters, 'period'> & {
    scope: string;
  };

const EMPTY_WEBRTC_DASHBOARD: WebRtcDashboardData = {
  period: 'today',
  startAt: null,
  generatedAt: null,
  summary: {},
  servers: [],
  domains: [],
  certificateBreakdown: [],
  jobBreakdown: [],
};

@Component({
  selector: 'app-realtime-webrtc-dashboard',
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
export class RealtimeWebRtcDashboardPage {
  private readonly api = inject(RealtimeWebRtcDashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly period = () => 'today';
  readonly serverUUID = () => '';
  readonly domainUUID = () => '';
  readonly serverSortActive = signal('');
  readonly serverSortDirection = signal<Sort['direction']>('');
  readonly serverPageIndex = signal(0);
  readonly serverPageSize = signal(5);
  readonly domainSortActive = signal('');
  readonly domainSortDirection = signal<Sort['direction']>('');
  readonly domainPageIndex = signal(0);
  readonly domainPageSize = signal(5);
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  private readonly summaryRequest = computed<WebRtcDashboardRequest>(() => ({
    period: 'today',
    serverUUID: '',
    domainUUID: '',
    scope: this.scope(),
  }));

  readonly dashboardResource = dashboardResource({
    params: () => this.summaryRequest(),
    defaultValue: EMPTY_WEBRTC_DASHBOARD,
    loader: ({ params }) => this.fetchDashboardSnapshot(params),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly summary = computed(() => this.dashboard().summary);
  readonly certificateBreakdown = computed(() => this.dashboard().certificateBreakdown);
  readonly jobBreakdown = computed(() => this.dashboard().jobBreakdown);
  readonly serverColumns = [
    'health',
    'name',
    'engine',
    'hostname',
    'publicDomain',
    'version',
    'domains',
    'lastSeenAt',
  ];
  readonly domainColumns = [
    'status',
    'domainName',
    'serverName',
    'certificateStatus',
    'nginxStatus',
    'autoProvision',
    'lastSyncedAt',
    'lastError',
  ];
  readonly kpis = computed(() => {
    const item = this.summary();
    return [
      {
        label: 'WebRTC servers online',
        value: this.ratio(item.serversOnline, item.serversTotal),
        icon: 'settings_input_antenna',
      },
      {
        label: 'WebRTC domains active',
        value: this.ratio(item.domainsActive, item.domainsTotal),
        icon: 'language',
      },
      {
        label: 'Certificates ready',
        value: this.ratio(item.certificatesReady, item.domainsTotal),
        icon: 'verified',
      },
      {
        label: 'Certificates pending',
        value: this.number(item.certificatesPending),
        icon: 'pending_actions',
      },
      {
        label: 'Nginx ready',
        value: this.ratio(item.nginxReady, item.domainsTotal),
        icon: 'rule',
      },
      {
        label: 'Jobs failed',
        value: this.number(item.jobsFailed),
        icon: 'error_outline',
      },
    ];
  });

  readonly serverRows = computed(() => this.dashboard().servers);
  readonly domainRows = computed(() => this.dashboard().domains);
  readonly sortedServers = computed(() =>
    this.sortRows(this.serverRows(), this.serverSortActive(), this.serverSortDirection()),
  );
  readonly sortedDomains = computed(() =>
    this.sortRows(this.domainRows(), this.domainSortActive(), this.domainSortDirection()),
  );
  readonly visibleServers = computed(() => {
    const start = this.serverPageIndex() * this.serverPageSize();
    return this.sortedServers().slice(start, start + this.serverPageSize());
  });
  readonly visibleDomains = computed(() => {
    const start = this.domainPageIndex() * this.domainPageSize();
    return this.sortedDomains().slice(start, start + this.domainPageSize());
  });

  private readonly reportDashboardError = effect(() => {
    const error = this.dashboardResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load WebRTC dashboard.'));
  });

  setServerSort(sort: Sort): void {
    this.serverSortActive.set(sort.active || '');
    this.serverSortDirection.set(sort.direction || '');
    this.serverPageIndex.set(0);
  }

  setDomainSort(sort: Sort): void {
    this.domainSortActive.set(sort.active || '');
    this.domainSortDirection.set(sort.direction || '');
    this.domainPageIndex.set(0);
  }

  setServerPage(page: PageEvent): void {
    this.serverPageIndex.set(page.pageIndex);
    this.serverPageSize.set(page.pageSize);
  }

  setDomainPage(page: PageEvent): void {
    this.domainPageIndex.set(page.pageIndex);
    this.domainPageSize.set(page.pageSize);
  }

  private sortRows<T extends WebRtcDashboardServer | WebRtcDashboardDomain>(
    rows: T[],
    active: string,
    direction: Sort['direction'],
  ): T[] {
    if (!active || !direction) return rows;
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (left, right) =>
        String((left as any)[active] ?? '')
          .toLowerCase()
          .localeCompare(String((right as any)[active] ?? '').toLowerCase()) * multiplier,
    );
  }

  refreshList() {
    this.dashboardResource.reload();
  }

  metricPercent(item: WebRtcDashboardMetric, items: WebRtcDashboardMetric[]) {
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
    return labels[value] ?? String(value || 'unknown').toUpperCase();
  }

  statusLabel(value: number) {
    return Number(value) === 1 ? 'Active' : 'Inactive';
  }

  yesNo(value: number | boolean) {
    return Number(value) === 1 || value === true ? 'Yes' : 'No';
  }

  private async fetchDashboardSnapshot(
    params: WebRtcDashboardRequest,
  ): Promise<WebRtcDashboardData> {
    const response = await this.api.get(
      {
        period: params.period,
        serverUUID: params.serverUUID,
        domainUUID: params.domainUUID,
      },
      params.scope === 'master',
    );
    return response?.data ?? EMPTY_WEBRTC_DASHBOARD;
  }

  private ratio(value?: number, total?: number) {
    return `${this.number(value)} / ${this.number(total)}`;
  }

  private number(value?: number | null) {
    return String(Number(value ?? 0));
  }

  private items<T>(result: PromiseSettledResult<any>): T[] {
    if (result.status !== 'fulfilled') return [];
    const response = result.value;
    if (Array.isArray(response?.data?.items)) return response.data.items as T[];
    return [];
  }

  private errorMessage(error: unknown, fallback: string): string {
    const serverMessage = (error as any)?.error?.error || (error as any)?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
