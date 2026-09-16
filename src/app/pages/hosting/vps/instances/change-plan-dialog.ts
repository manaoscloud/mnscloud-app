import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import type { HostingVpsInstance, HostingVpsPlan, HostingVpsPlanConfig } from '../vps.types';

export type ChangePlanDialogData = {
  instance: HostingVpsInstance;
  plans: HostingVpsPlan[];
};

export type ChangePlanDialogResult = {
  targetPlanUUID: string;
};

type UpgradePlanOption = {
  plan: HostingVpsPlan;
  diskChange: number;
};

@Component({
  selector: 'app-hosting-vps-change-plan-dialog',
  standalone: true,
  imports: [
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

  readonly currentPlan = computed(() => this.planById(this.instance.HostingVpsPlanHvpUUID));

  readonly currentGrouping = computed(() => planSizeGrouping(this.currentPlan()));

  readonly upgradePlanOptions = computed<UpgradePlanOption[]>(() => {
    const current = this.currentPlan();
    if (!current) return [];
    const currentDisk = this.planDiskGb(current);
    const currentGrouping = planSizeGrouping(current);
    if (isGpuSizeGrouping(currentGrouping)) return [];

    return this.data.plans
      .filter((plan) => {
        if (plan.HvpIsActive !== 1 || plan.HvpUUID === current.HvpUUID) return false;
        if (plan.HostingVpsProviderHvrUUID !== current.HostingVpsProviderHvrUUID) return false;
        if (plan.HvpProvider !== current.HvpProvider) return false;
        if ((plan.HvpRegion ?? '') !== (current.HvpRegion ?? '')) return false;
        if (!plan.HvpSize) return false;
        if (plan.HvpProvider !== 'digitalocean') return false;

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

  readonly selectedTargetPlan = computed(() => this.planById(this.targetPlanUUID()));

  planById(uuid: string | null | undefined) {
    if (!uuid) return null;
    return this.data.plans.find((plan) => plan.HvpUUID === uuid) ?? null;
  }

  planDiskGb(plan: HostingVpsPlan | null | undefined) {
    const value = Number(plan?.HvpConfig?.diskGb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  planSpecLabel(plan: HostingVpsPlan | null | undefined) {
    if (!plan) return '';
    const config = plan.HvpConfig ?? {};
    const grouping = planSizeGrouping(plan);
    const price = formatPlanMoney(plan.HvpPrice, plan.HvpCurrency);
    const setupFee = formatPlanMoney(plan.HvpSetupFee ?? 0, plan.HvpCurrency);
    return [
      `${grouping.family} / ${grouping.category}`,
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
    if (!targetPlanUUID) return;
    this.dialogRef.close({ targetPlanUUID });
  }
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
  const normalized = String(slug ?? '').trim().toLowerCase();
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
  if (
    normalized.startsWith('m-') ||
    normalized.startsWith('m3-') ||
    normalized.startsWith('m6-')
  ) {
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
    grouping.family.toLowerCase().includes('gpu') ||
    grouping.category.toLowerCase().includes('gpu')
  );
}
