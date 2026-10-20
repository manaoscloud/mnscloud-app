import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { NgClass } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import {
  DashboardRecord,
  DashboardRecordListComponent,
} from '../../../../shared/dashboard/dashboard-record-list';

type StorageDashboardKpis = {
  providersTotal: number;
  providersActive: number;
  accountsTotal: number;
  accountsActive: number;
  bucketsTotal: number;
  bucketsActive: number;
  bucketsReady: number;
  unmeasuredBuckets: number;
  usedBytes: string;
};

type StorageDashboardProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: string;
  HspIsActive: number;
  accountCount: number;
  bucketCount: number;
};

type StorageDashboardAccount = {
  HsaUUID: string;
  HsaName: string;
  HsaIsActive: number;
  CustomerName: string | null;
  bucketCount: number;
};

type StorageDashboardBucket = {
  HsbUUID: string;
  HsbName: string;
  HsbState: string;
  HsbIsActive: number;
  HsbUsedBytes: string;
  HsbLimitBytes: string | null;
  HsbMeasuredAt: string | null;
  AccountName: string;
  ProviderName: string;
};

type StorageDashboardSnapshot = {
  generatedAt: string | null;
  kpis: StorageDashboardKpis;
  providers: StorageDashboardProvider[];
  accounts: StorageDashboardAccount[];
  buckets: StorageDashboardBucket[];
};

const BUCKET_STATES: Record<string, string> = {
  pending: 'Pending',
  provisioning: 'Provisioning',
  ready: 'Ready',
  failed: 'Failed',
  deleting: 'Deleting',
  released: 'Released',
};

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

const EMPTY_KPIS: StorageDashboardKpis = {
  providersTotal: 0,
  providersActive: 0,
  accountsTotal: 0,
  accountsActive: 0,
  bucketsTotal: 0,
  bucketsActive: 0,
  bucketsReady: 0,
  unmeasuredBuckets: 0,
  usedBytes: '0',
};

const EMPTY_STORAGE_DASHBOARD: StorageDashboardSnapshot = {
  generatedAt: null,
  kpis: EMPTY_KPIS,
  providers: [],
  accounts: [],
  buckets: [],
};

@Component({
  selector: 'app-hosting-storage-dashboard',
  standalone: true,
  imports: [
    DashboardPageComponent,
    DashboardRecordListComponent,
    RouterModule,
    MatIconModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
})
export class HostingStorageDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly dashboardResource = dashboardResource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_STORAGE_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly kpisData = computed(() => this.dashboard().kpis ?? EMPTY_KPIS);

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load Storage dashboard.'));
  });

  readonly kpis = computed<KpiTile[]>(() => {
    const kpis = this.kpisData();
    return [
      {
        label: 'Storage Providers',
        value: String(kpis.providersTotal),
        detailValue: String(kpis.providersActive),
        detailLabel: 'Active',
        icon: 'cloud_sync',
        state: kpis.providersActive > 0 ? 'good' : 'warn',
      },
      {
        label: 'Storage Accounts',
        value: String(kpis.accountsTotal),
        detailValue: String(kpis.accountsActive),
        detailLabel: 'Active',
        icon: 'inventory_2',
        state: kpis.accountsActive > 0 ? 'good' : 'warn',
      },
      {
        label: 'Storage Buckets',
        value: String(kpis.bucketsTotal),
        detailValue: String(kpis.bucketsReady),
        detailLabel: 'Ready',
        icon: 'folder',
        state: kpis.bucketsReady > 0 ? 'good' : 'neutral',
      },
      {
        label: 'Measured storage',
        value: this.formatBytes(kpis.usedBytes),
        detailValue: String(kpis.unmeasuredBuckets),
        detailLabel: 'Buckets awaiting measurement',
        icon: 'data_usage',
        state: kpis.unmeasuredBuckets > 0 ? 'warn' : 'neutral',
      },
    ];
  });

  readonly providerRows = computed<DashboardRecord[]>(() =>
    this.dashboard().providers.map((provider) => ({
      name: provider.HspName,
      meta: provider.HspProvider,
      status: provider.HspIsActive === 1 ? 'Active' : 'Inactive',
      tone: provider.HspIsActive === 1 ? 'success' : 'skipped',
      details: [
        { label: 'Accounts', value: String(provider.accountCount) },
        { label: 'Buckets', value: String(provider.bucketCount) },
      ],
    })),
  );

  readonly accountRows = computed<DashboardRecord[]>(() =>
    this.dashboard().accounts.map((account) => ({
      name: account.HsaName,
      meta: account.CustomerName || '-',
      status: account.HsaIsActive === 1 ? 'Active' : 'Inactive',
      tone: account.HsaIsActive === 1 ? 'success' : 'skipped',
      details: [{ label: 'Buckets', value: String(account.bucketCount) }],
    })),
  );

  readonly bucketRows = computed<DashboardRecord[]>(() =>
    this.dashboard().buckets.map((bucket) => ({
      name: bucket.HsbName,
      meta: bucket.AccountName,
      status: bucket.HsbIsActive !== 1 ? 'Inactive' : BUCKET_STATES[bucket.HsbState] || 'Unknown',
      tone: bucketTone(bucket.HsbIsActive, bucket.HsbState),
      details: [
        { label: 'Provider', value: bucket.ProviderName },
        {
          label: 'Measured storage',
          value: bucket.HsbMeasuredAt ? this.formatBytes(bucket.HsbUsedBytes) : 'Pending',
          translate: !bucket.HsbMeasuredAt,
        },
        {
          label: 'Limit',
          value:
            bucket.HsbLimitBytes === null ? 'Unlimited' : this.formatBytes(bucket.HsbLimitBytes),
          translate: bucket.HsbLimitBytes === null,
        },
      ],
    })),
  );

  private formatBytes(value: string): string {
    // The API preserves BIGINT as decimal text; scale before converting for display.
    const bytes = BigInt(value);
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];
    let divisor = 1n;
    let index = 0;
    while (bytes >= divisor * 1024n && index < units.length - 1) {
      divisor *= 1024n;
      index++;
    }
    return `${Number((bytes * 100n) / divisor) / 100} ${units[index]}`;
  }

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<StorageDashboardSnapshot> {
    const endpoint = this.isMaster()
      ? 'system/hosting/storage/dashboard?limit=50'
      : 'hosting/storage/dashboard?limit=50';
    const response = await this.api.get<{ data?: StorageDashboardSnapshot }>(endpoint, {
      timeout: 30000,
    });
    const data = response?.data;
    return {
      generatedAt: data?.generatedAt ?? null,
      kpis: { ...EMPTY_KPIS, ...(data?.kpis ?? {}) },
      providers: Array.isArray(data?.providers) ? data.providers : [],
      accounts: Array.isArray(data?.accounts) ? data.accounts : [],
      buckets: Array.isArray(data?.buckets) ? data.buckets : [],
    };
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}

function bucketTone(active: number, state: string): 'skipped' | 'success' | 'danger' | 'running' {
  if (active !== 1) return 'skipped';
  if (state === 'ready') return 'success';
  return state === 'failed' ? 'danger' : 'running';
}
