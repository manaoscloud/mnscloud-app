import type { CanActivateFn, Route, Routes } from '@angular/router';

/** Navigation-only groups. Existing tenant/master URLs and API contracts stay canonical. */
const sections: Record<string, { label: string; group?: string }> = {
  '': { label: 'Overview' },
  accounts: { label: 'Customer accounts' },
  vulnerabilities: { label: 'Vulnerabilities', group: 'Threats and Events' },
  servers: { label: 'Servers', group: 'Protection' },
  inventory: { label: 'Software inventory', group: 'Protection' },
  patches: { label: 'Security updates', group: 'Protection' },
  exposure: { label: 'External exposure', group: 'Protection' },
  hardening: { label: 'Hardening and antivirus', group: 'Protection' },
  network: { label: 'Network devices', group: 'Protection' },
  profiles: { label: 'Security Profiles', group: 'Protection' },
  services: { label: 'Protected Services', group: 'Protection' },
  lists: { label: 'Allowlist / Blocklist', group: 'Protection' },
  alerts: { label: 'Alerts', group: 'Threats and Events' },
  decisions: { label: 'Protection Decisions', group: 'Threats and Events' },
  'security-events': { label: 'Security Events', group: 'Threats and Events' },
  'trusted-nodes': { label: 'Trusted Nodes', group: 'Access Control' },
  'network-policies': { label: 'API Access Policies', group: 'Access Control' },
  'secrets/dashboard': { label: 'Overview', group: 'Secrets' },
  secrets: { label: 'Secrets', group: 'Secrets' },
  'secret-accounts': { label: 'Secret Accounts', group: 'Secrets' },
  'secret-servers': { label: 'Secret Servers', group: 'Secrets' },
};

/**
 * `tenant`: the selected tenant; `master`: the System area; `delegated`: the platform servers for a
 * user with platform.cyber-security.read/.manage who is not a master (`/cyber-security/platform`).
 * A delegated page is a platform page (scope `master`, no account column) whose API calls carry
 * `scope=platform` (ApiService, data.apiScope).
 */
export type CyberRouteScope = 'tenant' | 'master' | 'delegated';

const BASES: Record<CyberRouteScope, string> = {
  tenant: '/cyber-security',
  master: '/system/cyber-security',
  delegated: '/cyber-security/platform',
};

export function cyberSecurityRouteData(section: string, scope: CyberRouteScope) {
  const item = sections[section];
  const base = BASES[scope];
  return {
    scope: scope === 'tenant' ? 'tenant' : 'master',
    ...(scope === 'delegated' ? { apiScope: 'platform', cyberBase: base } : {}),
    section,
    breadcrumbTrail: [
      ...(scope === 'master' ? [{ label: 'System', url: '/system' }] : []),
      { label: 'Cyber Security', url: scope === 'delegated' ? '/cyber-security' : base },
      ...(scope === 'delegated' ? [{ label: 'Platform', url: base }] : []),
      ...(item.group ? [{ label: item.group }] : []),
      { label: item.label, url: section ? `${base}/${section}` : base },
    ],
  };
}

/** Sections served by the generic Cyber Security page; platform: also in the System area. */
const SECTION_PAGES: { section: string; title: string; platform?: boolean }[] = [
  { section: 'servers', title: 'Servers', platform: true },
  { section: 'alerts', title: 'Alerts', platform: true },
  { section: 'decisions', title: 'Protection Decisions', platform: true },
  { section: 'lists', title: 'Allowlist / Blocklist', platform: true },
  { section: 'security-events', title: 'Security Events', platform: true },
  { section: 'vulnerabilities', title: 'Vulnerabilities', platform: true },
  { section: 'inventory', title: 'Software inventory', platform: true },
  { section: 'patches', title: 'Security updates', platform: true },
  { section: 'exposure', title: 'External exposure', platform: true },
  { section: 'hardening', title: 'Hardening and antivirus', platform: true },
  { section: 'network', title: 'Network devices', platform: true },
];

export function cyberSecuritySectionRoutes(scope: CyberRouteScope): Routes {
  return SECTION_PAGES.filter((page) => scope === 'tenant' || page.platform).map(
    ({ section, title }) => ({
      path: `${BASES[scope].slice(scope === 'master' ? '/system/'.length : 1)}/${section}`,
      loadComponent: () => import('./cyber-security').then((m) => m.CyberSecurityPage),
      title: `Cyber Security • ${title} | mnscloud`,
      data: cyberSecurityRouteData(section, scope),
    }),
  );
}

/**
 * Pages of the delegated platform scope (no secrets). The guard lets in only users the API marks
 * with resourceAccess.cyberPlatform (or masters); every request is authorized again by the API.
 */
export function cyberSecurityDelegatedRoutes(guard: CanActivateFn): Routes {
  const page = (section: string, title: string, loadComponent: Route['loadComponent']): Route => ({
    path: section ? `cyber-security/platform/${section}` : 'cyber-security/platform',
    canActivate: [guard],
    loadComponent,
    title: `Cyber Security • Platform${title ? ' • ' + title : ''} | mnscloud`,
    data: cyberSecurityRouteData(section, 'delegated'),
  });
  return [
    page('', '', () => import('./dashboard/dashboard').then((m) => m.CyberSecurityDashboardPage)),
    page('services', 'Protected Services', () =>
      import('./services/services').then((m) => m.CyberSecurityServicesPage),
    ),
    page('profiles', 'Security Profiles', () =>
      import('./profiles/profiles').then((m) => m.CyberSecurityProfilesPage),
    ),
    page('trusted-nodes', 'Trusted Nodes', () =>
      import('./trusted-nodes/trusted-nodes').then((m) => m.CyberSecurityTrustedNodesPage),
    ),
    page('network-policies', 'API Access Policies', () =>
      import('./network-policies/network-policies').then((m) => m.CyberSecurityNetworkPoliciesPage),
    ),
    ...cyberSecuritySectionRoutes('delegated').map((route) => ({ ...route, canActivate: [guard] })),
  ];
}
