import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { fadeIn } from '../../../shared/animations/fade.animation';
import { TranslocoPipe } from '@jsverse/transloco';

type ActivityLog = {
  uuid: string;
  environmentUUID?: string | null;
  correlationID?: string | null;
  jobUUID?: string | null;
  actorType?: string | null;
  actorName?: string | null;
  source?: string | null;
  category?: string | null;
  action?: string | null;
  level?: string | null;
  status?: string | null;
  resourceType?: string | null;
  resourceUUID?: string | null;
  resourceLabel?: string | null;
  message?: string | null;
  suggestion?: string | null;
  details?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  hostname?: string | null;
  durationMs?: number | null;
  dateCreated?: string | null;
};

@Component({
  selector: 'app-monitoring-activity-logs',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './activity.html',
  styleUrls: ['./activity.scss'],
  animations: [fadeIn],
})
export class MonitoringActivityLogsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(SnackbarService);

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private loadingStarted = 0;

  readonly loading = signal(false);
  readonly total = signal(0);
  readonly selected = signal<ActivityLog | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly dataSource = new MatTableDataSource<ActivityLog>([]);

  readonly isMaster = this.auth.user()?.role === 'MASTER';
  readonly displayedColumns = [
    'created',
    'level',
    'status',
    'action',
    'resource',
    'message',
    'duration',
    'actions',
  ];
  readonly levelOptions = ['', 'info', 'warn', 'warning', 'error', 'critical'];
  readonly statusOptions = [
    '',
    'queued',
    'pending',
    'waiting',
    'running',
    'processing',
    'success',
    'completed',
    'failed',
    'skipped',
  ];
  readonly categoryOptions = [
    '',
    'agent',
    'api',
    'crud',
    'pabx',
    'security',
    'system',
    'voip',
    'worker',
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    environmentUUID: [''],
    level: [''],
    status: [''],
    category: [''],
    correlationID: [''],
  });

  ngOnInit() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.load();
  }

  refreshList() {
    this.pageIndex.set(0);
    this.sortActive.set('');
    this.sortDirection.set('');
    if (this.paginator) {
      this.paginator.firstPage();
    }
    if (this.sort) {
      this.sort.active = '';
      this.sort.direction = '';
    }
    void this.load();
  }

  async load() {
    this.loadingStarted = performance.now();
    this.loading.set(true);
    try {
      const params = this.buildQuery();
      const response = await this.api.get<any>(`monitoring/activity-logs${params}`);
      const rows = response?.data?.items ?? [];
      this.dataSource.data = this.sortRows(rows);
      this.total.set(Number(response?.data?.total ?? 0));
    } catch (err: any) {
      this.snack.error(this.errorMessage(err, 'Failed to load activity logs.'));
      this.dataSource.data = [];
      this.total.set(0);
    } finally {
      const elapsed = performance.now() - this.loadingStarted;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
  }

  applyFilters() {
    this.pageIndex.set(0);
    void this.load();
  }

  clearFilters() {
    this.filterForm.reset({
      search: '',
      environmentUUID: '',
      level: '',
      status: '',
      category: '',
      correlationID: '',
    });
    this.pageIndex.set(0);
    void this.load();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    void this.load();
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.dataSource.data = this.sortRows([...this.dataSource.data]);
  }

  openDetails(row: ActivityLog, template: any) {
    this.selected.set(row);
    this.dialog.open(template, {
      width: '860px',
      maxWidth: '96vw',
      maxHeight: '88vh',
      panelClass: 'activity-detail-dialog-panel',
    });
  }

  chipClass(value: string | null | undefined) {
    return `chip-${value || 'none'}`;
  }

  formatDuration(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
    const ms = Number(value);
    return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;
  }

  formatDetails(value: unknown) {
    if (!value) return '-';
    return JSON.stringify(value, null, 2);
  }

  actorLabel(row: ActivityLog) {
    const parts = [row.actorType, row.actorName].filter(Boolean);
    return parts.length ? parts.join(' / ') : '-';
  }

  resourceLabel(row: ActivityLog) {
    return row.resourceLabel || row.resourceUUID || '-';
  }

  private sortRows(rows: ActivityLog[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = this.sortValue(a, active);
      const right = this.sortValue(b, active);
      return (
        left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }) * multiplier
      );
    });
  }

  private sortValue(row: ActivityLog, column: string) {
    switch (column) {
      case 'created':
        return row.dateCreated ?? '';
      case 'level':
        return row.level ?? '';
      case 'status':
        return row.status ?? '';
      case 'action':
        return row.action ?? '';
      case 'resource':
        return `${row.resourceType ?? ''} ${this.resourceLabel(row)}`;
      case 'message':
        return row.message ?? '';
      case 'duration':
        return String(row.durationMs ?? '');
      default:
        return String((row as Record<string, unknown>)[column] ?? '');
    }
  }

  private errorMessage(error: unknown, fallback: string) {
    const value = error as { error?: { error?: string }; message?: string };
    return value?.error?.error || value?.message || fallback;
  }

  private buildQuery() {
    const value = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    for (const [key, item] of Object.entries(value)) {
      if (item !== null && item !== undefined && String(item).trim()) {
        params.set(key, String(item).trim());
      }
    }
    params.set('limit', String(this.pageSize()));
    params.set('offset', String(this.pageIndex() * this.pageSize()));
    const query = params.toString();
    return query ? `?${query}` : '';
  }
}
