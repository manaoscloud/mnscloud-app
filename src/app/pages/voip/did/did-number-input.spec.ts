import { DID_RANGE_MAX, parseDidNumberInput } from './did-number-input';

describe('DID number or range input', () => {
  it('reads a single number, also when it is formatted with a hyphen', () => {
    expect(parseDidNumberInput('559230423000')).toEqual({ kind: 'single', number: '559230423000' });
    expect(parseDidNumberInput('+55 (92) 3042-3000')).toEqual({
      kind: 'single',
      number: '559230423000',
    });
    expect(parseDidNumberInput('  ')).toEqual({ kind: 'empty' });
  });

  it('detects a range from two full numbers', () => {
    const range = { kind: 'range', start: '559230423000', end: '559230423049', total: 50 } as const;
    expect(parseDidNumberInput('559230423000-559230423049')).toEqual(range);
    expect(parseDidNumberInput('559230423000 – 559230423049')).toEqual(range);
    expect(parseDidNumberInput('559230423000..559230423049')).toEqual(range);
    expect(parseDidNumberInput('559230423000 até 559230423049')).toEqual(range);
    expect(parseDidNumberInput('559230423000 to 559230423049')).toEqual(range);
    expect(parseDidNumberInput('55 92 3042-3000 - 55 92 3042-3049')).toEqual(range);
  });

  it('treats a range of one number as that number', () => {
    expect(parseDidNumberInput('559230423000-559230423000')).toEqual({
      kind: 'single',
      number: '559230423000',
    });
  });

  it('rejects unsafe ranges with a reason', () => {
    expect(parseDidNumberInput('559230423000-55923042300')).toEqual({
      kind: 'invalid',
      reason: 'sameLength',
    });
    expect(parseDidNumberInput('559230423049-559230423000')).toEqual({
      kind: 'invalid',
      reason: 'order',
    });
    expect(parseDidNumberInput(`559230423000-${559230423000 + DID_RANGE_MAX}`)).toEqual({
      kind: 'invalid',
      reason: 'maxSize',
    });
    expect(parseDidNumberInput('0123')).toEqual({ kind: 'invalid', reason: 'format' });
  });
});
