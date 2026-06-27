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
  pageTitle: 'Softswitch CDR/Billing',
  pageDescription: 'Inspect and register billing call records.',
  createTitle: 'New CDR',
  editTitle: 'Edit CDR',
  dialogDescription: 'Maintain billing call record data for this tenant Softswitch.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No CDR records found.',
  deleteTitle: 'Delete CDR',
  deleteMessage: 'Are you sure you want to delete this CDR?',
  deleteSelectedTitle: 'Delete selected CDR records',
  deleteSelectedMessage: 'Delete {count} selected CDR records?',
  savedMessage: 'CDR saved successfully.',
  deletedMessage: 'CDR deleted successfully.',
  deleteFailedMessage: 'Failed to delete CDR.',
  statusMode: 'string',
  activeValue: 'answered',
  inactiveValue: 'failed',
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
    { id: 'callee', label: 'Callee', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'status', label: 'Status', field: 'status' },
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
      source: 'name',
      payloadKey: 'calleeNumber',
      label: 'Callee',
      required: true,
      span: 1,
    },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', span: 1 },
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
    return String(value ?? '-');
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
