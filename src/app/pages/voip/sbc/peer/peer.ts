import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const TRANSPORT_OPTIONS = [
  { value: 'udp', label: 'UDP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'tls', label: 'TLS' },
];

const YES_NO_OPTIONS = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const PEER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/peers',
  uuidField: 'VspUUID',
  pageTitle: 'SBC peers',
  pageDescription: 'Manage destination SIP peers for SBC pipes.',
  createTitle: 'New SBC peer',
  editTitle: 'Edit SBC peer',
  dialogDescription: 'Maintain destination host, registration and authentication data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC peers found.',
  deleteTitle: 'Delete SBC peer',
  deleteMessage: 'Are you sure you want to delete this SBC peer?',
  deleteSelectedTitle: 'Delete selected SBC peers',
  deleteSelectedMessage: 'Delete {count} selected SBC peers?',
  savedMessage: 'SBC peer saved successfully.',
  deletedMessage: 'SBC peer deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC peer.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    accountUUID: '',
    name: '',
    host: '',
    port: 5060,
    transport: 'udp',
    authUsername: '',
    authPassword: '',
    fromDomain: '',
    outboundProxy: '',
    failoverHost: '',
    registerEnabled: 0,
    maxConcurrentCalls: 0,
    cpsLimit: 0,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VspName', uuidField: 'VspUUID' },
    {
      id: 'sbc',
      label: 'SBC',
      kind: 'related',
      uuidField: 'VoipSbcAccountVsaUUID',
      lookupKey: 'accountUUID',
    },
    { id: 'host', label: 'Host', field: 'VspHost' },
    { id: 'port', label: 'Port', field: 'VspPort' },
    { id: 'transport', label: 'Transport', field: 'VspTransport' },
    { id: 'register', label: 'Register', field: 'VspRegisterEnabled' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VspStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VspStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'accountUUID',
      source: 'VoipSbcAccountVsaUUID',
      payloadKey: 'accountUUID',
      label: 'SBC',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'VspName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'registerEnabled',
      source: 'VspRegisterEnabled',
      payloadKey: 'registerEnabled',
      label: 'Register',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'authUsername',
      source: 'VspAuthUsername',
      payloadKey: 'authUsername',
      label: 'Auth username',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'authPassword',
      payloadKey: 'authPassword',
      label: 'Auth password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'new-password',
    },
    {
      key: 'host',
      source: 'VspHost',
      payloadKey: 'host',
      label: 'Host',
      required: true,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'port',
      source: 'VspPort',
      payloadKey: 'port',
      label: 'Port',
      type: 'number',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'transport',
      source: 'VspTransport',
      payloadKey: 'transport',
      label: 'Transport',
      type: 'select',
      options: TRANSPORT_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'fromDomain',
      source: 'VspFromDomain',
      payloadKey: 'fromDomain',
      label: 'From domain',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'outboundProxy',
      source: 'VspOutboundProxy',
      payloadKey: 'outboundProxy',
      label: 'Outbound proxy',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'failoverHost',
      source: 'VspFailoverHost',
      payloadKey: 'failoverHost',
      label: 'Failover host',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'maxConcurrentCalls',
      source: 'VspMaxConcurrentCalls',
      payloadKey: 'maxConcurrentCalls',
      label: 'Max concurrent calls',
      type: 'number',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'cpsLimit',
      source: 'VspCpsLimit',
      payloadKey: 'cpsLimit',
      label: 'CPS limit',
      type: 'number',
      tab: 'authentication',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-peer',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcPeerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(PEER_CONFIG);
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
      port: Number(payload['port'] || 0),
      registerEnabled: Number(payload['registerEnabled']) === 1,
      maxConcurrentCalls: Number(payload['maxConcurrentCalls'] || 0),
      cpsLimit: Number(payload['cpsLimit'] || 0),
      status: Number(payload['status']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.accountOptions.set(
        await fetchPaged(this.rawApi, 'voip/sbc/accounts?status=1', (row) =>
          option(row.VsaUUID, row.VsaName, [row.ServerName, row.ServerEngine]),
        ),
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

async function fetchPaged(
  api: ApiService,
  endpoint: string,
  mapItem: (row: any) => ConfigurableCrudOption | null,
): Promise<ConfigurableCrudOption[]> {
  const options: ConfigurableCrudOption[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await api.get<any>(`${endpoint}${separator}limit=500&offset=${offset}`);
    const rows = extractItems(response);
    options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
    if (rows.length < 500) break;
  }
  return options.sort((left, right) => left.label.localeCompare(right.label));
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
