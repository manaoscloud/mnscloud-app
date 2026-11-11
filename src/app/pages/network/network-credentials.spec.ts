import {
  CREDENTIAL_VALUE_KEYS,
  credentialBusy,
  credentialDisplayState,
  credentialErrorKey,
  credentialInitialValues,
  credentialPayload,
  credentialStateChip,
} from './network-credentials';

const form = (values: Record<string, unknown>) => ({ ...credentialInitialValues(), ...values });

describe('Network credentials', () => {
  it('creates a password credential with expectedVersion 0 and only its value field', () => {
    expect(
      credentialPayload(
        form({ kind: 'password', username: ' admin ', password: ' s3cret ' }),
        false,
      ),
    ).toEqual({
      kind: 'password',
      expectedVersion: 0,
      accessUUID: null,
      isPrimary: 0,
      notes: null,
      username: 'admin',
      password: ' s3cret ',
    });
  });

  it('generates SSH keys by default and imports only on request', () => {
    const generated = credentialPayload(form({ kind: 'ssh_key', username: 'ops' }), false);
    expect(generated['mode']).toBe('generate');
    expect('privateKey' in generated).toBeFalse();
    const imported = credentialPayload(
      form({ kind: 'ssh_key', username: 'ops', mode: 'import', privateKey: 'KEY' }),
      false,
    );
    expect(imported['mode']).toBe('import');
    expect(imported['privateKey']).toBe('KEY');
  });

  it('never sends a username for kinds without one', () => {
    for (const kind of ['enable_password', 'snmp_v2c']) {
      const payload = credentialPayload(form({ kind, username: 'ignored', community: 'c' }), false);
      expect('username' in payload)
        .withContext(kind)
        .toBeFalse();
    }
  });

  it('sends SNMPv3 privacy only with a privacy protocol', () => {
    const base = {
      kind: 'snmp_v3',
      username: 'u',
      authProtocol: 'sha256',
      authPassword: '12345678',
    };
    const withoutPrivacy = credentialPayload(form({ ...base, privProtocol: '' }), false);
    expect('privProtocol' in withoutPrivacy).toBeFalse();
    expect('privPassword' in withoutPrivacy).toBeFalse();
    const withPrivacy = credentialPayload(
      form({ ...base, privProtocol: 'aes', privPassword: 'abcdefgh' }),
      false,
    );
    expect(withPrivacy['privProtocol']).toBe('aes');
    expect(withPrivacy['privPassword']).toBe('abcdefgh');
  });

  it('edits metadata without any value field or version', () => {
    const payload = credentialPayload(
      form({
        kind: 'password',
        username: 'admin',
        valueMode: 'keep',
        password: 'typed',
        revision: 7,
        vaultVersion: 2,
      }),
      true,
    );
    expect(payload['revision']).toBe('7');
    expect('kind' in payload).toBeFalse();
    expect('expectedVersion' in payload).toBeFalse();
    expect(CREDENTIAL_VALUE_KEYS.some((key) => key in payload)).toBeFalse();
  });

  it('replaces the value against the stored version', () => {
    const payload = credentialPayload(
      form({ kind: 'api_token', valueMode: 'replace', token: 'T', revision: '3', vaultVersion: 2 }),
      true,
    );
    expect(payload['expectedVersion']).toBe(2);
    expect(payload['token']).toBe('T');
    expect('kind' in payload).toBeFalse();
  });

  it('shows the operation state over the stored state', () => {
    expect(credentialDisplayState({ NwcState: 'stored', OperationState: 'success' })).toBe(
      'stored',
    );
    expect(credentialDisplayState({ NwcState: 'stored', OperationState: 'running' })).toBe(
      'processing',
    );
    expect(credentialDisplayState({ NwcState: 'stored', OperationState: 'failed' })).toBe('failed');
    expect(credentialDisplayState({ NwcState: 'deleting', OperationState: 'queued' })).toBe(
      'deleting',
    );
    expect(credentialStateChip({ NwcState: 'stored' })).toBe('chip-success');
    expect(credentialStateChip({ NwcState: 'pending', OperationState: 'failed' })).toBe(
      'chip-failed',
    );
    expect(credentialBusy({ NwcState: 'stored', OperationState: 'retry' })).toBeTrue();
    expect(credentialBusy({ NwcState: 'failed', OperationState: 'failed' })).toBeFalse();
  });

  it('maps API codes to messages, vault codes included', () => {
    const error = (code: string) => ({ error: { code } });
    expect(credentialErrorKey(error('REMOTE_ACCESS_VAULT_NOT_ENROLLED'))).toBe(
      'network.credentialError.vaultNotEnrolled',
    );
    expect(credentialErrorKey(error('VAULT_SEALED'))).toBe(
      'network.credentialError.vaultUnavailable',
    );
    expect(credentialErrorKey(error('NETWORK_REVISION_CONFLICT'))).toBe(
      'network.credentialError.revisionConflict',
    );
    expect(credentialErrorKey(error('VALIDATION_FAILED'))).toBeNull();
    expect(credentialErrorKey(null)).toBeNull();
  });
});
