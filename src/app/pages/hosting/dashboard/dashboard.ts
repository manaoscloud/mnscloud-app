import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';
import { NgClass } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';
import { ConfigurableCrudRowAction } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

import { type InstanceDashboard, instanceDashboard } from '../shared/instance-dashboard';

/** Counts of one Hosting overview section; `null` when the caller may not read its list. */
type SectionCounts = { total: number; active: number; issues?: number; defaults?: number } | null;

const HOSTING_SECTIONS = [
  'dnsDomains',
  'webhostHosts',
  'webhostEmails',
  'smtpAccounts',
  'storageAccounts',
  'dnsProviders',
  'smtpProviders',
  'storageProviders',
  'vpsProviders',
  'containerProviders',
  'webhostProviders',
] as const;

type HostingSection = (typeof HOSTING_SECTIONS)[number];

/** `GET {system/}hosting/dashboard`: database counts, gated per section by the API. */
type HostingOverview = Record<HostingSection, SectionCounts> & {
  issueRows: Array<{
    type: 'webhost_host' | 'webhost_email';
    uuid: string;
    name: string | null;
    status: string | null;
    message: string | null;
  }>;
};

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

const EMPTY_OVERVIEW: HostingOverview = {
  ...(Object.fromEntries(HOSTING_SECTIONS.map((key) => [key, null])) as Record<
    HostingSection,
    SectionCounts
  >),
  issueRows: [],
};

type HostingDashboardSnapshot = {
  overview: HostingOverview;
  vps: InstanceDashboard | null;
  containers: InstanceDashboard | null;
  failedSections: number;
};

const EMPTY_HOSTING_DASHBOARD: HostingDashboardSnapshot = {
  overview: EMPTY_OVERVIEW,
  vps: null,
  containers: null,
  failedSections: 0,
};

