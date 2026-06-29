import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { TranslocoPipe } from '@jsverse/transloco';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipDidItem, VoipDidService } from '../did.service';
import { VoipDidExternalItem, VoipDidExternalService } from '../external/external.service';
import { VoipDidOperatorItem, VoipDidOperatorService } from '../operator/operator.service';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type KpiTile = {
  label: string;
  value: string;
  detailValue: string;
  detailLabel: string;
  icon: string;
  state: 'good' | 'warn' | 'bad' | 'neutral';
};

type OperatorRow = {
  uuid: string;
  name: string;
  nick: string;
  active: boolean;
  numbers: number;
  available: number;
  assigned: number;
  issues: number;
};

type NumberStatusRow = {
  status: string;
  total: number;
  available: number;
  assigned: number;
  issues: number;
};

type ExternalRow = {
  uuid: string;
  number: string;
  provider: string;
  validation: string;
  billing: string;
  active: boolean;
};

type DidDashboardSnapshot = {
  operators: VoipDidOperatorItem[];
  dids: VoipDidItem[];
  externalDids: VoipDidExternalItem[];
  failed: number;
};

const EMPTY_DID_DASHBOARD: DidDashboardSnapshot = {
  operators: [],
  dids: [],
  externalDids: [],
  failed: 0,
};

