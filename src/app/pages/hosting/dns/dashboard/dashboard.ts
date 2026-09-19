import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';
import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { NgClass } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';

type DnsDashboardKpis = {
  providersTotal: number;
  providersActive: number;
  providersDefault: number;
  domainsTotal: number;
  domainsActive: number;
  domainsProvisioned: number;
  syncInFlight: number;
  syncFailed: number;
  ready: number;
};

type DnsDashboardProvider = {
  HdpUUID: string;
  HdpName: string;
  HdpScope: string;
  HdpProvider: string;
  HdpHasSecret: number;
  HdpIsDefault: number;
  HdpStatus: number;
  domainCount: number;
  issues: number;
};

type DnsDashboardDomain = {
  HddUUID: string;
  HddName: string;
  CustomerCusUUID: string | null;
  CustomerName: string | null;
  HostingDnsProviderHdpUUID: string | null;
  ProviderName: string | null;
  ProviderPlatform: string | null;
  HddZoneIP: string | null;
  HddProvisionStatus: string | null;
  HddLastProvisionedAt: string | null;
  MessagingOperationMopUUID: string | null;
  MopState: string | null;
  HddStatus: number;
  canOpenRecords: number;
  issueRank: number;
};

type DnsDashboardPlatform = {
  platform: string;
  providers: number;
  domains: number;
  provisioned: number;
  issues: number;
};

type DnsDashboardSnapshot = {
  generatedAt: string | null;
  kpis: DnsDashboardKpis;
  providers: DnsDashboardProvider[];
  domains: DnsDashboardDomain[];
  platforms: DnsDashboardPlatform[];
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
  platform: string;
  scope: string;
  active: boolean;
  isDefault: boolean;
  domains: number;
  issues: number;
};

type DomainRow = {
  uuid: string;
  name: string;
  provider: string;
  customer: string;
  sync: string;
  active: boolean;
  zoneIp: string;
  canOpenRecords: boolean;
};

type PlatformRow = {
  platform: string;
  providers: number;
  domains: number;
  provisioned: number;
  issues: number;
};

const EMPTY_KPIS: DnsDashboardKpis = {
  providersTotal: 0,
  providersActive: 0,
  providersDefault: 0,
  domainsTotal: 0,
  domainsActive: 0,
  domainsProvisioned: 0,
  syncInFlight: 0,
  syncFailed: 0,
  ready: 0,
};

const EMPTY_DNS_DASHBOARD: DnsDashboardSnapshot = {
  generatedAt: null,
  kpis: EMPTY_KPIS,
  providers: [],
  domains: [],
  platforms: [],
};

