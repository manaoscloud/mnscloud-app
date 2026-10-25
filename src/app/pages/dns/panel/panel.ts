import { NgClass } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { TrendChartComponent, TrendPoint } from '../../../shared/charts/trend-chart';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import {
  DashboardRecord,
  DashboardRecordListComponent,
} from '../../../shared/dashboard/dashboard-record-list';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';

type PanelPoint = {
  bucket: string;
  queries: number;
  qps: number | null;
  cacheHitRatio: number | null;
  servfail: number;
  aclDrops: number;
  dynBlocked: number;
  latencyMs: number | null;
};

type PanelServer = {
  DsvUUID: string;
  DsvName: string;
  ClusterName: string;
  DsvNodeAddress: string | null;
  serviceEnabled: boolean;
  reporting: boolean;
  lastReportAt: string | null;
  latencyMs: number | null;
  uptime: number | null;
  queries: number;
  servfail: number;
  aclDrops: number;
  dynBlocked: number;
  series: PanelPoint[];
};

type Panel = { hours: number; bucketMinutes: number; servers: PanelServer[] };

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const fixed = (value: number | null, digits: number, unit = '') =>
  value == null ? '—' : `${value.toFixed(digits)}${unit}`;

/** Server row: reporting state, address, service, latency and the window totals. */
export function panelServerRecord(server: PanelServer): DashboardRecord {
  return {
    id: server.DsvUUID,
    name: server.DsvName,
    meta: [server.ClusterName, server.DsvNodeAddress].filter(Boolean).join(' · '),
    status: server.reporting ? 'dns.panelReporting' : 'dns.panelSilent',
    tone: server.reporting ? 'success' : 'danger',
    details: [
      {
        label: 'dns.panelService',
        value: server.serviceEnabled ? 'dns.panelServiceOn' : 'dns.panelServiceOff',
        translate: true,
      },
      { label: 'dns.panelQueries', value: String(server.queries) },
      { label: 'dns.panelLatency', value: fixed(server.latencyMs, 2, ' ms') },
      { label: 'dns.panelServfail', value: String(server.servfail) },
      { label: 'dns.panelBlocked', value: String(server.aclDrops + server.dynBlocked) },
      { label: 'dns.panelLastReport', value: server.lastReportAt ?? '—', format: 'datetime' },
    ],
  };
}

/** Buckets of every server summed: queries (or mean latency) per bucket, chronological. */
export function panelTrend(servers: PanelServer[], metric: 'queries' | 'latency'): TrendPoint[] {
  const buckets = new Map<string, { queries: number; latency: number[] }>();
  for (const server of servers) {
    for (const point of server.series) {
      const entry = buckets.get(point.bucket) ?? { queries: 0, latency: [] };
      entry.queries += point.queries;
      if (point.latencyMs != null) entry.latency.push(point.latencyMs);
      buckets.set(point.bucket, entry);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, entry]): TrendPoint => ({
      day: bucket.slice(5, 16).replace('-', '/'),
      values:
        metric === 'queries'
          ? { queries: entry.queries }
          : { latency: Math.round((mean(entry.latency) ?? 0) * 100) / 100 },
    }));
}

@Component({
  selector: 'app-dns-panel',
  standalone: true,
  imports: [
    DashboardPageComponent,
    DashboardRecordListComponent,
    TrendChartComponent,
    TranslocoPipe,
    MatIconModule,
    NgClass,
  ],
  templateUrl: './panel.html',
})
export class DnsPanelPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  readonly language = computed(() => this.i18n.language());
  readonly panel = dashboardResource({
    defaultValue: null as Panel | null,
    loader: async () =>
      (await this.api.get<{ data: Panel }>('system/dns/panel?hours=24', { timeout: 30000 })).data,
  });
  readonly servers = computed(() => this.panel.value()?.servers ?? []);
  readonly records = computed(() => this.servers().map(panelServerRecord));
  readonly kpis = computed(() => {
    const servers = this.servers();
    const latest = servers
      .map((server) => server.series[server.series.length - 1])
      .filter((point): point is PanelPoint => Boolean(point));
    const qps = latest.reduce((sum, point) => sum + (point.qps ?? 0), 0);
    const ratio = mean(
      latest.flatMap((point) => (point.cacheHitRatio == null ? [] : [point.cacheHitRatio])),
    );
    const latency = mean(
      servers.flatMap((server) => (server.latencyMs == null ? [] : [server.latencyMs])),
    );
    const reporting = servers.filter((server) => server.reporting).length;
    return [
      {
        key: 'servers',
        icon: 'dns',
        label: 'dns.panelServers',
        value: servers.length ? `${reporting}/${servers.length}` : '—',
        state: servers.length && reporting < servers.length ? 'state-bad' : 'state-good',
      },
      {
        key: 'qps',
        icon: 'speed',
        label: 'dns.panelQps',
        value: latest.length ? qps.toFixed(1) : '—',
        state: 'state-neutral',
      },
      {
        key: 'cache',
        icon: 'cached',
        label: 'dns.panelCache',
        value: fixed(ratio, 1, '%'),
        state: 'state-neutral',
      },
      {
        key: 'latency',
        icon: 'timer',
        label: 'dns.panelLatency',
        value: fixed(latency, 2, ' ms'),
        state: 'state-neutral',
      },
    ];
  });
  readonly queryPoints = computed(() => panelTrend(this.servers(), 'queries'));
  readonly latencyPoints = computed(() => panelTrend(this.servers(), 'latency'));
  readonly querySeries = [{ key: 'queries', label: 'dns.panelQueries' }];
  readonly latencySeries = [{ key: 'latency', label: 'dns.panelLatency' }];
  readonly formatMs = (value: number) => `${value.toFixed(2)} ms`;
}
