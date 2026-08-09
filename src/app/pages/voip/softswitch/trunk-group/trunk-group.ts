import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const strategies: ConfigurableCrudOption[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'weighted', label: 'Weighted' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'least_cost', label: 'Least cost' },
  { value: 'quality', label: 'Quality' },
];

const directions: ConfigurableCrudOption[] = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'both', label: 'Both' },
];

const CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/trunk-groups',
  uuidField: 'uuid',
  pageTitle: 'Softswitch trunk groups',
  pageDescription: 'Manage carrier trunk groups for routing and failover.',
  createTitle: 'New trunk group',
  editTitle: 'Edit trunk group',
  dialogDescription: 'Maintain trunk group strategy, direction and failover policy.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No trunk groups found.',
  deleteTitle: 'Delete trunk group',
  deleteMessage: 'Are you sure you want to delete this trunk group?',
  deleteSelectedTitle: 'Delete selected trunk groups',
  deleteSelectedMessage: 'Delete {count} selected trunk groups?',
  savedMessage: 'Trunk group saved successfully.',
  deletedMessage: 'Trunk group deleted successfully.',
  deleteFailedMessage: 'Failed to delete trunk group.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'strategy', label: 'Strategy', field: 'strategy' },
    { id: 'direction', label: 'Direction', field: 'direction' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    accountUUID: '',
    name: '',
    strategy: 'priority',
    direction: 'outbound',
    maxConcurrentCalls: 0,
    failoverSipCodes: '408,480,500,502,503,504',
    status: 1,
  },
  fields: [
    { key: 'accountUUID', source: 'accountUUID', payloadKey: 'accountUUID', label: 'Softswitch', type: 'search-select', required: true, span: 1 },
    { key: 'status', source: 'status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'strategy', source: 'strategy', payloadKey: 'strategy', label: 'Strategy', type: 'select', options: strategies, required: true, span: 1, tab: 'routing' },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', type: 'select', options: directions, required: true, span: 1, tab: 'routing' },
    { key: 'maxConcurrentCalls', source: 'maxConcurrentCalls', payloadKey: 'maxConcurrentCalls', label: 'Maximum concurrent calls', type: 'number', span: 1, tab: 'limits' },
    { key: 'failoverSipCodes', source: 'failoverSipCodes', payloadKey: 'failoverSipCodes', label: 'Failover SIP codes', span: 1, tab: 'routing' },
  ],
};

@Component({
  selector: 'app-voip-softswitch-trunk-group',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchTrunkGroupPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'accountUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'accountUUID' ? this.accountOptions() : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) === 1 };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const response = await this.rawApi.get<any>('voip/softswitch/accounts?status=1&limit=5000&offset=0');
      this.accountOptions.set(toOptions(response, (row) => option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName])));
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
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
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
