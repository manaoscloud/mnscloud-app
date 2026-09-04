import { NgClass } from '@angular/common';
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

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type HostingDatasetKey =
  | 'dnsDomains'
  | 'dnsProviders'
  | 'smtpProviders'
  | 'smtpAccounts'
  | 'smtpRoutes'
  | 'storageProviders'
  | 'storageAccounts'
  | 'vpsProviders'
  | 'vpsPlans'
  | 'vpsInstances'
  | 'containerProviders'
  | 'containerPlans'
  | 'containerInstances'
  | 'webhostProviders'
  | 'webhostPlans'
  | 'webhostHosts'
  | 'webhostEmails'
  | 'webhostDatabases'
  | 'webhostMailingLists'
  | 'webhostZoneRecords';

type GenericRow = Record<string, unknown>;

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

type WorkloadRow = {
  key: string;
  label: string;
  icon: string;
  total: number;
  active: number;
  issues: number;
  route: string[];
};

type ProviderRow = {
  key: string;
  label: string;
  total: number;
  active: number;
  defaults: number;
  route: string[];
};

type IssueRow = {
  key: string;
  type: string;
  name: string;
  status: string;
  message: string;
  route: string[];
};

const EMPTY_HOSTING_DATA: Record<HostingDatasetKey, GenericRow[]> = {
  dnsDomains: [],
  dnsProviders: [],
  smtpProviders: [],
  smtpAccounts: [],
  smtpRoutes: [],
  storageProviders: [],
  storageAccounts: [],
  vpsProviders: [],
  vpsPlans: [],
  vpsInstances: [],
  containerProviders: [],
  containerPlans: [],
  containerInstances: [],
  webhostProviders: [],
  webhostPlans: [],
  webhostHosts: [],
  webhostEmails: [],
  webhostDatabases: [],
  webhostMailingLists: [],
  webhostZoneRecords: [],
};

type HostingDashboardSnapshot = {
  data: Record<HostingDatasetKey, GenericRow[]>;
  generatedAt: string | null;
  failedSections: number;
};

const EMPTY_HOSTING_DASHBOARD: HostingDashboardSnapshot = {
  data: { ...EMPTY_HOSTING_DATA },
  generatedAt: null,
  failedSections: 0,
};

