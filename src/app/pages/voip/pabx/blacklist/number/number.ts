import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudQuickCreateResult,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipPabxBlacklistListQuickCreateHostComponent } from '../list/list';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const matchTypes: ConfigurableCrudOption[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'regex', label: 'Regex' },
];

const actions: ConfigurableCrudOption[] = [
  { value: 'reject', label: 'Reject' },
  { value: 'busy', label: 'Busy' },
  { value: 'hangup', label: 'Hangup' },
];

function config(listFilters: readonly ConfigurableCrudListFilter[]): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/blacklist-numbers',
    uuidField: 'VbnUUID',
    pageTitle: 'Blacklist Numbers',
    pageDescription: 'Manage blocked numbers and match behavior for PABX blacklists.',
    createTitle: 'New blacklist number',
    editTitle: 'Edit blacklist number',
    dialogDescription: 'Maintain the number, match policy and SIP rejection behavior.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No blacklist numbers found.',
    deleteTitle: 'Delete blacklist number',
    deleteMessage: 'Delete this blacklist number?',
    deleteSelectedTitle: 'Delete selected blacklist numbers',
    deleteSelectedMessage: 'Delete {count} selected blacklist numbers?',
    savedMessage: 'Blacklist number saved successfully.',
    deletedMessage: 'Blacklist number deleted successfully.',
    deleteFailedMessage: 'Failed to delete blacklist number.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    listFilters,
    tabLabels: { match: 'Routing' },
    initialValues: {
      VbnEnabled: 1,
      VoipBlacklistVbkUUID: '',
      VbnNumber: '',
      VbnMatchType: 'exact',
      VbnAction: 'reject',
      VbnCause: 'CALL_REJECTED',
      VbnReason: '',
      VbnPriority: 100,
    },
    columns: [
      { id: 'number', label: 'Number', kind: 'identity', field: 'VbnNumber', uuidField: 'VbnUUID' },
      {
        id: 'blacklist',
        label: 'Blacklist',
        kind: 'related',
        field: 'VoipBlacklistVbkUUID',
        lookupKey: 'VoipBlacklistVbkUUID',
      },
      { id: 'matchType', label: 'Match type', field: 'VbnMatchType', translateValue: true },
      { id: 'action', label: 'Action', field: 'VbnAction', translateValue: true },
      { id: 'priority', label: 'Priority', kind: 'number', field: 'VbnPriority' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VbnEnabled' },
    ],
    fields: [
      { key: 'VbnEnabled', source: 'VbnEnabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'VoipBlacklistVbkUUID',
        source: 'VoipBlacklistVbkUUID',
        label: 'Blacklist',
        type: 'search-select',
        required: true,
        span: 1,
        quickCreate: {
          component: VoipPabxBlacklistListQuickCreateHostComponent,
          label: 'Create blacklist',
        },
      },
      { key: 'VbnNumber', source: 'VbnNumber', label: 'Number', required: true, span: 1 },
      {
        key: 'VbnPriority',
        source: 'VbnPriority',
        label: 'Priority',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'VbnMatchType',
        source: 'VbnMatchType',
        label: 'Match type',
        type: 'select',
        options: matchTypes,
        required: true,
        tab: 'match',
        span: 1,
      },
      {
        key: 'VbnAction',
        source: 'VbnAction',
        label: 'Action',
        type: 'select',
        options: actions,
        required: true,
        tab: 'match',
        span: 1,
      },
      { key: 'VbnCause', source: 'VbnCause', label: 'Cause', tab: 'match', span: 1 },
      { key: 'VbnReason', source: 'VbnReason', label: 'Reason', tab: 'match', span: 1 },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-blacklist-number',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxBlacklistNumberPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly genericApi = inject(ApiService);
  private readonly blacklistOptions = signal<ConfigurableCrudOption[]>([]);

  constructor() {
    super(
      config([
        {
          key: 'VoipBlacklistVbkUUID',
          paramKey: 'blacklistUUID',
          label: 'Blacklist',
          type: 'search-select',
          span: 1,
          loading: () => this.blacklistOptions().length === 0,
        },
      ]),
    );
    void this.loadBlacklists();
  }

  override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'VoipBlacklistVbkUUID') return this.blacklistOptions();
    return super.lookupOptions(key);
  }

  protected override afterQuickCreate(
    field: { key: string },
    option: ConfigurableCrudOption,
    _result: ConfigurableCrudQuickCreateResult,
  ): void {
    if (field.key !== 'VoipBlacklistVbkUUID') return;
    this.blacklistOptions.update((current) =>
      current.some((candidate) => String(candidate.value) === String(option.value))
        ? current
        : [...current, option],
    );
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      blacklistUUID: text(payload['VoipBlacklistVbkUUID']) ?? '',
      number: text(payload['VbnNumber']) ?? '',
      matchType: text(payload['VbnMatchType']) ?? 'exact',
      action: text(payload['VbnAction']) ?? 'reject',
      cause: text(payload['VbnCause']) ?? '',
      reason: text(payload['VbnReason']) ?? '',
      priority: Number(payload['VbnPriority'] ?? 100),
      enabled: Number(payload['VbnEnabled']) === 1,
    };
  }

  private async loadBlacklists(): Promise<void> {
    const response = await this.genericApi.get<any>('voip/pabx/blacklists?status=1&limit=500');
    const rows = (response?.data?.items ?? []) as ConfigurableCrudRecord[];
    this.blacklistOptions.set(
      rows.map((row) => {
        const uuid = text(row['VbkUUID']) ?? '';
        const label = text(row['VbkName']) ?? uuid;
        const description = text(row['VbkDescription']) ?? '';
        return {
          value: uuid,
          label,
          description,
          searchText: `${label} ${description} ${uuid}`,
        };
      }),
    );
  }
}

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
