export type VpsProvider =
  | 'digitalocean'
  | 'lightsail'
  | 'proxmox'
  | 'vmware_vcenter'
  | 'sangfor_scp';

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
  HvpConfig?: HostingVpsPlanConfig | null;
  HvpIsActive: number;
};

export type HostingVpsInstanceConfig = {
  providerImageId?: string | null;
  sshKey?: string;
  notes?: string;
  provisionError?: string | null;
  provisionRetryCount?: number | null;
  lastProvisionRetryAt?: string | null;
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
