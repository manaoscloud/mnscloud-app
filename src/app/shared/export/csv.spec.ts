import { CSV_BOM, buildCsv, csvCell, csvFilename } from './csv';

describe('csv', () => {
  it('escapes separators, quotes and newlines', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(null)).toBe('');
  });

  it('neutralises formulas but keeps negative numbers', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('-02:30')).toBe("'-02:30");
    expect(csvCell('-150')).toBe('-150');
  });

  it('builds BOM, header and CRLF rows', () => {
    const csv = buildCsv(['A', 'B;C'], [['1', 'x"y']]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1)).toBe('A;"B;C"\r\n1;"x""y"\r\n');
    expect(buildCsv(['A'], [], false)).toBe('A\r\n');
  });

  it('names the file <page>-<yyyy-mm-dd>.csv', () => {
    expect(csvFilename('Marcações de ponto', new Date(2026, 10, 5))).toBe(
      'marcacoes-de-ponto-2026-11-05.csv',
    );
  });
});
