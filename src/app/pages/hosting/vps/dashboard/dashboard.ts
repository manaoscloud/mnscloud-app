import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { NgClass } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  DashboardRecordListComponent,
  type DashboardRecord,
} from '../../../../shared/dashboard/dashboard-record-list';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import {
  HostingVpsPlan,
  HostingVpsPlanConfig,
  HostingVpsProvider,
  VpsProviderConfig,
} from '../vps.types';

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

/** Instance totals counted by the database over every row in scope ({system/}...dashboard). */
type InstanceDashboard = {
  total: number;
  active: number;
  issues: number;
  byStatus: Array<{ status: string | null; total: number; active: number; issues: number }>;
  byPlan: Array<{ planUUID: string | null; total: number }>;
  byProvider: Array<{ providerUUID: string | null; total: number; issues: number }>;
};

const EMPTY_INSTANCE_DASHBOARD: InstanceDashboard = {
  total: 0,
  active: 0,
  issues: 0,
  byStatus: [],
  byPlan: [],
  byProvider: [],
};

type VpsDashboardSnapshot = {
  providers: HostingVpsProvider[];
  plans: HostingVpsPlan[];
  instances: InstanceDashboard;
  failedSections: number;
};

const EMPTY_VPS_DASHBOARD: VpsDashboardSnapshot = {
  providers: [],
  plans: [],
  instances: EMPTY_INSTANCE_DASHBOARD,
  failedSections: 0,
};

