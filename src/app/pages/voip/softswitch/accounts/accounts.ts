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

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const yesNo: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/softswitch/accounts',
    uuidField: 'VssUUID',
    pageTitle: 'Softswitch accounts',
    pageDescription: 'Manage tenant Softswitch accounts and their runtime identity.',
    createTitle: 'New Softswitch account',
    editTitle: 'Edit Softswitch account',
    dialogDescription: 'Maintain the tenant account identity used by the Softswitch runtime.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No Softswitch accounts found.',
    deleteTitle: 'Delete Softswitch account',
    deleteMessage: 'Delete this Softswitch account?',
    deleteSelectedTitle: 'Delete selected Softswitch accounts',
    deleteSelectedMessage: 'Delete {count} selected Softswitch accounts?',
    savedMessage: 'Softswitch account saved successfully.',
    deletedMessage: 'Softswitch account deleted successfully.',
    deleteFailedMessage: 'Failed to delete Softswitch account.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    initialValues: {
      isActive: 1,
      isDefault: 0,
      customerUUID: '',
      name: '',
      serverUUID: '',
      domainUUID: '',
      notes: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'VssName', uuidField: 'VssUUID' },
      {
        id: 'customer',
        label: 'Customer',
        kind: 'related',
        uuidField: 'CustomerCusUUID',
        lookupKey: 'customerUUID',
      },
      {
        id: 'domain',
        label: 'Domain',
        kind: 'related',
        uuidField: 'VoipDomainVdmUUID',
        lookupKey: 'domainUUID',
      },
      {
        id: 'server',
        label: 'Server',
        kind: 'related',
        uuidField: 'VoipSoftswitchServerVsrUUID',
        lookupKey: 'serverUUID',
      },
      { id: 'default', label: 'Default', kind: 'boolean', field: 'VssIsDefault' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VssIsActive' },
    ],
    fields: [
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
        options: yesNo,
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
        key: 'name',
        source: 'VssName',
        payloadKey: 'name',
        label: 'Name',
        required: true,
        span: 1,
      },
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
        key: 'domainUUID',
        source: 'VoipDomainVdmUUID',
        payloadKey: 'domainUUID',
        label: 'Domain',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'notes',
        source: 'VssNotes',
        payloadKey: 'notes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-softswitch-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly customerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly domainOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return (
      ['serverUUID', 'customerUUID', 'domainUUID'].includes(field.key) && this.lookupsLoading()
    );
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.serverOptions();
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'domainUUID') return this.domainOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      isActive: Number(payload['isActive']) === 1,
      isDefault: Number(payload['isDefault']) === 1,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [servers, customers, domains] = await Promise.all([
        this.fetchPaged('voip/softswitch/servers?status=1', (row) =>
          option(row.VsrUUID, row.VsrName, [row.VsrEngine, row.VsrHostname, row.VsrPublicIP]),
        ),
        this.fetchPaged('erp/customers?status=1', (row) =>
          option(
            row.CusUUID ?? row.CustomerCusUUID ?? row.CustomerUUID,
            row.CusName ?? row.Name ?? row.CustomerName,
            [row.CusDocument ?? row.Document, row.CusEmail ?? row.Email],
          ),
        ),
        this.fetchPaged('voip/pabx/domains?status=1', (row) =>
          option(row.VdmUUID ?? row.VoipDomainUUID ?? row.uuid, row.VdmName ?? row.Name, [
            row.VdmDomain ?? row.Domain,
          ]),
        ),
      ]);
      this.serverOptions.set(servers);
      this.customerOptions.set(customers);
      this.domainOptions.set(domains);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: ConfigurableCrudRecord) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const options: ConfigurableCrudOption[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<unknown>(
        `${endpoint}${separator}limit=500&offset=${offset}`,
      );
      const rows = extractItems(response);
      options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < 500) break;
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }
}

function extractItems(response: unknown): ConfigurableCrudRecord[] {
  const value = response as { data?: { items?: unknown } | unknown; items?: unknown } | null;
  if (Array.isArray(value?.data && (value.data as { items?: unknown }).items)) {
    return (value.data as { items: ConfigurableCrudRecord[] }).items;
  }
  if (Array.isArray(value?.data)) return value.data as ConfigurableCrudRecord[];
  if (Array.isArray(value?.items)) return value.items as ConfigurableCrudRecord[];
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
