import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type {
  HostingVpsContainerProvider,
  VpsContainerProvider,
  VpsContainerProviderConfig,
  VpsContainerProviderCredentials,
} from '../vps-container.types';

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const PROVIDER_OPTIONS: readonly ConfigurableCrudOption[] = [{ value: 'incus', label: 'Incus' }];

const TEST_PROVIDER_ACTION: ConfigurableCrudRowAction = {
  key: 'test',
  label: 'Test',
  icon: 'science',
  tooltip: 'Test provider',
};

const CONFIG_FIELD_KEYS = [
  'apiUrl',
  'project',
  'target',
  'storagePool',
  'network',
  'profile',
  'remote',
  'imageAlias',
] as const;

const CREDENTIAL_FIELD_KEYS = [
  'bearerToken',
  'clientCertificate',
  'clientPrivateKey',
  'serverCertificate',
] as const;

const HOSTING_VPS_CONTAINER_PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps-container/providers',
  uuidField: 'HcpUUID',
  pageTitle: 'VPS Container Provider',
  pageDescription: 'Configure Incus providers for VPS Container provisioning.',
  createTitle: 'New provider',
  editTitle: 'Edit provider',
  dialogDescription: 'Configure credentials for VPS Container provisioning.',
  searchPlaceholder: 'Name, provider, project or API URL',
  emptyLabel: 'No providers found.',
  deleteTitle: 'Delete provider',
  deleteMessage: 'Are you sure you want to delete this provider?',
  deleteSelectedTitle: 'Delete selected providers',
  deleteSelectedMessage: 'Are you sure you want to delete {count} selected provider(s)?',
  savedMessage: 'Provider saved successfully.',
  deletedMessage: 'Provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete provider.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  authenticationTabAfterRecord: true,
  rowActions: [TEST_PROVIDER_ACTION],
  tabLabels: {
    authentication: 'API',
  },
  initialValues: {
    name: '',
    provider: 'incus',
    apiUrl: '',
    project: 'default',
    target: '',
    storagePool: '',
    network: '',
    profile: 'default',
    remote: 'https://images.linuxcontainers.org',
    imageAlias: '',
    verifyTls: 1,
    bearerToken: '',
    clientCertificate: '',
    clientPrivateKey: '',
    serverCertificate: '',
    isActive: 1,
    isDefault: 0,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HcpName', uuidField: 'HcpUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HcpProvider',
      lookupKey: 'provider',
    },
    { id: 'region', label: 'Region / Project', field: 'RegionDisplay' },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'HcpIsDefault',
      className: 'status-col',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HcpIsActive', className: 'status-col' },
  ],
  fields: [
    {
      key: 'isActive',
      source: 'HcpIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HcpIsDefault',
      payloadKey: 'isDefault',
      label: 'Default',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'provider',
      source: 'HcpProvider',
      payloadKey: 'provider',
      label: 'Provider',
      type: 'search-select',
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'HcpName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'Primary provider',
      required: true,
      span: 1,
    },
    {
      key: 'apiUrl',
      payloadKey: 'apiUrl',
      label: 'Incus API URL',
      placeholder: 'https://incus.example.com:8443',
      tab: 'authentication',
      span: 2,
      required: true,
    },
    {
      key: 'project',
      payloadKey: 'project',
      label: 'Project',
      placeholder: 'default',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'target',
      payloadKey: 'target',
      label: 'Target node',
      placeholder: 'node-01',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'storagePool',
      payloadKey: 'storagePool',
      label: 'Storage pool',
      placeholder: 'default',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'network',
      payloadKey: 'network',
      label: 'Network',
      placeholder: 'incusbr0',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'profile',
      payloadKey: 'profile',
      label: 'Profile',
      placeholder: 'default',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'remote',
      payloadKey: 'remote',
      label: 'Image server',
      placeholder: 'https://images.linuxcontainers.org',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'imageAlias',
      payloadKey: 'imageAlias',
      label: 'Default image alias',
      placeholder: 'debian/12',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'verifyTls',
      payloadKey: 'verifyTls',
      label: 'Verify TLS',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'bearerToken',
      payloadKey: 'bearerToken',
      label: 'Bearer token',
      type: 'password',
      placeholder: 'Leave blank to keep the current token',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
    },
    {
      key: 'clientCertificate',
      payloadKey: 'clientCertificate',
      label: 'Client certificate',
      type: 'textarea',
      rows: 4,
      placeholder: '-----BEGIN CERTIFICATE-----',
      tab: 'authentication',
      span: 2,
    },
    {
      key: 'clientPrivateKey',
      payloadKey: 'clientPrivateKey',
      label: 'Client private key',
      type: 'textarea',
      rows: 4,
      placeholder: '-----BEGIN PRIVATE KEY-----',
      tab: 'authentication',
      span: 2,
    },
    {
      key: 'serverCertificate',
      payloadKey: 'serverCertificate',
      label: 'Server certificate',
      type: 'textarea',
      rows: 4,
      placeholder: 'Optional trusted server certificate',
      tab: 'authentication',
      span: 2,
    },
  ],
};

