import { Component, computed, DestroyRef, inject, resource, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';
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
// Read-only paginated dashboard: no create/delete or local filters over an incomplete fleet.
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
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
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
  readonly columns = ['name', 'status', 'cpu', 'memory', 'disk', 'network', 'heartbeat', 'actions'];
  readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });
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
  readonly rows = computed(() => {
    const { active, direction } = this.sort();
    return [...this.view().items].sort((a, b) => {
      const x = this.sortValue(a, active),
        y = this.sortValue(b, active);
      const result =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return direction === 'desc' ? -result : direction === 'asc' ? result : 0;
    });
  });
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
  private sortValue(agent: Agent, field: string): string | number {
    if (field === 'status') return this.stale(agent.heartbeat) ? 0 : 1;
    if (field === 'network') return agent.receiveBps ?? -1;
    if (field === 'name') return agent.name || agent.hostname || '';
    return agent[field as keyof Agent] ?? -1;
  }
  utc(value: string) {
    return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  }
  stale(value: string | null) {
    return !value || this.now() - this.utc(value).getTime() > 180000;
  }
  monitor(agent: Agent) {
    void openAgentTelemetry(this.dialog, { uuid: agent.uuid, name: agent.name || agent.hostname });
  }
}
