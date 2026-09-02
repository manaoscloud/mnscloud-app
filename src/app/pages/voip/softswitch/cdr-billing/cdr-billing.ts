import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRowAction,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';

const CDR_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/cdrs',
  uuidField: 'uuid',
  pageTitle: 'Softswitch CDR',
  pageDescription: 'Inspect consolidated Softswitch call records collected from runtime events.',
  createTitle: 'Call details',
  editTitle: 'Call details',
  dialogDescription: 'Inspect call routing, accounting and runtime event summary.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No call records found.',
  deleteTitle: 'Delete call record',
  deleteMessage: 'Are you sure you want to delete this call record?',
  deleteSelectedTitle: 'Delete selected call records',
  deleteSelectedMessage: 'Delete {count} selected call records?',
  savedMessage: 'Call record saved successfully.',
  deletedMessage: 'Call record deleted successfully.',
  deleteFailedMessage: 'Failed to delete call record.',
  statusMode: 'string',
  activeValue: 'answered',
  inactiveValue: 'failed',
  statusFilter: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  rowActions: [
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
  initialValues: {
    accountUUID: '',
    name: '',
    calleeNumber: '',
    callStatus: 'failed',
    direction: 'outbound',
    durationSeconds: 0,
    billSeconds: 0,
    costAmount: 0,
    sellAmount: 0,
  },
  columns: [
    { id: 'call', label: 'Call-ID', kind: 'identity', field: 'callId', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'direction', label: 'Direction', field: 'direction' },
    { id: 'caller', label: 'Caller', field: 'callerNumber' },
    { id: 'callee', label: 'Callee', field: 'calleeNumber' },
    { id: 'trunk', label: 'Trunk', field: 'trunkName' },
    { id: 'duration', label: 'Duration seconds', field: 'durationSeconds' },
    { id: 'billsec', label: 'Bill seconds', field: 'billSeconds' },
    { id: 'startedAt', label: 'Started at', field: 'startedAt', kind: 'datetime' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'accountUUID',
      source: 'accountUUID',
      payloadKey: 'accountUUID',
      label: 'Softswitch',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'callId',
      source: 'callId',
      payloadKey: 'providerCallId',
      label: 'Call-ID',
      span: 2,
    },
    {
      key: 'callStatus',
      source: 'status',
      payloadKey: 'callStatus',
      label: 'Status',
      type: 'select',
      span: 1,
      options: [
        { value: 'answered', label: 'Answered' },
        { value: 'failed', label: 'Failed' },
        { value: 'busy', label: 'Busy' },
        { value: 'no_answer', label: 'No answer' },
      ],
    },
    {
      key: 'calleeNumber',
      source: 'calleeNumber',
      payloadKey: 'calleeNumber',
      label: 'Callee',
      required: true,
      span: 1,
    },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', span: 1 },
    {
      key: 'callerNumber',
      source: 'callerNumber',
      payloadKey: 'callerNumber',
      label: 'Caller',
      span: 1,
    },
    {
      key: 'durationSeconds',
      source: 'durationSeconds',
      payloadKey: 'durationSeconds',
      label: 'Duration seconds',
      type: 'number',
      span: 1,
    },
    {
      key: 'billSeconds',
      source: 'billSeconds',
      payloadKey: 'billSeconds',
      label: 'Bill seconds',
      type: 'number',
      span: 1,
    },
    {
      key: 'costAmount',
      source: 'costAmount',
      payloadKey: 'costAmount',
      label: 'Cost amount',
      type: 'number',
      span: 1,
    },
    {
      key: 'sellAmount',
      source: 'sellAmount',
      payloadKey: 'sellAmount',
      label: 'Sell amount',
      type: 'number',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-cdr-billing',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchCdrBillingPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(CDR_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'accountUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'accountUUID' ? this.accountOptions() : [];
  }

  override statusOptions() {
    return [
      { value: '', label: 'All' },
      { value: 'answered', label: 'Answered' },
      { value: 'failed', label: 'Failed' },
      { value: 'busy', label: 'Busy' },
      { value: 'no_answer', label: 'No answer' },
    ];
  }

  override statusLabel(value: unknown): string {
    const normalized = String(value ?? '').toLowerCase();
    const labels: Record<string, string> = {
      answered: 'Answered',
      failed: 'Failed',
      busy: 'Busy',
      no_answer: 'No answer',
      cancelled: 'Cancelled',
    };
    return labels[normalized] ?? String(value ?? '-');
  }

  override isActiveStatus(value: unknown): boolean {
    return String(value ?? '') === 'answered';
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return payload;
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    if (!row['uuid'] && !row['callId']) return [];
    return (CDR_CONFIG.rowActions ?? []).filter(
      (action) => action.key !== 'view-diagnostics' || this.hasDiagnostics(row),
    );
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord): void {
    if (action.key === 'view-diagnostics') {
      void this.openDiagnostics(row);
      return;
    }
    if (action.key !== 'view-sip-summary') return;
    openDataViewerDialog(this.dialog, {
      title: 'Softswitch SIP summary',
      description: 'Inspect the reconstructed Softswitch SIP call summary and raw CDR metadata.',
      status: {
        label: 'Status',
        value: this.statusLabel(row['status']),
        tone: this.isActiveStatus(row['status']) ? 'success' : 'danger',
      },
      details: [
        { label: 'UUID', value: row['uuid'], monospace: true, wide: true },
        { label: 'Call-ID', value: row['callId'], monospace: true, wide: true },
        { label: 'Engine', value: row['engine'] },
        { label: 'Softswitch', value: row['accountName'] },
        { label: 'Server', value: row['serverName'] },
        { label: 'Trunk', value: row['trunkName'] },
        { label: 'Subscriber', value: row['subscriberName'] ?? row['subscriberUsername'] },
        { label: 'Final SIP response', value: this.finalSipResponse(row) },
      ],
      sections: [
        {
          title: 'SIP',
          details: [
            { label: 'Direction', value: row['direction'] },
            { label: 'Caller', value: row['callerNumber'] },
            { label: 'Callee', value: row['calleeNumber'] },
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
            { label: 'Bill seconds', value: row['billSeconds'] },
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
              filename: `softswitch-cdr-${this.downloadToken(row)}.sip`,
              label: 'Download SIP summary',
              mimeType: 'message/sip;charset=utf-8',
            },
          },
        },
        {
          title: 'Raw metadata',
          code: {
            title: 'Raw metadata',
            value: row['rawJson'] ?? row,
            format: 'json',
            copy: true,
            download: {
              filename: `softswitch-cdr-${this.downloadToken(row)}.json`,
              label: 'Download JSON',
              mimeType: 'application/json;charset=utf-8',
            },
          },
        },
      ],
    });
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const response = await this.rawApi.get<any>(
        'voip/softswitch/accounts?status=1&limit=500&offset=0',
      );
      this.accountOptions.set(
        extractItems(response)
          .map((row) => option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName]))
          .filter(isOption)
          .sort((left, right) => left.label.localeCompare(right.label)) as ConfigurableCrudOption[],
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }

  private finalSipResponse(row: ConfigurableCrudRecord): string {
    const code = display(row['finalSipCode']);
    const reason = display(row['finalSipReason']);
    if (code === '-' && reason === '-') return '-';
    return [code === '-' ? '' : code, reason === '-' ? '' : reason].filter(Boolean).join(' ');
  }

  private sipMessage(row: ConfigurableCrudRecord): string {
    return [
      `INVITE sip:${display(row['calleeNumber'])} SIP/2.0`,
      `Call-ID: ${display(row['callId'])}`,
      `From: <sip:${display(row['callerNumber'])}>`,
      `To: <sip:${display(row['calleeNumber'])}>`,
      `Direction: ${display(row['direction'])}`,
      `Engine: ${display(row['engine'])}`,
      `Softswitch: ${display(row['accountName'])}`,
      `Server: ${display(row['serverName'])}`,
      `Trunk: ${display(row['trunkName'])}`,
      `Subscriber: ${display(row['subscriberName'] ?? row['subscriberUsername'])}`,
      `Call-Status: ${this.statusLabel(row['status'])}`,
      `Final-SIP-Response: ${this.finalSipResponse(row)}`,
      '',
      '# This file is a reconstructed SIP summary from MNSCloud CDR metadata, not a raw packet capture.',
    ].join('\n');
  }

  private downloadToken(row: ConfigurableCrudRecord): string {
    return String(row['callId'] || row['uuid'] || 'record')
      .trim()
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async openDiagnostics(row: ConfigurableCrudRecord): Promise<void> {
    const resourceUUID = String(row['uuid'] ?? '').trim();
    if (!resourceUUID) return;
    const attachments = await this.loadDiagnostics('softswitch_cdr', resourceUUID);
    const downloads: Record<string, unknown>[] = await Promise.all(
      attachments.map(async (item) => {
        const diagnosticType = String(item['diagnosticType'] ?? 'diagnostic').trim();
        return {
          ...item,
          statusLabel: this.diagnosticStatusLabel(item),
          diagnosticTypeLabel: this.diagnosticTypeLabel(item),
          downloadFilename: `${this.downloadToken(row)}-${diagnosticType}.${this.diagnosticExtension(item)}`,
          downloadUrl: await this.downloadUrl(String(item['diagnosticAttachmentUUID'] ?? '')),
        };
      }),
    );
    const firstText = downloads.find((item) =>
      ['sip_capture', 'sip_summary', 'diagnostic_json', 'rtp_summary', 'engine_log', 'runtime_snapshot'].includes(
        String(item['diagnosticType'] ?? ''),
      ),
    );
    const previewUrl = String(firstText?.['downloadUrl'] ?? '');
    const preview = previewUrl ? await this.tryFetchText(previewUrl) : '';
    openDataViewerDialog(this.dialog, {
      title: 'CDR diagnostics',
      description: 'Private diagnostic captures linked to this Softswitch CDR.',
      status: {
        label: 'Attachments',
        value: String(downloads.length),
        tone: downloads.length ? 'success' : 'warning',
      },
      details: [
        { label: 'CDR UUID', value: row['uuid'], monospace: true, wide: true },
        { label: 'Call-ID', value: row['callId'], monospace: true, wide: true },
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
                  filename: `softswitch-diagnostic-${this.downloadToken(row)}.txt`,
                  label: 'Download preview',
                  mimeType: 'text/plain;charset=utf-8',
                }
              : undefined,
          },
        },
      ],
    });
  }

  private async loadDiagnostics(
    resourceType: string,
    resourceUUID: string,
  ): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams({
      resourceType,
      resourceUUID,
      limit: '100',
      offset: '0',
    });
    const response = await this.rawApi.get<any>(`voip/cdr-diagnostics?${params.toString()}`);
    return extractItems(response);
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
      if (!contentType.includes('text') && !contentType.includes('json')) return '';
      return await response.text();
    } catch {
      return '';
    }
  }
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}

function option(
  value: unknown,
  label: unknown,
  descriptionParts: unknown[] = [],
): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' - ');
  return {
    value: normalizedValue,
    label: normalizedLabel,
    description,
    searchText: `${normalizedLabel} ${description} ${normalizedValue}`,
  };
}

function isOption(value: ConfigurableCrudOption | null): value is ConfigurableCrudOption {
  return Boolean(value);
}
