import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const yesNo: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
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

const audioCodecs: ConfigurableCrudOption[] = ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'].map(
  (value) => ({ value, label: value }),
);
const videoCodecs: ConfigurableCrudOption[] = ['H264'].map((value) => ({ value, label: value }));

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/accounts',
    uuidField: 'VpaUUID',
    pageTitle: 'PABX Accounts',
    pageDescription: 'Manage tenant PABX accounts and their runtime defaults.',
    createTitle: 'New PABX account',
    editTitle: 'Edit PABX account',
    dialogDescription: 'Maintain the PABX account identity, routing, codecs, and storage.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No PABX accounts found.',
    deleteTitle: 'Delete PABX account',
    deleteMessage: 'Delete this PABX account?',
    deleteSelectedTitle: 'Delete selected PABX accounts',
    deleteSelectedMessage: 'Delete {count} selected PABX accounts?',
    savedMessage: 'PABX account saved successfully.',
    deletedMessage: 'PABX account deleted successfully.',
    deleteFailedMessage: 'Failed to delete PABX account.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: { network: 'Routing and Storage' },
    initialValues: {
      isActive: 1,
      isDefault: 0,
      name: '',
      serverUUID: '',
      customerUUID: '',
      domainUUID: '',
      dialPlanUUID: '',
      blacklistUUID: '',
      timezone: '',
      defaultAudioCodecs: ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'],
      defaultVideoCodecs: ['H264'],
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
        id: 'domain',
        label: 'Domain',
        kind: 'related',
        uuidField: 'VoipDomainVdmUUID',
        lookupKey: 'domainUUID',
      },
      {
        id: 'dialPlan',
        label: 'Dial Plan',
        kind: 'related',
        uuidField: 'VoipPabxDialPlanVdpUUID',
        lookupKey: 'dialPlanUUID',
      },
      { id: 'status', label: 'Status', kind: 'status', field: 'VpaIsActive' },
      { id: 'default', label: 'Default', kind: 'boolean', field: 'VpaIsDefault' },
    ],
    fields: [
      {
        key: 'isActive',
        source: 'VpaIsActive',
        payloadKey: 'isActive',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'isDefault',
        source: 'VpaIsDefault',
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
        source: 'VpaName',
        payloadKey: 'name',
        label: 'Name',
        required: true,
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
        key: 'domainUUID',
        source: 'VoipDomainVdmUUID',
        payloadKey: 'domainUUID',
        label: 'Domain',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'dialPlanUUID',
        source: 'VoipPabxDialPlanVdpUUID',
        payloadKey: 'dialPlanUUID',
        label: 'Dial Plan',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'timezone',
        source: 'VpaTimezone',
        payloadKey: 'timezone',
        label: 'Timezone',
        span: 1,
      },
      {
        key: 'blacklistUUID',
        source: 'VoipBlacklistVbkUUID',
        payloadKey: 'blacklistUUID',
        label: 'Inbound blacklist',
        type: 'search-select',
        tab: 'network',
        span: 1,
      },
      {
        key: 'recordingStorageMode',
        source: 'VpaRecordingStorageMode',
        payloadKey: 'recordingStorageMode',
        label: 'Recording storage',
        type: 'select',
        options: storageModes,
        tab: 'network',
        span: 1,
      },
      {
        key: 'storageAccountUUID',
        source: 'HostingStorageAccountHsaUUID',
        payloadKey: 'storageAccountUUID',
        label: 'Recording storage account',
        type: 'search-select',
        tab: 'network',
        span: 2,
        hiddenWhen: ({ values }) => values['recordingStorageMode'] !== 'storage',
        requiredWhen: ({ values }) => values['recordingStorageMode'] === 'storage',
      },
      {
        key: 'mediaStorageMode',
        source: 'VpaMediaStorageMode',
        payloadKey: 'mediaStorageMode',
        label: 'Media file storage',
        type: 'select',
        options: storageModes,
        tab: 'network',
        span: 1,
      },
      {
        key: 'mediaStorageAccountUUID',
        source: 'MediaHostingStorageAccountHsaUUID',
        payloadKey: 'mediaStorageAccountUUID',
        label: 'Media file storage account',
        type: 'search-select',
        tab: 'network',
        span: 2,
        hiddenWhen: ({ values }) => values['mediaStorageMode'] !== 'storage',
        requiredWhen: ({ values }) => values['mediaStorageMode'] === 'storage',
      },
      {
        key: 'mediaDeliveryMode',
        source: 'VpaMediaDeliveryMode',
        payloadKey: 'mediaDeliveryMode',
        label: 'Media delivery',
        type: 'select',
        options: deliveryModes,
        tab: 'network',
        span: 1,
      },
      {
        key: 'defaultAudioCodecs',
        source: 'VpaDefaultAudioCodecs',
        payloadKey: 'defaultAudioCodecs',
        label: 'Default audio codecs',
        type: 'multi-select',
        options: audioCodecs,
        tab: 'codecs',
        span: 2,
      },
      {
        key: 'defaultVideoCodecs',
        source: 'VpaDefaultVideoCodecs',
        payloadKey: 'defaultVideoCodecs',
        label: 'Default video codecs',
        type: 'multi-select',
        options: videoCodecs,
        tab: 'codecs',
        span: 2,
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
  readonly domainOptions = signal<ConfigurableCrudOption[]>([]);
  readonly dialPlanOptions = signal<ConfigurableCrudOption[]>([]);
  readonly blacklistOptions = signal<ConfigurableCrudOption[]>([]);
  readonly storageAccountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    this.patchFormValues({
      defaultAudioCodecs: this.splitCodecs(row['VpaDefaultAudioCodecs']),
      defaultVideoCodecs: this.splitCodecs(row['VpaDefaultVideoCodecs']),
    });
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return (
      [
        'serverUUID',
        'customerUUID',
        'domainUUID',
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
    if (key === 'domainUUID') return this.domainOptions();
    if (key === 'dialPlanUUID') return this.dialPlanOptions();
    if (key === 'blacklistUUID') return this.blacklistOptions();
    if (key === 'storageAccountUUID' || key === 'mediaStorageAccountUUID')
      return this.storageAccountOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      isActive: Number(payload['isActive']) === 1,
      isDefault: Number(payload['isDefault']) === 1,
      defaultAudioCodecs: this.joinCodecs(payload['defaultAudioCodecs']),
      defaultVideoCodecs: this.joinCodecs(payload['defaultVideoCodecs']),
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

  private joinCodecs(value: unknown): string | null {
    const codecs = (Array.isArray(value) ? value : String(value ?? '').split(','))
      .map((item) => String(item).trim().toUpperCase())
      .filter(Boolean);
    return [...new Set(codecs)].join(',') || null;
  }

  private splitCodecs(value: unknown): string[] {
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [servers, customers, domains, dialPlans, blacklists, storageAccounts] =
        await Promise.all([
          this.fetchPaged('voip/pabx/servers?status=1', (row) =>
            option(row.VpsUUID, row.VpsName, [row.VpsEngine, row.VpsHostname, row.VpsPublicIPv4]),
          ),
          this.fetchPaged('erp/customers?status=1', (row) =>
            option(row.CustomerUUID ?? row.CusUUID, row.Name ?? row.CustomerName ?? row.CusName, [
              row.Document,
              row.Email,
            ]),
          ),
          this.fetchPaged('voip/pabx/domains?status=1', (row) =>
            option(row.VdmUUID ?? row.uuid, row.VdmName ?? row.name),
          ),
          this.fetchPaged('voip/pabx/dial-plans?status=1', (row) =>
            option(row.uuid ?? row.VdpUUID, row.name ?? row.VdpName, [row.code ?? row.VdpCode]),
          ),
          this.fetchPaged('voip/pabx/blacklists?status=1', (row) =>
            option(row.VbkUUID ?? row.uuid, row.VbkName ?? row.name),
          ),
          this.fetchPaged('hosting/storage/accounts?status=1', (row) =>
            option(row.HsaUUID ?? row.uuid, row.HsaName ?? row.name, [
              row.HspName,
              row.HspProvider,
            ]),
          ),
        ]);
      this.serverOptions.set(servers);
      this.customerOptions.set(customers);
      this.domainOptions.set(domains);
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
