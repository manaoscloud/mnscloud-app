import type { Routes } from '@angular/router';

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

export function cyberSecurityRouteData(section: string, scope: 'tenant' | 'master') {
  const item = sections[section];
  const base = `${scope === 'master' ? '/system' : ''}/cyber-security`;
  return {
    scope,
    section,
    breadcrumbTrail: [
      ...(scope === 'master' ? [{ label: 'System', url: '/system' }] : []),
      { label: 'Cyber Security', url: base },
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
  { section: 'patches', title: 'Security updates' },
  { section: 'exposure', title: 'External exposure' },
  { section: 'hardening', title: 'Hardening and antivirus' },
  { section: 'network', title: 'Network devices' },
];

export function cyberSecuritySectionRoutes(scope: 'tenant' | 'master'): Routes {
  return SECTION_PAGES.filter((page) => scope === 'tenant' || page.platform).map(
    ({ section, title }) => ({
      path: `cyber-security/${section}`,
      loadComponent: () => import('./cyber-security').then((m) => m.CyberSecurityPage),
      title: `Cyber Security • ${title} | mnscloud`,
      data: cyberSecurityRouteData(section, scope),
    }),
  );
}
