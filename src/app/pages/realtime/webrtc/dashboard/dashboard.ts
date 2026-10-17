import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';

import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../../shared/crud/configurable-crud/global-table';
import {
  activeStatusColumn,
  lastSeenColumn,
  serverHealthColumn,
} from '../../../../shared/dashboard/dashboard-table-columns';
import {
  RealtimeWebRtcDashboardService,
  WebRtcDashboardData,
  WebRtcDashboardFilters,
  WebRtcDashboardMetric,
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
    DashboardPageComponent,
    RouterModule,
    MatIconModule,
    TranslocoPipe,
    GlobalTableComponent,
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
  readonly serverTable = defineGlobalTable({
    key: 'realtime/webrtc/dashboard/servers',
    uuidField: 'serverUUID',
    emptyLabel: 'No WebRTC servers found.',
    columns: [
      serverHealthColumn(),
      { id: 'name', label: 'Name', field: 'name' },
      { id: 'engine', label: 'Engine', field: 'engine' },
      { id: 'hostname', label: 'Host', field: 'hostname' },
      { id: 'publicDomain', label: 'Public Domain', field: 'publicDomain' },
      { id: 'version', label: 'Version', field: 'version' },
      { id: 'domains', label: 'Domains', field: 'domains', kind: 'number' },
      lastSeenColumn(),
    ],
  });
  readonly domainTable = defineGlobalTable({
    key: 'realtime/webrtc/dashboard/domains',
    uuidField: 'domainUUID',
    emptyLabel: 'No WebRTC domains found.',
    columns: [
      activeStatusColumn(),
      { id: 'domainName', label: 'Domain', field: 'domainName' },
      { id: 'serverName', label: 'Server', field: 'serverName' },
      {
        id: 'certificateStatus',
        label: 'Certificate',
        field: 'certificateStatus',
        translateValue: true,
      },
      { id: 'nginxStatus', label: 'Nginx', field: 'nginxStatus', translateValue: true },
      { id: 'autoProvision', label: 'Auto Provision', field: 'autoProvision', kind: 'boolean' },
      lastSeenColumn('lastSyncedAt', 'Last Sync'),
      { id: 'lastError', label: 'Last Error', field: 'lastError' },
    ],
  });
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
  private readonly reportDashboardError = effect(() => {
    const error = this.dashboardResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load WebRTC dashboard.'));
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  metricPercent(item: WebRtcDashboardMetric, items: WebRtcDashboardMetric[]) {
    const total = items.reduce((sum, metric) => sum + Number(metric.value ?? 0), 0);
    return total > 0 ? Math.round((Number(item.value ?? 0) / total) * 100) : 0;
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
