import { afdQuery, previousMonth } from './afd-export-dialog';
import { validDeveloperDocument, validInpi } from '../rep-p-parameters/rep-p-parameters';

describe('AFD export (K5a)', () => {
  it('defaults to the previous month, year boundary included', () => {
    expect(previousMonth(new Date(2026, 10, 11))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(previousMonth(new Date(2026, 0, 5))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('asks the establishment only when a company is chosen', () => {
    expect(afdQuery('', '2026-10-01', '2026-10-31')).toBe(
      'hr/time-punches/afd?from=2026-10-01&to=2026-10-31',
    );
    expect(afdQuery('c1', '2026-10-01', '2026-10-31')).toContain('companyUUID=c1');
  });

  it('validates the REP-P identity like the database', () => {
    expect(validInpi('')).toBeTrue();
    expect(validInpi('BR 5120-23')).toBeTrue();
    expect(validInpi('123456789012345678')).toBeFalse();
    expect(validDeveloperDocument('12.345.678/0001-90')).toBeTrue();
    expect(validDeveloperDocument('123.456.789-09')).toBeTrue();
    expect(validDeveloperDocument('1234')).toBeFalse();
  });
});
