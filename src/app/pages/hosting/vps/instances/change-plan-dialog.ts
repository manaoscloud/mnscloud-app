import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import type { HostingVpsInstance, HostingVpsPlan, HostingVpsPlanConfig } from '../vps.types';
import { ReportProblemButtonComponent } from '../../../../shared/support-report-dialog/report-problem-button';
import { FieldRules } from '../../../../shared/forms/field-validation';
import { injectRevealInvalidFields } from '../../../../shared/forms/reveal-invalid-fields';
import { FieldInvalidDirective } from '../../../../shared/forms/field-invalid.directive';

export type ChangePlanDialogData = {
  instance: HostingVpsInstance;
  plans: HostingVpsPlan[];
  /** Provider family of the server, used when its current plan is not in `plans`. */
  provider?: string | null;
};

/** CPU, memory and disk the VM has now (runtime refresh), used as the baseline of an adopted VM. */
export type VmSize = { cpu: number; memoryMb: number; diskGb: number };

export type ChangePlanDialogResult = {
  targetPlanUUID: string;
};

export type UpgradePlanOption = {
  plan: HostingVpsPlan;
  diskChange: number;
};

@Component({
  selector: 'app-hosting-vps-change-plan-dialog',
  standalone: true,
  imports: [
    FieldInvalidDirective,
    ReportProblemButtonComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  templateUrl: './change-plan-dialog.html',
  styleUrls: ['./change-plan-dialog.scss'],
})
export class ChangePlanDialogComponent {
  private readonly data = inject<ChangePlanDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<ChangePlanDialogComponent, ChangePlanDialogResult>,
  );

  readonly instance = this.data.instance;
  readonly targetPlanUUID = signal('');
  /** Required Field Feedback Baseline: the plan turns red when confirming without one. */
  readonly rules = new FieldRules({ targetPlan: () => !!this.targetPlanUUID().trim() });
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly currentPlan = computed(() => this.planById(this.instance.HostingVpsPlanHvpUUID));

  readonly currentGrouping = computed(() => planSizeGrouping(this.currentPlan()));

  readonly provider = computed(() =>
    String(this.currentPlan()?.HvpProvider ?? this.data.provider ?? '').toLowerCase(),
  );

  readonly isProxmoxUpgrade = computed(() => this.provider() === 'proxmox');

  /** FA3: an adopted VM sits on the adoption plan, which has no size; the VM is the baseline. */
  readonly isAdopted = !!String(this.instance.HviAdoptedAt ?? '').trim();

  readonly vmSize = computed<VmSize | null>(() => {
    const runtime = this.instance.HviConfig?.runtime;
    if (!runtime) return null;
    const size = {
      cpu: positive(runtime.vcpus),
      memoryMb: positive(runtime.memoryMb),
      diskGb: positive(runtime.diskGb),
    };
    return size.cpu || size.memoryMb || size.diskGb ? size : null;
  });

  readonly upgradePlanOptions = computed<UpgradePlanOption[]>(() => {
    if (this.isProxmoxUpgrade()) return this.proxmoxPlanOptions();
    const current = this.currentPlan();
    if (!current) return [];
    const currentDisk = this.planDiskGb(current);
    const currentMemory = this.planMemoryMb(current);
    const currentGrouping = planSizeGrouping(current);
    const provider = String(current.HvpProvider ?? '');
    if (provider !== 'digitalocean' && provider !== 'lightsail') return [];
    if (isGpuSizeGrouping(currentGrouping)) return [];

    return this.data.plans
      .filter((plan) => {
        if (plan.HvpIsActive !== 1 || plan.HvpUUID === current.HvpUUID) return false;
        if (plan.HostingVpsProviderHvrUUID !== current.HostingVpsProviderHvrUUID) return false;
        if (plan.HvpProvider !== current.HvpProvider) return false;
        if ((plan.HvpRegion ?? '') !== (current.HvpRegion ?? '')) return false;
        if (!plan.HvpSize) return false;

        if (provider === 'lightsail') {
          const currentFamily = String(current.HvpConfig?.sizeFamily ?? '')
            .trim()
            .toLowerCase();
          const targetFamily = String(plan.HvpConfig?.sizeFamily ?? '')
            .trim()
            .toLowerCase();
          if (currentFamily && targetFamily && currentFamily !== targetFamily) return false;
          const targetDisk = this.planDiskGb(plan);
          if (currentDisk > 0 && targetDisk > 0 && targetDisk < currentDisk) return false;
          const targetMemory = this.planMemoryMb(plan);
          if (currentMemory > 0 && targetMemory > 0 && targetMemory < currentMemory) return false;
          return true;
        }

        const grouping = planSizeGrouping(plan);
        if (isGpuSizeGrouping(grouping)) return false;
        if (
          grouping.family !== currentGrouping.family ||
          grouping.category !== currentGrouping.category
        ) {
          return false;
        }

        const targetDisk = this.planDiskGb(plan);
        if (targetDisk < currentDisk) return false;
        return true;
      })
      .map((plan) => ({
        plan,
        diskChange: this.planDiskGb(plan) - currentDisk,
      }))
      .sort((left, right) => {
        const diskDiff = left.diskChange - right.diskChange;
        if (diskDiff !== 0) return diskDiff;
        return String(left.plan.HvpName).localeCompare(String(right.plan.HvpName), undefined, {
          sensitivity: 'base',
        });
      });
  });

  private proxmoxPlanOptions(): UpgradePlanOption[] {
    return proxmoxUpgradePlans(this.instance, this.data.plans, this.currentPlan());
  }

  readonly isLightsailUpgrade = computed(
    () => String(this.currentPlan()?.HvpProvider ?? '') === 'lightsail',
  );

  readonly selectedTargetPlan = computed(() => this.planById(this.targetPlanUUID()));

  planById(uuid: string | null | undefined) {
    if (!uuid) return null;
    return this.data.plans.find((plan) => plan.HvpUUID === uuid) ?? null;
  }

  planDiskGb(plan: HostingVpsPlan | null | undefined) {
    const value = Number(plan?.HvpConfig?.diskGb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  planMemoryMb(plan: HostingVpsPlan | null | undefined) {
    const value = Number(plan?.HvpConfig?.memoryMb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  planSpecLabel(plan: HostingVpsPlan | null | undefined) {
    if (!plan) return '';
    const config = plan.HvpConfig ?? {};
    const grouping = planSizeGrouping(plan);
    const price = formatPlanMoney(plan.HvpPrice, plan.HvpCurrency);
    const setupFee = formatPlanMoney(plan.HvpSetupFee ?? 0, plan.HvpCurrency);
    return [
      plan.HvpProvider === 'proxmox' ? null : `${grouping.family} / ${grouping.category}`,
      config.cpu ? `${config.cpu} CPU` : null,
      config.memoryMb ? `${config.memoryMb} MB` : null,
      config.diskGb ? `${config.diskGb} GB` : null,
      plan.HvpSize,
      price,
      `Setup fee ${setupFee}`,
    ]
      .filter(Boolean)
      .join(' / ');
  }

  cancel() {
    this.dialogRef.close();
  }

  confirm() {
    const targetPlanUUID = this.targetPlanUUID().trim();
    if (!this.rules.check()) return this.revealInvalid();
    this.dialogRef.close({ targetPlanUUID });
  }
}

/**
 * Proxmox rules of the API (services/proxmoxChangePlan.ts): same provider account, a target in
 * region `auto` or on the node the plan starts from (the VM's node for an adopted VM), the disk
 * never shrinks; an adopted VM (FA3, adoption plan without size) also never loses CPU or memory
 * against the size the runtime refresh read from the VM.
 */
export function proxmoxUpgradePlans(
  instance: HostingVpsInstance,
  plans: HostingVpsPlan[],
  current: HostingVpsPlan | null,
): UpgradePlanOption[] {
  const adopted = !!String(instance.HviAdoptedAt ?? '').trim();
  const providerUUID = current?.HostingVpsProviderHvrUUID ?? instance.HostingVpsProviderHvrUUID;
  const config = instance.HviConfig ?? {};
  const sourceRegion = (
    (adopted ? (config.proxmoxNode ?? config.runtime?.region) : null) ??
    current?.HvpRegion ??
    ''
  )
    .trim()
    .toLowerCase();
  const runtime = config.runtime ?? {};
  const baseline = adopted
    ? {
        cpu: positive(runtime.vcpus),
        memoryMb: positive(runtime.memoryMb),
        diskGb: positive(runtime.diskGb),
      }
    : { cpu: 0, memoryMb: 0, diskGb: positive(current?.HvpConfig?.diskGb) };
  return plans
    .filter((plan) => {
      if (plan.HvpIsActive !== 1 || plan.HvpUUID === current?.HvpUUID) return false;
      if (plan.HostingVpsProviderHvrUUID !== providerUUID) return false;
      if (String(plan.HvpProvider ?? '').toLowerCase() !== 'proxmox') return false;
      const region = String(plan.HvpRegion ?? '')
        .trim()
        .toLowerCase();
      if (region && region !== 'auto' && region !== sourceRegion) return false;
      const target = plan.HvpConfig ?? {};
      if (smaller(positive(target.cpu), baseline.cpu)) return false;
      if (smaller(positive(target.memoryMb), baseline.memoryMb)) return false;
      return !smaller(positive(target.diskGb), baseline.diskGb);
    })
    .map((plan) => ({ plan, diskChange: positive(plan.HvpConfig?.diskGb) - baseline.diskGb }))
    .sort(
      (left, right) =>
        positive(left.plan.HvpConfig?.memoryMb) - positive(right.plan.HvpConfig?.memoryMb) ||
        left.diskChange - right.diskChange ||
        String(left.plan.HvpName).localeCompare(String(right.plan.HvpName), undefined, {
          sensitivity: 'base',
        }),
    );
}

function positive(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Whether a known target value is below a known baseline (0 = unknown, not compared). */
function smaller(target: number, baseline: number): boolean {
  return target > 0 && baseline > 0 && target < baseline;
}

function formatPlanMoney(
  value: number | string | null | undefined,
  currency: string | null | undefined,
) {
  const amount = Number(value ?? 0);
  const code = (currency || 'BRL').toUpperCase();
  if (!Number.isFinite(amount)) return `${code} -`;
  return `${code} ${amount.toFixed(2)}`;
}

function digitalOceanSizeGrouping(slug: string): { family: string; category: string } {
  const normalized = String(slug ?? '')
    .trim()
    .toLowerCase();
  if (
    normalized.startsWith('gpu-') ||
    normalized.includes('-gpu') ||
    normalized.includes('-nvidia') ||
    normalized.includes('-mi300')
  ) {
    return { family: 'GPU', category: 'GPU' };
  }
  if (normalized.startsWith('s-')) {
    if (normalized.includes('-amd')) return { family: 'Basic', category: 'Premium AMD' };
    if (normalized.includes('-intel')) return { family: 'Basic', category: 'Premium Intel' };
    return { family: 'Basic', category: 'Regular' };
  }
  if (normalized.startsWith('g-') || normalized.startsWith('gd-')) {
    return { family: 'General Purpose', category: 'Dedicated CPU' };
  }
  if (
    normalized.startsWith('c-') ||
    normalized.startsWith('c2-') ||
    normalized.startsWith('c-48')
  ) {
    return { family: 'CPU-Optimized', category: 'Dedicated CPU' };
  }
  if (normalized.startsWith('m-') || normalized.startsWith('m3-') || normalized.startsWith('m6-')) {
    return { family: 'Memory-Optimized', category: 'Dedicated CPU' };
  }
  if (normalized.startsWith('so-') || normalized.startsWith('so1_5-')) {
    return { family: 'Storage-Optimized', category: 'Dedicated CPU' };
  }
  return { family: 'Droplet', category: 'Other' };
}

function planSizeGrouping(plan: HostingVpsPlan | null | undefined): {
  family: string;
  category: string;
} {
  if (!plan) return { family: 'Droplet', category: 'Other' };
  const config = (plan.HvpConfig ?? {}) as HostingVpsPlanConfig;
  const family = typeof config.sizeFamily === 'string' ? config.sizeFamily.trim() : '';
  const category = typeof config.sizeCategory === 'string' ? config.sizeCategory.trim() : '';
  if (family && category) return { family, category };
  const size = String(plan.HvpSize ?? '').trim();
  if (plan.HvpProvider === 'digitalocean') return digitalOceanSizeGrouping(size);
  if (plan.HvpProvider === 'lightsail') {
    const head = size.split('_')[0] || size || 'bundle';
    return { family: 'Lightsail', category: head };
  }
  return { family: plan.HvpProvider || 'VPS', category: size || 'Other' };
}

function isGpuSizeGrouping(grouping: { family: string; category: string }) {
  return (
    grouping.family.toLowerCase().includes('gpu') || grouping.category.toLowerCase().includes('gpu')
  );
}
