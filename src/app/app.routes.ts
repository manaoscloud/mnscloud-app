import { cyberSecurityRouteData } from './pages/cyber-security/cyber-security-navigation';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { userResolver } from './core/resolvers/user.resolver';
import { MainLayout } from './layout/main-layout/main-layout';
import { redirectIfLoggedGuard } from './core/guards/redirectIfLogged.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { environmentGuard } from './core/guards/environment.guard';
import { publicBoardGuard } from './core/guards/public-board.guard';

// These children inherit scope/context from their componentless tenant or system parent.
const STORAGE_RESOURCE_ROUTES: Routes = [
  {
    path: 'accounts',
    loadComponent: () =>
      import('./pages/hosting/storage/accounts/accounts').then((m) => m.HostingStorageAccountsPage),
    title: 'Storage Accounts | mnscloud',
  },
  {
    path: 'buckets',
    loadComponent: () =>
      import('./pages/hosting/storage/buckets/buckets').then((m) => m.HostingStorageBucketsPage),
    title: 'Storage Buckets | mnscloud',
  },
  {
    path: 'bindings',
    loadComponent: () =>
      import('./pages/hosting/storage/bindings/bindings').then((m) => m.HostingStorageBindingsPage),
    title: 'Module Destinations | mnscloud',
  },
];

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

  // Public idea board: published ideas, status and votes, readable without signing in.
  {
    path: 'ideas',
    canActivate: [publicBoardGuard],
    loadComponent: () => import('./pages/support/ideas/ideas').then((m) => m.FeatureRequestsPage),
    title: 'Ideas board | mnscloud',
    data: { publicBoard: true },
  },
  {
    path: 'ideas/:code',
    canActivate: [publicBoardGuard],
    loadComponent: () => import('./pages/support/ideas/ideas').then((m) => m.FeatureRequestsPage),
    title: 'Ideas board | mnscloud',
    data: { publicBoard: true },
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
          // Release notes deployed in this environment (workspace docs/release-notes.md).
          {
            path: 'user/release-notes',
            loadComponent: () =>
              import('./pages/user/release-notes/release-notes').then((m) => m.ReleaseNotesPage),
            title: 'Release notes | mnscloud',
            data: { breadcrumb: 'releaseNotes.pageTitle' },
          },
          {
            path: 'user/notifications',
            loadComponent: () =>
              import('./pages/user/notifications/user-notifications').then(
                (m) => m.UserNotificationsPage,
              ),
            title: 'Notifications | mnscloud',
          },
          // Platform support desk: platform.support.* agents (masters included), no tenant needed.
          {
            path: 'support/platform/tickets',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/tickets/tickets').then((m) => m.SupportTicketsPage),
            title: 'Platform support • Tickets | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.tickets.manage',
              breadcrumb: 'Platform tickets',
            },
          },
          {
            path: 'support/platform/ideas',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/platform-ideas/platform-ideas').then(
                (m) => m.PlatformFeatureRequestsPage,
              ),
            title: 'Platform support • Ideas | mnscloud',
            data: {
              scope: 'master',
              permission: 'platform.support.tickets.manage',
              breadcrumb: 'Platform ideas',
            },
          },
          {
            path: 'support/platform/teams',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/teams/teams').then((m) => m.SupportTeamsPage),
            title: 'Platform support • Teams | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.settings.manage',
              breadcrumb: 'Support teams',
            },
          },
          {
            path: 'support/platform/ticket-types',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/ticket-types/ticket-types').then(
                (m) => m.SupportTicketTypesPage,
              ),
            title: 'Platform support • Ticket types | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.settings.manage',
              breadcrumb: 'Ticket types',
            },
          },
          {
            path: 'support/platform/ticket-priorities',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/ticket-priorities/ticket-priorities').then(
                (m) => m.SupportTicketPrioritiesPage,
              ),
            title: 'Platform support • Ticket priorities | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.settings.manage',
              breadcrumb: 'Ticket priorities',
            },
          },
          {
            path: 'support/platform/ticket-channels',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/ticket-channels/ticket-channels').then(
                (m) => m.SupportTicketChannelsPage,
              ),
            title: 'Platform support • Ticket origins | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.settings.manage',
              breadcrumb: 'Ticket origins',
            },
          },
          {
            path: 'support/platform/ai/settings',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/ai-settings/ai-settings').then(
                (m) => m.SupportAiSettingsPage,
              ),
            title: 'Support • Platform • AI assistant | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.settings.manage',
              breadcrumb: 'AI assistant',
            },
          },
          // Release notes management (text, visibility), platform master, no tenant needed.
          {
            path: 'settings/release-notes',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/release-notes/release-notes-admin').then(
                (m) => m.ReleaseNotesAdminPage,
              ),
            title: 'Settings • Release notes | mnscloud',
            data: {
              scope: 'master',
              permission: 'platform.master.access',
              breadcrumb: 'releaseNotes.adminTitle',
            },
          },
          // Tutorial videos of the App pages (YouTube, per language), no tenant needed.
          {
            path: 'settings/help-videos',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/help-videos/help-videos').then((m) => m.HelpVideosPage),
            title: 'Settings • Tutorial videos | mnscloud',
            data: {
              scope: 'master',
              permission: 'platform.help.videos.manage',
              breadcrumb: 'Tutorial videos',
            },
          },
          // Platform AI (Settings › AI): providers shared by every AI feature, no tenant needed.
          {
            path: 'settings/ai/dashboard',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/ai-dashboard/ai-dashboard').then((m) => m.AiDashboardPage),
            title: 'Settings • AI • Dashboard | mnscloud',
            data: { scope: 'master', permission: 'platform.ai.manage', breadcrumb: 'AI dashboard' },
          },
          {
            path: 'settings/ai/budgets',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/ai-budgets/ai-budgets').then((m) => m.AiBudgetsPage),
            title: 'Settings • AI • Budgets | mnscloud',
            data: { scope: 'master', permission: 'platform.ai.manage', breadcrumb: 'AI budgets' },
          },
          {
            path: 'settings/ai/providers',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/ai-providers/ai-providers').then((m) => m.AiProvidersPage),
            title: 'Settings • AI • Providers | mnscloud',
            data: { scope: 'master', permission: 'platform.ai.manage', breadcrumb: 'AI providers' },
          },
          {
            path: 'settings/ai/features',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/ai-features/ai-features').then(
                (m) => m.AiFeatureBindingsPage,
              ),
            title: 'Settings • AI • Features | mnscloud',
            data: { scope: 'master', permission: 'platform.ai.manage', breadcrumb: 'AI features' },
          },
          {
            path: 'settings/ai/usage',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/ai-usage/ai-usage').then((m) => m.AiUsagePage),
            title: 'Settings • AI • Usage | mnscloud',
            data: { scope: 'master', permission: 'platform.ai.manage', breadcrumb: 'AI usage' },
          },
          // Data lookups (Settings › Lookups): CEP, CNPJ, IE and CPF providers, master only.
          {
            path: 'settings/lookups/types',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/lookup-types/lookup-types').then((m) => m.LookupTypesPage),
            title: 'Settings • Lookups • Lookup types | mnscloud',
            data: {
              scope: 'master',
              permission: 'platform.lookup.manage',
              breadcrumb: 'Lookup types',
            },
          },
          {
            path: 'settings/lookups/providers',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/lookup-providers/lookup-providers').then(
                (m) => m.LookupProvidersPage,
              ),
            title: 'Settings • Lookups • Providers | mnscloud',
            data: {
              scope: 'master',
              permission: 'platform.lookup.manage',
              breadcrumb: 'Lookup providers',
            },
          },
          {
            path: 'settings/lookups/usage',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/settings/lookup-usage/lookup-usage').then((m) => m.LookupUsagePage),
            title: 'Settings • Lookups • Usage | mnscloud',
            data: {
              scope: 'master',
              permission: 'platform.lookup.manage',
              breadcrumb: 'Lookup usage',
            },
          },
          {
            path: 'support/platform/knowledge-articles',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/support/knowledge-articles/knowledge-articles').then(
                (m) => m.SupportKnowledgeArticlesPage,
              ),
            title: 'Support • Platform • Knowledge articles | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.settings.manage',
              breadcrumb: 'Knowledge articles',
            },
          },
          {
            path: 'support/platform/notification-rules',
            canActivate: [permissionGuard],
            loadComponent: () =>
              import('./pages/monitoring/notification-rules/notification-rules').then(
                (m) => m.MonitoringNotificationRulesPage,
              ),
            title: 'Support • Platform • Notifications | mnscloud',
            data: {
              scope: 'master',
              supportDesk: 'platform',
              permission: 'platform.support.notifications.manage',
              breadcrumb: 'Notifications',
            },
          },
          {
            path: 'user/permissions',
            loadComponent: () =>
              import('./pages/user/permissions/permissions').then((m) => m.UserPermissionsPage),
            title: 'Permissions | mnscloud',
          },
          {
            path: 'user/access-profiles',
            loadComponent: () =>
              import('./pages/user/access-profiles/access-profiles').then(
                (m) => m.UserAccessProfilesPage,
              ),
            title: 'Access Profiles | mnscloud',
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
              {
                path: 'user/api-tokens',
                loadComponent: () =>
                  import('./pages/user/api-tokens/api-tokens').then((m) => m.UserApiTokensPage),
                title: 'API Tokens | mnscloud',
                data: { scope: 'tenant' },
              },
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
                path: 'clinic/bradesco/siad/guides',
                loadComponent: () =>
                  import('./pages/clinic/bradesco-siad/guides/guides').then(
                    (m) => m.ClinicBradescoSiadGuidesPage,
                  ),
                title: 'Clinic • Bradesco SIAD Guides | mnscloud',
              },
              {
                path: 'clinic/agreements',
                loadComponent: () =>
                  import('./pages/clinic/agreements/catalog/catalog').then(
                    (m) => m.ClinicAgreementCatalogPage,
                  ),
                title: 'Clinic • Agreements | mnscloud',
                data: { catalog: 'agreements' },
              },
              {
                path: 'clinic/agreement-plans',
                loadComponent: () =>
                  import('./pages/clinic/agreements/catalog/catalog').then(
                    (m) => m.ClinicAgreementCatalogPage,
                  ),
                title: 'Clinic • Agreement Plans | mnscloud',
                data: { catalog: 'plans' },
              },
              {
                path: 'clinic/procedures',
                loadComponent: () =>
                  import('./pages/clinic/agreements/catalog/catalog').then(
                    (m) => m.ClinicAgreementCatalogPage,
                  ),
                title: 'Clinic • Procedures | mnscloud',
                data: { catalog: 'procedures' },
              },
              {
                path: 'clinic/coverages',
                loadComponent: () =>
                  import('./pages/clinic/agreements/catalog/catalog').then(
                    (m) => m.ClinicAgreementCatalogPage,
                  ),
                title: 'Clinic • Plan Coverages | mnscloud',
                data: { catalog: 'coverages' },
              },
              {
                path: 'clinic/customer-agreements',
                loadComponent: () =>
                  import('./pages/clinic/agreements/catalog/catalog').then(
                    (m) => m.ClinicAgreementCatalogPage,
                  ),
                title: 'Clinic • Customer Agreements | mnscloud',
                data: { catalog: 'customer-agreements' },
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
                path: 'monitoring/incidents',
                loadComponent: () =>
                  import('./pages/monitoring/incidents/incidents').then(
                    (m) => m.MonitoringIncidentsPage,
                  ),
                title: 'Monitoring • Incidents | mnscloud',
              },
              {
                path: 'monitoring/overview',
                loadComponent: () =>
                  import('./pages/monitoring/telemetry/overview').then(
                    (m) => m.TelemetryOverviewPage,
                  ),
                title: 'Metrics | mnscloud',
                data: { breadcrumb: 'Metrics' },
              },
              {
                path: 'monitoring/agents/:uuid/telemetry',
                loadComponent: () =>
                  import('./pages/monitoring/telemetry/telemetry').then(
                    (m) => m.AgentTelemetryPage,
                  ),
                title: 'Agent Monitoring | mnscloud',
                data: { breadcrumb: 'Agent monitoring' },
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
                path: 'billing/topups',
                loadComponent: () =>
                  import('./pages/billing/tenant/topups/topups').then(
                    (m) => m.BillingTenantTopupsPage,
                  ),
                data: { breadcrumb: 'Top-ups' },
                title: 'Billing • Top-ups | mnscloud',
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
                path: 'billing/identity',
                loadComponent: () =>
                  import('./pages/billing/tenant/identity/identity').then(
                    (m) => m.BillingTenantIdentityPage,
                  ),
                data: { breadcrumb: 'Tax identity' },
                title: 'Billing • Tax identity | mnscloud',
              },
              {
                path: 'cyber-security',
                loadComponent: () =>
                  import('./pages/cyber-security/dashboard/dashboard').then(
                    (m) => m.CyberSecurityDashboardPage,
                  ),
                title: 'Cyber Security | mnscloud',
                data: cyberSecurityRouteData('', 'tenant'),
              },
              {
                path: 'cyber-security/services',
                loadComponent: () =>
                  import('./pages/cyber-security/services/services').then(
                    (m) => m.CyberSecurityServicesPage,
                  ),
                title: 'Cyber Security • Protected Services | mnscloud',
                data: cyberSecurityRouteData('services', 'tenant'),
              },
              {
                path: 'cyber-security/profiles',
                loadComponent: () =>
                  import('./pages/cyber-security/profiles/profiles').then(
                    (m) => m.CyberSecurityProfilesPage,
                  ),
                title: 'Cyber Security • Security Profiles | mnscloud',
                data: cyberSecurityRouteData('profiles', 'tenant'),
              },
              {
                path: 'cyber-security/trusted-nodes',
                loadComponent: () =>
                  import('./pages/cyber-security/trusted-nodes/trusted-nodes').then(
                    (m) => m.CyberSecurityTrustedNodesPage,
                  ),
                title: 'Cyber Security • Trusted Nodes | mnscloud',
                data: cyberSecurityRouteData('trusted-nodes', 'tenant'),
              },
              {
                path: 'cyber-security/network-policies',
                loadComponent: () =>
                  import('./pages/cyber-security/network-policies/network-policies').then(
                    (m) => m.CyberSecurityNetworkPoliciesPage,
                  ),
                title: 'Cyber Security • API Access Policies | mnscloud',
                data: cyberSecurityRouteData('network-policies', 'tenant'),
              },
              {
                path: 'cyber-security/secrets/dashboard',
                loadComponent: () =>
                  import('./pages/cyber-security/secrets/dashboard/dashboard').then(
                    (m) => m.SecretsDashboardPage,
                  ),
                title: 'Cyber Security • Secrets Overview | mnscloud',
                data: cyberSecurityRouteData('secrets/dashboard', 'tenant'),
              },
              {
                path: 'cyber-security/secrets',
                loadComponent: () =>
                  import('./pages/cyber-security/secrets/secrets').then(
                    (m) => m.CyberSecuritySecretsPage,
                  ),
                title: 'Cyber Security • Secrets | mnscloud',
                data: cyberSecurityRouteData('secrets', 'tenant'),
              },
              {
                path: 'cyber-security/secret-accounts',
                loadComponent: () =>
                  import('./pages/cyber-security/secrets/secret-accounts').then(
                    (m) => m.CyberSecuritySecretAccountsPage,
                  ),
                title: 'Cyber Security • Secret Accounts | mnscloud',
                data: cyberSecurityRouteData('secret-accounts', 'tenant'),
              },
              {
                path: 'cyber-security/dashboard',
                redirectTo: 'cyber-security',
                pathMatch: 'full',
              },
              ...[
                { section: 'servers', title: 'Servers' },
                { section: 'alerts', title: 'Alerts' },
                { section: 'decisions', title: 'Protection Decisions' },
                { section: 'lists', title: 'Allowlist / Blocklist' },
                { section: 'security-events', title: 'Security Events' },
              ].map(({ section, title }) => ({
                path: `cyber-security/${section}`,
                loadComponent: () =>
                  import('./pages/cyber-security/cyber-security').then((m) => m.CyberSecurityPage),
                title: `Cyber Security • ${title} | mnscloud`,
                data: cyberSecurityRouteData(section, 'tenant'),
              })),

              {
                path: 'authentication/dashboard',
                loadComponent: () =>
                  import('./pages/authentication/dashboard/dashboard').then(
                    (m) => m.AuthenticationDashboardPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.dashboard' },
              },
              {
                path: 'authentication/sessions',
                loadComponent: () =>
                  import('./pages/authentication/sessions/sessions').then(
                    (m) => m.AuthenticationSessionPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.sessions' },
              },
              {
                path: 'logs/accounts',
                loadComponent: () =>
                  import('./pages/logs/accounts/accounts').then((m) => m.LogsAccountPage),
                title: 'Logs',
                data: { scope: 'tenant', breadcrumb: 'logs.accounts' },
              },
              {
                path: 'logs/sources',
                loadComponent: () =>
                  import('./pages/logs/sources/sources').then((m) => m.LogsSourcePage),
                title: 'Logs',
                data: { scope: 'tenant', breadcrumb: 'logs.sources' },
              },
              {
                path: 'website/sites',
                loadComponent: () =>
                  import('./pages/website/sites/sites').then((m) => m.WebsiteSitesPage),
                title: 'Website',
                data: { scope: 'tenant', breadcrumb: 'website.sites' },
              },
              {
                path: 'website/sites/:uuid/editor',
                loadComponent: () =>
                  import('./pages/website/editor/editor').then((m) => m.WebsiteEditorPage),
                title: 'Website',
                data: { scope: 'tenant', breadcrumb: 'website.editor' },
              },
              {
                path: 'authentication/accounts',
                loadComponent: () =>
                  import('./pages/authentication/accounts/accounts').then(
                    (m) => m.AuthenticationAccountPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.accounts' },
              },
              {
                path: 'authentication/network-devices',
                loadComponent: () =>
                  import('./pages/authentication/network-devices/network-devices').then(
                    (m) => m.AuthenticationNasPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.network-devices' },
              },
              {
                path: 'authentication/accesses',
                loadComponent: () =>
                  import('./pages/authentication/accesses/accesses').then(
                    (m) => m.AuthenticationAccessPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.accesses' },
              },
              {
                path: 'authentication/rate-limits',
                loadComponent: () =>
                  import('./pages/authentication/rate-limits/rate-limits').then(
                    (m) => m.AuthenticationRateLimitPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.rate-limits' },
              },
              {
                path: 'authentication/profiles',
                loadComponent: () =>
                  import('./pages/authentication/profiles/profiles').then(
                    (m) => m.AuthenticationProfilePage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.profiles' },
              },
              {
                path: 'authentication/groups',
                loadComponent: () =>
                  import('./pages/authentication/groups/groups').then(
                    (m) => m.AuthenticationGroupPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.groups' },
              },
              {
                path: 'authentication/domains',
                loadComponent: () =>
                  import('./pages/authentication/domains/domains').then(
                    (m) => m.AuthenticationDomainPage,
                  ),
                title: 'Authentication',
                data: { scope: 'tenant', breadcrumb: 'authentication.domains' },
              },
              {
                path: 'crm/dashboard',
                loadComponent: () =>
                  import('./pages/crm/dashboard/dashboard').then((m) => m.CrmDashboardPage),
                title: 'CRM',
              },
              {
                path: 'crm/industries',
                loadComponent: () =>
                  import('./pages/crm/industries/industries').then((m) => m.CrmIndustryPage),
                title: 'CRM',
              },
              {
                path: 'crm/sources',
                loadComponent: () =>
                  import('./pages/crm/sources/sources').then((m) => m.CrmSourcePage),
                title: 'CRM',
              },
              {
                path: 'crm/loss-reasons',
                loadComponent: () =>
                  import('./pages/crm/loss-reasons/loss-reasons').then((m) => m.CrmLossReasonPage),
                title: 'CRM',
              },
              {
                path: 'crm/pipelines',
                loadComponent: () =>
                  import('./pages/crm/pipelines/pipelines').then((m) => m.CrmPipelinePage),
                title: 'CRM',
              },
              {
                path: 'crm/stages',
                loadComponent: () =>
                  import('./pages/crm/stages/stages').then((m) => m.CrmStagePage),
                title: 'CRM',
              },
              {
                path: 'crm/accounts',
                loadComponent: () =>
                  import('./pages/crm/accounts/accounts').then((m) => m.CrmAccountPage),
                title: 'CRM',
              },
              {
                path: 'crm/contacts',
                loadComponent: () =>
                  import('./pages/crm/contacts/contacts').then((m) => m.CrmContactPage),
                title: 'CRM',
              },
              {
                path: 'crm/products',
                loadComponent: () =>
                  import('./pages/crm/products/products').then((m) => m.CrmProductPage),
                title: 'CRM',
              },
              {
                path: 'crm/leads',
                loadComponent: () => import('./pages/crm/leads/leads').then((m) => m.CrmLeadPage),
                title: 'CRM',
              },
              {
                path: 'crm/opportunities',
                loadComponent: () =>
                  import('./pages/crm/opportunities/opportunities').then(
                    (m) => m.CrmOpportunityPage,
                  ),
                title: 'CRM',
              },
              {
                path: 'crm/activities',
                loadComponent: () =>
                  import('./pages/crm/activities/activities').then((m) => m.CrmActivityPage),
                title: 'CRM',
              },
              {
                path: 'crm/proposals',
                loadComponent: () =>
                  import('./pages/crm/proposals/proposals').then((m) => m.CrmProposalPage),
                title: 'CRM',
              },
              {
                path: 'crm/proposal-items',
                loadComponent: () =>
                  import('./pages/crm/proposal-items/proposal-items').then(
                    (m) => m.CrmProposalItemPage,
                  ),
                title: 'CRM',
              },
              {
                path: 'crm/handoffs',
                loadComponent: () =>
                  import('./pages/crm/handoffs/handoffs').then((m) => m.CrmHandoffPage),
                title: 'CRM',
              },

              // Registry (shared by every module)
              {
                path: 'registry/customers',
                loadComponent: () =>
                  import('./pages/registry/customers/customers').then((m) => m.RegCustomerPage),
                title: 'Registry • Customers | mnscloud',
              },
              {
                path: 'registry/customer-complexes',
                loadComponent: () =>
                  import('./pages/registry/customer-complexes/customer-complexes').then(
                    (m) => m.RegCustomerComplexPage,
                  ),
                title: 'Registry • Customer complexes | mnscloud',
              },
              {
                path: 'registry/companies',
                loadComponent: () =>
                  import('./pages/registry/companies/companies').then((m) => m.RegCompanyPage),
                title: 'Registry • Companies | mnscloud',
              },
              {
                path: 'registry/suppliers',
                loadComponent: () =>
                  import('./pages/registry/suppliers/suppliers').then((m) => m.RegSupplierPage),
                title: 'Registry • Suppliers | mnscloud',
              },
              {
                path: 'registry/carriers',
                loadComponent: () =>
                  import('./pages/registry/carriers/carriers').then((m) => m.RegCarrierPage),
                title: 'Registry • Carriers | mnscloud',
              },
              {
                path: 'registry/resellers',
                loadComponent: () =>
                  import('./pages/registry/resellers/resellers').then((m) => m.RegResellerPage),
                title: 'Registry • Resellers | mnscloud',
              },
              {
                path: 'registry/employees',
                loadComponent: () =>
                  import('./pages/registry/employees/employees').then((m) => m.RegEmployeesPage),
                title: 'Registry • Employees | mnscloud',
              },
              {
                path: 'registry/departments',
                loadComponent: () =>
                  import('./pages/registry/departments/departments').then(
                    (m) => m.RegDepartmentPage,
                  ),
                title: 'Registry • Departments | mnscloud',
              },
              {
                path: 'registry/positions',
                loadComponent: () =>
                  import('./pages/registry/positions/positions').then((m) => m.RegPositionPage),
                title: 'Registry • Positions | mnscloud',
              },
              {
                path: 'registry/cost-centers',
                loadComponent: () =>
                  import('./pages/registry/cost-centers/cost-centers').then(
                    (m) => m.RegCostCenterPage,
                  ),
                title: 'Registry • Cost centers | mnscloud',
              },

              // Human resources
              {
                path: 'hr/time-clock-accounts',
                loadComponent: () =>
                  import('./pages/hr/time-clock-accounts/time-clock-accounts').then(
                    (m) => m.HrTimeClockAccountsPage,
                  ),
                title: 'Human resources • Time clock accounts | mnscloud',
              },
              {
                path: 'hr/time-punches',
                loadComponent: () =>
                  import('./pages/hr/time-punches/time-punches').then((m) => m.HrTimePunchesPage),
                title: 'Human resources • Time punches | mnscloud',
              },

              // Financial
              {
                path: 'financial/payables',
                loadComponent: () =>
                  import('./pages/financial/payables/payables').then(
                    (m) => m.FinancialPayablesPage,
                  ),
                title: 'Financial • Accounts Payable | mnscloud',
              },
              {
                path: 'financial/receivables',
                loadComponent: () =>
                  import('./pages/financial/receivables/receivables').then(
                    (m) => m.FinancialReceivablesPage,
                  ),
                title: 'Financial • Accounts Receivable | mnscloud',
              },
              {
                path: 'financial/payment-methods',
                loadComponent: () =>
                  import('./pages/financial/payment-methods/payment-methods').then(
                    (m) => m.FinancialPaymentMethodPage,
                  ),
                title: 'Financial • Payment Methods | mnscloud',
              },
              {
                path: 'financial/payment-charges',
                loadComponent: () =>
                  import('./pages/financial/payment-charges/payment-charges').then(
                    (m) => m.FinancialPaymentChargePage,
                  ),
                title: 'Financial • Boletos and Pix | mnscloud',
              },
              {
                path: 'financial/gateway-accounts',
                loadComponent: () =>
                  import('./pages/financial/gateway-accounts/gateway-accounts').then(
                    (m) => m.FinancialPaymentGatewayPage,
                  ),
                title: 'Financial • Payment Gateways | mnscloud',
                data: { scope: 'tenant', context: 'financial' },
              },

              // Estoque

              // Stock
              {
                path: 'stock/locations',
                loadComponent: () =>
                  import('./pages/stock/locations').then((m) => m.StockLocationsPage),
                title: 'Stock • Locations | mnscloud',
              },
              {
                path: 'stock/balances',
                loadComponent: () =>
                  import('./pages/stock/balances').then((m) => m.StockBalancesPage),
                title: 'Stock • Balances | mnscloud',
              },
              {
                path: 'stock/movements',
                loadComponent: () =>
                  import('./pages/stock/movements').then((m) => m.StockMovementsPage),
                title: 'Stock • Movements | mnscloud',
              },
              {
                path: 'stock/transfers',
                loadComponent: () =>
                  import('./pages/stock/transfers').then((m) => m.StockTransfersPage),
                title: 'Stock • Transfers | mnscloud',
              },

              // Accounting
              {
                path: 'accounting/events',
                loadComponent: () =>
                  import('./pages/accounting/events').then((m) => m.AccountingEventsPage),
                title: 'Accounting • Events | mnscloud',
              },
              {
                path: 'accounting/mappings',
                loadComponent: () =>
                  import('./pages/accounting/mappings').then((m) => m.AccountingMappingsPage),
                title: 'Accounting • Mappings | mnscloud',
              },
              {
                path: 'accounting/exports',
                loadComponent: () =>
                  import('./pages/accounting/exports').then((m) => m.AccountingExportsPage),
                title: 'Accounting • Exports | mnscloud',
              },
              // Invoicing (customer billing, shared by every module)
              {
                path: 'customer-billing/contracts',
                loadComponent: () =>
                  import('./pages/customer-billing/contracts').then(
                    (m) => m.CustomerBillingContractsPage,
                  ),
                title: 'Invoicing • Contracts | mnscloud',
              },
              {
                path: 'customer-billing/due-days',
                loadComponent: () =>
                  import('./pages/customer-billing/due-days').then(
                    (m) => m.CustomerBillingDueDaysPage,
                  ),
                title: 'Invoicing • Due-day rules | mnscloud',
              },
              {
                path: 'customer-billing/charges',
                loadComponent: () =>
                  import('./pages/customer-billing/charges').then(
                    (m) => m.CustomerBillingChargesPage,
                  ),
                title: 'Invoicing • Charges | mnscloud',
              },
              {
                path: 'customer-billing/usage',
                loadComponent: () =>
                  import('./pages/customer-billing/usage').then((m) => m.CustomerBillingUsagePage),
                title: 'Invoicing • Usage | mnscloud',
              },
              {
                path: 'customer-billing/events',
                loadComponent: () =>
                  import('./pages/customer-billing/events').then(
                    (m) => m.CustomerBillingEventsPage,
                  ),
                title: 'Invoicing • Events | mnscloud',
              },
              {
                path: 'customer-billing/modules',
                loadComponent: () =>
                  import('./pages/customer-billing/modules').then(
                    (m) => m.CustomerBillingModulesPage,
                  ),
                title: 'Invoicing • Modules | mnscloud',
              },
              // Fiscal
              {
                path: 'fiscal/issuers',
                loadComponent: () =>
                  import('./pages/fiscal/issuers').then((m) => m.FiscalIssuersPage),
                title: 'Fiscal • Issuers | mnscloud',
              },
              {
                path: 'fiscal/documents',
                loadComponent: () =>
                  import('./pages/fiscal/documents').then((m) => m.FiscalDocumentsPage),
                title: 'Fiscal • Documents | mnscloud',
              },
              {
                path: 'fiscal/contingency',
                loadComponent: () =>
                  import('./pages/fiscal/contingency').then((m) => m.FiscalContingencyPage),
                title: 'Fiscal • Contingency | mnscloud',
              },
              {
                path: 'fiscal/certificates',
                loadComponent: () =>
                  import('./pages/fiscal/certificates').then((m) => m.FiscalCertificatesPage),
                title: 'Fiscal • Certificates | mnscloud',
              },
              {
                path: 'fiscal/csc',
                loadComponent: () => import('./pages/fiscal/csc').then((m) => m.FiscalCscPage),
                title: 'Fiscal • CSC | mnscloud',
              },
              {
                path: 'fiscal/series',
                loadComponent: () =>
                  import('./pages/fiscal/series').then((m) => m.FiscalSeriesPage),
                title: 'Fiscal • Series | mnscloud',
              },
              {
                path: 'fiscal/rule-packages',
                loadComponent: () =>
                  import('./pages/fiscal/rule-packages').then((m) => m.FiscalRulePackagesPage),
                title: 'Fiscal • Rules | mnscloud',
              },

              // POS
              {
                path: 'point-of-sale/terminals',
                loadComponent: () =>
                  import('./pages/pos/terminals').then((m) => m.PosTerminalsPage),
                title: 'POS • Terminals | mnscloud',
              },
              {
                path: 'point-of-sale/sessions',
                loadComponent: () => import('./pages/pos/sessions').then((m) => m.PosSessionsPage),
                title: 'POS • Cash sessions | mnscloud',
              },
              {
                path: 'point-of-sale/sales',
                loadComponent: () => import('./pages/pos/sales').then((m) => m.PosSalesPage),
                title: 'POS • Sales | mnscloud',
              },
              {
                path: 'point-of-sale/devices',
                loadComponent: () => import('./pages/pos/devices').then((m) => m.PosDevicesPage),
                title: 'POS • Devices | mnscloud',
              },
              {
                path: 'point-of-sale/sync-conflicts',
                loadComponent: () =>
                  import('./pages/pos/sync-conflicts').then((m) => m.PosSyncConflictsPage),
                title: 'POS • Sync conflicts | mnscloud',
              },

              // Sale
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
                path: 'sale/price-list',
                loadComponent: () =>
                  import('./pages/sales/price-list/price-list').then((m) => m.SalePriceListPage),
                title: 'Sale • Price Lists | mnscloud',
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
                data: { supportDesk: 'tenant' },
              },
              {
                path: 'support/client-tests',
                loadComponent: () =>
                  import('./pages/dns/client-tests/client-tests').then((m) => m.DnsClientTestsPage),
                title: 'Support • Connection tests | mnscloud',
                data: { endpoint: 'support/client-tests', breadcrumb: 'dns.clientTests' },
              },
              {
                path: 'support/ticket-channels',
                loadComponent: () =>
                  import('./pages/support/ticket-channels/ticket-channels').then(
                    (m) => m.SupportTicketChannelsPage,
                  ),
                title: 'Support • Ticket origins | mnscloud',
                data: { supportDesk: 'tenant', breadcrumb: 'Ticket origins' },
              },
              {
                path: 'support/ticket-types',
                loadComponent: () =>
                  import('./pages/support/ticket-types/ticket-types').then(
                    (m) => m.SupportTicketTypesPage,
                  ),
                title: 'Support • Ticket types | mnscloud',
                data: { supportDesk: 'tenant', breadcrumb: 'Ticket types' },
              },
              {
                path: 'support/ticket-priorities',
                loadComponent: () =>
                  import('./pages/support/ticket-priorities/ticket-priorities').then(
                    (m) => m.SupportTicketPrioritiesPage,
                  ),
                title: 'Support • Ticket priorities | mnscloud',
                data: { supportDesk: 'tenant', breadcrumb: 'Ticket priorities' },
              },
              {
                // Idea board inside the App: every tenant user proposes and votes.
                path: 'support/ideas',
                loadComponent: () =>
                  import('./pages/support/ideas/ideas').then((m) => m.FeatureRequestsPage),
                title: 'Ideas board | mnscloud',
                data: { breadcrumb: 'Ideas board' },
              },
              {
                // Help center: every tenant user, no Support module needed.
                path: 'support/requests',
                loadComponent: () =>
                  import('./pages/help/tickets/tickets').then((m) => m.HelpTicketsPage),
                title: 'My tickets | mnscloud',
                data: { breadcrumb: 'My tickets' },
              },
              {
                path: 'support/teams',
                loadComponent: () =>
                  import('./pages/support/teams/teams').then((m) => m.SupportTeamsPage),
                title: 'Support • Teams | mnscloud',
                data: { supportDesk: 'tenant' },
              },
              // Channel connections moved to the Conversations module.
              {
                path: 'support/channels',
                redirectTo: 'conversations/connections',
                pathMatch: 'full',
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
              // InfraGIS
              {
                path: 'infragis/projects',
                loadComponent: () =>
                  import('./pages/infragis/management/management').then(
                    (m) => m.InfraGisManagementPage,
                  ),
                title: 'InfraGIS • Projects | mnscloud',
                data: { scope: 'tenant', context: 'infragis', resource: 'projects' },
              },
              {
                path: 'infragis/layers',
                loadComponent: () =>
                  import('./pages/infragis/management/management').then(
                    (m) => m.InfraGisManagementPage,
                  ),
                title: 'InfraGIS • Layers | mnscloud',
                data: { scope: 'tenant', context: 'infragis', resource: 'layers' },
              },
              {
                path: 'infragis/categories',
                loadComponent: () =>
                  import('./pages/infragis/management/management').then(
                    (m) => m.InfraGisManagementPage,
                  ),
                title: 'InfraGIS • Categories | mnscloud',
                data: { scope: 'tenant', context: 'infragis', resource: 'categories' },
              },
              {
                path: 'infragis/asset-types',
                loadComponent: () =>
                  import('./pages/infragis/management/management').then(
                    (m) => m.InfraGisManagementPage,
                  ),
                title: 'InfraGIS • Asset Types | mnscloud',
                data: { scope: 'tenant', context: 'infragis', resource: 'asset-types' },
              },
              {
                path: 'infragis/statuses',
                loadComponent: () =>
                  import('./pages/infragis/management/management').then(
                    (m) => m.InfraGisManagementPage,
                  ),
                title: 'InfraGIS • Statuses | mnscloud',
                data: { scope: 'tenant', context: 'infragis', resource: 'statuses' },
              },
              {
                path: 'infragis/assets',
                loadComponent: () =>
                  import('./pages/infragis/management/management').then(
                    (m) => m.InfraGisManagementPage,
                  ),
                title: 'InfraGIS • Assets | mnscloud',
                data: { scope: 'tenant', context: 'infragis', resource: 'assets' },
              },
              {
                path: 'infragis/map',
                loadComponent: () =>
                  import('./pages/infragis/map/map').then((m) => m.InfraGisMapPage),
                title: 'InfraGIS • Map | mnscloud',
                data: { scope: 'tenant', context: 'infragis' },
              },
              {
                path: 'infragis/network',
                loadComponent: () =>
                  import('./pages/infragis/network/network').then((m) => m.InfraGisNetworkPage),
                title: 'InfraGIS • Network | mnscloud',
                data: { scope: 'tenant', context: 'infragis' },
              },
              {
                path: 'infragis/transfer',
                loadComponent: () =>
                  import('./pages/infragis/transfer/transfer').then((m) => m.InfraGisTransferPage),
                title: 'InfraGIS • Import and export | mnscloud',
                data: { scope: 'tenant', context: 'infragis' },
              },
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
                path: 'hosting/dns',
                title: 'Hosting • DNS | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/dns/dashboard/dashboard').then(
                        (m) => m.HostingDnsDashboardPage,
                      ),
                    title: 'Hosting • DNS Dashboard | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'domains/:uuid/records',
                    loadComponent: () =>
                      import('./pages/hosting/dns/zone-records/zone-records').then(
                        (m) => m.HostingDnsZoneRecordsPage,
                      ),
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'domains/:uuid',
                    pathMatch: 'full',
                    redirectTo: 'domains',
                  },
                  {
                    path: 'domains',
                    loadComponent: () =>
                      import('./pages/hosting/dns/domains/domains').then(
                        (m) => m.HostingDnsDomainsPage,
                      ),
                    title: 'Hosting • DNS • Domains | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'registers',
                    loadComponent: () =>
                      import('./pages/hosting/dns/registers/registers').then(
                        (m) => m.HostingDnsRegistersPage,
                      ),
                    title: 'Hosting • DNS • Registers | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/dns/providers/providers').then(
                        (m) => m.HostingDnsProvidersPage,
                      ),
                    title: 'Hosting • DNS • Providers | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                ],
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
                  ...STORAGE_RESOURCE_ROUTES,
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
                    path: 'instances/:uuid/monitoring',
                    loadComponent: () =>
                      import('./pages/hosting/vps/instances/instance-monitor').then(
                        (m) => m.VpsInstanceMonitorPage,
                      ),
                    title: 'Hosting • VPS Monitoring | mnscloud',
                    data: {
                      scope: 'tenant',
                      context: 'hosting',
                      breadcrumb: 'VPS instance monitoring',
                    },
                  },
                  {
                    path: 'snapshots',
                    loadComponent: () =>
                      import('./pages/hosting/vps/snapshots/snapshots').then(
                        (m) => m.HostingVpsSnapshotsPage,
                      ),
                    title: 'Hosting • VPS Snapshots | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'networks',
                    loadComponent: () =>
                      import('./pages/hosting/vps/networks/networks').then(
                        (m) => m.HostingVpsNetworksPage,
                      ),
                    title: 'Hosting • VPS Networks | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'firewalls',
                    loadComponent: () =>
                      import('./pages/hosting/vps/firewalls/firewalls').then(
                        (m) => m.HostingVpsFirewallsPage,
                      ),
                    title: 'Hosting • VPS Firewalls | mnscloud',
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
                ],
              },
              {
                path: 'hosting/webhost',
                title: 'Hosting • Webhost | mnscloud',
                data: { scope: 'tenant', context: 'hosting' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/dashboard/dashboard').then(
                        (m) => m.HostingWebhostDashboardPage,
                      ),
                    title: 'Hosting • Webhost Dashboard | mnscloud',
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
                      import('./pages/hosting/webhost/databases/databases').then(
                        (m) => m.HostingWebhostDatabasesPage,
                      ),
                    title: 'Hosting • Webhost • Databases | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'database-users',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/databases/databases').then(
                        (m) => m.HostingWebhostDatabasesPage,
                      ),
                    title: 'Hosting • Webhost • Database users | mnscloud',
                    data: {
                      scope: 'tenant',
                      databaseResource: 'database-users',
                      context: 'hosting',
                    },
                  },
                  {
                    path: 'database-grants',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/databases/databases').then(
                        (m) => m.HostingWebhostDatabasesPage,
                      ),
                    title: 'Hosting • Webhost • Database grants | mnscloud',
                    data: {
                      scope: 'tenant',
                      databaseResource: 'database-grants',
                      context: 'hosting',
                    },
                  },
                  {
                    path: 'mailing-lists',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/mailing-lists/mailing-lists').then(
                        (m) => m.HostingWebhostMailingListsPage,
                      ),
                    title: 'Hosting • Webhost • Mailing Lists | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
                  },
                  {
                    path: 'zone-editor',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/zone-editor/zone-editor').then(
                        (m) => m.HostingWebhostZoneEditorPage,
                      ),
                    title: 'Hosting • Webhost • Zone Editor | mnscloud',
                    data: { scope: 'tenant', context: 'hosting' },
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
                path: 'voip/domains',
                loadComponent: () =>
                  import('./pages/voip/domain/domain').then((m) => m.VoipDomainPage),
                title: 'VoIP • Domains | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
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
                path: 'voip/portability-orders',
                loadComponent: () =>
                  import('./pages/voip/portability-orders/portability-orders').then(
                    (m) => m.VoipPortabilityOrdersPage,
                  ),
                title: 'VoIP • Portability Orders | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
              },
              {
                path: 'voip/portability-reasons',
                loadComponent: () =>
                  import('./pages/voip/portability-reasons/portability-reasons').then(
                    (m) => m.VoipPortabilityReasonsPage,
                  ),
                title: 'VoIP • Portability Reasons | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
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
                path: 'voip/sbc/domains',
                loadComponent: () =>
                  import('./pages/voip/service-domain/service-domain').then(
                    (m) => m.VoipSbcDomainPage,
                  ),
                title: 'VoIP • SBC • Domains | mnscloud',
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
                path: 'voip/sbc/cdr',
                loadComponent: () =>
                  import('./pages/voip/sbc/cdr/cdr').then((m) => m.VoipSbcCdrPage),
                title: 'VoIP • SBC • CDR | mnscloud',
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
              {
                path: 'realtime/domain',
                loadComponent: () =>
                  import('./pages/realtime/domains/domains').then(
                    (m) => m.RealtimeDomainsTenantPage,
                  ),
                title: 'Realtime • Domains | mnscloud',
                data: { scope: 'tenant' },
              },
              ...(['domain', 'sip-target'].map((section) => ({
                path: `realtime/webrtc/${section}`,
                loadComponent: () => {
                  const page = import('./pages/realtime/webrtc/webrtc');
                  if (section === 'sip-target') {
                    return page.then((m) => m.RealtimeWebRtcSipTargetsPage);
                  }
                  return page.then((m) => m.RealtimeWebRtcDomainsTenantPage);
                },
                title: `Realtime • WebRTC • ${section} | mnscloud`,
                data: {
                  scope: 'tenant',
                  resource:
                    section === 'server'
                      ? 'servers'
                      : section === 'domain'
                        ? 'domains'
                        : 'sip-targets',
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
                  import('./pages/voip/softswitch/accounts/accounts').then(
                    (m) => m.VoipSoftswitchAccountsPage,
                  ),
                title: 'VoIP • Softswitch | mnscloud',
              },
              {
                path: 'voip/softswitch/domains',
                loadComponent: () =>
                  import('./pages/voip/service-domain/service-domain').then(
                    (m) => m.VoipSoftswitchDomainPage,
                  ),
                title: 'VoIP • Softswitch • Domains | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
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
                path: 'voip/softswitch/trunk-groups',
                loadComponent: () =>
                  import('./pages/voip/softswitch/trunk-group/trunk-group').then(
                    (m) => m.VoipSoftswitchTrunkGroupPage,
                  ),
                title: 'VoIP • Softswitch • Trunk Groups | mnscloud',
              },
              {
                path: 'voip/softswitch/trunk-group-members',
                loadComponent: () =>
                  import('./pages/voip/softswitch/trunk-group-member/trunk-group-member').then(
                    (m) => m.VoipSoftswitchTrunkGroupMemberPage,
                  ),
                title: 'VoIP • Softswitch • Trunk Group Members | mnscloud',
              },
              {
                path: 'voip/softswitch/dialplans',
                loadComponent: () =>
                  import('./pages/voip/softswitch/dialplan/dialplan').then(
                    (m) => m.VoipSoftswitchDialplanPage,
                  ),
                title: 'VoIP • Softswitch • Dialplans | mnscloud',
              },
              {
                path: 'voip/softswitch/dialplan-rules',
                loadComponent: () =>
                  import('./pages/voip/softswitch/dialplan-rule/dialplan-rule').then(
                    (m) => m.VoipSoftswitchDialplanRulePage,
                  ),
                title: 'VoIP • Softswitch • Dialplan Rules | mnscloud',
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
                title: 'VoIP • Softswitch • CDR | mnscloud',
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
                loadComponent: () =>
                  import('./pages/voip/pabx/account/account').then((m) => m.VoipPabxAccountPage),
                title: 'VoIP • PABX | mnscloud',
              },
              {
                path: 'voip/pabx/domains',
                loadComponent: () =>
                  import('./pages/voip/service-domain/service-domain').then(
                    (m) => m.VoipPabxDomainPage,
                  ),
                title: 'VoIP • PABX • Domains | mnscloud',
                data: { scope: 'tenant', context: 'voip' },
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
                path: 'voip/pabx/trunks',
                loadComponent: () =>
                  import('./pages/voip/pabx/trunk/trunk').then((m) => m.VoipPabxTrunkPage),
                title: 'VoIP • PABX • Trunks | mnscloud',
              },
              {
                path: 'voip/pabx/inbound-routes',
                loadComponent: () =>
                  import('./pages/voip/pabx/inbound-route/inbound-route').then(
                    (m) => m.VoipPabxInboundRoutePage,
                  ),
                title: 'VoIP • PABX • Inbound Routes | mnscloud',
                data: { resource: 'inbound-routes' },
              },
              {
                path: 'voip/pabx/group',
                loadComponent: () =>
                  import('./pages/voip/pabx/group/group').then((m) => m.VoipPabxGroupPage),
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
                path: 'conversations/inbox',
                loadComponent: () =>
                  import('./pages/conversations/inbox/inbox').then((m) => m.ConversationsInboxPage),
                title: 'Conversations • Inbox | mnscloud',
              },
              {
                path: 'conversations/connections',
                loadComponent: () =>
                  import('./pages/conversations/connections/connections').then(
                    (m) => m.ConversationConnectionsPage,
                  ),
                title: 'Conversations • Channel connections | mnscloud',
              },
              {
                path: 'voip/phone/users',
                loadComponent: () =>
                  import('./pages/voip/phone/users/users').then((m) => m.VoipPhoneUsersPage),
                title: 'VoIP • PhoneWeb • Users | mnscloud',
              },
              {
                path: 'voip/phone/pool-lines',
                loadComponent: () =>
                  import('./pages/voip/phone/pool-lines/pool-lines').then(
                    (m) => m.VoipPhonePoolLinesPage,
                  ),
                title: 'VoIP • PhoneWeb • Free lines | mnscloud',
              },
              {
                path: 'voip/phone/calls',
                loadComponent: () =>
                  import('./pages/voip/phone/calls/calls').then((m) => m.VoipPhoneCallsPage),
                title: 'VoIP • PhoneWeb • Calls | mnscloud',
              },
              {
                path: 'voip/phone/sessions',
                loadComponent: () =>
                  import('./pages/voip/phone/sessions/sessions').then(
                    (m) => m.VoipPhoneSessionsPage,
                  ),
                title: 'VoIP • PhoneWeb • Sessions | mnscloud',
              },
              {
                path: 'voip/pabx/agent-profiles',
                loadComponent: () =>
                  import('./pages/voip/pabx/agent-profile/agent-profile').then(
                    (m) => m.VoipPabxAgentProfilePage,
                  ),
                title: 'VoIP • PABX • Agent profiles | mnscloud',
              },
              {
                path: 'voip/pabx/agent-pause-reasons',
                loadComponent: () =>
                  import('./pages/voip/pabx/agent-pause-reason/agent-pause-reason').then(
                    (m) => m.VoipPabxAgentPauseReasonPage,
                  ),
                title: 'VoIP • PABX • Pause reasons | mnscloud',
              },
              {
                path: 'voip/pabx/agent-state-events',
                loadComponent: () =>
                  import('./pages/voip/pabx/agent-state-event/agent-state-event').then(
                    (m) => m.VoipPabxAgentStateEventPage,
                  ),
                title: 'VoIP • PABX • State history | mnscloud',
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
                path: 'voip/pabx/parameters',
                loadComponent: () =>
                  import('./pages/voip/pabx/parameters/parameters').then(
                    (m) => m.VoipPabxParametersPage,
                  ),
                title: 'VoIP • PABX • Parameters | mnscloud',
                data: { scope: 'tenant' },
              },
              {
                path: 'voip/softswitch/parameters',
                loadComponent: () =>
                  import('./pages/voip/softswitch/parameters/parameters').then(
                    (m) => m.VoipSoftswitchParametersPage,
                  ),
                title: 'VoIP • Softswitch • Parameters | mnscloud',
                data: { scope: 'tenant' },
              },
              {
                path: 'voip/pabx/ivr',
                loadComponent: () =>
                  import('./pages/voip/pabx/ivr/ivr').then((m) => m.VoipPabxIvrPage),
                title: 'VoIP • PABX • IVR | mnscloud',
              },
              {
                path: 'voip/pabx/custom',
                loadComponent: () =>
                  import('./pages/voip/pabx/custom/custom').then((m) => m.VoipPabxCustomPage),
                title: 'VoIP • PABX • Custom | mnscloud',
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
          // SYSTEM AREA
          // =================================================
          {
            path: 'system',
            canActivate: [permissionGuard],
            data: { permission: 'platform.master.access' },
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
                path: 'monitoring/incidents',
                loadComponent: () =>
                  import('./pages/monitoring/incidents/incidents').then(
                    (m) => m.MonitoringIncidentsPage,
                  ),
                title: 'System Monitoring • Incidents | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'monitoring/notification-rules',
                loadComponent: () =>
                  import('./pages/monitoring/notification-rules/notification-rules').then(
                    (m) => m.MonitoringNotificationRulesPage,
                  ),
                title: 'System Monitoring • Notification rules | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'monitoring/overview',
                loadComponent: () =>
                  import('./pages/monitoring/telemetry/overview').then(
                    (m) => m.TelemetryOverviewPage,
                  ),
                title: 'Metrics | mnscloud',
                data: { breadcrumb: 'Metrics' },
              },
              {
                path: 'monitoring/agents/:uuid/telemetry',
                loadComponent: () =>
                  import('./pages/monitoring/telemetry/telemetry').then(
                    (m) => m.AgentTelemetryPage,
                  ),
                title: 'Agent Monitoring | mnscloud',
                data: { breadcrumb: 'Agent monitoring' },
              },
              {
                path: 'monitoring/agents',
                loadComponent: () =>
                  import('./pages/monitoring/agents/agents').then((m) => m.MonitoringAgentsPage),
                title: 'System Monitoring • Agents | mnscloud',
              },
              {
                path: 'monitoring/runtime-reconcile',
                loadComponent: () =>
                  import('./pages/system/runtime/reconcile/reconcile').then(
                    (m) => m.SystemRuntimeReconcilePage,
                  ),
                title: 'System Monitoring • Runtime reconcile | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'monitoring/database-access',
                loadComponent: () =>
                  import('./pages/system/database/principals/principals').then(
                    (m) => m.SystemDatabasePrincipalsPage,
                  ),
                title: 'System Monitoring • Database access | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'monitoring/client-versions',
                loadComponent: () =>
                  import('./pages/system/runtime/client-versions/client-versions').then(
                    (m) => m.SystemRuntimeClientVersionsPage,
                  ),
                title: 'System Monitoring • Versions in use | mnscloud',
                data: { scope: 'master' },
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
                  import('./pages/cyber-security/dashboard/dashboard').then(
                    (m) => m.CyberSecurityDashboardPage,
                  ),
                title: 'System Cyber Security | mnscloud',
                data: cyberSecurityRouteData('', 'master'),
              },
              {
                path: 'cyber-security/services',
                loadComponent: () =>
                  import('./pages/cyber-security/services/services').then(
                    (m) => m.CyberSecurityServicesPage,
                  ),
                title: 'System Cyber Security • Protected Services | mnscloud',
                data: cyberSecurityRouteData('services', 'master'),
              },
              {
                path: 'cyber-security/profiles',
                loadComponent: () =>
                  import('./pages/cyber-security/profiles/profiles').then(
                    (m) => m.CyberSecurityProfilesPage,
                  ),
                title: 'System Cyber Security • Security Profiles | mnscloud',
                data: cyberSecurityRouteData('profiles', 'master'),
              },
              {
                path: 'cyber-security/trusted-nodes',
                loadComponent: () =>
                  import('./pages/cyber-security/trusted-nodes/trusted-nodes').then(
                    (m) => m.CyberSecurityTrustedNodesPage,
                  ),
                title: 'System Cyber Security • Trusted Nodes | mnscloud',
                data: cyberSecurityRouteData('trusted-nodes', 'master'),
              },
              {
                path: 'cyber-security/network-policies',
                loadComponent: () =>
                  import('./pages/cyber-security/network-policies/network-policies').then(
                    (m) => m.CyberSecurityNetworkPoliciesPage,
                  ),
                title: 'System Cyber Security • API Access Policies | mnscloud',
                data: cyberSecurityRouteData('network-policies', 'master'),
              },
              {
                path: 'cyber-security/secrets/dashboard',
                loadComponent: () =>
                  import('./pages/cyber-security/secrets/dashboard/dashboard').then(
                    (m) => m.SecretsDashboardPage,
                  ),
                title: 'Cyber Security • Secrets Overview | mnscloud',
                data: cyberSecurityRouteData('secrets/dashboard', 'master'),
              },
              {
                path: 'cyber-security/secrets',
                loadComponent: () =>
                  import('./pages/cyber-security/secrets/secrets').then(
                    (m) => m.CyberSecuritySecretsPage,
                  ),
                title: 'System Cyber Security • Secrets | mnscloud',
                data: cyberSecurityRouteData('secrets', 'master'),
              },
              {
                path: 'cyber-security/secret-accounts',
                loadComponent: () =>
                  import('./pages/cyber-security/secrets/secret-accounts').then(
                    (m) => m.CyberSecuritySecretAccountsPage,
                  ),
                title: 'System Cyber Security • Secret Accounts | mnscloud',
                data: cyberSecurityRouteData('secret-accounts', 'master'),
              },
              {
                path: 'cyber-security/secret-servers',
                loadComponent: () =>
                  import('./pages/cyber-security/secrets/secret-servers').then(
                    (m) => m.CyberSecuritySecretServersPage,
                  ),
                title: 'System Cyber Security • Secret Servers | mnscloud',
                data: cyberSecurityRouteData('secret-servers', 'master'),
              },
              {
                path: 'cyber-security/dashboard',
                redirectTo: 'cyber-security',
                pathMatch: 'full',
              },
              ...[
                { section: 'servers', title: 'Servers' },
                { section: 'alerts', title: 'Alerts' },
                { section: 'decisions', title: 'Protection Decisions' },
                { section: 'lists', title: 'Allowlist / Blocklist' },
                { section: 'security-events', title: 'Security Events' },
              ].map(({ section, title }) => ({
                path: `cyber-security/${section}`,
                loadComponent: () =>
                  import('./pages/cyber-security/cyber-security').then((m) => m.CyberSecurityPage),
                title: `Cyber Security • ${title} | mnscloud`,
                data: cyberSecurityRouteData(section, 'master'),
              })),
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
                path: 'billing/parameters',
                loadComponent: () =>
                  import('./pages/billing/system/parameters/parameters').then(
                    (m) => m.BillingSystemParametersPage,
                  ),
                title: 'System Billing • Parameters | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'billing/price-adjustments',
                loadComponent: () =>
                  import('./pages/billing/system/price-adjustments/price-adjustments').then(
                    (m) => m.BillingSystemPriceAdjustmentsPage,
                  ),
                title: 'System Billing • Price adjustments | mnscloud',
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
                path: 'billing/ledger',
                loadComponent: () =>
                  import('./pages/billing/system/ledger/ledger').then(
                    (m) => m.BillingSystemLedgerPage,
                  ),
                title: 'System Billing • Statement | mnscloud',
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
                path: 'softswitch/parameters',
                loadComponent: () =>
                  import('./pages/voip/softswitch/parameters/parameters').then(
                    (m) => m.VoipSoftswitchParametersPage,
                  ),
                title: 'System Softswitch Parameters | mnscloud',
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
                path: 'sbc/interface',
                loadComponent: () =>
                  import('./pages/voip/sbc/interface/interface').then(
                    (m) => m.VoipSbcInterfacePage,
                  ),
                title: 'System SBC Interface | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'voip/domains',
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
              ...(['domain', 'server'].map((section) => ({
                path: `realtime/webrtc/${section}`,
                loadComponent: () => {
                  const page = import('./pages/realtime/webrtc/webrtc');
                  if (section === 'server') return page.then((m) => m.RealtimeWebRtcServersPage);
                  return page.then((m) => m.RealtimeWebRtcDomainsMasterPage);
                },
                title: `System Realtime • WebRTC • ${section} | mnscloud`,
                data: {
                  scope: 'master',
                  resource: section === 'server' ? 'servers' : 'domains',
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
                  import('./pages/realtime/turn/turn').then((m) => m.RealtimeTurnServersPage),
                title: 'System Realtime • TURN/STUN Servers | mnscloud',
                data: { scope: 'master', resource: 'servers' },
              },
              {
                path: 'realtime/turn/domains',
                loadComponent: () =>
                  import('./pages/realtime/turn/turn').then((m) => m.RealtimeTurnDomainsPage),
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
                  import('./pages/realtime/media/media').then((m) => m.RealtimeMediaServersPage),
                title: 'System Realtime • Media Servers | mnscloud',
                data: { scope: 'master', resource: 'servers' },
              },
              {
                path: 'infragis/provider-settings',
                loadComponent: () =>
                  import('./pages/infragis/provider-settings/provider-settings').then(
                    (m) => m.InfraGisProviderSettingsPage,
                  ),
                title: 'System InfraGIS • Base map | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'infragis/verticals',
                loadComponent: () =>
                  import('./pages/infragis/verticals/verticals').then(
                    (m) => m.InfraGisVerticalsPage,
                  ),
                title: 'System InfraGIS • Vertical packages | mnscloud',
                data: { scope: 'master' },
              },
              {
                path: 'realtime/media/domains',
                loadComponent: () =>
                  import('./pages/realtime/media/media').then((m) => m.RealtimeMediaDomainsPage),
                title: 'System Realtime • Media Domains | mnscloud',
                data: { scope: 'master', resource: 'domains' },
              },
              ...(
                [
                  ['media/parameters', 'media', 'Media Parameters'],
                  ['turn/parameters', 'turn', 'TURN/STUN Parameters'],
                  ['webrtc/parameters', 'webrtc', 'WebRTC Parameters'],
                  ['webrtc/automatic-dns', 'webrtc', 'WebRTC Parameters'],
                  ['webrtc/parameter', 'webrtc', 'WebRTC Parameters'],
                ] as const
              ).map(([path, serverKind, title]) => ({
                path: `realtime/${path}`,
                loadComponent: () =>
                  import('./pages/realtime/server-parameters/server-parameters').then(
                    (m) => m.RealtimeServerParametersPage,
                  ),
                title: `System Realtime • ${title} | mnscloud`,
                data: { scope: 'master', serverKind },
              })),
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
                path: 'pabx/parameters',
                loadComponent: () =>
                  import('./pages/voip/pabx/parameters/parameters').then(
                    (m) => m.VoipPabxParametersPage,
                  ),
                title: 'System PABX Parameters | mnscloud',
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
                path: 'hosting/dns',
                title: 'System Hosting • DNS | mnscloud',
                data: { scope: 'master', context: 'system' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/dns/dashboard/dashboard').then(
                        (m) => m.HostingDnsDashboardPage,
                      ),
                    title: 'System Hosting • DNS Dashboard | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'domains/:uuid/records',
                    loadComponent: () =>
                      import('./pages/hosting/dns/zone-records/zone-records').then(
                        (m) => m.HostingDnsZoneRecordsPage,
                      ),
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'domains/:uuid',
                    pathMatch: 'full',
                    redirectTo: 'domains',
                  },
                  {
                    path: 'domains',
                    loadComponent: () =>
                      import('./pages/hosting/dns/domains/domains').then(
                        (m) => m.HostingDnsDomainsPage,
                      ),
                    title: 'System Hosting • DNS • Domains | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'registers',
                    loadComponent: () =>
                      import('./pages/hosting/dns/registers/registers').then(
                        (m) => m.HostingDnsRegistersPage,
                      ),
                    title: 'System Hosting • DNS • Registers | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/dns/providers/providers').then(
                        (m) => m.HostingDnsProvidersPage,
                      ),
                    title: 'System Hosting • DNS • Providers | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                ],
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
                  ...STORAGE_RESOURCE_ROUTES,
                ],
              },
              {
                path: 'authentication/dashboard',
                loadComponent: () =>
                  import('./pages/authentication/dashboard/dashboard').then(
                    (m) => m.AuthenticationDashboardPage,
                  ),
                title: 'Authentication',
                data: { scope: 'master', breadcrumb: 'authentication.dashboard' },
              },
              {
                path: 'authentication/clusters',
                loadComponent: () =>
                  import('./pages/authentication/clusters/clusters').then(
                    (m) => m.AuthenticationClusterPage,
                  ),
                title: 'Authentication',
                data: { scope: 'master', breadcrumb: 'authentication.clusters' },
              },
              {
                path: 'authentication/servers',
                loadComponent: () =>
                  import('./pages/authentication/servers/servers').then(
                    (m) => m.AuthenticationServerPage,
                  ),
                title: 'Authentication',
                data: { scope: 'master', breadcrumb: 'authentication.servers' },
              },
              {
                path: 'logs/clusters',
                loadComponent: () =>
                  import('./pages/logs/clusters/clusters').then((m) => m.LogsClusterPage),
                title: 'Logs',
                data: { scope: 'master', breadcrumb: 'logs.clusters' },
              },
              {
                path: 'logs/servers',
                loadComponent: () =>
                  import('./pages/logs/servers/servers').then((m) => m.LogsServerPage),
                title: 'Logs',
                data: { scope: 'master', breadcrumb: 'logs.servers' },
              },
              {
                path: 'dns/clusters',
                loadComponent: () =>
                  import('./pages/dns/clusters/clusters').then((m) => m.DnsClusterPage),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.clusters' },
              },
              {
                path: 'dns/servers',
                loadComponent: () =>
                  import('./pages/dns/servers/servers').then((m) => m.DnsServerPage),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.servers' },
              },
              {
                path: 'dns/diagnostics',
                loadComponent: () =>
                  import('./pages/dns/diagnostics/diagnostics').then((m) => m.DnsDiagnosticsPage),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.diagnostics' },
              },
              {
                path: 'dns/client-networks',
                loadComponent: () =>
                  import('./pages/dns/resolver/resolver-lists').then((m) => m.DnsResolverListsPage),
                title: 'DNS',
                data: {
                  scope: 'master',
                  breadcrumb: 'dns.clientNetworks',
                  list: 'client-networks',
                },
              },
              {
                path: 'dns/forward-zones',
                loadComponent: () =>
                  import('./pages/dns/resolver/resolver-lists').then((m) => m.DnsResolverListsPage),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.forwardZones', list: 'forward-zones' },
              },
              {
                path: 'dns/client-tests',
                loadComponent: () =>
                  import('./pages/dns/client-tests/client-tests').then((m) => m.DnsClientTestsPage),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.clientTests' },
              },
              {
                path: 'dns/monitoring',
                loadComponent: () =>
                  import('./pages/dns/monitoring/monitoring').then((m) => m.DnsMonitoringPage),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.monitoring' },
              },
              {
                path: 'dns/monitor-targets',
                loadComponent: () =>
                  import('./pages/dns/monitor-targets/monitor-targets').then(
                    (m) => m.DnsMonitorTargetsPage,
                  ),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.monitorTargets' },
              },
              {
                path: 'dns/monitor-agents',
                loadComponent: () =>
                  import('./pages/dns/monitor-agents/monitor-agents').then(
                    (m) => m.DnsMonitorAgentsPage,
                  ),
                title: 'DNS',
                data: { scope: 'master', breadcrumb: 'dns.monitorAgents' },
              },
              {
                path: 'website/parameters',
                loadComponent: () =>
                  import('./pages/website/parameters/parameters').then(
                    (m) => m.WebsiteParametersPage,
                  ),
                title: 'Website',
                data: { scope: 'master', breadcrumb: 'website.parameters' },
              },
              {
                path: 'hosting/webhost',
                title: 'System Webhost | mnscloud',
                data: { scope: 'master', context: 'system' },
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/dashboard/dashboard').then(
                        (m) => m.HostingWebhostDashboardPage,
                      ),
                    title: 'System Webhost Dashboard | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'providers',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/providers/providers').then(
                        (m) => m.HostingWebhostProvidersPage,
                      ),
                    title: 'System Webhost Providers | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'plans',
                    loadComponent: () =>
                      import('./pages/hosting/webhost/plans/plans').then(
                        (m) => m.HostingWebhostPlansPage,
                      ),
                    title: 'System Webhost Plans | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                ],
              },
              { path: 'pay', pathMatch: 'full', redirectTo: 'pay/bank-partners' },
              {
                path: 'pay/bank-partners',
                loadComponent: () =>
                  import('./pages/system/pay/bank-partners/bank-partners').then(
                    (m) => m.SystemPayBankPartnersPage,
                  ),
                title: 'System • Pay • Bank Partners | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'pay/fee-plans',
                loadComponent: () =>
                  import('./pages/system/pay/fee-plans/fee-plans').then(
                    (m) => m.SystemPayFeePlansPage,
                  ),
                title: 'System • Pay • Fee Plans | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'pay/fee-plan-assignments',
                loadComponent: () =>
                  import('./pages/system/pay/fee-plan-assignments/fee-plan-assignments').then(
                    (m) => m.SystemPayFeePlanAssignmentsPage,
                  ),
                title: 'System • Pay • Fee Plan Assignments | mnscloud',
                data: { scope: 'master', context: 'system' },
              },
              {
                path: 'pay/fee-accruals',
                loadComponent: () =>
                  import('./pages/system/pay/fee-accruals/fee-accruals').then(
                    (m) => m.SystemPayFeeAccrualsPage,
                  ),
                title: 'System • Pay • Postpaid Accruals | mnscloud',
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
                    path: 'instances/:uuid/monitoring',
                    loadComponent: () =>
                      import('./pages/hosting/vps/instances/instance-monitor').then(
                        (m) => m.VpsInstanceMonitorPage,
                      ),
                    title: 'System VPS Monitoring | mnscloud',
                    data: {
                      scope: 'master',
                      context: 'system',
                      breadcrumb: 'VPS instance monitoring',
                    },
                  },
                  {
                    path: 'snapshots',
                    loadComponent: () =>
                      import('./pages/hosting/vps/snapshots/snapshots').then(
                        (m) => m.HostingVpsSnapshotsPage,
                      ),
                    title: 'System VPS Snapshots | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'networks',
                    loadComponent: () =>
                      import('./pages/hosting/vps/networks/networks').then(
                        (m) => m.HostingVpsNetworksPage,
                      ),
                    title: 'System VPS Networks | mnscloud',
                    data: { scope: 'master', context: 'system' },
                  },
                  {
                    path: 'firewalls',
                    loadComponent: () =>
                      import('./pages/hosting/vps/firewalls/firewalls').then(
                        (m) => m.HostingVpsFirewallsPage,
                      ),
                    title: 'System VPS Firewalls | mnscloud',
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
