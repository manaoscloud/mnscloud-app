import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

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

function isOption(value: ConfigurableCrudOption | null): value is ConfigurableCrudOption {
  return Boolean(value);
}
