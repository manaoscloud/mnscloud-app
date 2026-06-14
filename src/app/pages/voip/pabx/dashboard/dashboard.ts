import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { VoipDomainItem, VoipDomainService } from '../../domain/domain.service';
import { VoipPabxAccount, VoipPabxService } from '../voip-pabx.service';
import { VoipPabxServerItem, VoipPabxServerService } from '../server/server.service';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  PabxDashboardMetric,
  PabxDashboardQueue,
  PabxDashboardServer,
  PabxDashboardSummary,
  PabxDashboardTrunk,
  VoipPabxDashboardService,
} from './dashboard.service';

type SelectOption = {
  value: string;
  label: string;
};

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

type PabxDashboardOptions = {
  pabxOptions: SelectOption[];
  serverOptions: SelectOption[];
  domainOptions: SelectOption[];
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

const EMPTY_PABX_OPTIONS: PabxDashboardOptions = {
  pabxOptions: [],
  serverOptions: [],
  domainOptions: [],
};

@Component({
  selector: 'app-voip-pabx-dashboard',
  standalone: true,
  imports: [
    RefreshButtonComponent,
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
    TranslocoPipe,
    DatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPabxDashboardPage {
  private readonly api = inject(VoipPabxDashboardService);
  private readonly pabxApi = inject(VoipPabxService);
  private readonly serverApi = inject(VoipPabxServerService);
  private readonly domainApi = inject(VoipDomainService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 5000;

  readonly period = signal('today');
  readonly pabxUUID = signal('');
  readonly serverUUID = signal('');
  readonly domainUUID = signal('');
  readonly pabxSearch = signal('');
  readonly serverSearch = signal('');
  readonly domainSearch = signal('');
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  private readonly dashboardResource = resource({
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

  private readonly optionsResource = resource({
    params: () => ({ isMaster: this.isMaster() }),
    defaultValue: EMPTY_PABX_OPTIONS,
    loader: ({ params }) => this.loadOptionsSnapshot(params.isMaster),
  });

  readonly loading = computed(
    () => this.dashboardResource.isLoading() || this.optionsResource.isLoading(),
  );
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly summary = computed(() => this.dashboard().summary);
  readonly generatedAt = computed(() => this.dashboard().generatedAt);
  readonly startAt = computed(() => this.dashboard().startAt);
  readonly callBreakdown = computed(() => this.dashboard().callBreakdown);
  readonly agentBreakdown = computed(() => this.dashboard().agentBreakdown);
  readonly pabxOptions = computed(() => this.optionsResource.value().pabxOptions);
  readonly serverOptions = computed(() => this.optionsResource.value().serverOptions);
  readonly domainOptions = computed(() => this.optionsResource.value().domainOptions);

  readonly serverDataSource = new MatTableDataSource<PabxDashboardServer>([]);
  readonly queueDataSource = new MatTableDataSource<PabxDashboardQueue>([]);
  readonly trunkDataSource = new MatTableDataSource<PabxDashboardTrunk>([]);
  readonly serverColumns = ['health', 'name', 'engine', 'hostname', 'pabxAccounts', 'lastSeenAt'];
  readonly queueColumns = ['name', 'pabxName', 'strategy', 'members', 'availableAgents', 'status'];
  readonly trunkColumns = ['name', 'pabxName', 'direction', 'host', 'transport', 'status'];

  readonly filteredPabxOptions = computed(() =>
    this.filterOptions(this.pabxOptions(), this.pabxSearch()),
  );
  readonly filteredServerOptions = computed(() =>
    this.filterOptions(this.serverOptions(), this.serverSearch()),
  );
  readonly filteredDomainOptions = computed(() =>
    this.filterOptions(this.domainOptions(), this.domainSearch()),
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

  readonly serverSort = viewChild<MatSort>('serverSort');
  readonly queueSort = viewChild<MatSort>('queueSort');
  readonly trunkSort = viewChild<MatSort>('trunkSort');
  readonly serverPaginator = viewChild<MatPaginator>('serverPaginator');
  readonly queuePaginator = viewChild<MatPaginator>('queuePaginator');
  readonly trunkPaginator = viewChild<MatPaginator>('trunkPaginator');

  private readonly syncDashboardTables = effect(() => {
    const dashboard = this.dashboard();
    this.serverDataSource.data = dashboard.servers;
    this.queueDataSource.data = dashboard.queues;
    this.trunkDataSource.data = dashboard.trunks;
  });

  private readonly reportDashboardState = effect(() => {
    const dashboardError = this.dashboardResource.error();
    if (dashboardError) {
      this.snack.error(this.errorMessage(dashboardError, 'Failed to load PABX dashboard.'));
    }

    const optionsError = this.optionsResource.error();
    if (optionsError) {
      this.snack.error(this.errorMessage(optionsError, 'Failed to load PABX dashboard filters.'));
    }
  });

  private readonly setupTables = afterNextRender(() => {
    this.bindTables();
  });

  refreshList() {
    this.dashboardResource.reload();
    this.optionsResource.reload();
  }

  applySearchFilters() {
    this.dashboardResource.reload();
  }

  clearSearchFilters() {
    this.period.set('today');
    this.pabxUUID.set('');
    this.serverUUID.set('');
    this.domainUUID.set('');
    this.pabxSearch.set('');
    this.serverSearch.set('');
    this.domainSearch.set('');
    this.dashboardResource.reload();
  }

  onPabxSelectOpened(open: boolean) {
    if (!open) this.pabxSearch.set('');
  }

  onServerSelectOpened(open: boolean) {
    if (!open) this.serverSearch.set('');
  }

  onDomainSelectOpened(open: boolean) {
    if (!open) this.domainSearch.set('');
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

  private async loadOptionsSnapshot(isMaster: boolean): Promise<PabxDashboardOptions> {
    const [pabxResponse, serverResponse, domainResponse] = await Promise.allSettled([
      this.pabxApi.list({ limit: this.listLimit }, isMaster),
      this.serverApi.list(isMaster, { limit: this.listLimit }),
      this.domainApi.list({ limit: this.listLimit }, isMaster ? 'master' : 'tenant'),
    ]);

    return {
      pabxOptions: this.items<VoipPabxAccount>(pabxResponse).map((item) => ({
        value: item.VpaUUID,
        label: item.VpaName,
      })),
      serverOptions: this.items<VoipPabxServerItem>(serverResponse).map((item) => ({
        value: item.VpsUUID,
        label: `${item.VpsName} (${item.VpsEngine})`,
      })),
      domainOptions: this.items<VoipDomainItem>(domainResponse).map((item) => ({
        value: item.VdmUUID,
        label: item.VdmName,
      })),
    };
  }

  private bindTables() {
    this.serverDataSource.sortingDataAccessor = (item, column) => {
      if (column === 'lastSeenAt') return item.lastSeenAt ?? '';
      return String((item as any)[column] ?? '').toLowerCase();
    };
    this.queueDataSource.sortingDataAccessor = (item, column) =>
      String((item as any)[column] ?? '').toLowerCase();
    this.trunkDataSource.sortingDataAccessor = (item, column) =>
      String((item as any)[column] ?? '').toLowerCase();
    const serverSort = this.serverSort();
    if (serverSort) this.serverDataSource.sort = serverSort;
    const queueSort = this.queueSort();
    if (queueSort) this.queueDataSource.sort = queueSort;
    const trunkSort = this.trunkSort();
    if (trunkSort) this.trunkDataSource.sort = trunkSort;
    const serverPaginator = this.serverPaginator();
    if (serverPaginator) this.serverDataSource.paginator = serverPaginator;
    const queuePaginator = this.queuePaginator();
    if (queuePaginator) this.queueDataSource.paginator = queuePaginator;
    const trunkPaginator = this.trunkPaginator();
    if (trunkPaginator) this.trunkDataSource.paginator = trunkPaginator;
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

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    const apiError = error as { error?: { error?: string }; message?: string } | null;
    return apiError?.error?.error || apiError?.message || fallback;
  }
}
