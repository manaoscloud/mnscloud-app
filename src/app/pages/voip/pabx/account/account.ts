import { Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudQuickCreateResult,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ErpCustomerQuickCreateHostComponent } from '../../../erp/customer/customer';
import { HostingStorageAccountsQuickCreateHostComponent } from '../../../hosting/storage/accounts/accounts';
import { VoipPabxBlacklistListQuickCreateHostComponent } from '../blacklist/list/list';
import { VoipPabxDialPlanPlanQuickCreateHostComponent } from '../dial-plan/plan/plan';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const storageModes: ConfigurableCrudOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'filesystem', label: 'Filesystem' },
  { value: 'storage', label: 'Storage' },
];

const deliveryModes: ConfigurableCrudOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
];

const timezones: ConfigurableCrudOption[] = [
  { value: '', label: 'Tenant/System default' },
  { value: 'UTC', label: 'UTC - Coordinated Universal Time' },
  { value: 'America/Sao_Paulo', label: 'São Paulo, Brazil' },
  { value: 'America/Manaus', label: 'Manaus, Brazil' },
  { value: 'America/Boa_Vista', label: 'Boa Vista, Brazil' },
  { value: 'America/Campo_Grande', label: 'Campo Grande, Brazil' },
  { value: 'America/Cuiaba', label: 'Cuiabá, Brazil' },
  { value: 'America/Rio_Branco', label: 'Rio Branco, Brazil' },
  { value: 'America/Fortaleza', label: 'Fortaleza, Brazil' },
  { value: 'America/Recife', label: 'Recife, Brazil' },
  { value: 'America/Bahia', label: 'Bahia, Brazil' },
  { value: 'America/Belem', label: 'Belém, Brazil' },
  { value: 'America/New_York', label: 'New York, United States' },
  { value: 'America/Chicago', label: 'Chicago, United States' },
  { value: 'America/Denver', label: 'Denver, United States' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, United States' },
  { value: 'America/Mexico_City', label: 'Mexico City, Mexico' },
  { value: 'America/Bogota', label: 'Bogotá, Colombia' },
  { value: 'America/Lima', label: 'Lima, Peru' },
  { value: 'America/Santiago', label: 'Santiago, Chile' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires, Argentina' },
  { value: 'Europe/Lisbon', label: 'Lisbon, Portugal' },
  { value: 'Europe/London', label: 'London, United Kingdom' },
  { value: 'Europe/Madrid', label: 'Madrid, Spain' },
  { value: 'Europe/Paris', label: 'Paris, France' },
  { value: 'Europe/Berlin', label: 'Berlin, Germany' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/accounts',
    uuidField: 'VpaUUID',
    pageTitle: 'PABX',
    pageDescription: 'Manage tenant PABX accounts and their runtime bindings.',
    createTitle: 'New PABX',
    editTitle: 'Edit PABX',
    dialogDescription: 'Maintain the PABX identity, routing and storage.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No PABX accounts found.',
    deleteTitle: 'Delete PABX',
    deleteMessage: 'Delete this PABX?',
    deleteSelectedTitle: 'Delete selected PABX',
    deleteSelectedMessage: 'Delete {count} selected PABX records?',
    savedMessage: 'PABX saved successfully.',
    deletedMessage: 'PABX deleted successfully.',
    deleteFailedMessage: 'Failed to delete PABX.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: {
      record: 'Registration',
      routing: 'Routing',
      storage: 'Storage',
    },
    initialValues: {
      isActive: 1,
      name: '',
      serverUUID: '',
      customerUUID: '',
      dialPlanUUID: '',
      blacklistUUID: '',
      timezone: '',
      recordingStorageMode: 'default',
      storageAccountUUID: '',
      mediaStorageMode: 'default',
      mediaStorageAccountUUID: '',
      mediaDeliveryMode: 'default',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'VpaName', uuidField: 'VpaUUID' },
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
        uuidField: 'VoipPabxServerVpsUUID',
        lookupKey: 'serverUUID',
      },
      {
        id: 'dialPlan',
        label: 'Dial Plan',
        kind: 'related',
        uuidField: 'VoipPabxDialPlanVdpUUID',
        lookupKey: 'dialPlanUUID',
      },
      { id: 'status', label: 'Status', kind: 'status', field: 'VpaIsActive' },
    ],
    fields: [
      {
        key: 'isActive',
        source: 'VpaIsActive',
        payloadKey: 'isActive',
        label: 'Status',
        type: 'search-select',
        options: statuses,
        span: 1,
      },
      {
        key: 'serverUUID',
        source: 'VoipPabxServerVpsUUID',
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
        source: 'VpaName',
        payloadKey: 'name',
        label: 'Name',
        required: true,
        span: 1,
      },
      {
        key: 'timezone',
        source: 'VpaTimezone',
        payloadKey: 'timezone',
        label: 'Timezone',
        type: 'search-select',
        options: timezones,
        span: 1,
      },
      {
        key: 'dialPlanUUID',
        source: 'VoipPabxDialPlanVdpUUID',
        payloadKey: 'dialPlanUUID',
        label: 'Dial Plan',
        type: 'search-select',
        required: true,
        tab: 'routing',
        span: 1,
        quickCreate: {
          label: 'Create dial plan',
          component: VoipPabxDialPlanPlanQuickCreateHostComponent,
        },
      },
      {
        key: 'blacklistUUID',
        source: 'VoipBlacklistVbkUUID',
        payloadKey: 'blacklistUUID',
        label: 'Inbound blacklist',
        type: 'search-select',
        tab: 'routing',
        span: 1,
        quickCreate: {
          label: 'Create blacklist',
          component: VoipPabxBlacklistListQuickCreateHostComponent,
        },
      },
      {
        key: 'recordingStorageMode',
        source: 'VpaRecordingStorageMode',
        payloadKey: 'recordingStorageMode',
        label: 'Recording storage',
        type: 'search-select',
        options: storageModes,
        tab: 'storage',
        span: 1,
      },
      {
        key: 'storageAccountUUID',
        source: 'HostingStorageAccountHsaUUID',
        payloadKey: 'storageAccountUUID',
        label: 'Recording storage account',
        type: 'search-select',
        tab: 'storage',
        span: 1,
        hiddenWhen: ({ values }) => values['recordingStorageMode'] !== 'storage',
        requiredWhen: ({ values }) => values['recordingStorageMode'] === 'storage',
        quickCreate: {
          label: 'Create storage account',
          component: HostingStorageAccountsQuickCreateHostComponent,
        },
      },
      {
        key: 'mediaStorageMode',
        source: 'VpaMediaStorageMode',
        payloadKey: 'mediaStorageMode',
        label: 'Media file storage',
        type: 'search-select',
        options: storageModes,
        tab: 'storage',
        span: 1,
      },
      {
        key: 'mediaStorageAccountUUID',
        source: 'MediaHostingStorageAccountHsaUUID',
        payloadKey: 'mediaStorageAccountUUID',
        label: 'Media file storage account',
        type: 'search-select',
        tab: 'storage',
        span: 1,
        hiddenWhen: ({ values }) => values['mediaStorageMode'] !== 'storage',
        requiredWhen: ({ values }) => values['mediaStorageMode'] === 'storage',
        quickCreate: {
          label: 'Create storage account',
          component: HostingStorageAccountsQuickCreateHostComponent,
        },
      },
      {
        key: 'mediaDeliveryMode',
        source: 'VpaMediaDeliveryMode',
        payloadKey: 'mediaDeliveryMode',
        label: 'Media delivery',
        type: 'search-select',
        options: deliveryModes,
        tab: 'storage',
        span: 1,
        breakBefore: true,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-account',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly customerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly dialPlanOptions = signal<ConfigurableCrudOption[]>([]);
  readonly blacklistOptions = signal<ConfigurableCrudOption[]>([]);
  readonly storageAccountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return (
      [
        'serverUUID',
        'customerUUID',
        'dialPlanUUID',
        'blacklistUUID',
        'storageAccountUUID',
        'mediaStorageAccountUUID',
      ].includes(field.key) && this.lookupsLoading()
    );
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.serverOptions();
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'dialPlanUUID') return this.dialPlanOptions();
    if (key === 'blacklistUUID') return this.blacklistOptions();
    if (key === 'storageAccountUUID' || key === 'mediaStorageAccountUUID')
      return this.storageAccountOptions();
    return [];
  }

  protected override afterQuickCreate(
    field: ConfigurableCrudField,
    option: ConfigurableCrudOption,
    _result: ConfigurableCrudQuickCreateResult,
  ): void {
    switch (field.key) {
      case 'customerUUID':
        this.customerOptions.update((items) => mergeOption(items, option));
        break;
      case 'dialPlanUUID':
        this.dialPlanOptions.update((items) => mergeOption(items, option));
        break;
      case 'blacklistUUID':
        this.blacklistOptions.update((items) => mergeOption(items, option));
        break;
      case 'storageAccountUUID':
      case 'mediaStorageAccountUUID':
        this.storageAccountOptions.update((items) => mergeOption(items, option));
        break;
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      isActive: Number(payload['isActive']) === 1,
      blacklistUUID: payload['blacklistUUID'] || null,
      storageAccountUUID:
        payload['recordingStorageMode'] === 'storage'
          ? payload['storageAccountUUID'] || null
          : null,
      mediaStorageAccountUUID:
        payload['mediaStorageMode'] === 'storage'
          ? payload['mediaStorageAccountUUID'] || null
          : null,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [servers, customers, dialPlans, blacklists, storageAccounts] = await Promise.all([
        this.fetchPaged('voip/pabx/servers?status=1', (row) =>
          option(row.VpsUUID, row.VpsName, [row.VpsEngine, row.VpsHostname, row.VpsPublicIPv4]),
        ),
        this.fetchPaged('erp/customers?status=1', (row) =>
          option(row.CustomerUUID ?? row.CusUUID, row.Name ?? row.CustomerName ?? row.CusName, [
            row.Document,
            row.Email,
          ]),
        ),
        this.fetchPaged('voip/pabx/dial-plans?status=1', (row) =>
          option(row.uuid ?? row.VdpUUID, row.name ?? row.VdpName),
        ),
        this.fetchPaged('voip/pabx/blacklists?status=1', (row) =>
          option(row.VbkUUID ?? row.uuid, row.VbkName ?? row.name),
        ),
        this.fetchPaged('hosting/storage/accounts?status=1', (row) =>
          option(row.HsaUUID ?? row.uuid, row.HsaName ?? row.name, [row.HspName, row.HspProvider]),
        ),
      ]);
      this.serverOptions.set(servers);
      this.customerOptions.set(customers);
      this.dialPlanOptions.set(dialPlans);
      this.blacklistOptions.set(blacklists);
      this.storageAccountOptions.set(storageAccounts);
    } finally {
      this.lookupsLoading.set(false);
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

@Component({
  selector: 'app-voip-pabx-account-quick-create-host',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: [
    '../../../../shared/crud/configurable-crud/configurable-crud-page.scss',
    '../../../erp/customer/customer-quick-create-host.scss',
  ],
})
export class VoipPabxAccountQuickCreateHostComponent extends VoipPabxAccountPage {
  private readonly quickDialogRef = inject(
    MatDialogRef<VoipPabxAccountQuickCreateHostComponent, ConfigurableCrudQuickCreateResult>,
  );
  private savingFromQuickCreate = false;

  constructor() {
    super();
    queueMicrotask(() => this.startCreate());
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    this.savingFromQuickCreate = true;
    try {
      await super.saveItem(saveAndNew);
    } finally {
      this.savingFromQuickCreate = false;
    }
  }

  override closeDialog(): void {
    super.closeDialog();
    if (!this.savingFromQuickCreate) {
      this.quickDialogRef.close({ option: null });
    }
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    await super.afterSave(context);
    if (context.mode !== 'create') return;
    this.quickDialogRef.close({
      option: pabxAccountOptionFromResponse(context.response, context.payload),
      response: context.response,
      payload: context.payload,
    });
  }
}

function pabxAccountOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractRecord(response) ?? payload;
  const uuid = text(record['VpaUUID']) ?? text(record['uuid']);
  const label = text(record['VpaName']) ?? text(record['name']) ?? text(payload['name']) ?? uuid;
  if (!uuid || !label) return null;
  const server = text(record['VpsName']) ?? text(record['serverName']);
  const customer = text(record['CustomerName']) ?? text(record['customerName']);
  const description = [server, customer].filter(Boolean).join(' - ');
  return {
    value: uuid,
    label,
    description,
    searchText: `${label} ${description} ${uuid}`,
  };
}

function extractRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as { data?: unknown; item?: unknown; record?: unknown } | null | undefined;
  const data = value?.data as { item?: unknown; record?: unknown; data?: unknown } | undefined;
  const candidates = [
    data?.item,
    data?.record,
    data?.data,
    value?.data,
    value?.item,
    value?.record,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') return candidate as ConfigurableCrudRecord;
  }
  return null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}
