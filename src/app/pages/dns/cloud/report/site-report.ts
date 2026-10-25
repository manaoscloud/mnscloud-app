import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../../services/api.service';
import { AppI18nService } from '../../../../services/app-i18n.service';
import { TrendChartComponent, TrendPoint } from '../../../../shared/charts/trend-chart';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';

const CATEGORY_KEYS = [
  ['blockedOwn', 'dns.cloudReportOwn'],
  ['blockedThreats', 'dns.filterCategoryThreats'],
  ['blockedGambling', 'dns.filterCategoryGambling'],
  ['blockedAdult', 'dns.filterCategoryAdult'],
  ['blockedSocial', 'dns.filterCategorySocial'],
  ['blockedFakenews', 'dns.filterCategoryFakenews'],
] as const;

type Counts = Record<(typeof CATEGORY_KEYS)[number][0] | 'queries' | 'safeSearch', number>;
type ReportPoint = Counts & { hour: string };
type Report = { hours: number; totals: Counts & { blocked: number }; series: ReportPoint[] };
type Site = { DcsName?: string; DcsAddresses?: string };

const blockedOf = (point: Counts) =>
  CATEGORY_KEYS.reduce((sum, [key]) => sum + (Number(point[key]) || 0), 0);

/** Hourly points (server clock) summed per day: allowed (queries minus blocks) and blocked, chronological. */
export function siteReportDays(series: ReportPoint[]): TrendPoint[] {
  const days = new Map<string, { allowed: number; blocked: number }>();
  for (const point of series) {
    const day = point.hour.slice(0, 10);
    const entry = days.get(day) ?? { allowed: 0, blocked: 0 };
    const blocked = blockedOf(point);
    entry.blocked += blocked;
    entry.allowed += Math.max(0, (Number(point.queries) || 0) - blocked);
    days.set(day, entry);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({ day, values }));
}

/** Cloud site report (D3a): queries and blocks of one office in the last 30 days, counts only. */
@Component({
  selector: 'app-dns-cloud-site-report',
  standalone: true,
  imports: [DashboardPageComponent, TrendChartComponent, TranslocoPipe, MatIconModule],
  templateUrl: './site-report.html',
})
export class DnsCloudSiteReportPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly uuid = inject(ActivatedRoute).snapshot.paramMap.get('uuid') ?? '';
  readonly language = computed(() => this.i18n.language());
  readonly report = dashboardResource({
    defaultValue: null as { site: Site; report: Report } | null,
    loader: async () => {
      const [site, report] = await Promise.all([
        this.api.get<{ data: Site }>(`dns/cloud/sites/${this.uuid}`, { timeout: 30000 }),
        this.api.get<{ data: Report }>(`dns/cloud/sites/${this.uuid}/report?hours=720`, {
          timeout: 30000,
        }),
      ]);
      return { site: site.data ?? {}, report: report.data };
    },
  });
  readonly site = computed(() => this.report.value()?.site ?? {});
  readonly hasTraffic = computed(() => (this.report.value()?.report.totals.queries ?? 0) > 0);
  readonly kpis = computed(() => {
    const report = this.report.value()?.report;
    const totals = report?.totals;
    const last = (report?.series ?? []).slice(-24);
    const ratio = totals?.queries ? (totals.blocked / totals.queries) * 100 : null;
    return [
      {
        key: 'queries',
        icon: 'travel_explore',
        label: 'dns.cloudReportQueries',
        value: totals?.queries,
        hint: null,
      },
      {
        key: 'blocked',
        icon: 'block',
        label: 'dns.cloudReportBlocked',
        value: totals?.blocked,
        hint: ratio == null ? null : `${ratio.toFixed(1)}%`,
      },
      {
        key: 'recent',
        icon: 'schedule',
        label: 'dns.cloudReportBlocked24h',
        value: report ? last.reduce((sum, point) => sum + blockedOf(point), 0) : undefined,
        hint: null,
      },
      {
        key: 'safeSearch',
        icon: 'shield',
        label: 'dns.cloudReportSafeSearch',
        value: totals?.safeSearch,
        hint: null,
      },
    ];
  });
  readonly categories = computed(() => {
    const totals = this.report.value()?.report.totals;
    return CATEGORY_KEYS.map(([key, label]) => ({ key, label, value: totals?.[key] }));
  });
  readonly days = computed(() => siteReportDays(this.report.value()?.report.series ?? []));
  readonly daySeries = [
    { key: 'allowed', label: 'dns.cloudReportAllowed' },
    { key: 'blocked', label: 'dns.cloudReportBlocked' },
  ];
}
