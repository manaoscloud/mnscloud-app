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
  dashboardErrorMessage,
  EMPTY_INSTANCE_DASHBOARD,
  formatMemoryMb,
  formatPlanPrice,
  type InstanceDashboard,
  instanceStatusRecords,
  instanceStatusTone,
  isActiveValue,
  loadInstanceDashboard,
  parseJsonValue,
  planInstanceCount,
  providerInstances,
} from '../../shared/instance-dashboard';
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

const FAILURE = 'Failed to load VPS dashboard.';

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
      this.snack.error(dashboardErrorMessage(error, FAILURE));
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
    const active = rows.filter((row) => isActiveValue(row.HvrIsActive)).length;
    const defaults = rows.filter((row) => Number(row.HvrIsDefault ?? 0) === 1).length;
    return { total, active, defaults };
  });

  readonly planSummary = computed(() => {
    const rows = this.plans();
    const total = rows.length;
    const active = rows.filter((row) => isActiveValue(row.HvpIsActive)).length;
    const linked = rows.filter(
      (row) => planInstanceCount(this.instances(), row.HvpUUID) > 0,
    ).length;
    return { total, active, linked };
  });

  readonly capacitySummary = computed(() => {
    return this.plans().reduce(
      (acc, plan) => {
        const config = this.normalizePlanConfig(plan.HvpConfig);
        if (isActiveValue(plan.HvpIsActive)) {
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
      detailValue: formatMemoryMb(this.capacitySummary().memoryMb),
      detailLabel: 'RAM catalog',
      icon: 'memory',
      state: 'neutral',
    },
  ]);

  readonly statusRows = computed<DashboardRecord[]>(() =>
    instanceStatusRecords(this.instances(), instanceStatusTone),
  );

  readonly providerRows = computed<DashboardRecord[]>(() =>
    this.providers().map((provider) => {
      const plans = this.plans().filter(
        (plan) => plan.HostingVpsProviderHvrUUID === provider.HvrUUID,
      );
      const instances = providerInstances(this.instances(), provider.HvrUUID);
      const active = isActiveValue(provider.HvrIsActive);
      const issues = instances.issues;
      return {
        name: provider.HvrName,
        meta: provider.HvrProvider,
        status: active ? 'Active' : 'Inactive',
        tone: issues > 0 ? 'danger' : active ? 'success' : 'skipped',
        details: [
          { label: 'Plans', value: String(plans.length) },
          { label: 'Instances', value: String(instances.total) },
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
      const active = isActiveValue(plan.HvpIsActive);
      return {
        name: plan.HvpName,
        meta: this.providerLabel(plan.HostingVpsProviderHvrUUID),
        status: active ? 'Active' : 'Inactive',
        tone: active ? 'success' : 'skipped',
        details: [
          { label: 'CPU', value: config.cpu ? `${config.cpu} vCPU` : '-' },
          { label: 'Memory', value: formatMemoryMb(config.memoryMb) },
          { label: 'Disk', value: config.diskGb ? `${config.diskGb} GB` : '-' },
          { label: 'Price', value: formatPlanPrice(plan.HvpPrice, plan.HvpCurrency) },
          {
            label: 'Instances',
            value: String(planInstanceCount(this.instances(), plan.HvpUUID)),
          },
        ],
      } satisfies DashboardRecord;
    }),
  );

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<VpsDashboardSnapshot> {
    return loadInstanceDashboard<HostingVpsProvider, HostingVpsPlan>(
      this.api,
      this.isMaster() ? 'system/hosting/vps' : 'hosting/vps',
      { provider: 'HvrConfig', plan: 'HvpConfig' },
      FAILURE,
    );
  }

  private providerLabel(uuid: string) {
    const provider = this.providers().find((item) => item.HvrUUID === uuid);
    return provider?.HvrName || '-';
  }

  private normalizePlanConfig(value: HostingVpsPlanConfig | string | null | undefined) {
    return parseJsonValue<HostingVpsPlanConfig>(value) ?? {};
  }
}
