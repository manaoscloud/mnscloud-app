import type {
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type { VpsNetworkProfile, VpsPlatformNetwork } from './vps.types';

export const PLATFORM_NETWORK_IPV6_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'auto', label: 'Automatic (SLAAC)' },
  { value: 'none', label: 'Disabled' },
];

export const PLATFORM_NETWORK_HELP =
  'Network of the servers of the platform (DNS, API, database...) created by the master. Customers never see it. Choose No to remove it.';
export const PLATFORM_NETWORK_RANGE_HELP =
  'Reserved range of addresses the platform hands to its own servers. Keep it outside the DHCP and customer ranges.';
export const PLATFORM_NETWORK_NAMESERVERS_HELP = 'Up to 3 DNS resolvers, comma separated.';

export const NETWORK_PROFILE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'infrastructure', label: 'Platform infrastructure' },
  { value: 'isolated', label: 'Isolated' },
];
export const NETWORK_PROFILE_HELP =
  'Platform infrastructure: the server joins the platform network of the provider. Isolated: it gets its own private network.';

export const PLATFORM_NETWORK_DEFAULT_VALUES: Record<string, string | number> = {
  platformNetworkEnabled: 0,
  platformNetworkBridge: '',
  platformNetworkVlan: '',
  platformNetworkCidr: '',
  platformNetworkGateway: '',
  platformNetworkRangeStart: '',
  platformNetworkRangeEnd: '',
  platformNetworkNameservers: '',
  platformNetworkIpv6: 'auto',
};

const IPV4 = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/;
const IPV4_CIDR = /^[0-9]{1,3}(\.[0-9]{1,3}){3}\/([0-9]|[12][0-9]|3[0-2])$/;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function nameserverList(value: unknown): string[] {
  return text(value)
    .split(/[\s,]+/)
    .filter(Boolean);
}

/** Form values of the stored platform network (defaults, disabled, when absent). */
export function platformNetworkFormValues(
  network: VpsPlatformNetwork | null | undefined,
): ConfigurableCrudRecord {
  if (!network) return { ...PLATFORM_NETWORK_DEFAULT_VALUES };
  return {
    platformNetworkEnabled: 1,
    platformNetworkBridge: network.bridge ?? '',
    platformNetworkVlan: network.vlanTag ?? '',
    platformNetworkCidr: network.cidr ?? '',
    platformNetworkGateway: network.gateway ?? '',
    platformNetworkRangeStart: network.allocationStart ?? '',
    platformNetworkRangeEnd: network.allocationEnd ?? '',
    platformNetworkNameservers: network.nameservers?.join(', ') ?? '',
    platformNetworkIpv6: network.ipv6 === 'none' ? 'none' : 'auto',
  };
}

export function platformNetworkEnabled(values: ConfigurableCrudRecord): boolean {
  const value = values['platformNetworkEnabled'];
  return value === 1 || value === '1' || value === true || value === 'true';
}

/** Payload of config.platformNetwork: the object, or null to remove it. */
export function buildPlatformNetworkPayload(
  values: ConfigurableCrudRecord,
): VpsPlatformNetwork | null {
  if (!platformNetworkEnabled(values)) return null;
  const vlan = text(values['platformNetworkVlan']);
  return {
    bridge: text(values['platformNetworkBridge']),
    ...(vlan ? { vlanTag: Number(vlan) } : {}),
    cidr: text(values['platformNetworkCidr']),
    gateway: text(values['platformNetworkGateway']),
    allocationStart: text(values['platformNetworkRangeStart']),
    allocationEnd: text(values['platformNetworkRangeEnd']),
    nameservers: nameserverList(values['platformNetworkNameservers']),
    ipv6: values['platformNetworkIpv6'] === 'none' ? 'none' : 'auto',
  };
}

/** First invalid field of the platform network form, or null. */
export function platformNetworkError(
  values: ConfigurableCrudRecord,
): { key: string; message: string } | null {
  if (!platformNetworkEnabled(values)) return null;
  if (!text(values['platformNetworkBridge'])) {
    return { key: 'platformNetworkBridge', message: 'Enter the bridge.' };
  }
  const vlan = text(values['platformNetworkVlan']);
  if (vlan && !(Number.isInteger(Number(vlan)) && Number(vlan) >= 1 && Number(vlan) <= 4094)) {
    return { key: 'platformNetworkVlan', message: 'Enter a VLAN tag between 1 and 4094.' };
  }
  if (!IPV4_CIDR.test(text(values['platformNetworkCidr']))) {
    return { key: 'platformNetworkCidr', message: 'Enter an IPv4 network in CIDR notation.' };
  }
  for (const key of [
    'platformNetworkGateway',
    'platformNetworkRangeStart',
    'platformNetworkRangeEnd',
  ]) {
    if (!IPV4.test(text(values[key]))) return { key, message: 'Enter an IPv4 address.' };
  }
  if (nameserverList(values['platformNetworkNameservers']).length > 3) {
    return { key: 'platformNetworkNameservers', message: 'Enter up to 3 DNS resolvers.' };
  }
  return null;
}

/** networkProfile of a create request: only for an internal VPS (master scope, no customer). */
export function buildNetworkProfile(
  values: ConfigurableCrudRecord,
  platformScope: boolean,
): { networkProfile?: VpsNetworkProfile } {
  if (!platformScope || text(values['customerUUID'])) return {};
  return {
    networkProfile: values['networkProfile'] === 'isolated' ? 'isolated' : 'infrastructure',
  };
}

const NETWORK_ERROR_KEYS: Record<string, string> = {
  VPS_NETWORK_PROFILE_FORBIDDEN: 'Only a server of the platform can choose the network profile.',
  VPS_PLATFORM_NETWORK_NOT_CONFIGURED:
    'The provider has no platform network. Configure it in the provider or choose the Isolated network.',
};

/** Message key of the VPS network API errors, or null for any other error. */
export function vpsNetworkErrorMessage(error: unknown): string | null {
  const body = (error as { error?: { code?: unknown; error?: unknown } } | null)?.error;
  for (const candidate of [body?.code, body?.error]) {
    if (typeof candidate === 'string' && NETWORK_ERROR_KEYS[candidate]) {
      return NETWORK_ERROR_KEYS[candidate];
    }
  }
  return null;
}
