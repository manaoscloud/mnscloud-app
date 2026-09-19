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

type WebhostDashboardKpis = {
  providersTotal: number;
  providersActive: number;
  providersDefault: number;
  plansTotal: number;
  plansActive: number;
  hostsTotal: number;
  hostsActive: number;
  hostsProvisioned: number;
  emailsTotal: number;
  emailsActive: number;
  databasesTotal: number;
  databasesActive: number;
  mailingListsTotal: number;
  zoneRecordsTotal: number;
  readinessPassed: number;
  readinessTotal: number;
  issues: number;
};

type WebhostDashboardProvider = {
  HwpUUID: string;
  HwpName: string;
  HwpProvider: string;
  HwpIsActive: number;
  HwpIsDefault: number;
  hostCount: number;
  planCount: number;
  issues: number;
};

type WebhostDashboardHost = {
  HwhUUID: string;
  HwhName: string;
  DomainName: string | null;
  ProviderName: string | null;
  PlanName: string | null;
  HwhStatus: string | null;
  HwhProvisionStatus: string | null;
  HwhIsActive: number;
  issues: number;
};

type WebhostDashboardType = {
  provider: string;
  providers: number;
  hosts: number;
  activeHosts: number;
  issues: number;
};

type WebhostDashboardSnapshot = {
  generatedAt: string | null;
  kpis: WebhostDashboardKpis;
  providers: WebhostDashboardProvider[];
  hosts: WebhostDashboardHost[];
  types: WebhostDashboardType[];
};

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

const EMPTY_KPIS: WebhostDashboardKpis = {
  providersTotal: 0,
  providersActive: 0,
  providersDefault: 0,
  plansTotal: 0,
  plansActive: 0,
  hostsTotal: 0,
  hostsActive: 0,
  hostsProvisioned: 0,
  emailsTotal: 0,
  emailsActive: 0,
  databasesTotal: 0,
  databasesActive: 0,
  mailingListsTotal: 0,
  zoneRecordsTotal: 0,
  readinessPassed: 0,
  readinessTotal: 4,
  issues: 0,
};

const EMPTY_WEBHOST_DASHBOARD: WebhostDashboardSnapshot = {
  generatedAt: null,
  kpis: EMPTY_KPIS,
  providers: [],
  hosts: [],
  types: [],
};

@Component({
  selector: 'app-hosting-webhost-dashboard',
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
export class HostingWebhostDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly dashboardResource = dashboardResource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_WEBHOST_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly kpisData = computed(() => this.dashboard().kpis ?? EMPTY_KPIS);

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load Webhost dashboard.'));
  });

  readonly kpis = computed<KpiTile[]>(() => {
    const kpis = this.kpisData();
    return [
      {
        label: 'Webhost Providers',
        value: `${kpis.providersActive} / ${kpis.providersTotal}`,
        detailValue: String(kpis.providersDefault),
        detailLabel: 'defaults',
        icon: 'cloud_sync',
        state: kpis.providersActive > 0 ? 'good' : 'warn',
      },
      {
        label: 'Webhost Hosts',
        value: `${kpis.hostsActive} / ${kpis.hostsTotal}`,
        detailValue: String(kpis.hostsProvisioned),
        detailLabel: 'provisioned',
        icon: 'dns',
        state: kpis.hostsActive > 0 ? 'good' : 'warn',
      },
      {
        label: 'Webhost Emails',
        value: `${kpis.emailsActive} / ${kpis.emailsTotal}`,
        detailValue: String(kpis.databasesActive),
        detailLabel: 'databases active',
        icon: 'alternate_email',
        state: kpis.emailsActive > 0 ? 'good' : 'neutral',
      },
      {
        label: 'Webhost Readiness',
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
      name: provider.HwpName,
      meta: provider.HwpProvider,
      status: provider.HwpIsActive === 1 ? 'Active' : 'Inactive',
      tone: provider.issues > 0 ? 'danger' : provider.HwpIsActive === 1 ? 'success' : 'skipped',
      details: [
        { label: 'Hosts', value: String(provider.hostCount) },
        { label: 'Plans', value: String(provider.planCount) },
        { label: 'Issues', value: String(provider.issues) },
        {
          label: 'Default',
          value: provider.HwpIsDefault === 1 ? 'Yes' : 'No',
          translate: true,
        },
      ],
    })),
  );

  readonly hostRows = computed<DashboardRecord[]>(() =>
    this.dashboard().hosts.map((host) => ({
      name: host.HwhName,
      meta: host.DomainName || host.ProviderName || '-',
      status: host.HwhStatus || (host.HwhIsActive === 1 ? 'Active' : 'Inactive'),
      tone: host.issues > 0 ? 'danger' : host.HwhIsActive === 1 ? 'success' : 'skipped',
      details: [
        { label: 'Plan', value: host.PlanName || '-' },
        { label: 'Provider', value: host.ProviderName || '-' },
        { label: 'Provision', value: host.HwhProvisionStatus || '-' },
        { label: 'Issues', value: String(host.issues) },
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
        { label: 'Hosts', value: String(row.hosts) },
        { label: 'Active hosts', value: String(row.activeHosts) },
        { label: 'Issues', value: String(row.issues) },
      ],
    })),
  );

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<WebhostDashboardSnapshot> {
    const endpoint = this.isMaster()
      ? 'system/hosting/webhost/dashboard?limit=50'
      : 'hosting/webhost/dashboard?limit=50';
    const response = await this.api.get<{ data?: WebhostDashboardSnapshot }>(endpoint, {
      timeout: 30000,
    });
    const data = response?.data;
    return {
      generatedAt: data?.generatedAt ?? null,
      kpis: { ...EMPTY_KPIS, ...(data?.kpis ?? {}) },
      providers: Array.isArray(data?.providers) ? data.providers : [],
      hosts: Array.isArray(data?.hosts) ? data.hosts : [],
      types: Array.isArray(data?.types) ? data.types : [],
    };
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
