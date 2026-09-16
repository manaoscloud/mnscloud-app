import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import type { HostingVpsInstance, HostingVpsPlan } from '../vps.types';

export type ChangePlanDialogData = {
  instance: HostingVpsInstance;
  plans: HostingVpsPlan[];
};

export type ChangePlanDialogResult = {
  targetPlanUUID: string;
};

type ChangePlanOption = {
  plan: HostingVpsPlan;
  diskChange: number;
  blocked: boolean;
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
  private readonly dialogRef = inject(MatDialogRef<ChangePlanDialogComponent, ChangePlanDialogResult>);

  readonly instance = this.data.instance;
  readonly targetPlanUUID = signal('');

  readonly currentPlan = computed(() => this.planById(this.instance.HostingVpsPlanHvpUUID));

  readonly changePlanOptions = computed<ChangePlanOption[]>(() => {
    const current = this.currentPlan();
    if (!current) return [];
    const currentDisk = this.planDiskGb(current);
    return this.data.plans
      .filter(
        (plan) =>
          plan.HvpIsActive === 1 &&
          plan.HvpUUID !== current.HvpUUID &&
          plan.HostingVpsProviderHvrUUID === current.HostingVpsProviderHvrUUID &&
          plan.HvpProvider === current.HvpProvider &&
          (plan.HvpRegion ?? '') === (current.HvpRegion ?? '') &&
          !!plan.HvpSize,
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
    return this.data.plans.find((plan) => plan.HvpUUID === uuid) ?? null;
  }

  planDiskGb(plan: HostingVpsPlan | null | undefined) {
    const value = Number(plan?.HvpConfig?.diskGb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  planSpecLabel(plan: HostingVpsPlan | null | undefined) {
    if (!plan) return '';
    const config = plan.HvpConfig ?? {};
    return [
      config.cpu ? `${config.cpu} CPU` : null,
      config.memoryMb ? `${config.memoryMb} MB` : null,
      config.diskGb ? `${config.diskGb} GB` : null,
      plan.HvpSize,
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
