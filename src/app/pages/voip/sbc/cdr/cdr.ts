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
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

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
    { id: 'status', label: 'Status', kind: 'status', field: 'VscStatus', className: 'status-col' },
    { id: 'peer', label: 'Input peer', field: 'InputPeerName' },
    { id: 'pipe', label: 'Pipe', field: 'PipeName' },
    { id: 'from', label: 'SIP From' },
    { id: 'destination', label: 'SIP destination' },
    { id: 'source', label: 'Source IP' },
    { id: 'output', label: 'SIP output' },
    { id: 'event', label: 'Event', kind: 'status', field: 'VscEvent', className: 'status-col' },
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
    if (String(value ?? '') === '1') return 'Active';
    if (String(value ?? '') === '0') return 'Inactive';
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
    if (String(value ?? '') === '1') return true;
    if (String(value ?? '') === '0') return false;
    return ['invite', 'reply', 'bye'].includes(String(value ?? '').toLowerCase());
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return row['VscEvent'] ? CDR_CONFIG.rowActions ?? [] : [];
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord): void {
    if (action.key !== 'view-invite') return;
    this.dialog.open(SbcCdrInviteDetailDialogComponent, {
      panelClass: 'crud-form-dialog',
      data: {
        callID: this.display(row['VscCallID']),
        uuid: this.display(row['VscUUID']),
        event: this.statusLabel(row['VscEvent']),
        status: this.statusLabel(row['VscStatus']),
        inputPeer: this.display(row['InputPeerName']),
        pipe: this.display(row['PipeName']),
        from: this.joinSipAddress(row['VscFromUser'], row['VscFromDomain']),
        to: this.joinSipAddress(row['VscToUser'], row['VscToDomain']),
        ruri: this.joinSipAddress(row['VscRuriUser'], row['VscRuriDomain']),
        source: this.joinEndpoint(row['VscSourceIP'], row['VscSourcePort'], row['VscSourceTransport']),
        local: this.joinEndpoint(row['VscLocalIP'], row['VscLocalPort'], ''),
        output: this.joinEndpoint(row['VscOutputHost'], row['VscOutputPort'], row['VscOutputTransport']),
        sipResponse: this.sipResponse(row),
        payload: this.formatPayload(row['VscPayloadJson']),
      } satisfies SbcCdrInviteDetailData,
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
      return this.joinEndpoint(row['VscOutputHost'], row['VscOutputPort'], row['VscOutputTransport']);
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
    return normalizedTransport === '-' ? address : `${address}/${normalizedTransport.toUpperCase()}`;
  }

  private sipResponse(row: ConfigurableCrudRecord): string {
    const code = this.display(row['VscSipCode']);
    const reason = this.display(row['VscSipReason']);
    if (code === '-' && reason === '-') return '-';
    return [code === '-' ? '' : code, reason === '-' ? '' : reason].filter(Boolean).join(' ');
  }

  private formatPayload(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value !== 'string') return JSON.stringify(value, null, 2);
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
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

type SbcCdrInviteDetailData = {
  callID: string;
  uuid: string;
  event: string;
  status: string;
  inputPeer: string;
  pipe: string;
  from: string;
  to: string;
  ruri: string;
  source: string;
  local: string;
  output: string;
  sipResponse: string;
  payload: string;
};

@Component({
  selector: 'app-sbc-cdr-invite-detail-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, TranslocoPipe],
  template: `
    <div class="cdr-detail-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'INVITE details' | transloco }}</h2>
          <p>{{ 'Inspect the full SBC CDR INVITE payload.' | transloco }}</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <section class="detail-grid">
          @for (item of summaryItems; track item.label) {
            <div class="detail-item">
              <span>{{ item.label | transloco }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          }
        </section>

        <section class="payload-section">
          <h3>{{ 'Full payload' | transloco }}</h3>
          <pre>{{ data.payload }}</pre>
        </section>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="form-actions">
        <button mat-stroked-button color="primary" type="button" mat-dialog-close>
          {{ 'Close' | transloco }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .cdr-detail-dialog {
        display: flex;
        flex-direction: column;
        min-height: min(720px, 80vh);
      }

      .dialog-content {
        overflow: auto;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .detail-item {
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
        padding: 0.75rem;
        min-width: 0;
      }

      .detail-item span {
        display: block;
        font-size: 0.8rem;
        opacity: 0.72;
        margin-bottom: 0.5rem;
      }

      .detail-item strong {
        display: block;
        overflow-wrap: anywhere;
      }

      .payload-section {
        margin-top: 1rem;
      }

      .payload-section h3 {
        margin: 0 0 0.75rem;
        font-size: 1rem;
      }

      .payload-section pre {
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
        margin: 0;
        padding: 1rem;
        overflow: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      @media (max-width: 1200px) {
        .detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 700px) {
        .detail-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
class SbcCdrInviteDetailDialogComponent {
  readonly data = inject<SbcCdrInviteDetailData>(MAT_DIALOG_DATA);
  readonly summaryItems = [
    { label: 'Call-ID', value: this.data.callID },
    { label: 'Status', value: this.data.status },
    { label: 'Event', value: this.data.event },
    { label: 'Input peer', value: this.data.inputPeer },
    { label: 'Pipe', value: this.data.pipe },
    { label: 'SIP From', value: this.data.from },
    { label: 'SIP To', value: this.data.to },
    { label: 'R-URI', value: this.data.ruri },
    { label: 'Source IP', value: this.data.source },
    { label: 'Local socket', value: this.data.local },
    { label: 'SIP output', value: this.data.output },
    { label: 'SIP response', value: this.data.sipResponse },
    { label: 'UUID', value: this.data.uuid },
  ];
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
