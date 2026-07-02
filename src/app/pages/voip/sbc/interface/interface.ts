import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const TYPE_OPTIONS = [
  { value: 'external', label: 'External' },
  { value: 'internal', label: 'Internal' },
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

const INTERFACE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/voip/sbc/interfaces',
  uuidField: 'VsiUUID',
  pageTitle: 'SBC interfaces',
  pageDescription: 'Manage SIP listening interfaces for SBC accounts.',
  createTitle: 'New SBC interface',
  editTitle: 'Edit SBC interface',
  dialogDescription: 'Maintain the SIP interface identity and network binding.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC interfaces found.',
  deleteTitle: 'Delete SBC interface',
  deleteMessage: 'Are you sure you want to delete this SBC interface?',
  deleteSelectedTitle: 'Delete selected SBC interfaces',
  deleteSelectedMessage: 'Delete {count} selected SBC interfaces?',
  savedMessage: 'SBC interface saved successfully.',
  deletedMessage: 'SBC interface deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC interface.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    serverUUID: '',
    type: 'external',
    name: '',
    ipAddress: '',
    port: 5060,
    transport: 'udp',
    tlsEnabled: 0,
    homerEnabled: 0,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VsiName', uuidField: 'VsiUUID' },
    {
      id: 'sbc',
      label: 'Server',
      kind: 'related',
      uuidField: 'VoipSbcServerVbsUUID',
      lookupKey: 'serverUUID',
    },
    { id: 'type', label: 'Type', field: 'VsiType' },
    { id: 'address', label: 'Address', field: 'VsiIPAddress' },
    { id: 'port', label: 'Port', field: 'VsiPort' },
    { id: 'transport', label: 'Transport', field: 'VsiTransport' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsiStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VsiStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
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
    {
      key: 'type',
      source: 'VsiType',
      payloadKey: 'type',
      label: 'Type',
      type: 'select',
      options: TYPE_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'VsiName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'ipAddress',
      source: 'VsiIPAddress',
      payloadKey: 'ipAddress',
      label: 'IP address',
      required: true,
      tab: 'network',
      span: 1,
    },
    {
      key: 'port',
      source: 'VsiPort',
      payloadKey: 'port',
      label: 'Port',
      type: 'number',
      tab: 'network',
      span: 1,
    },
    {
      key: 'transport',
      source: 'VsiTransport',
      payloadKey: 'transport',
      label: 'Transport',
      type: 'select',
      options: TRANSPORT_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'tlsEnabled',
      source: 'VsiTlsEnabled',
      payloadKey: 'tlsEnabled',
      label: 'TLS',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'homerEnabled',
      source: 'VsiHomerEnabled',
      payloadKey: 'homerEnabled',
      label: 'Homer',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'network',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-interface',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcInterfacePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(INTERFACE_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'serverUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'serverUUID' ? this.serverOptions() : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      port: Number(payload['port'] || 0),
      tlsEnabled: Number(payload['tlsEnabled']) === 1,
      homerEnabled: Number(payload['homerEnabled']) === 1,
      status: Number(payload['status']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.serverOptions.set(
        await fetchPaged(this.rawApi, 'system/voip/sbc/servers?status=1', (row) =>
          option(row.VbsUUID, row.VbsName, [row.VbsEngine, row.VbsHostname]),
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
