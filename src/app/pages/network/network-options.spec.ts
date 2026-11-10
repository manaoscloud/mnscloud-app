import {
  ACCESS_METHOD_OPTIONS,
  NetworkDeviceType,
  accessFieldChange,
  accessMethodsFor,
  accessPayload,
  networkBase,
} from './network-options';

const ROUTEROS: NetworkDeviceType = {
  code: 'mikrotik_routeros',
  label: 'network.vendorType',
  versions: ['6', '7'],
  automation: 'REST API (HTTPS)',
  deviceClasses: ['router'],
  access: { methods: ['ssh', 'routeros_api', 'https_api', 'snmp_ro'] },
  versionAccess: { '6': { methods: ['ssh', 'routeros_api', 'snmp_ro'] } },
  roles: [],
};

const values = (options: readonly { value: unknown }[]) => options.map((option) => option.value);

describe('Network options', () => {
  it('picks the endpoint from the route scope only', () => {
    expect(networkBase(false)).toBe('network');
    expect(networkBase(true)).toBe('system/network');
  });

  it('offers the access methods of the type and of its major OS version', () => {
    expect(values(accessMethodsFor(ROUTEROS, '7.16.2'))).toEqual([
      'ssh',
      'routeros_api',
      'https_api',
      'snmp_ro',
    ]);
    expect(values(accessMethodsFor(ROUTEROS, 'v6.49'))).toEqual(['ssh', 'routeros_api', 'snmp_ro']);
    // Without a version every method of the type is offered, as the API accepts.
    expect(values(accessMethodsFor(ROUTEROS, ''))).toContain('https_api');
    expect(accessMethodsFor(undefined, '')).toBe(ACCESS_METHOD_OPTIONS);
  });

  it('fills the default port only while the port is empty or still a default', () => {
    expect(
      accessFieldChange('method', 'routeros_api', { method: 'routeros_api', port: 22 }),
    ).toEqual({ method: 'routeros_api', port: 8729 });
    expect(accessFieldChange('method', 'ssh', { method: 'ssh', port: '' })['port']).toBe(22);
    expect(accessFieldChange('method', 'ssh', { method: 'ssh', port: 2222 })['port']).toBe(2222);
    expect(accessFieldChange('host', 'x', { method: 'ssh', port: 23 })['port']).toBe(23);
  });

  it('sends the whole access form with the revision and never a credential', () => {
    expect(
      accessPayload({
        method: 'ssh',
        port: '',
        host: ' ',
        isPrimary: 1,
        notes: '',
        status: 1,
        revision: '3',
      }),
    ).toEqual({
      method: 'ssh',
      port: null,
      host: null,
      isPrimary: 1,
      notes: null,
      status: 1,
      revision: '3',
    });
    expect(accessPayload({ method: 'telnet', port: '23', status: 0 })).toEqual({
      method: 'telnet',
      port: 23,
      host: null,
      isPrimary: 0,
      notes: null,
      status: 0,
    });
  });
});
