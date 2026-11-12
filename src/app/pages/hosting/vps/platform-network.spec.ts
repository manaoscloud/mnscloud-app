import {
  buildNetworkProfile,
  buildPlatformNetworkPayload,
  platformNetworkError,
  platformNetworkFormValues,
  vpsNetworkErrorMessage,
} from './platform-network';

const FILLED = {
  platformNetworkEnabled: 1,
  platformNetworkBridge: 'vmbr1',
  platformNetworkVlan: '120',
  platformNetworkCidr: '192.0.2.0/24',
  platformNetworkGateway: '192.0.2.1',
  platformNetworkRangeStart: '192.0.2.10',
  platformNetworkRangeEnd: '192.0.2.50',
  platformNetworkNameservers: '192.0.2.2, 192.0.2.3',
  platformNetworkIpv6: 'none',
};

describe('platform network payload', () => {
  it('builds the platformNetwork object', () => {
    expect(buildPlatformNetworkPayload(FILLED)).toEqual({
      bridge: 'vmbr1',
      vlanTag: 120,
      cidr: '192.0.2.0/24',
      gateway: '192.0.2.1',
      allocationStart: '192.0.2.10',
      allocationEnd: '192.0.2.50',
      nameservers: ['192.0.2.2', '192.0.2.3'],
      ipv6: 'none',
    });
  });

  it('omits the VLAN tag when empty and defaults IPv6 to auto', () => {
    const payload = buildPlatformNetworkPayload({
      ...FILLED,
      platformNetworkVlan: '',
      platformNetworkNameservers: '',
      platformNetworkIpv6: 'auto',
    });
    expect(payload).not.toHaveSize(0);
    expect(payload && 'vlanTag' in payload).toBeFalse();
    expect(payload?.nameservers).toEqual([]);
    expect(payload?.ipv6).toBe('auto');
  });

  it('sends null to remove it', () => {
    expect(buildPlatformNetworkPayload({ ...FILLED, platformNetworkEnabled: 0 })).toBeNull();
  });

  it('round-trips through the form values', () => {
    const stored = buildPlatformNetworkPayload(FILLED)!;
    expect(buildPlatformNetworkPayload(platformNetworkFormValues(stored))).toEqual(stored);
    expect(platformNetworkFormValues(null)['platformNetworkEnabled']).toBe(0);
  });

  it('validates the fields only when enabled', () => {
    expect(
      platformNetworkError({ ...FILLED, platformNetworkEnabled: 0, platformNetworkCidr: 'x' }),
    ).toBeNull();
    expect(platformNetworkError(FILLED)).toBeNull();
    expect(platformNetworkError({ ...FILLED, platformNetworkVlan: '5000' })?.key).toBe(
      'platformNetworkVlan',
    );
    expect(platformNetworkError({ ...FILLED, platformNetworkCidr: '192.0.2.0' })?.key).toBe(
      'platformNetworkCidr',
    );
    expect(platformNetworkError({ ...FILLED, platformNetworkGateway: 'gw' })?.key).toBe(
      'platformNetworkGateway',
    );
    expect(
      platformNetworkError({
        ...FILLED,
        platformNetworkNameservers: '1.1.1.1 1.0.0.1 8.8.8.8 9.9.9.9',
      })?.key,
    ).toBe('platformNetworkNameservers');
  });
});

describe('VPS network profile payload', () => {
  it('is sent only for an internal VPS on the platform route', () => {
    expect(buildNetworkProfile({ customerUUID: '', networkProfile: 'isolated' }, true)).toEqual({
      networkProfile: 'isolated',
    });
    expect(buildNetworkProfile({ networkProfile: 'bogus' }, true)).toEqual({
      networkProfile: 'infrastructure',
    });
  });

  it('is not sent for tenant or customer servers', () => {
    expect(buildNetworkProfile({ networkProfile: 'isolated' }, false)).toEqual({});
    expect(buildNetworkProfile({ customerUUID: 'c1', networkProfile: 'isolated' }, true)).toEqual(
      {},
    );
  });
});

describe('VPS network errors', () => {
  it('maps the API codes to a translatable message', () => {
    expect(vpsNetworkErrorMessage({ error: { code: 'VPS_NETWORK_PROFILE_FORBIDDEN' } })).toContain(
      'network profile',
    );
    expect(
      vpsNetworkErrorMessage({ error: { error: 'VPS_PLATFORM_NETWORK_NOT_CONFIGURED' } }),
    ).toContain('platform network');
    expect(vpsNetworkErrorMessage({ error: { code: 'OTHER' } })).toBeNull();
    expect(vpsNetworkErrorMessage(null)).toBeNull();
  });
});
