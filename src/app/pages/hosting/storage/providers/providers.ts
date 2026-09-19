import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

type StorageProvider = 's3' | 'gcs' | 'azure' | 'spaces' | 'sangfor_scp';

const PROVIDER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 's3', label: 'Amazon S3' },
  { value: 'spaces', label: 'DigitalOcean Spaces' },
  { value: 'gcs', label: 'Google Cloud Storage' },
  { value: 'azure', label: 'Azure Blob Storage' },
  { value: 'sangfor_scp', label: 'Sangfor Technologies SCP/HCI' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const SANGFOR_MODE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'scp_storage', label: 'SCP storage API' },
  { value: 's3_compatible', label: 'S3 compatible API' },
];

const VALIDATE_ACTION: ConfigurableCrudRowAction = {
  key: 'validate',
  label: 'Validate',
  icon: 'fact_check',
  tooltip: 'Validate',
};

const MANAGED_CONFIG_KEYS = [
  'region',
  'endpoint',
  'accessKeyId',
  'projectId',
  'clientEmail',
  'accountName',
  'forcePathStyle',
  'mode',
  'apiUrl',
  'apiVersion',
  'authPath',
  'validatePath',
  'resourcePoolId',
  'storagePoolId',
  'datastoreId',
  'verifyTls',
  'timeoutSeconds',
] as const;

const PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/hosting/storage/providers',
  uuidField: 'HspUUID',
  pageTitle: 'Storage Providers',
  pageDescription: 'Manage object storage platforms and credentials.',
  createTitle: 'New storage provider',
  editTitle: 'Edit storage provider',
  dialogDescription: 'Configure storage provider identity, connection and credentials.',
  searchPlaceholder: 'Name or provider',
  emptyLabel: 'No storage providers found.',
  deleteTitle: 'Delete storage provider',
  deleteMessage: 'Are you sure you want to delete this storage provider?',
  deleteSelectedTitle: 'Delete selected storage providers',
  deleteSelectedMessage: 'Delete {count} selected storage providers?',
  savedMessage: 'Storage provider saved successfully.',
  deletedMessage: 'Storage provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete storage provider.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  authenticationTabAfterRecord: true,
  tabLabels: {
    authentication: 'Credentials',
  },
  rowActions: [VALIDATE_ACTION],
  listFilters: [
    {
      key: 'provider',
      label: 'Provider',
      paramKey: 'provider',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  initialValues: {
    name: '',
    provider: 's3',
    status: 1,
    isDefault: 0,
    region: '',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    projectId: '',
    clientEmail: '',
    privateKey: '',
    accountName: '',
    accountKey: '',
    forcePathStyle: 0,
    mode: 'scp_storage',
    apiUrl: '',
    apiVersion: '',
    authPath: '',
    validatePath: '',
    resourcePoolId: '',
    storagePoolId: '',
    datastoreId: '',
    verifyTls: 1,
    timeoutSeconds: '',
    username: '',
    password: '',
    apiToken: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HspName', uuidField: 'HspUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HspProvider',
      lookupKey: 'provider',
    },
    { id: 'default', label: 'Default', kind: 'boolean', field: 'HspIsDefault', className: 'status-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HspIsActive', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'HspIsActive', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    {
      key: 'provider',
      source: 'HspProvider',
      payloadKey: 'provider',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
      translateOptions: false,
    },
    {
      key: 'isDefault',
      source: 'HspIsDefault',
      payloadKey: 'isDefault',
      label: 'Default provider',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'HspName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'region',
      payloadKey: 'region',
      label: 'Region',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesS3StyleConfig(values),
      requiredWhen: ({ values }) => usesS3StyleConfig(values),
    },
    {
      key: 'endpoint',
      payloadKey: 'endpoint',
      label: 'Endpoint',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => !usesS3StyleConfig(values),
    },
    {
      key: 'accessKeyId',
      payloadKey: 'accessKeyId',
      label: 'Access key ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesAccessKeyId(values),
      requiredWhen: ({ values }) => usesAccessKeyId(values),
    },
    {
      key: 'forcePathStyle',
      payloadKey: 'forcePathStyle',
      label: 'Force path-style URLs',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesS3StyleConfig(values),
    },
    {
      key: 'projectId',
      payloadKey: 'projectId',
      label: 'Project ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'gcs',
      requiredWhen: ({ values }) => storageProvider(values['provider']) === 'gcs',
    },
    {
      key: 'clientEmail',
      payloadKey: 'clientEmail',
      label: 'Client email',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'gcs',
      requiredWhen: ({ values }) => storageProvider(values['provider']) === 'gcs',
    },
    {
      key: 'accountName',
      payloadKey: 'accountName',
      label: 'Account name',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'azure',
      requiredWhen: ({ values }) => storageProvider(values['provider']) === 'azure',
    },
    {
      key: 'mode',
      payloadKey: 'mode',
      label: 'API mode',
      type: 'search-select',
      options: SANGFOR_MODE_OPTIONS,
      translateOptions: false,
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'sangfor_scp',
      requiredWhen: ({ values }) => storageProvider(values['provider']) === 'sangfor_scp',
    },
    {
      key: 'apiUrl',
      payloadKey: 'apiUrl',
      label: 'API URL',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => !usesSangforScpConfig(values),
      requiredWhen: ({ values }) => usesSangforScpConfig(values),
    },
    {
      key: 'apiVersion',
      payloadKey: 'apiVersion',
      label: 'API version',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesSangforScpConfig(values),
    },
    {
      key: 'authPath',
      payloadKey: 'authPath',
      label: 'Auth path',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesSangforScpConfig(values),
    },
    {
      key: 'validatePath',
      payloadKey: 'validatePath',
      label: 'Validate path',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesSangforScpConfig(values),
    },
    {
      key: 'resourcePoolId',
      payloadKey: 'resourcePoolId',
      label: 'Resource pool ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesSangforScpConfig(values),
    },
    {
      key: 'storagePoolId',
      payloadKey: 'storagePoolId',
      label: 'Storage pool ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesSangforScpConfig(values),
    },
    {
      key: 'datastoreId',
      payloadKey: 'datastoreId',
      label: 'Datastore ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !usesSangforScpConfig(values),
    },
    {
      key: 'verifyTls',
      payloadKey: 'verifyTls',
      label: 'Verify TLS',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'sangfor_scp',
    },
    {
      key: 'timeoutSeconds',
      payloadKey: 'timeoutSeconds',
      label: 'Timeout (seconds)',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'sangfor_scp',
    },
    {
      key: 'secretAccessKey',
      payloadKey: 'secretAccessKey',
      label: 'Secret access key',
      type: 'password',
      placeholder: 'Leave blank to keep the current secret access key',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => !usesSecretAccessKey(values),
      requiredWhen: ({ editing, values }) => !editing && requiresSecretAccessKey(values),
    },
    {
      key: 'privateKey',
      payloadKey: 'privateKey',
      label: 'Private key',
      type: 'password',
      placeholder: 'Leave blank to keep the current private key',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'gcs',
      requiredWhen: ({ editing, values }) =>
        !editing && storageProvider(values['provider']) === 'gcs',
    },
    {
      key: 'accountKey',
      payloadKey: 'accountKey',
      label: 'Account key',
      type: 'password',
      placeholder: 'Leave blank to keep the current account key',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'azure',
      requiredWhen: ({ editing, values }) =>
        !editing && storageProvider(values['provider']) === 'azure',
    },
    {
      key: 'apiToken',
      payloadKey: 'apiToken',
      label: 'API token',
      type: 'password',
      placeholder: 'Leave blank to keep the current API token',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'sangfor_scp',
    },
    {
      key: 'username',
      payloadKey: 'username',
      label: 'Username',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'sangfor_scp',
    },
    {
      key: 'password',
      payloadKey: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'Leave blank to keep the current password',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => storageProvider(values['provider']) !== 'sangfor_scp',
    },
  ],
};

@Component({
  selector: 'app-hosting-storage-providers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingStorageProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() => 'system/hosting/storage/providers');

  constructor() {
    super(PROVIDER_CONFIG);
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

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'provider' && key !== 'mode') return;
    if (key === 'provider') {
      this.patchFormValues(providerDefaults(storageProvider(value), true, this.formValues()));
    }
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = asRecord(row['HspConfig']);
    const normalized: ConfigurableCrudRecord = {
      ...super.formValuesFromRecord(row),
      provider: storageProvider(row['HspProvider']),
      isDefault: truthyNumber(row['HspIsDefault']),
      status: truthyNumber(row['HspIsActive']),
    };
    for (const key of MANAGED_CONFIG_KEYS) {
      normalized[key] = config[key] ?? PROVIDER_CONFIG.initialValues[key] ?? '';
    }
    if (config['forcePathStyle'] === true) normalized['forcePathStyle'] = 1;
    if (config['verifyTls'] === false) normalized['verifyTls'] = 0;
    normalized['mode'] = String(config['mode'] ?? normalized['mode'] ?? 'scp_storage');
    return {
      ...providerDefaults(storageProvider(normalized['provider']), false, normalized),
      ...normalized,
      secretAccessKey: '',
      privateKey: '',
      accountKey: '',
      apiToken: '',
      username: '',
      password: '',
    };
  }

  protected override patchFormValues(values: ConfigurableCrudRecord): void {
    const normalized = { ...values };
    normalized['provider'] = storageProvider(normalized['provider']);
    normalized['isDefault'] = truthyNumber(normalized['isDefault']);
    normalized['status'] = truthyNumber(normalized['status'] ?? normalized['isActive'] ?? 1);
    normalized['forcePathStyle'] = truthyNumber(normalized['forcePathStyle']);
    normalized['verifyTls'] =
      normalized['verifyTls'] === undefined || normalized['verifyTls'] === ''
        ? 1
        : truthyNumber(normalized['verifyTls']);
    normalized['mode'] = String(normalized['mode'] ?? 'scp_storage') || 'scp_storage';
    super.patchFormValues({
      ...providerDefaults(storageProvider(normalized['provider']), false, normalized),
      ...normalized,
    });
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const selected = storageProvider(payload['provider']);
    if (selected !== 'sangfor_scp' || sangforMode(payload['mode']) !== 'scp_storage') return true;
    if (this.editingRecord()) return true;

    const hasToken = String(payload['apiToken'] ?? '').trim().length > 0;
    const hasAccessKeyPair =
      String(payload['accessKeyId'] ?? '').trim().length > 0 &&
      String(payload['secretAccessKey'] ?? '').trim().length > 0;
    const hasLogin =
      String(payload['username'] ?? '').trim().length > 0 &&
      String(payload['password'] ?? '').trim().length > 0;
    if (hasToken || hasAccessKeyPair || hasLogin) return true;

    this.snack.warning(
      this.t('Sangfor requires an API token, Access Key/Secret Key, or username/password.'),
    );
    return false;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const selectedProvider = storageProvider(payload['provider']);
    return {
      name: payload['name'],
      provider: selectedProvider,
      config: buildProviderConfig(selectedProvider, payload),
      credentials: buildProviderCredentials(selectedProvider, payload),
      isActive: truthyNumber(payload['status']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'validate') return;
    const uuid = String(row['HspUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      this.snack.success(this.t('Storage provider validated.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to validate storage provider.'));
    } finally {
      this.mutating.set(false);
    }
  }
}

function storageProvider(value: unknown): StorageProvider {
  const normalized = String(value ?? 's3') as StorageProvider;
  return ['s3', 'gcs', 'azure', 'spaces', 'sangfor_scp'].includes(normalized) ? normalized : 's3';
}

function sangforMode(value: unknown): string {
  return String(value ?? 'scp_storage') === 's3_compatible' ? 's3_compatible' : 'scp_storage';
}

function usesS3StyleConfig(values: ConfigurableCrudRecord): boolean {
  const provider = storageProvider(values['provider']);
  if (provider === 's3' || provider === 'spaces') return true;
  return provider === 'sangfor_scp' && sangforMode(values['mode']) === 's3_compatible';
}

function usesAccessKeyId(values: ConfigurableCrudRecord): boolean {
  const provider = storageProvider(values['provider']);
  if (provider === 's3' || provider === 'spaces') return true;
  if (provider === 'sangfor_scp') return true;
  return false;
}

function usesSecretAccessKey(values: ConfigurableCrudRecord): boolean {
  const provider = storageProvider(values['provider']);
  if (provider === 's3' || provider === 'spaces') return true;
  return provider === 'sangfor_scp';
}

function requiresSecretAccessKey(values: ConfigurableCrudRecord): boolean {
  return storageProvider(values['provider']) === 's3' || storageProvider(values['provider']) === 'spaces';
}

function usesSangforScpConfig(values: ConfigurableCrudRecord): boolean {
  return storageProvider(values['provider']) === 'sangfor_scp' && sangforMode(values['mode']) === 'scp_storage';
}

function providerDefaults(
  value: StorageProvider,
  force: boolean,
  current: ConfigurableCrudRecord,
): ConfigurableCrudRecord {
  if (force) {
    return {
      mode: value === 'sangfor_scp' ? 'scp_storage' : current['mode'],
      forcePathStyle: 0,
      verifyTls: 1,
      ...(force
        ? {
            secretAccessKey: '',
            privateKey: '',
            accountKey: '',
            apiToken: '',
            username: '',
            password: '',
          }
        : {}),
    };
  }
  return {};
}

function buildProviderConfig(
  value: StorageProvider,
  payload: ConfigurableCrudRecord,
): Record<string, unknown> {
  if (value === 's3' || value === 'spaces') {
    return cleanRecord({
      region: payload['region'],
      endpoint: payload['endpoint'],
      accessKeyId: payload['accessKeyId'],
      forcePathStyle: truthyNumber(payload['forcePathStyle']) === 1,
    });
  }
  if (value === 'gcs') {
    return cleanRecord({
      projectId: payload['projectId'],
      clientEmail: payload['clientEmail'],
    });
  }
  if (value === 'azure') {
    return cleanRecord({
      accountName: payload['accountName'],
    });
  }
  if (value === 'sangfor_scp') {
    const mode = sangforMode(payload['mode']);
    const config: Record<string, unknown> = {
      mode,
      apiUrl: payload['apiUrl'],
      apiVersion: payload['apiVersion'],
      authPath: payload['authPath'],
      validatePath: payload['validatePath'],
      resourcePoolId: payload['resourcePoolId'],
      storagePoolId: payload['storagePoolId'],
      datastoreId: payload['datastoreId'],
      accessKeyId: payload['accessKeyId'],
      verifyTls: truthyNumber(payload['verifyTls']) === 1,
      timeoutSeconds: payload['timeoutSeconds'],
    };
    if (mode === 's3_compatible') {
      config['region'] = payload['region'];
      config['endpoint'] = payload['endpoint'];
      config['accessKeyId'] = payload['accessKeyId'];
      config['forcePathStyle'] = truthyNumber(payload['forcePathStyle']) === 1;
    }
    return cleanRecord(config);
  }
  return {};
}

function buildProviderCredentials(
  value: StorageProvider,
  payload: ConfigurableCrudRecord,
): Record<string, unknown> {
  if (value === 's3' || value === 'spaces') {
    return cleanRecord({ secretAccessKey: payload['secretAccessKey'] });
  }
  if (value === 'gcs') {
    return cleanRecord({ privateKey: payload['privateKey'] });
  }
  if (value === 'azure') {
    return cleanRecord({ accountKey: payload['accountKey'] });
  }
  if (value === 'sangfor_scp') {
    return cleanRecord({
      apiToken: payload['apiToken'],
      secretAccessKey: payload['secretAccessKey'],
      username: payload['username'],
      password: payload['password'],
    });
  }
  return {};
}

function truthyNumber(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== null && item !== undefined && item !== '',
    ),
  );
}
