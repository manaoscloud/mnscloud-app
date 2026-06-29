import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const ROUTE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/routes',
  uuidField: 'VbrUUID',
  pageTitle: 'SBC routes',
  pageDescription: 'Manage SBC routing rules for tenant trunks.',
  createTitle: 'New SBC route',
  editTitle: 'Edit SBC route',
  dialogDescription: 'Maintain prefix matching and destination rewriting rules.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC routes found.',
  deleteTitle: 'Delete SBC route',
  deleteMessage: 'Are you sure you want to delete this SBC route?',
  deleteSelectedTitle: 'Delete selected SBC routes',
  deleteSelectedMessage: 'Delete {count} selected SBC routes?',
  savedMessage: 'SBC route saved successfully.',
  deletedMessage: 'SBC route deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC route.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    trunkUUID: '',
    status: 1,
    name: '',
    prefix: '',
    priority: 100,
    stripDigits: 0,
    prepend: '',
    destinationPattern: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VbrName', uuidField: 'VbrUUID' },
    {
      id: 'trunk',
      label: 'Trunk',
      kind: 'related',
      uuidField: 'VoipSbcTrunkVstUUID',
      lookupKey: 'trunkUUID',
    },
    { id: 'prefix', label: 'Prefix', field: 'VbrPrefix' },
    { id: 'priority', label: 'Priority', field: 'VbrPriority' },
    { id: 'destination', label: 'Destination pattern', field: 'VbrDestinationPattern' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VbrStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'trunkUUID',
      source: 'VoipSbcTrunkVstUUID',
      payloadKey: 'trunkUUID',
      label: 'Trunk',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'status',
      source: 'VbrStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'VbrName', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'prefix', source: 'VbrPrefix', payloadKey: 'prefix', label: 'Prefix', span: 1 },
    {
      key: 'priority',
      source: 'VbrPriority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
    },
    {
      key: 'stripDigits',
      source: 'VbrStripDigits',
      payloadKey: 'stripDigits',
      label: 'Strip digits',
      type: 'number',
      span: 1,
    },
    { key: 'prepend', source: 'VbrPrepend', payloadKey: 'prepend', label: 'Prepend', span: 1 },
    {
      key: 'destinationPattern',
      source: 'VbrDestinationPattern',
      payloadKey: 'destinationPattern',
      label: 'Destination pattern',
      span: 2,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-route',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcRoutePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly trunkOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(ROUTE_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'trunkUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'trunkUUID') return this.trunkOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      priority: Number(payload['priority'] || 0),
      stripDigits: Number(payload['stripDigits'] || 0),
      status: Number(payload['status']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.trunkOptions.set(
        await this.fetchPaged('voip/sbc/trunks?status=1', (row) =>
          option(row.VstUUID, row.VstName, [row.AccountName, row.VstHost]),
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