@Component({
  selector: 'app-hosting-dns-dashboard',
  standalone: true,
  imports: [
    DashboardPageComponent,
    RouterModule,
    MatIconModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
})
export class HostingDnsDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly dashboardResource = dashboardResource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_DNS_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly kpisModel = computed(() => this.dashboard().kpis ?? EMPTY_KPIS);

  readonly providerDataSource = createSignalCrudTable<ProviderRow>(
    computed(() => this.providerRows()),
    (row, column) => this.providerSortValue(row, column),
  );
  readonly domainDataSource = createSignalCrudTable<DomainRow>(
    computed(() => this.domainRows()),
    (row, column) => this.domainSortValue(row, column),
  );
  readonly platformDataSource = createSignalCrudTable<PlatformRow>(
    computed(() => this.platformRows()),
    (row, column) => this.platformSortValue(row, column),
  );

  readonly providerColumns = [
    'provider',
    'platform',
    'scope',
    'active',
    'default',
    'domains',
    'issues',
    'actions',
  ];
  readonly domainColumns = [
    'domain',
    'provider',
    'customer',
    'sync',
    'active',
    'zoneIp',
    'actions',
  ];
  readonly platformColumns = ['platform', 'providers', 'domains', 'provisioned', 'issues'];

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load DNS dashboard.'));
    }
  });

  readonly kpis = computed<KpiTile[]>(() => {
    const k = this.kpisModel();
    return [
      {
        label: 'DNS Providers',
        value: `${k.providersActive} / ${k.providersTotal}`,
        detailValue: String(k.providersDefault),
        detailLabel: 'defaults',
        icon: 'manage_accounts',
        state: k.providersActive > 0 ? 'good' : 'warn',
      },
      {
        label: 'DNS Domains',
        value: `${k.domainsActive} / ${k.domainsTotal}`,
        detailValue: String(k.domainsProvisioned),
        detailLabel: 'provisioned',
        icon: 'language',
        state: k.domainsProvisioned > 0 ? 'good' : 'warn',
      },
      {
        label: 'Sync Health',
        value: String(k.syncInFlight),
        detailValue: String(k.syncFailed),
        detailLabel: 'failed',
        icon: 'sync',
        state: k.syncFailed > 0 ? 'bad' : k.syncInFlight > 0 ? 'warn' : 'good',
      },
      {
        label: 'DNS Readiness',
        value: k.ready ? 'Ready' : 'Not ready',
        detailValue: String(
          this.providerRows().reduce((sum, row) => sum + row.issues, 0) +
            this.domainRows().filter((row) => row.sync === 'failed').length,
        ),
        detailLabel: 'issues',
        icon: 'verified',
        state: k.ready ? 'good' : k.providersActive > 0 || k.domainsProvisioned > 0 ? 'warn' : 'bad',
      },
    ];
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<DnsDashboardSnapshot> {
    const response = await this.api.get<{ data?: DnsDashboardSnapshot }>(
      'hosting/dns/dashboard?limit=50',
      { timeout: 30000 },
    );
    const data = response?.data;
    if (!data || typeof data !== 'object') {
      throw new Error('Failed to load DNS dashboard.');
    }
    return {
      generatedAt: data.generatedAt ?? null,
      kpis: { ...EMPTY_KPIS, ...(data.kpis ?? {}) },
      providers: Array.isArray(data.providers) ? data.providers : [],
      domains: Array.isArray(data.domains) ? data.domains : [],
      platforms: Array.isArray(data.platforms) ? data.platforms : [],
    };
  }

  routeTo(section: 'providers' | 'domains') {
    return this.isMaster() ? ['/system/hosting/dns', section] : ['/hosting/dns', section];
  }

  domainRecordsLink(row: DomainRow) {
    const base = this.isMaster() ? '/system/hosting/dns/domains' : '/hosting/dns/domains';
    return [base, row.uuid, 'records'];
  }

  chipClass(value: boolean | number) {
    return Boolean(value) ? 'chip-success is-active' : 'chip-skipped is-inactive';
  }

  issueChipClass(issues: number) {
    return issues > 0 ? 'chip-warning' : 'chip-success is-active';
  }

  syncChipClass(sync: string) {
    if (sync === 'failed') return 'chip-failed';
    if (sync === 'in_flight' || sync === 'pending' || sync === 'running') return 'chip-queued';
    if (sync === 'active' || sync === 'succeeded') return 'chip-success is-active';
    return 'chip-skipped is-inactive';
  }

  syncLabel(sync: string) {
    if (sync === 'in_flight') return 'In flight';
    if (sync === 'not_configured') return 'Not configured';
    return sync.replace(/_/g, ' ');
  }

  platformLabel(platform: string) {
    if (platform === 'cpanel_dnsonly') return 'cPanel DNSOnly';
    if (platform === 'route53') return 'Route 53';
    return platform || '-';
  }

  private providerRows(): ProviderRow[] {
    return this.dashboard().providers.map((provider) => ({
      uuid: provider.HdpUUID,
      name: provider.HdpName,
      platform: provider.HdpProvider,
      scope: provider.HdpScope,
      active: Number(provider.HdpStatus ?? 0) === 1,
      isDefault: Number(provider.HdpIsDefault ?? 0) === 1,
      domains: Number(provider.domainCount ?? 0),
      issues: Number(provider.issues ?? 0),
    }));
  }

  private domainRows(): DomainRow[] {
    return this.dashboard().domains.map((domain) => ({
      uuid: domain.HddUUID,
      name: domain.HddName,
      provider: domain.ProviderName || '-',
      customer: domain.CustomerName || '-',
      sync: this.domainSync(domain),
      active: Number(domain.HddStatus ?? 0) === 1,
      zoneIp: domain.HddZoneIP || '-',
      canOpenRecords: Number(domain.canOpenRecords ?? 0) === 1,
    }));
  }

  private platformRows(): PlatformRow[] {
    return this.dashboard().platforms.map((row) => ({
      platform: row.platform,
      providers: Number(row.providers ?? 0),
      domains: Number(row.domains ?? 0),
      provisioned: Number(row.provisioned ?? 0),
      issues: Number(row.issues ?? 0),
    }));
  }

  private domainSync(domain: DnsDashboardDomain): string {
    const mop = String(domain.MopState ?? '').toLowerCase();
    const provision = String(domain.HddProvisionStatus ?? '').toLowerCase();
    if (provision === 'failed' || mop === 'failed') return 'failed';
    if (
      ['pending', 'running'].includes(provision) ||
      ['queued', 'leased', 'running', 'accepted'].includes(mop)
    ) {
      return 'in_flight';
    }
    if (provision) return provision;
    return mop || 'unknown';
  }

  private providerSortValue(row: ProviderRow, column: string) {
    if (column === 'provider') return row.name;
    if (column === 'platform') return row.platform;
    if (column === 'scope') return row.scope;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'default') return row.isDefault ? 1 : 0;
    if (column === 'domains') return row.domains;
    if (column === 'issues') return row.issues;
    return '';
  }

  private domainSortValue(row: DomainRow, column: string) {
    if (column === 'domain') return row.name;
    if (column === 'provider') return row.provider;
    if (column === 'customer') return row.customer;
    if (column === 'sync') return row.sync;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'zoneIp') return row.zoneIp;
    return '';
  }

  private platformSortValue(row: PlatformRow, column: string) {
    if (column === 'platform') return row.platform;
    if (column === 'providers') return row.providers;
    if (column === 'domains') return row.domains;
    if (column === 'provisioned') return row.provisioned;
    if (column === 'issues') return row.issues;
    return '';
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
