import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
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
  { value: 'none', label: 'Reserved / no route' },
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
  tabLabels: {
    record: 'Record',
    routing: 'Routing',
  },
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    accountUUID: '',
    didUUID: '',
    subscriberUUID: '',
    trunkUUID: '',
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
    { id: 'trunk', label: 'Trunk', field: 'TrunkName' },
    { id: 'direction', label: 'Direction', field: 'VsdDirection' },
    { id: 'routeType', label: 'Route type', field: 'VsdRouteType' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsdEnabled', className: 'status-col' },
  ],
  fields: [
    {
      key: 'enabled',
      source: 'VsdEnabled',
      payloadKey: 'enabled',
      label: 'Status',
      type: 'status',
      span: 1,
    },
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
      key: 'didUUID',
      source: 'VoipDidVddUUID',
      payloadKey: 'didUUID',
      label: 'DID',
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
      requiredWhen: ({ values }) => values['routeType'] === 'subscriber',
      hiddenWhen: ({ values }) => values['routeType'] !== 'subscriber',
      span: 1,
    },
    {
      key: 'direction',
      source: 'VsdDirection',
      payloadKey: 'direction',
      label: 'Direction',
      type: 'select',
      options: DIRECTION_OPTIONS,
      tab: 'routing',
      span: 1,
    },
    {
      key: 'routeType',
      source: 'VsdRouteType',
      payloadKey: 'routeType',
      label: 'Route type',
      type: 'select',
      options: ROUTE_TYPE_OPTIONS,
      tab: 'routing',
      span: 1,
    },
    {
      key: 'trunkUUID',
      source: 'VoipSoftswitchTrunkVtkUUID',
      payloadKey: 'trunkUUID',
      label: 'Trunk',
      type: 'search-select',
      placeholder: 'Select an outbound trunk from the selected Softswitch.',
      requiredWhen: ({ values }) => values['routeType'] === 'trunk',
      hiddenWhen: ({ values }) => values['routeType'] !== 'trunk',
      tab: 'routing',
      span: 1,
    },
    {
      key: 'routeValue',
      source: 'VsdRouteValue',
      payloadKey: 'routeValue',
      label: 'Route value',
      placeholder: 'Route value is used for external targets.',
      tab: 'routing',
      requiredWhen: ({ values }) => values['routeType'] === 'external',
      hiddenWhen: ({ values }) => values['routeType'] !== 'external',
      span: 1,
    },
    {
      key: 'description',
      source: 'VsdDescription',
      payloadKey: 'description',
      label: 'Description',
      span: 4,
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
  readonly didOptions = signal<ConfigurableCrudOption[]>([]);
  readonly subscriberOptions = signal<ConfigurableCrudOption[]>([]);
  readonly trunkOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(DID_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return ['accountUUID', 'didUUID', 'subscriberUUID', 'trunkUUID'].includes(field.key)
      ? this.lookupLoading()
      : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'accountUUID') return this.accountOptions();
    if (key === 'didUUID') return this.didOptions();
    if (key === 'subscriberUUID') return this.subscriberOptions();
    if (key === 'trunkUUID') return this.trunkOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const routeType = String(payload['routeType'] ?? '').trim().toLowerCase();
    return {
      ...payload,
      subscriberUUID: routeType === 'subscriber' ? payload['subscriberUUID'] : null,
      trunkUUID: routeType === 'trunk' ? payload['trunkUUID'] : null,
      routeValue: routeType === 'external' ? payload['routeValue'] : null,
      enabled: Number(payload['enabled']) === 1,
    };
  }

  override fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    if (field.key !== 'subscriberUUID' && field.key !== 'trunkUUID') return super.fieldOptions(field);
    const accountUUID = String(this.fieldValue('accountUUID') ?? '').trim();
    const options = field.key === 'subscriberUUID' ? this.subscriberOptions() : this.trunkOptions();
    if (!accountUUID) return options;
    return options.filter((item) => String((item as any).accountUUID ?? '') === accountUUID);
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const [accounts, dids, subscribers, trunks] = await Promise.all([
        this.fetchPaged('voip/softswitch/accounts?status=1', (row) =>
          option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName]),
        ),
        this.fetchDidOptions(),
        this.fetchPaged('voip/softswitch/subscribers?status=1', (row) =>
          option(row.VsuUUID, subscriberLookupLabel(row), [row.DomainName], {
            accountUUID: row.VoipSoftswitchAccountVssUUID,
          }),
        ),
        this.fetchPaged('voip/softswitch/trunks?status=1', (row) => {
          const direction = String(row.direction ?? '').toLowerCase();
          if (direction !== 'outbound' && direction !== 'both') return null;
          return option(row.uuid, row.name, [row.host, row.transport], {
            accountUUID: row.accountUUID,
          });
        }),
      ]);
      this.accountOptions.set(accounts);
      this.didOptions.set(dids);
      this.subscriberOptions.set(subscribers);
      this.trunkOptions.set(trunks);
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

  private async fetchDidOptions(): Promise<ConfigurableCrudOption[]> {
    const [globalDids, externalDids] = await Promise.all([
      this.fetchPaged('voip/did/numbers?status=1', (row) =>
        option(row.VddUUID, row.VddNumber, ['MNSCloud', row.CustomerName || row.OperatorName]),
      ),
      this.fetchPaged('voip/did/external?status=1', (row) => {
        const validation = String(row.VddValidationStatus ?? '').toUpperCase();
        if (validation !== 'ACTIVE') return null;
        return option(row.VddUUID, row.VddNumber, ['External', row.OperatorName]);
      }),
    ]);
    const byValue = new Map<string, ConfigurableCrudOption>();
    for (const item of [...globalDids, ...externalDids]) byValue.set(String(item.value), item);
    return [...byValue.values()].sort((left, right) => left.label.localeCompare(right.label));
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
  extra: Record<string, unknown> = {},
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
    ...extra,
  };
}

function subscriberLookupLabel(row: any): string {
  const customerName = String(row?.CustomerName ?? '').trim();
  const username = String(row?.VsuUsername ?? '').trim();
  return [customerName, username].filter(Boolean).join(' — ');
}
