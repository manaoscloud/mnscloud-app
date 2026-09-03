import { Component, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const CLUSTER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'single', label: 'Single node' },
  { value: 'raft', label: 'Raft cluster' },
];

const SERVER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/cyber-security/secret-servers',
  uuidField: 'CsrUUID',
  pageTitle: 'Secret Servers',
  pageDescription: 'Manage Master OpenVault servers used by Secrets Manager.',
  createTitle: 'New secret server',
  editTitle: 'Edit secret server',
  dialogDescription: 'Configure OpenVault identity, endpoint, TLS and default behavior.',
  searchPlaceholder: 'Name or endpoint',
  emptyLabel: 'No secret servers found.',
  deleteTitle: 'Delete secret server',
  deleteMessage: 'Are you sure you want to delete this secret server?',
  deleteSelectedTitle: 'Delete selected secret servers',
  deleteSelectedMessage: 'Delete {count} selected secret servers?',
  savedMessage: 'Secret server saved successfully.',
  deletedMessage: 'Secret server deleted successfully.',
  deleteFailedMessage: 'Failed to delete secret server.',
  rowActions: [
    { key: 'test-connection', label: 'Test connection', icon: 'health_and_safety' },
    { key: 'generate-tls', label: 'Generate TLS', icon: 'verified_user' },
    { key: 'rotate-tls', label: 'Rotate TLS', icon: 'sync_lock' },
  ],
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusFilter: true,
  tabLabels: {
    authentication: 'Connection',
    notes: 'Observações',
  },
  initialValues: {
    status: 1,
    name: '',
    agentUUID: '',
    endpoint: '',
    namespace: '',
    mountPath: 'kv/mnscloud',
    clusterMode: 'single',
    isDefault: 1,
    verifyTLS: 1,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'CsrName', uuidField: 'CsrUUID' },
    {
      id: 'agent',
      label: 'Agent',
      kind: 'related',
      field: 'MonitoringAgentMagUUID',
      lookupKey: 'agents',
    },
    { id: 'endpoint', label: 'Endpoint', field: 'CsrEndpoint' },
    {
      id: 'clusterMode',
      label: 'Cluster',
      kind: 'related',
      field: 'CsrClusterMode',
      lookupKey: 'clusterMode',
    },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'CsrIsDefault',
      className: 'status-col',
    },
    {
      id: 'tlsFingerprint',
      label: 'TLS valid until',
      kind: 'datetime',
      field: 'CsrTlsNotAfter',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'CsrStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'CsrStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'CsrIsDefault',
      payloadKey: 'isDefault',
      label: 'Default server',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'agentUUID',
      source: 'MonitoringAgentMagUUID',
      payloadKey: 'agentUUID',
      label: 'Agent',
      type: 'search-select',
      required: true,
      options: [],
      span: 1,
      placeholder: 'Search OpenVault agent',
    },
    {
      key: 'verifyTLS',
      source: 'CsrVerifyTLS',
      payloadKey: 'verifyTLS',
      label: 'Verify TLS',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'CsrName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'endpoint',
      source: 'CsrEndpoint',
      payloadKey: 'endpoint',
      label: 'Endpoint',
      required: true,
      tab: 'authentication',
      span: 2,
    },
    {
      key: 'mountPath',
      source: 'CsrMountPath',
      payloadKey: 'mountPath',
      label: 'Mount path',
      required: true,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'clusterMode',
      source: 'CsrClusterMode',
      payloadKey: 'clusterMode',
      label: 'Cluster mode',
      type: 'search-select',
      options: CLUSTER_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'namespace',
      source: 'CsrNamespace',
      payloadKey: 'namespace',
      label: 'Namespace',
      tab: 'authentication',
      span: 2,
    },
    {
      key: 'notes',
      source: 'CsrNotes',
      payloadKey: 'notes',
      label: 'Observações',
      type: 'textarea',
      tab: 'notes',
      span: 4,
    },
  ],
};

@Component({
  selector: 'app-cyber-security-secret-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecuritySecretServersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly agentOptions = signal<readonly ConfigurableCrudOption[]>([]);

  constructor() {
    super(SERVER_CONFIG);
    void this.fetchAgentOptions();
  }

  override async handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key === 'generate-tls' || action.key === 'rotate-tls') {
      await this.queueTlsJob(row, action.key === 'rotate-tls');
      return;
    }
    if (action.key !== 'test-connection') return;
    try {
      const uuid = this.recordUUID(row);
      const response = await this.api.post<{
        data?: {
          reachable?: boolean;
          state?: string | null;
          httpStatus?: number | null;
          version?: string | null;
          tlsVerified?: boolean;
          error?: string | null;
        };
      }>(`${SERVER_CONFIG.endpoint}/${uuid}/test`, {});
      const data = response.data ?? {};
      if (data.reachable) {
        const state = data.state ? ` (${data.state})` : '';
        const version = data.version ? ` - OpenBao ${data.version}` : '';
        this.snack.success(`Connection reachable${state}${version}.`);
        return;
      }
      this.snack.error(data.error || 'Secret server connection failed.');
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Secret server connection failed.');
    }
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'agents') return this.agentOptions();
    if (key === 'clusterMode') return CLUSTER_OPTIONS;
    return [];
  }

  private async queueTlsJob(row: ConfigurableCrudRecord, rotate: boolean) {
    try {
      const uuid = this.recordUUID(row);
      const endpoint = rotate ? 'rotate-tls' : 'generate-tls';
      await this.api.post(`${SERVER_CONFIG.endpoint}/${uuid}/${endpoint}`, {});
      this.snack.success(rotate ? 'TLS rotation queued.' : 'TLS generation queued.');
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to queue TLS job.');
    }
  }

  private async fetchAgentOptions() {
    try {
      const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        'monitoring/agents?limit=1000',
      );
      const items = response.data?.items ?? [];
      const options = items
        .filter((item) =>
          String(item['capabilities'] ?? '').includes('mnscloud.openvault.update') ||
          (Array.isArray(item['runtimeUpdates']) &&
            item['runtimeUpdates'].some(
              (target) =>
                target &&
                typeof target === 'object' &&
                String((target as Record<string, unknown>)['product']) === 'mnscloud-openvault',
            ))
        )
        .map((item) => ({
          value: String(item['uuid'] ?? ''),
          label: String(item['name'] ?? item['hostname'] ?? item['uuid'] ?? ''),
          description: String(item['hostname'] ?? item['uuid'] ?? ''),
          searchText: `${item['name'] ?? ''} ${item['hostname'] ?? ''} ${item['uuid'] ?? ''}`,
        }))
        .filter((option) => option.value && option.label);
      this.agentOptions.set(options);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load OpenVault agents.');
    }
  }
}