@Component({
  selector: 'app-voip-did-dashboard',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class VoipDidDashboardPage {
  private readonly didApi = inject(VoipDidService);
  private readonly operatorApi = inject(VoipDidOperatorService);
  private readonly externalApi = inject(VoipDidExternalService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private lastDashboardFailure = '';

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  private readonly dashboardResource = resource({
    params: () => this.isMaster(),
    defaultValue: EMPTY_DID_DASHBOARD,
    loader: ({ params }) => this.fetchDashboard(params),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly operators = signal<VoipDidOperatorItem[]>([]);
  readonly dids = signal<VoipDidItem[]>([]);
  readonly externalDids = signal<VoipDidExternalItem[]>([]);
  readonly dashboardSearchInput = signal('');
  private readonly dashboardSearch = signal('');

  readonly operatorColumns = [
    'operator',
    'nick',
    'active',
    'numbers',
    'available',
    'assigned',
    'issues',
    'actions',
  ];
  readonly statusColumns = ['status', 'total', 'available', 'assigned', 'issues', 'actions'];
  readonly externalColumns = ['number', 'provider', 'validation', 'billing', 'active', 'actions'];

  private readonly syncDashboard = effect(() => {
    const snapshot = this.dashboardResource.value();
    this.operators.set(snapshot.operators);
    this.dids.set(snapshot.dids);
    this.externalDids.set(snapshot.externalDids);

    if (snapshot.failed === 0) {
      this.lastDashboardFailure = '';
      return;
    }

    const message =
      snapshot.failed === 3
        ? 'Failed to load DID dashboard.'
        : 'Some DID dashboard sections could not be loaded.';
    if (message !== this.lastDashboardFailure) {
      this.lastDashboardFailure = message;
      snapshot.failed === 3 ? this.snack.error(message) : this.snack.warning(message);
    }
  });

  private readonly normalizedDashboardSearch = computed(() =>
    this.dashboardSearch().trim().toLowerCase(),
  );

  readonly operatorRows = computed<OperatorRow[]>(() =>
    this.operators().map((operator) => {
      const dids = this.dids().filter((did) => did.VoipDidOperatorVdoUUID === operator.VdoUUID);
      return {
        uuid: operator.VdoUUID,
        name: operator.VdoName,
        nick: operator.VdoNick || '-',
        active: this.isActive(operator.VdoStatus),
        numbers: dids.length,
        available: dids.filter((did) => this.isAvailable(did)).length,
        assigned: dids.filter((did) => this.isAssigned(did)).length,
        issues: this.operatorIssues(operator, dids),
      };
    }),
  );

  readonly statusRows = computed<NumberStatusRow[]>(() => {
    const groups = new Map<string, VoipDidItem[]>();
    this.dids().forEach((did) => {
      const status = this.numberStatusLabel(did);
      groups.set(status, [...(groups.get(status) ?? []), did]);
    });
    return [...groups.entries()]
      .map(([status, rows]) => ({
        status,
        total: rows.length,
        available: rows.filter((row) => this.isAvailable(row)).length,
        assigned: rows.filter((row) => this.isAssigned(row)).length,
        issues: rows.filter((row) => !this.isActive(row.VddStatus)).length,
      }))
      .sort((a, b) => b.total - a.total || a.status.localeCompare(b.status));
  });

  readonly externalRows = computed<ExternalRow[]>(() =>
    this.externalDids().map((item) => ({
      uuid: item.VddUUID,
      number: item.VddNumber,
      provider: item.VddExternalProviderName || '-',
      validation: item.VddValidationStatus || '-',
      billing: item.VddBillingStatus || '-',
      active: this.isActive(item.VddStatus),
    })),
  );

  readonly filteredOperatorRows = computed(() =>
    this.operatorRows().filter((row) =>
      this.matchesFilter(
        [row.name, row.nick, row.active ? 'Active' : 'Inactive', row.numbers, row.issues],
        this.normalizedDashboardSearch(),
      ),
    ),
  );
  readonly filteredStatusRows = computed(() =>
    this.statusRows().filter((row) =>
      this.matchesFilter(
        [row.status, row.total, row.available, row.assigned, row.issues],
        this.normalizedDashboardSearch(),
      ),
    ),
  );
  readonly filteredExternalRows = computed(() =>
    this.externalRows().filter((row) =>
      this.matchesFilter(
        [
          row.number,
          row.provider,
          row.validation,
          row.billing,
          row.active ? 'Active' : 'Inactive',
        ],
        this.normalizedDashboardSearch(),
      ),
    ),
  );

  readonly operatorTable = createSignalCrudTable<OperatorRow>(
    this.filteredOperatorRows,
    (row, column) => this.operatorSortValue(row, column),
  );
  readonly statusTable = createSignalCrudTable<NumberStatusRow>(
    this.filteredStatusRows,
    (row, column) => this.statusSortValue(row, column),
  );
  readonly externalTable = createSignalCrudTable<ExternalRow>(
    this.filteredExternalRows,
    (row, column) => this.externalSortValue(row, column),
  );

  private readonly reportDashboardError = effect(() => {
    const error = this.dashboardResource.error();
    if (!error) return;
    const message = this.errorMessage(error, 'Failed to load DID dashboard.');
    if (message !== this.lastDashboardFailure) {
      this.lastDashboardFailure = message;
      this.snack.error(message);
    }
  });

  readonly numberSummary = computed(() => {
    const rows = this.dids();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.VddStatus)).length;
    const available = rows.filter((row) => this.isAvailable(row)).length;
    const assigned = rows.filter((row) => this.isAssigned(row)).length;
    return { total, active, available, assigned };
  });

  readonly operatorSummary = computed(() => {
    const rows = this.operators();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.VdoStatus)).length;
    return { total, active };
  });

  readonly externalSummary = computed(() => {
    const rows = this.externalDids();
    const total = rows.length;
    const active = rows.filter((row) => this.isActive(row.VddStatus)).length;
    const pending = rows.filter((row) =>
      ['pending', 'queued', 'requested'].includes(
        String(row.VddValidationStatus ?? '').toLowerCase(),
      ),
    ).length;
    return { total, active, pending };
  });

  readonly readinessSummary = computed(() => {
    const operatorReady = this.operatorSummary().active > 0;
    const numberReady = this.numberSummary().active > 0;
    const availableReady = this.numberSummary().available > 0 || this.numberSummary().assigned > 0;
    const checks = [operatorReady, numberReady, availableReady];
    const passed = checks.filter(Boolean).length;
    return { passed, total: checks.length };
  });

  readonly kpis = computed<KpiTile[]>(() => [
    {
      label: 'DID Numbers',
      value: String(this.numberSummary().total),
      detailValue: String(this.numberSummary().available),
      detailLabel: 'available',
      icon: 'dialpad',
      state: this.numberSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'DID Operators',
      value: `${this.operatorSummary().active} / ${this.operatorSummary().total}`,
      detailValue: String(this.operatorRows().reduce((sum, row) => sum + row.issues, 0)),
      detailLabel: 'issues',
      icon: 'badge',
      state: this.operatorSummary().active > 0 ? 'good' : 'warn',
    },
    {
      label: 'External DIDs',
      value: `${this.externalSummary().active} / ${this.externalSummary().total}`,
      detailValue: String(this.externalSummary().pending),
      detailLabel: 'pending',
      icon: 'add_ic_call',
      state: this.externalSummary().pending > 0 ? 'warn' : 'neutral',
    },
    {
      label: 'DID Readiness',
      value: `${this.readinessSummary().passed} / ${this.readinessSummary().total}`,
      detailValue: String(this.numberSummary().assigned),
      detailLabel: 'assigned',
      icon: 'verified',
      state:
        this.readinessSummary().passed === this.readinessSummary().total
          ? 'good'
          : this.readinessSummary().passed > 0
            ? 'warn'
            : 'bad',
    },
  ]);

  refreshList() {
    this.dashboardResource.reload();
  }

  onDashboardSearchChange(value: string) {
    this.dashboardSearchInput.set(value);
  }

  applyDashboardFilters() {
    this.dashboardSearch.set(this.dashboardSearchInput().trim());
    this.resetDashboardPages();
  }

  clearDashboardFilters() {
    this.dashboardSearchInput.set('');
    this.dashboardSearch.set('');
    this.resetDashboardPages();
  }

  setOperatorSort(sort: Sort) {
    this.operatorTable.setSort(sort);
  }

  setOperatorPage(page: PageEvent) {
    this.operatorTable.setPage(page);
  }

  setStatusSort(sort: Sort) {
    this.statusTable.setSort(sort);
  }

  setStatusPage(page: PageEvent) {
    this.statusTable.setPage(page);
  }

  setExternalSort(sort: Sort) {
    this.externalTable.setSort(sort);
  }

  setExternalPage(page: PageEvent) {
    this.externalTable.setPage(page);
  }

  routeTo(section: 'operator' | 'number' | 'external') {
    if (this.isMaster()) return ['/system/did', section];
    return ['/voip/did', section];
  }

  chipClass(value: boolean | number) {
    return Boolean(value) ? 'chip-success is-active' : 'chip-skipped is-inactive';
  }

  issueChipClass(issues: number) {
    return issues > 0 ? 'chip-warning' : 'chip-success is-active';
  }

  statusChipClass(status: string) {
    const normalized = status.toLowerCase();
    if (['rejected', 'failed', 'error', 'inactive', 'cancelled', 'canceled'].includes(normalized)) {
      return 'chip-danger';
    }
    if (['pending', 'queued', 'requested', 'available'].includes(normalized)) {
      return 'chip-warning';
    }
    return 'chip-success is-active';
  }

  private matchesFilter(values: unknown[], filter: string) {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return values
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(term));
  }

  private async fetchDashboard(isMaster: boolean): Promise<DidDashboardSnapshot> {
    const [operatorsResult, didsResult, externalResult] = await Promise.allSettled([
      this.operatorApi.list({ limit: 5000 }, isMaster),
      this.didApi.list({ limit: 5000 }, isMaster),
      this.externalApi.list({ limit: 5000 }, isMaster),
    ]);

    const failed = [operatorsResult, didsResult, externalResult].filter(
      (result) => result.status === 'rejected',
    ).length;

    return {
      operators:
        operatorsResult.status === 'fulfilled'
          ? this.items<VoipDidOperatorItem>(operatorsResult.value)
          : [],
      dids: didsResult.status === 'fulfilled' ? this.items<VoipDidItem>(didsResult.value) : [],
      externalDids:
        externalResult.status === 'fulfilled'
          ? this.items<VoipDidExternalItem>(externalResult.value)
          : [],
      failed,
    };
  }

  private operatorIssues(operator: VoipDidOperatorItem, dids: VoipDidItem[]) {
    let issues = 0;
    if (!this.isActive(operator.VdoStatus)) issues += 1;
    if (dids.length === 0) issues += 1;
    issues += dids.filter((did) => !this.isActive(did.VddStatus)).length;
    return issues;
  }

  private numberStatusLabel(did: VoipDidItem) {
    if (!this.isActive(did.VddStatus)) return 'Inactive';
    if (this.isAssigned(did)) return 'Assigned';
    if (this.isAvailable(did)) return 'Available';
    return 'Active';
  }

  private isAvailable(did: VoipDidItem) {
    return Number(did.IsAvailable ?? 0) === 1 && !this.isAssigned(did);
  }

  private isAssigned(did: VoipDidItem) {
    return Boolean(did.VoipDidAssignmentVdaUUID || did.CustomerCusUUID || did.UserUsrUUID);
  }

  private isActive(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string' && value.trim()) {
      return ['1', 'true', 'active', 'approved', 'validated'].includes(value.toLowerCase());
    }
    return false;
  }

  private items<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];
    const wrapped = response as { data?: { items?: T[] } | T[]; items?: T[] };
    if (Array.isArray(wrapped?.items)) return wrapped.items;
    if (Array.isArray(wrapped?.data)) return wrapped.data;
    if (Array.isArray((wrapped?.data as { items?: T[] } | undefined)?.items)) {
      return (wrapped.data as { items: T[] }).items;
    }
    return [];
  }

  private operatorSortValue(row: OperatorRow, column: string) {
    if (column === 'operator') return row.name;
    if (column === 'nick') return row.nick;
    if (column === 'active') return row.active ? 1 : 0;
    if (column === 'numbers') return row.numbers;
    if (column === 'available') return row.available;
    if (column === 'assigned') return row.assigned;
    if (column === 'issues') return row.issues;
    return '';
  }

  private statusSortValue(row: NumberStatusRow, column: string) {
    if (column === 'status') return row.status;
    if (column === 'total') return row.total;
    if (column === 'available') return row.available;
    if (column === 'assigned') return row.assigned;
    if (column === 'issues') return row.issues;
    return '';
  }

  private externalSortValue(row: ExternalRow, column: string) {
    if (column === 'number') return row.number;
    if (column === 'provider') return row.provider;
    if (column === 'validation') return row.validation;
    if (column === 'billing') return row.billing;
    if (column === 'active') return row.active ? 1 : 0;
    return '';
  }

  private resetDashboardPages() {
    this.operatorTable.setPage({
      pageIndex: 0,
      pageSize: this.operatorTable.pageSize(),
      length: this.filteredOperatorRows().length,
    });
    this.statusTable.setPage({
      pageIndex: 0,
      pageSize: this.statusTable.pageSize(),
      length: this.filteredStatusRows().length,
    });
    this.externalTable.setPage({
      pageIndex: 0,
      pageSize: this.externalTable.pageSize(),
      length: this.filteredExternalRows().length,
    });
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
