import { NgClass } from '@angular/common';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type StorageProviderType = 's3' | 'gcs' | 'azure' | 'spaces' | 'sangfor_scp';

type StorageProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: StorageProviderType;
  HspConfig?: Record<string, unknown> | string | null;
  HspIsActive: number;
  HspIsDefault: number;
};

type StorageAccount = {
  HsaUUID: string;
  HsaName: string;
  HostingStorageProviderHspUUID: string;
  HsaConfig?: Record<string, unknown> | string | null;
  HsaIsActive: number;
  HsaIsDefault: number;
  HspName?: string;
  HspProvider?: StorageProviderType;
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
  buckets: number;
  issues: number;
};

type AccountRow = {
  uuid: string;
  name: string;
  provider: string;
  bucket: string;
  region: string;
  active: boolean;
  isDefault: boolean;
};

type ProviderTypeRow = {
  provider: string;
  providers: number;
  accounts: number;
  activeAccounts: number;
  issues: number;
};

type StorageDashboardSnapshot = {
  providers: StorageProvider[];
  accounts: StorageAccount[];
  failedSections: number;
};

const EMPTY_STORAGE_DASHBOARD: StorageDashboardSnapshot = {
  providers: [],
  accounts: [],
  failedSections: 0,
};

@Component({
  selector: 'app-hosting-storage-dashboard',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingStorageDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly providerSort = viewChild<MatSort>('providerSort');
  readonly providerPaginator = viewChild<MatPaginator>('providerPaginator');
  readonly accountSort = viewChild<MatSort>('accountSort');
  readonly accountPaginator = viewChild<MatPaginator>('accountPaginator');
  readonly typeSort = viewChild<MatSort>('typeSort');
  readonly typePaginator = viewChild<MatPaginator>('typePaginator');

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  private readonly dashboardResource = resource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_STORAGE_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly providers = computed(() => this.dashboard().providers);
  readonly accounts = computed(() => this.dashboard().accounts);

  readonly providerDataSource = new MatTableDataSource<ProviderRow>([]);
  readonly accountDataSource = new MatTableDataSource<AccountRow>([]);
  readonly typeDataSource = new MatTableDataSource<ProviderTypeRow>([]);

  readonly providerColumns = [
    'provider',
    'type',
    'active',
    'default',
    'accounts',
    'buckets',
    'issues',
    'actions',
  ];
  readonly accountColumns = [
    'account',
    'provider',
    'bucket',
    'region',
    'active',
    'default',
    'actions',
  ];
  readonly typeColumns = ['type', 'providers', 'accounts', 'activeAccounts', 'issues', 'actions'];

  private readonly syncDashboardTables = effect(() => {
    this.providerDataSource.data = this.providerRows();
    this.accountDataSource.data = this.accountRows();
    this.typeDataSource.data = this.typeRows();
  });

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load Storage dashboard.'));
      return;
    }

    const failedSections = this.dashboard().failedSections;
    if (failedSections > 0 && !this.loading()) {
      this.snack.warning('Some Storage dashboard sections could not be loaded.');
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

  readonly bucketSummary = computed(() => {
    const buckets = new Set(
      this.accounts()
        .map((row) => this.bucketLabel(row))
        .filter((value) => value !== '-'),
    );
    return { total: buckets.size };
  });

  readonly readinessSummary = computed(() => {
    const providerReady = this.providerSummary().active > 0;
    const accountReady = this.accountSummary().active > 0;
    const bucketReady = this.bucketSummary().total > 0;
    const checks = [providerReady, accountReady, bucketReady];
    const passed = checks.filter(Boolean).length;
    return { passed, total: checks.length };
  });

  readonly kpis = computed<KpiTile[]>(() => [
    {
      label: 'Storage Providers',
      value: `${this.providerSummary().active} / ${this.providerSummary().total}`,
      detailValue: String(this.providerSummary().defaults),
      detailLabel: 'defaults',
      icon: 'cloud_sync',
      state: this.providerSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'Storage Accounts',
      value: `${this.accountSummary().active} / ${this.accountSummary().total}`,
      detailValue: String(this.accountSummary().defaults),
      detailLabel: 'defaults',
      icon: 'inventory_2',
      state: this.accountSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'Storage Buckets',
      value: String(this.bucketSummary().total),
      detailValue: String(this.accountRows().filter((row) => row.bucket === '-').length),
      detailLabel: 'unmapped',
      icon: 'folder',
      state: this.bucketSummary().total > 0 ? 'good' : 'neutral',
    },
    {
      label: 'Storage Readiness',
      value: `${this.readinessSummary().passed} / ${this.readinessSummary().total}`,
      detailValue: String(this.providerRows().reduce((sum, row) => sum + row.issues, 0)),
      detailLabel: 'issues',
      icon: 'verified',
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
    this.typeDataSource.sortingDataAccessor = (row, column) => this.typeSortValue(row, column);

    this.providerDataSource.sort = this.providerSort() ?? null;
    this.providerDataSource.paginator = this.providerPaginator() ?? null;
    this.accountDataSource.sort = this.accountSort() ?? null;
    this.accountDataSource.paginator = this.accountPaginator() ?? null;
    this.typeDataSource.sort = this.typeSort() ?? null;
    this.typeDataSource.paginator = this.typePaginator() ?? null;
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<StorageDashboardSnapshot> {
    const [providersResult, accountsResult] = await Promise.allSettled([
      this.api.get<unknown>(`${this.providerEndpoint()}?limit=500&offset=0`),
      this.api.get<unknown>(`${this.accountEndpoint()}?limit=500&offset=0`),
    ]);

    const results = [providersResult, accountsResult];
    const failedSections = results.filter((result) => result.status === 'rejected').length;

    if (failedSections === results.length) {
      throw new Error('Failed to load Storage dashboard.');
    }

    return {
      providers:
        providersResult.status === 'fulfilled'
          ? this.items<StorageProvider>(providersResult.value).map((row) => ({
              ...row,
              HspConfig: this.parseJson(row.HspConfig),
            }))
          : [],
      accounts:
        accountsResult.status === 'fulfilled'
          ? this.items<StorageAccount>(accountsResult.value).map((row) => ({
              ...row,
              HsaConfig: this.parseJson(row.HsaConfig),
            }))
          : [],
      failedSections,
    };
  }

  routeTo(section: 'providers' | 'accounts') {
    return this.isMaster() ? ['/system/hosting/storage', section] : ['/hosting/storage', section];
  }

  chipClass(value: boolean | number) {
    return Boolean(value) ? 'chip-success is-active' : 'chip-skipped is-inactive';
  }

  issueChipClass(issues: number) {
    return issues > 0 ? 'chip-warning' : 'chip-success is-active';
  }

  private providerEndpoint() {
    return this.isMaster() ? 'system/hosting/storage/providers' : 'hosting/storage/providers';
  }

  private accountEndpoint() {
    return this.isMaster() ? 'system/hosting/storage/accounts' : 'hosting/storage/accounts';
  }

  private providerRows(): ProviderRow[] {
    return this.providers().map((provider) => {
      const accounts = this.accounts().filter(
        (account) => account.HostingStorageProviderHspUUID === provider.HspUUID,
      );
      const buckets = new Set(
        accounts.map((account) => this.bucketLabel(account)).filter((value) => value !== '-'),
      );
      return {
        uuid: provider.HspUUID,
        name: provider.HspName,
        provider: this.providerLabel(provider.HspProvider),
        active: this.isActive(provider.HspIsActive),
        isDefault: Number(provider.HspIsDefault ?? 0) === 1,
        accounts: accounts.length,
        buckets: buckets.size,
        issues: this.providerIssues(provider, accounts),
      };
    });
  }

  private accountRows(): AccountRow[] {
    return this.accounts().map((account) => ({
      uuid: account.HsaUUID,
      name: account.HsaName,
      provider: account.HspName || this.storageProviderName(account.HostingStorageProviderHspUUID),
      bucket: this.bucketLabel(account),
      region: this.regionLabel(account),
      active: this.isActive(account.HsaIsActive),
      isDefault: Number(account.HsaIsDefault ?? 0) === 1,
    }));
  }

  private typeRows(): ProviderTypeRow[] {
    const keys = new Set<StorageProviderType>();
    this.providers().forEach((provider) => keys.add(provider.HspProvider));
    this.accounts().forEach((account) => {
      if (account.HspProvider) keys.add(account.HspProvider);
    });

    return [...keys].map((type) => {
      const providers = this.providers().filter((provider) => provider.HspProvider === type);
      const accounts = this.accounts().filter((account) => {
        const provider = this.providers().find(
          (item) => item.HspUUID === account.HostingStorageProviderHspUUID,
        );
        return account.HspProvider === type || provider?.HspProvider === type;
      });
      return {
        provider: this.providerLabel(type),
        providers: providers.length,
        accounts: accounts.length,
        activeAccounts: accounts.filter((account) => this.isActive(account.HsaIsActive)).length,
        issues:
          providers.filter((provider) => !this.isActive(provider.HspIsActive)).length +
          accounts.filter((account) => !this.isActive(account.HsaIsActive)).length,
      };
    });
  }

  private providerIssues(provider: StorageProvider, accounts: StorageAccount[]) {
    let issues = 0;
    if (!this.isActive(provider.HspIsActive)) issues += 1;
    if (accounts.length === 0) issues += 1;
    issues += accounts.filter((account) => !this.isActive(account.HsaIsActive)).length;
    issues += accounts.filter((account) => this.bucketLabel(account) === '-').length;
    return issues;
  }

  private providerLabel(provider: StorageProviderType | string) {
    const labels: Record<string, string> = {
      s3: 'Amazon S3',
      spaces: 'DigitalOcean Spaces',
      gcs: 'Google Cloud Storage',
      azure: 'Azure Blob Storage',
      sangfor_scp: 'Sangfor SCP/HCI',
    };
    return labels[provider] ?? provider;
  }

  private storageProviderName(uuid: string) {
    const provider = this.providers().find((item) => item.HspUUID === uuid);
    return provider?.HspName || '-';
  }

  private bucketLabel(account: StorageAccount) {
    const config = this.asRecord(account.HsaConfig);
    return String(config['bucket'] || config['container'] || config['bucketName'] || '-');
  }

  private regionLabel(account: StorageAccount) {
    const config = this.asRecord(account.HsaConfig);
    const providerConfig = this.asRecord(
      this.providers().find((item) => item.HspUUID === account.HostingStorageProviderHspUUID)
        ?.HspConfig,
    );
    return String(
      config['region'] || providerConfig['region'] || providerConfig['endpoint'] || '-',
    );
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

  private parseJson(value: Record<string, unknown> | string | null | undefined) {
    if (!value) return null;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private providerSortValue(row: ProviderRow, column: string) {
    if (column === 'provider') return row.name;
    if (column === 'type') return row.provider;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'default') return row.isDefault ? 1 : 0;
    if (column === 'accounts') return row.accounts;
    if (column === 'buckets') return row.buckets;
    if (column === 'issues') return row.issues;
    return '';
  }

  private accountSortValue(row: AccountRow, column: string) {
    if (column === 'account') return row.name;
    if (column === 'provider') return row.provider;
    if (column === 'bucket') return row.bucket;
    if (column === 'region') return row.region;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'default') return row.isDefault ? 1 : 0;
    return '';
  }

  private typeSortValue(row: ProviderTypeRow, column: string) {
    if (column === 'type') return row.provider;
    if (column === 'providers') return row.providers;
    if (column === 'accounts') return row.accounts;
    if (column === 'activeAccounts') return row.activeAccounts;
    if (column === 'issues') return row.issues;
    return '';
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
