import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AppI18nService } from '../../services/app-i18n.service';
import { ContextModeService } from '../../services/context-mode.service';
import { DateTimeFormatService } from '../../services/date-time-format.service';
import { SnackbarService } from '../../services/snackbar.service';
import {
  applyDashboardLayout,
  type DashboardLayout,
  openDashboardLayoutDialog,
} from '../../shared/dashboard/dashboard-layout-dialog';
import { DashboardPageComponent } from '../../shared/dashboard/dashboard-page';
import {
  DashboardRecordListComponent,
  type DashboardRecord,
} from '../../shared/dashboard/dashboard-record-list';
import { dashboardResource } from '../../shared/dashboard/dashboard-resource';
import { TrendChartComponent } from '../../shared/charts/trend-chart';

type OverviewScope = 'tenant' | 'platform';
type OverviewParams = Record<string, string | number | null>;

type OverviewKpi = {
  code: string;
  value: number | string | null;
  unit: 'count' | 'percent' | 'minutes' | 'usd' | 'money' | 'ms' | 'text';
  total?: number | null;
  previous?: number | null;
  currency?: string;
};

type OverviewAttention = {
  code: string;
  severity: 'critical' | 'warning';
  params: OverviewParams;
  link: string;
};

type OverviewRow = {
  name: string;
  detail: string;
  detailParams: OverviewParams;
  status: string;
  tone: 'critical' | 'warning' | 'ok' | 'neutral';
  amount?: number;
  currency?: string;
};

type OverviewChart = {
  code: string;
  kind: 'bars' | 'stacked' | 'line';
  unit: 'count' | 'money';
  currency?: string;
  series: Array<{ key: string; code: string }>;
  points: Array<{ day: string; values: Record<string, number> }>;
};

type OverviewTab = {
  key: string;
  state: 'ready' | 'empty' | 'unavailable';
  tone: 'critical' | 'warning' | 'ok' | 'idle';
  link: string;
  emptyLink: string;
  rowsTitle: string | null;
  kpis: OverviewKpi[];
  attention: OverviewAttention[];
  rows: OverviewRow[];
  chart?: OverviewChart | null;
  unavailableSections: string[];
};

type OverviewSnapshot = {
  scope: OverviewScope;
  generatedAt: string;
  attention: Array<OverviewAttention & { tab: string }>;
  tabs: OverviewTab[];
  /** The user's tab order and hidden tabs (GET user/dashboard-layouts/home.<scope>). */
  layout: DashboardLayout;
};

type ApiResponse<T> = { status: string; message: string; data: T; duration?: string };

type RouteTarget = { path: string; query: Record<string, string> };

/**
 * A display string: either final text or a translation key with params. Keys are translated by
 * the transloco pipe in the template, so they follow the translation load and language changes.
 */
export type HomeText = { text: string } | { key: string; params: Record<string, unknown> };

const DEFAULT_LAYOUT: DashboardLayout = { order: [], hidden: [] };

const EMPTY_OVERVIEW: OverviewSnapshot = {
  scope: 'tenant',
  generatedAt: new Date(0).toISOString(),
  attention: [],
  tabs: [],
  layout: DEFAULT_LAYOUT,
};

const ROW_TONE: Record<OverviewRow['tone'], DashboardRecord['tone']> = {
  critical: 'danger',
  warning: 'running',
  ok: 'success',
  neutral: 'skipped',
};

