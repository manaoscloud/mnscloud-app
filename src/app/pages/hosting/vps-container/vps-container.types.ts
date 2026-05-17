export type VpsContainerProvider = 'incus';

export type VpsContainerProviderConfig = {
  apiUrl?: string;
  project?: string;
  target?: string;
  storagePool?: string;
  network?: string;
  profile?: string;
  remote?: string;
  imageAlias?: string;
  verifyTls?: boolean;
  flavors?: Array<Record<string, unknown>>;
};

export type VpsContainerProviderCredentials = {
  bearerToken?: string;
  clientCertificate?: string;
  clientPrivateKey?: string;
  serverCertificate?: string;
};

export type HostingVpsContainerProvider = {
  HcpUUID: string;
  HcpName: string;
  HcpProvider: VpsContainerProvider;
  HcpConfig?: VpsContainerProviderConfig | null;
  credentials?: VpsContainerProviderCredentials | null;
  HcpIsActive: number;
  HcpIsDefault: number;
};

export type HostingVpsContainerPlanConfig = {
  cpu?: number | null;
  memoryMb?: number | null;
  diskGb?: number | null;
  transferGb?: number | null;
  profile?: string | null;
  storagePool?: string | null;
  network?: string | null;
  target?: string | null;
  imageServer?: string | null;
  notes?: string | null;
};

export type HostingVpsContainerPlan = {
  HcnUUID: string;
  HcnName: string;
  HostingVpsContainerProviderHcpUUID: string;
  HcnProvider: VpsContainerProvider;
  HcnRegion?: string | null;
  HcnSize?: string | null;
  HcnImage?: string | null;
  HcnCurrency: string;
  HcnPrice: number;
  HcnSetupFee?: number | null;
  HcnConfig?: HostingVpsContainerPlanConfig | null;
  HcnIsActive: number;
};

export type HostingVpsContainerInstanceConfig = {
  providerImageId?: string | null;
  sshKey?: string;
  notes?: string;
  provisionError?: string | null;
  provisionRetryCount?: number | null;
  lastProvisionRetryAt?: string | null;
  ipv4?: string | null;
  ipv6?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type VpsContainerCatalogOption = {
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

export type VpsContainerProviderCatalog = {
  provider: VpsContainerProvider;
  regions: VpsContainerCatalogOption[];
  sizes: VpsContainerCatalogOption[];
  images: VpsContainerCatalogOption[];
  profiles?: VpsContainerCatalogOption[];
  networks?: VpsContainerCatalogOption[];
  storagePools?: VpsContainerCatalogOption[];
};

export type HostingVpsContainerInstance = {
  HciUUID: string;
  HciName: string;
  HciConfig?: HostingVpsContainerInstanceConfig | null;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  HciExternalId?: string | null;
  HciStatus?: string | null;
  HciIsActive: number;
  HostingVpsContainerProviderHcpUUID: string;
  HostingVpsContainerPlanHcnUUID: string;
};