@Component({
  selector: 'app-hosting-dashboard',
  standalone: true,
  imports: [
    DashboardPageComponent,
    RouterModule,
    MatIconModule,
    TranslocoPipe,
    NgClass,
    GlobalTableComponent,
  ],
  templateUrl: './dashboard.html',
})
export class HostingDashboardPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);

  readonly dashboardResource = dashboardResource({
    params: () => ({ environmentUUID: this.auth.user()?.EnvironmentUUID ?? null }),
    defaultValue: EMPTY_HOSTING_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly overview = computed(() => this.dashboard().overview);

  private readonly router = inject(Router);

  readonly workloadTableRows = computed(() => this.workloads());
  readonly providerTableRows = computed(() => this.providers());
  readonly issueTableRows = computed(() => this.issues());

  /** Opens the management page of a dashboard row (`route`). */
  private readonly viewAction: ConfigurableCrudRowAction = {
    key: 'view',
    label: 'View',
    icon: 'chevron_right',
    run: (row) => void this.router.navigate(this.hostingRoute(row['route'] as string[])),
  };

  readonly workloadTable = defineGlobalTable({
    key: 'hosting/dashboard/workloads',
    uuidField: 'key',
    emptyLabel: 'No workloads found.',
    columns: [
      {
        id: 'resource',
        label: 'Resource',
        field: 'label',
        translateValue: true,
        icon: (row) => String(row['icon'] ?? ''),
      },
      { id: 'total', label: 'Total', field: 'total', kind: 'number' },
      { id: 'active', label: 'Active', field: 'active', kind: 'number' },
      {
        id: 'issues',
        label: 'Issues',
        field: 'issues',
        kind: 'status',
        chipClass: (value) => this.chipClass(Number(value)),
      },
    ],
    rowActions: [this.viewAction],
  });

  readonly providerTable = defineGlobalTable({
    key: 'hosting/dashboard/providers',
    uuidField: 'key',
    emptyLabel: 'No providers found.',
    columns: [
      { id: 'provider', label: 'Provider', field: 'label', translateValue: true },
      { id: 'total', label: 'Total', field: 'total', kind: 'number' },
      { id: 'active', label: 'Active', field: 'active', kind: 'number' },
      { id: 'defaults', label: 'Defaults', field: 'defaults', kind: 'number' },
    ],
    rowActions: [this.viewAction],
  });

  readonly issueTable = defineGlobalTable({
    key: 'hosting/dashboard/issues',
    uuidField: 'key',
    emptyLabel: 'No provisioning issues found.',
    columns: [
      { id: 'type', label: 'Type', field: 'type', translateValue: true },
      { id: 'name', label: 'Name', field: 'name' },
      {
        id: 'status',
        label: 'Status',
        field: 'status',
        kind: 'status',
        chipClass: (value) => this.statusChipClass(String(value ?? '')),
      },
      { id: 'message', label: 'Message', field: 'message', translateValue: true },
    ],
    rowActions: [this.viewAction],
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
    const { vps, containers } = this.dashboard();
    return this.sum([vps, containers]);
  });

  readonly webhostSummary = computed(() => {
    const { webhostHosts, webhostEmails } = this.overview();
    const hosts = this.sum([webhostHosts]);
    return { ...hosts, issues: hosts.issues + this.sum([webhostEmails]).issues };
  });

  readonly domainSummary = computed(() => this.sum([this.overview().dnsDomains]));

  readonly deliverySummary = computed(() =>
    this.sum([this.overview().smtpAccounts, this.overview().storageAccounts]),
  );

  readonly kpis = computed<KpiTile[]>(() => [
    this.tile('Compute Instances', 'dns', this.computeSummary(), 'issues', 'good'),
    this.tile('Webhost Accounts', 'web', this.webhostSummary(), 'active', 'good'),
    this.tile('Domains', 'language', this.domainSummary(), 'active', 'good'),
    this.tile('Delivery Accounts', 'mark_email_read', this.deliverySummary(), 'active', 'neutral'),
  ]);

  refreshList() {
    this.dashboardResource.reload();
  }

  /** Three aggregates, each counted by the database; one unavailable section never hides the rest. */
  async loadDashboardSnapshot(): Promise<HostingDashboardSnapshot> {
    const master = this.hasPlatformMasterAccess();
    const [overview, vps, containers] = await Promise.allSettled([
      this.api.get<{ data?: Partial<HostingOverview> }>(
        master ? 'system/hosting/dashboard' : 'hosting/dashboard',
        { timeout: 30000 },
      ),
      this.api.get<{ data?: Partial<InstanceDashboard> }>(`${this.vpsRoot()}/dashboard`, {
        timeout: 30000,
      }),
      this.api.get<{ data?: Partial<InstanceDashboard> }>(`${this.containerRoot()}/dashboard`, {
        timeout: 30000,
      }),
    ]);
    const results = [overview, vps, containers];
    const failedSections = results.filter((result) => result.status === 'rejected').length;
    if (failedSections === results.length) throw new Error('Failed to load hosting dashboard.');
    return {
      overview:
        overview.status === 'fulfilled'
          ? { ...EMPTY_OVERVIEW, ...overview.value?.data }
          : EMPTY_OVERVIEW,
      vps: vps.status === 'fulfilled' ? instanceDashboard(vps.value) : null,
      containers: containers.status === 'fulfilled' ? instanceDashboard(containers.value) : null,
      failedSections,
    };
  }

  private hasPlatformMasterAccess() {
    return (this.auth.user()?.permissions ?? []).includes('platform.master.access');
  }

  hostingRoute(route: string[]) {
    const isMaster = this.hasPlatformMasterAccess();
    const routePath = route.join('/');

    // VPS providers/plans are master-only UI; tenants stay on the VPS dashboard.
    if (!isMaster) {
      if (routePath === 'hosting/vps/provider' || routePath === 'hosting/vps/plans') {
        return ['/hosting/vps'];
      }
      return ['/', ...route];
    }
    if (routePath === 'hosting/smtp/accounts') return ['/system/hosting/smtp/accounts'];
    if (routePath === 'hosting/storage/accounts') return ['/system/hosting/storage/accounts'];
    if (routePath === 'hosting/vps/instances') return ['/system/vps/instances'];
    if (routePath === 'hosting/vps/provider') return ['/system/vps/provider'];
    if (routePath === 'hosting/vps/plans') return ['/system/vps/plans'];
    if (routePath === 'hosting/vps-container/instances') return ['/system/vps-container/instances'];
    if (routePath === 'hosting/vps-container/provider') return ['/system/vps-container/provider'];
    if (routePath === 'hosting/webhost/providers') return ['/system/hosting/webhost/providers'];
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

  private vpsRoot() {
    return this.hasPlatformMasterAccess() ? 'system/hosting/vps' : 'hosting/vps';
  }

  private containerRoot() {
    return this.hasPlatformMasterAccess()
      ? 'system/hosting/vps-container'
      : 'hosting/vps-container';
  }

  /** Totals of several sections; an unreadable or unavailable section adds nothing. */
  private sum(sections: Array<SectionCounts | InstanceDashboard | null>) {
    return sections.reduce<{ total: number; active: number; issues: number; available: boolean }>(
      (acc, section) => ({
        total: acc.total + Number(section?.total ?? 0),
        active: acc.active + Number(section?.active ?? 0),
        issues: acc.issues + Number(section?.issues ?? 0),
        available: acc.available || section !== null,
      }),
      { total: 0, active: 0, issues: 0, available: false },
    );
  }

  /** A KPI whose sections are all unreadable or unavailable shows "—", never a fake zero. */
  private tile(
    label: string,
    icon: string,
    summary: { total: number; active: number; issues: number; available: boolean },
    detail: 'issues' | 'active',
    healthy: KpiTile['state'],
  ): KpiTile {
    if (!summary.available) {
      return {
        label,
        value: '—',
        detailValue: '',
        detailLabel: 'Unavailable',
        icon,
        state: 'neutral',
      };
    }
    return {
      label,
      value: String(summary.total),
      detailValue: String(detail === 'issues' ? summary.issues : summary.active),
      detailLabel: detail === 'issues' ? 'issues' : 'active resources',
      icon,
      state: summary.issues > 0 ? 'warn' : healthy,
    };
  }

  /** Rows only for sections the caller may read (the API returns null for the others). */
  private workloads(): WorkloadRow[] {
    const overview = this.overview();
    const { vps, containers } = this.dashboard();
    const rows: Array<
      [string, string, string, SectionCounts | InstanceDashboard | null, string[]]
    > = [
      [
        'dns-domains',
        'DNS Domains',
        'language',
        overview.dnsDomains,
        ['hosting', 'dns', 'domains'],
      ],
      ['vps-instances', 'VPS Instances', 'dns', vps, ['hosting', 'vps', 'instances']],
      [
        'container-instances',
        'Container Instances',
        'apps',
        containers,
        ['hosting', 'vps-container', 'instances'],
      ],
      [
        'webhost-hosts',
        'Webhost Hosts',
        'web',
        overview.webhostHosts,
        ['hosting', 'webhost', 'hosts'],
      ],
      [
        'email-accounts',
        'Email Accounts',
        'alternate_email',
        overview.webhostEmails,
        ['hosting', 'webhost', 'emails'],
      ],
      [
        'smtp-accounts',
        'SMTP Accounts',
        'mark_email_read',
        overview.smtpAccounts,
        ['hosting', 'smtp', 'accounts'],
      ],
      [
        'storage-accounts',
        'Storage Accounts',
        'inventory_2',
        overview.storageAccounts,
        ['hosting', 'storage', 'accounts'],
      ],
    ];
    return rows
      .filter(([, , , counts]) => counts !== null)
      .map(([key, label, icon, counts, route]) => ({
        key,
        label,
        icon,
        ...this.sum([counts]),
        route,
      }));
  }

  private providers(): ProviderRow[] {
    const overview = this.overview();
    const rows: Array<[string, string, SectionCounts, string[]]> = [
      ['dns-providers', 'DNS Providers', overview.dnsProviders, ['hosting', 'dns', 'providers']],
      ['smtp-providers', 'SMTP Providers', overview.smtpProviders, ['hosting', 'smtp', 'accounts']],
      [
        'storage-providers',
        'Storage Providers',
        overview.storageProviders,
        ['hosting', 'storage', 'accounts'],
      ],
      ['vps-providers', 'VPS Providers', overview.vpsProviders, ['hosting', 'vps', 'provider']],
      [
        'container-providers',
        'Container Providers',
        overview.containerProviders,
        ['hosting', 'vps-container', 'provider'],
      ],
      [
        'webhost-providers',
        'Webhost Providers',
        overview.webhostProviders,
        ['hosting', 'webhost', 'providers'],
      ],
    ];
    return rows
      .filter(([, , counts]) => counts !== null)
      .map(([key, label, counts, route]) => ({
        key,
        label,
        total: Number(counts?.total ?? 0),
        active: Number(counts?.active ?? 0),
        defaults: Number(counts?.defaults ?? 0),
        route,
      }));
  }

  /** Problem rows already selected by the database: VPS/containers, then Webhost hosts/e-mails. */
  private issues(): IssueRow[] {
    const { vps, containers } = this.dashboard();
    const instanceRows = (type: string, dashboard: InstanceDashboard | null, route: string[]) =>
      (dashboard?.issueRows ?? []).map((row) => ({
        key: row.uuid,
        type,
        name: row.name || '-',
        status: row.status || 'Check',
        message: 'Review provisioning state.',
        route,
      }));
    const webhostRows = this.overview().issueRows.map((row) => ({
      key: row.uuid,
      type: row.type === 'webhost_host' ? 'Webhost Host' : 'Email Account',
      name: row.name || '-',
      status: row.status || 'Check',
      message: row.message || 'Review provisioning state.',
      route: ['hosting', 'webhost', row.type === 'webhost_host' ? 'hosts' : 'emails'],
    }));
    return [
      ...instanceRows('VPS Instance', vps, ['hosting', 'vps', 'instances']),
      ...instanceRows('Container Instance', containers, ['hosting', 'vps-container', 'instances']),
      ...webhostRows,
    ].slice(0, 25);
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
