import { Component } from '@angular/core';

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
  dialogDescription: 'Configure OpenVault identity, endpoint, TLS and fallback behavior.',
  searchPlaceholder: 'Name or endpoint',
  emptyLabel: 'No secret servers found.',
  deleteTitle: 'Delete secret server',
  deleteMessage: 'Are you sure you want to delete this secret server?',
  deleteSelectedTitle: 'Delete selected secret servers',
  deleteSelectedMessage: 'Delete {count} selected secret servers?',
  savedMessage: 'Secret server saved successfully.',
  deletedMessage: 'Secret server deleted successfully.',
  deleteFailedMessage: 'Failed to delete secret server.',
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
    { id: 'endpoint', label: 'Endpoint', field: 'CsrEndpoint' },
    { id: 'clusterMode', label: 'Cluster', kind: 'related', field: 'CsrClusterMode', lookupKey: 'clusterMode' },
    { id: 'default', label: 'Default', kind: 'boolean', field: 'CsrIsDefault', className: 'status-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'CsrStatus', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'CsrStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'isDefault', source: 'CsrIsDefault', payloadKey: 'isDefault', label: 'Default server', type: 'search-select', options: YES_NO_OPTIONS, span: 1 },
    { key: 'verifyTLS', source: 'CsrVerifyTLS', payloadKey: 'verifyTLS', label: 'Verify TLS', type: 'search-select', options: YES_NO_OPTIONS, span: 1 },
    { key: 'name', source: 'CsrName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'endpoint', source: 'CsrEndpoint', payloadKey: 'endpoint', label: 'Endpoint', required: true, tab: 'authentication', span: 2 },
    { key: 'mountPath', source: 'CsrMountPath', payloadKey: 'mountPath', label: 'Mount path', required: true, tab: 'authentication', span: 1 },
    { key: 'clusterMode', source: 'CsrClusterMode', payloadKey: 'clusterMode', label: 'Cluster mode', type: 'search-select', options: CLUSTER_OPTIONS, tab: 'authentication', span: 1 },
    { key: 'namespace', source: 'CsrNamespace', payloadKey: 'namespace', label: 'Namespace', tab: 'authentication', span: 2 },
    { key: 'notes', source: 'CsrNotes', payloadKey: 'notes', label: 'Observações', type: 'textarea', tab: 'notes', span: 4 },
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
  constructor() {
    super(SERVER_CONFIG);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'clusterMode') return CLUSTER_OPTIONS;
    return [];
  }
}
