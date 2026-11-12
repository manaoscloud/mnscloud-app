import { afdQuery, exportNotice, previousMonth } from './afd-export-dialog';
import {
  validDeveloperDocument,
  validDeveloperEmail,
  validInpi,
} from '../rep-p-parameters/rep-p-parameters';

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
    expect(validDeveloperDocument('12.ABC.345/01DE-35')).toBeTrue();
    expect(validDeveloperDocument('1234')).toBeFalse();
  });

  it('exports the AEJ with the same query and summarizes its headers', () => {
    expect(afdQuery('c1', '2026-10-01', '2026-10-31', 'aej')).toBe(
      'hr/time-punches/aej?from=2026-10-01&to=2026-10-31&companyUUID=c1',
    );
    const headers = new Map([
      ['X-Aej-Employees', '3'],
      ['X-Aej-Marks', '40'],
      ['X-Aej-Provisional', '1'],
      ['X-Aej-Missing-Documents', '1'],
      ['X-Aej-Missing-Schedules', '0'],
    ]);
    const t = (key: string, params?: Record<string, string>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => params?.[name] ?? '');
    const text = exportNotice('aej', { get: (name) => headers.get(name) ?? null }, t);
    expect(text).toContain('AEJ generated with 3 employees and 40 marks.');
    expect(text).toContain('developer data');
    expect(text).toContain('1 employees without CPF were left out.');
    expect(text).not.toContain('contractual schedule');
  });

  it('validates the PTRP developer e-mail like the database', () => {
    expect(validDeveloperEmail('')).toBeTrue();
    expect(validDeveloperEmail('dev@example.com')).toBeTrue();
    expect(validDeveloperEmail('not-an-email')).toBeFalse();
    expect(validDeveloperEmail(`${'a'.repeat(45)}@x.com`)).toBeFalse();
  });
});
