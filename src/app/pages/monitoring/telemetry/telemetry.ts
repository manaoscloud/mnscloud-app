import { Component, computed, DestroyRef, effect, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { MetricsMonitorComponent } from '../../../shared/monitoring/metrics-monitor/metrics-monitor';
import {
  MetricsMonitorPoint,
  MetricsMonitorResourceOption,
} from '../../../shared/monitoring/metrics-monitor/metrics-monitor.types';
import { AppI18nService } from '../../../services/app-i18n.service';
import { BreadcrumbLabelsService } from '../../../shared/breadcrumb/breadcrumb-labels.service';
import { ApiService } from '../../../services/api.service';

type Resource = { uuid: string; kind: string; name: string; observedAt: string | null };
type Envelope<T> = { data: { items: T[] } };
type Snapshot = {
  resources: Resource[];
  points: MetricsMonitorPoint[];
  selected: Resource | undefined;
};

@Component({
  selector: 'mns-agent-telemetry',
  standalone: true,
  imports: [MetricsMonitorComponent],
  template: `
    <mns-metrics-monitor
      title="Agent monitoring"
      [identity]="name()"
      [recordId]="uuid"
      [dialogMode]="!!dialog"
      [showResourceFilter]="true"
      [resourceOptions]="options()"
      [(hours)]="hours"
      [(selectedResource)]="selectedUUID"
      [points]="view().points"
      [loading]="snapshot.isLoading()"
      [error]="!!snapshot.error()"
      (refresh)="refresh()"
      (fullPage)="fullPage()"
      (closeRequest)="dialog?.close()"
    />
  `,
})
export class AgentTelemetryPage {
  private readonly api = inject(ApiService);
  private readonly breadcrumbLabels = inject(BreadcrumbLabelsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly dialog = inject(MatDialogRef<AgentTelemetryPage>, { optional: true });
  readonly data = inject<{ uuid: string; name: string }>(MAT_DIALOG_DATA, { optional: true });
  readonly uuid = this.data?.uuid ?? this.route.snapshot.paramMap.get('uuid') ?? '';
  readonly name = computed(
    () => this.data?.name || this.view().resources.find((r) => r.kind === 'host')?.name || '',
  );
  private readonly i18n = inject(AppI18nService);
  private readonly translate = inject(TranslocoService);
  readonly hours = signal(
    [1, 24, 168].includes(Number(this.route.snapshot.queryParamMap.get('hours')))
      ? Number(this.route.snapshot.queryParamMap.get('hours'))
      : 1,
  );
  readonly selectedUUID = signal(this.route.snapshot.queryParamMap.get('resource') ?? '');
  readonly snapshot = resource<Snapshot, { uuid: string; selected: string; hours: number }>({
    defaultValue: { resources: [], points: [], selected: undefined },
    params: () => ({ uuid: this.uuid, selected: this.selectedUUID(), hours: this.hours() }),
    loader: async ({ params }) => {
      const response = await this.api.get<Envelope<Resource>>(
        `monitoring/agents/${params.uuid}/resources`,
      );
      const resources = response.data.items;
      const selected =
        resources.find((r) => r.uuid === params.selected) ??
        resources.find((r) => r.kind === 'host') ??
        resources[0];
      const history = selected
        ? await this.api.get<Envelope<MetricsMonitorPoint>>(
            `monitoring/agents/${params.uuid}/resources?resource=${selected.uuid}&hours=${params.hours}`,
          )
        : undefined;
      const points = (history?.data.items ?? []).map((p) => ({
        ...p,
        bucketEpoch: Number(p.bucketEpoch),
        average: Number(p.average),
        minimum: Number(p.minimum),
        maximum: Number(p.maximum),
        samples: Number(p.samples),
      }));
      return { resources, selected, points };
    },
  });
  readonly view = computed<Snapshot>(() =>
    this.snapshot.hasValue()
      ? this.snapshot.value()
      : { resources: [], points: [], selected: undefined },
  );
  readonly options = computed<MetricsMonitorResourceOption[]>(() =>
    this.view().resources.map((r) => ({
      value: r.uuid,
      label: r.name,
      description: (this.i18n.language(), this.translate.translate(this.kindLabel(r.kind))),
      searchText: r.kind + ' ' + r.name,
    })),
  );

  constructor() {
    effect((onCleanup) => {
      if (this.dialog) return;
      const name = this.name().trim();
      if (!name) return;
      const prefix = this.router.url.startsWith('/system') ? '/system' : '';
      onCleanup(this.breadcrumbLabels.register(`${prefix}/monitoring/agents/${this.uuid}`, name));
    });
    effect(() => {
      const selected = this.view().selected?.uuid;
      if (selected && this.selectedUUID() !== selected && !this.selectedUUID()) {
        this.selectedUUID.set(selected);
      }
    });
    inject(DestroyRef);
  }

  kindLabel(kind: string) {
    return kind === 'host.network'
      ? 'Network interface'
      : kind === 'host.filesystem'
        ? 'Filesystem'
        : 'Host';
  }

  refresh() {
    this.snapshot.reload();
  }

  fullPage() {
    const prefix = this.router.url.startsWith('/system') ? '/system' : '';
    this.dialog?.close();
    void this.router.navigate([`${prefix}/monitoring/agents/${this.uuid}/telemetry`], {
      queryParams: { resource: this.view().selected?.uuid, hours: this.hours() },
    });
  }
}

/** Read-only charts use the generic operation-dialog viewport, surface and cleanup. */
export async function openAgentTelemetry(dialog: MatDialog, data: { uuid: string; name?: string }) {
  const binding = openCrudComponentDialog(dialog, AgentTelemetryPage, 'crud-form-dialog', { data });
  try {
    await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}
