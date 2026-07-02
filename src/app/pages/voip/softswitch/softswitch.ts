import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudColumn,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../services/api.service';
import { VoipSoftswitchAccount } from './softswitch.service';

const ACCOUNT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/accounts',
  uuidField: 'VssUUID',
  pageTitle: 'Softswitch',
  pageDescription: 'Manage the Softswitch selected for this tenant environment.',
  createTitle: 'New Softswitch',
  editTitle: 'Edit Softswitch',
  dialogDescription: 'Bind the tenant environment to an active Softswitch server and domain.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No Softswitch accounts found.',
  deleteTitle: 'Delete Softswitch',
  deleteMessage: 'Are you sure you want to delete this Softswitch?',
  deleteSelectedTitle: 'Delete selected Softswitch accounts',
  deleteSelectedMessage: 'Delete {count} selected Softswitch accounts?',
  savedMessage: 'Softswitch saved successfully.',
  deletedMessage: 'Softswitch deleted successfully.',
  deleteFailedMessage: 'Failed to delete Softswitch.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    name: '',
    serverUUID: '',
    customerUUID: '',
    domainUUID: '',
    isActive: 1,
    isDefault: 0,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VssName', uuidField: 'VssUUID' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'domain', label: 'Domain', field: 'DomainName' },
    { id: 'server', label: 'Server', field: 'ServerName' },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'VssIsActive',
      className: 'status-col',
    },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'VssIsDefault',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'serverUUID',
      source: 'VoipSoftswitchServerVsrUUID',
      payloadKey: 'serverUUID',
      label: 'Server',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'customerUUID',
      source: 'CustomerCusUUID',
      payloadKey: 'customerUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'domainUUID',
      source: 'VoipDomainVdmUUID',
      payloadKey: 'domainUUID',
      label: 'Domain',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'VssName', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    {
      key: 'isActive',
      source: 'VssIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'VssIsDefault',
      payloadKey: 'isDefault',
      label: 'Default',
      type: 'select',
      span: 1,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
    },
    {
      key: 'notes',
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
  selector: 'app-voip-softswitch',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchPage extends ConfigurableCrudPageBase<VoipSoftswitchAccount> {
  private readonly rawApi = inject(ApiService);

  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly customerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly domainOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(ACCOUNT_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return ['serverUUID', 'customerUUID', 'domainUUID'].includes(field.key)
      ? this.lookupLoading()
      : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.serverOptions();
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'domainUUID') return this.domainOptions();
    return [];
  }

  override columnText(row: VoipSoftswitchAccount, column: ConfigurableCrudColumn): string {
    if (column.id === 'default') return row.VssIsDefault === 1 ? 'Yes' : 'No';
    return super.columnText(row, column);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      isActive: Number(payload['isActive']) === 1,
      isDefault: Number(payload['isDefault']) === 1,
      config: {},
      credentials: {},
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const [servers, customers, domains] = await Promise.all([
        this.fetchPaged('voip/softswitch/servers?status=1', (row) =>
          option(row.VsrUUID, row.VsrName, [row.VsrEngine, row.VsrHostname, row.VsrPublicIP]),
        ),
        this.fetchPaged('erp/customers?status=1', (row) =>
          option(row.CustomerUUID ?? row.customerUUID, row.Name ?? row.CustomerName, [
            row.Document,
            row.Email,
          ]),
        ),
        this.fetchPaged('voip/pabx/domains?status=1', (row) =>
          option(row.VdmUUID ?? row.VoipDomainUUID ?? row.uuid, row.VdmName ?? row.Name, [
            row.VdmDomain,
            row.Domain,
          ]),
        ),
      ]);
      this.serverOptions.set(servers);
      this.customerOptions.set(customers);
      this.domainOptions.set(domains);
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
