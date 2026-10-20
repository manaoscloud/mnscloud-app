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
  HostingVpsContainerPlan,
  HostingVpsContainerPlanConfig,
  HostingVpsContainerProvider,
  VpsContainerProviderConfig,
} from '../vps-container.types';

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

type VpsContainerDashboardSnapshot = {
  providers: HostingVpsContainerProvider[];
  plans: HostingVpsContainerPlan[];
  instances: InstanceDashboard;
  failedSections: number;
};

const EMPTY_VPS_CONTAINER_DASHBOARD: VpsContainerDashboardSnapshot = {
  providers: [],
  plans: [],
  instances: EMPTY_INSTANCE_DASHBOARD,
  failedSections: 0,
};

const FAILURE = 'Failed to load VPS Container dashboard.';

@Component({
  selector: 'app-hosting-vps-container-dashboard',
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
export class HostingVpsContainerDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly dashboardResource = dashboardResource({
    params: () => ({ scope: this.scope() }),
    defaultValue: EMPTY_VPS_CONTAINER_DASHBOARD,
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
      this.snack.warning('Some VPS Container dashboard sections could not be loaded.');
    }
  });

  readonly instanceSummary = computed(() => {
    const { total, active, issues } = this.instances();
    return { total, active, issues };
  });

  readonly providerSummary = computed(() => {
    const rows = this.providers();
    const total = rows.length;
    const active = rows.filter((row) => isActiveValue(row.HcpIsActive)).length;
    const defaults = rows.filter((row) => Number(row.HcpIsDefault ?? 0) === 1).length;
    return { total, active, defaults };
  });

  readonly planSummary = computed(() => {
    const rows = this.plans();
    const total = rows.length;
    const active = rows.filter((row) => isActiveValue(row.HcnIsActive)).length;
    const linked = rows.filter(
      (row) => planInstanceCount(this.instances(), row.HcnUUID) > 0,
    ).length;
    return { total, active, linked };
  });

  readonly capacitySummary = computed(() => {
    return this.plans().reduce(
      (acc, plan) => {
        const config = this.normalizePlanConfig(plan.HcnConfig);
        if (isActiveValue(plan.HcnIsActive)) {
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
      label: 'Container Instances',
      value: String(this.instanceSummary().total),
      detailValue: String(this.instanceSummary().issues),
      detailLabel: 'issues',
      icon: 'apps',
      state: this.instanceSummary().issues > 0 ? 'warn' : 'good',
    },
    {
      label: 'Container Providers',
      value: `${this.providerSummary().active} / ${this.providerSummary().total}`,
      detailValue: String(this.providerSummary().defaults),
      detailLabel: 'defaults',
      icon: 'cloud_sync',
      state: this.providerSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'Container Plans',
      value: `${this.planSummary().active} / ${this.planSummary().total}`,
      detailValue: String(this.planSummary().linked),
      detailLabel: 'in use',
      icon: 'view_list',
      state: this.planSummary().active > 0 ? 'good' : 'neutral',
    },
    {
      label: 'Container Capacity',
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
        (plan) => plan.HostingVpsContainerProviderHcpUUID === provider.HcpUUID,
      );
      const instances = providerInstances(this.instances(), provider.HcpUUID);
      const active = isActiveValue(provider.HcpIsActive);
      const issues = instances.issues;
      return {
        name: provider.HcpName,
        meta: provider.HcpProvider,
        status: active ? 'Active' : 'Inactive',
        tone: issues > 0 ? 'danger' : active ? 'success' : 'skipped',
        details: [
          { label: 'Plans', value: String(plans.length) },
          { label: 'Instances', value: String(instances.total) },
          { label: 'Issues', value: String(issues) },
          {
            label: 'Default',
            value: Number(provider.HcpIsDefault ?? 0) === 1 ? 'Yes' : 'No',
            translate: true,
          },
        ],
      } satisfies DashboardRecord;
    }),
  );

  readonly planRows = computed<DashboardRecord[]>(() =>
    this.plans().map((plan) => {
      const config = this.normalizePlanConfig(plan.HcnConfig);
      const active = isActiveValue(plan.HcnIsActive);
      return {
        name: plan.HcnName,
        meta: this.providerLabel(plan.HostingVpsContainerProviderHcpUUID),
        status: active ? 'Active' : 'Inactive',
        tone: active ? 'success' : 'skipped',
        details: [
          { label: 'CPU', value: config.cpu ? `${config.cpu} vCPU` : '-' },
          { label: 'Memory', value: formatMemoryMb(config.memoryMb) },
          { label: 'Disk', value: config.diskGb ? `${config.diskGb} GB` : '-' },
          { label: 'Profile', value: config.profile || '-' },
          { label: 'Price', value: formatPlanPrice(plan.HcnPrice, plan.HcnCurrency) },
          {
            label: 'Instances',
            value: String(planInstanceCount(this.instances(), plan.HcnUUID)),
          },
        ],
      } satisfies DashboardRecord;
    }),
  );

  refreshList() {
    this.dashboardResource.reload();
  }

  async loadDashboardSnapshot(): Promise<VpsContainerDashboardSnapshot> {
    return loadInstanceDashboard<HostingVpsContainerProvider, HostingVpsContainerPlan>(
      this.api,
      this.isMaster() ? 'system/hosting/vps-container' : 'hosting/vps-container',
      { provider: 'HcpConfig', plan: 'HcnConfig' },
      FAILURE,
    );
  }

  private providerLabel(uuid: string) {
    const provider = this.providers().find((item) => item.HcpUUID === uuid);
    return provider?.HcpName || '-';
  }

  private normalizePlanConfig(value: HostingVpsContainerPlanConfig | string | null | undefined) {
    return parseJsonValue<HostingVpsContainerPlanConfig>(value) ?? {};
  }
}
