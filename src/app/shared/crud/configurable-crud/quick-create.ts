import { InjectionToken, Type } from '@angular/core';

import type {
  ConfigurableCrudQuickCreateConfig,
  ConfigurableCrudQuickCreateResult,
} from './configurable-crud-page-base';

/**
 * Provided only by the quick-create host. A configurable CRUD page that finds this token runs as
 * the create form of a related FK select: no list, create dialog only, result returned here.
 */
export type ConfigurableCrudQuickCreateSession = {
  complete(result: ConfigurableCrudQuickCreateResult): void;
};

export const CONFIGURABLE_CRUD_QUICK_CREATE =
  new InjectionToken<ConfigurableCrudQuickCreateSession>('CONFIGURABLE_CRUD_QUICK_CREATE');

type PageLoader = () => Promise<Type<unknown>>;

type QuickCreateRegistryEntry = {
  label: string;
  loadComponent: PageLoader;
  permission?: string;
  routeData?: Record<string, unknown>;
};

/** Resources created only through platform administration (`system/*` endpoints). */
const MASTER_PERMISSION = 'platform.master.access';

/**
 * Canonical create form per referenced resource, keyed by the canonical FK column
 * (`ReferencedTableName` + `ReferencedTableField`). Form fields whose `source` matches a key get
 * quick-create automatically; fields with a non-canonical source use `quickCreateFor(key)`.
 * Entries load the routed page lazily, so registering a resource never pulls it into every bundle.
 */
