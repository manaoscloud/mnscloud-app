import {
  ERP_FIELD_SLOTS,
  erpConnectionPayload,
  erpFieldSlot,
  erpFieldsPayload,
  erpPolicyPayload,
  erpSlotField,
  erpToolSlotValues,
  setErpCatalog,
  type ErpKind,
  type ErpKindField,
  type ErpToolInfo,
} from './erp-connections';

const tool = (name: string, extra: Partial<ErpToolInfo> = {}): ErpToolInfo => ({
  tool: name,
  label: name,
  class: 'read',
  minIdentity: 0,
  consequential: false,
  highRisk: false,
  base: false,
  ...extra,
});

const TOOLS = [
  tool('list_plans'),
  tool('list_contracts', { minIdentity: 2 }),
  tool('request_trust_unblock', {
    class: 'write',
    minIdentity: 2,
    consequential: true,
    highRisk: true,
  }),
];

const field = (key: string, secret: boolean): ErpKindField => ({
  key,
  label: key,
  type: secret ? 'password' : 'text',
  required: true,
  secret,
});

const kindOf = (kind: string, fields: ErpKindField[]): ErpKind => ({
  kind,
  label: kind.toUpperCase(),
  homologated: kind === 'ixc',
  fields,
  capabilities: [],
});

const KINDS: ErpKind[] = [
  kindOf('ixc', [field('user', false), field('token', true)]),
  kindOf('sgp', []),
];

describe('ERP integrations form', () => {
  beforeEach(() => setErpCatalog(KINDS, TOOLS));

  it('shows the fields of the selected kind, slot by slot', () => {
    expect(erpSlotField({ kind: 'ixc' }, 1)?.key).toBe('token');
    expect(erpSlotField({ kind: 'sgp' }, 0)).toBeUndefined();
    expect(ERP_FIELD_SLOTS).toBeGreaterThanOrEqual(2);
  });

  it('requires secret fields only when creating', () => {
    const user = erpFieldSlot(0);
    const token = erpFieldSlot(1);
    const create = { values: { kind: 'ixc' }, editing: false };
    const edit = { values: { kind: 'ixc' }, editing: true };
    expect(user.requiredWhen?.(edit)).toBeTrue();
    expect(token.requiredWhen?.(create)).toBeTrue();
    expect(token.requiredWhen?.(edit)).toBeFalse();
    expect(token.typeWhen?.(create)).toBe('password');
    expect(erpFieldSlot(5).hiddenWhen?.(create)).toBeTrue();
  });

  it('omits blank fields, so a blank secret keeps the stored one on edit', () => {
    expect(erpFieldsPayload({ kind: 'ixc', erpField0: ' admin ', erpField1: '' })).toEqual({
      user: 'admin',
    });
    const edit = erpConnectionPayload({ kind: 'ixc', name: 'X', revision: 3 }, true);
    expect('Fields' in edit).toBeFalse();
    expect(edit['CecRevision']).toBe(3);
    expect('CecKind' in edit).toBeFalse();
  });

  it('sends Fields, the kind and the policy on create', () => {
    const payload = erpConnectionPayload(
      {
        kind: 'ixc',
        name: 'ERP',
        baseUrl: ' https://erp.example.com ',
        erpField0: 'admin',
        erpField1: 'secret',
        status: 1,
        reachMode: 'public',
        timeoutMs: 8000,
      },
      false,
    );
    expect(payload['CecKind']).toBe('ixc');
    expect(payload['CecBaseUrl']).toBe('https://erp.example.com');
    expect(payload['Fields']).toEqual({ user: 'admin', token: 'secret' });
    expect(payload['CecTimeoutMs']).toBe(8000);
    expect(payload['CecPolicy']).toBeDefined();
  });

  it('starts reads enabled and writes disabled', () => {
    const values = erpToolSlotValues(null);
    expect(values['erpTool0']).toBe(1);
    expect(values['erpTool2']).toBe(0);
    expect(values['erpToolHuman2']).toBe(0);
  });

  it('builds the policy and never lowers the identity level below the catalog', () => {
    const policy = erpPolicyPayload({
      storedPolicy: JSON.stringify({ tools: { list_contracts: { minIdentity: 0 } } }),
      erpTool0: 1,
      erpTool1: 1,
      erpTool2: 1,
      erpToolHuman2: 1,
    }) as { tools: Record<string, Record<string, unknown>> };
    expect(policy.tools['list_contracts']['minIdentity']).toBe(2);
    expect(policy.tools['request_trust_unblock']).toEqual({
      enabled: true,
      minIdentity: 2,
      requireConfirmation: true,
      requireHuman: true,
    });
    expect(policy.tools['list_plans']['requireHuman']).toBe(false);
  });

  it('keeps the stored identity level when it is stricter', () => {
    const policy = erpPolicyPayload({
      storedPolicy: JSON.stringify({ tools: { list_plans: { minIdentity: 1 } } }),
    }) as { tools: Record<string, Record<string, unknown>> };
    expect(policy.tools['list_plans']['minIdentity']).toBe(1);
  });
});
