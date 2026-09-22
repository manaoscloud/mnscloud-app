import { readSecretInventory, readTotal, secretRecords, stateCounts } from './dashboard-model';

describe('Secrets dashboard metadata contract', () => {
  const row = {
    CstUUID: 'secret-1',
    CstName: 'Example secret',
    CstStatus: 1,
    CstVaultVersion: 2,
    CstExpiresAt: null,
    SecretAccountName: 'Example account',
    ValidityState: 'none',
    ValueState: 'success',
  };
  const response = (items: unknown[], total = items.length) => ({ data: { items, total } });
  it('uses the authorized server total rather than the bounded sample length', () => {
    expect(readSecretInventory(response([row], 450)).total).toBe(450);
    expect(readTotal(response([row], 450))).toBe(450);
  });
  it('rejects malformed data and does not turn unavailable totals into zero', () => {
    for (const invalid of [
      null,
      {},
      { data: [] },
      { data: { items: [] } },
      response([], -1),
      response([row], 0),
    ]) {
      expect(() => readSecretInventory(invalid)).toThrow();
    }
    expect(() => readSecretInventory(response(Array(101).fill(row)))).toThrow();
  });
  it('projects metadata without retaining secret contents or arbitrary fields', () => {
    const result = readSecretInventory(
      response([{ ...row, content: 'must-not-retain', CstNotes: 'private note' }]),
    );
    expect(JSON.stringify(result)).not.toContain('must-not-retain');
    expect(JSON.stringify(result)).not.toContain('private note');
  });
  it('keeps missing and new states separate from successful operations', () => {
    const items = readSecretInventory(
      response([
        { ...row, ValueState: null },
        { ...row, CstUUID: 'secret-2', ValueState: 'future-state' },
      ]),
    ).items;
    expect(stateCounts(items, 'ValueState').find((x) => x.label === 'Completed')?.value).toBe(0);
    expect(
      stateCounts(items, 'ValueState').find((x) => x.label === 'secretsDashboard.unavailableState')
        ?.value,
    ).toBe(2);
  });
  it('prioritizes failures over expiry and caps attention records', () => {
    const items = readSecretInventory(
      response([
        { ...row, CstUUID: 'expired', ValidityState: 'expired' },
        ...Array.from({ length: 8 }, (_, i) => ({
          ...row,
          CstUUID: `failed-${i}`,
          ValueState: 'failed',
        })),
      ]),
    ).items;
    const records = secretRecords(items);
    expect(records.length).toBe(6);
    expect(records[0].status).toBe('Failed');
    expect(records[0].details.find((x) => x.label === 'Expires at')?.format).toBe('datetime');
  });
  it('accepts a confirmed empty inventory', () => {
    expect(readSecretInventory(response([]))).toEqual({ items: [], total: 0 });
  });
});
