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
  initialValues?: Record<string, unknown>;
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
  AiProviderAipUUID: {
    label: 'Create AI provider',
    loadComponent: () =>
      import('../../../pages/settings/ai-providers/ai-providers').then((m) => m.AiProvidersPage),
    permission: 'platform.ai.manage',
  },
  AuthenticationClusterAtcUUID: {
    label: 'authentication.clusters',
    loadComponent: () =>
      import('../../../pages/authentication/clusters/clusters').then(
        (m) => m.AuthenticationClusterPage,
      ),
    permission: 'platform.authentication.manage',
    routeData: { scope: 'master' },
  },
  AuthenticationServerAtsUUID: {
    label: 'authentication.servers',
    loadComponent: () =>
      import('../../../pages/authentication/servers/servers').then(
        (m) => m.AuthenticationServerPage,
      ),
    permission: 'platform.authentication.manage',
    routeData: { scope: 'master' },
  },
  AuthenticationAccountAacUUID: {
    label: 'authentication.accounts',
    loadComponent: () =>
      import('../../../pages/authentication/accounts/accounts').then(
        (m) => m.AuthenticationAccountPage,
      ),
    permission: 'tenant.authentication.write',
    routeData: { scope: 'tenant' },
  },
  AuthenticationRateLimitArlUUID: {
    label: 'authentication.rate-limits',
    loadComponent: () =>
      import('../../../pages/authentication/rate-limits/rate-limits').then(
        (m) => m.AuthenticationRateLimitPage,
      ),
    permission: 'tenant.authentication.write',
    routeData: { scope: 'tenant' },
  },
  AuthenticationProfileAapUUID: {
    label: 'authentication.profiles',
    loadComponent: () =>
      import('../../../pages/authentication/profiles/profiles').then(
        (m) => m.AuthenticationProfilePage,
      ),
    permission: 'tenant.authentication.write',
    routeData: { scope: 'tenant' },
  },
  AuthenticationNasAanUUID: {
    label: 'authentication.network-devices',
    loadComponent: () =>
      import('../../../pages/authentication/network-devices/network-devices').then(
        (m) => m.AuthenticationNasPage,
      ),
    permission: 'tenant.authentication.write',
    routeData: { scope: 'tenant' },
  },
  AuthenticationGroupAagUUID: {
    label: 'authentication.groups',
    loadComponent: () =>
      import('../../../pages/authentication/groups/groups').then((m) => m.AuthenticationGroupPage),
    permission: 'tenant.authentication.write',
    routeData: { scope: 'tenant' },
  },
  AuthenticationDomainAadUUID: {
    label: 'authentication.domains',
    loadComponent: () =>
      import('../../../pages/authentication/domains/domains').then(
        (m) => m.AuthenticationDomainPage,
      ),
    permission: 'tenant.authentication.write',
    routeData: { scope: 'tenant' },
  },
  AuthenticationAccessAaxUUID: {
    label: 'authentication.accesses',
    loadComponent: () =>
      import('../../../pages/authentication/accesses/accesses').then(
        (m) => m.AuthenticationAccessPage,
      ),
    permission: 'tenant.authentication.write',
    routeData: { scope: 'tenant' },
  },
  CrmIndustryCinUUID: {
    label: 'crm.title.industries',
    loadComponent: () =>
      import('../../../pages/crm/industries/industries').then((m) => m.CrmIndustryPage),
    permission: 'tenant.crm.manage',
  },
  CrmSourceCsoUUID: {
    label: 'crm.title.sources',
    loadComponent: () => import('../../../pages/crm/sources/sources').then((m) => m.CrmSourcePage),
    permission: 'tenant.crm.manage',
  },
  CrmLossReasonClrUUID: {
    label: 'crm.title.loss-reasons',
    loadComponent: () =>
      import('../../../pages/crm/loss-reasons/loss-reasons').then((m) => m.CrmLossReasonPage),
    permission: 'tenant.crm.manage',
  },
  CrmPipelineCpiUUID: {
    label: 'crm.title.pipelines',
    loadComponent: () =>
      import('../../../pages/crm/pipelines/pipelines').then((m) => m.CrmPipelinePage),
    permission: 'tenant.crm.manage',
  },
  CrmStageCstUUID: {
    label: 'crm.title.stages',
    loadComponent: () => import('../../../pages/crm/stages/stages').then((m) => m.CrmStagePage),
    permission: 'tenant.crm.manage',
  },
  CrmAccountCacUUID: {
    label: 'crm.title.accounts',
    loadComponent: () =>
      import('../../../pages/crm/accounts/accounts').then((m) => m.CrmAccountPage),
    permission: 'tenant.crm.write',
  },
  CrmContactCcoUUID: {
    label: 'crm.title.contacts',
    loadComponent: () =>
      import('../../../pages/crm/contacts/contacts').then((m) => m.CrmContactPage),
    permission: 'tenant.crm.write',
  },
  CrmProductCprUUID: {
    label: 'crm.title.products',
    loadComponent: () =>
      import('../../../pages/crm/products/products').then((m) => m.CrmProductPage),
    permission: 'tenant.crm.manage',
  },
  CrmLeadCleUUID: {
    label: 'crm.title.leads',
    loadComponent: () => import('../../../pages/crm/leads/leads').then((m) => m.CrmLeadPage),
    permission: 'tenant.crm.write',
  },
  CrmOpportunityCopUUID: {
    label: 'crm.title.opportunities',
    loadComponent: () =>
      import('../../../pages/crm/opportunities/opportunities').then((m) => m.CrmOpportunityPage),
    permission: 'tenant.crm.write',
  },
  CrmActivityCatUUID: {
    label: 'crm.title.activities',
    loadComponent: () =>
      import('../../../pages/crm/activities/activities').then((m) => m.CrmActivityPage),
    permission: 'tenant.crm.write',
  },
  CrmProposalCppUUID: {
    label: 'crm.title.proposals',
    loadComponent: () =>
      import('../../../pages/crm/proposals/proposals').then((m) => m.CrmProposalPage),
    permission: 'tenant.crm.write',
  },
  CrmProposalItemCptUUID: {
    label: 'crm.title.proposal-items',
    loadComponent: () =>
      import('../../../pages/crm/proposal-items/proposal-items').then((m) => m.CrmProposalItemPage),
    permission: 'tenant.crm.write',
  },
  CrmHandoffChoUUID: {
    label: 'crm.title.handoffs',
    loadComponent: () =>
      import('../../../pages/crm/handoffs/handoffs').then((m) => m.CrmHandoffPage),
    permission: 'tenant.crm.write',
  },

  BillingPackageBpaUUID: {
    label: 'Create package',
    loadComponent: () =>
      import('../../../pages/billing/system/packages/packages').then(
        (m) => m.BillingSystemPackagesPage,
      ),
    permission: MASTER_PERMISSION,
  },
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
  CyberSecurityTrustedNodeCtnUUID: {
    label: 'Create trusted node',
    loadComponent: () =>
      import('../../../pages/cyber-security/trusted-nodes/trusted-nodes').then(
        (m) => m.CyberSecurityTrustedNodesPage,
      ),
  },
  ErpCompanyComUUID: {
    label: 'Create company',
    loadComponent: () =>
      import('../../../pages/erp/companies/companies').then((m) => m.ErpCompaniesPage),
  },
  FiscalIssuerProfileFipUUID: {
    label: 'Create fiscal issuer',
    loadComponent: () =>
      import('../../../pages/erp/fiscal-issuers/fiscal-issuers').then(
        (m) => m.ErpFiscalIssuersPage,
      ),
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
  ErpFinPayMethodEfmUUID: {
    label: 'Create payment method',
    loadComponent: () =>
      import('../../../pages/erp/financial/payment/method/payment-method').then(
        (m) => m.FinancialPaymentMethodPage,
      ),
  },
  ErpHrDepartmentEhdUUID: {
    label: 'Create department',
    loadComponent: () =>
      import('../../../pages/erp/human-resources/departments/departments').then(
        (m) => m.ErpHumanResourcesDepartmentsPage,
      ),
  },
  ErpHrEmployeeEmpUUID: {
    label: 'Create employee',
    loadComponent: () =>
      import('../../../pages/erp/human-resources/employees/employees').then(
        (m) => m.ErpHumanResourcesEmployeesPage,
      ),
  },
  ErpHrPositionEhpUUID: {
    label: 'Create position',
    loadComponent: () =>
      import('../../../pages/erp/human-resources/positions/positions').then(
        (m) => m.ErpHumanResourcesPositionsPage,
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
  HostingVpsFirewallHvfUUID: {
    label: 'Create firewall profile',
    loadComponent: () =>
      import('../../../pages/hosting/vps/firewalls/firewalls').then(
        (m) => m.HostingVpsFirewallsPage,
      ),
  },
  HostingVpsNetworkHvnUUID: {
    label: 'Create private network',
    loadComponent: () =>
      import('../../../pages/hosting/vps/networks/networks').then((m) => m.HostingVpsNetworksPage),
  },
  HostingVpsPlanHvpUUID: {
    label: 'Create VPS plan',
    loadComponent: () =>
      import('../../../pages/hosting/vps/plans/plans').then((m) => m.HostingVpsPlansPage),
    permission: MASTER_PERMISSION,
  },
  HostingVpsProviderHvrUUID: {
    label: 'Create VPS provider',
    loadComponent: () =>
      import('../../../pages/hosting/vps/provider/provider').then((m) => m.HostingVpsProviderPage),
    permission: MASTER_PERMISSION,
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
  InfraGisAssetCategoryIacUUID: {
    label: 'Create category',
    loadComponent: () =>
      import('../../../pages/infragis/management/management').then((m) => m.InfraGisManagementPage),
    routeData: { resource: 'categories' },
  },
  InfraGisAssetStatusIgsUUID: {
    label: 'Create asset status',
    loadComponent: () =>
      import('../../../pages/infragis/management/management').then((m) => m.InfraGisManagementPage),
    routeData: { resource: 'statuses' },
  },
  InfraGisAssetTypeIgtUUID: {
    label: 'Create asset type',
    loadComponent: () =>
      import('../../../pages/infragis/management/management').then((m) => m.InfraGisManagementPage),
    routeData: { resource: 'asset-types' },
  },
  InfraGisLayerIglUUID: {
    label: 'Create layer',
    loadComponent: () =>
      import('../../../pages/infragis/management/management').then((m) => m.InfraGisManagementPage),
    routeData: { resource: 'layers' },
  },
  InfraGisProjectIprUUID: {
    label: 'Create project',
    loadComponent: () =>
      import('../../../pages/infragis/management/management').then((m) => m.InfraGisManagementPage),
    routeData: { resource: 'projects' },
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
  SaleBrandSbrUUID: {
    label: 'Create brand',
    loadComponent: () => import('../../../pages/sales/brand/brand').then((m) => m.SaleBrandPage),
  },
  SaleCategoryScaUUID: {
    label: 'Create category',
    loadComponent: () =>
      import('../../../pages/sales/category/category').then((m) => m.SaleCategoryPage),
  },
  SalePriceListSplUUID: {
    label: 'Create price list',
    loadComponent: () =>
      import('../../../pages/sales/price-list/price-list').then((m) => m.SalePriceListPage),
  },
  SaleProductSprUUID: {
    label: 'Create product',
    loadComponent: () =>
      import('../../../pages/sales/product/product').then((m) => m.SaleProductPage),
  },
  SaleUnitSunUUID: {
    label: 'Create unit',
    loadComponent: () => import('../../../pages/sales/unit/unit').then((m) => m.SaleUnitPage),
  },
  StockLocationStlUUID: {
    label: 'Create stock location',
    loadComponent: () => import('../../../pages/stock/locations').then((m) => m.StockLocationsPage),
  },
  SupportTicketPriorityStpUUID: {
    routeData: { supportDesk: 'tenant' },
    label: 'Create priority',
    loadComponent: () =>
      import('../../../pages/support/ticket-priorities/ticket-priorities').then(
        (m) => m.SupportTicketPrioritiesPage,
      ),
  },
  SupportTeamStmUUID: {
    routeData: { supportDesk: 'tenant' },
    label: 'Create support team',
    loadComponent: () =>
      import('../../../pages/support/teams/teams').then((m) => m.SupportTeamsPage),
  },
  SupportTicketTypeSttUUID: {
    routeData: { supportDesk: 'tenant' },
    label: 'Create ticket type',
    loadComponent: () =>
      import('../../../pages/support/ticket-types/ticket-types').then(
        (m) => m.SupportTicketTypesPage,
      ),
  },
  SupportTicketChannelStcUUID: {
    routeData: { supportDesk: 'tenant' },
    label: 'Create origin',
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
  VoipPabxCustomVpcUUID: {
    label: 'Create custom',
    loadComponent: () =>
      import('../../../pages/voip/pabx/custom/custom').then((m) => m.VoipPabxCustomPage),
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
