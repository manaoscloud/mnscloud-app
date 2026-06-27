
import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
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
    search: string;
    status: string;
  };

type DashboardFilterOptions = {
  servers: SelectOption[];
  domains: SelectOption[];
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

const EMPTY_FILTER_OPTIONS: DashboardFilterOptions = {
  servers: [],
  domains: [],
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
  readonly searchInput = signal('');
  readonly statusInput = signal('');
  readonly serverUUID = signal('');
  readonly domainUUID = signal('');
  readonly serverSearch = signal('');
  readonly domainSearch = signal('');
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
  private readonly appliedFilters = signal<WebRtcDashboardRequest>({
    period: 'today',
    serverUUID: '',
    domainUUID: '',
    scope: this.scope(),
    search: '',
    status: '',
  });

  private readonly dashboardResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: EMPTY_WEBRTC_DASHBOARD,
    loader: ({ params }) => this.fetchDashboardSnapshot(params),
  });

  private readonly filterOptionsResource = resource({
    params: () => ({ scope: this.scope(), master: this.isMaster() }),
    defaultValue: EMPTY_FILTER_OPTIONS,
    loader: ({ params }) => this.fetchFilterOptions(params.master),
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

  readonly filteredServerOptions = computed(() =>
    this.filterOptions(this.filterOptionsResource.value().servers, this.serverSearch()),
  );
  readonly filteredDomainOptions = computed(() =>
    this.filterOptions(this.filterOptionsResource.value().domains, this.domainSearch()),
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

  readonly filteredServers = computed(() => {
    const dashboard = this.dashboard();
    const search = this.appliedFilters().search.trim().toLowerCase();
    const status = this.appliedFilters().status;
    return dashboard.servers.filter((item) => this.matchesTableFilters(item, search, status));
  });
  readonly filteredDomains = computed(() => {
    const dashboard = this.dashboard();
    const search = this.appliedFilters().search.trim().toLowerCase();
    const status = this.appliedFilters().status;
    return dashboard.domains.filter((item) => this.matchesTableFilters(item, search, status));
  });
  readonly sortedServers = computed(() =>
    this.sortRows(this.filteredServers(), this.serverSortActive(), this.serverSortDirection()),
  );
  readonly sortedDomains = computed(() =>
    this.sortRows(this.filteredDomains(), this.domainSortActive(), this.domainSortDirection()),
  );
  readonly visibleServers = computed(() => {
    const start = this.serverPageIndex() * this.serverPageSize();
    return this.sortedServers().slice(start, start + this.serverPageSize());
  });
  readonly visibleDomains = computed(() => {
    const start = this.domainPageIndex() * this.domainPageSize();
    return this.sortedDomains().slice(start, start + this.domainPageSize());
  });

  private readonly resetPagesOnDashboardFilter = effect(() => {
    this.appliedFilters();
    this.serverPageIndex.set(0);
    this.domainPageIndex.set(0);
  });

  private readonly reportFilterOptionsError = effect(() => {
    const error = this.filterOptionsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load WebRTC dashboard filters.'));
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
    this.filterOptionsResource.reload();
  }

  applySearchFilters() {
    this.appliedFilters.set({
      period: this.period(),
      serverUUID: this.serverUUID(),
      domainUUID: this.domainUUID(),
      scope: this.scope(),
      search: this.searchInput().trim(),
      status: this.statusInput(),
    });
  }

  clearSearchFilters() {
    this.period.set('today');
    this.searchInput.set('');
    this.statusInput.set('');
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

  private async fetchFilterOptions(master: boolean): Promise<DashboardFilterOptions> {
    try {
      const [serverResponse, domainResponse] = await Promise.allSettled([
        master
          ? this.webrtcApi.list('servers', { limit: this.listLimit }, 'master')
          : this.webrtcApi.list('servers', { status: 1, limit: this.listLimit }, 'tenant'),
        this.webrtcApi.list(
          'domains',
          { limit: this.listLimit },
          master ? 'master' : 'tenant',
        ),
      ]);

      return {
        servers: this.items<WebRtcRecord>(serverResponse).map((item) => ({
          value: item['RwsUUID'],
          label: `${item['RwsName'] ?? item['label'] ?? item['name'] ?? '-'}${
            item['RwsEngine'] ? ` (${item['RwsEngine']})` : ''
          }`,
        })),
        domains: this.items<WebRtcRecord>(domainResponse).map((item) => ({
          value: item['RwdUUID'] ?? item['RealtimeDomainRtdUUID'] ?? item['RtdUUID'],
          label: item['RtdName'] ?? item['domainName'] ?? item['label'] ?? '-',
        })),
      };
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to load WebRTC dashboard filters.');
      return EMPTY_FILTER_OPTIONS;
    }
  }

  private filterOptions(options: SelectOption[], search: string) {
    const term = search.trim().toLowerCase();
    return term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
  }

  private matchesTableFilters(
    item: WebRtcDashboardServer | WebRtcDashboardDomain,
    search: string,
    status: string,
  ) {
    const itemStatus = Number((item as any).status ?? 0);
    if (status !== '' && itemStatus !== Number(status)) return false;
    if (!search) return true;
    return JSON.stringify(item).toLowerCase().includes(search);
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
