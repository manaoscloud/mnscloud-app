import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../../services/api.service';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import {
  DashboardRecordListComponent,
  type DashboardRecord,
} from '../../../../shared/dashboard/dashboard-record-list';
import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';

type ProviderRow = {
  uuid: string;
  name: string;
  provider: string;
  active: number;
  isDefault: number;
  accounts: number;
  routes: number;
  issues: number;
};
type AccountRow = {
  uuid: string;
  name: string;
  provider: string;
  fromName: string | null;
  fromEmail: string | null;
  active: number;
  isDefault: number;
  routes: number;
};
type RouteRow = {
  uuid: string;
  event: string;
  account: string;
  provider: string;
  fromName: string | null;
  fromEmail: string | null;
  active: number;
};
type Snapshot = {
  kpis: {
    providersTotal: number;
    providersActive: number;
    providersDefault: number;
    accountsTotal: number;
    accountsActive: number;
    accountsDefault: number;
    routesTotal: number;
    routesActive: number;
    routesLinked: number;
    issues: number;
    readyRoutes: number;
  };
  providers: ProviderRow[];
  accounts: AccountRow[];
  routes: RouteRow[];
};
const EMPTY: Snapshot = {
  kpis: {
    providersTotal: 0,
    providersActive: 0,
    providersDefault: 0,
    accountsTotal: 0,
    accountsActive: 0,
    accountsDefault: 0,
    routesTotal: 0,
    routesActive: 0,
    routesLinked: 0,
    issues: 0,
    readyRoutes: 0,
  },
  providers: [],
  accounts: [],
  routes: [],
};
@Component({
  selector: 'app-hosting-smtp-dashboard',
  imports: [
    DashboardPageComponent,
    DashboardRecordListComponent,
    RouterModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
})
export class HostingSmtpDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly isMaster = this.route.snapshot.data?.['scope'] === 'master';
  readonly dashboard = dashboardResource({
    defaultValue: EMPTY,
    loader: async () => {
      const response = await this.api.get<{ data: Snapshot }>(
        `${this.isMaster ? 'system/' : ''}hosting/smtp/dashboard`,
        { timeout: 30000 },
      );
      return response.data;
    },
  });
  readonly providerTable = createSignalCrudTable(
    computed(() => this.dashboard.value().providers),
    (r, c) => r[c as keyof ProviderRow],
  );
  readonly accountTable = createSignalCrudTable(
    computed(() => this.dashboard.value().accounts),
    (r, c) => (c === 'from' ? this.from(r) : r[c as keyof AccountRow]),
  );
  readonly routeTable = createSignalCrudTable(
    computed(() => this.dashboard.value().routes),
    (r, c) => (c === 'from' ? this.from(r) : r[c as keyof RouteRow]),
  );
  readonly providerSort = [
    { key: 'name', label: 'Provider' },
    { key: 'provider', label: 'Type' },
    { key: 'active', label: 'Active' },
    { key: 'isDefault', label: 'Default' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'routes', label: 'Routes' },
    { key: 'issues', label: 'Issues' },
  ];
  readonly accountSort = [
    { key: 'name', label: 'Account' },
    { key: 'provider', label: 'Provider' },
    { key: 'from', label: 'From' },
    { key: 'active', label: 'Active' },
    { key: 'isDefault', label: 'Default' },
    { key: 'routes', label: 'Routes' },
  ];
  readonly routeSort = [
    { key: 'event', label: 'Event' },
    { key: 'account', label: 'Account' },
    { key: 'provider', label: 'Provider' },
    { key: 'from', label: 'From' },
    { key: 'active', label: 'Active' },
  ];
  private readonly resetInventoryPages = effect(() => {
    this.dashboard.value();
    this.providerTable.resetPage();
    this.accountTable.resetPage();
    this.routeTable.resetPage();
  });

  constructor() {
    this.providerTable.setSort({ active: 'name', direction: 'asc' });
    this.accountTable.setSort({ active: 'name', direction: 'asc' });
    this.routeTable.setSort({ active: 'event', direction: 'asc' });
  }
  readonly kpis = computed(() => {
    const k = this.dashboard.value().kpis;
    return [
      {
        label: 'SMTP Providers',
        value: `${k.providersActive} / ${k.providersTotal}`,
        hint: `${k.providersDefault}`,
        detail: 'default',
        icon: 'hub',
      },
      {
        label: 'SMTP Accounts',
        value: `${k.accountsActive} / ${k.accountsTotal}`,
        hint: `${k.accountsDefault}`,
        detail: 'default',
        icon: 'mail',
      },
      {
        label: 'SMTP Routes',
        value: `${k.routesActive} / ${k.routesTotal}`,
        hint: `${k.routesLinked}`,
        detail: 'linked',
        icon: 'route',
      },
      {
        label: 'Ready delivery routes',
        value: `${k.readyRoutes}`,
        hint: `${k.issues}`,
        detail: 'issues',
        icon: 'mark_email_read',
      },
    ];
  });
  private status(active: number): Pick<DashboardRecord, 'status' | 'tone'> {
    return {
      status: active === 1 ? 'Active' : 'Inactive',
      tone: active === 1 ? 'success' : 'skipped',
    };
  }
  private from(row: AccountRow | RouteRow) {
    return row.fromName && row.fromEmail
      ? `${row.fromName} <${row.fromEmail}>`
      : row.fromEmail || row.fromName || '-';
  }
  readonly providerRecords = computed<DashboardRecord[]>(() =>
    this.providerTable.visibleRows().map((r) => ({
      id: r.uuid,
      name: r.name,
      meta: r.provider === 'ses' ? 'Amazon SES' : r.provider.toUpperCase(),
      ...this.status(r.active),
      details: [
        { label: 'Default', value: r.isDefault === 1 ? 'Yes' : 'No', translate: true },
        { label: 'Accounts', value: String(r.accounts) },
        { label: 'Routes', value: String(r.routes) },
        { label: 'Issues', value: String(r.issues) },
      ],
    })),
  );
  readonly accountRecords = computed<DashboardRecord[]>(() =>
    this.accountTable.visibleRows().map((r) => ({
      id: r.uuid,
      name: r.name,
      meta: r.provider,
      ...this.status(r.active),
      details: [
        { label: 'From', value: this.from(r) },
        { label: 'Default', value: r.isDefault === 1 ? 'Yes' : 'No', translate: true },
        { label: 'Routes', value: String(r.routes) },
      ],
    })),
  );
  readonly routeRecords = computed<DashboardRecord[]>(() =>
    this.routeTable.visibleRows().map((r) => ({
      id: r.uuid,
      name: r.event,
      meta: r.account,
      ...this.status(r.active),
      details: [
        { label: 'Provider', value: r.provider },
        { label: 'From', value: this.from(r) },
      ],
    })),
  );
  routeTo(section: 'providers' | 'accounts' | 'routes') {
    return [this.isMaster ? '/system/hosting/smtp' : '/hosting/smtp', section];
  }
}
