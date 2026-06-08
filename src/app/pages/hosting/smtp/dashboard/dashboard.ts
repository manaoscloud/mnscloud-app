import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ViewChild, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { TranslocoPipe } from '@jsverse/transloco';

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

@Component({
  selector: 'app-hosting-smtp-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class HostingSmtpDashboardPage implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private loadingStarted = 0;

  @ViewChild('providerSort') providerSort?: MatSort;
  @ViewChild('providerPaginator') providerPaginator?: MatPaginator;
  @ViewChild('accountSort') accountSort?: MatSort;
  @ViewChild('accountPaginator') accountPaginator?: MatPaginator;
  @ViewChild('routeSort') routeSort?: MatSort;
  @ViewChild('routePaginator') routePaginator?: MatPaginator;

  readonly loading = signal(false);
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly providers = signal<SmtpProvider[]>([]);
  readonly accounts = signal<SmtpAccount[]>([]);
  readonly routes = signal<SmtpRoute[]>([]);

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

  ngAfterViewInit() {
    this.providerDataSource.sortingDataAccessor = (row, column) =>
      this.providerSortValue(row, column);
    this.accountDataSource.sortingDataAccessor = (row, column) =>
      this.accountSortValue(row, column);
    this.routeDataSource.sortingDataAccessor = (row, column) => this.routeSortValue(row, column);

    this.providerDataSource.sort = this.providerSort ?? null;
    this.providerDataSource.paginator = this.providerPaginator ?? null;
    this.accountDataSource.sort = this.accountSort ?? null;
    this.accountDataSource.paginator = this.accountPaginator ?? null;
    this.routeDataSource.sort = this.routeSort ?? null;
    this.routeDataSource.paginator = this.routePaginator ?? null;

    void this.load();
  }

  refreshList() {
    void this.load();
  }

  async load() {
    this.loadingStarted = performance.now();
    this.loading.set(true);

    try {
      const [providersResult, accountsResult, routesResult] = await Promise.allSettled([
        this.api.get<unknown>(`${this.providerEndpoint()}?limit=500&offset=0`),
        this.api.get<unknown>(`${this.accountEndpoint()}?limit=500&offset=0`),
        this.api.get<unknown>(`${this.routeEndpoint()}?limit=500&offset=0`),
      ]);

      const failed = [providersResult, accountsResult, routesResult].filter(
        (result) => result.status === 'rejected',
      ).length;

      this.providers.set(
        providersResult.status === 'fulfilled'
          ? this.items<SmtpProvider>(providersResult.value)
          : [],
      );
      this.accounts.set(
        accountsResult.status === 'fulfilled' ? this.items<SmtpAccount>(accountsResult.value) : [],
      );
      this.routes.set(
        routesResult.status === 'fulfilled' ? this.items<SmtpRoute>(routesResult.value) : [],
      );

      this.applyDataSources();

      if (failed === 3) {
        this.snack.error('Failed to load SMTP dashboard.');
      } else if (failed > 0) {
        this.snack.warning('Some SMTP dashboard sections could not be loaded.');
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load SMTP dashboard.'));
      this.providers.set([]);
      this.accounts.set([]);
      this.routes.set([]);
      this.applyDataSources();
    } finally {
      const elapsed = performance.now() - this.loadingStarted;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
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

  private applyDataSources() {
    this.providerDataSource.data = this.providerRows();
    this.accountDataSource.data = this.accountRows();
    this.routeDataSource.data = this.routeRows();
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
