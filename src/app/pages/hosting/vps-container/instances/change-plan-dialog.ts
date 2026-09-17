import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import type {
  HostingVpsContainerInstance,
  HostingVpsContainerPlan,
  HostingVpsContainerPlanConfig,
} from '../vps-container.types';

export type VpsContainerChangePlanDialogData = {
  instance: HostingVpsContainerInstance;
  plans: HostingVpsContainerPlan[];
};

export type VpsContainerChangePlanDialogResult = {
  targetPlanUUID: string;
};

type ChangePlanOption = {
  plan: HostingVpsContainerPlan;
  diskChange: number;
  blocked: boolean;
};

@Component({
  selector: 'app-hosting-vps-container-change-plan-dialog',
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
export class VpsContainerChangePlanDialogComponent {
  private readonly data = inject<VpsContainerChangePlanDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<VpsContainerChangePlanDialogComponent, VpsContainerChangePlanDialogResult>,
  );

  readonly instance = this.data.instance;
  readonly targetPlanUUID = signal('');

  readonly currentPlan = computed(() =>
    this.planById(this.instance.HostingVpsContainerPlanHcnUUID),
  );

  readonly changePlanOptions = computed<ChangePlanOption[]>(() => {
    const current = this.currentPlan();
    if (!current) return [];
    const currentDisk = this.planDiskGb(current);
    return this.data.plans
      .filter(
        (plan) =>
          plan.HcnIsActive === 1 &&
          plan.HcnUUID !== current.HcnUUID &&
          plan.HostingVpsContainerProviderHcpUUID === current.HostingVpsContainerProviderHcpUUID &&
          plan.HcnProvider === current.HcnProvider &&
          (plan.HcnRegion ?? '') === (current.HcnRegion ?? '') &&
          !!plan.HcnSize,
      )
      .map((plan) => ({
        plan,
        diskChange: this.planDiskGb(plan) - currentDisk,
        blocked: this.planDiskGb(plan) < currentDisk,
      }));
  });

  readonly selectedTargetPlan = computed(() => this.planById(this.targetPlanUUID()));

  planById(uuid: string | null | undefined) {
    if (!uuid) return null;
    return this.data.plans.find((plan) => plan.HcnUUID === uuid) ?? null;
  }

  planDiskGb(plan: HostingVpsContainerPlan | null | undefined) {
    const value = Number(plan?.HcnConfig?.diskGb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  planSpecLabel(plan: HostingVpsContainerPlan | null | undefined) {
    if (!plan) return '';
    const config = (plan.HcnConfig ?? {}) as HostingVpsContainerPlanConfig;
    return [
      config.cpu ? `${config.cpu} CPU` : null,
      config.memoryMb ? `${config.memoryMb} MB` : null,
      config.diskGb ? `${config.diskGb} GB` : null,
      plan.HcnSize,
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
