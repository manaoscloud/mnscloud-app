import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const SECRET_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'runtime_env', label: 'Runtime env' },
  { value: 'api_token', label: 'API token' },
  { value: 'password', label: 'Password' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'ssh_key', label: 'SSH key' },
  { value: 'database', label: 'Database' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const SECRET_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'cyber-security/secrets',
  uuidField: 'CstUUID',
  pageTitle: 'Secrets Manager',
  pageDescription: 'Manage tenant secrets backed by MNSCloud OpenVault.',
  createTitle: 'New secret',
  editTitle: 'Edit secret',
  dialogDescription: 'Configure secret identity, OpenVault path and rotation policy.',
  searchPlaceholder: 'Name, key or path',
  emptyLabel: 'No secrets found.',
  deleteTitle: 'Delete secret',
  deleteMessage: 'Are you sure you want to delete this secret?',
  deleteSelectedTitle: 'Delete selected secrets',
  deleteSelectedMessage: 'Delete {count} selected secrets?',
  savedMessage: 'Secret saved successfully.',
  deletedMessage: 'Secret deleted successfully.',
  deleteFailedMessage: 'Failed to delete secret.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusFilter: true,
  tabLabels: {
    authentication: 'Vault',
    notes: 'Observações',
  },
  listFilters: [
    {
      key: 'secretType',
      label: 'Type',
      paramKey: 'secretType',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
      options: SECRET_TYPE_OPTIONS,
    },
  ],
  initialValues: {
    status: 1,
    name: '',
    key: '',
    secretType: 'generic',
    vaultPath: '',
    rotationEnabled: 0,
    rotationIntervalDays: null,
    expiresAt: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'CstName', uuidField: 'CstUUID' },
    { id: 'key', label: 'Key', field: 'CstKey' },
    { id: 'type', label: 'Type', kind: 'related', field: 'CstSecretType', lookupKey: 'secretType' },
    { id: 'server', label: 'Server', field: 'ResolvedServerName' },
    { id: 'fallback', label: 'Fallback', kind: 'boolean', field: 'UsesMasterFallback', className: 'status-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'CstStatus', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'CstStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'secretType', source: 'CstSecretType', payloadKey: 'secretType', label: 'Type', type: 'search-select', required: true, span: 1 },
    { key: 'rotationEnabled', source: 'CstRotationEnabled', payloadKey: 'rotationEnabled', label: 'Rotation', type: 'search-select', options: YES_NO_OPTIONS, span: 1 },
    { key: 'name', source: 'CstName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'key', source: 'CstKey', payloadKey: 'key', label: 'Key', required: true, tab: 'authentication', span: 2 },
    { key: 'vaultPath', source: 'CstVaultPath', payloadKey: 'vaultPath', label: 'Vault path', tab: 'authentication', span: 2 },
    { key: 'rotationIntervalDays', source: 'CstRotationIntervalDays', payloadKey: 'rotationIntervalDays', label: 'Rotation interval days', type: 'number', tab: 'authentication', span: 1 },
    { key: 'expiresAt', source: 'CstExpiresAt', payloadKey: 'expiresAt', label: 'Expires at', type: 'date', tab: 'authentication', span: 1 },
    { key: 'notes', source: 'CstNotes', payloadKey: 'notes', label: 'Observações', type: 'textarea', tab: 'notes', span: 4 },
  ],
};

@Component({
  selector: 'app-cyber-security-secrets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecuritySecretsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster() ? 'system/cyber-security/secrets' : SECRET_CONFIG.endpoint,
  );

  constructor() {
    super(SECRET_CONFIG);
  }

  protected override listEndpoint(): string {
    return this.endpoint();
  }

  protected override createEndpoint(): string {
    return this.endpoint();
  }

  protected override updateEndpoint(): string {
    return this.endpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.endpoint();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'secretType') return SECRET_TYPE_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    return super.fetchItems(filters);
  }
}
