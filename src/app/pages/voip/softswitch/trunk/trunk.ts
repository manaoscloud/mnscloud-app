import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const authenticationModes: ConfigurableCrudOption[] = [
  { value: 'ip_acl', label: 'IP ACL' },
  { value: 'register', label: 'Register' },
  { value: 'none', label: 'None' },
];

const trunkDirections: ConfigurableCrudOption[] = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'both', label: 'Both' },
];

const codecs: ConfigurableCrudOption[] = [
  { value: 'OPUS', label: 'OPUS' },
  { value: 'PCMU', label: 'PCMU' },
  { value: 'PCMA', label: 'PCMA' },
  { value: 'G729', label: 'G729' },
  { value: 'G722', label: 'G722' },
  { value: 'H264', label: 'H264' },
];

function codecList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

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
  tabLabels: {
    record: 'Record',
    network: 'Connection',
    routing: 'Routing',
    authentication: 'Authentication',
    limits: 'Limits',
    codecs: 'Codecs',
  },
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'host', label: 'Host', field: 'host' },
    { id: 'authenticationMode', label: 'Authentication mode', field: 'authenticationMode' },
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
    authenticationMode: 'ip_acl',
    outboundProxy: '',
    username: '',
    password: '',
    realm: '',
    fromDomain: '',
    registrationExpires: 3600,
    codecs: [],
    trustedCidrs: '',
    priority: 100,
    weight: 100,
    maxConcurrentCalls: 0,
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
      tab: 'record',
    },
    {
      key: 'status',
      source: 'status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
      tab: 'record',
    },
    { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 1, tab: 'record' },
    {
      key: 'direction',
      source: 'direction',
      payloadKey: 'direction',
      label: 'Direction',
      type: 'select',
      options: trunkDirections,
      required: true,
      span: 1,
      tab: 'routing',
    },
    { key: 'host', source: 'host', payloadKey: 'host', label: 'Host', required: true, span: 1, tab: 'network' },
    { key: 'port', source: 'port', payloadKey: 'port', label: 'Port', type: 'number', span: 1, tab: 'network' },
    { key: 'transport', source: 'transport', payloadKey: 'transport', label: 'Transport', span: 1, tab: 'network' },
    { key: 'outboundProxy', source: 'outboundProxy', payloadKey: 'outboundProxy', label: 'Outbound proxy', span: 1, tab: 'network' },
    { key: 'authenticationMode', source: 'authenticationMode', payloadKey: 'authenticationMode', label: 'Authentication mode', type: 'select', options: authenticationModes, required: true, span: 1, tab: 'authentication' },
    { key: 'username', source: 'username', payloadKey: 'username', label: 'Username', requiredWhen: ({ values }) => String(values['authenticationMode']) === 'register', span: 1, tab: 'authentication', hiddenWhen: ({ values }) => String(values['authenticationMode']) !== 'register' },
    { key: 'password', source: 'password', payloadKey: 'password', label: 'Password', type: 'password', requiredWhen: ({ values }) => String(values['authenticationMode']) === 'register', span: 1, tab: 'authentication', hiddenWhen: ({ values }) => String(values['authenticationMode']) !== 'register' },
    { key: 'realm', source: 'realm', payloadKey: 'realm', label: 'Realm', span: 1, tab: 'authentication', hiddenWhen: ({ values }) => String(values['authenticationMode']) !== 'register' },
    { key: 'fromDomain', source: 'fromDomain', payloadKey: 'fromDomain', label: 'From domain', span: 1, tab: 'authentication', hiddenWhen: ({ values }) => String(values['authenticationMode']) !== 'register' },
    { key: 'registrationExpires', source: 'registrationExpires', payloadKey: 'registrationExpires', label: 'Registration expiration', type: 'number', span: 1, tab: 'authentication', hiddenWhen: ({ values }) => String(values['authenticationMode']) !== 'register' },
    {
      key: 'trustedCidrs',
      source: 'trustedCidrs',
      payloadKey: 'trustedCidrs',
      label: 'Allowed source addresses',
      type: 'textarea',
      placeholder: '198.51.100.10, 203.0.113.0/24',
      requiredWhen: ({ values }) => String(values['authenticationMode']) === 'ip_acl',
      span: 4,
      rows: 4,
      tab: 'authentication',
      hiddenWhen: ({ values }) => String(values['authenticationMode']) !== 'ip_acl',
    },
    { key: 'priority', source: 'priority', payloadKey: 'priority', label: 'Priority', type: 'number', span: 1, tab: 'limits' },
    { key: 'weight', source: 'weight', payloadKey: 'weight', label: 'Weight', type: 'number', span: 1, tab: 'limits' },
    { key: 'maxConcurrentCalls', source: 'maxConcurrentCalls', payloadKey: 'maxConcurrentCalls', label: 'Maximum concurrent calls', type: 'number', span: 1, tab: 'limits' },
    {
      key: 'codecs',
      source: 'codecs',
      payloadKey: 'codecs',
      label: 'Codecs',
      type: 'multi-select',
      options: codecs,
      span: 1,
      tab: 'codecs',
      fromRecord: (value) => codecList(value),
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
    return {
      ...payload,
      status: Number(payload['status']) === 1,
      codecs: codecList(payload['codecs']).join(',') || null,
    };
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
