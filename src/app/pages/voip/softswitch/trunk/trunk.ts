import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const TRUNK_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/trunks',
  uuidField: 'uuid',
  pageTitle: 'Softswitch trunks',
  pageDescription: 'Register upstream and carrier trunks.',
  createTitle: 'New trunk',
  editTitle: 'Edit trunk',
  dialogDescription: 'Maintain trunk data for this tenant Softswitch.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No trunks found.',
  deleteTitle: 'Delete trunk',
  deleteMessage: 'Are you sure you want to delete this trunk?',
  deleteSelectedTitle: 'Delete selected trunks',
  deleteSelectedMessage: 'Delete {count} selected trunks?',
  savedMessage: 'Trunk saved successfully.',
  deletedMessage: 'Trunk deleted successfully.',
  deleteFailedMessage: 'Failed to delete trunk.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'host', label: 'Host', field: 'host' },
    { id: 'direction', label: 'Direction', field: 'direction' },
    { id: 'transport', label: 'Transport', field: 'transport' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    accountUUID: '',
    name: '',
    host: '',
    direction: 'both',
    transport: 'udp',
    port: 5060,
    trustedCidrs: '',
    status: 1,
  },
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
      key: 'status',
      source: 'status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'host', source: 'host', payloadKey: 'host', label: 'Host', required: true, span: 1 },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', span: 1 },
    { key: 'transport', source: 'transport', payloadKey: 'transport', label: 'Transport', span: 1 },
    { key: 'port', source: 'port', payloadKey: 'port', label: 'Port', type: 'number', span: 1 },
    {
      key: 'trustedCidrs',
      source: 'trustedCidrs',
      payloadKey: 'trustedCidrs',
      label: 'Trusted CIDRs',
      span: 2,
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-trunk',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchTrunkPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(TRUNK_CONFIG);
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
      this.accountOptions.set(
        await this.fetchPaged('voip/softswitch/accounts?status=1', (row) =>
          option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName]),
        ),
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: any) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const response = await this.rawApi.get<any>(`${endpoint}&limit=500&offset=0`);
    return extractItems(response)
      .map(mapItem)
      .filter(isOption)
      .sort((left, right) => left.label.localeCompare(right.label)) as ConfigurableCrudOption[];
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
