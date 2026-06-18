
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
import { MatTooltipModule } from '@angular/material/tooltip';

import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RealtimeWebRtcService, WebRtcRecord } from '../webrtc.service';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../../shared/date-time/date-time.pipe';
import {
  RealtimeWebRtcDashboardService,
  WebRtcDashboardDomain,
  WebRtcDashboardData,
  WebRtcDashboardFilters,
  WebRtcDashboardMetric,
  WebRtcDashboardServer,
} from './dashboard.service';

type SelectOption = {
  value: string;
  label: string;
};

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
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class RealtimeWebRtcDashboardPage {
  private readonly api = inject(RealtimeWebRtcDashboardService);
  private readonly webrtcApi = inject(RealtimeWebRtcService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 5000;

  readonly period = signal('today');
  readonly serverUUID = signal('');
  readonly domainUUID = signal('');
  readonly serverSearch = signal('');
  readonly domainSearch = signal('');
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  private readonly appliedFilters = signal<WebRtcDashboardRequest>({
    period: 'today',
    serverUUID: '',
    domainUUID: '',
    scope: this.scope(),
  });

  private readonly dashboardResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: EMPTY_WEBRTC_DASHBOARD,
    loader: ({ params }) => this.fetchDashboardSnapshot(params),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly summary = computed(() => this.dashboard().summary);
  readonly certificateBreakdown = computed(() => this.dashboard().certificateBreakdown);
  readonly jobBreakdown = computed(() => this.dashboard().jobBreakdown);

  readonly serverDataSource = new MatTableDataSource<WebRtcDashboardServer>([]);
  readonly domainDataSource = new MatTableDataSource<WebRtcDashboardDomain>([]);
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

  serverOptions: SelectOption[] = [];
  domainOptions: SelectOption[] = [];

  readonly filteredServerOptions = computed(() =>
    this.filterOptions(this.serverOptions, this.serverSearch()),
  );
  readonly filteredDomainOptions = computed(() =>
    this.filterOptions(this.domainOptions, this.domainSearch()),
  );
  readonly periodOptions = [
    { value: 'today', label: 'Today' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7d' },
    { value: '30d', label: 'Last 30d' },
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

  readonly serverSort = viewChild<MatSort>('serverSort');
  readonly domainSort = viewChild<MatSort>('domainSort');
  readonly serverPaginator = viewChild<MatPaginator>('serverPaginator');
  readonly domainPaginator = viewChild<MatPaginator>('domainPaginator');

  private readonly syncDashboardTables = effect(() => {
    const dashboard = this.dashboard();
    this.serverDataSource.data = dashboard.servers;
    this.domainDataSource.data = dashboard.domains;
  });

  private readonly reportDashboardError = effect(() => {
    const error = this.dashboardResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load WebRTC dashboard.'));
  });

  private readonly setupTables = afterNextRender(() => {
    this.bindTables();
    void this.fetchOptions();
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  applySearchFilters() {
    this.appliedFilters.set({
      period: this.period(),
      serverUUID: this.serverUUID(),
      domainUUID: this.domainUUID(),
      scope: this.scope(),
    });
  }

  clearSearchFilters() {
    this.period.set('today');
    this.serverUUID.set('');
    this.domainUUID.set('');
    this.serverSearch.set('');
    this.domainSearch.set('');
    this.applySearchFilters();
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

  onServerSelectOpened(open: boolean) {
    if (!open) this.serverSearch.set('');
  }

  onDomainSelectOpened(open: boolean) {
    if (!open) this.domainSearch.set('');
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

  private async fetchOptions() {
    try {
      const [serverResponse, domainResponse] = await Promise.allSettled([
        this.isMaster()
          ? this.webrtcApi.list('servers', { limit: this.listLimit }, 'master')
          : this.webrtcApi.listServerOptions(),
        this.webrtcApi.list(
          'domains',
          { limit: this.listLimit },
          this.isMaster() ? 'master' : 'tenant',
        ),
      ]);

      this.serverOptions = this.items<WebRtcRecord>(serverResponse).map((item) => ({
        value: item['RwsUUID'],
        label: `${item['RwsName'] ?? item['label'] ?? item['name'] ?? '-'}${
          item['RwsEngine'] ? ` (${item['RwsEngine']})` : ''
        }`,
      }));
      this.domainOptions = this.items<WebRtcRecord>(domainResponse).map((item) => ({
        value: item['RwdUUID'] ?? item['RealtimeDomainRtdUUID'] ?? item['RtdUUID'],
        label: item['RtdName'] ?? item['domainName'] ?? item['label'] ?? '-',
      }));
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to load WebRTC dashboard filters.');
    }
  }

  private bindTables() {
    this.serverDataSource.sortingDataAccessor = (item, column) => {
      if (column === 'lastSeenAt') return item.lastSeenAt ?? '';
      return String((item as any)[column] ?? '').toLowerCase();
    };
    this.domainDataSource.sortingDataAccessor = (item, column) => {
      if (column === 'lastSyncedAt') return item.lastSyncedAt ?? '';
      return String((item as any)[column] ?? '').toLowerCase();
    };
    const serverSort = this.serverSort();
    if (serverSort) this.serverDataSource.sort = serverSort;
    const domainSort = this.domainSort();
    if (domainSort) this.domainDataSource.sort = domainSort;
    const serverPaginator = this.serverPaginator();
    if (serverPaginator) this.serverDataSource.paginator = serverPaginator;
    const domainPaginator = this.domainPaginator();
    if (domainPaginator) this.domainDataSource.paginator = domainPaginator;
  }

  private filterOptions(options: SelectOption[], search: string) {
    const term = search.trim().toLowerCase();
    return term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
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
    if (Array.isArray(response)) return response as T[];
    if (Array.isArray(response?.items)) return response.items as T[];
    if (Array.isArray(response?.data)) return response.data as T[];
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
