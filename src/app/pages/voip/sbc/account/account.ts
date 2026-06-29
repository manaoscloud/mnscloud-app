import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const YES_NO_OPTIONS = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const ACCOUNT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/accounts',
  uuidField: 'VsaUUID',
  pageTitle: 'SBC',
  pageDescription: 'Manage the tenant SBC assignment linked to authorized master servers.',
  createTitle: 'New SBC',
  editTitle: 'Edit SBC',
  dialogDescription: 'Maintain tenant SBC identity and linked runtime server.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC accounts found.',
  deleteTitle: 'Delete SBC',
  deleteMessage: 'Are you sure you want to delete this SBC?',
  deleteSelectedTitle: 'Delete selected SBC accounts',
  deleteSelectedMessage: 'Delete {count} selected SBC accounts?',
  savedMessage: 'SBC saved successfully.',
  deletedMessage: 'SBC deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    isDefault: 0,
    serverUUID: '',
    name: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VsaName', uuidField: 'VsaUUID' },
    {
      id: 'server',
      label: 'Server',
      kind: 'related',
      uuidField: 'VoipSbcServerVbsUUID',
      lookupKey: 'serverUUID',
    },
    { id: 'default', label: 'Default', field: 'VsaIsDefault' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsaStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VsaStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'VsaIsDefault',
      payloadKey: 'isDefault',
      label: 'Default',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'serverUUID',
      source: 'VoipSbcServerVbsUUID',
      payloadKey: 'serverUUID',
      label: 'Server',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'VsaName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'notes',
      source: 'VsaNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-account',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(ACCOUNT_CONFIG);
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
      isDefault: Number(payload['isDefault']) === 1,
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
