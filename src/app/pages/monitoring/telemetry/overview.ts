import { Component, computed, DestroyRef, inject, resource, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';
import { DateTimeFormatService } from '../../../services/date-time-format.service';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';
import { openAgentTelemetry } from './telemetry';

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
type DisplayMode = 'cards' | 'list' | 'compact';
// Read-only paginated analysis surface (app.md Read-only metrics dashboards): Cards/List/Compact
// share the server pagination; List mode is the read-only global table over the current page.
@Component({
  selector: 'mns-telemetry-overview',
  standalone: true,
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatPaginatorModule,
    GlobalTableComponent,
    TranslocoPipe,
    RefreshButtonComponent,
    MnsDateTimePipe,
  ],
  styleUrl: './telemetry.scss',
  templateUrl: './overview.html',
})
export class TelemetryOverviewPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  readonly index = signal(0);
  readonly pageSize = signal(12);
  readonly now = signal(Date.now());
  readonly mode = signal<DisplayMode>(this.savedMode());
  readonly modes = [
    { value: 'cards' as const, label: 'Cards', icon: 'view_module' },
    { value: 'list' as const, label: 'List', icon: 'view_list' },
    { value: 'compact' as const, label: 'Compact', icon: 'apps' },
  ];
  readonly fields: { key: 'cpu' | 'memory' | 'disk'; label: string }[] = [
    { key: 'cpu', label: 'CPU' },
    { key: 'memory', label: 'Memory' },
    { key: 'disk', label: 'System disk' },
  ];
  private readonly dateTime = inject(DateTimeFormatService);
  /** List mode: the current server page, sorted locally ("Sort the current page"). */
  readonly listTable = defineGlobalTable({
    key: 'monitoring/telemetry/agents',
    uuidField: 'uuid',
    emptyLabel: 'No monitoring samples available',
    pagination: false,
    columns: [
      {
        id: 'name',
        label: 'Agent',
        field: 'name',
        kind: 'identity',
        uuidField: 'uuid',
        value: (row) => String(row['name'] || row['hostname'] || ''),
      },
      {
        id: 'status',
        label: 'Status',
        field: 'heartbeat',
        kind: 'status',
        value: (row) => (this.stale(row['heartbeat'] as string | null) ? 'Offline' : 'Online'),
        chipClass: (value) =>
          this.stale(value as string | null)
            ? 'chip-skipped is-inactive'
            : 'chip-success is-active',
      },
      ...this.fields.map((field) => ({
        id: field.key,
        label: field.label,
        field: field.key,
        value: (row: Record<string, unknown>) => this.percent(row[field.key]),
      })),
      {
        id: 'network',
        label: 'Interface traffic',
        field: 'receiveBps',
        value: (row) => this.traffic(row as Agent),
      },
      {
        id: 'heartbeat',
        label: 'Heartbeat',
        field: 'heartbeat',
        value: (row, t) =>
          row['heartbeat']
            ? this.dateTime.formatDateTime(this.utc(String(row['heartbeat'])))
            : t('No data'),
      },
    ],
    rowActions: [
      {
        key: 'monitor',
        label: 'Monitor',
        icon: 'show_chart',
        run: (row) => this.monitor(row as unknown as Agent),
      },
    ],
  });
  readonly page = resource({
    defaultValue: { items: [] as Agent[], total: 0 },
    params: () => ({ index: this.index(), size: this.pageSize() }),
    loader: async ({ params }) => {
      const response = await this.api.get<{ data: { items: Agent[]; total: number } }>(
        `monitoring/agents/telemetry-overview?limit=${params.size}&offset=${params.index * params.size}`,
      );
      return response.data;
    },
  });
  readonly view = computed(() =>
    this.page.hasValue() ? this.page.value() : { items: [] as Agent[], total: 0 },
  );
  readonly rows = computed(() => this.view().items);
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
  private savedMode(): DisplayMode {
    try {
      const value = localStorage.getItem('mnscloud_metrics_view');
      return value === 'list' || value === 'compact' ? value : 'cards';
    } catch {
      return 'cards';
    }
  }
  setMode(mode: DisplayMode) {
    this.mode.set(mode);
    try {
      localStorage.setItem('mnscloud_metrics_view', mode);
    } catch {
      /* Optional display preference. */
    }
  }
  setPage(event: PageEvent) {
    this.pageSize.set(event.pageSize);
    this.index.set(event.pageIndex);
  }
  private percent(value: unknown): string {
    return value === null || value === undefined
      ? '—'
      : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }
  private traffic(agent: Agent): string {
    const mbps = (value: number | null) =>
      value === null
        ? '—'
        : (value / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `↓ ${mbps(agent.receiveBps)} / ↑ ${mbps(agent.transmitBps)} Mbps`;
  }
  utc(value: string) {
    return new Date(/(?:[zZ]|[+-]\d\d:\d\d)$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  }
  stale(value: string | null) {
    return !value || this.now() - this.utc(value).getTime() > 180000;
  }
  monitor(agent: Agent) {
    void openAgentTelemetry(this.dialog, { uuid: agent.uuid, name: agent.name || agent.hostname });
  }
}
