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
  HostingVpsProvider,
  VpsProvider,
  VpsProviderConfig,
  VpsProviderCredentials,
} from '../vps.types';

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const PROVIDER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'digitalocean', label: 'DigitalOcean Droplets' },
  { value: 'lightsail', label: 'Amazon Lightsail' },
  { value: 'proxmox', label: 'Proxmox VE' },
  { value: 'vmware_vcenter', label: 'VMware vCenter' },
  { value: 'sangfor_scp', label: 'Sangfor Technologies SCP/HCI' },
];

const TEST_PROVIDER_ACTION: ConfigurableCrudRowAction = {
  key: 'test',
  label: 'Test',
  icon: 'science',
  tooltip: 'Test provider',
};

const CONFIG_FIELD_KEYS = [
  'region',
  'projectId',
  'accessKeyId',
  'apiUrl',
  'node',
  'storage',
  'bridge',
  'templateVmid',
  'vcenterUrl',
  'datacenter',
  'cluster',
  'resourcePool',
  'folder',
  'datastore',
  'network',
  'templateVm',
  'templateVmId',
  'customizationSpec',
  'apiVersion',
  'authPath',
  'validatePath',
  'resourcePoolId',
  'clusterId',
  'networkId',
  'datastoreId',
  'storagePoolId',
  'imageId',
  'timeoutSeconds',
] as const;

const CREDENTIAL_FIELD_KEYS = [
  'apiToken',
  'secretAccessKey',
  'tokenId',
  'tokenSecret',
  'username',
  'password',
] as const;

