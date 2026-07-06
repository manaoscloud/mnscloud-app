import { Component } from '@angular/core';

import {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

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
  constructor() {
    super(CDR_CONFIG);
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
}
