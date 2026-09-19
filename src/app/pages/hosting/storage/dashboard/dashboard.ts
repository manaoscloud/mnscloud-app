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
  providersDefault: number;
  accountsTotal: number;
  accountsActive: number;
  accountsDefault: number;
  bucketsMapped: number;
  bucketsUnmapped: number;
  readinessPassed: number;
  readinessTotal: number;
  issues: number;
};

type StorageDashboardProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: string;
  HspIsActive: number;
  HspIsDefault: number;
  accountCount: number;
  bucketCount: number;
  issues: number;
};

type StorageDashboardAccount = {
  HsaUUID: string;
  HsaName: string;
  HostingStorageProviderHspUUID: string;
  ProviderName: string | null;
  ProviderType: string | null;
  bucket: string;
  region: string | null;
  HsaIsActive: number;
  HsaIsDefault: number;
  issues: number;
};

type StorageDashboardType = {
  provider: string;
  providers: number;
  accounts: number;
  activeAccounts: number;
  issues: number;
};

type StorageDashboardSnapshot = {
  generatedAt: string | null;
  kpis: StorageDashboardKpis;
  providers: StorageDashboardProvider[];
  accounts: StorageDashboardAccount[];
  types: StorageDashboardType[];
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
  providersDefault: 0,
  accountsTotal: 0,
  accountsActive: 0,
  accountsDefault: 0,
  bucketsMapped: 0,
  bucketsUnmapped: 0,
  readinessPassed: 0,
  readinessTotal: 3,
  issues: 0,
};

const EMPTY_STORAGE_DASHBOARD: StorageDashboardSnapshot = {
  generatedAt: null,
  kpis: EMPTY_KPIS,
  providers: [],
  accounts: [],
  types: [],
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
        value: `${kpis.providersActive} / ${kpis.providersTotal}`,
        detailValue: String(kpis.providersDefault),
        detailLabel: 'defaults',
        icon: 'cloud_sync',
        state: kpis.providersActive > 0 ? 'good' : 'warn',
      },
      {
        label: 'Storage Accounts',
        value: `${kpis.accountsActive} / ${kpis.accountsTotal}`,
        detailValue: String(kpis.accountsDefault),
        detailLabel: 'defaults',
        icon: 'inventory_2',
        state: kpis.accountsActive > 0 ? 'good' : 'warn',
      },
      {
        label: 'Storage Buckets',
        value: String(kpis.bucketsMapped),
        detailValue: String(kpis.bucketsUnmapped),
        detailLabel: 'unmapped',
        icon: 'folder',
        state: kpis.bucketsMapped > 0 ? 'good' : 'neutral',
      },
      {
        label: 'Storage Readiness',
        value: `${kpis.readinessPassed} / ${kpis.readinessTotal}`,
        detailValue: String(kpis.issues),
        detailLabel: 'issues',
        icon: 'verified',
        state:
          kpis.readinessPassed === kpis.readinessTotal
            ? 'good'
            : kpis.readinessPassed > 0
              ? 'warn'
              : 'bad',
      },
    ];
  });

  readonly providerRows = computed<DashboardRecord[]>(() =>
    this.dashboard().providers.map((provider) => ({
      name: provider.HspName,
      meta: provider.HspProvider,
      status: provider.HspIsActive === 1 ? 'Active' : 'Inactive',
      tone: provider.issues > 0 ? 'danger' : provider.HspIsActive === 1 ? 'success' : 'skipped',
      details: [
        { label: 'Accounts', value: String(provider.accountCount) },
        { label: 'Buckets', value: String(provider.bucketCount) },
        { label: 'Issues', value: String(provider.issues) },
        {
          label: 'Default',
          value: provider.HspIsDefault === 1 ? 'Yes' : 'No',
          translate: true,
        },
      ],
    })),
  );

  readonly accountRows = computed<DashboardRecord[]>(() =>
    this.dashboard().accounts.map((account) => ({
      name: account.HsaName,
      meta: account.ProviderName || account.ProviderType || '-',
      status: account.HsaIsActive === 1 ? 'Active' : 'Inactive',
      tone: account.issues > 0 ? 'danger' : account.HsaIsActive === 1 ? 'success' : 'skipped',
      details: [
        { label: 'Bucket', value: account.bucket },
        { label: 'Region', value: account.region || '-' },
        { label: 'Issues', value: String(account.issues) },
        {
          label: 'Default',
          value: account.HsaIsDefault === 1 ? 'Yes' : 'No',
          translate: true,
        },
      ],
    })),
  );

  readonly typeRows = computed<DashboardRecord[]>(() =>
    this.dashboard().types.map((row) => ({
      name: row.provider,
      meta: String(row.providers),
      status: row.issues > 0 ? 'Issues' : 'Ready',
      tone: row.issues > 0 ? 'danger' : 'success',
      details: [
        { label: 'Providers', value: String(row.providers) },
        { label: 'Accounts', value: String(row.accounts) },
        { label: 'Active accounts', value: String(row.activeAccounts) },
        { label: 'Issues', value: String(row.issues) },
      ],
    })),
  );

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
      types: Array.isArray(data?.types) ? data.types : [],
    };
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