const HOSTING_VPS_PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps/providers',
  uuidField: 'HvrUUID',
  pageTitle: 'VPS Provider',
  pageDescription:
    'Configure platform VPS providers. Provider administration is master-only.',
  createTitle: 'New provider',
  editTitle: 'Edit provider',
  dialogDescription: 'Configure platform credentials for VPS provisioning.',
  searchPlaceholder: 'Name, provider or region',
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
    provider: 'digitalocean',
    region: '',
    projectId: '',
    accessKeyId: '',
    apiUrl: '',
    node: '',
    storage: '',
    bridge: '',
    templateVmid: '',
    vcenterUrl: '',
    datacenter: '',
    cluster: '',
    resourcePool: '',
    folder: '',
    datastore: '',
    network: '',
    templateVm: '',
    templateVmId: '',
    customizationSpec: '',
    apiVersion: '',
    authPath: '',
    validatePath: '',
    resourcePoolId: '',
    clusterId: '',
    networkId: '',
    datastoreId: '',
    storagePoolId: '',
    imageId: '',
    timeoutSeconds: '',
    catalogRegionsPath: '',
    catalogSizesPath: '',
    catalogImagesPath: '',
    apiToken: '',
    secretAccessKey: '',
    tokenId: '',
    tokenSecret: '',
    username: '',
    password: '',
    isActive: 1,
    isDefault: 0,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HvrName', uuidField: 'HvrUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HvrProvider',
      lookupKey: 'provider',
    },
    { id: 'region', label: 'Region / Project', field: 'RegionDisplay' },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'HvrIsDefault',
      className: 'status-col',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HvrIsActive', className: 'status-col' },
  ],
  fields: [
    {
      key: 'isActive',
      source: 'HvrIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HvrIsDefault',
      payloadKey: 'isDefault',
      label: 'Default',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'provider',
      source: 'HvrProvider',
      payloadKey: 'provider',
      label: 'Provider',
      type: 'search-select',
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'HvrName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'Primary provider',
      required: true,
      span: 1,
    },
    {
      key: 'projectId',
      payloadKey: 'projectId',
      label: 'Project ID',
      placeholder: 'project-id',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'digitalocean',
    },
    {
      key: 'apiUrl',
      payloadKey: 'apiUrl',
      label: 'API URL',
      placeholder: 'https://proxmox.example.com:8006',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => !['proxmox', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ values }) =>
        providerOf(values) === 'proxmox' || providerOf(values) === 'sangfor_scp',
    },
    {
      key: 'node',
      payloadKey: 'node',
      label: 'Node',
      placeholder: 'pve1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'storage',
      payloadKey: 'storage',
      label: 'Storage',
      placeholder: 'local-lvm',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'bridge',
      payloadKey: 'bridge',
      label: 'Bridge',
      placeholder: 'vmbr0',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'templateVmid',
      payloadKey: 'templateVmid',
      label: 'Template VMID',
      placeholder: '9000',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'tokenId',
      payloadKey: 'tokenId',
      label: 'Token ID',
      placeholder: 'mnscloud@pve!provisioner',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'proxmox',
    },
    {
      key: 'tokenSecret',
      payloadKey: 'tokenSecret',
      label: 'Token Secret',
      type: 'password',
      placeholder: 'Leave blank to keep the current secret',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'proxmox',
    },
    {
      key: 'vcenterUrl',
      payloadKey: 'vcenterUrl',
      label: 'vCenter URL',
      placeholder: 'https://vcenter.example.com',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
      requiredWhen: ({ values }) => providerOf(values) === 'vmware_vcenter',
    },
    {
      key: 'datacenter',
      payloadKey: 'datacenter',
      label: 'Datacenter',
      placeholder: 'DC1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'cluster',
      payloadKey: 'cluster',
      label: 'Cluster',
      placeholder: 'Cluster01',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'resourcePool',
      payloadKey: 'resourcePool',
      label: 'Resource pool',
      placeholder: 'Resources',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'folder',
      payloadKey: 'folder',
      label: 'Folder',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'datastore',
      payloadKey: 'datastore',
      label: 'Datastore',
      placeholder: 'datastore1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'network',
      payloadKey: 'network',
      label: 'Network',
      placeholder: 'VM Network',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'templateVm',
      payloadKey: 'templateVm',
      label: 'Template VM',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'templateVmId',
      payloadKey: 'templateVmId',
      label: 'Template VM ID',
      placeholder: 'vm-123',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'customizationSpec',
      payloadKey: 'customizationSpec',
      label: 'Customization spec',
      placeholder: 'linux-cloud-init',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'apiVersion',
      payloadKey: 'apiVersion',
      label: 'API version',
      placeholder: 'v1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'authPath',
      payloadKey: 'authPath',
      label: 'Auth path',
      placeholder: '/api/v1/auth/login',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'validatePath',
      payloadKey: 'validatePath',
      label: 'Validate path',
      placeholder: '/api/v1/system/version',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'region',
      payloadKey: 'region',
      label: 'Region',
      placeholder: 'us-east-1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['lightsail', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ values }) => providerOf(values) === 'lightsail',
    },
    {
      key: 'resourcePoolId',
      payloadKey: 'resourcePoolId',
      label: 'Resource pool ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'clusterId',
      payloadKey: 'clusterId',
      label: 'Cluster ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'networkId',
      payloadKey: 'networkId',
      label: 'Network ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'datastoreId',
      payloadKey: 'datastoreId',
      label: 'Datastore ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'storagePoolId',
      payloadKey: 'storagePoolId',
      label: 'Storage pool ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'imageId',
      payloadKey: 'imageId',
      label: 'Image ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'timeoutSeconds',
      payloadKey: 'timeoutSeconds',
      label: 'Timeout seconds',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'catalogRegionsPath',
      payloadKey: 'catalogRegionsPath',
      label: 'Catalog regions path',
      placeholder: '/api/v1/regions',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'catalogSizesPath',
      payloadKey: 'catalogSizesPath',
      label: 'Catalog sizes path',
      placeholder: '/api/v1/flavors',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'catalogImagesPath',
      payloadKey: 'catalogImagesPath',
      label: 'Catalog images path',
      placeholder: '/api/v1/images',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'apiToken',
      payloadKey: 'apiToken',
      label: 'API Token',
      type: 'password',
      placeholder: 'Leave blank to keep the current token',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => !['digitalocean', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'digitalocean',
    },
    {
      key: 'accessKeyId',
      payloadKey: 'accessKeyId',
      label: 'Access Key ID',
      labelWhen: ({ values }) =>
        providerOf(values) === 'sangfor_scp' ? 'Access Key' : 'Access Key ID',
      placeholder: 'AKIA...',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['lightsail', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ values }) => providerOf(values) === 'lightsail',
    },
    {
      key: 'secretAccessKey',
      payloadKey: 'secretAccessKey',
      label: 'Secret Access Key',
      labelWhen: ({ values }) =>
        providerOf(values) === 'sangfor_scp' ? 'Secret Key' : 'Secret Access Key',
      type: 'password',
      placeholder: 'Leave blank to keep the current secret',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['lightsail', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'lightsail',
    },
    {
      key: 'username',
      payloadKey: 'username',
      label: 'Username',
      placeholder: 'mnscloud-provisioner@vsphere.local',
      autocomplete: 'off',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['vmware_vcenter', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'vmware_vcenter',
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
      hiddenWhen: ({ values }) => !['vmware_vcenter', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'vmware_vcenter',
    },
  ],
};

@Component({
  selector: 'app-hosting-vps-provider',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsProviderPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/providers' : HOSTING_VPS_PROVIDER_CONFIG.endpoint,
  );

  constructor() {
    const masterScope =
      (inject(ActivatedRoute).snapshot.data?.['scope'] ?? 'tenant') === 'master';
    super({
      ...HOSTING_VPS_PROVIDER_CONFIG,
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
      const config = parseConfig<VpsProviderConfig>(item['HvrConfig']);
      return {
        ...item,
        HvrConfig: config,
        RegionDisplay: regionDisplay(config),
      };
    });
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    void this.startEditWithCredentials(row);
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const base = super.formValuesFromRecord(row);
    const config = parseConfig<VpsProviderConfig>(row['HvrConfig']) ?? {};
    const credentials = (row['credentials'] as VpsProviderCredentials | null | undefined) ?? {};
    return {
      ...base,
      name: String(row['HvrName'] ?? base['name'] ?? ''),
      provider: providerOf(row['HvrProvider'] ?? base['provider']),
      region: config.region ?? '',
      projectId: config.projectId ?? '',
      accessKeyId: config.accessKeyId ?? '',
      apiUrl: config.apiUrl ?? '',
      node: config.node ?? '',
      storage: config.storage ?? '',
      bridge: config.bridge ?? '',
      templateVmid: config.templateVmid === undefined ? '' : String(config.templateVmid),
      vcenterUrl: config.vcenterUrl ?? '',
      datacenter: config.datacenter ?? '',
      cluster: config.cluster ?? '',
      resourcePool: config.resourcePool ?? '',
      folder: config.folder ?? '',
      datastore: config.datastore ?? '',
      network: config.network ?? '',
      templateVm: config.templateVm ?? '',
      templateVmId: config.templateVmId ?? '',
      customizationSpec: config.customizationSpec ?? '',
      apiVersion: config.apiVersion ?? '',
      authPath: config.authPath ?? '',
      validatePath: config.validatePath ?? '',
      resourcePoolId: config.resourcePoolId ?? '',
      clusterId: config.clusterId ?? '',
      networkId: config.networkId ?? '',
      datastoreId: config.datastoreId ?? '',
      storagePoolId: config.storagePoolId ?? '',
      imageId: config.imageId ?? '',
      timeoutSeconds: config.timeoutSeconds === undefined ? '' : String(config.timeoutSeconds),
      catalogRegionsPath: config.catalogPaths?.regions ?? '',
      catalogSizesPath: config.catalogPaths?.sizes ?? '',
      catalogImagesPath: config.catalogPaths?.images ?? '',
      apiToken: credentials.apiToken ?? '',
      secretAccessKey: credentials.secretAccessKey ?? '',
      tokenId: credentials.tokenId ?? '',
      tokenSecret: credentials.tokenSecret ?? '',
      username: credentials.username ?? '',
      password: credentials.password ?? '',
      isActive: truthyNumber(row['HvrIsActive']),
      isDefault: truthyNumber(row['HvrIsDefault']),
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
    const selected = providerOf(payload['provider']);
    const credentials = buildCredentialsPayload(payload);

    if (!editing && !credentials) {
      if (selected === 'sangfor_scp') {
        this.snack.warning(
          this.t('Sangfor requires an API token, Access Key/Secret Key, or username/password.'),
        );
      } else {
        this.snack.warning(this.t('Credentials are required for new providers.'));
      }
      return false;
    }

    if (selected === 'sangfor_scp' && !editing) {
      const hasToken = !!normalizeString(payload['apiToken']);
      const hasAccessKeyPair =
        !!normalizeString(payload['accessKeyId']) && !!normalizeString(payload['secretAccessKey']);
      const hasLogin =
        !!normalizeString(payload['username']) && !!normalizeString(payload['password']);
      if (!hasToken && !hasAccessKeyPair && !hasLogin) {
        this.snack.warning(
          this.t('Sangfor requires an API token, Access Key/Secret Key, or username/password.'),
        );
        return false;
      }
    }

    return true;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'test') return;
    const uuid = String(row['HvrUUID'] ?? '');
    if (!uuid) return;

    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      const label =
        this.lookupLabel('provider', row['HvrProvider']) || String(row['HvrProvider'] ?? '');
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
      const result = await this.api.get<{ data?: { item?: HostingVpsProvider | null } }>(
        `${this.endpoint()}/${String(row['HvrUUID'] ?? '')}`,
      );
      const detail = result?.data?.item;
      if (detail) {
        const config = parseConfig<VpsProviderConfig>(detail.HvrConfig);
        providerRecord = {
          ...detail,
          HvrConfig: config,
          RegionDisplay: regionDisplay(config),
        } as ConfigurableCrudRecord;
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load provider credentials.'));
    }
    super.startEdit(providerRecord);
  }
}

function providerOf(value: unknown): VpsProvider {
  if (value && typeof value === 'object' && 'provider' in (value as Record<string, unknown>)) {
    return providerOf((value as ConfigurableCrudRecord)['provider']);
  }
  const normalized = String(value ?? 'digitalocean') as VpsProvider;
  return PROVIDER_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : 'digitalocean';
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

function regionDisplay(config: VpsProviderConfig | null | undefined): string {
  if (!config) return '';
  return String(
    config.region ??
      config.projectId ??
      config.apiUrl ??
      config.vcenterUrl ??
      config.resourcePoolId ??
      '',
  );
}

function buildConfigPayload(values: ConfigurableCrudRecord): VpsProviderConfig {
  const config: VpsProviderConfig = {};
  for (const key of CONFIG_FIELD_KEYS) {
    const normalized = normalizeString(values[key]);
    if (normalized) (config as Record<string, unknown>)[key] = normalized;
  }

  const catalogPaths = {
    regions: normalizeString(values['catalogRegionsPath']),
    sizes: normalizeString(values['catalogSizesPath']),
    images: normalizeString(values['catalogImagesPath']),
  };
  if (Object.values(catalogPaths).some(Boolean)) config.catalogPaths = catalogPaths;
  return config;
}

function buildCredentialsPayload(values: ConfigurableCrudRecord): VpsProviderCredentials | null {
  const credentials: VpsProviderCredentials = {};
  for (const key of CREDENTIAL_FIELD_KEYS) {
    const normalized = normalizeString(values[key]);
    if (normalized) credentials[key] = normalized;
  }
  return Object.keys(credentials).length ? credentials : null;
}
