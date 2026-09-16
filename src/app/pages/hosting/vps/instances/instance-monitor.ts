import { Component, computed, DestroyRef, effect, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';
import { MetricsMonitorComponent } from '../../../../shared/monitoring/metrics-monitor/metrics-monitor';
import { MetricsMonitorPoint } from '../../../../shared/monitoring/metrics-monitor/metrics-monitor.types';
import { BreadcrumbLabelsService } from '../../../../shared/breadcrumb/breadcrumb-labels.service';
import { ApiService } from '../../../../services/api.service';

type MetricsEnvelope = {
  data?: {
    metrics?: {
      provider?: string;
      supported?: boolean;
      message?: string | null;
      windowHours?: number;
      collectedAt?: string;
      items?: MetricsMonitorPoint[];
    };
  };
};

export type VpsInstanceMonitorData = {
  uuid: string;
  name?: string;
  scope?: 'tenant' | 'master';
};

@Component({
  selector: 'mns-vps-instance-monitor',
  standalone: true,
  imports: [MetricsMonitorComponent],
  template: `
    <mns-metrics-monitor
      title="VPS instance monitoring"
      [identity]="name()"
      [recordId]="uuid"
      [dialogMode]="!!dialog"
      [showResourceFilter]="false"
      [(hours)]="hours"
      [points]="points()"
      [loading]="snapshot.isLoading()"
      [error]="!!snapshot.error()"
      [message]="message()"
      statusLabel="Provider"
      [statusValue]="provider()"
      emptyLabel="No metrics returned by the provider."
      multiSeriesTitle="Inbound and outbound"
      (refresh)="refresh()"
      (fullPage)="fullPage()"
      (closeRequest)="dialog?.close()"
    />
  `,
})
export class VpsInstanceMonitorPage {
  private readonly api = inject(ApiService);
  private readonly breadcrumbLabels = inject(BreadcrumbLabelsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly dialog = inject(MatDialogRef<VpsInstanceMonitorPage>, { optional: true });
  readonly data = inject<VpsInstanceMonitorData>(MAT_DIALOG_DATA, { optional: true });

  readonly uuid = this.data?.uuid ?? this.route.snapshot.paramMap.get('uuid') ?? '';
  readonly scope = signal<'tenant' | 'master'>(
    this.data?.scope ??
      (this.router.url.startsWith('/system') || this.route.snapshot.data?.['scope'] === 'master'
        ? 'master'
        : 'tenant'),
  );
  readonly name = signal(this.data?.name ?? '');
  readonly hours = signal(
    [1, 24, 168].includes(Number(this.route.snapshot.queryParamMap.get('hours')))
      ? Number(this.route.snapshot.queryParamMap.get('hours'))
      : 1,
  );

  private readonly endpoint = computed(() =>
    this.scope() === 'master'
      ? `system/hosting/vps/instances/${this.uuid}/metrics`
      : `hosting/vps/instances/${this.uuid}/metrics`,
  );

  readonly snapshot = resource<
    {
      points: MetricsMonitorPoint[];
      provider: string | null;
      message: string | null;
      name: string | null;
    },
    { endpoint: string; hours: number }
  >({
    defaultValue: { points: [], provider: null, message: null, name: null },
    params: () => ({ endpoint: this.endpoint(), hours: this.hours() }),
    loader: async ({ params }) => {
      const response = await this.api.get<MetricsEnvelope>(
        `${params.endpoint}?hours=${params.hours}`,
      );
      const metrics = response?.data?.metrics;
      const points = (metrics?.items ?? []).map((p) => ({
        ...p,
        bucketEpoch: Number(p.bucketEpoch),
        average: Number(p.average),
        minimum: Number(p.minimum),
        maximum: Number(p.maximum),
        samples: Number(p.samples),
      }));
      return {
        points,
        provider: metrics?.provider ?? null,
        message:
          metrics?.supported === false
            ? metrics?.message || 'Metrics unavailable for this provider'
            : metrics?.message ?? null,
        name: null,
      };
    },
  });

  readonly points = computed(() =>
    this.snapshot.hasValue() ? this.snapshot.value().points : [],
  );
  readonly provider = computed(() =>
    this.snapshot.hasValue() ? this.snapshot.value().provider : null,
  );
  readonly message = computed(() =>
    this.snapshot.hasValue() ? this.snapshot.value().message : null,
  );

  constructor() {
    effect((onCleanup) => {
      if (this.dialog) return;
      const label = this.name().trim() || this.uuid;
      if (!label) return;
      const prefix = this.scope() === 'master' ? '/system' : '';
      onCleanup(
        this.breadcrumbLabels.register(
          `${prefix}/hosting/vps/instances/${this.uuid}/monitoring`,
          label,
        ),
      );
    });
    inject(DestroyRef);
  }

  refresh() {
    this.snapshot.reload();
  }

  fullPage() {
    const prefix = this.scope() === 'master' ? '/system' : '';
    this.dialog?.close();
    void this.router.navigate([`${prefix}/hosting/vps/instances/${this.uuid}/monitoring`], {
      queryParams: { hours: this.hours() },
    });
  }
}

export async function openVpsInstanceMonitor(
  dialog: MatDialog,
  data: VpsInstanceMonitorData,
) {
  const binding = openCrudComponentDialog(dialog, VpsInstanceMonitorPage, 'crud-form-dialog', {
    data,
  });
  try {
    await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}
