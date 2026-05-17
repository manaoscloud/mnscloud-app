import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { fadeIn } from '../../../shared/animations/fade.animation';

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
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './activity.html',
  styleUrls: ['./activity.scss'],
  animations: [fadeIn],
})
export class MonitoringActivityLogsPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ActivityLog[]>([]);
  readonly total = signal(0);
  readonly selected = signal<ActivityLog | null>(null);

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
  readonly levelOptions = ['', 'info', 'warning', 'error', 'critical'];
  readonly statusOptions = ['', 'queued', 'running', 'success', 'failed', 'skipped'];
  readonly categoryOptions = ['', 'pabx', 'voip', 'api', 'worker', 'system', 'security'];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    environmentUUID: [''],
    level: [''],
    status: [''],
    category: [''],
    correlationID: [''],
    limit: [100, [Validators.min(1), Validators.max(1000)]],
  });

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const params = this.buildQuery();
      const response = await this.api.get<any>(`monitoring/activity-logs${params}`);
      this.rows.set(response?.data?.items ?? []);
      this.total.set(Number(response?.data?.total ?? 0));
    } catch (err: any) {
      this.error.set(err?.error?.error || err?.message || 'Failed to load activity logs.');
      this.rows.set([]);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters() {
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
      limit: 100,
    });
    void this.load();
  }

  openDetails(row: ActivityLog, template: any) {
    this.selected.set(row);
    this.dialog.open(template, { width: '860px', maxWidth: '96vw', maxHeight: '88vh' });
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

  private buildQuery() {
    const value = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    for (const [key, item] of Object.entries(value)) {
      if (item !== null && item !== undefined && String(item).trim()) {
        params.set(key, String(item).trim());
      }
    }
    const query = params.toString();
    return query ? `?${query}` : '';
  }
}