@Component({
  selector: 'app-hosting-vps-dashboard',
  standalone: true,
  imports: [
    DashboardRecordListComponent,
    DashboardPageComponent,
    MatIconModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
})
export class HostingVpsDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly dashboardResource = dashboardResource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_VPS_DASHBOARD,
    loader: () => this.loadDashboardSnapshot(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly providers = computed(() => this.dashboard().providers);
  readonly plans = computed(() => this.dashboard().plans);
  readonly instances = computed(() => this.dashboard().instances);

  private readonly reportDashboardState = effect(() => {
    const error = this.dashboardResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load VPS dashboard.'));
      return;
    }

    const failedSections = this.dashboard().failedSections;
    if (failedSections > 0 && !this.loading()) {
      this.snack.warning('Some VPS dashboard sections could not be loaded.');
    }
  });

  readonly instanceSummary = computed(() => {
    const { total, active, issues } = this.instances();
    return { total, active, issues };
  });

  readonly providerSummary = computed(() => {
    const rows = this.providers();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HvrIsActive)).length;
    const defaults = rows.filter((row) => Number(row.HvrIsDefault ?? 0) === 1).length;
    return { total, active, defaults };
  });

  readonly planSummary = computed(() => {
    const rows = this.plans();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.HvpIsActive)).length;
    const linked = rows.filter((row) => this.planInstances(row.HvpUUID) > 0).length;
    return { total, active, linked };
  });

  readonly capacitySummary = computed(() => {
    return this.plans().reduce(
      (acc, plan) => {
        const config = this.normalizePlanConfig(plan.HvpConfig);
        if (this.isActive(plan.HvpIsActive)) {
          acc.cpu += Number(config.cpu ?? 0);
          acc.memoryMb += Number(config.memoryMb ?? 0);
          acc.diskGb += Number(config.diskGb ?? 0);
        }
        return acc;
      },
      { cpu: 0, memoryMb: 0, diskGb: 0 },
    );
  });

  readonly kpis = computed<KpiTile[]>(() => [
    {
      label: 'VPS Instances',
      value: String(this.instanceSummary().total),
      detailValue: String(this.instanceSummary().issues),
      detailLabel: 'issues',
      icon: 'dns',
      state: this.instanceSummary().issues > 0 ? 'warn' : 'good',
    },
    {
      label: 'VPS Providers',
      value: `${this.providerSummary().active} / ${this.providerSummary().total}`,
      detailValue: String(this.providerSummary().defaults),
      detailLabel: 'defaults',
      icon: 'cloud_sync',
      state: this.providerSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'VPS Plans',
      value: `${this.planSummary().active} / ${this.planSummary().total}`,
      detailValue: String(this.planSummary().linked),
      detailLabel: 'in use',
      icon: 'view_list',
      state: this.planSummary().active > 0 ? 'good' : 'neutral',
    },
    {
      label: 'Catalog Capacity',
      value: `${this.capacitySummary().cpu} vCPU`,
      detailValue: this.formatMemory(this.capacitySummary().memoryMb),
      detailLabel: 'RAM catalog',
      icon: 'memory',
      state: 'neutral',
    },
  ]);

  readonly statusRows = computed<DashboardRecord[]>(() => {
    return this.instances()
      .byStatus.map((row) => {
        const status = String(row.status || 'unknown');
        const { total, active, issues } = row;
        return {
          name: status,
          meta: String(total),
          status,
          tone: this.statusTone(status, issues),
          details: [
            { label: 'Total', value: String(total) },
            { label: 'Active', value: String(active) },
            { label: 'Issues', value: String(issues) },
          ],
        } satisfies DashboardRecord;
      })
      .sort((a, b) => Number(b.meta) - Number(a.meta) || a.name.localeCompare(b.name));
  });

  readonly providerRows = computed<DashboardRecord[]>(() =>
    this.providers().map((provider) => {
      const plans = this.plans().filter(
        (plan) => plan.HostingVpsProviderHvrUUID === provider.HvrUUID,
      );
      const instances = this.instances().byProvider.find(
        (row) => row.providerUUID === provider.HvrUUID,
      );
      const active = this.isActive(provider.HvrIsActive);
      const issues = instances?.issues ?? 0;
      return {
        name: provider.HvrName,
        meta: provider.HvrProvider,
        status: active ? 'Active' : 'Inactive',
        tone: issues > 0 ? 'danger' : active ? 'success' : 'skipped',
        details: [
          { label: 'Plans', value: String(plans.length) },
          { label: 'Instances', value: String(instances?.total ?? 0) },
          { label: 'Issues', value: String(issues) },
          {
            label: 'Default',
            value: Number(provider.HvrIsDefault ?? 0) === 1 ? 'Yes' : 'No',
            translate: true,
          },
        ],
      } satisfies DashboardRecord;
    }),
  );

  readonly planRows = computed<DashboardRecord[]>(() =>
    this.plans().map((plan) => {
      const config = this.normalizePlanConfig(plan.HvpConfig);
      const active = this.isActive(plan.HvpIsActive);
      return {
        name: plan.HvpName,
        meta: this.providerLabel(plan.HostingVpsProviderHvrUUID),
        status: active ? 'Active' : 'Inactive',
        tone: active ? 'success' : 'skipped',
        details: [
          { label: 'CPU', value: config.cpu ? `${config.cpu} vCPU` : '-' },
          { label: 'Memory', value: this.formatMemory(config.memoryMb) },
          { label: 'Disk', value: config.diskGb ? `${config.diskGb} GB` : '-' },
          { label: 'Price', value: this.formatPrice(plan.HvpPrice, plan.HvpCurrency) },
          {
            label: 'Instances',
            value: String(this.planInstances(plan.HvpUUID)),
          },
        ],
      } satisfies DashboardRecord;
    }),
  );

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<VpsDashboardSnapshot> {
    const [providersResult, plansResult, instancesResult] = await Promise.allSettled([
      this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        `${this.providerEndpoint()}?limit=500&offset=0`,
        { timeout: 30000 },
      ),
      this.api.get<{ data?: { items?: HostingVpsPlan[] } }>(
        `${this.planEndpoint()}?limit=500&offset=0`,
        { timeout: 30000 },
      ),
      this.api.get<{ data?: Partial<InstanceDashboard> }>(this.instanceDashboardEndpoint(), {
        timeout: 30000,
      }),
    ]);

    const results = [providersResult, plansResult, instancesResult];
    const failedSections = results.filter((result) => result.status === 'rejected').length;

    if (failedSections === results.length) {
      throw new Error('Failed to load VPS dashboard.');
    }

    return {
      providers:
        providersResult.status === 'fulfilled'
          ? this.items(providersResult.value).map((item) => ({
              ...item,
              HvrConfig: this.parseJson<VpsProviderConfig>(item.HvrConfig),
            }))
          : [],
      plans:
        plansResult.status === 'fulfilled'
          ? this.items(plansResult.value).map((item) => ({
              ...item,
              HvpConfig: this.parseJson<HostingVpsPlanConfig>(item.HvpConfig),
            }))
          : [],
      instances:
        instancesResult.status === 'fulfilled'
          ? { ...EMPTY_INSTANCE_DASHBOARD, ...(instancesResult.value?.data ?? {}) }
          : EMPTY_INSTANCE_DASHBOARD,
      failedSections,
    };
  }

  formatMemory(value: number | null | undefined) {
    const mb = Number(value ?? 0);
    if (!Number.isFinite(mb) || mb <= 0) return '-';
    if (mb >= 1024) return `${Math.round((mb / 1024) * 10) / 10} GB`;
    return `${mb} MB`;
  }

  private providerEndpoint() {
    return this.isMaster() ? 'system/hosting/vps/providers' : 'hosting/vps/providers';
  }

  private planEndpoint() {
    return this.isMaster() ? 'system/hosting/vps/plans' : 'hosting/vps/plans';
  }

  private instanceDashboardEndpoint() {
    return this.isMaster() ? 'system/hosting/vps/dashboard' : 'hosting/vps/dashboard';
  }

  private planInstances(planUUID: string) {
    return this.instances().byPlan.find((row) => row.planUUID === planUUID)?.total ?? 0;
  }

  private statusTone(status: string, issues: number): DashboardRecord['tone'] {
    if (issues > 0 || this.isIssueStatus(status)) return 'danger';
    const normalized = status.toLowerCase();
    if (['pending', 'queued', 'provisioning', 'creating', 'running'].includes(normalized)) {
      return 'running';
    }
    if (['inactive', 'disabled', 'stopped', 'unknown'].includes(normalized)) return 'skipped';
    return 'success';
  }

  private providerLabel(uuid: string) {
    const provider = this.providers().find((item) => item.HvrUUID === uuid);
    return provider?.HvrName || '-';
  }

  private normalizePlanConfig(value: HostingVpsPlanConfig | string | null | undefined) {
    return this.parseJson<HostingVpsPlanConfig>(value) ?? {};
  }

  private isActive(value: unknown, status?: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string' && value.trim()) {
      return ['1', 'true', 'active', 'running', 'ready'].includes(value.toLowerCase());
    }
    const normalized = String(status ?? '').toLowerCase();
    return ['active', 'running', 'ready'].includes(normalized);
  }

  private isIssueStatus(value: unknown) {
    const normalized = String(value ?? '').toLowerCase();
    return ['failed', 'error', 'suspended', 'cancelled', 'canceled'].includes(normalized);
  }

  private items<T>(response: { data?: { items?: T[] } }) {
    return Array.isArray(response?.data?.items) ? response.data.items : [];
  }

  private parseJson<T>(value: T | string | null | undefined): T | null {
    if (!value) return null;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private formatPrice(
    value: number | string | null | undefined,
    currency: string | null | undefined,
  ) {
    const amount = Number(value ?? 0);
    const code = currency || 'BRL';
    if (!Number.isFinite(amount)) return '-';
    return `${code} ${amount.toFixed(2)}`;
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
