import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
import { VoipDomainItem, VoipDomainService } from '../../domain/domain.service';
import { VoipPabxAccount, VoipPabxService } from '../voip-pabx.service';
import { VoipPabxServerItem, VoipPabxServerService } from '../server/server.service';
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

@Component({
  selector: 'app-voip-pabx-dashboard',
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
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  animations: [fadeIn],
})
export class VoipPabxDashboardPage implements AfterViewInit {
  private readonly api = inject(VoipPabxDashboardService);
  private readonly pabxApi = inject(VoipPabxService);
  private readonly serverApi = inject(VoipPabxServerService);
  private readonly domainApi = inject(VoipDomainService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 5000;

  readonly loading = signal(false);
  readonly period = signal('today');
  readonly pabxUUID = signal('');
  readonly serverUUID = signal('');
  readonly domainUUID = signal('');
  readonly pabxSearch = signal('');
  readonly serverSearch = signal('');
  readonly domainSearch = signal('');
  readonly generatedAt = signal<string | null>(null);
  readonly startAt = signal<string | null>(null);
  readonly summary = signal<PabxDashboardSummary>({});
  readonly callBreakdown = signal<PabxDashboardMetric[]>([]);
  readonly agentBreakdown = signal<PabxDashboardMetric[]>([]);

  readonly serverDataSource = new MatTableDataSource<PabxDashboardServer>([]);
  readonly queueDataSource = new MatTableDataSource<PabxDashboardQueue>([]);
  readonly trunkDataSource = new MatTableDataSource<PabxDashboardTrunk>([]);
  readonly serverColumns = ['health', 'name', 'engine', 'hostname', 'pabxAccounts', 'lastSeenAt'];
  readonly queueColumns = ['name', 'pabxName', 'strategy', 'members', 'availableAgents', 'status'];
  readonly trunkColumns = ['name', 'pabxName', 'direction', 'host', 'transport', 'status'];

  pabxOptions: SelectOption[] = [];
  serverOptions: SelectOption[] = [];
  domainOptions: SelectOption[] = [];

  readonly filteredPabxOptions = computed(() =>
    this.filterOptions(this.pabxOptions, this.pabxSearch()),
  );
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

  @ViewChild('serverSort') serverSort?: MatSort;
  @ViewChild('queueSort') queueSort?: MatSort;
  @ViewChild('trunkSort') trunkSort?: MatSort;
  @ViewChild('serverPaginator') serverPaginator?: MatPaginator;
  @ViewChild('queuePaginator') queuePaginator?: MatPaginator;
  @ViewChild('trunkPaginator') trunkPaginator?: MatPaginator;

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
    this.pabxUUID.set('');
    this.serverUUID.set('');
    this.domainUUID.set('');
    this.pabxSearch.set('');
    this.serverSearch.set('');
    this.domainSearch.set('');
    void this.loadDashboard();
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

  private async loadDashboard() {
    this.loading.set(true);
    try {
      const response = await this.api.get({
        period: this.period(),
        pabxUUID: this.pabxUUID(),
        serverUUID: this.serverUUID(),
        domainUUID: this.domainUUID(),
      });
      const data = response?.data;
      this.summary.set(data?.summary ?? {});
      this.generatedAt.set(data?.generatedAt ?? null);
      this.startAt.set(data?.startAt ?? null);
      this.callBreakdown.set(data?.callBreakdown ?? []);
      this.agentBreakdown.set(data?.agentBreakdown ?? []);
      this.serverDataSource.data = data?.servers ?? [];
      this.queueDataSource.data = data?.queues ?? [];
      this.trunkDataSource.data = data?.trunks ?? [];
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to load PABX dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadOptions() {
    try {
      const [pabxResponse, serverResponse, domainResponse] = await Promise.all([
        this.pabxApi.list({ limit: this.listLimit }),
        this.serverApi.list(false, { limit: this.listLimit }),
        this.domainApi.list({ limit: this.listLimit }),
      ]);
      this.pabxOptions = (pabxResponse?.data?.items ?? []).map((item: VoipPabxAccount) => ({
        value: item.VpaUUID,
        label: item.VpaName,
      }));
      this.serverOptions = (serverResponse?.data?.items ?? []).map((item: VoipPabxServerItem) => ({
        value: item.VpsUUID,
        label: `${item.VpsName} (${item.VpsEngine})`,
      }));
      this.domainOptions = (domainResponse?.data?.items ?? []).map((item: VoipDomainItem) => ({
        value: item.VdmUUID,
        label: item.VdmName,
      }));
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to load PABX dashboard filters.');
    }
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
    if (this.serverSort) this.serverDataSource.sort = this.serverSort;
    if (this.queueSort) this.queueDataSource.sort = this.queueSort;
    if (this.trunkSort) this.trunkDataSource.sort = this.trunkSort;
    if (this.serverPaginator) this.serverDataSource.paginator = this.serverPaginator;
    if (this.queuePaginator) this.queueDataSource.paginator = this.queuePaginator;
    if (this.trunkPaginator) this.trunkDataSource.paginator = this.trunkPaginator;
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
}
