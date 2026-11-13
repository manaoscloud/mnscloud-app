import { devicePayload, selectableMgmtVpnAddresses, usesMgmtVpnAddress } from './devices/devices';
import { isGatewaySource, mgmtVpnAddressPayload } from './mgmt-vpn/mgmt-vpn-addresses';
import { gatewayKeyState, mgmtVpnHubPayload } from './mgmt-vpn/mgmt-vpn-hubs';

describe('Management VPN hubs', () => {
  const form = {
    name: ' HUB1 ',
    endpoint: 'vpn.example.net:51820',
    publicKey: '',
    mgmtNet: '10.200.0.0/16',
    gatewayNet: '10.200.255.0/24',
    gatewayUuid: '',
    status: 'disabled',
    notes: '',
    revision: '3',
  };

  it('sends text fields trimmed, empty ones as null and the revision only on update', () => {
    const create = mgmtVpnHubPayload(form, false);
    expect(create).toEqual({
      name: 'HUB1',
      endpoint: 'vpn.example.net:51820',
      publicKey: null,
      mgmtNet: '10.200.0.0/16',
      gatewayNet: '10.200.255.0/24',
      gatewayUuid: null,
      status: 'disabled',
      notes: null,
    });
    expect(mgmtVpnHubPayload(form, true)['revision']).toBe('3');
  });

  it('reads the gateway key state from the row', () => {
    expect(gatewayKeyState({})).toBe('none');
    expect(gatewayKeyState({ AccessGatewayAgwUUID: 'A' })).toBe('pending');
    expect(
      gatewayKeyState({ AccessGatewayAgwUUID: 'A', GatewayKeyReportedAt: '2026-11-13 10:00:00' }),
    ).toBe('reported');
  });
});

describe('Management VPN addresses', () => {
  it('creates with the assignment and updates only device and notes', () => {
    const form = {
      hubUuid: 'H',
      ownerUuid: '',
      address: '10.200.1.10',
      deviceUuid: '',
      notes: 'x',
      revision: '2',
    };
    expect(mgmtVpnAddressPayload(form, false)).toEqual({
      hubUuid: 'H',
      ownerUuid: null,
      address: '10.200.1.10',
      deviceUuid: null,
      notes: 'x',
    });
    expect(mgmtVpnAddressPayload(form, true)).toEqual({
      deviceUuid: null,
      notes: 'x',
      revision: '2',
    });
  });

  it('treats gateway source rows as read-only', () => {
    expect(isGatewaySource({ NvaKind: 'gateway_source' })).toBeTrue();
    expect(isGatewaySource({ NvaKind: 'device' })).toBeFalse();
  });
});

describe('Device form on the management VPN path', () => {
  const addresses = [
    { NvaUUID: '1', NvaAddress: '10.200.1.1', NetworkDeviceNwdUUID: null },
    { NvaUUID: '2', NvaAddress: '10.200.1.2', NetworkDeviceNwdUUID: 'D1' },
    { NvaUUID: '3', NvaAddress: '10.200.1.3', NetworkDeviceNwdUUID: 'D2' },
  ];

  it('offers unbound addresses plus the one bound to the edited device', () => {
    expect(selectableMgmtVpnAddresses(addresses, '').map((a) => a.NvaAddress)).toEqual([
      '10.200.1.1',
    ]);
    expect(selectableMgmtVpnAddresses(addresses, 'D1').map((a) => a.NvaAddress)).toEqual([
      '10.200.1.1',
      '10.200.1.2',
    ]);
  });

  it('uses the address select only for tenant devices on that path', () => {
    expect(usesMgmtVpnAddress(false, { networkPath: 'mgmt_vpn' })).toBeTrue();
    expect(usesMgmtVpnAddress(false, { networkPath: 'public' })).toBeFalse();
    expect(usesMgmtVpnAddress(true, { networkPath: 'mgmt_vpn' })).toBeFalse();
  });

  it('sends the chosen address as management host and the free host elsewhere', () => {
    const values = { managementHost: 'router.example.net', mgmtVpnAddress: '10.200.1.1' };
    expect(devicePayload({ ...values, networkPath: 'mgmt_vpn' })['managementHost']).toBe(
      '10.200.1.1',
    );
    expect(devicePayload({ ...values, networkPath: 'public' })['managementHost']).toBe(
      'router.example.net',
    );
    expect(devicePayload({ ...values, networkPath: 'mgmt_vpn' }, true)['managementHost']).toBe(
      'router.example.net',
    );
  });
});
