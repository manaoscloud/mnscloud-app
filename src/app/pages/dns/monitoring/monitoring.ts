import { NgClass } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
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

type MonitorState = 'healthy' | 'degraded' | 'down' | 'unknown';

type MonitorLatest = {
  agentName: string;
  outcome: string;
  latencyMs: number | null;
  httpCode: number | null;
  asn: number | null;
  measuredAt: string;
};

type MonitorPoint = {
  bucket: string;
  total: number;
  okCount: number;
  avgLatencyMs: number | null;
};

type MonitorTarget = {
  DmtUUID: string;
  DmtName: string;
  DmtKind: 'service' | 'resolver';
  DmtTarget: string;
  DmtQueryName: string | null;
  DmtQueryType: string | null;
  state: MonitorState;
  availability: number | null;
  avgLatencyMs: number | null;
  hourAvailability: number | null;
  hourLatencyMs: number | null;
  latest: MonitorLatest[];
  series: MonitorPoint[];
};

type MonitorPanel = {
  hours: number;
  bucketMinutes: number;
  totals: Record<MonitorState, number>;
  targets: MonitorTarget[];
};

const TONES: Record<MonitorState, DashboardRecord['tone']> = {
  healthy: 'success',
  degraded: 'running',
  down: 'danger',
  unknown: 'skipped',
};
const KPI_STATES: Record<MonitorState, string> = {
  healthy: 'good',
  degraded: 'warn',
  down: 'bad',
  unknown: 'neutral',
};
const KPI_ICONS: Record<MonitorState, string> = {
  healthy: 'check_circle',
  degraded: 'warning',
  down: 'error',
  unknown: 'help',
};
const SUCCESS = new Set(['ok', 'ipv6_failure']);
const percent = (value: number | null) => (value == null ? '—' : `${value}%`);
const milliseconds = (value: number | null) => (value == null ? '—' : `${value} ms`);

/** Panel record of one target: state chip, availability, latency and the Agents failing now. */
export function monitorRecord(target: MonitorTarget): DashboardRecord {
  const failing = target.latest.filter((sample) => !SUCCESS.has(sample.outcome));
  return {
    id: target.DmtUUID,
    name: target.DmtName,
    meta:
      target.DmtKind === 'resolver'
        ? `${target.DmtTarget} · ${target.DmtQueryType} ${target.DmtQueryName}`
        : target.DmtTarget,
    status: `dns.monitorStates.${target.state}`,
    tone: TONES[target.state],
    details: [
      { label: 'dns.monitorAvailability', value: percent(target.availability) },
      { label: 'dns.monitorLatency', value: milliseconds(target.avgLatencyMs) },
      { label: 'dns.monitorHourAvailability', value: percent(target.hourAvailability) },
      { label: 'dns.monitorHourLatency', value: milliseconds(target.hourLatencyMs) },
      {
        label: 'dns.monitorFailingNow',
        value: failing.length
          ? failing.map((sample) => `${sample.agentName} (${sample.outcome})`).join(', ')
          : '—',
      },
    ],
  };
}

/** Sums the buckets of several targets: successes and failures per bucket, mean latency. */
export function monitorPoints(targets: MonitorTarget[], latency: boolean): TrendPoint[] {
  const buckets = new Map<string, { ok: number; fail: number; latency: number[] }>();
  for (const target of targets) {
    for (const point of target.series) {
      const entry = buckets.get(point.bucket) ?? { ok: 0, fail: 0, latency: [] };
      entry.ok += point.okCount;
      entry.fail += point.total - point.okCount;
      if (point.avgLatencyMs != null) entry.latency.push(point.avgLatencyMs);
      buckets.set(point.bucket, entry);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, entry]): TrendPoint => ({
      day: bucket.slice(5, 16).replace('-', '/'),
      values: latency
        ? {
            latency: entry.latency.length
              ? Math.round(
                  entry.latency.reduce((sum, value) => sum + value, 0) / entry.latency.length,
                )
              : 0,
          }
        : { ok: entry.ok, fail: entry.fail },
    }));
}

@Component({
  selector: 'app-dns-monitoring',
  standalone: true,
  imports: [
    DashboardPageComponent,
    DashboardRecordListComponent,
    TrendChartComponent,
    TranslocoPipe,
    MatIconModule,
    NgClass,
    RouterModule,
  ],
  templateUrl: './monitoring.html',
})
export class DnsMonitoringPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  readonly language = computed(() => this.i18n.language());
  readonly panel = dashboardResource({
    defaultValue: null as MonitorPanel | null,
    loader: async () => {
      const response = await this.api.get<{ data: MonitorPanel }>(
        'system/dns/monitor/panel?hours=24',
        { timeout: 30000 },
      );
      return response.data;
    },
  });
  readonly targets = computed(() => this.panel.value()?.targets ?? []);
  readonly kpis = computed(() => {
    const totals = this.panel.value()?.totals;
    return (['healthy', 'degraded', 'down', 'unknown'] as const).map((state) => ({
      state,
      label: `dns.monitorStates.${state}`,
      icon: KPI_ICONS[state],
      className: `state-${KPI_STATES[state]}`,
      value: totals ? totals[state] : null,
    }));
  });
  readonly services = computed(() =>
    this.targets()
      .filter((target) => target.DmtKind === 'service')
      .map(monitorRecord),
  );
  readonly resolvers = computed(() =>
    this.targets()
      .filter((target) => target.DmtKind === 'resolver')
      .map(monitorRecord),
  );
  readonly availabilityPoints = computed(() => monitorPoints(this.targets(), false));
  readonly resolverLatencyPoints = computed(() =>
    monitorPoints(
      this.targets().filter((target) => target.DmtKind === 'resolver'),
      true,
    ),
  );
  readonly availabilitySeries = [
    { key: 'ok', label: 'dns.monitorSamplesOk' },
    { key: 'fail', label: 'dns.monitorSamplesFailed' },
  ];
  readonly latencySeries = [{ key: 'latency', label: 'dns.monitorResolverLatency' }];
  readonly formatMs = (value: number) => `${Math.round(value)} ms`;
}
