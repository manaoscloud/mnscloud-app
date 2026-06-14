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
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type SmtpProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: string;
  HspIsActive: number;
  HspIsDefault: number;
};

type SmtpAccount = {
  HsaUUID: string;
  HsaName: string;
  HostingSmtpProviderHspUUID: string;
  HsaDefaultFromName?: string | null;
  HsaDefaultFromEmail?: string | null;
  HsaIsActive: number;
  HsaIsDefault: number;
  HspName?: string;
  HspProvider?: string;
};

type SmtpRoute = {
  HsrUUID: string;
  HsrEventType: string;
  HsrFromName?: string | null;
  HsrFromEmail?: string | null;
  HsrIsActive: number;
  HostingSmtpAccountHsaUUID: string;
  HsaName?: string;
  HspName?: string;
  HspProvider?: string;
};

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

type ProviderRow = {
  uuid: string;
  name: string;
  provider: string;
  active: boolean;
  isDefault: boolean;
  accounts: number;
  routes: number;
  issues: number;
};

type AccountRow = {
  uuid: string;
  name: string;
  provider: string;
  from: string;
  active: boolean;
  isDefault: boolean;
  routes: number;
};

type RouteRow = {
  uuid: string;
  event: string;
  account: string;
  provider: string;
  from: string;
  active: boolean;
};

type SmtpDashboardSnapshot = {
  providers: SmtpProvider[];
  accounts: SmtpAccount[];
  routes: SmtpRoute[];
  failedSections: number;
};

const EMPTY_SMTP_DASHBOARD: SmtpDashboardSnapshot = {
  providers: [],
  accounts: [],
  routes: [],
  failedSections: 0,
};