@Component({
  selector: 'app-hosting-dashboard',
  standalone: true,
  imports: [
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
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class HostingDashboardPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);

  readonly workloadSort = viewChild<MatSort>('workloadSort');
  readonly workloadPaginator = viewChild<MatPaginator>('workloadPaginator');
  readonly providerSort = viewChild<MatSort>('providerSort');
  readonly providerPaginator = viewChild<MatPaginator>('providerPaginator');
  readonly issueSort = viewChild<MatSort>('issueSort');
  readonly issuePaginator = viewChild<MatPaginator>('issuePaginator');

  private readonly dashboardResource = resource({
    params: () => ({ environmentUUID: this.auth.user()?.EnvironmentUUID ?? null }),
    defaultValue: EMPTY_HOSTING_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly data = computed(() => this.dashboard().data);
  readonly generatedAt = computed(() => this.dashboard().generatedAt);
  readonly dashboardSearchInput = signal('');
  readonly statusInput = signal('');
  private readonly dashboardSearch = signal('');

  readonly workloadDataSource = new MatTableDataSource<WorkloadRow>([]);
  readonly providerDataSource = new MatTableDataSource<ProviderRow>([]);
  readonly issueDataSource = new MatTableDataSource<IssueRow>([]);

  readonly workloadColumns = ['resource', 'total', 'active', 'issues', 'actions'];
  readonly providerColumns = ['provider', 'total', 'active', 'defaults', 'actions'];
  readonly issueColumns = ['type', 'name', 'status', 'message', 'actions'];

  private readonly syncDashboardTables = effect(() => {
    this.workloadDataSource.data = this.workloads();
    this.providerDataSource.data = this.providers();
    this.issueDataSource.data = this.issues();
  });

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load hosting dashboard.'));
      return;
    }

    const failedSections = this.dashboard().failedSections;
    if (failedSections > 0 && !this.loading()) {
      this.snack.warning('Some hosting dashboard sections could not be loaded.');
    }
  });

  readonly computeSummary = computed(() => {
    const data = this.data();
    const total = data.vpsInstances.length + data.containerInstances.length;
    const active =
      this.activeCount(data.vpsInstances, ['HviIsActive'], ['HviStatus']) +
      this.activeCount(data.containerInstances, ['HciIsActive'], ['HciStatus']);
    const issues = this.issueCount(data.vpsInstances) + this.issueCount(data.containerInstances);
    return { total, active, issues };
  });

  readonly webhostSummary = computed(() => {
    const data = this.data();
    const total = data.webhostHosts.length;
    const active = this.activeCount(data.webhostHosts, ['HwhIsActive'], ['HwhStatus']);
    const issues = this.issueCount(data.webhostHosts) + this.issueCount(data.webhostEmails);
    return { total, active, issues };
  });

  readonly domainSummary = computed(() => {
    const rows = this.data().dnsDomains;
    return {
      total: rows.length,
      active: this.activeCount(rows, [], ['HddStatus', 'status']),
      issues: this.issueCount(rows),
    };
  });

  readonly deliverySummary = computed(() => {
    const data = this.data();
    const total = data.smtpAccounts.length + data.storageAccounts.length;
    const active =
      this.activeCount(data.smtpAccounts, ['HsaIsActive'], ['HsaStatus']) +
      this.activeCount(data.storageAccounts, ['HsaIsActive'], ['HsaStatus']);
    const issues = this.issueCount(data.smtpAccounts) + this.issueCount(data.storageAccounts);
    return { total, active, issues };
  });

  readonly kpis = computed<KpiTile[]>(() => [
    {
      label: 'Compute Instances',
      value: String(this.computeSummary().total),
      detailValue: String(this.computeSummary().issues),
      detailLabel: 'issues',
      icon: 'dns',
      state: this.computeSummary().issues > 0 ? 'warn' : 'good',
    },
    {
      label: 'Webhost Accounts',
      value: String(this.webhostSummary().total),
      detailValue: String(this.webhostSummary().active),
      detailLabel: 'active resources',
      icon: 'web',
      state: this.webhostSummary().issues > 0 ? 'warn' : 'good',
    },
    {
      label: 'Domains',
      value: String(this.domainSummary().total),
      detailValue: String(this.domainSummary().active),
      detailLabel: 'active resources',
      icon: 'language',
      state: this.domainSummary().issues > 0 ? 'warn' : 'good',
    },
    {
      label: 'Delivery Accounts',
      value: String(this.deliverySummary().total),
      detailValue: String(this.deliverySummary().active),
      detailLabel: 'active resources',
      icon: 'mark_email_read',
      state: this.deliverySummary().issues > 0 ? 'warn' : 'neutral',
    },
  ]);

  private readonly setupTables = afterNextRender(() => {
    this.workloadDataSource.sortingDataAccessor = (row, column) =>
      this.workloadSortValue(row, column);
    this.providerDataSource.sortingDataAccessor = (row, column) =>
      this.providerSortValue(row, column);
    this.issueDataSource.sortingDataAccessor = (row, column) => this.issueSortValue(row, column);
    this.workloadDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);
    this.providerDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);
    this.issueDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);

    this.workloadDataSource.sort = this.workloadSort() ?? null;
    this.workloadDataSource.paginator = this.workloadPaginator() ?? null;
    this.providerDataSource.sort = this.providerSort() ?? null;
    this.providerDataSource.paginator = this.providerPaginator() ?? null;
    this.issueDataSource.sort = this.issueSort() ?? null;
    this.issueDataSource.paginator = this.issuePaginator() ?? null;
    this.applyTableFilters();
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  onDashboardSearchChange(value: string) {
    this.dashboardSearchInput.set(value);
  }

  applyDashboardFilters() {
    this.dashboardSearch.set(this.dashboardSearchInput().trim());
    this.applyTableFilters();
  }

  clearDashboardFilters() {
    this.dashboardSearchInput.set('');
    this.statusInput.set('');
    this.dashboardSearch.set('');
    this.applyTableFilters();
  }

  async loadDashboardSnapshot(): Promise<HostingDashboardSnapshot> {
    const endpointMap = this.endpointMap();
    const entries = Object.entries(endpointMap) as [HostingDatasetKey, string][];

    const results = await Promise.allSettled(
      entries.map(([, endpoint]) => this.fetchItems(endpoint)),
    );
    const nextData: Record<HostingDatasetKey, GenericRow[]> = { ...EMPTY_HOSTING_DATA };
    const failedSections = results.filter((result) => result.status === 'rejected').length;

    entries.forEach(([key], index) => {
      const result = results[index];
      nextData[key] = result.status === 'fulfilled' ? result.value : [];
    });

    if (failedSections === entries.length) {
      throw new Error('Failed to load hosting dashboard.');
    }

    return {
      data: nextData,
      generatedAt: new Date().toISOString(),
      failedSections,
    };
  }

  private hasPlatformMasterAccess() {
    return (this.auth.user()?.permissions ?? []).includes('platform.master.access');
  }

  hostingRoute(route: string[]) {
    const isMaster = this.hasPlatformMasterAccess();
    const routePath = route.join('/');

    if (!isMaster) return ['/', ...route];
    if (routePath === 'hosting/smtp/accounts') return ['/system/hosting/smtp/accounts'];
    if (routePath === 'hosting/storage/accounts') return ['/system/hosting/storage/accounts'];
    if (routePath === 'hosting/vps/instances') return ['/system/vps/instances'];
    if (routePath === 'hosting/vps/provider') return ['/system/vps/provider'];
    if (routePath === 'hosting/vps-container/instances') return ['/system/vps-container/instances'];
    if (routePath === 'hosting/vps-container/provider') return ['/system/vps-container/provider'];
    return ['/', ...route];
  }

  chipClass(issues: number) {
    return issues > 0 ? 'chip-warning' : 'chip-success is-active';
  }

  statusChipClass(status: string) {
    const normalized = status.toLowerCase();
    if (['failed', 'error', 'suspended', 'cancelled', 'canceled'].includes(normalized)) {
      return 'chip-danger';
    }
    if (['pending', 'queued', 'provisioning', 'running'].includes(normalized)) {
      return 'chip-warning';
    }
    return 'chip-success is-active';
  }

  private endpointMap(): Record<HostingDatasetKey, string> {
    return {
      dnsDomains: 'hosting/dns/domains',
      dnsProviders: 'hosting/dns/providers',
      smtpProviders: `${this.smtpRoot()}/providers`,
      smtpAccounts: `${this.smtpRoot()}/accounts`,
      smtpRoutes: `${this.smtpRoot()}/routes`,
      storageProviders: `${this.storageRoot()}/providers`,
      storageAccounts: `${this.storageRoot()}/accounts`,
      vpsProviders: `${this.vpsRoot()}/providers`,
      vpsPlans: `${this.vpsRoot()}/plans`,
      vpsInstances: `${this.vpsRoot()}/instances`,
      containerProviders: `${this.containerRoot()}/providers`,
      containerPlans: `${this.containerRoot()}/plans`,
      containerInstances: `${this.containerRoot()}/instances`,
      webhostProviders: 'hosting/webhost/providers',
      webhostPlans: 'hosting/webhost/plans',
      webhostHosts: 'hosting/webhost/hosts',
      webhostEmails: 'hosting/webhost/emails',
      webhostDatabases: 'hosting/webhost/databases',
      webhostMailingLists: 'hosting/webhost/mailing-lists',
      webhostZoneRecords: 'hosting/webhost/zone-records',
    };
  }

  private smtpRoot() {
    return this.hasPlatformMasterAccess() ? 'system/hosting/smtp' : 'hosting/smtp';
  }

  private storageRoot() {
    return this.hasPlatformMasterAccess() ? 'system/hosting/storage' : 'hosting/storage';
  }

  private vpsRoot() {
    return this.hasPlatformMasterAccess() ? 'system/hosting/vps' : 'hosting/vps';
  }

  private containerRoot() {
    return this.hasPlatformMasterAccess()
      ? 'system/hosting/vps-container'
      : 'hosting/vps-container';
  }

  private async fetchItems(endpoint: string) {
    const response = await this.api.get<unknown>(this.withLimit(endpoint));
    return this.responseItems(response);
  }

  private withLimit(endpoint: string) {
    return endpoint.includes('?')
      ? `${endpoint}&limit=500&offset=0`
      : `${endpoint}?limit=500&offset=0`;
  }

  private responseItems(response: unknown): GenericRow[] {
    const body = response as { data?: unknown; items?: unknown };
    if (Array.isArray(body?.items)) return body.items as GenericRow[];

    const data = body?.data as { items?: unknown } | undefined;
    if (Array.isArray(data?.items)) return data.items as GenericRow[];
    return [];
  }

  private workloads(): WorkloadRow[] {
    const data = this.data();
    return [
      this.workload(
        'dns-domains',
        'DNS Domains',
        'language',
        data.dnsDomains,
        [],
        ['HddStatus'],
        ['hosting', 'dns', 'domains'],
      ),
      this.workload(
        'vps-instances',
        'VPS Instances',
        'dns',
        data.vpsInstances,
        ['HviIsActive'],
        ['HviStatus'],
        ['hosting', 'vps', 'instances'],
      ),
      this.workload(
        'container-instances',
        'Container Instances',
        'apps',
        data.containerInstances,
        ['HciIsActive'],
        ['HciStatus'],
        ['hosting', 'vps-container', 'instances'],
      ),
      this.workload(
        'webhost-hosts',
        'Webhost Hosts',
        'web',
        data.webhostHosts,
        ['HwhIsActive'],
        ['HwhStatus'],
        ['hosting', 'webhost', 'hosts'],
      ),
      this.workload(
        'email-accounts',
        'Email Accounts',
        'alternate_email',
        data.webhostEmails,
        ['HweIsActive'],
        ['HweStatus'],
        ['hosting', 'webhost', 'emails'],
      ),
      this.workload(
        'smtp-accounts',
        'SMTP Accounts',
        'mark_email_read',
        data.smtpAccounts,
        ['HsaIsActive'],
        ['HsaStatus'],
        ['hosting', 'smtp', 'accounts'],
      ),
      this.workload(
        'storage-accounts',
        'Storage Accounts',
        'inventory_2',
        data.storageAccounts,
        ['HsaIsActive'],
        ['HsaStatus'],
        ['hosting', 'storage', 'accounts'],
      ),
    ];
  }

  private providers(): ProviderRow[] {
    const data = this.data();
    return [
      this.provider(
        'dns-providers',
        'DNS Providers',
        data.dnsProviders,
        [],
        ['HdpStatus'],
        ['HdpIsDefault'],
        ['hosting', 'dns', 'providers'],
      ),
      this.provider(
        'smtp-providers',
        'SMTP Providers',
        data.smtpProviders,
        ['HspIsActive'],
        ['HspStatus'],
        ['HspIsDefault'],
        ['hosting', 'smtp', 'accounts'],
      ),
      this.provider(
        'storage-providers',
        'Storage Providers',
        data.storageProviders,
        ['HspIsActive'],
        ['HspStatus'],
        ['HspIsDefault'],
        ['hosting', 'storage', 'accounts'],
      ),
      this.provider(
        'vps-providers',
        'VPS Providers',
        data.vpsProviders,
        ['HvrIsActive'],
        ['HvrStatus'],
        ['HvrIsDefault'],
        ['hosting', 'vps', 'provider'],
      ),
      this.provider(
        'container-providers',
        'Container Providers',
        data.containerProviders,
        ['HcpIsActive'],
        ['HcpStatus'],
        ['HcpIsDefault'],
        ['hosting', 'vps-container', 'provider'],
      ),
      this.provider(
        'webhost-providers',
        'Webhost Providers',
        data.webhostProviders,
        ['HwpIsActive'],
        ['HwpStatus'],
        ['HwpIsDefault'],
        ['hosting', 'webhost', 'providers'],
      ),
    ];
  }

  private issues(): IssueRow[] {
    const data = this.data();
    return [
      ...this.issueRows(
        'VPS Instance',
        data.vpsInstances,
        'HviUUID',
        'HviName',
        ['HviStatus'],
        ['HviProvisionStatus'],
        ['HviProvisionError'],
        ['hosting', 'vps', 'instances'],
      ),
      ...this.issueRows(
        'Container Instance',
        data.containerInstances,
        'HciUUID',
        'HciName',
        ['HciStatus'],
        ['HciProvisionStatus'],
        ['HciProvisionError'],
        ['hosting', 'vps-container', 'instances'],
      ),
      ...this.issueRows(
        'Webhost Host',
        data.webhostHosts,
        'HwhUUID',
        'HwhName',
        ['HwhStatus'],
        ['HwhProvisionStatus'],
        ['HwhProvisionError'],
        ['hosting', 'webhost', 'hosts'],
      ),
      ...this.issueRows(
        'Email Account',
        data.webhostEmails,
        'HweUUID',
        'HweEmail',
        ['HweStatus'],
        ['HweProvisionStatus'],
        ['HweProvisionError'],
        ['hosting', 'webhost', 'emails'],
      ),
    ].slice(0, 25);
  }

  private workload(
    key: string,
    label: string,
    icon: string,
    rows: GenericRow[],
    activeFields: string[],
    statusFields: string[],
    route: string[],
  ): WorkloadRow {
    return {
      key,
      label,
      icon,
      total: rows.length,
      active: this.activeCount(rows, activeFields, statusFields),
      issues: this.issueCount(rows),
      route,
    };
  }

  private provider(
    key: string,
    label: string,
    rows: GenericRow[],
    activeFields: string[],
    statusFields: string[],
    defaultFields: string[],
    route: string[],
  ): ProviderRow {
    return {
      key,
      label,
      total: rows.length,
      active: this.activeCount(rows, activeFields, statusFields),
      defaults: rows.filter((row) => this.truthyField(row, defaultFields)).length,
      route,
    };
  }
  private applyTableFilters() {
    const filter = this.dashboardSearch().trim().toLowerCase();
    this.workloadDataSource.filter = filter;
    this.providerDataSource.filter = filter;
    this.issueDataSource.filter = filter;
    this.workloadDataSource.paginator?.firstPage();
    this.providerDataSource.paginator?.firstPage();
    this.issueDataSource.paginator?.firstPage();
  }

  private matchesDashboardFilter(row: object, filter: string) {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return Object.values(row).some(
      (value) =>
        value !== null && value !== undefined && String(value).toLowerCase().includes(term),
    );
  }

  private issueRows(
    type: string,
    rows: GenericRow[],
    uuidField: string,
    nameField: string,
    statusFields: string[],
    provisionStatusFields: string[],
    errorFields: string[],
    route: string[],
  ): IssueRow[] {
    return rows
      .filter((row) =>
        this.isIssueRow(row, [...statusFields, ...provisionStatusFields], errorFields),
      )
      .map((row, index) => ({
        key: String(row[uuidField] ?? `${type}-${index}`),
        type,
        name: this.stringValue(row[nameField]) || '-',
        status:
          this.firstString(row, provisionStatusFields) ||
          this.firstString(row, statusFields) ||
          'Check',
        message: this.firstString(row, errorFields) || 'Review provisioning state.',
        route,
      }));
  }

  private activeCount(rows: GenericRow[], activeFields: string[], statusFields: string[]) {
    return rows.filter((row) => {
      if (activeFields.length > 0 && this.truthyField(row, activeFields)) return true;
      const status = this.firstString(row, statusFields).toLowerCase();
      return ['1', 'active', 'running', 'ready', 'completed', 'success'].includes(status);
    }).length;
  }

  private issueCount(rows: GenericRow[]) {
    return rows.filter((row) =>
      this.isIssueRow(
        row,
        Object.keys(row).filter((key) => key.toLowerCase().includes('status')),
        Object.keys(row).filter((key) => key.toLowerCase().includes('error')),
      ),
    ).length;
  }

  private isIssueRow(row: GenericRow, statusFields: string[], errorFields: string[]) {
    if (errorFields.some((field) => Boolean(this.stringValue(row[field])))) return true;
    const status = this.firstString(row, statusFields).toLowerCase();
    return ['failed', 'error', 'suspended', 'cancelled', 'canceled'].includes(status);
  }

  private truthyField(row: GenericRow, fields: string[]) {
    return fields.some((field) => {
      const value = row[field];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      return ['1', 'true', 'yes', 'active', 'default'].includes(
        this.stringValue(value).toLowerCase(),
      );
    });
  }

  private firstString(row: GenericRow, fields: string[]) {
    for (const field of fields) {
      const value = this.stringValue(row[field]);
      if (value) return value;
    }
    return '';
  }

  private stringValue(value: unknown) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  private workloadSortValue(row: WorkloadRow, column: string) {
    if (column === 'resource') return row.label;
    if (column === 'total') return row.total;
    if (column === 'active') return row.active;
    if (column === 'issues') return row.issues;
    return '';
  }

  private providerSortValue(row: ProviderRow, column: string) {
    if (column === 'provider') return row.label;
    if (column === 'total') return row.total;
    if (column === 'active') return row.active;
    if (column === 'defaults') return row.defaults;
    return '';
  }

  private issueSortValue(row: IssueRow, column: string) {
    if (column === 'type') return row.type;
    if (column === 'name') return row.name;
    if (column === 'status') return row.status;
    if (column === 'message') return row.message;
    return '';
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