export const QUICK_CREATE_REGISTRY = {
  BillingPriceBpcUUID: {
    label: 'Create price',
    loadComponent: () =>
      import('../../../pages/billing/system/prices/prices').then((m) => m.BillingSystemPricesPage),
    permission: MASTER_PERMISSION,
  },
  BillingProductBprUUID: {
    label: 'Create product',
    loadComponent: () =>
      import('../../../pages/billing/system/products/products').then(
        (m) => m.BillingSystemProductsPage,
      ),
    permission: MASTER_PERMISSION,
  },
  ClinicAgreementCagUUID: {
    label: 'Create agreement',
    loadComponent: () =>
      import('../../../pages/clinic/agreements/catalog/catalog').then(
        (m) => m.ClinicAgreementCatalogPage,
      ),
    routeData: { catalog: 'agreements' },
  },
  ClinicAgreementPlanCapUUID: {
    label: 'Create plan',
    loadComponent: () =>
      import('../../../pages/clinic/agreements/catalog/catalog').then(
        (m) => m.ClinicAgreementCatalogPage,
      ),
    routeData: { catalog: 'plans' },
  },
  ClinicProcedureCprUUID: {
    label: 'Create procedure',
    loadComponent: () =>
      import('../../../pages/clinic/agreements/catalog/catalog').then(
        (m) => m.ClinicAgreementCatalogPage,
      ),
    routeData: { catalog: 'procedures' },
  },
  CustomerCusUUID: {
    label: 'Create customer',
    loadComponent: () =>
      import('../../../pages/erp/customer/customer').then((m) => m.ErpCustomerPage),
  },
  CyberSecuritySecretAccountCxaUUID: {
    label: 'Create secret account',
    loadComponent: () =>
      import('../../../pages/cyber-security/secrets/secret-accounts').then(
        (m) => m.CyberSecuritySecretAccountsPage,
      ),
  },
  CyberSecuritySecretServerCsrUUID: {
    label: 'Create secret server',
    loadComponent: () =>
      import('../../../pages/cyber-security/secrets/secret-servers').then(
        (m) => m.CyberSecuritySecretServersPage,
      ),
    permission: MASTER_PERMISSION,
  },
  ErpComplexEcxUUID: {
    label: 'Create complex',
    loadComponent: () => import('../../../pages/erp/complex/complex').then((m) => m.ErpComplexPage),
  },
  ErpFinPayGatewayAccountEfgUUID: {
    label: 'Create gateway account',
    loadComponent: () =>
      import('../../../pages/erp/financial/payment/gateway/payment-gateway').then(
        (m) => m.FinancialPaymentGatewayPage,
      ),
  },
  ErpSupplierSupUUID: {
    label: 'Create supplier',
    loadComponent: () =>
      import('../../../pages/erp/supplier/supplier').then((m) => m.ErpSupplierPage),
  },
  HostingDnsProviderHdpUUID: {
    label: 'Create DNS provider',
    loadComponent: () =>
      import('../../../pages/hosting/dns/providers/providers').then(
        (m) => m.HostingDnsProvidersPage,
      ),
  },
  HostingDnsRegisterHrgUUID: {
    label: 'Create DNS register',
    loadComponent: () =>
      import('../../../pages/hosting/dns/registers/registers').then(
        (m) => m.HostingDnsRegistersPage,
      ),
  },
  HostingSmtpAccountHsaUUID: {
    label: 'Create SMTP account',
    loadComponent: () =>
      import('../../../pages/hosting/smtp/accounts/accounts').then(
        (m) => m.HostingSmtpAccountsPage,
      ),
  },
  HostingSmtpProviderHspUUID: {
    label: 'Create SMTP provider',
    loadComponent: () =>
      import('../../../pages/hosting/smtp/providers/providers').then(
        (m) => m.HostingSmtpProvidersPage,
      ),
  },
  HostingStorageAccountHsaUUID: {
    label: 'Create storage account',
    loadComponent: () =>
      import('../../../pages/hosting/storage/accounts/accounts').then(
        (m) => m.HostingStorageAccountsPage,
      ),
  },
  HostingStorageProviderHspUUID: {
    label: 'Create storage provider',
    loadComponent: () =>
      import('../../../pages/hosting/storage/providers/providers').then(
        (m) => m.HostingStorageProvidersPage,
      ),
    permission: MASTER_PERMISSION,
  },
  HostingVpsContainerPlanHcnUUID: {
    label: 'Create container plan',
    loadComponent: () =>
      import('../../../pages/hosting/vps-container/plans/plans').then(
        (m) => m.HostingVpsContainerPlansPage,
      ),
  },
  HostingVpsContainerProviderHcpUUID: {
    label: 'Create container provider',
    loadComponent: () =>
      import('../../../pages/hosting/vps-container/provider/provider').then(
        (m) => m.HostingVpsContainerProviderPage,
      ),
  },
  HostingVpsInstanceHviUUID: {
    label: 'Create VPS instance',
    loadComponent: () =>
      import('../../../pages/hosting/vps/instances/instances').then(
        (m) => m.HostingVpsInstancesPage,
      ),
  },
  HostingVpsPlanHvpUUID: {
    label: 'Create VPS plan',
    loadComponent: () =>
      import('../../../pages/hosting/vps/plans/plans').then((m) => m.HostingVpsPlansPage),
  },
  HostingVpsProviderHvrUUID: {
    label: 'Create VPS provider',
    loadComponent: () =>
      import('../../../pages/hosting/vps/provider/provider').then((m) => m.HostingVpsProviderPage),
  },
  HostingWebhostDatabaseHwdUUID: {
    label: 'Create database',
    loadComponent: () =>
      import('../../../pages/hosting/webhost/databases/databases').then(
        (m) => m.HostingWebhostDatabasesPage,
      ),
    routeData: { databaseResource: 'databases' },
  },
  HostingWebhostDatabaseUserHduUUID: {
    label: 'Create database user',
    loadComponent: () =>
      import('../../../pages/hosting/webhost/databases/databases').then(
        (m) => m.HostingWebhostDatabasesPage,
      ),
    routeData: { databaseResource: 'database-users' },
  },
  HostingWebhostHostHwhUUID: {
    label: 'Create host',
    loadComponent: () =>
      import('../../../pages/hosting/webhost/hosts/hosts').then((m) => m.HostingWebhostHostsPage),
  },
  HostingWebhostPlanHwlUUID: {
    label: 'Create hosting plan',
    loadComponent: () =>
      import('../../../pages/hosting/webhost/plans/plans').then((m) => m.HostingWebhostPlansPage),
    permission: MASTER_PERMISSION,
  },
  HostingWebhostProviderHwpUUID: {
    label: 'Create hosting provider',
    loadComponent: () =>
      import('../../../pages/hosting/webhost/providers/providers').then(
        (m) => m.HostingWebhostProvidersPage,
      ),
    permission: MASTER_PERMISSION,
  },
  IspPopIppUUID: {
    label: 'Create POP',
    loadComponent: () => import('../../../pages/isp/pop/pop').then((m) => m.IspPopPage),
  },
  IspVendorIveUUID: {
    label: 'Create vendor',
    loadComponent: () => import('../../../pages/isp/vendor/vendor').then((m) => m.IspVendorPage),
  },
  IspVendorModelIvmUUID: {
    label: 'Create vendor model',
    loadComponent: () =>
      import('../../../pages/isp/vendor-model/vendor-model').then((m) => m.IspVendorModelPage),
  },
  PayFeePlanPfpUUID: {
    label: 'Create fee plan',
    loadComponent: () =>
      import('../../../pages/system/pay/fee-plans/fee-plans').then((m) => m.SystemPayFeePlansPage),
    permission: MASTER_PERMISSION,
  },
  RealtimeDomainRtdUUID: {
    label: 'Create realtime domain',
    loadComponent: () =>
      import('../../../pages/realtime/domains/domains').then((m) => m.RealtimeDomainsPage),
    permission: MASTER_PERMISSION,
  },
  RealtimeDomainTenantRtdUUID: {
    label: 'Create realtime domain',
    loadComponent: () =>
      import('../../../pages/realtime/domains/domains').then((m) => m.RealtimeDomainsTenantPage),
  },
  RealtimeMediaDomainRmdUUID: {
    label: 'Create media domain',
    loadComponent: () =>
      import('../../../pages/realtime/media/media').then((m) => m.RealtimeMediaDomainsPage),
    permission: MASTER_PERMISSION,
  },
  RealtimeMediaServerRmsUUID: {
    label: 'Create media server',
    loadComponent: () =>
      import('../../../pages/realtime/media/media').then((m) => m.RealtimeMediaServersPage),
    permission: MASTER_PERMISSION,
  },
  RealtimeTurnServerRtsUUID: {
    label: 'Create TURN server',
    loadComponent: () =>
      import('../../../pages/realtime/turn/turn').then((m) => m.RealtimeTurnServersPage),
    permission: MASTER_PERMISSION,
  },
  RealtimeWebRtcDomainRwdUUID: {
    label: 'Create WebRTC domain',
    loadComponent: () =>
      import('../../../pages/realtime/webrtc/webrtc').then(
        (m) => m.RealtimeWebRtcDomainsTenantPage,
      ),
  },
  RealtimeWebRtcServerRwsUUID: {
    label: 'Create WebRTC server',
    loadComponent: () =>
      import('../../../pages/realtime/webrtc/webrtc').then((m) => m.RealtimeWebRtcServersPage),
    permission: MASTER_PERMISSION,
  },
  SaleStockTypeSstUUID: {
    label: 'Create stock type',
    loadComponent: () =>
      import('../../../pages/sales/stock-type/stock-type').then((m) => m.SaleStockTypePage),
  },
  SupportTicketChannelStcUUID: {
    label: 'Create channel',
    loadComponent: () =>
      import('../../../pages/support/ticket-channels/ticket-channels').then(
        (m) => m.SupportTicketChannelsPage,
      ),
  },
  VoipBlacklistVbkUUID: {
    label: 'Create blacklist',
    loadComponent: () =>
      import('../../../pages/voip/pabx/blacklist/list/list').then(
        (m) => m.VoipPabxBlacklistListPage,
      ),
  },
  VoipDidOperatorVdoUUID: {
    label: 'Create operator',
    loadComponent: () =>
      import('../../../pages/voip/did/operator/operator').then((m) => m.VoipDidOperatorPage),
    permission: MASTER_PERMISSION,
  },
  VoipDidVddUUID: {
    label: 'Create DID',
    loadComponent: () => import('../../../pages/voip/did/did').then((m) => m.VoipDidPage),
    permission: MASTER_PERMISSION,
  },
  VoipDomainVdmUUID: {
    label: 'Create VoIP domain',
    loadComponent: () => import('../../../pages/voip/domain/domain').then((m) => m.VoipDomainPage),
  },
  VoipPabxAccountVpaUUID: {
    label: 'Create PABX',
    loadComponent: () =>
      import('../../../pages/voip/pabx/account/account').then((m) => m.VoipPabxAccountPage),
  },
  VoipPabxDialPlanVdpUUID: {
    label: 'Create dial plan',
    loadComponent: () =>
      import('../../../pages/voip/pabx/dial-plan/plan/plan').then(
        (m) => m.VoipPabxDialPlanPlanPage,
      ),
  },
  VoipPabxExtensionVpeUUID: {
    label: 'Create extension',
    loadComponent: () =>
      import('../../../pages/voip/pabx/extension/extension').then((m) => m.VoipPabxExtensionPage),
  },
  VoipPabxMediaFileVmfUUID: {
    label: 'Create media file',
    loadComponent: () =>
      import('../../../pages/voip/pabx/media-files/media-files').then(
        (m) => m.VoipPabxMediaFilesPage,
      ),
  },
  VoipPabxServerVpsUUID: {
    label: 'Create PABX server',
    loadComponent: () =>
      import('../../../pages/voip/pabx/server/server').then((m) => m.VoipPabxServerPage),
    permission: MASTER_PERMISSION,
  },
  VoipPabxTrunkVptUUID: {
    label: 'Create trunk',
    loadComponent: () =>
      import('../../../pages/voip/pabx/trunk/trunk').then((m) => m.VoipPabxTrunkPage),
  },
  VoipPortabilityReasonVprUUID: {
    label: 'Create reason',
    loadComponent: () =>
      import('../../../pages/voip/portability-reasons/portability-reasons').then(
        (m) => m.VoipPortabilityReasonsPage,
      ),
  },
  VoipSbcAccountVsaUUID: {
    label: 'Create SBC account',
    loadComponent: () =>
      import('../../../pages/voip/sbc/account/account').then((m) => m.VoipSbcAccountPage),
  },
  VoipSbcInterfaceVsiUUID: {
    label: 'Create SBC interface',
    loadComponent: () =>
      import('../../../pages/voip/sbc/interface/interface').then((m) => m.VoipSbcInterfacePage),
    permission: MASTER_PERMISSION,
  },
  VoipSbcPeerVspUUID: {
    label: 'Create SBC peer',
    loadComponent: () => import('../../../pages/voip/sbc/peer/peer').then((m) => m.VoipSbcPeerPage),
  },
  VoipSbcPipeVbpUUID: {
    label: 'Create SBC pipe',
    loadComponent: () => import('../../../pages/voip/sbc/pipe/pipe').then((m) => m.VoipSbcPipePage),
  },
  VoipSbcServerVbsUUID: {
    label: 'Create SBC server',
    loadComponent: () =>
      import('../../../pages/voip/sbc/server/server').then((m) => m.VoipSbcServerPage),
    permission: MASTER_PERMISSION,
  },
  VoipSoftswitchAccountVssUUID: {
    label: 'Create softswitch account',
    loadComponent: () =>
      import('../../../pages/voip/softswitch/accounts/accounts').then(
        (m) => m.VoipSoftswitchAccountsPage,
      ),
  },
  VoipSoftswitchDialplanVdpUUID: {
    label: 'Create dialplan',
    loadComponent: () =>
      import('../../../pages/voip/softswitch/dialplan/dialplan').then(
        (m) => m.VoipSoftswitchDialplanPage,
      ),
  },
  VoipSoftswitchServerVsrUUID: {
    label: 'Create softswitch server',
    loadComponent: () =>
      import('../../../pages/voip/softswitch/server/server').then(
        (m) => m.VoipSoftswitchServerPage,
      ),
    permission: MASTER_PERMISSION,
  },
  VoipSoftswitchSubscriberVsuUUID: {
    label: 'Create subscriber',
    loadComponent: () =>
      import('../../../pages/voip/softswitch/subscriber/subscriber').then(
        (m) => m.VoipSoftswitchSubscriberPage,
      ),
  },
  VoipSoftswitchTrunkGroupVtgUUID: {
    label: 'Create trunk group',
    loadComponent: () =>
      import('../../../pages/voip/softswitch/trunk-group/trunk-group').then(
        (m) => m.VoipSoftswitchTrunkGroupPage,
      ),
  },
  VoipSoftswitchTrunkVtkUUID: {
    label: 'Create trunk',
    loadComponent: () =>
      import('../../../pages/voip/softswitch/trunk/trunk').then((m) => m.VoipSoftswitchTrunkPage),
  },
} satisfies Record<string, QuickCreateRegistryEntry>;

export type QuickCreateRegistryKey = keyof typeof QUICK_CREATE_REGISTRY;

const registry: Readonly<Record<string, QuickCreateRegistryEntry>> = QUICK_CREATE_REGISTRY;

export function quickCreateRegistryEntry(
  key: string | undefined,
): ConfigurableCrudQuickCreateConfig | null {
  const entry = key ? registry[key] : undefined;
  return entry ? { ...entry } : null;
}

/** Explicit registry binding for a field whose `source`/key is not the canonical FK column. */
export function quickCreateFor(
  key: QuickCreateRegistryKey,
  overrides: Omit<ConfigurableCrudQuickCreateConfig, 'component' | 'loadComponent'> = {},
): ConfigurableCrudQuickCreateConfig {
  return { ...quickCreateRegistryEntry(key)!, ...overrides };
}
