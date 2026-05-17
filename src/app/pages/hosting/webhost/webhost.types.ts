export type WebhostProviderType = 'cpanel_whm' | 'plesk' | 'directadmin';

export type WebhostProviderConfig = {
  hostname?: string | null;
  port?: number | null;
  sslVerify?: boolean | null;
  notes?: string | null;
};

export type WebhostProviderCredentials = {
  username?: string | null;
  apiToken?: string | null;
};

export type HostingWebhostProvider = {
  HwpUUID: string;
  HwpName: string;
  HwpProvider: WebhostProviderType;
  HwpConfig?: WebhostProviderConfig | null;
  credentials?: WebhostProviderCredentials | null;
  HwpIsActive: number;
  HwpIsDefault: number;
};

export type WebhostPlanConfig = {
  notes?: string | null;
};

export type HostingWebhostPlan = {
  HwlUUID: string;
  HwlName: string;
  HostingWebhostProviderHwpUUID: string;
  ProviderName: string;
  HwlProvider: WebhostProviderType;
  HwlPackage?: string | null;
  HwlDiskMb?: number | null;
  HwlBandwidthMb?: number | null;
  HwlDomains?: number | null;
  HwlSubdomains?: number | null;
  HwlEmailAccounts?: number | null;
  HwlDatabases?: number | null;
  HwlFtpAccounts?: number | null;
  HwlCurrency: string;
  HwlPrice: number;
  HwlSetupFee?: number | null;
  HwlConfig?: WebhostPlanConfig | null;
  HwlIsActive: number;
};

export type WebhostHostStatus = 'pending' | 'active' | 'suspended' | 'error' | 'cancelled';

export type WebhostHostProvisionStatus =
  | 'manual'
  | 'pending'
  | 'provisioning'
  | 'provisioned'
  | 'failed';

export type WebhostHostConfig = {
  contactEmail?: string | null;
  documentRoot?: string | null;
  autoProvision?: boolean | null;
  notes?: string | null;
};

export type HostingWebhostHost = {
  HwhUUID: string;
  HwhName: string;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  HostingWebhostPlanHwlUUID: string;
  PlanName: string;
  PlanPackage?: string | null;
  PlanDiskMb?: number | null;
  PlanBandwidthMb?: number | null;
  HostingWebhostProviderHwpUUID: string;
  ProviderName: string;
  HwlProvider: WebhostProviderType;
  HostingDnsDomainHddUUID: string;
  DomainName: string;
  HwhUsername: string;
  HwhExternalId?: string | null;
  HwhProviderStatus?: string | null;
  HwhStatus: WebhostHostStatus;
  HwhProvisionStatus: WebhostHostProvisionStatus;
  HwhProvisionError?: string | null;
  HwhLastSyncAt?: string | null;
  HwhConfig?: WebhostHostConfig | null;
  HwhIsActive: number;
};

export type HostingDnsDomainOption = {
  HddUUID: string;
  HddName: string;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  HddProvider?: string | null;
  HddStatus?: number | null;
};

export type WebhostEmailStatus = 'pending' | 'active' | 'suspended' | 'error' | 'cancelled';

export type WebhostEmailProvisionStatus =
  | 'manual'
  | 'pending'
  | 'provisioning'
  | 'provisioned'
  | 'failed';

export type WebhostEmailConfig = {
  autoProvision?: boolean | null;
  notes?: string | null;
};

export type HostingWebhostEmailAccount = {
  HweUUID: string;
  HostingWebhostHostHwhUUID: string;
  HostName: string;
  HostUsername: string;
  HostingDnsDomainHddUUID: string;
  DomainName: string;
  HweEmail: string;
  HostingWebhostPlanHwlUUID: string;
  PlanName: string;
  HostingWebhostProviderHwpUUID: string;
  ProviderName: string;
  HwlProvider: WebhostProviderType;
  HweLocalPart: string;
  HweQuotaMb?: number | null;
  HweExternalId?: string | null;
  HweProviderStatus?: string | null;
  HweStatus: WebhostEmailStatus;
  HweProvisionStatus: WebhostEmailProvisionStatus;
  HweProvisionError?: string | null;
  HweLastSyncAt?: string | null;
  HwePasswordLastChangedAt?: string | null;
  HweConfig?: WebhostEmailConfig | null;
  HweIsActive: number;
};

export type WebhostToolStatus = 'pending' | 'active' | 'error' | 'cancelled';
export type WebhostToolProvisionStatus =
  | 'manual'
  | 'pending'
  | 'provisioning'
  | 'provisioned'
  | 'failed';
export type WebhostZoneRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA';
export type WebhostZoneRecordStatus = 'pending' | 'active' | 'error' | 'deleted';

export type HostingWebhostDatabase = {
  HwdUUID: string;
  HostingWebhostHostHwhUUID: string;
  HostName: string;
  HostUsername: string;
  DomainName: string;
  ProviderName: string;
  HwlProvider: WebhostProviderType;
  HwdName: string;
  HwdUsername?: string | null;
  HwdPrivileges?: string | null;
  HwdStatus: WebhostToolStatus;
  HwdProvisionStatus: WebhostToolProvisionStatus;
  HwdLastSyncAt?: string | null;
  HwdIsActive: number;
};

export type HostingWebhostMailingList = {
  HwmUUID: string;
  HostingWebhostHostHwhUUID: string;
  HostName: string;
  HostUsername: string;
  DomainName: string;
  ProviderName: string;
  HwlProvider: WebhostProviderType;
  HwmName: string;
  HwmEmail: string;
  HwmAdminEmail?: string | null;
  HwmAccessType: 'public' | 'private';
  HwmAdvertised: number;
  HwmStatus: WebhostToolStatus;
  HwmProvisionStatus: WebhostToolProvisionStatus;
  HwmLastSyncAt?: string | null;
  HwmIsActive: number;
};

export type HostingWebhostZoneRecord = {
  HwzUUID: string;
  HostingWebhostHostHwhUUID: string;
  HostName: string;
  HostUsername: string;
  DomainName: string;
  ProviderName: string;
  HwlProvider: WebhostProviderType;
  HwzName: string;
  HwzType: WebhostZoneRecordType;
  HwzValue: string;
  HwzPriority?: number | null;
  HwzWeight?: number | null;
  HwzPort?: number | null;
  HwzTtl: number;
  HwzLine?: number | null;
  HwzStatus: WebhostZoneRecordStatus;
  HwzProvisionStatus: WebhostToolProvisionStatus;
  HwzLastSyncAt?: string | null;
  HwzIsActive: number;
};
