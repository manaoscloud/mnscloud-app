import {
  CHECK_CODES,
  exposureFindingsCollection,
  exposureFindingView,
  exposureServicesCollection,
  exposureTargetActions,
  exposureTargetForm,
  findingAdvice,
  findingTitle,
  targetFields,
  targetPayload,
} from './cyber-exposure';

const t = (key: string) => `t:${key}`;

describe('Cyber Security external exposure views', () => {
  it('creates a target with the address and the owner authorization as a boolean', () => {
    expect(
      targetPayload({
        address: '200.10.20.16/30',
        label: 'Name',
        cyberAccountUUID: '',
        ownerName: 'Owner Ltd',
        frequency: 'monthly',
        authorize: ['yes'],
      }),
    ).toEqual({
      address: '200.10.20.16/30',
      label: 'Name',
      cyberAccountUUID: null,
      ownerName: 'Owner Ltd',
      frequency: 'monthly',
      authorize: true,
    });
    expect(targetFields(true).map((field) => field.key)).toEqual([
      'address',
      'label',
      'cyberAccountUUID',
      'frequency',
      'ownerName',
      'authorize',
    ]);
    expect(targetFields(true).find((field) => field.key === 'authorize')?.required).toBeTrue();
  });

  it('edits without the address, sends the revision and offers the renewal when expired', () => {
    const form = exposureTargetForm({
      targetUUID: 'a b',
      label: 'Name',
      ownerName: 'Owner',
      revision: 4,
      authorizationValid: false,
    });
    expect(form.endpoint).toBe('cyber-security/exposure/targets/a%20b');
    expect(form.initialValues?.['authorize']).toEqual(['yes']);
    expect(form.fields.some((field) => field.key === 'address')).toBeFalse();
    const body = form.payload?.(
      { label: 'Name', ownerName: 'Owner', authorize: [] },
      true,
    ) as Record<string, unknown>;
    expect(body).toEqual({
      revision: 4,
      label: 'Name',
      cyberAccountUUID: null,
      ownerName: 'Owner',
      frequency: 'weekly',
      authorize: false,
    });
  });

  it('scans only with a valid authorization and deletes with the revision', () => {
    const actions = Object.fromEntries(exposureTargetActions().map((a) => [a.key, a]));
    expect(actions['exposureScan'].disabledReason?.({ authorizationValid: false })).toBe(
      'cyberSecurity.exposure.authorizationExpired',
    );
    expect(actions['exposureScan'].disabledReason?.({ authorizationValid: true })).toBeNull();
    expect(actions['exposureScan'].visible?.({ scanPending: true })).toBeFalse();
    expect(actions['exposureScan'].request?.endpoint({ targetUUID: 't1' })).toBe(
      'cyber-security/exposure/targets/t1/scan',
    );
    expect(actions['exposureDelete'].request?.body?.({ revision: 7 })).toEqual({ revision: 7 });
    expect(actions['exposureFindings'].visible?.({ lastScanAt: null })).toBeFalse();
  });

  it('translates findings by check code and keeps the KEV product name', () => {
    expect(findingTitle({ checkCode: 'port.rdp', title: 'Remote Desktop' }, t)).toBe(
      't:cyberSecurity.exposure.check.port.rdp',
    );
    expect(
      findingTitle(
        {
          checkCode: 'kev.fortinet-ssl-vpn',
          title: 'Fortinet FortiGate SSL VPN exposed to the internet',
        },
        t,
      ),
    ).toBe('Fortinet FortiGate SSL VPN: t:cyberSecurity.exposure.kevExposed');
    expect(findingTitle({ checkCode: 'port.new', title: 'New check' }, t)).toBe('New check');
    expect(findingAdvice({ checkCode: 'port.new', detail: 'Advice' }, t)).toBe('Advice');
    expect(new Set<string>(CHECK_CODES).size).toBe(CHECK_CODES.length as number);
    const view = exposureFindingView(
      {
        checkCode: 'kev.citrix-netscaler',
        title: 'Citrix NetScaler Gateway exposed to the internet',
        priority: 'P1',
        address: '200.10.20.17',
        port: 443,
        status: 'open',
        vulnerabilityCodes: ['CVE-2023-4966'],
      },
      t,
    );
    expect(view.sections?.map((section) => section.title)).toEqual([
      't:cyberSecurity.exposure.summary',
      't:cyberSecurity.exposure.advice',
      't:cyberSecurity.exposure.kevCodes',
    ]);
    expect(view.sections?.[0].message).toContain('200.10.20.17:443');
  });

  it('lists findings and services of one target or of all', () => {
    expect(exposureFindingsCollection(() => undefined).endpoint).toBe(
      'cyber-security/exposure/findings',
    );
    expect(exposureFindingsCollection(() => undefined, { targetUUID: 't1' }).endpoint).toBe(
      'cyber-security/exposure/findings?targetUUID=t1',
    );
    expect(exposureServicesCollection({ targetUUID: 't1', label: 'Name' }).pageTitle).toBe('Name');
  });
});
