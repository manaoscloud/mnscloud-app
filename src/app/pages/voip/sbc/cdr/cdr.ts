import { Component, inject, signal } from '@angular/core';

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
    { id: 'source', label: 'Source IP' },
    { id: 'output', label: 'SIP output' },
    { id: 'sipResult', label: 'SIP result' },
    { id: 'event', label: 'SIP event' },
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
        label: 'SIP result',
        value: this.sipResult(row),
        tone: this.sipResultTone(row),
      },
      details: [
        { label: 'Call-ID', value: row['VscCallID'], monospace: true, wide: true },
        { label: 'UUID', value: row['VscUUID'], monospace: true, wide: true },
        { label: 'SIP event', value: this.sipEventLabel(row['VscEvent']) },
        { label: 'Input peer', value: row['InputPeerName'] },
        { label: 'Pipe', value: row['PipeName'] },
        { label: 'SIP response', value: this.sipResponse(row) },
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
          title: 'Full payload',
          code: {
            title: 'Full payload',
            value: row['VscPayloadJson'],
            format: 'json',
            copy: true,
          },
        },
      ],
    });
  }

  override columnText(row: ConfigurableCrudRecord, column: ConfigurableCrudColumn): string {
    if (column.id === 'from') {
      return this.joinSipAddress(row['VscFromUser'], row['VscFromDomain']);
    }
    if (column.id === 'destination') {
      return (
        this.joinSipAddress(row['VscToUser'], row['VscToDomain'], false) ||
        this.joinSipAddress(row['VscRuriUser'], row['VscRuriDomain'], false) ||
        this.display(row['VscDestination'])
      );
    }
    if (column.id === 'source') {
      return this.joinEndpoint(row['VscSourceIP'], row['VscSourcePort'], row['VscSourceTransport']);
    }
    if (column.id === 'output') {
      return this.joinEndpoint(
        row['VscOutputHost'],
        row['VscOutputPort'],
        row['VscOutputTransport'],
      );
    }
    if (column.id === 'sipResult') {
      return this.sipResult(row);
    }
    if (column.id === 'event') {
      return this.sipEventLabel(row['VscEvent']);
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

  private sipResponse(row: ConfigurableCrudRecord): string {
    const code = this.display(row['VscSipCode']);
    const reason = this.display(row['VscSipReason']);
    if (code === '-' && reason === '-') return '-';
    return [code === '-' ? '' : code, reason === '-' ? '' : reason].filter(Boolean).join(' ');
  }

  private sipResult(row: ConfigurableCrudRecord): string {
    const response = this.sipResponse(row);
    if (response !== '-') return response;
    return this.sipEventLabel(row['VscEvent']);
  }

  private sipResultTone(row: ConfigurableCrudRecord): 'success' | 'warning' | 'danger' | 'info' {
    const code = Number(row['VscSipCode']);
    if (Number.isFinite(code)) {
      if (code >= 200 && code < 300) return 'success';
      if (code >= 300 && code < 400) return 'warning';
      if (code >= 400) return 'danger';
    }
    return String(row['VscEvent'] ?? '').toLowerCase() === 'failed' ? 'danger' : 'info';
  }

  private sipEventLabel(value: unknown): string {
    const labels: Record<string, string> = {
      invite: 'INVITE request',
      reply: 'SIP reply',
      bye: 'BYE request',
      failed: 'Failed',
      unknown: 'Unknown',
    };
    return labels[String(value ?? '').toLowerCase()] ?? this.display(value);
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
