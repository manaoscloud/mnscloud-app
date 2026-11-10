import {
  collectStatusTone,
  credentialPayload,
  deviceActions,
  deviceFields,
  deviceFindingsCollection,
  deviceFindingView,
  deviceForm,
  devicePayload,
  vendorOptions,
} from './cyber-network';

const t = (key: string) => `t:${key}`;

const device = {
  deviceUUID: 'D-1',
  name: 'Edge firewall',
  address: '192.168.88.1',
  port: 161,
  snmpVersion: 'v2c',
  agentUUID: 'A-1',
  agentSupported: true,
  collectPending: false,
  lastCollectedAt: '2026-11-10T12:00:00Z',
  revision: 3,
};

describe('Cyber Security network devices', () => {
  it('sends a v2c community on create and keeps the stored credential on an empty edit', () => {
    expect(
      devicePayload({
        name: 'fw',
        address: ' 192.168.88.1 ',
        port: '1161',
        agentUUID: 'A-1',
        snmpVersion: 'v2c',
        community: 'read-only',
      }),
    ).toEqual({
      name: 'fw',
      address: '192.168.88.1',
      port: 1161,
      agentUUID: 'A-1',
      cyberAccountUUID: null,
      snmpVersion: 'v2c',
      credential: { community: 'read-only' },
    });
    const edit = devicePayload(
      { name: 'fw', address: '192.168.88.1', agentUUID: 'A-1', snmpVersion: 'v2c', community: '' },
      device,
    );
    expect(edit).toEqual({
      name: 'fw',
      address: '192.168.88.1',
      port: 161,
      agentUUID: 'A-1',
      cyberAccountUUID: null,
      snmpVersion: 'v2c',
      revision: 3,
    });
  });

  it('builds the SNMPv3 credential with privacy only when AES is chosen', () => {
    expect(
      credentialPayload(
        {
          snmpVersion: 'v3',
          snmpUser: ' mns ',
          authProtocol: 'sha',
          authPassword: 'authpass1',
          privProtocol: 'aes',
          privPassword: 'privpass1',
        },
        false,
      ),
    ).toEqual({
      user: 'mns',
      authProtocol: 'sha',
      authPassword: 'authpass1',
      privProtocol: 'aes',
      privPassword: 'privpass1',
    });
    expect(
      credentialPayload(
        { snmpVersion: 'v3', snmpUser: 'mns', authPassword: 'authpass1', privProtocol: 'none' },
        false,
      ),
    ).toEqual({
      user: 'mns',
      authProtocol: 'sha256',
      authPassword: 'authpass1',
      privProtocol: 'none',
    });
    // Same version, no secret typed: keep. A version change needs a new credential.
    expect(credentialPayload({ snmpVersion: 'v3', storedSnmpVersion: 'v3' }, true)).toBeNull();
    expect(credentialPayload({ snmpVersion: 'v3', storedSnmpVersion: 'v2c' }, true)).not.toBeNull();
  });

  it('shows only the credential fields of the chosen SNMP version', () => {
    const fields = deviceFields(false);
    const visible = (values: Record<string, unknown>) =>
      fields
        .filter((f) => !(f.hiddenWhen?.({ editing: false, values }) ?? false))
        .map((f) => f.key);
    expect(visible({ snmpVersion: 'v2c' })).toContain('community');
    expect(visible({ snmpVersion: 'v2c' })).not.toContain('authPassword');
    expect(visible({ snmpVersion: 'v3', privProtocol: 'aes' })).toEqual(
      jasmine.arrayContaining([
        'snmpUser',
        'authProtocol',
        'authPassword',
        'privProtocol',
        'privPassword',
      ]),
    );
    expect(visible({ snmpVersion: 'v3', privProtocol: 'none' })).not.toContain('privPassword');
    expect(fields.find((f) => f.key === 'community')?.type).toBe('password');
    expect(deviceFields(true).find((f) => f.key === 'community')?.help).toBe(
      'cyberSecurity.network.keepSecretHelp',
    );
  });

  it('offers findings, collect now, edit and delete', () => {
    const actions = deviceActions();
    const visible = (row: Record<string, unknown>) =>
      actions.filter((a) => a.visible?.(row) ?? true).map((a) => a.key);
    expect(visible(device)).toEqual([
      'networkFindings',
      'networkCollect',
      'networkEdit',
      'networkDelete',
    ]);
    expect(visible({ ...device, lastCollectedAt: null, collectPending: true })).toEqual([
      'networkEdit',
      'networkDelete',
    ]);
    const collect = actions.find((a) => a.key === 'networkCollect');
    expect(collect?.request?.endpoint(device)).toBe('cyber-security/network-devices/D-1/collect');
    expect(collect?.disabledReason?.({ ...device, agentSupported: false })).toBe(
      'cyberSecurity.network.agentOutdated',
    );
    const remove = actions.find((a) => a.key === 'networkDelete');
    expect(remove?.request?.body?.(device)).toEqual({ revision: 3 });
    expect(deviceForm(device).endpoint).toBe('cyber-security/network-devices/D-1');
    expect(deviceFindingsCollection(() => undefined, device).endpoint).toBe(
      'cyber-security/network-devices/findings?status=all&deviceUUID=D-1',
    );
    expect(deviceFindingsCollection(() => undefined).endpoint).toBe(
      'cyber-security/network-devices/findings',
    );
  });

  it('explains a finding with the fixed release and the KEV notice', () => {
    const view = deviceFindingView(
      {
        code: 'CVE-2024-21762',
        deviceName: 'Edge firewall',
        summary: 'Out-of-bounds write in sslvpnd',
        priority: 'P0',
        firmwareVersion: '7.2.5',
        fixedVersion: '7.2.7',
        cvssScore: 9.8,
        kev: true,
      },
      t,
    );
    expect(view.title).toBe('CVE-2024-21762');
    expect(view.sections?.[1].message).toContain('t:cyberSecurity.network.kevNotice');
    expect(view.sections?.[2].message).toBe('t:cyberSecurity.network.adviceFixed');
    expect(vendorOptions.map((o) => o.value)).toContain('mikrotik_routeros');
    expect([
      collectStatusTone('success'),
      collectStatusTone('failed'),
      collectStatusTone(null),
    ]).toEqual(['chip-success', 'chip-failed', 'chip-skipped']);
  });
});
