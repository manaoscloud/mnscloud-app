import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DateTimeFormatService } from '../../../../services/date-time-format.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { PabxCdrKind, VoipPabxCdrService } from './cdr.service';
import { VoipPabxCdrRecordingDialogComponent } from './recording-dialog/recording-dialog';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { TranslocoPipe } from '@jsverse/transloco';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';

type CdrFilters = {
  search: string;
  status: string;
  direction: string;
  dateFrom: string;
  dateTo: string;
};

type CdrRequest = CdrFilters & {
  kind: PabxCdrKind;
};

@Component({
  selector: 'app-voip-pabx-cdr',
  standalone: true,
  imports: [
    TranslocoPipe,
    RefreshButtonComponent,
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
})
export class VoipPabxCdrPage {
  private readonly api = inject(VoipPabxCdrService);
  private readonly dateTime = inject(DateTimeFormatService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  readonly activeKind = signal<PabxCdrKind>('all');
  private readonly appliedFilters = signal<CdrFilters>({
    search: '',
    status: '',
    direction: '',
    dateFrom: '',
    dateTo: '',
  });
  private readonly cdrResource = resource({
    params: () => ({ kind: this.activeKind(), ...this.appliedFilters() }),
    defaultValue: [] as any[],
    loader: ({ params }) => this.fetchCdrRows(params),
  });

  readonly loading = this.cdrResource.isLoading;
  readonly rows = computed(() => this.cdrResource.value());
  readonly table = createSignalCrudTable<any>(this.rows, (row, column) => this.sortValue(row, column));
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;

  search = '';
  status = '';
  direction = '';
  dateFrom = '';
  dateTo = '';
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
    'actions',
  ];

  private readonly syncRows = effect(() => {
    this.rows();
  });

  private readonly reportError = effect(() => {
    const error = this.cdrResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load PABX CDR.'));
  });

  onTabChange(index: number) {
    const kinds: PabxCdrKind[] = ['all', 'asterisk', 'freeswitch'];
    this.activeKind.set(kinds[index] ?? 'all');
    this.rows();
  }

  displayedColumns() {
    return this.callColumns;
  }
  setSort(sort: Sort): void {
    this.table.setSort(sort);
  }

  setPage(page: PageEvent): void {
    this.table.setPage(page);
  }

  applySearchFilters() {
    this.appliedFilters.set(this.currentFilters());
  }

  clearSearchFilters() {
    this.search = '';
    this.status = '';
    this.direction = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applySearchFilters();
  }

  refreshList() {
    this.cdrResource.reload();
  }

  private async fetchCdrRows(request: CdrRequest): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('limit', String(this.apiWindowLimit));
    params.set('offset', '0');
    if (request.search.trim()) params.set('search', request.search.trim());
    if (request.status) params.set('status', request.status);
    if (request.direction) params.set('direction', request.direction);
    if (request.dateFrom) params.set('dateFrom', new Date(request.dateFrom).toISOString());
    if (request.dateTo) params.set('dateTo', new Date(request.dateTo).toISOString());
    const response = await this.api.list(request.kind, params);
    return response?.data?.items ?? [];
  }

  formatDate(value: string | null | undefined) {
    return this.dateTime.formatDateTime(value);
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

  openSipSummary(row: any) {
    openDataViewerDialog(this.dialog, {
      title: 'PABX SIP summary',
      description: 'Inspect the reconstructed PABX SIP/CDR summary and raw engine metadata.',
      status: {
        label: 'Status',
        value: row.status || '-',
        tone: ['answered', 'complete', 'completed'].includes(String(row.status ?? '').toLowerCase())
          ? 'success'
          : 'danger',
      },
      details: [
        { label: 'CDR UUID', value: row.cdrUUID, monospace: true, wide: true },
        { label: 'Provider Call-ID', value: row.providerCallId, monospace: true, wide: true },
        { label: 'SIP Call-ID', value: row.sipCallId, monospace: true, wide: true },
        { label: 'Engine', value: row.engine },
        { label: 'PABX', value: row.pabxName },
        { label: 'Server', value: row.serverName },
        { label: 'Extension', value: row.extensionNumber },
        { label: 'Recording status', value: row.recordingStorageStatus },
      ],
      sections: [
        {
          title: 'Call',
          details: [
            { label: 'Direction', value: row.direction },
            { label: 'Caller', value: row.callerNumber },
            { label: 'Caller name', value: row.callerName },
            { label: 'Destination', value: row.destinationNumber },
            { label: 'Hangup cause', value: row.hangupCause },
          ],
        },
        {
          title: 'Timing',
          details: [
            { label: 'Started at', value: row.startedAt },
            { label: 'Answered at', value: row.answeredAt },
            { label: 'Ended at', value: row.endedAt },
            { label: 'Duration seconds', value: row.durationSeconds },
            { label: 'Bill seconds', value: row.billSeconds },
          ],
        },
        {
          title: 'SIP message',
          code: {
            title: 'SIP message',
            value: this.sipMessage(row),
            format: 'text',
            copy: true,
            download: {
              filename: `pabx-cdr-${this.downloadToken(row)}.sip`,
              label: 'Download SIP summary',
              mimeType: 'message/sip;charset=utf-8',
            },
          },
        },
        {
          title: 'Raw metadata',
          code: {
            title: 'Raw metadata',
            value: row.rawPayload ?? row,
            format: 'json',
            copy: true,
            download: {
              filename: `pabx-cdr-${this.downloadToken(row)}.json`,
              label: 'Download JSON',
              mimeType: 'application/json;charset=utf-8',
            },
          },
        },
      ],
    });
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
      actions: '',
    };
    const value = sortMap[column] ?? '';
    return typeof value === 'number' ? value : String(value).toLowerCase();
  }

  private currentFilters(): CdrFilters {
    return {
      search: this.search,
      status: this.status,
      direction: this.direction,
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    const serverMessage = (error as any)?.error?.error || (error as any)?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  private sipMessage(row: any): string {
    return [
      `INVITE sip:${this.display(row.destinationNumber)} SIP/2.0`,
      `Call-ID: ${this.display(row.sipCallId ?? row.providerCallId)}`,
      `From: <sip:${this.display(row.callerNumber)}>`,
      `To: <sip:${this.display(row.destinationNumber)}>`,
      `Direction: ${this.display(row.direction)}`,
      `Engine: ${this.display(row.engine)}`,
      `PABX: ${this.display(row.pabxName)}`,
      `Server: ${this.display(row.serverName)}`,
      `Extension: ${this.display(row.extensionNumber)}`,
      `Call-Status: ${this.display(row.status)}`,
      `Hangup-Cause: ${this.display(row.hangupCause)}`,
      '',
      '# This file is a reconstructed SIP summary from MNSCloud CDR metadata, not a raw packet capture.',
    ].join('\n');
  }

  private downloadToken(row: any): string {
    return String(row.sipCallId || row.providerCallId || row.cdrUUID || 'record')
      .trim()
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }
}
