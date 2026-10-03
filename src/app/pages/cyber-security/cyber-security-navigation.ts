/** Navigation-only groups. Existing tenant/master URLs and API contracts stay canonical. */
const sections: Record<string, { label: string; group?: string }> = {
  '': { label: 'Overview' },
  servers: { label: 'Servers', group: 'Protection' },
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
