import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AppI18nService } from '../../services/app-i18n.service';
import { ContextModeService } from '../../services/context-mode.service';
import { DateTimeFormatService } from '../../services/date-time-format.service';
import { DashboardPageComponent } from '../../shared/dashboard/dashboard-page';
import {
  DashboardRecordListComponent,
  type DashboardRecord,
} from '../../shared/dashboard/dashboard-record-list';
import { dashboardResource } from '../../shared/dashboard/dashboard-resource';

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
  unavailableSections: string[];
};

type OverviewSnapshot = {
  scope: OverviewScope;
  generatedAt: string;
  attention: Array<OverviewAttention & { tab: string }>;
  tabs: OverviewTab[];
};

type ApiResponse<T> = { status: string; message: string; data: T; duration?: string };

type RouteTarget = { path: string; query: Record<string, string> };

const EMPTY_OVERVIEW: OverviewSnapshot = {
  scope: 'tenant',
  generatedAt: new Date(0).toISOString(),
  attention: [],
  tabs: [],
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
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly dates = inject(DateTimeFormatService);
  private readonly contextModes = inject(ContextModeService);
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

  readonly tabs = computed(() => this.snapshot().tabs);
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

  readonly emptyTarget = computed(() => routeTarget(this.activeTab()?.emptyLink ?? '/dashboard'));

  refresh() {
    this.freshNext = true;
    this.overview.reload();
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
    const response = await this.api.get<ApiResponse<OverviewSnapshot>>(
      fresh ? `${endpoint}?fresh=1` : endpoint,
      { timeout: 30000 },
    );
    return response.data ?? { ...EMPTY_OVERVIEW, scope };
  }

  private number(value: number, digits = 0): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      maximumFractionDigits: digits,
    }).format(value);
  }

  private money(value: number, currency = 'BRL'): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  }

  private formatValue(kpi: OverviewKpi): string {
    if (kpi.value === null || kpi.value === undefined || kpi.value === '') return '—';
    if (kpi.unit === 'text') return String(kpi.value);
    const value = Number(kpi.value);
    if (!Number.isFinite(value)) return '—';
    switch (kpi.unit) {
      case 'percent':
        return `${this.number(value, 1)}%`;
      case 'minutes':
        return value >= 60
          ? this.i18n.t('home.unit.hours_minutes', {
              hours: Math.floor(value / 60),
              minutes: value % 60,
            })
          : this.i18n.t('home.unit.minutes', { minutes: value });
      case 'usd':
        return this.money(value, 'USD');
      case 'money':
        return this.money(value, kpi.currency);
      case 'ms':
        return value >= 1000 ? `${this.number(value / 1000, 1)} s` : `${this.number(value)} ms`;
      default:
        return kpi.total !== null && kpi.total !== undefined
          ? `${this.number(value)} / ${this.number(kpi.total)}`
          : this.number(value);
    }
  }

  private hint(kpi: OverviewKpi): string {
    if (kpi.previous === null || kpi.previous === undefined || kpi.value === null) return '';
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
    return this.i18n.t(`home.compare.${window}`, { delta: `${sign}${magnitude}` });
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