/** API links are App routes that may carry a query string (`/support/tickets?queue=due`). */
function routeTarget(link: string): RouteTarget {
  const [path, search = ''] = link.split('?');
  return { path: path || '/dashboard', query: Object.fromEntries(new URLSearchParams(search)) };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DashboardPageComponent,
    DashboardRecordListComponent,
    MatIconModule,
    MatTabsModule,
    RouterLink,
    TranslocoPipe,
    TrendChartComponent,
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly dates = inject(DateTimeFormatService);
  private readonly contextModes = inject(ContextModeService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private freshNext = false;

  /** Platform masters in System context see the platform view; everyone else the tenant view. */
  readonly scope = computed<OverviewScope>(() =>
    this.contextModes.effectiveMode() === 'master' ? 'platform' : 'tenant',
  );

  readonly overview = dashboardResource({
    defaultValue: EMPTY_OVERVIEW,
    params: () => this.scope(),
    loader: ({ params }) => this.load(params),
  });

  /** A snapshot of the other context is never shown while the current one loads. */
  readonly snapshot = computed(() => {
    const value = this.overview.value();
    return value.scope === this.scope() ? value : { ...EMPTY_OVERVIEW, scope: this.scope() };
  });
  readonly hasData = computed(
    () => this.overview.hasData() && this.overview.value().scope === this.scope(),
  );

  private readonly moduleParam = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('module'))),
    { initialValue: null },
  );

  /** Saved layout; a save updates it at once, the next load reads it back from the API. */
  readonly layout = linkedSignal(() => this.snapshot().layout);
  private readonly arranged = computed(() =>
    applyDashboardLayout(this.snapshot().tabs, this.layout()),
  );
  /** Visible tabs in the user's order. Hidden tabs keep their attention items on the home. */
  readonly tabs = computed(() => this.arranged().visible);
  readonly allHidden = computed(() => !this.tabs().length && this.snapshot().tabs.length > 0);
  readonly activeTab = computed(() => {
    const tabs = this.tabs();
    return tabs.find((tab) => tab.key === this.moduleParam()) ?? tabs[0] ?? null;
  });

  readonly attention = computed(() =>
    this.snapshot().attention.map((item) => ({ ...item, target: routeTarget(item.link) })),
  );

  readonly kpis = computed(() => {
    this.i18n.language();
    return (this.activeTab()?.kpis ?? []).map((kpi) => ({
      code: kpi.code,
      label: `home.kpi.${kpi.code}`,
      value: this.formatValue(kpi),
      hint: this.hint(kpi),
    }));
  });

  readonly rows = computed<DashboardRecord[]>(() =>
    (this.activeTab()?.rows ?? []).map((row, index) => ({
      id: `${index}:${row.name}`,
      name: row.name,
      meta: `home.row.${row.detail}`,
      translateMeta: true,
      metaParams: this.rowParams(row.detailParams),
      status: `home.row.${row.status}`,
      tone: ROW_TONE[row.tone],
      details:
        row.amount === undefined
          ? []
          : [{ label: 'home.row.amount', value: this.money(row.amount, row.currency) }],
    })),
  );

  /** The tab's 30-day trend, with labels as translation keys and values formatted by unit. */
  readonly chart = computed(() => {
    const chart = this.activeTab()?.chart;
    if (!chart || !chart.points.length) return null;
    this.i18n.language();
    return {
      title: `home.chart.${chart.code}`,
      kind: chart.kind,
      series: chart.series.map((item) => ({ key: item.key, label: `home.chart.${item.code}` })),
      points: chart.points,
      format:
        chart.unit === 'money'
          ? (value: number) => this.compactMoney(value, chart.currency)
          : (value: number) => this.compact(value),
    };
  });

  readonly language = computed(() => this.i18n.language());

  readonly emptyTarget = computed(() => routeTarget(this.activeTab()?.emptyLink ?? '/dashboard'));

  refresh() {
    this.freshNext = true;
    this.overview.reload();
  }

  async customize() {
    const scope = this.scope();
    const result = await openDashboardLayoutDialog(this.dialog, {
      tabs: this.arranged().ordered.map((tab) => ({ key: tab.key, label: `home.tab.${tab.key}` })),
      hidden: this.layout().hidden,
    });
    if (!result) return;
    const previous = this.layout();
    this.layout.set(result);
    try {
      const response = await this.api.put<ApiResponse<DashboardLayout>>(
        `user/dashboard-layouts/home.${scope}`,
        result,
      );
      if (this.scope() === scope && response?.data) this.layout.set(response.data);
    } catch {
      if (this.scope() === scope) this.layout.set(previous);
      this.snack.error('home.layout.save_failed');
    }
  }

  tabBadge(tab: OverviewTab): string {
    return tab.attention.length ? String(tab.attention.length) : '';
  }

  statusKey(tab: OverviewTab): string {
    if (tab.state !== 'ready') return `home.status.${tab.state}`;
    return `home.status.${tab.tone}`;
  }

  private async load(scope: OverviewScope): Promise<OverviewSnapshot> {
    const fresh = this.freshNext;
    this.freshNext = false;
    const endpoint = scope === 'platform' ? 'system/dashboard/overview' : 'dashboard/overview';
    const [response, layout] = await Promise.all([
      this.api.get<ApiResponse<Omit<OverviewSnapshot, 'layout'>>>(
        fresh ? `${endpoint}?fresh=1` : endpoint,
        { timeout: 30000 },
      ),
      // A missing layout never blocks the home: the default order applies.
      this.api
        .get<ApiResponse<DashboardLayout>>(`user/dashboard-layouts/home.${scope}`, {
          timeout: 10000,
        })
        .then((result) => result?.data ?? DEFAULT_LAYOUT)
        .catch(() => DEFAULT_LAYOUT),
    ]);
    return response.data ? { ...response.data, layout } : { ...EMPTY_OVERVIEW, scope };
  }

  private number(value: number, digits = 0): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      maximumFractionDigits: digits,
    }).format(value);
  }

  private compact(value: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  private compactMoney(value: number, currency = 'BRL'): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: currency || 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  private money(value: number, currency = 'BRL'): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  }

  private formatValue(kpi: OverviewKpi): HomeText {
    if (kpi.value === null || kpi.value === undefined || kpi.value === '') return { text: '—' };
    if (kpi.unit === 'text') return { text: String(kpi.value) };
    const value = Number(kpi.value);
    if (!Number.isFinite(value)) return { text: '—' };
    switch (kpi.unit) {
      case 'percent':
        return { text: `${this.number(value, 1)}%` };
      case 'minutes':
        return value >= 60
          ? {
              key: 'home.unit.hours_minutes',
              params: { hours: Math.floor(value / 60), minutes: value % 60 },
            }
          : { key: 'home.unit.minutes', params: { minutes: value } };
      case 'usd':
        return { text: this.money(value, 'USD') };
      case 'money':
        return { text: this.money(value, kpi.currency) };
      case 'ms':
        return {
          text: value >= 1000 ? `${this.number(value / 1000, 1)} s` : `${this.number(value)} ms`,
        };
      default:
        return {
          text:
            kpi.total !== null && kpi.total !== undefined
              ? `${this.number(value)} / ${this.number(kpi.total)}`
              : this.number(value),
        };
    }
  }

  private hint(kpi: OverviewKpi): HomeText | null {
    if (kpi.previous === null || kpi.previous === undefined || kpi.value === null) return null;
    const delta = Number(kpi.value) - kpi.previous;
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
    const window = kpi.code.endsWith('_30d')
      ? 'previous_30d'
      : kpi.code.endsWith('_month')
        ? 'previous_month'
        : 'yesterday';
    const magnitude =
      kpi.unit === 'money'
        ? this.money(Math.abs(delta), kpi.currency)
        : this.number(Math.abs(delta));
    return { key: `home.compare.${window}`, params: { delta: `${sign}${magnitude}` } };
  }

  private rowParams(params: OverviewParams): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      result[key] =
        value === null || value === ''
          ? '—'
          : key === 'at' || key.endsWith('At')
            ? this.dates.formatDateTime(String(value), 'short', 'short')
            : value;
    }
    return result;
  }
}
