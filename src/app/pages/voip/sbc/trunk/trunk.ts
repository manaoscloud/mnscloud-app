import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'both', label: 'Both' },
];

const TRANSPORT_OPTIONS = [
  { value: 'udp', label: 'UDP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'tls', label: 'TLS' },
];

const YES_NO_OPTIONS = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const TRUNK_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/trunks',
  uuidField: 'VstUUID',
  pageTitle: 'SBC trunks',
  pageDescription: 'Manage tenant SBC trunks and interconnects.',
  createTitle: 'New SBC trunk',
  editTitle: 'Edit SBC trunk',
  dialogDescription: 'Maintain trunk routing, transport and authentication data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC trunks found.',
  deleteTitle: 'Delete SBC trunk',
  deleteMessage: 'Are you sure you want to delete this SBC trunk?',
  deleteSelectedTitle: 'Delete selected SBC trunks',
  deleteSelectedMessage: 'Delete {count} selected SBC trunks?',
  savedMessage: 'SBC trunk saved successfully.',
  deletedMessage: 'SBC trunk deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC trunk.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    accountUUID: '',
    status: 1,
    name: '',
    direction: 'both',
    host: '',
    port: 5060,
    transport: 'udp',
    authUsername: '',
    authPassword: '',
    fromDomain: '',
    registerEnabled: 0,
    config: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VstName', uuidField: 'VstUUID' },
    {
      id: 'account',
      label: 'SBC',
      kind: 'related',
      uuidField: 'VoipSbcAccountVsaUUID',
      lookupKey: 'accountUUID',
    },
    {
      id: 'server',
      label: 'Server',
      kind: 'text',
      field: 'ServerName',
    },
    { id: 'direction', label: 'Direction', field: 'VstDirection' },
    { id: 'host', label: 'Host', field: 'VstHost' },
    { id: 'transport', label: 'Transport', field: 'VstTransport' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VstStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VstStatus',
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
    {
      key: 'direction',
      source: 'VstDirection',
      payloadKey: 'direction',
      label: 'Direction',
      type: 'select',
      options: DIRECTION_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'VstName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'authUsername',
      source: 'VstAuthUsername',
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
      source: 'VstHost',
      payloadKey: 'host',
      label: 'Host',
      required: true,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'fromDomain',
      source: 'VstFromDomain',
      payloadKey: 'fromDomain',
      label: 'From domain',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'port',
      source: 'VstPort',
      payloadKey: 'port',
      label: 'Port',
      type: 'number',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'transport',
      source: 'VstTransport',
      payloadKey: 'transport',
      label: 'Transport',
      type: 'select',
      options: TRANSPORT_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'registerEnabled',
      source: 'VstRegisterEnabled',
      payloadKey: 'registerEnabled',
      label: 'Register',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'config',
      source: 'VstConfig',
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
  selector: 'app-voip-sbc-trunk',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcTrunkPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
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
    if (key === 'accountUUID') return this.accountOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      port: Number(payload['port'] || 0),
      registerEnabled: Number(payload['registerEnabled']) === 1,
      status: Number(payload['status']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.accountOptions.set(
        await this.fetchPaged('voip/sbc/accounts?status=1', (row) =>
          option(row.VsaUUID, row.VsaName, [row.ServerName, row.ServerEngine, row.ServerPublicIP]),
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
