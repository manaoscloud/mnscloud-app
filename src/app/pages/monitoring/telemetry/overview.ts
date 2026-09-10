import { Component, computed, DestroyRef, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule } from '@angular/material/paginator';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { AgentTelemetryPage } from './telemetry';

type Agent = {
  uuid: string;
  name: string;
  hostname: string;
  heartbeat: string | null;
  observedAt: string | null;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  receiveBps: number | null;
  transmitBps: number | null;
};
@Component({
  selector: 'mns-telemetry-overview',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatPaginatorModule, TranslocoPipe],
  styleUrl: './telemetry.scss',
  template: `<section class="telemetry-panel">
    <header>
      <div>
        <h2>{{ 'Metrics overview' | transloco }}</h2>
        <p>{{ 'Host and interface observations' | transloco }}</p>
      </div>
      <button mat-stroked-button (click)="page.reload()" [disabled]="page.isLoading()">
        {{ 'Refresh' | transloco }}
      </button>
    </header>
    @if (page.error()) {
      <p role="alert">{{ 'Unable to load monitoring data' | transloco }}</p>
    } @else if (page.isLoading()) {
      <p role="status">{{ 'Loading' | transloco }}…</p>
    } @else {
      <div class="charts">
        @for (a of view().items; track a.uuid) {
          <article>
            <h3>{{ a.name || a.hostname }}</h3>
            <p>
              {{
                (stale(a.heartbeat) ? 'Offline or stale heartbeat' : 'Recent heartbeat') | transloco
              }}
            </p>
            <p>
              {{ 'Heartbeat' | transloco }}:
              {{ a.heartbeat ? (utc(a.heartbeat) | date: 'short') : ('No data' | transloco) }}
            </p>
            <p>{{ (stale(a.observedAt) ? 'Stale data' : 'Latest observation') | transloco }}</p>
            @for (field of fields; track field.key) {
              <div class="overview-meter">
                <span>{{ field.label | transloco }}</span>
                @if (a[field.key] !== null) {
                  <strong>{{ a[field.key] | number: '1.0-1' }}%</strong
                  ><meter
                    min="0"
                    max="100"
                    [value]="a[field.key]"
                    [attr.aria-label]="field.label | transloco"
                  ></meter>
                } @else {
                  <span>{{ 'No data' | transloco }}</span>
                }
              </div>
            }
            <p>
              {{ 'Interface traffic' | transloco }}: ↓
              {{ a.receiveBps === null ? '—' : (a.receiveBps / 1000000 | number: '1.0-2') }} / ↑
              {{ a.transmitBps === null ? '—' : (a.transmitBps / 1000000 | number: '1.0-2') }} Mbps
            </p>
            <button mat-flat-button (click)="monitor(a)">{{ 'Monitor' | transloco }}</button>
          </article>
        } @empty {
          <p>{{ 'No monitoring samples available' | transloco }}</p>
        }
      </div>
    }
    <mat-paginator
      [length]="view().total"
      [pageSize]="12"
      [pageIndex]="index()"
      (page)="index.set($event.pageIndex)"
      [attr.aria-label]="'Agents' | transloco"
    ></mat-paginator>
  </section>`,
})
export class TelemetryOverviewPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  readonly index = signal(0);
  readonly now = signal(Date.now());
  readonly fields: { key: 'cpu' | 'memory' | 'disk'; label: string }[] = [
    { key: 'cpu', label: 'CPU' },
    { key: 'memory', label: 'Memory' },
    { key: 'disk', label: 'System disk' },
  ];
  readonly page = resource({
    defaultValue: { items: [] as Agent[], total: 0 },
    params: () => this.index(),
    loader: async ({ params }) => {
      const response = await this.api.get<{ data: { items: Agent[]; total: number } }>(
        `monitoring/agents/telemetry-overview?limit=12&offset=${params * 12}`,
      );
      return response.data;
    },
  });
  readonly view = computed(() =>
    this.page.hasValue() ? this.page.value() : { items: [] as Agent[], total: 0 },
  );
  constructor() {
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      this.now.set(Date.now());
      if (!document.hidden && !this.page.isLoading()) {
        failures = this.page.error() ? Math.min(failures + 1, 3) : 0;
        this.page.reload();
      }
      timer = setTimeout(tick, 30000 * 2 ** failures);
    };
    timer = setTimeout(tick, 30000);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
  utc(value: string) {
    return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  }
  stale(value: string | null) {
    return !value || this.now() - this.utc(value).getTime() > 180000;
  }
  monitor(agent: Agent) {
    this.dialog.open(AgentTelemetryPage, {
      data: { uuid: agent.uuid, name: agent.name || agent.hostname },
      width: '1200px',
      maxWidth: '96vw',
      height: '90vh',
      maxHeight: '94dvh',
    });
  }
}
