import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';
import { VoipSoftswitchDidItem } from './did.service';

const DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'both', label: 'Both' },
];

const ROUTE_TYPE_OPTIONS = [
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'external', label: 'External' },
  { value: 'trunk', label: 'Trunk' },
  { value: 'none', label: 'None' },
];

const DID_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/dids',
  uuidField: 'VsdUUID',
  pageTitle: 'Softswitch DID',
  pageDescription: 'Manage DID routing for tenant Softswitch accounts.',
  createTitle: 'New DID',
  editTitle: 'Edit DID',
  dialogDescription: 'Maintain number ownership, direction and routing target.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No DIDs found.',
  deleteTitle: 'Delete DID',
  deleteMessage: 'Are you sure you want to delete this DID?',
  deleteSelectedTitle: 'Delete selected DIDs',
  deleteSelectedMessage: 'Delete {count} selected DIDs?',
  savedMessage: 'DID saved successfully.',
  deletedMessage: 'DID deleted successfully.',
  deleteFailedMessage: 'Failed to delete DID.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    accountUUID: '',
    subscriberUUID: '',
    number: '',
    direction: 'inbound',
    routeType: 'subscriber',
    routeValue: '',
    description: '',
    enabled: 1,
  },
  columns: [
    { id: 'number', label: 'Number', kind: 'identity', field: 'VsdNumber', uuidField: 'VsdUUID' },
    { id: 'softswitch', label: 'Softswitch', field: 'SoftswitchName' },
    { id: 'subscriber', label: 'Subscriber', field: 'SubscriberUsername' },
    { id: 'direction', label: 'Direction', field: 'VsdDirection' },
    { id: 'routeType', label: 'Route type', field: 'VsdRouteType' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsdEnabled', className: 'status-col' },
  ],
  fields: [
    {
      key: 'accountUUID',
      source: 'VoipSoftswitchAccountVssUUID',
      payloadKey: 'accountUUID',
      label: 'Softswitch',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'subscriberUUID',
      source: 'VoipSoftswitchSubscriberVsuUUID',
      payloadKey: 'subscriberUUID',
      label: 'Subscriber',
      type: 'search-select',
      span: 1,
    },
    {
      key: 'enabled',
      source: 'VsdEnabled',
      payloadKey: 'enabled',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'number',
      source: 'VsdNumber',
      payloadKey: 'number',
      label: 'Number',
      required: true,
      span: 1,
    },
    {
      key: 'direction',
      source: 'VsdDirection',
      payloadKey: 'direction',
      label: 'Direction',
      type: 'select',
      options: DIRECTION_OPTIONS,
      span: 1,
    },
    {
      key: 'routeType',
      source: 'VsdRouteType',
      payloadKey: 'routeType',
      label: 'Route type',
      type: 'select',
      options: ROUTE_TYPE_OPTIONS,
      span: 1,
    },
    {
      key: 'routeValue',
      source: 'VsdRouteValue',
      payloadKey: 'routeValue',
      label: 'Route value',
      span: 1,
    },
    {
      key: 'description',
      source: 'VsdDescription',
      payloadKey: 'description',
      label: 'Description',
      span: 2,
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-did',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchDidPage extends ConfigurableCrudPageBase<VoipSoftswitchDidItem> {
  private readonly rawApi = inject(ApiService);

  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly subscriberOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(DID_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return ['accountUUID', 'subscriberUUID'].includes(field.key) ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'accountUUID') return this.accountOptions();
    if (key === 'subscriberUUID') return this.subscriberOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, enabled: Number(payload['enabled']) === 1 };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const [accounts, subscribers] = await Promise.all([
        this.fetchPaged('voip/softswitch/accounts?status=1', (row) =>
          option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName]),
        ),
        this.fetchPaged('voip/softswitch/subscribers?status=1', (row) =>
          option(row.VsuUUID, row.VsuUsername, [row.CustomerName, row.DomainName]),
        ),
      ]);
      this.accountOptions.set(accounts);
      this.subscriberOptions.set(subscribers);
    } finally {
      this.lookupLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: any) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const options: ConfigurableCrudOption[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<any>(
        `${endpoint}${separator}limit=500&offset=${offset}`,
      );
      const rows = extractItems(response);
      options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < 500) break;
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
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
