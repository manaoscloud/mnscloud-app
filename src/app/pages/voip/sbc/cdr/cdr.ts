import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

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
    { id: 'call', label: 'Call-ID', kind: 'identity', field: 'VscCallID', uuidField: 'VscUUID' },
    { id: 'peer', label: 'Input peer', field: 'InputPeerName' },
    { id: 'pipe', label: 'Pipe', field: 'PipeName' },
    { id: 'source', label: 'Source' },
    { id: 'destination', label: 'Destination', field: 'VscDestination' },
    { id: 'output', label: 'Output' },
    { id: 'event', label: 'Event', kind: 'status', field: 'VscEvent', className: 'status-col' },
    { id: 'sip', label: 'SIP' },
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

  override statusLabel(value: unknown): string {
    const labels: Record<string, string> = {
      invite: 'Invite',
      reply: 'Reply',
      bye: 'Bye',
      failed: 'Failed',
      unknown: 'Unknown',
    };
    return labels[String(value ?? '').toLowerCase()] ?? String(value ?? '-');
  }

  override isActiveStatus(value: unknown): boolean {
    return ['invite', 'reply', 'bye'].includes(String(value ?? '').toLowerCase());
  }

  override columnText(row: ConfigurableCrudRecord, column: ConfigurableCrudColumn): string {
    if (column.id === 'source') {
      return this.joinEndpoint(row['VscSourceIP'], row['VscSourcePort'], row['VscSourceTransport']);
    }
    if (column.id === 'output') {
      return this.joinEndpoint(row['VscOutputHost'], row['VscOutputPort'], row['VscOutputTransport']);
    }
    if (column.id === 'sip') {
      const code = this.display(row['VscSipCode']);
      const reason = this.display(row['VscSipReason']);
      if (code === '-' && reason === '-') return '-';
      return [code === '-' ? '' : code, reason === '-' ? '' : reason].filter(Boolean).join(' ');
    }
    return super.columnText(row, column);
  }

  private joinEndpoint(host: unknown, port: unknown, transport: unknown): string {
    const normalizedHost = this.display(host);
    if (normalizedHost === '-') return '-';
    const normalizedPort = this.display(port);
    const normalizedTransport = this.display(transport);
    const address = normalizedPort === '-' ? normalizedHost : `${normalizedHost}:${normalizedPort}`;
    return normalizedTransport === '-' ? address : `${address}/${normalizedTransport.toUpperCase()}`;
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
