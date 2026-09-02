import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const directions: ConfigurableCrudOption[] = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'both', label: 'Both' },
];

const matchTypes: ConfigurableCrudOption[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'regex', label: 'Regex' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'internal', label: 'Internal' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
  { value: 'shortcode', label: 'Shortcode' },
];

const actions: ConfigurableCrudOption[] = [
  { value: 'route', label: 'Route' },
  { value: 'block', label: 'Block' },
  { value: 'reject', label: 'Reject' },
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'external', label: 'External' },
  { value: 'trunk_group', label: 'Trunk group' },
  { value: 'trunk', label: 'Trunk' },
];

const CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/dialplan-rules',
  uuidField: 'uuid',
  pageTitle: 'Softswitch dialplan rules',
  pageDescription: 'Control call matching, number normalization and routing actions.',
  createTitle: 'New dialplan rule',
  editTitle: 'Edit dialplan rule',
  dialogDescription: 'Maintain match/action logic used by the Softswitch runtime.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No dialplan rules found.',
  deleteTitle: 'Delete dialplan rule',
  deleteMessage: 'Are you sure you want to delete this rule?',
  deleteSelectedTitle: 'Delete selected dialplan rules',
  deleteSelectedMessage: 'Delete {count} selected rules?',
  savedMessage: 'Dialplan rule saved successfully.',
  deletedMessage: 'Dialplan rule deleted successfully.',
  deleteFailedMessage: 'Failed to delete dialplan rule.',
  tabLabels: { record: 'Record', match: 'Match', routing: 'Routing', transform: 'Transform' },
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'dialplan', label: 'Dialplan', field: 'dialplanName' },
    { id: 'match', label: 'Match', field: 'matchValue' },
    { id: 'action', label: 'Action', field: 'action' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    dialplanUUID: '',
    name: '',
    direction: 'outbound',
    matchType: 'prefix',
    matchValue: '',
    priority: 100,
    action: 'route',
    trunkGroupUUID: '',
    trunkUUID: '',
    stripDigits: 0,
    prepend: '',
    normalizedPrefix: '',
    failoverSipCodes: '',
    status: 1,
  },
  fields: [
    { key: 'dialplanUUID', source: 'dialplanUUID', payloadKey: 'dialplanUUID', label: 'Dialplan', type: 'search-select', required: true, span: 1, tab: 'record' },
    { key: 'status', source: 'status', payloadKey: 'status', label: 'Status', type: 'status', span: 1, tab: 'record' },
    { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 2, tab: 'record' },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', type: 'select', options: directions, required: true, span: 1, tab: 'match' },
    { key: 'matchType', source: 'matchType', payloadKey: 'matchType', label: 'Match type', type: 'select', options: matchTypes, required: true, span: 1, tab: 'match' },
    { key: 'matchValue', source: 'matchValue', payloadKey: 'matchValue', label: 'Match value', required: true, span: 1, tab: 'match' },
    { key: 'priority', source: 'priority', payloadKey: 'priority', label: 'Priority', type: 'number', span: 1, tab: 'match' },
    { key: 'action', source: 'action', payloadKey: 'action', label: 'Action', type: 'select', options: actions, required: true, span: 1, tab: 'routing' },
    { key: 'trunkGroupUUID', source: 'trunkGroupUUID', payloadKey: 'trunkGroupUUID', label: 'Trunk group', type: 'search-select', span: 1, tab: 'routing', hiddenWhen: ({ values }) => !['route', 'trunk_group'].includes(String(values['action'])) },
    { key: 'trunkUUID', source: 'trunkUUID', payloadKey: 'trunkUUID', label: 'Trunk', type: 'search-select', span: 1, tab: 'routing', hiddenWhen: ({ values }) => String(values['action']) !== 'trunk' },
    { key: 'failoverSipCodes', source: 'failoverSipCodes', payloadKey: 'failoverSipCodes', label: 'Failover SIP codes', span: 1, tab: 'routing' },
    { key: 'stripDigits', source: 'stripDigits', payloadKey: 'stripDigits', label: 'Strip digits', type: 'number', span: 1, tab: 'transform' },
    { key: 'prepend', source: 'prepend', payloadKey: 'prepend', label: 'Prepend', span: 1, tab: 'transform' },
    { key: 'normalizedPrefix', source: 'normalizedPrefix', payloadKey: 'normalizedPrefix', label: 'Normalized prefix', span: 1, tab: 'transform' },
  ],
};

@Component({
  selector: 'app-voip-softswitch-dialplan-rule',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchDialplanRulePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly dialplanOptions = signal<ConfigurableCrudOption[]>([]);
  readonly trunkGroupOptions = signal<ConfigurableCrudOption[]>([]);
  readonly trunkOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return ['dialplanUUID', 'trunkGroupUUID', 'trunkUUID'].includes(field.key) ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'dialplanUUID') return this.dialplanOptions();
    if (key === 'trunkGroupUUID') return this.trunkGroupOptions();
    if (key === 'trunkUUID') return this.trunkOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      trunkGroupUUID: payload['trunkGroupUUID'] || null,
      trunkUUID: payload['trunkUUID'] || null,
      prepend: payload['prepend'] || null,
      normalizedPrefix: payload['normalizedPrefix'] || null,
      failoverSipCodes: payload['failoverSipCodes'] || null,
      status: Number(payload['status']) === 1,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const [dialplans, groups, trunks] = await Promise.all([
        this.rawApi.get<any>('voip/softswitch/dialplans?status=1&limit=5000&offset=0'),
        this.rawApi.get<any>('voip/softswitch/trunk-groups?status=1&limit=5000&offset=0'),
        this.rawApi.get<any>('voip/softswitch/trunks?status=1&limit=5000&offset=0'),
      ]);
      this.dialplanOptions.set(toOptions(dialplans, (row) => option(row.uuid, row.name, [row.accountName, row.scope])));
      this.trunkGroupOptions.set(toOptions(groups, (row) => option(row.uuid, row.name, [row.accountName, row.strategy])));
      this.trunkOptions.set(toOptions(trunks, (row) => option(row.uuid, row.name, [row.accountName, row.host])));
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

function toOptions(response: any, mapItem: (row: any) => ConfigurableCrudOption | null): ConfigurableCrudOption[] {
  return extractItems(response).map(mapItem).filter(isOption).sort((left, right) => left.label.localeCompare(right.label));
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}

function option(value: unknown, label: unknown, descriptionParts: unknown[] = []): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts.map((item) => String(item ?? '').trim()).filter(Boolean).join(' - ');
  return { value: normalizedValue, label: normalizedLabel, description, searchText: `${normalizedLabel} ${description} ${normalizedValue}` };
}

function isOption(value: ConfigurableCrudOption | null): value is ConfigurableCrudOption {
  return Boolean(value);
}
