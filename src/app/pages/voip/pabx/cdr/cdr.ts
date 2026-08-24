import { Component, inject } from '@angular/core';

import {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import { ApiService } from '../../../../services/api.service';
import { VoipPabxCdrRecordingDialogComponent } from './recording-dialog/recording-dialog';

const PABX_CDR_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/pabx/cdr',
  uuidField: 'cdrUUID',
  pageTitle: 'PABX CDR',
  pageDescription: 'Unified call detail records from Asterisk and FreeSWITCH.',
  createTitle: 'PABX CDR details',
  editTitle: 'PABX CDR details',
  dialogDescription: 'Inspect PABX call detail record data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No PABX CDR records found.',
  deleteTitle: 'Delete PABX CDR',
  deleteMessage: 'Are you sure you want to delete this PABX CDR?',
  deleteSelectedTitle: 'Delete selected PABX CDR records',
  deleteSelectedMessage: 'Delete {count} selected PABX CDR records?',
  savedMessage: 'PABX CDR saved successfully.',
  deletedMessage: 'PABX CDR deleted successfully.',
  deleteFailedMessage: 'Failed to delete PABX CDR.',
  statusMode: 'string',
  activeValue: 'answered',
  inactiveValue: 'failed',
  statusFilter: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusOptions: [
    { value: 'answered', label: 'Answered' },
    { value: 'missed', label: 'Missed' },
    { value: 'failed', label: 'Failed' },
    { value: 'busy', label: 'Busy' },
    { value: 'no_answer', label: 'No answer' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'rejected', label: 'Rejected' },
  ],
  listFilters: [
    {
      key: 'engine',
      label: 'Engine',
      paramKey: 'engine',
      type: 'select',
      span: 1,
      translateOptions: false,
      options: [
        { value: 'asterisk', label: 'Asterisk' },
        { value: 'freeswitch', label: 'FreeSWITCH' },
      ],
    },
    {
      key: 'direction',
      label: 'Direction',
      paramKey: 'direction',
      type: 'select',
      span: 1,
      translateOptions: true,
      options: [
        { value: 'inbound', label: 'Inbound' },
        { value: 'outbound', label: 'Outbound' },
        { value: 'internal', label: 'Internal' },
      ],
    },
  ],
  rowActions: [
    {
      key: 'listen-recording',
      label: 'Listen recording',
      icon: 'play_circle',
      tooltip: 'Listen recording',
    },
    {
      key: 'view-sip-summary',
      label: 'View SIP summary',
      icon: 'visibility',
      tooltip: 'View SIP summary',
    },
    {
      key: 'view-diagnostics',
      label: 'View diagnostics',
      icon: 'bug_report',
      tooltip: 'View diagnostic captures',
    },
  ],
  initialValues: {},
  fields: [],
  columns: [
    { id: 'startedAt', label: 'Started at', field: 'startedAt', kind: 'datetime' },
    { id: 'pabx', label: 'PABX', field: 'pabxName' },
    { id: 'direction', label: 'Direction', field: 'direction', translateValue: true },
    { id: 'caller', label: 'Caller', field: 'callerNumber' },
    { id: 'destination', label: 'Destination', field: 'destinationNumber' },
    { id: 'duration', label: 'Duration seconds', field: 'durationSeconds', kind: 'number' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
};

@Component({
  selector: 'app-voip-pabx-cdr',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxCdrPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  constructor() {
    super(PABX_CDR_CONFIG);
  }

  override statusLabel(value: unknown): string {
    const normalized = String(value ?? '').toLowerCase();
    const labels: Record<string, string> = {
      answered: 'Answered',
      completed: 'Answered',
      complete: 'Answered',
      missed: 'Missed',
      failed: 'Failed',
      busy: 'Busy',
      no_answer: 'No answer',
      canceled: 'Canceled',
      cancelled: 'Canceled',
      rejected: 'Rejected',
    };
    return labels[normalized] ?? this.display(value);
  }

  override isActiveStatus(value: unknown): boolean {
    return ['answered', 'completed', 'complete'].includes(String(value ?? '').toLowerCase());
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    if (!row['cdrUUID']) return [];
    return (PABX_CDR_CONFIG.rowActions ?? []).filter((action) => {
      if (action.key === 'listen-recording') return this.hasRecording(row);
      if (action.key === 'view-diagnostics') return this.hasDiagnostics(row);
      return true;
    });
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord): void {
    if (action.key === 'listen-recording') {
      void this.openRecording(row);
      return;
    }
    if (action.key === 'view-diagnostics') {
      void this.openDiagnostics(row);
      return;
    }
    if (action.key === 'view-sip-summary') this.openSipSummary(row);
  }

  override columnText(row: ConfigurableCrudRecord, column: ConfigurableCrudColumn): string {
    if (column.id === 'duration') {
      return `${Number(row[column.field ?? column.id] ?? 0)}s`;
    }
    return super.columnText(row, column);
  }

  private async openRecording(row: ConfigurableCrudRecord): Promise<void> {
    if (!this.hasRecording(row)) return;
    try {
      const response = await this.rawApi.get<any>(
        `voip/pabx/cdr/recording/${encodeURIComponent(this.display(row['engine']))}/${encodeURIComponent(
          this.display(row['cdrUUID']),
        )}`,
      );
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
          engine: row['engine'],
          pabxName: row['pabxName'],
          callerNumber: row['callerNumber'],
          destinationNumber: row['destinationNumber'],
          startedAt: row['startedAt'],
        },
      });
    } catch (error: any) {
      this.snack.error(
        this.t(error?.error?.error || error?.message || 'Failed to open recording.'),
      );
    }
  }

  private openSipSummary(row: ConfigurableCrudRecord): void {
    openDataViewerDialog(this.dialog, {
      title: 'PABX SIP summary',
      description: 'Inspect the reconstructed PABX SIP/CDR summary and raw engine metadata.',
      status: {
        label: 'Status',
        value: this.statusLabel(row['status']),
        tone: this.isActiveStatus(row['status']) ? 'success' : 'danger',
      },
      details: [
        { label: 'CDR UUID', value: row['cdrUUID'], monospace: true, wide: true },
        { label: 'Provider Call-ID', value: row['providerCallId'], monospace: true, wide: true },
        { label: 'SIP Call-ID', value: row['sipCallId'], monospace: true, wide: true },
        { label: 'Engine', value: row['engine'] },
        { label: 'PABX', value: row['pabxName'] },
        { label: 'Server', value: row['serverName'] },
        { label: 'Extension', value: row['extensionNumber'] },
        { label: 'Recording status', value: row['recordingStorageStatus'] },
      ],
      sections: [
        {
          title: 'Call',
          details: [
            { label: 'Direction', value: row['direction'] },
            { label: 'Caller', value: row['callerNumber'] },
            { label: 'Caller name', value: row['callerName'] },
            { label: 'Destination', value: row['destinationNumber'] },
            { label: 'Hangup cause', value: row['hangupCause'] },
          ],
        },
        {
          title: 'Timing',
          details: [
            { label: 'Started at', value: row['startedAt'] },
            { label: 'Answered at', value: row['answeredAt'] },
            { label: 'Ended at', value: row['endedAt'] },
            { label: 'Duration seconds', value: row['durationSeconds'] },
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
            value: row['rawPayload'] ?? row,
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

  private async openDiagnostics(row: ConfigurableCrudRecord): Promise<void> {
    const resourceUUID = String(row['cdrUUID'] ?? '').trim();
    if (!resourceUUID) return;
    try {
      const attachments = await this.loadDiagnostics(resourceUUID);
      const downloads: Record<string, unknown>[] = await Promise.all(
        attachments.map(async (item) => {
          const diagnosticType = String(item['diagnosticType'] ?? 'diagnostic').trim();
          return {
            ...item,
            statusLabel: this.diagnosticStatusLabel(item),
            diagnosticTypeLabel: this.diagnosticTypeLabel(item),
            downloadFilename: `${this.downloadToken(row)}-${diagnosticType}.${this.diagnosticExtension(
              item,
            )}`,
            downloadUrl: await this.downloadUrl(String(item['diagnosticAttachmentUUID'] ?? '')),
          };
        }),
      );
      const firstText = downloads.find((item) =>
        [
          'sip_capture',
          'sip_summary',
          'diagnostic_json',
          'rtp_summary',
          'engine_log',
          'runtime_snapshot',
        ].includes(String(item['diagnosticType'] ?? '')),
      );
      const previewUrl = String(firstText?.['downloadUrl'] ?? '');
      const preview = previewUrl ? await this.tryFetchText(previewUrl) : '';
      openDataViewerDialog(this.dialog, {
        title: 'CDR diagnostics',
        description: 'Private diagnostic captures linked to this PABX CDR.',
        status: {
          label: 'Attachments',
          value: String(downloads.length),
          tone: downloads.length ? 'success' : 'warning',
        },
        details: [
          { label: 'CDR UUID', value: row['cdrUUID'], monospace: true, wide: true },
          { label: 'Provider Call-ID', value: row['providerCallId'], monospace: true, wide: true },
          { label: 'SIP Call-ID', value: row['sipCallId'], monospace: true, wide: true },
        ],
        sections: [
          {
            title: 'Diagnostic attachments',
            table: {
              columns: [
                { key: 'diagnosticTypeLabel', label: 'Type', translate: true },
                { key: 'captureMode', label: 'Capture mode' },
                { key: 'statusLabel', label: 'Status', translate: true },
                { key: 'sizeBytes', label: 'Size bytes' },
                { key: 'dateCreated', label: 'Created at', kind: 'datetime' },
                {
                  key: 'downloadUrl',
                  label: 'Download',
                  kind: 'download',
                  filenameKey: 'downloadFilename',
                  actionLabel: 'Download',
                },
              ],
              rows: downloads,
              emptyLabel: 'No diagnostic attachments found.',
            },
          },
          {
            title: 'Preview',
            code: {
              title: 'Preview',
              value: preview || 'No text preview available. Use the signed download URL.',
              format: 'text',
              translate: !preview,
              copy: Boolean(preview),
              download: preview
                ? {
                    filename: `pabx-diagnostic-${this.downloadToken(row)}.txt`,
                    label: 'Download preview',
                    mimeType: 'text/plain;charset=utf-8',
                  }
                : undefined,
            },
          },
        ],
      });
    } catch (error: any) {
      this.snack.error(
        this.t(error?.error?.error || error?.message || 'Failed to open diagnostics.'),
      );
    }
  }

  private async loadDiagnostics(resourceUUID: string): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams({
      resourceType: 'pabx_cdr',
      resourceUUID,
      limit: '100',
      offset: '0',
    });
    const response = await this.rawApi.get<any>(`voip/cdr-diagnostics?${params.toString()}`);
    return extractItems(response);
  }

  private hasRecording(row: ConfigurableCrudRecord): boolean {
    return this.flagEnabled(row['recordingAvailable']);
  }

  private hasDiagnostics(row: ConfigurableCrudRecord): boolean {
    return (
      this.flagEnabled(row['diagnosticCaptureEnabled']) &&
      this.flagEnabled(row['diagnosticAvailable']) &&
      Number(row['diagnosticAttachmentCount'] ?? 0) > 0
    );
  }

  private flagEnabled(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return ['1', 'true', 'yes', 'available'].includes(
      String(value ?? '')
        .trim()
        .toLowerCase(),
    );
  }

  private async downloadUrl(uuid: string): Promise<string> {
    if (!uuid) return '';
    try {
      const response = await this.rawApi.get<any>(
        `voip/cdr-diagnostics/${encodeURIComponent(uuid)}/download`,
      );
      return String(response?.data?.downloadUrl ?? response?.downloadUrl ?? '');
    } catch {
      return '';
    }
  }

  private diagnosticTypeLabel(item: Record<string, unknown>): string {
    const type = String(item['diagnosticType'] ?? '')
      .trim()
      .toLowerCase();
    return type || '-';
  }

  private diagnosticStatusLabel(item: Record<string, unknown>): string {
    const status = String(item['status'] ?? '')
      .trim()
      .toLowerCase();
    return status ? `diagnostic.status.${status}` : '-';
  }

  private diagnosticExtension(item: Record<string, unknown>): string {
    const type = String(item['diagnosticType'] ?? '')
      .trim()
      .toLowerCase();
    const mime = String(item['mimeType'] ?? '')
      .trim()
      .toLowerCase();
    const objectKey = String(item['storageObjectKey'] ?? item['objectKey'] ?? '').trim();
    const keyExtension = objectKey.match(/\.([a-z0-9]+)$/i)?.[1];
    if (keyExtension) return keyExtension.toLowerCase();
    if (type === 'pcapng' || mime.includes('pcapng')) return 'pcapng';
    if (type === 'sip_capture' || mime.includes('sip')) return 'sip';
    if (type.includes('json') || mime.includes('json')) return 'json';
    return 'txt';
  }

  private async tryFetchText(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) return '';
      const contentType = response.headers.get('content-type') ?? '';
      if (
        !contentType.includes('text') &&
        !contentType.includes('json') &&
        !contentType.includes('sip')
      ) {
        return '';
      }
      return await response.text();
    } catch {
      return '';
    }
  }

  private sipMessage(row: ConfigurableCrudRecord): string {
    return [
      `INVITE sip:${this.display(row['destinationNumber'])} SIP/2.0`,
      `Call-ID: ${this.display(row['sipCallId'] ?? row['providerCallId'])}`,
      `From: <sip:${this.display(row['callerNumber'])}>`,
      `To: <sip:${this.display(row['destinationNumber'])}>`,
      `Direction: ${this.display(row['direction'])}`,
      `Engine: ${this.display(row['engine'])}`,
      `PABX: ${this.display(row['pabxName'])}`,
      `Server: ${this.display(row['serverName'])}`,
      `Extension: ${this.display(row['extensionNumber'])}`,
      `Call-Status: ${this.statusLabel(row['status'])}`,
      `Hangup-Cause: ${this.display(row['hangupCause'])}`,
      '',
      '# This file is a reconstructed SIP summary from MNSCloud CDR metadata, not a raw packet capture.',
    ].join('\n');
  }

  private downloadToken(row: ConfigurableCrudRecord): string {
    return String(row['sipCallId'] || row['providerCallId'] || row['cdrUUID'] || 'record')
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

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}
