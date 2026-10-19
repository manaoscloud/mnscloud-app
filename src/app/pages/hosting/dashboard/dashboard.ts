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
  | 'containerProviders'
  | 'containerPlans'
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
  containerProviders: [],
  containerPlans: [],
  webhostProviders: [],
  webhostPlans: [],
  webhostHosts: [],
  webhostEmails: [],
  webhostDatabases: [],
  webhostMailingLists: [],
  webhostZoneRecords: [],
};

/** Instance totals counted by the database ({system/}hosting/vps{-container}/dashboard). */
type InstanceTotals = {
  total: number;
  active: number;
  issues: number;
  issueRows: Array<{ uuid: string; name: string | null; status: string | null }>;
};

const EMPTY_INSTANCE_TOTALS: InstanceTotals = { total: 0, active: 0, issues: 0, issueRows: [] };

type HostingDashboardSnapshot = {
  data: Record<HostingDatasetKey, GenericRow[]>;
  vps: InstanceTotals;
  containers: InstanceTotals;
  generatedAt: string | null;
  failedSections: number;
};

const EMPTY_HOSTING_DASHBOARD: HostingDashboardSnapshot = {
  data: { ...EMPTY_HOSTING_DATA },
  vps: EMPTY_INSTANCE_TOTALS,
  containers: EMPTY_INSTANCE_TOTALS,
  generatedAt: null,
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
  readonly data = computed(() => this.dashboard().data);
  readonly generatedAt = computed(() => this.dashboard().generatedAt);

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
    return {
      total: vps.total + containers.total,
      active: vps.active + containers.active,
      issues: vps.issues + containers.issues,
    };
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

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<HostingDashboardSnapshot> {
    const endpointMap = this.endpointMap();
    const entries = Object.entries(endpointMap) as [HostingDatasetKey, string][];

    // A null endpoint is a section this user has no API for (for example the master-only
    // Webhost provider catalog); it stays empty instead of failing the dashboard.
    const [results, instanceResults] = await Promise.all([
      Promise.allSettled(
        entries.map(([, endpoint]) => (endpoint ? this.fetchItems(endpoint) : Promise.resolve([]))),
      ),
      Promise.allSettled([
        this.fetchInstanceTotals(`${this.vpsRoot()}/dashboard`),
        this.fetchInstanceTotals(`${this.containerRoot()}/dashboard`),
      ]),
    ]);
    const nextData: Record<HostingDatasetKey, GenericRow[]> = { ...EMPTY_HOSTING_DATA };
    const failedSections = [...results, ...instanceResults].filter(
      (result) => result.status === 'rejected',
    ).length;
    const [vps, containers] = instanceResults.map((result) =>
      result.status === 'fulfilled' ? result.value : EMPTY_INSTANCE_TOTALS,
    );

    entries.forEach(([key], index) => {
      const result = results[index];
      nextData[key] = result.status === 'fulfilled' ? result.value : [];
    });

    // One unavailable section must not hide the others: only a total failure is an error.
    if (failedSections === entries.length + instanceResults.length) {
      throw new Error('Failed to load hosting dashboard.');
    }

    return {
      data: nextData,
      vps,
      containers,
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

  private endpointMap(): Record<HostingDatasetKey, string | null> {
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
      containerProviders: `${this.containerRoot()}/providers`,
      containerPlans: `${this.containerRoot()}/plans`,
      webhostProviders: this.hasPlatformMasterAccess() ? 'system/hosting/webhost/providers' : null,
      webhostPlans: this.hasPlatformMasterAccess()
        ? 'system/hosting/webhost/plans'
        : 'hosting/webhost/plans',
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
    const response = await this.api.get<unknown>(this.withLimit(endpoint), { timeout: 30000 });
    return this.responseItems(response);
  }

  private async fetchInstanceTotals(endpoint: string): Promise<InstanceTotals> {
    const response = await this.api.get<{ data?: Partial<InstanceTotals> }>(endpoint, {
      timeout: 30000,
    });
    return { ...EMPTY_INSTANCE_TOTALS, ...(response?.data ?? {}) };
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
      this.instanceWorkload('vps-instances', 'VPS Instances', 'dns', this.dashboard().vps, [
        'hosting',
        'vps',
        'instances',
      ]),
      this.instanceWorkload(
        'container-instances',
        'Container Instances',
        'apps',
        this.dashboard().containers,
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
    ].filter((row) => row.key !== 'webhost-providers' || this.hasPlatformMasterAccess());
  }

  private issues(): IssueRow[] {
    const data = this.data();
    return [
      ...this.instanceIssueRows('VPS Instance', this.dashboard().vps, [
        'hosting',
        'vps',
        'instances',
      ]),
      ...this.instanceIssueRows('Container Instance', this.dashboard().containers, [
        'hosting',
        'vps-container',
        'instances',
      ]),
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

  private instanceWorkload(
    key: string,
    label: string,
    icon: string,
    totals: InstanceTotals,
    route: string[],
  ): WorkloadRow {
    const { total, active, issues } = totals;
    return { key, label, icon, total, active, issues, route };
  }

  /** The ten most recent problem instances, already selected by the database. */
  private instanceIssueRows(type: string, totals: InstanceTotals, route: string[]): IssueRow[] {
    return totals.issueRows.map((row) => ({
      key: row.uuid,
      type,
      name: row.name || '-',
      status: row.status || 'Check',
      message: 'Review provisioning state.',
      route,
    }));
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

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
