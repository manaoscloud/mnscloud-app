import { Component, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import {
  ConfigurableCrudColumn,
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
  endpoint: 'voip/sbc/cdrs',
  uuidField: 'VscUUID',
  pageTitle: 'SBC CDR',
  pageDescription: 'Inspect SBC call detail records captured from enabled peers.',
  createTitle: 'New SBC CDR',
  editTitle: 'Edit SBC CDR',
  dialogDescription: 'Inspect SBC call detail record data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC CDR records found.',
  deleteTitle: 'Delete SBC CDR',
  deleteMessage: 'Are you sure you want to delete this SBC CDR?',
  deleteSelectedTitle: 'Delete selected SBC CDR records',
  deleteSelectedMessage: 'Delete {count} selected SBC CDR records?',
  savedMessage: 'SBC CDR saved successfully.',
  deletedMessage: 'SBC CDR deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC CDR.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  rowActions: [
    {
      key: 'view-invite',
      label: 'View INVITE details',
      icon: 'visibility',
      tooltip: 'View INVITE details',
    },
  ],
  listFilters: [
    {
      key: 'peerUUID',
      label: 'Input peer',
      paramKey: 'peerUUID',
      type: 'search-select',
      span: 1,
    },
  ],
  initialValues: {},
  fields: [],
  columns: [
    { id: 'createdAt', label: 'Created at', field: 'VscDateCreated', kind: 'datetime' },
    { id: 'peer', label: 'Input peer', field: 'InputPeerName' },
    { id: 'pipe', label: 'Pipe', field: 'PipeName' },
    { id: 'from', label: 'SIP From' },
    { id: 'destination', label: 'SIP destination' },
    { id: 'callStatus', label: 'Call status' },
  ],
};

