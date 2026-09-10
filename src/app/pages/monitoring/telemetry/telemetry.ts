import { Component, computed, DestroyRef, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';

type Resource = { uuid: string; kind: string; name: string; observedAt: string | null };
type Point = {
  metricKey: string;
  label: string;
  unit: string;
  bucketEpoch: number;
  average: number;
  minimum: number;
  maximum: number;
  observedAt: string;
  samples: number;
};
type Envelope<T> = { data: { items: T[] } };
type Snapshot = { resources: Resource[]; points: Point[]; selected: Resource | undefined };

@Component({
  selector: 'mns-agent-telemetry',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    TranslocoPipe,
  ],
  templateUrl: './telemetry.html',
  styleUrl: './telemetry.scss',
})
export class AgentTelemetryPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly dialog = inject(MatDialogRef<AgentTelemetryPage>, { optional: true });
  readonly data = inject<{ uuid: string; name: string }>(MAT_DIALOG_DATA, { optional: true });
  readonly uuid = this.data?.uuid ?? this.route.snapshot.paramMap.get('uuid') ?? '';
  readonly name = this.data?.name ?? this.uuid;
  readonly hours = signal(1);
  readonly selectedUUID = signal('');
  readonly resourceSearch = signal('');
  readonly now = signal(Date.now());
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
        ? await this.api.get<Envelope<Point>>(
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
  readonly options = computed(() =>
    this.snapshot
      .value()
      .resources.filter((r) =>
        `${r.kind} ${r.name}`.toLowerCase().includes(this.resourceSearch().toLowerCase()),
      ),
  );
  readonly series = computed(() => {
    const groups = new Map<string, Map<string, Point[]>>();
    for (const point of this.snapshot.value().points) {
      const group = point.metricKey.startsWith('host.network.')
        ? point.metricKey.replace(/\.(rx|tx)_/, '.')
        : point.metricKey;
      if (!groups.has(group)) groups.set(group, new Map());
      const metrics = groups.get(group)!;
      metrics.set(point.metricKey, [...(metrics.get(point.metricKey) ?? []), point]);
    }
    const end = this.now() / 1000;
    const start = end - this.hours() * 3600;
    return [...groups].map(([key, metrics]) => {
      const points = [...metrics.values()].flat().sort((a, b) => a.bucketEpoch - b.bucketEpoch);
      const last = points.at(-1)!;
      const max = Math.max(...points.map((p) => p.maximum), last.unit === 'percent' ? 100 : 1);
      const lines = [...metrics].map(([metricKey, samples], index) => {
        let previous = -Infinity;
        const path = samples
          .map((point) => {
            const x = 8 + (584 * (point.bucketEpoch - start)) / (end - start);
            const y = 152 - (136 * point.average) / max;
            const command = point.bucketEpoch - previous > this.hours() * 45 ? 'M' : 'L';
            previous = point.bucketEpoch;
            return `${command}${Math.max(8, x)},${y}`;
          })
          .join(' ');
        const latest = samples.at(-1)!;
        return {
          metricKey,
          path,
          latest,
          color: index === 0 ? '#477ee8' : '#bd6200',
          x: Math.max(8, 8 + (584 * (latest.bucketEpoch - start)) / (end - start)),
          y: 152 - (136 * latest.average) / max,
        };
      });
      return {
        key,
        points,
        last,
        max,
        lines,
        start: new Date(start * 1000),
        end: new Date(end * 1000),
        stale: points.some(
          (p) =>
            p === metrics.get(p.metricKey)?.at(-1) &&
            this.now() - this.utc(p.observedAt).getTime() > 180000,
        ),
      };
    });
  });
  constructor() {
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      this.now.set(Date.now());
      if (!document.hidden && !this.snapshot.isLoading()) {
        failures = this.snapshot.error() ? Math.min(failures + 1, 3) : 0;
        this.snapshot.reload();
      }
      timer = setTimeout(refresh, 30000 * 2 ** failures);
    };
    timer = setTimeout(refresh, 30000);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
  display(value: number, unit: string) {
    const base = unit === 'bytes' ? 1024 : 1000;
    const labels =
      unit === 'bytes'
        ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
        : unit === 'bps'
          ? ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
          : [unit];
    let index = 0;
    while (value >= base && index < labels.length - 1) {
      value /= base;
      index++;
    }
    return (
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) +
      ' ' +
      labels[index]
    );
  }
  utc(value: string) {
    return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  }
  refresh() {
    this.now.set(Date.now());
    this.snapshot.reload();
  }
  fullPage() {
    const prefix = this.router.url.startsWith('/system') ? '/system' : '';
    this.dialog?.close();
    void this.router.navigateByUrl(`${prefix}/monitoring/agents/${this.uuid}/telemetry`);
  }
}
