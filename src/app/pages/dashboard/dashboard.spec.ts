import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, type ParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AppI18nService } from '../../services/app-i18n.service';
import { AuthService } from '../../services/auth.service';
import { ContextModeService, type ContextMode } from '../../services/context-mode.service';
import { DateTimeFormatService } from '../../services/date-time-format.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TenantService } from '../../services/tenant.service';
import { Dashboard } from './dashboard';

function tab(key: string, extra: Record<string, unknown> = {}) {
  return {
    key,
    state: 'ready',
    tone: 'ok',
    link: `/${key}`,
    emptyLink: `/${key}/new`,
    rowsTitle: null,
    kpis: [],
    attention: [],
    rows: [],
    unavailableSections: [],
    ...extra,
  };
}

describe('Home dashboard', () => {
  const mode = signal<ContextMode>('tenant');
  const query = new BehaviorSubject<ParamMap>(convertToParamMap({}));
  let requests: string[];
  let layouts: Record<string, { order: string[]; hidden: string[] } | 'error'>;
  let page: Dashboard;

  const tenantSnapshot = {
    scope: 'tenant',
    generatedAt: '2026-10-19T12:00:00.000Z',
    attention: [
      {
        code: 'support.sla_breached',
        severity: 'critical',
        params: { count: 2 },
        link: '/support/tickets?queue=overdue',
        tab: 'support',
      },
    ],
    tabs: [
      tab('voip', {
        kpis: [
          { code: 'voip.calls_today', value: 1284, unit: 'count' },
          { code: 'voip.answer_rate', value: 91.4, unit: 'percent' },
          { code: 'voip.pabx_active', value: 3, unit: 'count', total: 4 },
          { code: 'voip.unknown', value: null, unit: 'count' },
        ],
      }),
      tab('customer-billing', {
        chart: {
          code: 'customer_billing.chart.received',
          kind: 'bars',
          unit: 'money',
          currency: 'BRL',
          series: [{ key: '', code: 'customer_billing.series.received' }],
          points: [
            { day: '2026-10-18', values: { '': 1200 } },
            { day: '2026-10-19', values: { '': 0 } },
          ],
        },
        kpis: [
          {
            code: 'customer_billing.received_month',
            value: 1500,
            unit: 'money',
            currency: 'BRL',
            previous: 1000,
          },
        ],
        rows: [
          {
            name: 'ACME',
            detail: 'customer_billing.charge_detail',
            detailParams: { charge: 'BCH-1', at: '2026-10-01' },
            status: 'customer_billing.state.overdue',
            tone: 'warning',
            amount: 200,
            currency: 'BRL',
          },
        ],
      }),
      tab('support', {
        tone: 'critical',
        kpis: [
          { code: 'support.opened_today', value: 7, unit: 'count', previous: 4 },
          { code: 'support.first_response_avg_30d', value: 75, unit: 'minutes' },
        ],
        rows: [
          {
            name: 'TKT-1 Down',
            detail: 'support.deadline.response',
            detailParams: { at: '2026-10-19T10:00:00Z' },
            status: 'support.sla.breached',
            tone: 'critical',
          },
        ],
      }),
    ],
  };
  const platformSnapshot = {
    scope: 'platform',
    generatedAt: '2026-10-19T12:00:00.000Z',
    attention: [],
    tabs: [tab('fleet', { kpis: [{ code: 'ai.cost_30d', value: 38.2, unit: 'usd' }] })],
  };

  async function settle() {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  }

  beforeEach(async () => {
    mode.set('tenant');
    query.next(convertToParamMap({}));
    requests = [];
    layouts = {};
    await createPage();
  });

  async function createPage() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ uuid: 'user-a' }) } },
        {
          provide: TenantService,
          useValue: { selectedTenant: signal({ EnvironmentUUID: 'env-a' }) },
        },
        { provide: ContextModeService, useValue: { effectiveMode: mode } },
        { provide: ActivatedRoute, useValue: { queryParamMap: query.asObservable() } },
        {
          provide: AppI18nService,
          useValue: {
            language: signal('en-US'),
            t: (key: string, params?: Record<string, unknown>) =>
              `${key}${params ? JSON.stringify(params) : ''}`,
          },
        },
        {
          provide: DateTimeFormatService,
          useValue: { formatDateTime: (value: string) => `@${value}` },
        },
        {
          provide: ApiService,
          useValue: {
            get: (endpoint: string) => {
              requests.push(endpoint);
              if (endpoint.startsWith('user/dashboard-layouts/')) {
                const layout = layouts[endpoint.split('/').pop() ?? ''];
                if (layout === 'error') return Promise.reject(new Error('down'));
                return Promise.resolve({
                  status: 'success',
                  message: 'ok',
                  data: layout ?? { order: [], hidden: [] },
                });
              }
              return Promise.resolve({
                status: 'success',
                message: 'ok',
                data: endpoint.startsWith('system/') ? platformSnapshot : tenantSnapshot,
              });
            },
          },
        },
        { provide: MatDialog, useValue: {} },
        { provide: SnackbarService, useValue: { error: () => undefined } },
      ],
    });
    page = TestBed.runInInjectionContext(() => new Dashboard());
    await settle();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads the tenant overview and opens the first tab by default', () => {
    expect(requests).toEqual(['dashboard/overview', 'user/dashboard-layouts/home.tenant']);
    expect(page.hasData()).toBeTrue();
    expect(page.activeTab()?.key).toBe('voip');
    expect(page.kpis().map((kpi) => kpi.value)).toEqual([
      { text: '1,284' },
      { text: '91.4%' },
      { text: '3 / 4' },
      { text: '—' },
    ]);
  });

  it('follows the module in the URL and formats comparisons, durations and rows', async () => {
    query.next(convertToParamMap({ module: 'support' }));
    await settle();
    expect(page.activeTab()?.key).toBe('support');
    const [opened, firstResponse] = page.kpis();
    // Keys are translated by the pipe, so they follow the translation load.
    expect(opened.hint).toEqual({ key: 'home.compare.yesterday', params: { delta: '+3' } });
    expect(firstResponse.value).toEqual({
      key: 'home.unit.hours_minutes',
      params: { hours: 1, minutes: 15 },
    });
    expect(page.rows()[0]).toEqual(
      jasmine.objectContaining({
        meta: 'home.row.support.deadline.response',
        metaParams: { at: '@2026-10-19T10:00:00Z' },
        status: 'home.row.support.sla.breached',
        tone: 'danger',
      }),
    );
  });

  it('formats money, compares with the previous month and shows row amounts', async () => {
    query.next(convertToParamMap({ module: 'customer-billing' }));
    await settle();
    const [received] = page.kpis();
    expect(received.value).toEqual({ text: 'R$1,500.00' });
    expect(received.hint).toEqual({
      key: 'home.compare.previous_month',
      params: { delta: '+R$500.00' },
    });
    expect(page.rows()[0].details).toEqual([{ label: 'home.row.amount', value: 'R$200.00' }]);
    const trend = page.chart();
    expect(trend?.title).toBe('home.chart.customer_billing.chart.received');
    expect(trend?.series).toEqual([
      { key: '', label: 'home.chart.customer_billing.series.received' },
    ]);
    expect(trend?.format(1200)).toBe('R$1.2K');
  });

  it('has no chart when the tab has no trend', () => {
    expect(page.activeTab()?.key).toBe('voip');
    expect(page.chart()).toBeNull();
  });

  it('falls back to the first tab when the URL names a module that is not shown', async () => {
    query.next(convertToParamMap({ module: 'fiscal' }));
    await settle();
    expect(page.activeTab()?.key).toBe('voip');
  });

  it('turns attention links into router targets with query params', () => {
    expect(page.attention()[0].target).toEqual({
      path: '/support/tickets',
      query: { queue: 'overdue' },
    });
  });

  it('switches to the platform overview in System context without showing tenant data', async () => {
    mode.set('master');
    TestBed.tick();
    expect(page.scope()).toBe('platform');
    expect(page.tabs()).toEqual([]);
    await settle();
    expect(requests).toContain('system/dashboard/overview');
    expect(page.activeTab()?.key).toBe('fleet');
    expect(page.kpis()[0].value).toEqual({ text: '$38.20' });
  });

  it('asks the API to bypass its cache on Refresh only', async () => {
    page.refresh();
    await settle();
    expect(requests.filter((item) => item.startsWith('dashboard/'))).toEqual([
      'dashboard/overview',
      'dashboard/overview?fresh=1',
    ]);
  });

  it('orders and hides tabs by the saved layout but keeps their attention items', async () => {
    layouts['home.tenant'] = { order: ['support', 'voip'], hidden: ['customer-billing'] };
    await createPage();
    expect(page.tabs().map((item) => item.key)).toEqual(['support', 'voip']);
    expect(page.activeTab()?.key).toBe('support');
    expect(page.attention().map((item) => item.tab)).toEqual(['support']);
    expect(page.allHidden()).toBeFalse();
  });

  it('says so when every tab is hidden', async () => {
    layouts['home.tenant'] = { order: [], hidden: ['voip', 'customer-billing', 'support'] };
    await createPage();
    expect(page.tabs()).toEqual([]);
    expect(page.activeTab()).toBeNull();
    expect(page.allHidden()).toBeTrue();
  });

  it('keeps the default order when the layout cannot be read', async () => {
    layouts['home.tenant'] = 'error';
    await createPage();
    expect(page.hasData()).toBeTrue();
    expect(page.tabs().map((item) => item.key)).toEqual(['voip', 'customer-billing', 'support']);
  });
});