@Component({
  selector: 'app-voip-sbc-cdr',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcCdrPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  private readonly i18n = inject(TranslocoService);
  readonly peerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(CDR_CONFIG);
    void this.loadLookups();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'peerUUID' ? this.peerOptions() : [];
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return row['VscEvent'] ? (CDR_CONFIG.rowActions ?? []) : [];
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord): void {
    if (action.key !== 'view-invite') return;
    openDataViewerDialog(this.dialog, {
      title: 'INVITE details',
      description: 'Inspect the full SBC CDR INVITE payload.',
      status: {
        label: 'Call status',
        value: this.callStatus(row),
        tone: this.callStatusTone(row),
      },
      details: [
        { label: 'Call-ID', value: row['VscCallID'], monospace: true, wide: true },
        { label: 'UUID', value: row['VscUUID'], monospace: true, wide: true },
        { label: 'SIP event', value: this.sipEventLabel(row['VscEvent']) },
        { label: 'Input peer', value: row['InputPeerName'] },
        { label: 'Pipe', value: row['PipeName'] },
        { label: 'Final SIP response', value: this.finalSipResponse(row) },
      ],
      sections: [
        {
          title: 'SIP',
          details: [
            {
              label: 'SIP From',
              value: this.joinSipAddress(row['VscFromUser'], row['VscFromDomain']),
            },
            { label: 'SIP To', value: this.joinSipAddress(row['VscToUser'], row['VscToDomain']) },
            {
              label: 'R-URI',
              value: this.joinSipAddress(row['VscRuriUser'], row['VscRuriDomain']),
            },
            {
              label: 'SIP destination',
              value:
                this.joinSipAddress(row['VscToUser'], row['VscToDomain'], false) ||
                this.joinSipAddress(row['VscRuriUser'], row['VscRuriDomain'], false) ||
                this.display(row['VscDestination']),
            },
          ],
        },
        {
          title: 'Network',
          details: [
            {
              label: 'Source IP',
              value: this.joinEndpoint(
                row['VscSourceIP'],
                row['VscSourcePort'],
                row['VscSourceTransport'],
              ),
            },
            {
              label: 'Local socket',
              value: this.joinEndpoint(row['VscLocalIP'], row['VscLocalPort'], ''),
            },
            {
              label: 'SIP output',
              value: this.joinEndpoint(
                row['VscOutputHost'],
                row['VscOutputPort'],
                row['VscOutputTransport'],
              ),
            },
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
              filename: `sbc-invite-${this.downloadToken(row)}.sip`,
              label: 'Download SIP message',
              mimeType: 'message/sip;charset=utf-8',
            },
          },
        },
        {
          title: 'Full payload',
          code: {
            title: 'Full payload',
            value: row['VscPayloadJson'],
            format: 'json',
            copy: true,
            download: {
              filename: `sbc-cdr-${this.downloadToken(row)}.json`,
              label: 'Download JSON',
              mimeType: 'application/json;charset=utf-8',
            },
          },
        },
      ],
    });
  }

  override columnText(row: ConfigurableCrudRecord, column: ConfigurableCrudColumn): string {
    if (column.id === 'from') {
      return this.display(row['VscFromUser']);
    }
    if (column.id === 'destination') {
      return this.display(row['VscToUser']) !== '-'
        ? this.display(row['VscToUser'])
        : this.display(row['VscRuriUser']);
    }
    if (column.id === 'callStatus') {
      return this.i18n.translate(this.callStatus(row));
    }
    return super.columnText(row, column);
  }

  private joinSipAddress(user: unknown, domain: unknown, fallbackDash = true): string {
    const normalizedUser = this.display(user);
    const normalizedDomain = this.display(domain);
    if (normalizedUser === '-' && normalizedDomain === '-') return fallbackDash ? '-' : '';
    if (normalizedUser === '-') return normalizedDomain;
    if (normalizedDomain === '-') return normalizedUser;
    return `${normalizedUser}@${normalizedDomain}`;
  }

  private joinEndpoint(host: unknown, port: unknown, transport: unknown): string {
    const normalizedHost = this.display(host);
    if (normalizedHost === '-') return '-';
    const normalizedPort = this.display(port);
    const normalizedTransport = this.display(transport);
    const address = normalizedPort === '-' ? normalizedHost : `${normalizedHost}:${normalizedPort}`;
    return normalizedTransport === '-'
      ? address
      : `${address}/${normalizedTransport.toUpperCase()}`;
  }

  private finalSipResponse(row: ConfigurableCrudRecord): string {
    const code = this.display(row['VscFinalSipCode'] ?? row['VscSipCode']);
    const reason = this.display(row['VscFinalSipReason'] ?? row['VscSipReason']);
    if (code === '-' && reason === '-') return '-';
    return [code === '-' ? '' : code, reason === '-' ? '' : reason].filter(Boolean).join(' ');
  }

  private callStatus(row: ConfigurableCrudRecord): string {
    const consolidated = String(row['VscCallStatus'] ?? '').toLowerCase();
    const labels: Record<string, string> = {
      answered: 'Call answered',
      busy: 'Call busy',
      canceled: 'Call canceled',
      completed: 'Call completed',
      failed: 'Call failed',
      in_progress: 'Call in progress',
      no_answer: 'Call no answer',
      redirected: 'Call redirected',
      rejected: 'Call rejected',
      unknown: 'Unknown',
    };
    if (labels[consolidated]) return labels[consolidated];

    const code = Number(row['VscSipCode']);
    if (Number.isFinite(code)) {
      if (code >= 200 && code < 300) return 'Call answered';
      if (code === 486) return 'Call busy';
      if (code === 487) return 'Call canceled';
      if (code === 408 || code === 480) return 'Call no answer';
      if (code === 401 || code === 403 || code === 407 || code === 603) return 'Call rejected';
      if (code >= 500) return 'Call failed';
      if (code >= 300 && code < 400) return 'Call redirected';
      if (code >= 400) return 'Call rejected';
    }

    const event = String(row['VscEvent'] ?? '').toLowerCase();
    if (event === 'bye') return 'Call completed';
    if (event === 'failed') return 'Call failed';
    if (event === 'invite') return 'Call in progress';
    return 'Unknown';
  }

  private callStatusTone(row: ConfigurableCrudRecord): 'success' | 'warning' | 'danger' | 'info' {
    const status = this.callStatus(row);
    if (status === 'Call answered' || status === 'Call completed') return 'success';
    if (status === 'Call in progress' || status === 'Call redirected') return 'info';
    if (status === 'Call busy' || status === 'Call no answer' || status === 'Call canceled') {
      return 'warning';
    }
    return 'danger';
  }

  private sipEventLabel(value: unknown): string {
    const labels: Record<string, string> = {
      invite: 'INVITE request',
      reply: 'SIP reply',
      bye: 'BYE request',
      cancel: 'CANCEL request',
      failed: 'Failed',
      unknown: 'Unknown',
    };
    return labels[String(value ?? '').toLowerCase()] ?? this.display(value);
  }

  private sipMessage(row: ConfigurableCrudRecord): string {
    const destination =
      this.joinSipAddress(row['VscRuriUser'], row['VscRuriDomain'], false) ||
      this.joinSipAddress(row['VscToUser'], row['VscToDomain'], false) ||
      this.display(row['VscDestination']);
    const transport = this.display(row['VscSourceTransport']).toUpperCase();
    const source = this.joinEndpoint(
      row['VscSourceIP'],
      row['VscSourcePort'],
      row['VscSourceTransport'],
    );
    const output = this.joinEndpoint(
      row['VscOutputHost'],
      row['VscOutputPort'],
      row['VscOutputTransport'],
    );
    const finalResponse = this.finalSipResponse(row);
    return [
      `INVITE sip:${destination === '-' ? '' : destination} SIP/2.0`,
      `Call-ID: ${this.display(row['VscCallID'])}`,
      `From: <sip:${this.joinSipAddress(row['VscFromUser'], row['VscFromDomain'], false)}>`,
      `To: <sip:${this.joinSipAddress(row['VscToUser'], row['VscToDomain'], false)}>`,
      `Request-URI: sip:${this.joinSipAddress(row['VscRuriUser'], row['VscRuriDomain'], false)}`,
      `Source: ${source}`,
      `Transport: ${transport === '-' ? '' : transport}`,
      `Output: ${output}`,
      `Input-Peer: ${this.display(row['InputPeerName'])}`,
      `Pipe: ${this.display(row['PipeName'])}`,
      `Call-Status: ${this.i18n.translate(this.callStatus(row))}`,
      `Final-SIP-Response: ${finalResponse}`,
      '',
      '# This file is a reconstructed SIP summary from MNSCloud CDR metadata, not a raw packet capture.',
    ].join('\n');
  }

  private downloadToken(row: ConfigurableCrudRecord): string {
    return String(row['VscCallID'] || row['VscUUID'] || 'record')
      .trim()
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.peerOptions.set(
        await fetchPaged(this.rawApi, 'voip/sbc/peers?status=1', (row) =>
          option(row.VspUUID, row.VspName, [row.AccountName, row.VspAuthMode]),
        ),
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

async function fetchPaged(
  api: ApiService,
  endpoint: string,
  mapItem: (row: any) => ConfigurableCrudOption | null,
): Promise<ConfigurableCrudOption[]> {
  const options: ConfigurableCrudOption[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await api.get<any>(`${endpoint}${separator}limit=500&offset=${offset}`);
    const rows = extractItems(response);
    options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
    if (rows.length < 500) break;
  }
  return options.sort((left, right) => left.label.localeCompare(right.label));
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
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
