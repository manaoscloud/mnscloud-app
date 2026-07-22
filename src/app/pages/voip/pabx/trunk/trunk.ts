import { Component, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { runRuntimeDiagnostic } from '../../../../shared/runtime-diagnostic/runtime-diagnostic.util';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const directions: ConfigurableCrudOption[] = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'both', label: 'Both' },
];

const authModes: ConfigurableCrudOption[] = [
  { value: 'ip_acl', label: 'IP ACL' },
  { value: 'digest', label: 'Digest' },
  { value: 'register', label: 'Register' },
  { value: 'none', label: 'None' },
];

const transports: ConfigurableCrudOption[] = [
  { value: 'udp', label: 'UDP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'tls', label: 'TLS' },
];

const yesNo: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
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

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/trunks',
    uuidField: 'uuid',
    pageTitle: 'PABX Trunks',
    pageDescription: 'Manage SIP interconnections for PABX accounts.',
    createTitle: 'New PABX trunk',
    editTitle: 'Edit PABX trunk',
    dialogDescription: 'Maintain the connection, authentication and codec settings for this trunk.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No PABX trunks found.',
    deleteTitle: 'Delete PABX trunk',
    deleteMessage: 'Delete this PABX trunk?',
    deleteSelectedTitle: 'Delete selected PABX trunks',
    deleteSelectedMessage: 'Delete {count} selected PABX trunks?',
    savedMessage: 'PABX trunk saved successfully.',
    deletedMessage: 'PABX trunk deleted successfully.',
    deleteFailedMessage: 'Failed to delete PABX trunk.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    initialValues: {
      enabled: 1,
      pabxUUID: '',
      direction: 'both',
      name: '',
      host: '',
      port: 5060,
      transport: 'udp',
      priority: 100,
      authMode: 'ip_acl',
      registerEnabled: 0,
      username: '',
      password: '',
      realm: '',
      fromDomain: '',
      fromUser: '',
      allowedCidrs: '',
      codecs: [],
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      { id: 'pabx', label: 'PABX', kind: 'identity', field: 'pabxName', uuidField: 'pabxUUID' },
      { id: 'direction', label: 'Direction', kind: 'text', field: 'direction' },
      { id: 'host', label: 'Host', kind: 'text', field: 'host' },
      { id: 'authMode', label: 'Authentication mode', kind: 'text', field: 'authMode' },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    rowActions: [
      {
        key: 'runtime-status',
        label: 'Runtime status',
        tooltip: 'Inspect trunk runtime status',
        icon: 'monitoring',
      },
    ],
    tabLabels: {
      network: 'Connection',
      authentication: 'Authentication',
      codecs: 'Codecs',
    },
    fields: [
      { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'pabxUUID',
        source: 'pabxUUID',
        label: 'PABX',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'direction',
        source: 'direction',
        label: 'Direction',
        type: 'select',
        options: directions,
        required: true,
        span: 1,
      },
      { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'port',
        source: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        tab: 'network',
        span: 1,
      },
      {
        key: 'transport',
        source: 'transport',
        label: 'Transport',
        type: 'select',
        options: transports,
        required: true,
        tab: 'network',
        span: 1,
      },
      {
        key: 'priority',
        source: 'priority',
        label: 'Priority',
        type: 'number',
        tab: 'network',
        span: 1,
      },
      {
        key: 'authMode',
        source: 'authMode',
        label: 'Authentication mode',
        type: 'select',
        options: authModes,
        required: true,
        tab: 'authentication',
        span: 1,
      },
      {
        key: 'registerEnabled',
        source: 'registerEnabled',
        label: 'Register',
        type: 'select',
        options: yesNo,
        tab: 'authentication',
        span: 1,
      },
      {
        key: 'username',
        source: 'username',
        label: 'Username',
        tab: 'authentication',
        span: 1,
        breakBefore: true,
        hiddenWhen: ({ values }) => ['ip_acl', 'none'].includes(String(values['authMode'])),
        requiredWhen: ({ values }) => ['digest', 'register'].includes(String(values['authMode'])),
      },
      {
        key: 'password',
        source: 'password',
        label: 'Password',
        type: 'password',
        autocomplete: 'new-password',
        tab: 'authentication',
        span: 1,
        hiddenWhen: ({ values }) => ['ip_acl', 'none'].includes(String(values['authMode'])),
        requiredWhen: ({ values }) => ['digest', 'register'].includes(String(values['authMode'])),
      },
      {
        key: 'host',
        source: 'host',
        label: 'Host',
        required: true,
        tab: 'authentication',
        span: 1,
      },
      {
        key: 'realm',
        source: 'realm',
        label: 'Realm',
        tab: 'authentication',
        span: 1,
        breakBefore: true,
        hiddenWhen: ({ values }) => ['ip_acl', 'none'].includes(String(values['authMode'])),
      },
      {
        key: 'fromDomain',
        source: 'fromDomain',
        label: 'From domain',
        tab: 'authentication',
        span: 1,
        hiddenWhen: ({ values }) => ['ip_acl', 'none'].includes(String(values['authMode'])),
      },
      {
        key: 'fromUser',
        source: 'fromUser',
        label: 'From user',
        tab: 'authentication',
        span: 1,
        hiddenWhen: ({ values }) => ['ip_acl', 'none'].includes(String(values['authMode'])),
      },
      {
        key: 'allowedCidrs',
        source: 'allowedCidrs',
        label: 'Allowed source CIDRs',
        type: 'textarea',
        tab: 'authentication',
        span: 4,
        rows: 4,
        placeholder: 'Example: 192.0.2.0/24, 198.51.100.10',
        hiddenWhen: ({ values }) => String(values['authMode']) !== 'ip_acl',
        requiredWhen: ({ values }) => String(values['authMode']) === 'ip_acl',
      },
      {
        key: 'codecs',
        source: 'codecs',
        label: 'Codecs',
        type: 'multi-select',
        options: codecs,
        tab: 'codecs',
        span: 1,
        fromRecord: (value) => codecList(value),
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-trunk',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxTrunkPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  readonly pabxLoading = signal(false);

  constructor() {
    super(config());
    void this.loadPabxOptions();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'pabxUUID' ? this.pabxOptions() : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      registerEnabled: Number(payload['registerEnabled']) === 1,
      port: Number(payload['port']),
      priority: Number(payload['priority'] ?? 100),
      codecs: codecList(payload['codecs']).join(',') || null,
    };
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord): void {
    if (action.key !== 'runtime-status') return;
    const uuid = String(row['uuid'] ?? '').trim();
    if (!uuid) return;
    void runRuntimeDiagnostic(this.dialog, this.api, this.snack, {
      title: 'PABX trunk runtime status',
      description:
        'Read-only registration and connectivity diagnostic from the assigned PABX server.',
      startEndpoint: `voip/pabx/trunks/${uuid}/runtime-status`,
      statusEndpoint: (jobUUID) => `voip/pabx/trunks/${uuid}/runtime-status/${jobUUID}`,
    });
  }

  private async loadPabxOptions(): Promise<void> {
    this.pabxLoading.set(true);
    try {
      const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        'voip/pabx/accounts?status=1&limit=500&offset=0',
      );
      const rows = response?.data?.items ?? [];
      this.pabxOptions.set(
        rows.map((row) => ({
          value: String(row['VpaUUID'] ?? row['uuid'] ?? ''),
          label: [row['VpaName'] ?? row['name'], row['DomainName'] ?? row['domainName']]
            .filter(Boolean)
            .join(' - '),
          searchText: [
            row['VpaName'] ?? row['name'],
            row['DomainName'] ?? row['domainName'],
            row['CustomerName'] ?? row['customerName'],
          ]
            .filter(Boolean)
            .join(' '),
        })),
      );
    } catch {
      this.snack.error('Failed to load PABX accounts.');
    } finally {
      this.pabxLoading.set(false);
    }
  }
}
