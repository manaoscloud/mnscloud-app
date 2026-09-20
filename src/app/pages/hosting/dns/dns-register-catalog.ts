export const HOSTING_DNS_REGISTRAR_CODES = [
  'registro_br',
  'godaddy',
  'amazon_route53_domains',
  'namecheap',
  'cloudflare',
  'google_domains_squarespace',
  'hostinger',
  'locaweb',
  'hostgator',
  'hosting',
  'porkbun',
  'dynadot',
  'namesilo',
  'hover',
  'network_solutions',
  'enom',
  'opensrs',
  'ionos',
  'ovh',
  'gandi',
  'name_com',
  'spaceship',
  'dreamhost',
  'bluehost',
  'other',
] as const;

export type HostingDnsRegistrarCode = (typeof HOSTING_DNS_REGISTRAR_CODES)[number];

const REGISTRAR_LABELS: Record<HostingDnsRegistrarCode, string> = {
  registro_br: 'Registro.br',
  godaddy: 'GoDaddy',
  amazon_route53_domains: 'Amazon Route 53 Domains',
  namecheap: 'Namecheap',
  cloudflare: 'Cloudflare',
  google_domains_squarespace: 'Google Domains / Squarespace',
  hostinger: 'Hostinger',
  locaweb: 'Locaweb',
  hostgator: 'HostGator',
  hosting: 'Hosting.com',
  porkbun: 'Porkbun',
  dynadot: 'Dynadot',
  namesilo: 'NameSilo',
  hover: 'Hover',
  network_solutions: 'Network Solutions',
  enom: 'Enom',
  opensrs: 'OpenSRS',
  ionos: 'IONOS',
  ovh: 'OVH',
  gandi: 'Gandi',
  name_com: 'Name.com',
  spaceship: 'Spaceship',
  dreamhost: 'DreamHost',
  bluehost: 'Bluehost',
  other: 'Other',
};

export function hostingDnsRegistrarLabel(code: string | null | undefined): string {
  const normalized = String(code ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return '—';
  const known = REGISTRAR_LABELS[normalized as HostingDnsRegistrarCode];
  if (known) return known;
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function hostingDnsRegistrarCatalogOptions(): { code: HostingDnsRegistrarCode; label: string }[] {
  return HOSTING_DNS_REGISTRAR_CODES.map((code) => ({
    code,
    label: REGISTRAR_LABELS[code],
  }));
}
