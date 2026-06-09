import { NgClass } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SnackbarService } from '../../../../services/snackbar.service';
import { PabxCdrKind, VoipPabxCdrService } from './cdr.service';
import { VoipPabxCdrRecordingDialogComponent } from './recording-dialog/recording-dialog';

@Component({
  selector: 'app-voip-pabx-cdr',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    NgClass,
  ],
  templateUrl: './cdr.html',
  styleUrls: ['./cdr.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class VoipPabxCdrPage {
  private readonly api = inject(VoipPabxCdrService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  readonly loading = signal(false);
  readonly activeKind = signal<PabxCdrKind>('all');
  readonly dataSource = new MatTableDataSource<any>([]);

  search = '';
  status = '';
  direction = '';
  dateFrom = '';
  dateTo = '';
  readonly pageSize = 25;
  private readonly apiWindowLimit = 500;

  readonly callColumns = [
    'startedAt',
    'engine',
    'pabx',
    'direction',
    'caller',
    'destination',
    'status',
    'duration',
    'cause',
    'recording',
  ];

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.refreshList();
  }

  onTabChange(index: number) {
    const kinds: PabxCdrKind[] = ['all', 'asterisk', 'freeswitch'];
    this.activeKind.set(kinds[index] ?? 'all');
    this.dataSource.data = [];
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    void this.refreshList();
  }

  displayedColumns() {
    return this.callColumns;
  }

  applySearchFilters() {
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    void this.refreshList();
  }

  clearSearchFilters() {
    this.search = '';
    this.status = '';
    this.direction = '';
    this.dateFrom = '';
    this.dateTo = '';
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    void this.refreshList();
  }

  async refreshList() {
    const started = performance.now();
    this.loading.set(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(this.apiWindowLimit));
      params.set('offset', '0');
      if (this.search.trim()) params.set('search', this.search.trim());
      if (this.status) params.set('status', this.status);
      if (this.direction) params.set('direction', this.direction);
      if (this.dateFrom) params.set('dateFrom', new Date(this.dateFrom).toISOString());
      if (this.dateTo) params.set('dateTo', new Date(this.dateTo).toISOString());
      const response = await this.api.list(this.activeKind(), params);
      this.dataSource.data = response?.data?.items ?? [];
    } catch (err: any) {
      this.snack.error(err?.error?.error || err?.message || 'Failed to load PABX CDR.');
    } finally {
      const waitMs = Math.max(0, 600 - (performance.now() - started));
      setTimeout(() => this.loading.set(false), waitMs);
    }
  }

  formatDate(value: string | null | undefined) {
    return value ? new Date(value).toLocaleString() : '';
  }

  statusClass(value: string | null | undefined) {
    const normalized = `${value ?? ''}`.toLowerCase();
    return {
      'is-active': ['answered', 'complete', 'completed'].includes(normalized),
      'is-inactive': !['answered', 'complete', 'completed'].includes(normalized),
    };
  }

  hasRecording(row: any) {
    return row?.recordingAvailable === true || row?.recordingAvailable === 1;
  }

  recordingTooltip(row: any) {
    if (this.hasRecording(row)) return 'Listen recording';
    if (row?.recordingStorageStatus) return `Recording ${row.recordingStorageStatus}`;
    if (row?.recordingUrl) return 'Recording pending upload';
    return 'No recording available';
  }

  async openRecording(row: any) {
    if (!this.hasRecording(row)) return;
    try {
      const response = await this.api.recordingUrl(row.engine, row.cdrUUID);
      const url = response?.data?.url;
      if (!url) throw new Error('Recording URL was not returned.');
      this.dialog.open(VoipPabxCdrRecordingDialogComponent, {
        width: 'min(640px, calc(100vw - 32px))',
        maxWidth: '640px',
        maxHeight: '92vh',
        disableClose: false,
        panelClass: 'voip-pabx-recording-dialog-panel',
        data: {
          url,
          filename: response?.data?.filename || 'recording.wav',
          engine: row.engine,
          pabxName: row.pabxName,
          callerNumber: row.callerNumber,
          destinationNumber: row.destinationNumber,
          startedAt: row.startedAt,
        },
      });
    } catch (err: any) {
      this.snack.error(err?.error?.error || err?.message || 'Failed to open recording.');
    }
  }

  private sortValue(row: any, column: string): string | number {
    const sortMap: Record<string, unknown> = {
      startedAt: row.startedAt,
      engine: row.engine,
      pabx: row.pabxName,
      direction: row.direction,
      caller: row.callerNumber,
      destination: row.destinationNumber,
      status: row.status,
      duration: row.durationSeconds,
      cause: row.hangupCause,
      recording: row.recordingAvailable ? 1 : 0,
    };
    const value = sortMap[column] ?? '';
    return typeof value === 'number' ? value : String(value).toLowerCase();
  }
}
