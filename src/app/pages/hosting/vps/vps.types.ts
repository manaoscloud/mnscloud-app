export type VpsProvider =
  'digitalocean' | 'lightsail' | 'proxmox' | 'vmware_vcenter' | 'sangfor_scp';

export type VpsProviderConfig = {
  region?: string;
  projectId?: string;
  accessKeyId?: string;
  apiUrl?: string;
  node?: string;
  storage?: string;
  bridge?: string;
  templateVmid?: string | number;
  fullClone?: boolean;
  vcenterUrl?: string;
  datacenter?: string;
  cluster?: string;
  resourcePool?: string;
  folder?: string;
  datastore?: string;
  network?: string;
  templateVm?: string;
  templateVmId?: string;
  customizationSpec?: string;
  guestOs?: string;
  verifyTls?: boolean;
  apiVersion?: string;
  authPath?: string;
  validatePath?: string;
  resourcePoolId?: string;
  clusterId?: string;
  networkId?: string;
  datastoreId?: string;
  storagePoolId?: string;
  imageId?: string;
  timeoutSeconds?: number | string;
  catalogPaths?: {
    regions?: string | null;
    sizes?: string | null;
    images?: string | null;
  };
  flavors?: Array<Record<string, unknown>>;
};

export type VpsProviderCredentials = {
  apiToken?: string;
  secretAccessKey?: string;
  tokenId?: string;
  tokenSecret?: string;
  username?: string;
  password?: string;
};

export type HostingVpsProvider = {
  HvrUUID: string;
  HvrName: string;
  HvrProvider: VpsProvider;
  HvrConfig?: VpsProviderConfig | null;
  credentials?: VpsProviderCredentials | null;
  HvrIsActive: number;
  HvrIsDefault: number;
};

export type HostingVpsPlanConfig = {
  cpu?: number | null;
  memoryMb?: number | null;
  diskGb?: number | null;
  transferGb?: number | null;
  providerSizeId?: string | null;
  providerRegionId?: string | null;
  /** Lightsail availability zone (e.g. us-east-1a); same as providerRegionId when AZ-scoped. */
  availabilityZone?: string | null;
  /** Parent AWS region for Lightsail SDK/provision (e.g. us-east-1). */
  awsRegion?: string | null;
  sizeFamily?: string | null;
  sizeCategory?: string | null;
  backupEnabled?: boolean | null;
  ipv6Enabled?: boolean | null;
  monitoringEnabled?: boolean | null;
  notes?: string | null;
};

export type HostingVpsPlan = {
  HvpUUID: string;
  HvpName: string;
  HostingVpsProviderHvrUUID: string;
  HvpProvider: VpsProvider;
  HvpRegion?: string | null;
  HvpSize?: string | null;
  HvpImage?: string | null;
  HvpCurrency: string;
  HvpPrice: number;
  HvpSetupFee?: number | null;
  BillingPriceBpcUUID?: string | null;
  HvpConfig?: HostingVpsPlanConfig | null;
  HvpIsActive: number;
};

export type HostingVpsInstanceConfig = {
  providerImageId?: string | null;
  authMethod?: 'ssh_key' | 'password' | string | null;
  username?: string | null;
  password?: string | null;
  sshKey?: string;
  notes?: string;
  provisionError?: string | null;
  provisionRetryCount?: number | null;
  lastProvisionRetryAt?: string | null;
  publicIpv4?: string | null;
  privateIpv4?: string | null;
  publicIpv6?: string | null;
  runtimeSyncedAt?: string | null;
  runtime?: {
    providerStatus?: string | null;
    region?: string | null;
    size?: string | null;
    image?: string | null;
    vcpus?: number | null;
    memoryMb?: number | null;
    diskGb?: number | null;
    tags?: string[] | null;
  } | null;
  resize?: {
    sourcePlanUUID?: string | null;
    targetPlanUUID?: string | null;
    providerActionId?: string | null;
    status?: string | null;
    diskResize?: boolean | null;
    requestedAt?: string | null;
    completedAt?: string | null;
    error?: string | null;
  } | null;
};

export type VpsCatalogOption = {
  id: string;
  label: string;
  source?: string | null;
  name?: string | null;
  version?: string | null;
  architecture?: string | null;
  type?: string | null;
  slug?: string | null;
  cpu?: number | null;
  memoryMb?: number | null;
  diskGb?: number | null;
  transferGb?: number | null;
  regions?: string[] | null;
  minDiskGb?: number | null;
  minPower?: number | null;
  platform?: string | null;
  power?: number | null;
  family?: string | null;
  category?: string | null;
  priceMonthly?: number | null;
  setupFee?: number | null;
  priceCurrency?: string | null;
};

export type VpsProviderCatalog = {
  provider: VpsProvider;
  regions: VpsCatalogOption[];
  sizes: VpsCatalogOption[];
  images: VpsCatalogOption[];
};

export type HostingVpsInstance = {
  HviUUID: string;
  HviName: string;
  HviConfig?: HostingVpsInstanceConfig | null;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  HviExternalId?: string | null;
  HviStatus?: string | null;
  HviIsActive: number;
  HostingVpsProviderHvrUUID: string;
  HostingVpsPlanHvpUUID: string;
};

export type HostingVpsSnapshotStatus =
  | 'queued'
  | 'creating'
  | 'available'
  | 'restoring'
  | 'deleting'
  | 'failed'
  | 'deleted'
  | 'queue_failed'
  | string;

export type HostingVpsSnapshot = {
  HvsUUID: string;
  HvsName: string;
  HostingVpsInstanceHviUUID: string;
  HviName?: string | null;
  InstanceExternalId?: string | null;
  InstanceStatus?: string | null;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  HostingVpsProviderHvrUUID?: string | null;
  ProviderName?: string | null;
  ProviderCode?: string | null;
  HvsExternalId?: string | null;
  HvsStatus?: HostingVpsSnapshotStatus | null;
  HvsSizeGb?: number | null;
  HvsRegion?: string | null;
  HvsIncludeMemory: number;
  HvsQuiesce: number;
  HvsConfig?: Record<string, unknown> | string | null;
  HvsIsActive: number;
  UserUsrUUID?: string | null;
  HvsDateCreated?: string | null;
  HvsDateUpdated?: string | null;
  HvsDateCompleted?: string | null;
};
