import { parseAmount, parseInvoiceLines } from './utilities';

describe('InfraGIS pole invoice lines', () => {
  it('reads pt-BR and en amounts', () => {
    expect(parseAmount('6,50')).toBe(6.5);
    expect(parseAmount('R$ 1.234,50')).toBe(1234.5);
    expect(parseAmount('6.50')).toBe(6.5);
    expect(parseAmount('')).toBe(0);
    expect(Number.isNaN(parseAmount('abc'))).toBeTrue();
  });

  it('parses pasted lines, skipping a header and empty lines', () => {
    const text = 'placa;pontos;valor\nPL-001;1;6,50\n\nPL-002\t2\t13,00\nPL-003,1,6.50\nPL-004';
    expect(parseInvoiceLines(text)).toEqual([
      { poleCode: 'PL-001', points: 1, amount: 6.5 },
      { poleCode: 'PL-002', points: 2, amount: 13 },
      { poleCode: 'PL-003', points: 1, amount: 6.5 },
      { poleCode: 'PL-004', points: 1, amount: 0 },
    ]);
  });
});
