import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudQuickCreateResult,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';
import { ErpCustomerQuickCreateHostComponent } from '../../../erp/customer/customer';

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
    pageTitle: 'Softswitch',
    pageDescription: 'Manage the tenant Softswitch identity and runtime assignment.',
    createTitle: 'New Softswitch',
    editTitle: 'Edit Softswitch',
    dialogDescription: 'Maintain the tenant account identity used by the Softswitch runtime.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No Softswitch accounts found.',
    deleteTitle: 'Delete Softswitch',
    deleteMessage: 'Delete this Softswitch?',
    deleteSelectedTitle: 'Delete selected Softswitch accounts',
    deleteSelectedMessage: 'Delete {count} selected Softswitch accounts?',
    savedMessage: 'Softswitch saved successfully.',
    deletedMessage: 'Softswitch deleted successfully.',
    deleteFailedMessage: 'Failed to delete Softswitch.',
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
        quickCreate: {
          label: 'Create customer',
          component: ErpCustomerQuickCreateHostComponent,
        },
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
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['serverUUID', 'customerUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.serverOptions();
    if (key === 'customerUUID') return this.customerOptions();
    return [];
  }

  protected override afterQuickCreate(
    field: ConfigurableCrudField,
    option: ConfigurableCrudOption,
    _result: ConfigurableCrudQuickCreateResult,
  ): void {
    if (field.key !== 'customerUUID') return;
    this.customerOptions.update((items) => mergeOption(items, option));
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
      const [servers, customers] = await Promise.all([
        this.fetchPaged('voip/softswitch/servers?status=1', (row) =>
          option(row['VsrUUID'], row['VsrName'], [
            row['VsrEngine'],
            row['VsrHostname'],
            row['VsrPublicIP'],
          ]),
        ),
        this.fetchPaged('erp/customers?status=1', (row) =>
          option(
            row['CusUUID'] ?? row['CustomerCusUUID'] ?? row['CustomerUUID'],
            row['CusName'] ?? row['Name'] ?? row['CustomerName'],
            [row['CusDocument'] ?? row['Document'], row['CusEmail'] ?? row['Email']],
          ),
        ),
      ]);
      this.serverOptions.set(servers);
      this.customerOptions.set(customers);
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
  if (value?.data && Array.isArray((value.data as { items?: unknown }).items)) {
    return (value.data as { items: ConfigurableCrudRecord[] }).items;
  }
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

function mergeOption(
  items: readonly ConfigurableCrudOption[],
  option: ConfigurableCrudOption,
): ConfigurableCrudOption[] {
  if (items.some((item) => item.value === option.value)) return [...items];
  return [...items, option].sort((left, right) => left.label.localeCompare(right.label));
}
