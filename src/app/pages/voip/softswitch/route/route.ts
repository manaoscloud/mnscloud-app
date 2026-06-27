import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const ROUTE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/routes',
  uuidField: 'uuid',
  pageTitle: 'Softswitch routes',
  pageDescription: 'Register prefix and pattern routing rules.',
  createTitle: 'New route',
  editTitle: 'Edit route',
  dialogDescription: 'Maintain route data for this tenant Softswitch.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No routes found.',
  deleteTitle: 'Delete route',
  deleteMessage: 'Are you sure you want to delete this route?',
  deleteSelectedTitle: 'Delete selected routes',
  deleteSelectedMessage: 'Delete {count} selected routes?',
  savedMessage: 'Route saved successfully.',
  deletedMessage: 'Route deleted successfully.',
  deleteFailedMessage: 'Failed to delete route.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    accountUUID: '',
    name: '',
    prefix: '',
    direction: 'outbound',
    priority: 100,
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
    {
      key: 'prefix',
      source: 'prefix',
      payloadKey: 'prefix',
      label: 'Prefix',
      required: true,
      span: 1,
    },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', span: 1 },
    {
      key: 'priority',
      source: 'priority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-route',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchRoutePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(ROUTE_CONFIG);
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
