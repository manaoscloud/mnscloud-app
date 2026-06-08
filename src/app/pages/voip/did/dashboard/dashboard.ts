import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { TranslocoPipe } from '@jsverse/transloco';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipDidItem, VoipDidService } from '../did.service';
import { VoipDidExternalItem, VoipDidExternalService } from '../external/external.service';
import { VoipDidOperatorItem, VoipDidOperatorService } from '../operator/operator.service';

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

@Component({
  selector: 'app-voip-did-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  animations: [fadeIn],
})
export class VoipDidDashboardPage implements AfterViewInit {
  private readonly didApi = inject(VoipDidService);
  private readonly operatorApi = inject(VoipDidOperatorService);
  private readonly externalApi = inject(VoipDidExternalService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private loadingStarted = 0;

  @ViewChild('operatorSort') operatorSort?: MatSort;
  @ViewChild('operatorPaginator') operatorPaginator?: MatPaginator;
  @ViewChild('statusSort') statusSort?: MatSort;
  @ViewChild('statusPaginator') statusPaginator?: MatPaginator;
  @ViewChild('externalSort') externalSort?: MatSort;
  @ViewChild('externalPaginator') externalPaginator?: MatPaginator;

  readonly loading = signal(false);
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');

  readonly operators = signal<VoipDidOperatorItem[]>([]);
  readonly dids = signal<VoipDidItem[]>([]);
  readonly externalDids = signal<VoipDidExternalItem[]>([]);

  readonly operatorDataSource = new MatTableDataSource<OperatorRow>([]);
  readonly statusDataSource = new MatTableDataSource<NumberStatusRow>([]);
  readonly externalDataSource = new MatTableDataSource<ExternalRow>([]);

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

  ngAfterViewInit() {
    this.operatorDataSource.sortingDataAccessor = (row, column) =>
      this.operatorSortValue(row, column);
    this.statusDataSource.sortingDataAccessor = (row, column) => this.statusSortValue(row, column);
    this.externalDataSource.sortingDataAccessor = (row, column) =>
      this.externalSortValue(row, column);

    this.operatorDataSource.sort = this.operatorSort ?? null;
    this.operatorDataSource.paginator = this.operatorPaginator ?? null;
    this.statusDataSource.sort = this.statusSort ?? null;
    this.statusDataSource.paginator = this.statusPaginator ?? null;
    this.externalDataSource.sort = this.externalSort ?? null;
    this.externalDataSource.paginator = this.externalPaginator ?? null;

    void this.load();
  }

  refreshList() {
    void this.load();
  }

  async load() {
    this.loadingStarted = performance.now();
    this.loading.set(true);

    try {
      const [operatorsResult, didsResult, externalResult] = await Promise.allSettled([
        this.operatorApi.list({ limit: 5000 }, this.isMaster()),
        this.didApi.list({ limit: 5000 }, this.isMaster()),
        this.externalApi.list({ limit: 5000 }, this.isMaster()),
      ]);

      const failed = [operatorsResult, didsResult, externalResult].filter(
        (result) => result.status === 'rejected',
      ).length;

      this.operators.set(
        operatorsResult.status === 'fulfilled'
          ? this.items<VoipDidOperatorItem>(operatorsResult.value)
          : [],
      );
      this.dids.set(
        didsResult.status === 'fulfilled' ? this.items<VoipDidItem>(didsResult.value) : [],
      );
      this.externalDids.set(
        externalResult.status === 'fulfilled'
          ? this.items<VoipDidExternalItem>(externalResult.value)
          : [],
      );

      this.applyDataSources();

      if (failed === 3) {
        this.snack.error('Failed to load DID dashboard.');
      } else if (failed > 0) {
        this.snack.warning('Some DID dashboard sections could not be loaded.');
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load DID dashboard.'));
      this.operators.set([]);
      this.dids.set([]);
      this.externalDids.set([]);
      this.applyDataSources();
    } finally {
      const elapsed = performance.now() - this.loadingStarted;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
  }

  routeTo(section: 'operator' | 'number' | 'external') {
    if (this.isMaster()) return ['/system/did', section];
    if (section === 'operator') return ['/system/did/operator'];
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

  private applyDataSources() {
    this.operatorDataSource.data = this.operatorRows();
    this.statusDataSource.data = this.statusRows();
    this.externalDataSource.data = this.externalRows();
  }

  private operatorRows(): OperatorRow[] {
    return this.operators().map((operator) => {
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
    });
  }

  private statusRows(): NumberStatusRow[] {
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
  }

  private externalRows(): ExternalRow[] {
    return this.externalDids().map((item) => ({
      uuid: item.VddUUID,
      number: item.VddNumber,
      provider: item.VddExternalProviderName || '-',
      validation: item.VddValidationStatus || '-',
      billing: item.VddBillingStatus || '-',
      active: this.isActive(item.VddStatus),
    }));
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

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
