import { NgClass } from '@angular/common';
import { Component, computed, effect, inject, resource, signal, viewChild } from '@angular/core';
import { FormField, form as createForm } from '@angular/forms/signals';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';
import {
  DataViewerTone,
  openDataViewerDialog,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';

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

type ActivityLogFilters = {
  search: string;
  environmentUUID: string;
  level: string;
  status: string;
  category: string;
  correlationID: string;
};

type ActivityLogsSnapshot = {
  items: ActivityLog[];
  total: number;
};

const EMPTY_ACTIVITY_FILTERS: ActivityLogFilters = {
  search: '',
  environmentUUID: '',
  level: '',
  status: '',
  category: '',
  correlationID: '',
};

const EMPTY_ACTIVITY_LOGS: ActivityLogsSnapshot = {
  items: [],
  total: 0,
};

@Component({
  selector: 'app-monitoring-activity-logs',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    FormField,
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
    NgClass,
  ],
  templateUrl: './activity.html',
  styleUrls: ['./activity.scss'],
})
export class MonitoringActivityLogsPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  private readonly appliedFilters = signal<ActivityLogFilters>({ ...EMPTY_ACTIVITY_FILTERS });
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

  readonly filterFormModel = signal<ActivityLogFilters>({ ...EMPTY_ACTIVITY_FILTERS });
  readonly filterForm = createForm(this.filterFormModel);

  private readonly activityLogsResource = resource({
    params: () => ({
      filters: this.appliedFilters(),
      pageIndex: this.pageIndex(),
      pageSize: this.pageSize(),
    }),
    defaultValue: EMPTY_ACTIVITY_LOGS,
    loader: ({ params }) => this.loadActivityLogsSnapshot(params.filters),
  });

  readonly loading = this.activityLogsResource.isLoading;
  readonly logsSnapshot = computed(() => this.activityLogsResource.value());
  readonly total = computed(() => this.logsSnapshot().total);

  private readonly syncTable = effect(() => {
    this.dataSource.data = this.sortRows(this.logsSnapshot().items);
  });

  private readonly reportLoadError = effect(() => {
    const error = this.activityLogsResource.error();
    if (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load activity logs.'));
    }
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
  }

  refreshList() {
    this.pageIndex.set(0);
    this.sortActive.set('');
    this.sortDirection.set('');
    const paginator = this.paginator();
    if (paginator) {
      paginator.firstPage();
    }
    const sort = this.sort();
    if (sort) {
      sort.active = '';
      sort.direction = '';
    }
    this.activityLogsResource.reload();
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.appliedFilters.set(this.normalizedFilters());
  }

  clearFilters() {
    this.filterFormModel.set({ ...EMPTY_ACTIVITY_FILTERS });
    this.pageIndex.set(0);
    this.appliedFilters.set({ ...EMPTY_ACTIVITY_FILTERS });
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.dataSource.data = this.sortRows([...this.logsSnapshot().items]);
  }

  openDetails(row: ActivityLog) {
    openDataViewerDialog(this.dialog, {
      title: row.action || 'Activity log',
      description: row.message || 'No message available.',
      status: {
        label: 'Status',
        value: row.status || '-',
        tone: this.viewerTone(row.status || row.level),
      },
      details: [
        { label: 'Created', value: this.formatDate(row.dateCreated) },
        {
          label: 'Environment',
          value: row.environmentUUID || 'global',
          monospace: true,
          wide: true,
        },
        { label: 'Correlation ID', value: row.correlationID, monospace: true, wide: true },
        { label: 'Job UUID', value: row.jobUUID, monospace: true, wide: true },
        { label: 'Actor', value: this.actorLabel(row) },
        { label: 'Source', value: row.source },
        { label: 'Category', value: row.category },
        { label: 'Resource', value: `${row.resourceType || '-'} / ${this.resourceLabel(row)}` },
        { label: 'Host', value: row.hostname },
        { label: 'Duration', value: this.formatDuration(row.durationMs) },
        { label: 'Error', value: this.errorDetail(row) },
        { label: 'Suggestion', value: row.suggestion, wide: true },
      ],
      sections: [
        {
          title: 'Record',
          code: {
            title: 'Record',
            value: row.details ?? row,
            format: 'json',
            copy: true,
          },
        },
      ],
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

  private viewerTone(value: string | null | undefined): DataViewerTone {
    const normalized = String(value ?? '').toLowerCase();
    if (['success', 'completed'].includes(normalized)) return 'success';
    if (['failed', 'error', 'critical'].includes(normalized)) return 'danger';
    if (['warn', 'warning', 'skipped'].includes(normalized)) return 'warning';
    if (['running', 'processing', 'queued', 'pending', 'waiting', 'info'].includes(normalized)) {
      return 'info';
    }
    return 'neutral';
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  private errorDetail(row: ActivityLog): string {
    return [row.errorCode, row.errorMessage].filter(Boolean).join(' ') || '-';
  }

  private async loadActivityLogsSnapshot(
    filters: ActivityLogFilters,
  ): Promise<ActivityLogsSnapshot> {
    const params = this.buildQuery(filters);
    const response = await this.api.get<any>(`monitoring/activity-logs${params}`);
    return {
      items: response?.data?.items ?? [],
      total: Number(response?.data?.total ?? 0),
    };
  }

  private normalizedFilters(): ActivityLogFilters {
    const value = this.filterFormModel();
    return {
      search: value.search.trim(),
      environmentUUID: value.environmentUUID.trim(),
      level: value.level.trim(),
      status: value.status.trim(),
      category: value.category.trim(),
      correlationID: value.correlationID.trim(),
    };
  }

  private buildQuery(value: ActivityLogFilters) {
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