@Component({
  selector: 'app-hosting-vps-container-provider',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsContainerProviderPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster()
      ? 'system/hosting/vps-container/providers'
      : HOSTING_VPS_CONTAINER_PROVIDER_CONFIG.endpoint,
  );

  constructor() {
    const masterScope =
      (inject(ActivatedRoute).snapshot.data?.['scope'] ?? 'tenant') === 'master';
    super({
      ...HOSTING_VPS_CONTAINER_PROVIDER_CONFIG,
      pageDescription:
        'Configure platform Incus providers. Provider administration is master-only.',
      canCreate: masterScope,
      canEdit: masterScope,
      canDelete: masterScope,
    });
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

  protected override bulkDeleteEndpoint(): string {
    return `${this.endpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'provider') return PROVIDER_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const items = await super.fetchItems(filters);
    return items.map((item) => {
      const config = parseConfig<VpsContainerProviderConfig>(item['HcpConfig']);
      return {
        ...item,
        HcpConfig: config,
        RegionDisplay: regionDisplay(config),
      };
    });
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    void this.startEditWithCredentials(row);
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const base = super.formValuesFromRecord(row);
    const config = parseConfig<VpsContainerProviderConfig>(row['HcpConfig']) ?? {};
    const credentials =
      (row['credentials'] as VpsContainerProviderCredentials | null | undefined) ?? {};
    return {
      ...base,
      name: String(row['HcpName'] ?? base['name'] ?? ''),
      provider: providerOf(row['HcpProvider'] ?? base['provider']),
      apiUrl: config.apiUrl ?? '',
      project: config.project ?? 'default',
      target: config.target ?? '',
      storagePool: config.storagePool ?? '',
      network: config.network ?? '',
      profile: config.profile ?? 'default',
      remote: config.remote ?? 'https://images.linuxcontainers.org',
      imageAlias: config.imageAlias ?? '',
      verifyTls: config.verifyTls === undefined ? 1 : truthyNumber(config.verifyTls),
      bearerToken: credentials.bearerToken ?? '',
      clientCertificate: credentials.clientCertificate ?? '',
      clientPrivateKey: credentials.clientPrivateKey ?? '',
      serverCertificate: credentials.serverCertificate ?? '',
      isActive: truthyNumber(row['HcpIsActive']),
      isDefault: truthyNumber(row['HcpIsDefault']),
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next: ConfigurableCrudRecord = {
      name: typeof payload['name'] === 'string' ? payload['name'].trim() : payload['name'],
      provider: providerOf(payload['provider']),
      config: buildConfigPayload(payload),
      isActive: truthyNumber(payload['isActive']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
    const credentials = buildCredentialsPayload(payload);
    if (credentials) next['credentials'] = credentials;
    return next;
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;

    const editing = !!this.editingRecord();
    const credentials = buildCredentialsPayload(payload);
    if (!editing && !credentials) {
      this.snack.warning(this.t('Credentials are required for new providers.'));
      return false;
    }
    return true;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'test') return;
    const uuid = String(row['HcpUUID'] ?? '');
    if (!uuid) return;

    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      const label =
        this.lookupLabel('provider', row['HcpProvider']) || String(row['HcpProvider'] ?? '');
      this.snack.success(this.t(`${label} provider tested successfully.`));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to test provider.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async startEditWithCredentials(row: ConfigurableCrudRecord): Promise<void> {
    let providerRecord = row;
    try {
      const result = await this.api.get<{ data?: { item?: HostingVpsContainerProvider | null } }>(
        `${this.endpoint()}/${String(row['HcpUUID'] ?? '')}`,
      );
      const detail = result?.data?.item;
      if (detail) {
        const config = parseConfig<VpsContainerProviderConfig>(detail.HcpConfig);
        providerRecord = {
          ...detail,
          HcpConfig: config,
          RegionDisplay: regionDisplay(config),
        } as ConfigurableCrudRecord;
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load provider credentials.'));
    }
    super.startEdit(providerRecord);
  }
}

function providerOf(value: unknown): VpsContainerProvider {
  if (value && typeof value === 'object' && 'provider' in (value as Record<string, unknown>)) {
    return providerOf((value as ConfigurableCrudRecord)['provider']);
  }
  const normalized = String(value ?? 'incus') as VpsContainerProvider;
  return PROVIDER_OPTIONS.some((option) => option.value === normalized) ? normalized : 'incus';
}

function truthyNumber(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function parseConfig<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function regionDisplay(config: VpsContainerProviderConfig | null | undefined): string {
  if (!config) return '';
  return String(config.project ?? config.apiUrl ?? config.target ?? '');
}

function buildConfigPayload(values: ConfigurableCrudRecord): VpsContainerProviderConfig {
  const config: VpsContainerProviderConfig = {};
  for (const key of CONFIG_FIELD_KEYS) {
    const normalized = normalizeString(values[key]);
    if (normalized) (config as Record<string, unknown>)[key] = normalized;
  }
  config.verifyTls = truthyNumber(values['verifyTls']) === 1;
  return config;
}

function buildCredentialsPayload(
  values: ConfigurableCrudRecord,
): VpsContainerProviderCredentials | null {
  const credentials: VpsContainerProviderCredentials = {};
  for (const key of CREDENTIAL_FIELD_KEYS) {
    const normalized = normalizeString(values[key]);
    if (normalized) credentials[key] = normalized;
  }
  return Object.keys(credentials).length ? credentials : null;
}
