import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { userResolver } from './core/resolvers/user.resolver';
import { MainLayout } from './layout/main-layout/main-layout';
import { redirectIfLoggedGuard } from './core/guards/redirectIfLogged.guard';
import { masterGuard } from './core/guards/master.guard';
import { environmentGuard } from './core/guards/environment.guard';

export const routes: Routes = [
  // Raiz → dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // =====================================================
  // 🔓 PÚBLICAS
  // =====================================================
  {
    path: 'signin',
    canActivate: [redirectIfLoggedGuard],
    loadComponent: () => import('./pages/signin/signin').then((m) => m.Signin),
    title: 'Sign In | mnscloud',
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup').then((m) => m.Signup),
    title: 'Sign Up | mnscloud',
  },

  // Recovery
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPasswordComponent),
    title: 'Forgot Password | mnscloud',
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPasswordComponent),
    title: 'Reset Password | mnscloud',
  },
  {
    path: 'auth/email/verify',
    loadComponent: () => import('./pages/email-verify/email-verify').then((m) => m.EmailVerifyPage),
    title: 'Verify Email | mnscloud',
  },

  // Invite (público)
  {
    path: 'invite/validate',
    loadComponent: () =>
      import('./pages/tenants/invite/invite-validate/invite-validate').then(
        (m) => m.InviteValidatePage,
      ),
    title: 'Validate Invitation | mnscloud',
  },
  {
    path: 'invite/accept',
    loadComponent: () =>
      import('./pages/tenants/invite/invite-accept/invite-accept').then((m) => m.InviteAcceptPage),
    title: 'Accept Invitation | mnscloud',
  },

  // =====================================================
  // 🔒 PRIVADAS
  // =====================================================
  {
    path: '',
    component: MainLayout,
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        resolve: { user: userResolver },
        runGuardsAndResolvers: 'always',
        children: [
          // -------------------------
          // Gerais (não exigem tenant)
          // -------------------------
          {
            path: 'dashboard',
            loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
            title: 'Dashboard | mnscloud',
          },
          {
            path: 'user/profile',
            loadComponent: () =>
              import('./pages/user/profile/user-profile').then((m) => m.UserProfileComponent),
            title: 'My Profile | mnscloud',
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./pages/settings/settings').then((m) => m.SettingsComponent),
            title: 'Settings | mnscloud',
          },
          {
            path: 'settings/themes',
            loadComponent: () =>
              import('./pages/settings/themes/themes').then((m) => m.SettingsThemesPage),
            title: 'Themes | mnscloud',
          },

          // =================================================
          // 🔐 TENANT AREA (exige EnvironmentUUID)
          // =================================================
          {
            path: '',
            canActivateChild: [environmentGuard],
            children: [
              // Tenants (tenant)
              {
                path: 'settings/tenants',
                loadComponent: () =>
                  import('./pages/tenants/tenants').then((m) => m.SettingsTenantsPage),
                title: 'Tenants | mnscloud',
              },
              {
                path: 'settings/parameters',
                loadComponent: () =>
                  import('./pages/settings/parameters/parameters').then(
                    (m) => m.SettingsParametersPage,
                  ),
                title: 'Settings • Parameters | mnscloud',
                data: { scope: 'tenant' },
              },
              {
                path: 'monitoring',
                loadComponent: () =>
                  import('./pages/monitoring/dashboard/dashboard').then(
                    (m) => m.MonitoringDashboardPage,
                  ),
                title: 'Monitoring | mnscloud',
              },
              {
                path: 'monitoring/activity-logs',
                loadComponent: () =>
                  import('./pages/monitoring/activity-logs/activity').then(
                    (m) => m.MonitoringActivityLogsPage,
                  ),
                title: 'Monitoring • Activity Logs | mnscloud',
              },
              {
                path: 'monitoring/agents',
                loadComponent: () =>
                  import('./pages/monitoring/agents/agents').then((m) => m.MonitoringAgentsPage),
                title: 'Monitoring • Agents | mnscloud',
              },
              {
                path: 'billing',
                loadComponent: () =>
                  import('./pages/billing/tenant/dashboard/dashboard').then(
                    (m) => m.BillingTenantDashboardPage,
                  ),
                title: 'Billing | mnscloud',
              },
              {
                path: 'billing/catalog',
                loadComponent: () =>
                  import('./pages/billing/tenant/catalog/catalog').then(
                    (m) => m.BillingTenantCatalogPage,
                  ),
                title: 'Billing • Catalog | mnscloud',
              },
              {
                path: 'billing/subscriptions',
                loadComponent: () =>
                  import('./pages/billing/tenant/subscriptions/subscriptions').then(
                    (m) => m.BillingTenantSubscriptionsPage,
                  ),
                title: 'Billing • Subscriptions | mnscloud',
              },
              {
                path: 'billing/ledger',
                loadComponent: () =>
                  import('./pages/billing/tenant/ledger/ledger').then(
                    (m) => m.BillingTenantLedgerPage,
                  ),
                title: 'Billing • Ledger | mnscloud',
              },
              {
                path: 'cyber-security',
                loadComponent: () =>
                  import('./pages/cyber-security/cyber-security').then((m) => m.CyberSecurityPage),
                title: 'Cyber Security | mnscloud',
              },
              {
                path: 'cyber-security/services',
                loadComponent: () =>
                  import('./pages/cyber-security/services/services').then(
                    (m) => m.CyberSecurityServicesPage,
                  ),
                title: 'Cyber Security • Services | mnscloud',
              },
              {
                path: 'cyber-security/profiles',
                loadComponent: () =>
                  import('./pages/cyber-security/profiles/profiles').then(
                    (m) => m.CyberSecurityProfilesPage,
                  ),
                title: 'Cyber Security • Profiles | mnscloud',
              },
              {
                path: 'cyber-security/trusted-nodes',
                loadComponent: () =>
                  import('./pages/cyber-security/trusted-nodes/trusted-nodes').then(
                    (m) => m.CyberSecurityTrustedNodesPage,
                  ),
                title: 'Cyber Security • Trusted Nodes | mnscloud',
              },
              {
                path: 'cyber-security/network-policies',
                loadComponent: () =>
                  import('./pages/cyber-security/network-policies/network-policies').then(
                    (m) => m.CyberSecurityNetworkPoliciesPage,
                  ),
                title: 'Cyber Security • Network Policies | mnscloud',
              },
              {
                path: 'cyber-security/:section',
                loadComponent: () =>
                  import('./pages/cyber-security/cyber-security').then((m) => m.CyberSecurityPage),
                title: 'Cyber Security | mnscloud',
              },

              // CRM
              {
                path: 'erp/crm/leads',
                loadComponent: () =>
                  import('./pages/erp/crm/leads/leads').then((m) => m.CrmLeadsPage),
                title: 'ERP • CRM • Leads | mnscloud',
              },
              {
                path: 'erp/crm/opportunities',
                loadComponent: () =>
                  import('./pages/erp/crm/opportunities/opportunities').then(
                    (m) => m.CrmOpportunitiesPage,
                  ),
                title: 'ERP • CRM • Opportunities | mnscloud',
              },
              {
                path: 'erp/crm/pipeline',
                loadComponent: () =>
                  import('./pages/erp/crm/pipeline/pipeline').then((m) => m.CrmPipelinePage),
                title: 'ERP • CRM • Pipeline | mnscloud',
              },

              // ERP Entities
              {
                path: 'erp/customer',
                loadComponent: () =>
                  import('./pages/erp/customer/customer').then((m) => m.ErpCustomerPage),
                title: 'ERP • Customer | mnscloud',
              },
              {
                path: 'erp/carrier',
                loadComponent: () =>
                  import('./pages/erp/carrier/carrier').then((m) => m.ErpCarrierPage),
                title: 'ERP • Carrier | mnscloud',
              },
              {
                path: 'erp/supplier',
                loadComponent: () =>
                  import('./pages/erp/supplier/supplier').then((m) => m.ErpSupplierPage),
                title: 'ERP • Supplier | mnscloud',
              },
              {
                path: 'erp/reseller',
                loadComponent: () =>
                  import('./pages/erp/reseller/reseller').then((m) => m.ErpResellerPage),
                title: 'ERP • Reseller | mnscloud',
              },
              {
                path: 'erp/human-resources/departments',
                loadComponent: () =>
                  import('./pages/erp/human-resources/departments/departments').then(
                    (m) => m.ErpHumanResourcesDepartmentsPage,
                  ),
                title: 'ERP • Human Resources • Departments | mnscloud',
              },
              {
                path: 'erp/human-resources/positions',
                loadComponent: () =>
                  import('./pages/erp/human-resources/positions/positions').then(
                    (m) => m.ErpHumanResourcesPositionsPage,
                  ),
                title: 'ERP • Human Resources • Positions | mnscloud',
              },
              {
                path: 'erp/human-resources/employees',
                loadComponent: () =>
                  import('./pages/erp/human-resources/employees/employees').then(
                    (m) => m.ErpHumanResourcesEmployeesPage,
                  ),
                title: 'ERP • Human Resources • Employees | mnscloud',
              },
              {
                path: 'erp/human-resources/time-clock-accounts',
                loadComponent: () =>
                  import('./pages/erp/human-resources/time-clock-accounts/time-clock-accounts').then(
                    (m) => m.ErpHumanResourcesTimeClockAccountsPage,
                  ),
                title: 'ERP • Human Resources • Time Clock Accounts | mnscloud',
              },

              // Financeiro
              {
                path: 'erp/financial/account/payables',
                loadComponent: () =>
                  import('./pages/erp/financial/account/payables/payables').then(
                    (m) => m.FinancialPayablesPage,
                  ),
                title: 'ERP • Financial • Accounts Payable | mnscloud',
              },
              {
                path: 'erp/financial/account/receivables',
                loadComponent: () =>
                  import('./pages/erp/financial/account/receivables/receivables').then(
                    (m) => m.FinancialReceivablesPage,
                  ),
                title: 'ERP • Financial • Accounts Receivable | mnscloud',
              },
              {
                path: 'erp/financial/payment-method',
                loadComponent: () =>
                  import('./pages/erp/financial/payment/method/payment-method').then(
                    (m) => m.FinancialPaymentMethodPage,
                  ),
                title: 'ERP • Financial • Payment Methods | mnscloud',
              },
              {
                path: 'erp/financial/payment-gateway',
                loadComponent: () =>
                  import('./pages/erp/financial/payment/gateway/payment-gateway').then(
                    (m) => m.FinancialPaymentGatewayPage,
                  ),
                title: 'ERP • Financial • Payment Gateways | mnscloud',
                data: { scope: 'tenant', context: 'financial' },
              },

              // Invoicing
              {
                path: 'erp/financial/invoicing/boletos',
                loadComponent: () =>
                  import('./pages/erp/financial/invoicing/boletos/boletos').then(
                    (m) => m.InvoicingBoletosPage,
                  ),
                title: 'ERP • Financial • Invoicing • Boletos | mnscloud',
              },
              {
                path: 'erp/financial/invoicing/invoices',
                loadComponent: () =>
                  import('./pages/erp/financial/invoicing/invoices/invoices').then(
                    (m) => m.InvoicingInvoicesPage,
                  ),
                title: 'ERP • Financial • Invoicing • Invoices | mnscloud',
              },
              {
                path: 'erp/financial/invoicing/contracts',
                loadComponent: () =>
                  import('./pages/erp/financial/invoicing/contracts/contracts').then(
                    (m) => m.InvoicingContractsPage,
                  ),
                title: 'ERP • Financial • Invoicing • Contracts | mnscloud',
              },
              {
                path: 'erp/financial/invoicing/duedays',
                loadComponent: () =>
                  import('./pages/erp/financial/invoicing/duedays/duedays').then(
                    (m) => m.InvoicingDueDaysPage,
                  ),
                title: 'ERP • Financial • Invoicing • Due Days | mnscloud',
              },

              {
                path: 'erp/companies',
                loadComponent: () =>
                  import('./pages/erp/companies/companies').then((m) => m.ErpCompaniesPage),
                title: 'ERP • Companies | mnscloud',
              },
              {
                path: 'erp/complex',
                loadComponent: () =>
                  import('./pages/erp/complex/complex').then((m) => m.ErpComplexPage),
                title: 'ERP • Residential Complex | mnscloud',
              },

              // Estoque

              // Sale
              {
                path: 'sale/stock',
                loadComponent: () =>
                  import('./pages/sales/stocks/stocks').then((m) => m.SalesStocksPage),
                title: 'Sale • Stock | mnscloud',
              },
              {
                path: 'sale/stock-type',
                loadComponent: () =>
                  import('./pages/sales/stock-type/stock-type').then((m) => m.SaleStockTypePage),
                title: 'Sale • Stock Type | mnscloud',
              },
              {
                path: 'sale/unit',
                loadComponent: () => import('./pages/sales/unit/unit').then((m) => m.SaleUnitPage),
                title: 'Sale • Unit of Measure | mnscloud',
              },
              {
                path: 'sale/brand',
                loadComponent: () =>
                  import('./pages/sales/brand/brand').then((m) => m.SaleBrandPage),
                title: 'Sale • Brand | mnscloud',
              },
              {
                path: 'sale/category',
                loadComponent: () =>
                  import('./pages/sales/category/category').then((m) => m.SaleCategoryPage),
                title: 'Sale • Category | mnscloud',
              },
              {
                path: 'sale/product',
                loadComponent: () =>
                  import('./pages/sales/product/product').then((m) => m.SaleProductPage),
                title: 'Sale • Product | mnscloud',
              },
              {
                path: 'sale/quotation',
                loadComponent: () =>
                  import('./pages/sales/quotation/quotation').then((m) => m.SaleQuotationPage),
                title: 'Sale • Quotation | mnscloud',
              },

              // Support Channels
              {
                path: 'support/tickets',
                loadComponent: () =>
                  import('./pages/support/tickets/tickets').then((m) => m.SupportTicketsPage),
                title: 'Support • Tickets | mnscloud',
              },
              {
                path: 'support/ticket-channels',
                loadComponent: () =>
                  import('./pages/support/ticket-channels/ticket-channels').then(
                    (m) => m.SupportTicketChannelsPage,
                  ),
                title: 'Support • Chat Channels | mnscloud',
              },
              {
                path: 'support/teams',
                loadComponent: () =>
                  import('./pages/support/teams/teams').then((m) => m.SupportTeamsPage),
                title: 'Support • Teams | mnscloud',
              },
              {
                path: 'support/channels',
                loadComponent: () =>
                  import('./pages/support/channels/channels').then((m) => m.SupportChannelsPage),
                title: 'Support • Channels | mnscloud',
              },
              {
                path: 'support/attendance',
                loadComponent: () =>
                  import('./pages/support/attendance/attendance').then(
                    (m) => m.SupportAttendancePage,
                  ),
                title: 'Support • Attendance | mnscloud',
              },

              // ISP
              {
                path: 'isp/pop',
                loadComponent: () => import('./pages/isp/pop/pop').then((m) => m.IspPopPage),
                title: 'ISP • POP | mnscloud',
              },
              {
                path: 'isp/nas',
                loadComponent: () => import('./pages/isp/nas/nas').then((m) => m.IspNasPage),
                title: 'ISP • NAS | mnscloud',
              },
              {
                path: 'isp/olt',
                loadComponent: () => import('./pages/isp/olt/olt').then((m) => m.IspOltPage),
                title: 'ISP • OLT | mnscloud',
              },
              {
                path: 'isp/vendor',
                loadComponent: () =>
                  import('./pages/isp/vendor/vendor').then((m) => m.IspVendorPage),
                title: 'ISP • IspVendor | mnscloud',
              },
              {
                path: 'isp/vendor-model',
                loadComponent: () =>
                  import('./pages/isp/vendor-model/vendor-model').then((m) => m.IspVendorModelPage),
                title: 'ISP • IspVendor Model | mnscloud',
              },
              {
                path: 'isp/pool-ip/pool-ipv4',
                loadComponent: () =>
                  import('./pages/isp/pool-ip/pool-ipv4/pool-ipv4').then((m) => m.IspPoolIpv4Page),
                title: 'ISP • Pool IPv4 | mnscloud',
              },
              {
                path: 'isp/pool-ip/pool-ipv6',
                loadComponent: () =>
                  import('./pages/isp/pool-ip/pool-ipv6/pool-ipv6').then((m) => m.IspPoolIpv6Page),
                title: 'ISP • Pool IPv6 | mnscloud',
              },
              {
                path: 'isp/pool-ip/fixed-ipv4',
                loadComponent: () =>
                  import('./pages/isp/pool-ip/fixed-ipv4/fixed-ipv4').then(
                    (m) => m.IspFixedIpv4Page,
                  ),
                title: 'ISP • Fixed IPv4 | mnscloud',
              },
              {
                path: 'isp/pool-ip/fixed-ipv6',
                loadComponent: () =>
                  import('./pages/isp/pool-ip/fixed-ipv6/fixed-ipv6').then(
                    (m) => m.IspFixedIpv6Page,
                  ),
                title: 'ISP • Fixed IPv6 | mnscloud',
              },
              {
                path: 'isp/radius-server',
                loadComponent: () =>
                  import('./pages/isp/radius-server/radius-server').then(
                    (m) => m.IspRadiusServerPage,
                  ),
                title: 'ISP • Radius Server | mnscloud',
              },
              {
                path: 'isp/radius-server/pppoe-client',
                loadComponent: () =>
                  import('./pages/isp/radius-server/pppoe-client/pppoe-client').then(
                    (m) => m.PppoeClientPage,
                  ),
                title: 'ISP • PPPoE Client | mnscloud',
              },
              // InfraGIS
              {
                path: 'infragis',
                loadComponent: () =>
                  import('./pages/infragis/dashboard/dashboard').then(
                    (m) => m.InfraGisDashboardPage,
                  ),
                title: 'InfraGIS | mnscloud',
                data: { scope: 'tenant', context: 'infragis' },
              },

              // Hosting
              {
                path: 'hosting',
                loadComponent: () =>
                  import('./pages/hosting/dashboard/dashboard').then((m) => m.HostingDashboardPage),
                title: 'Hosting | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
              },
              {
                path: 'hosting/dns/domains',
                loadComponent: () =>
                  import('./pages/hosting/dns/domains/domains').then(
                    (m) => m.HostingDnsDomainsPage,
                  ),
                title: 'Hosting • DNS • Domains | mnscloud',
              },
              {
                path: 'hosting/dns/providers',
                loadComponent: () =>
                  import('./pages/hosting/dns/providers/providers').then(
                    (m) => m.HostingDnsProvidersPage,
                  ),
                title: 'Hosting • DNS • Providers | mnscloud',
              },
              {
                path: 'hosting/smtp',
                title: 'Hosting • SMTP | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/dashboard/dashboard').then(
                        (m) => m.HostingSmtpDashboardPage,
                      ),
                    title: 'Hosting • SMTP Dashboard | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/providers/providers').then(
                        (m) => m.HostingSmtpProvidersPage,
                      ),
                    title: 'Hosting • SMTP Providers | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'accounts',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/accounts/accounts').then(
                        (m) => m.HostingSmtpAccountsPage,
                      ),
                    title: 'Hosting • SMTP Accounts | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'routes',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/routes/routes').then(
                        (m) => m.HostingSmtpRoutesPage,
                      ),
                    title: 'Hosting • SMTP Routes | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                ],
              },
              {
                path: 'hosting/storage',
                title: 'Hosting • Storage | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/storage/dashboard/dashboard').then(
                        (m) => m.HostingStorageDashboardPage,
                      ),
                    title: 'Hosting • Storage Dashboard | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/storage/providers/providers').then(
                        (m) => m.HostingStorageProvidersPage,
                      ),
                    title: 'Hosting • Storage Providers | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'accounts',
                    loadComponent: () =>
                      import('./pages/hosting/storage/accounts/accounts').then(
                        (m) => m.HostingStorageAccountsPage,
                      ),
                    title: 'Hosting • Storage Accounts | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                ],
              },
              {
                path: 'hosting/vps',
                title: 'Hosting • VPS | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/vps/dashboard/dashboard').then(
                        (m) => m.HostingVpsDashboardPage,
                      ),
                    title: 'Hosting • VPS Dashboard | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'instances',
                    loadComponent: () =>
                      import('./pages/hosting/vps/instances/instances').then(
                        (m) => m.HostingVpsInstancesPage,
                      ),
                    title: 'Hosting • VPS Instances | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'provider',
                    loadComponent: () =>
                      import('./pages/hosting/vps/provider/provider').then(
                        (m) => m.HostingVpsProviderPage,
                      ),
                    title: 'Hosting • VPS Provider | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'plans',
                    loadComponent: () =>
                      import('./pages/hosting/vps/plans/plans').then((m) => m.HostingVpsPlansPage),
                    title: 'Hosting • VPS Plans | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                ],
              },
              {
                path: 'hosting/vps-container',
                title: 'Hosting • VPS Container | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/dashboard/dashboard').then(
                        (m) => m.HostingVpsContainerDashboardPage,
                      ),
                    title: 'Hosting • VPS Container Dashboard | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'instances',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/instances/instances').then(
                        (m) => m.HostingVpsContainerInstancesPage,
                      ),
                    title: 'Hosting • VPS Container Instances | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'provider',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/provider/provider').then(
                        (m) => m.HostingVpsContainerProviderPage,
                      ),
                    title: 'Hosting • VPS Container Provider | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'plans',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/plans/plans').then(
                        (m) => m.HostingVpsContainerPlansPage,
                      ),
                    title: 'Hosting • VPS Container Plans | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                ],
              },
              {
                path: 'hosting/webhost',
                title: 'Hosting • Webhost | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
                children: [
                  { path: '', pathMatch: 'full', redirectTo: 'providers' },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/providers/providers').then(
                        (m) => m.HostingWebhostProvidersPage,
                      ),
                    title: 'Hosting • Webhost • Providers | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'plans',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/plans/plans').then(
                        (m) => m.HostingWebhostPlansPage,
                      ),
                    title: 'Hosting • Webhost • Plans | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'hosts',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/hosts/hosts').then(
                        (m) => m.HostingWebhostHostsPage,
                      ),
                    title: 'Hosting • Webhost • Hosts | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'emails',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/emails/emails').then(
                        (m) => m.HostingWebhostEmailsPage,
                      ),
                    title: 'Hosting • Webhost • Emails | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'databases',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/tools/tools').then(
                        (m) => m.HostingWebhostToolsPage,
                      ),
                    title: 'Hosting • Webhost • Databases | mnscloud',
                    data: {
                      scope: 'tenant',
                      context: 'hosting',
                      tool: 'databases',
                    },
                  },
                  {
                    path: 'mailing-lists',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/tools/tools').then(
                        (m) => m.HostingWebhostToolsPage,
                      ),
                    title: 'Hosting • Webhost • Mailing Lists | mnscloud',
                    data: {
                      scope: 'tenant',
                      context: 'hosting',
                      tool: 'mailing-lists',
                    },
                  },
                  {
                    path: 'zone-editor',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/tools/tools').then(
                        (m) => m.HostingWebhostToolsPage,
                      ),
                    title: 'Hosting • Webhost • Zone Editor | mnscloud',
                    data: {
                      scope: 'tenant',
                      context: 'hosting',
                      tool: 'zone-records',
                    },
                  },
                ],
              },

              // VoIP
              {
                path: 'voip',
                loadComponent: () =>
                  import('./pages/voip/dashboard/dashboard').then((m) => m.VoipDashboardPage),
                title: 'VoIP Dashboard | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'voip/domain',
                loadComponent: () =>
                  import('./pages/voip/domain/domain').then((m) => m.VoipDomainPage),
                title: 'VoIP • Domain | mnscloud',
              },
              {
                path: 'voip/did',
                title: 'VoIP • DID | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/voip/did/dashboard/dashboard').then(
                        (m) => m.VoipDidDashboardPage,
                      ),
                    title: 'VoIP • DID Dashboard | mnscloud',
                    data: { scope: 'tenant', context: 'voip' },
                  },
                  {
                    path: 'operator',
                    loadComponent: () =>
                      import('./pages/voip/did/operator/operator').then(
                        (m) => m.VoipDidOperatorPage,
                      ),
                    title: 'VoIP • DID • Operator | mnscloud',
                    data: { scope: 'tenant', context: 'voip' },
                  },
                  {
                    path: 'number',
                    loadComponent: () => import('./pages/voip/did/did').then((m) => m.VoipDidPage),
                    title: 'VoIP • DID Number | mnscloud',
                    data: { scope: 'tenant', context: 'voip' },
                  },
                  {
                    path: 'external',
                    loadComponent: () =>
                      import('./pages/voip/did/external/external').then(
                        (m) => m.VoipDidExternalPage,
                      ),
                    title: 'VoIP • DID • External | mnscloud',
                    data: { scope: 'tenant', context: 'voip' },
                  },
                ],
              },
              {
                path: 'voip/portability',
                loadComponent: () =>
                  import('./pages/voip/portability/portability').then((m) => m.VoipPortabilityPage),
                title: 'VoIP • Portability | mnscloud',
              },
              {
                path: 'voip/sbc',
                redirectTo: 'voip/sbc/dashboard',
                pathMatch: 'full',
              },
              {
                path: 'voip/sbc/dashboard',
                loadComponent: () =>
                  import('./pages/voip/sbc/dashboard/dashboard').then(
                    (m) => m.VoipSbcDashboardPage,
                  ),
                title: 'VoIP • SBC Dashboard | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'voip/sbc/account',
                loadComponent: () =>
                  import('./pages/voip/sbc/account/account').then((m) => m.VoipSbcAccountPage),
                title: 'VoIP • SBC | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'voip/sbc/interface',
                loadComponent: () =>
                  import('./pages/voip/sbc/interface/interface').then(
                    (m) => m.VoipSbcInterfacePage,
                  ),
                title: 'VoIP • SBC • Interface | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'voip/sbc/peer',
                loadComponent: () =>
                  import('./pages/voip/sbc/peer/peer').then((m) => m.VoipSbcPeerPage),
                title: 'VoIP • SBC • Peer | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'voip/sbc/pipe',
                loadComponent: () =>
                  import('./pages/voip/sbc/pipe/pipe').then((m) => m.VoipSbcPipePage),
                title: 'VoIP • SBC • Pipe | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'voip/sbc/manipulation',
                loadComponent: () =>
                  import('./pages/voip/sbc/manipulation/manipulation').then(
                    (m) => m.VoipSbcManipulationPage,
                  ),
                title: 'VoIP • SBC • Manipulation | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'realtime/webrtc',
                loadComponent: () =>
                  import('./pages/realtime/webrtc/dashboard/dashboard').then(
                    (m) => m.RealtimeWebRtcDashboardPage,
                  ),
                title: 'Realtime • WebRTC Dashboard | mnscloud',
                data: { scope: 'tenant' },
              },
              ...(['domain'].map((section) => ({
                path: `realtime/webrtc/${section}`,
                loadComponent: () =>
                  import('./pages/realtime/webrtc/webrtc').then((m) => m.RealtimeWebRtcPage),
                title: `Realtime • WebRTC • ${section} | mnscloud`,
                data: {
                  scope: 'tenant',
                  resource:
                    section === 'server'
                      ? 'servers'
                      : section === 'domain'
                        ? 'domains'
                        : 'parameters',
                },
              })) as any),
              {
                path: 'voip/softswitch',
                loadComponent: () =>
                  import('./pages/voip/softswitch/dashboard/dashboard').then(
                    (m) => m.VoipSoftswitchDashboardPage,
                  ),
                title: 'VoIP • Softswitch Dashboard | mnscloud',
              },
              {
                path: 'voip/softswitch/accounts',
                loadComponent: () =>
                  import('./pages/voip/softswitch/softswitch').then((m) => m.VoipSoftswitchPage),
                title: 'VoIP • Softswitch | mnscloud',
              },
              {
                path: 'voip/softswitch/subscriber',
                loadComponent: () =>
                  import('./pages/voip/softswitch/subscriber/subscriber').then(
                    (m) => m.VoipSoftswitchSubscriberPage,
                  ),
                title: 'VoIP • Softswitch • Subscriber | mnscloud',
              },
              {
                path: 'voip/softswitch/did',
                loadComponent: () =>
                  import('./pages/voip/softswitch/did/did').then((m) => m.VoipSoftswitchDidPage),
                title: 'VoIP • Softswitch • DID | mnscloud',
              },
              {
                path: 'voip/softswitch/trunks',
                loadComponent: () =>
                  import('./pages/voip/softswitch/trunk/trunk').then(
                    (m) => m.VoipSoftswitchTrunkPage,
                  ),
                title: 'VoIP • Softswitch • Trunks | mnscloud',
              },
              {
                path: 'voip/softswitch/routes',
                loadComponent: () =>
                  import('./pages/voip/softswitch/route/route').then(
                    (m) => m.VoipSoftswitchRoutePage,
                  ),
                title: 'VoIP • Softswitch • Routes | mnscloud',
              },
              {
                path: 'voip/softswitch/rates',
                loadComponent: () =>
                  import('./pages/voip/softswitch/rate/rate').then((m) => m.VoipSoftswitchRatePage),
                title: 'VoIP • Softswitch • Rates | mnscloud',
              },
              {
                path: 'voip/softswitch/cdrs',
                loadComponent: () =>
                  import('./pages/voip/softswitch/cdr-billing/cdr-billing').then(
                    (m) => m.VoipSoftswitchCdrBillingPage,
                  ),
                title: 'VoIP • Softswitch • CDR/Billing | mnscloud',
              },
              {
                path: 'voip/pabx',
                loadComponent: () =>
                  import('./pages/voip/pabx/dashboard/dashboard').then(
                    (m) => m.VoipPabxDashboardPage,
                  ),
                title: 'VoIP • PABX | mnscloud',
              },
              {
                path: 'voip/pabx/accounts',
                loadComponent: () => import('./pages/voip/pabx/pabx').then((m) => m.VoipPabxPage),
                title: 'VoIP • PABX • Accounts | mnscloud',
              },
              {
                path: 'voip/pabx/extension',
                loadComponent: () =>
                  import('./pages/voip/pabx/extension/extension').then(
                    (m) => m.VoipPabxExtensionPage,
                  ),
                title: 'VoIP • PABX • Extension | mnscloud',
              },
              {
                path: 'voip/pabx/blacklist',
                redirectTo: 'voip/pabx/blacklist/list',
                pathMatch: 'full',
              },
              {
                path: 'voip/pabx/blacklist/list',
                loadComponent: () =>
                  import('./pages/voip/pabx/blacklist/list/list').then(
                    (m) => m.VoipPabxBlacklistListPage,
                  ),
                title: 'VoIP • PABX • Blacklist • List | mnscloud',
              },
              {
                path: 'voip/pabx/blacklist/number',
                loadComponent: () =>
                  import('./pages/voip/pabx/blacklist/number/number').then(
                    (m) => m.VoipPabxBlacklistNumberPage,
                  ),
                title: 'VoIP • PABX • Blacklist • Number | mnscloud',
              },
              {
                path: 'voip/pabx/dial-plan',
                redirectTo: 'voip/pabx/dial-plan/plan',
                pathMatch: 'full',
              },
              {
                path: 'voip/pabx/dial-plan/plan',
                loadComponent: () =>
                  import('./pages/voip/pabx/dial-plan/plan/plan').then(
                    (m) => m.VoipPabxDialPlanPlanPage,
                  ),
                title: 'VoIP • PABX • Dial Plan • Plan | mnscloud',
              },
              {
                path: 'voip/pabx/dial-plan/rules',
                loadComponent: () =>
                  import('./pages/voip/pabx/dial-plan/rules/rules').then(
                    (m) => m.VoipPabxDialPlanRulesPage,
                  ),
                title: 'VoIP • PABX • Dial Plan • Rules | mnscloud',
              },
              {
                path: 'voip/pabx/external',
                loadComponent: () =>
                  import('./pages/voip/pabx/routing/routing').then((m) => m.VoipPabxRoutingPage),
                title: 'VoIP • PABX • External | mnscloud',
                data: { resource: 'external' },
              },
              ...(['trunks', 'inbound-routes'] as const).map((resource) => ({
                path: `voip/pabx/${resource}`,
                loadComponent: () =>
                  import('./pages/voip/pabx/trunk-route/trunk-route').then(
                    (m) => m.VoipPabxTrunkRoutePage,
                  ),
                title: `VoIP • PABX • ${resource} | mnscloud`,
                data: { resource },
              })),
              {
                path: 'voip/pabx/group',
                loadComponent: () =>
                  import('./pages/voip/pabx/routing/routing').then((m) => m.VoipPabxRoutingPage),
                title: 'VoIP • PABX • Group | mnscloud',
                data: { resource: 'group' },
              },
              {
                path: 'voip/pabx/queue',
                loadComponent: () =>
                  import('./pages/voip/pabx/queue/queue').then((m) => m.VoipPabxQueuePage),
                title: 'VoIP • PABX • Queue | mnscloud',
              },
              {
                path: 'voip/pabx/queue-agents',
                loadComponent: () =>
                  import('./pages/voip/pabx/queue-agent/queue-agent').then(
                    (m) => m.VoipPabxQueueAgentPage,
                  ),
                title: 'VoIP • PABX • Queue Agents | mnscloud',
              },
              {
                path: 'voip/pabx/media-files',
                loadComponent: () =>
                  import('./pages/voip/pabx/media-files/media-files').then(
                    (m) => m.VoipPabxMediaFilesPage,
                  ),
                title: 'VoIP • PABX • Media Files | mnscloud',
              },
              {
                path: 'voip/pabx/ivr',
                loadComponent: () =>
                  import('./pages/voip/pabx/ivr/ivr').then((m) => m.VoipPabxIvrPage),
                title: 'VoIP • PABX • IVR | mnscloud',
              },
              {
                path: 'voip/pabx/cdr',
                loadComponent: () =>
                  import('./pages/voip/pabx/cdr/cdr').then((m) => m.VoipPabxCdrPage),
                title: 'VoIP • PABX • CDR | mnscloud',
              },
            ],
          },

          // =================================================
          // 👑 MASTER AREA
          // =================================================
          {
            path: 'system',
            canActivate: [masterGuard],
            children: [
              {
                path: 'monitoring',
                loadComponent: () =>
                  import('./pages/monitoring/dashboard/dashboard').then(
                    (m) => m.MonitoringDashboardPage,
                  ),
                title: 'System Monitoring | mnscloud',
              },
              {
                path: 'monitoring/activity-logs',
                loadComponent: () =>
                  import('./pages/monitoring/activity-logs/activity').then(
                    (m) => m.MonitoringActivityLogsPage,
                  ),
                title: 'System Monitoring • Activity Logs | mnscloud',
              },
              {
                path: 'monitoring/agents',
                loadComponent: () =>
                  import('./pages/monitoring/agents/agents').then((m) => m.MonitoringAgentsPage),
                title: 'System Monitoring • Agents | mnscloud',
              },
              {
                path: 'governance/users',
                loadComponent: () =>
                  import('./pages/system/governance/users/users').then(
                    (m) => m.SystemGovernanceUsersPage,
                  ),
                title: 'System Governance • Users | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'cyber-security',
                loadComponent: () =>
                  import('./pages/cyber-security/cyber-security').then((m) => m.CyberSecurityPage),
                title: 'System Cyber Security | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'cyber-security/services',
                loadComponent: () =>
                  import('./pages/cyber-security/services/services').then(
                    (m) => m.CyberSecurityServicesPage,
                  ),
                title: 'System Cyber Security • Services | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'cyber-security/profiles',
                loadComponent: () =>
                  import('./pages/cyber-security/profiles/profiles').then(
                    (m) => m.CyberSecurityProfilesPage,
                  ),
                title: 'System Cyber Security • Profiles | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'cyber-security/trusted-nodes',
                loadComponent: () =>
                  import('./pages/cyber-security/trusted-nodes/trusted-nodes').then(
                    (m) => m.CyberSecurityTrustedNodesPage,
                  ),
                title: 'System Cyber Security • Trusted Nodes | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'cyber-security/network-policies',
                loadComponent: () =>
                  import('./pages/cyber-security/network-policies/network-policies').then(
                    (m) => m.CyberSecurityNetworkPoliciesPage,
                  ),
                title: 'System Cyber Security • Network Policies | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'cyber-security/:section',
                loadComponent: () =>
                  import('./pages/cyber-security/cyber-security').then((m) => m.CyberSecurityPage),
                title: 'System Cyber Security | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing',
                loadComponent: () =>
                  import('./pages/billing/system/dashboard/dashboard').then(
                    (m) => m.BillingSystemDashboardPage,
                  ),
                title: 'System Billing | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing/products',
                loadComponent: () =>
                  import('./pages/billing/system/products/products').then(
                    (m) => m.BillingSystemProductsPage,
                  ),
                title: 'System Billing • Products | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing/prices',
                loadComponent: () =>
                  import('./pages/billing/system/prices/prices').then(
                    (m) => m.BillingSystemPricesPage,
                  ),
                title: 'System Billing • Prices | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing/packages',
                loadComponent: () =>
                  import('./pages/billing/system/packages/packages').then(
                    (m) => m.BillingSystemPackagesPage,
                  ),
                title: 'System Billing • Packages | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing/promotions',
                loadComponent: () =>
                  import('./pages/billing/system/promotions/promotions').then(
                    (m) => m.BillingSystemPromotionsPage,
                  ),
                title: 'System Billing • Promotions | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing/subscriptions',
                loadComponent: () =>
                  import('./pages/billing/system/subscriptions/subscriptions').then(
                    (m) => m.BillingSystemSubscriptionsPage,
                  ),
                title: 'System Billing • Subscriptions | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing/wallets',
                loadComponent: () =>
                  import('./pages/billing/system/wallets/wallets').then(
                    (m) => m.BillingSystemWalletsPage,
                  ),
                title: 'System Billing • Wallets | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'voip',
                loadComponent: () =>
                  import('./pages/voip/dashboard/dashboard').then((m) => m.VoipDashboardPage),
                title: 'System VoIP Dashboard | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'softswitch',
                loadComponent: () =>
                  import('./pages/voip/softswitch/dashboard/dashboard').then(
                    (m) => m.VoipSoftswitchDashboardPage,
                  ),
                title: 'System Softswitch Dashboard | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'softswitch/server',
                loadComponent: () =>
                  import('./pages/voip/softswitch/server/server').then(
                    (m) => m.VoipSoftswitchServerPage,
                  ),
                title: 'System Softswitch Server | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'sbc',
                redirectTo: 'sbc/dashboard',
                pathMatch: 'full',
              },
              {
                path: 'sbc/dashboard',
                loadComponent: () =>
                  import('./pages/voip/sbc/dashboard/dashboard').then(
                    (m) => m.VoipSbcDashboardPage,
                  ),
                title: 'System SBC Dashboard | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'sbc/server',
                loadComponent: () =>
                  import('./pages/voip/sbc/server/server').then((m) => m.VoipSbcServerPage),
                title: 'System SBC Server | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'voip/domain',
                loadComponent: () =>
                  import('./pages/voip/domain/domain').then((m) => m.VoipDomainPage),
                title: 'System VoIP Domain | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'realtime',
                loadComponent: () =>
                  import('./pages/realtime/dashboard/dashboard').then(
                    (m) => m.RealtimeDashboardPage,
                  ),
                title: 'System Realtime Dashboard | mnscloud',
                data: { scope: 'master', dashboardMode: 'overview' },
              },
              {
                path: 'realtime/webrtc',
                loadComponent: () =>
                  import('./pages/realtime/webrtc/dashboard/dashboard').then(
                    (m) => m.RealtimeWebRtcDashboardPage,
                  ),
                title: 'System Realtime • WebRTC Dashboard | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'realtime/domain',
                loadComponent: () =>
                  import('./pages/realtime/domains/domains').then((m) => m.RealtimeDomainsPage),
                title: 'System Realtime • Domains | mnscloud',
                data: { scope: 'master' },
              },
              ...(['domain', 'server', 'parameter'].map((section) => ({
                path: `realtime/webrtc/${section}`,
                loadComponent: () =>
                  import('./pages/realtime/webrtc/webrtc').then((m) => m.RealtimeWebRtcPage),
                title: `System Realtime • WebRTC • ${section} | mnscloud`,
                data: {
                  scope: 'master',
                  resource:
                    section === 'server'
                      ? 'servers'
                      : section === 'domain'
                        ? 'domains'
                        : 'parameters',
                },
              })) as any),
              {
                path: 'realtime/turn',
                loadComponent: () =>
                  import('./pages/realtime/dashboard/dashboard').then(
                    (m) => m.RealtimeDashboardPage,
                  ),
                title: 'System Realtime • TURN/STUN Dashboard | mnscloud',
                data: { scope: 'master', dashboardMode: 'turn' },
              },
              {
                path: 'realtime/turn/server',
                loadComponent: () =>
                  import('./pages/realtime/turn/turn').then((m) => m.RealtimeTurnPage),
                title: 'System Realtime • TURN/STUN Servers | mnscloud',
                data: { scope: 'master', resource: 'servers' },
              },
              {
                path: 'realtime/turn/domains',
                loadComponent: () =>
                  import('./pages/realtime/turn/turn').then((m) => m.RealtimeTurnPage),
                title: 'System Realtime • TURN/STUN Domains | mnscloud',
                data: { scope: 'master', resource: 'domains' },
              },
              {
                path: 'realtime/media',
                loadComponent: () =>
                  import('./pages/realtime/dashboard/dashboard').then(
                    (m) => m.RealtimeDashboardPage,
                  ),
                title: 'System Realtime • Media Dashboard | mnscloud',
                data: { scope: 'master', dashboardMode: 'media' },
              },
              {
                path: 'realtime/media/server',
                loadComponent: () =>
                  import('./pages/realtime/media/media').then((m) => m.RealtimeMediaPage),
                title: 'System Realtime • Media Servers | mnscloud',
                data: { scope: 'master', resource: 'servers' },
              },
              {
                path: 'realtime/media/domains',
                loadComponent: () =>
                  import('./pages/realtime/media/media').then((m) => m.RealtimeMediaPage),
                title: 'System Realtime • Media Domains | mnscloud',
                data: { scope: 'master', resource: 'domains' },
              },
              {
                path: 'pabx',
                loadComponent: () =>
                  import('./pages/voip/pabx/dashboard/dashboard').then(
                    (m) => m.VoipPabxDashboardPage,
                  ),
                title: 'System PABX Dashboard | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'pabx/server',
                loadComponent: () =>
                  import('./pages/voip/pabx/server/server').then((m) => m.VoipPabxServerPage),
                title: 'System PABX Server | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'did',
                loadComponent: () =>
                  import('./pages/voip/did/dashboard/dashboard').then(
                    (m) => m.VoipDidDashboardPage,
                  ),
                title: 'System DID Dashboard | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'did/operator',
                loadComponent: () =>
                  import('./pages/voip/did/operator/operator').then((m) => m.VoipDidOperatorPage),
                title: 'System DID Operator | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'did/number',
                loadComponent: () => import('./pages/voip/did/did').then((m) => m.VoipDidPage),
                title: 'System DID Number | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'did/external',
                loadComponent: () =>
                  import('./pages/voip/did/external/external').then((m) => m.VoipDidExternalPage),
                title: 'System DID External | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'hosting',
                loadComponent: () =>
                  import('./pages/hosting/dashboard/dashboard').then((m) => m.HostingDashboardPage),
                title: 'System Hosting | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'hosting/smtp',
                title: 'System SMTP | mnscloud',
                data: { scope: 'master', context: 'system' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/dashboard/dashboard').then(
                        (m) => m.HostingSmtpDashboardPage,
                      ),
                    title: 'System SMTP Dashboard | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/providers/providers').then(
                        (m) => m.HostingSmtpProvidersPage,
                      ),
                    title: 'System SMTP Providers | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'accounts',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/accounts/accounts').then(
                        (m) => m.HostingSmtpAccountsPage,
                      ),
                    title: 'System SMTP Accounts | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'routes',
                    loadComponent: () =>
                      import('./pages/hosting/smtp/routes/routes').then(
                        (m) => m.HostingSmtpRoutesPage,
                      ),
                    title: 'System SMTP Routes | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                ],
              },
              {
                path: 'hosting/storage',
                title: 'System Storage | mnscloud',
                data: { scope: 'master', context: 'system' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/storage/dashboard/dashboard').then(
                        (m) => m.HostingStorageDashboardPage,
                      ),
                    title: 'System Storage Dashboard | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/storage/providers/providers').then(
                        (m) => m.HostingStorageProvidersPage,
                      ),
                    title: 'System Storage Providers | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'accounts',
                    loadComponent: () =>
                      import('./pages/hosting/storage/accounts/accounts').then(
                        (m) => m.HostingStorageAccountsPage,
                      ),
                    title: 'System Storage Accounts | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                ],
              },
              {
                path: 'payment-gateway',
                loadComponent: () =>
                  import('./pages/erp/financial/payment/gateway/payment-gateway').then(
                    (m) => m.FinancialPaymentGatewayPage,
                  ),
                title: 'System Payment Gateways | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'parameters',
                loadComponent: () =>
                  import('./pages/settings/parameters/parameters').then(
                    (m) => m.SettingsParametersPage,
                  ),
                title: 'System Parameters | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'vps',
                title: 'System VPS | mnscloud',
                data: { scope: 'master', context: 'system' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/vps/dashboard/dashboard').then(
                        (m) => m.HostingVpsDashboardPage,
                      ),
                    title: 'System VPS Dashboard | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'instances',
                    loadComponent: () =>
                      import('./pages/hosting/vps/instances/instances').then(
                        (m) => m.HostingVpsInstancesPage,
                      ),
                    title: 'System VPS Instances | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'provider',
                    loadComponent: () =>
                      import('./pages/hosting/vps/provider/provider').then(
                        (m) => m.HostingVpsProviderPage,
                      ),
                    title: 'System VPS Provider | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'plans',
                    loadComponent: () =>
                      import('./pages/hosting/vps/plans/plans').then((m) => m.HostingVpsPlansPage),
                    title: 'System VPS Plans | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                ],
              },
              {
                path: 'vps-container',
                title: 'System VPS Container | mnscloud',
                data: { scope: 'master', context: 'system' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/dashboard/dashboard').then(
                        (m) => m.HostingVpsContainerDashboardPage,
                      ),
                    title: 'System VPS Container Dashboard | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'instances',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/instances/instances').then(
                        (m) => m.HostingVpsContainerInstancesPage,
                      ),
                    title: 'System VPS Container Instances | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'provider',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/provider/provider').then(
                        (m) => m.HostingVpsContainerProviderPage,
                      ),
                    title: 'System VPS Container Provider | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'plans',
                    loadComponent: () =>
                      import('./pages/hosting/vps-container/plans/plans').then(
                        (m) => m.HostingVpsContainerPlansPage,
                      ),
                    title: 'System VPS Container Plans | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                ],
              },
              {
                path: 'isp/radius-server',
                loadComponent: () =>
                  import('./pages/isp/radius-server/radius-server').then(
                    (m) => m.IspRadiusServerPage,
                  ),
                title: 'System ISP Radius Server | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
            ],
          },

          // Pós invite
          {
            path: 'invite/sent',
            loadComponent: () =>
              import('./pages/tenants/invite/invite-sent/invite-sent').then(
                (m) => m.InviteSentPage,
              ),
            title: 'Invitation Sent | mnscloud',
          },
        ],
      },
    ],
  },

  // =====================================================
  // Fallback
  // =====================================================
  {
    path: 'not-found',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage),
    title: 'Not Found | mnscloud',
  },
  { path: '**', redirectTo: 'not-found' },
];
