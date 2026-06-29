import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const POLICY_TYPE_OPTIONS = [
  { value: 'security', label: 'Security' },
  { value: 'routing', label: 'Routing' },
  { value: 'media', label: 'Media' },
  { value: 'custom', label: 'Custom' },
];

const POLICY_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/policies',
  uuidField: 'VpoUUID',
  pageTitle: 'SBC policies',
  pageDescription: 'Manage SBC policy rules for tenant traffic.',
  createTitle: 'New SBC policy',
  editTitle: 'Edit SBC policy',
  dialogDescription: 'Maintain policy type, priority and JSON configuration.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC policies found.',
  deleteTitle: 'Delete SBC policy',
  deleteMessage: 'Are you sure you want to delete this SBC policy?',
  deleteSelectedTitle: 'Delete selected SBC policies',
  deleteSelectedMessage: 'Delete {count} selected SBC policies?',
  savedMessage: 'SBC policy saved successfully.',
  deletedMessage: 'SBC policy deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC policy.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    serverUUID: '',
    status: 1,
    type: 'security',
    name: '',
    priority: 100,
    config: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VpoName', uuidField: 'VpoUUID' },
    {
      id: 'server',
      label: 'Server',
      kind: 'related',
      uuidField: 'VoipSbcServerVbsUUID',
      lookupKey: 'serverUUID',
    },
    { id: 'type', label: 'Type', field: 'VpoType' },
    { id: 'priority', label: 'Priority', field: 'VpoPriority' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VpoStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'serverUUID',
      source: 'VoipSbcServerVbsUUID',
      payloadKey: 'serverUUID',
      label: 'Server',
      type: 'search-select',
      span: 1,
    },
    {
      key: 'status',
      source: 'VpoStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'type',
      source: 'VpoType',
      payloadKey: 'type',
      label: 'Type',
      type: 'select',
      options: POLICY_TYPE_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'VpoName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'priority',
      source: 'VpoPriority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
    },
    {
      key: 'config',
      source: 'VpoConfig',
      payloadKey: 'config',
      label: 'Config JSON',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
      format: 'json',
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-policy',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcPolicyPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(POLICY_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'serverUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.serverOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      priority: Number(payload['priority'] || 0),
      status: Number(payload['status']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.serverOptions.set(
        await this.fetchPaged('voip/sbc/servers?status=1', (row) =>
          option(row.VbsUUID, row.VbsName, [row.VbsEngine, row.VbsHostname, row.VbsPublicIP]),
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
