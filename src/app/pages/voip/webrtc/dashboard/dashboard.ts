import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VoipWebRtcService, WebRtcRecord } from '../webrtc.service';
import {
  VoipWebRtcDashboardService,
  WebRtcDashboardDomain,
  WebRtcDashboardMetric,
  WebRtcDashboardServer,
  WebRtcDashboardSummary,
} from './dashboard.service';

type SelectOption = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-voip-webrtc-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  animations: [fadeIn],
})
export class VoipWebRtcDashboardPage implements AfterViewInit {
  private readonly api = inject(VoipWebRtcDashboardService);
  private readonly webrtcApi = inject(VoipWebRtcService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 5000;

  readonly loading = signal(false);
  readonly period = signal('today');
  readonly serverUUID = signal('');
  readonly domainUUID = signal('');
  readonly serverSearch = signal('');
  readonly domainSearch = signal('');
  readonly generatedAt = signal<string | null>(null);
  readonly startAt = signal<string | null>(null);
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly summary = signal<WebRtcDashboardSummary>({});
  readonly certificateBreakdown = signal<WebRtcDashboardMetric[]>([]);
  readonly jobBreakdown = signal<WebRtcDashboardMetric[]>([]);

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

  @ViewChild('serverSort') serverSort?: MatSort;
  @ViewChild('domainSort') domainSort?: MatSort;
  @ViewChild('serverPaginator') serverPaginator?: MatPaginator;
  @ViewChild('domainPaginator') domainPaginator?: MatPaginator;

  async ngAfterViewInit() {
    this.bindTables();
    await Promise.all([this.loadOptions(), this.loadDashboard()]);
  }

  refreshList() {
    void this.loadDashboard();
  }

  applySearchFilters() {
    void this.loadDashboard();
  }

  clearSearchFilters() {
    this.period.set('today');
    this.serverUUID.set('');
    this.domainUUID.set('');
    this.serverSearch.set('');
    this.domainSearch.set('');
    void this.loadDashboard();
  }

  onServerSelectOpened(open: boolean) {
    if (!open) this.serverSearch.set('');
  }

  onDomainSelectOpened(open: boolean) {
    if (!open) this.domainSearch.set('');
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

  private async loadDashboard() {
    this.loading.set(true);
    try {
      const response = await this.api.get(
        {
          period: this.period(),
          serverUUID: this.serverUUID(),
          domainUUID: this.domainUUID(),
        },
        this.isMaster(),
      );
      const data = response?.data;
      this.summary.set(data?.summary ?? {});
      this.generatedAt.set(data?.generatedAt ?? null);
      this.startAt.set(data?.startAt ?? null);
      this.certificateBreakdown.set(data?.certificateBreakdown ?? []);
      this.jobBreakdown.set(data?.jobBreakdown ?? []);
      this.serverDataSource.data = data?.servers ?? [];
      this.domainDataSource.data = data?.domains ?? [];
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to load WebRTC dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadOptions() {
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
        value: item['VwrUUID'],
        label: `${item['VwrName'] ?? item['label'] ?? item['name'] ?? '-'}${
          item['VwrEngine'] ? ` (${item['VwrEngine']})` : ''
        }`,
      }));
      this.domainOptions = this.items<WebRtcRecord>(domainResponse).map((item) => ({
        value: item['VwdUUID'] ?? item['VoipDomainVdmUUID'] ?? item['VdmUUID'],
        label: item['VdmName'] ?? item['domainName'] ?? item['label'] ?? '-',
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
    if (this.serverSort) this.serverDataSource.sort = this.serverSort;
    if (this.domainSort) this.domainDataSource.sort = this.domainSort;
    if (this.serverPaginator) this.serverDataSource.paginator = this.serverPaginator;
    if (this.domainPaginator) this.domainDataSource.paginator = this.domainPaginator;
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
}