@Component({
  selector: 'app-hosting-smtp-dashboard',
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
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class HostingSmtpDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly providerSort = viewChild<MatSort>('providerSort');
  readonly providerPaginator = viewChild<MatPaginator>('providerPaginator');
  readonly accountSort = viewChild<MatSort>('accountSort');
  readonly accountPaginator = viewChild<MatPaginator>('accountPaginator');
  readonly routeSort = viewChild<MatSort>('routeSort');
  readonly routePaginator = viewChild<MatPaginator>('routePaginator');

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  private readonly dashboardResource = resource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_SMTP_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly providers = computed(() => this.dashboard().providers);
  readonly accounts = computed(() => this.dashboard().accounts);
  readonly routes = computed(() => this.dashboard().routes);
  readonly dashboardSearchInput = signal('');
  private readonly dashboardSearch = signal('');


  readonly providerDataSource = new MatTableDataSource<ProviderRow>([]);
  readonly accountDataSource = new MatTableDataSource<AccountRow>([]);
  readonly routeDataSource = new MatTableDataSource<RouteRow>([]);

  readonly providerColumns = [
    'provider',
    'type',
    'active',
    'default',
    'accounts',
    'routes',
    'issues',
    'actions',
  ];
  readonly accountColumns = [
    'account',
    'provider',
    'from',
    'active',
    'default',
    'routes',
    'actions',
  ];
  readonly routeColumns = ['event', 'account', 'provider', 'from', 'active', 'actions'];

  private readonly syncDashboardTables = effect(() => {
    this.providerDataSource.data = this.providerRows();
    this.accountDataSource.data = this.accountRows();
    this.routeDataSource.data = this.routeRows();
  });

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load SMTP dashboard.'));
      return;
    }

    const failedSections = this.dashboard().failedSections;
    if (failedSections > 0 && !this.loading()) {
      this.snack.warning('Some SMTP dashboard sections could not be loaded.');
    }
  });

  readonly providerSummary = computed(() => {
    const rows = this.providers();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HspIsActive)).length;
    const defaults = rows.filter((row) => Number(row.HspIsDefault ?? 0) === 1).length;
    return { total, active, defaults };
  });

  readonly accountSummary = computed(() => {
    const rows = this.accounts();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HsaIsActive)).length;
    const defaults = rows.filter((row) => Number(row.HsaIsDefault ?? 0) === 1).length;
    return { total, active, defaults };
  });

  readonly routeSummary = computed(() => {
    const rows = this.routes();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HsrIsActive)).length;
    const linked = rows.filter((row) =>
      Boolean(this.accountLabel(row.HostingSmtpAccountHsaUUID)),
    ).length;
    return { total, active, linked };
  });

  readonly readinessSummary = computed(() => {
    const providerReady = this.providerSummary().active > 0;
    const accountReady = this.accountSummary().active > 0;
    const routeReady = this.routeSummary().active > 0;
    const checks = [providerReady, accountReady, routeReady];
    const passed = checks.filter(Boolean).length;
    return { passed, total: checks.length };
  });

  readonly kpis = computed<KpiTile[]>(() => [
    {
      label: 'SMTP Providers',
      value: `${this.providerSummary().active} / ${this.providerSummary().total}`,
      detailValue: String(this.providerSummary().defaults),
      detailLabel: 'defaults',
      icon: 'cloud_sync',
      state: this.providerSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'SMTP Accounts',
      value: `${this.accountSummary().active} / ${this.accountSummary().total}`,
      detailValue: String(this.accountSummary().defaults),
      detailLabel: 'defaults',
      icon: 'alternate_email',
      state: this.accountSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'SMTP Routes',
      value: `${this.routeSummary().active} / ${this.routeSummary().total}`,
      detailValue: String(this.routeSummary().linked),
      detailLabel: 'linked',
      icon: 'route',
      state: this.routeSummary().active > 0 ? 'good' : 'neutral',
    },
    {
      label: 'Delivery Readiness',
      value: `${this.readinessSummary().passed} / ${this.readinessSummary().total}`,
      detailValue: String(this.providerRows().reduce((sum, row) => sum + row.issues, 0)),
      detailLabel: 'issues',
      icon: 'mark_email_read',
      state:
        this.readinessSummary().passed === this.readinessSummary().total
          ? 'good'
          : this.readinessSummary().passed > 0
            ? 'warn'
            : 'bad',
    },
  ]);

  private readonly setupTables = afterNextRender(() => {
    this.providerDataSource.sortingDataAccessor = (row, column) =>
      this.providerSortValue(row, column);
    this.accountDataSource.sortingDataAccessor = (row, column) =>
      this.accountSortValue(row, column);
    this.routeDataSource.sortingDataAccessor = (row, column) => this.routeSortValue(row, column);
    this.providerDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);
    this.accountDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);
    this.routeDataSource.filterPredicate = (row, filter) =>
      this.matchesDashboardFilter(row, filter);

    this.providerDataSource.sort = this.providerSort() ?? null;
    this.providerDataSource.paginator = this.providerPaginator() ?? null;
    this.accountDataSource.sort = this.accountSort() ?? null;
    this.accountDataSource.paginator = this.accountPaginator() ?? null;
    this.routeDataSource.sort = this.routeSort() ?? null;
    this.routeDataSource.paginator = this.routePaginator() ?? null;
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
    this.dashboardSearch.set('');
    this.applyTableFilters();
  }

  async loadDashboardSnapshot(): Promise<SmtpDashboardSnapshot> {
    const [providersResult, accountsResult, routesResult] = await Promise.allSettled([
      this.api.get<unknown>(`${this.providerEndpoint()}?limit=500&offset=0`),
      this.api.get<unknown>(`${this.accountEndpoint()}?limit=500&offset=0`),
      this.api.get<unknown>(`${this.routeEndpoint()}?limit=500&offset=0`),
    ]);

    const results = [providersResult, accountsResult, routesResult];
    const failedSections = results.filter((result) => result.status === 'rejected').length;

    if (failedSections === results.length) {
      throw new Error('Failed to load SMTP dashboard.');
    }

    return {
      providers:
        providersResult.status === 'fulfilled'
          ? this.items<SmtpProvider>(providersResult.value)
          : [],
      accounts:
        accountsResult.status === 'fulfilled' ? this.items<SmtpAccount>(accountsResult.value) : [],
      routes: routesResult.status === 'fulfilled' ? this.items<SmtpRoute>(routesResult.value) : [],
      failedSections,
    };
  }

  routeTo(section: 'providers' | 'accounts' | 'routes') {
    return this.isMaster() ? ['/system/hosting/smtp', section] : ['/hosting/smtp', section];
  }

  chipClass(value: boolean | number) {
    return Boolean(value) ? 'chip-success is-active' : 'chip-skipped is-inactive';
  }

  issueChipClass(issues: number) {
    return issues > 0 ? 'chip-warning' : 'chip-success is-active';
  }

  private providerEndpoint() {
    return this.isMaster() ? 'system/hosting/smtp/providers' : 'hosting/smtp/providers';
  }

  private accountEndpoint() {
    return this.isMaster() ? 'system/hosting/smtp/accounts' : 'hosting/smtp/accounts';
  }

  private routeEndpoint() {
    return this.isMaster() ? 'system/hosting/smtp/routes' : 'hosting/smtp/routes';
  }
  private applyTableFilters() {
    const filter = this.dashboardSearch().trim().toLowerCase();
    this.providerDataSource.filter = filter;
    this.accountDataSource.filter = filter;
    this.routeDataSource.filter = filter;
    this.providerDataSource.paginator?.firstPage();
    this.accountDataSource.paginator?.firstPage();
    this.routeDataSource.paginator?.firstPage();
  }

  private matchesDashboardFilter(row: object, filter: string) {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return Object.values(row).some((value) =>
      value !== null && value !== undefined && String(value).toLowerCase().includes(term),
    );
  }


  private providerRows(): ProviderRow[] {
    return this.providers().map((provider) => {
      const accounts = this.accounts().filter(
        (account) => account.HostingSmtpProviderHspUUID === provider.HspUUID,
      );
      const routes = this.routes().filter((route) =>
        accounts.some((account) => account.HsaUUID === route.HostingSmtpAccountHsaUUID),
      );
      return {
        uuid: provider.HspUUID,
        name: provider.HspName,
        provider: provider.HspProvider,
        active: this.isActive(provider.HspIsActive),
        isDefault: Number(provider.HspIsDefault ?? 0) === 1,
        accounts: accounts.length,
        routes: routes.length,
        issues: this.providerIssues(provider, accounts, routes),
      };
    });
  }

  private accountRows(): AccountRow[] {
    return this.accounts().map((account) => ({
      uuid: account.HsaUUID,
      name: account.HsaName,
      provider: account.HspName || this.providerLabel(account.HostingSmtpProviderHspUUID),
      from: this.fromLabel(account.HsaDefaultFromName, account.HsaDefaultFromEmail),
      active: this.isActive(account.HsaIsActive),
      isDefault: Number(account.HsaIsDefault ?? 0) === 1,
      routes: this.routes().filter((route) => route.HostingSmtpAccountHsaUUID === account.HsaUUID)
        .length,
    }));
  }

  private routeRows(): RouteRow[] {
    return this.routes().map((route) => ({
      uuid: route.HsrUUID,
      event: route.HsrEventType || 'general',
      account: route.HsaName || this.accountLabel(route.HostingSmtpAccountHsaUUID),
      provider: route.HspName || this.routeProviderLabel(route),
      from: this.fromLabel(route.HsrFromName, route.HsrFromEmail),
      active: this.isActive(route.HsrIsActive),
    }));
  }

  private providerIssues(provider: SmtpProvider, accounts: SmtpAccount[], routes: SmtpRoute[]) {
    let issues = 0;
    if (!this.isActive(provider.HspIsActive)) issues += 1;
    if (accounts.length === 0) issues += 1;
    if (routes.length === 0) issues += 1;
    issues += accounts.filter((account) => !this.isActive(account.HsaIsActive)).length;
    issues += routes.filter((route) => !this.isActive(route.HsrIsActive)).length;
    return issues;
  }

  private providerLabel(uuid: string) {
    const provider = this.providers().find((item) => item.HspUUID === uuid);
    return provider?.HspName || '-';
  }

  private accountLabel(uuid: string) {
    const account = this.accounts().find((item) => item.HsaUUID === uuid);
    return account?.HsaName || '';
  }

  private routeProviderLabel(route: SmtpRoute) {
    const account = this.accounts().find(
      (item) => item.HsaUUID === route.HostingSmtpAccountHsaUUID,
    );
    if (!account) return '-';
    return account.HspName || this.providerLabel(account.HostingSmtpProviderHspUUID);
  }

  private fromLabel(name?: string | null, email?: string | null) {
    const cleanName = String(name ?? '').trim();
    const cleanEmail = String(email ?? '').trim();
    if (cleanName && cleanEmail) return `${cleanName} <${cleanEmail}>`;
    return cleanEmail || cleanName || '-';
  }

  private isActive(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string' && value.trim()) {
      return ['1', 'true', 'active', 'running', 'ready'].includes(value.toLowerCase());
    }
    return false;
  }

  private items<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];
    const wrapped = response as { data?: { items?: T[] } | T[]; items?: T[] };
    if (Array.isArray(wrapped?.items)) return wrapped.items;
    if (Array.isArray(wrapped?.data)) return wrapped.data;
    if (Array.isArray((wrapped?.data as { items?: T[] } | undefined)?.items)) {
      return (wrapped.data as { items: T[] }).items;
    }
    return [];
  }

  private providerSortValue(row: ProviderRow, column: string) {
    if (column === 'provider') return row.name;
    if (column === 'type') return row.provider;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'default') return row.isDefault ? 1 : 0;
    if (column === 'accounts') return row.accounts;
    if (column === 'routes') return row.routes;
    if (column === 'issues') return row.issues;
    return '';
  }

  private accountSortValue(row: AccountRow, column: string) {
    if (column === 'account') return row.name;
    if (column === 'provider') return row.provider;
    if (column === 'from') return row.from;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'default') return row.isDefault ? 1 : 0;
    if (column === 'routes') return row.routes;
    return '';
  }

  private routeSortValue(row: RouteRow, column: string) {
    if (column === 'event') return row.event;
    if (column === 'account') return row.account;
    if (column === 'provider') return row.provider;
    if (column === 'from') return row.from;
    if (column === 'active') return row.active ? 1 : 0;
    return '';
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
