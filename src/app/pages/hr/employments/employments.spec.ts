import { employmentDay, employmentPayload } from './employments';
import { employmentLabel, lastDayOfMonth, overlapsMonth } from '../timesheets/timesheets';
import { hrErrorText } from '../../../shared/crud/configurable-crud/hr-error-codes';

describe('employmentPayload', () => {
  const values = {
    employeeUUID: 'e1',
    companyUUID: 'c1',
    locationUUID: '',
    registrationNumber: ' 1234 ',
    hireDate: '2026-01-05T00:00:00.000Z',
    terminationDate: '',
    pis: '123.45678.90-1',
    esocialRegistration: '',
    cbo: '512105',
    contractType: 'indeterminate',
    baseSalary: '2100.5',
    shiftInstrument: 'none',
    shiftInstrumentNotes: '',
    notes: '',
    revision: 4,
  };

  it('creates with PascalCase keys, the employee and no revision', () => {
    const payload = employmentPayload(values, false);
    expect(Object.keys(payload).every((key) => /^[A-Z]/.test(key))).toBeTrue();
    expect(payload['EmployeeUUID']).toBe('e1');
    expect('Revision' in payload).toBeFalse();
    expect(payload['RegistrationNumber']).toBe('1234');
    expect(payload['HireDate']).toBe('2026-01-05');
    expect(payload['TerminationDate']).toBeNull();
    expect(payload['LocationUUID']).toBeNull();
    expect(payload['Pis']).toBe('12345678901');
    expect(payload['BaseSalary']).toBe(2100.5);
  });

  it('updates with the observed revision and never resends the employee', () => {
    const payload = employmentPayload(values, true);
    expect(payload['Revision']).toBe(4);
    expect('EmployeeUUID' in payload).toBeFalse();
  });

  it('omits an empty company, contract type and instrument (the API refuses a null company)', () => {
    const payload = employmentPayload(
      { ...values, companyUUID: '', contractType: '', shiftInstrument: '', baseSalary: '' },
      true,
    );
    expect('CompanyUUID' in payload).toBeFalse();
    expect('ContractType' in payload).toBeFalse();
    expect('ShiftInstrument' in payload).toBeFalse();
    expect(payload['BaseSalary']).toBeNull();
  });

  it('reads a day from a date or an instant', () => {
    expect(employmentDay('2026-01-05')).toBe('2026-01-05');
    expect(employmentDay(null)).toBe('');
  });

  it('labels an employment for the timesheet selector', () => {
    expect(
      employmentLabel({ RegistrationNumber: '12', CompanyName: 'ACME', LocationName: null }),
    ).toBe('12 · ACME');
  });

  it('does not send the base salary without the salary permission', () => {
    expect('BaseSalary' in employmentPayload(values, false, false)).toBeFalse();
    expect(employmentPayload(values, false, true)['BaseSalary']).toBe(2100.5);
  });

  it('lists the employments that overlap the month, ended ones included', () => {
    expect(
      overlapsMonth({ HireDate: '2026-01-05', TerminationDate: '2026-10-31' }, '2026-10'),
    ).toBeTrue();
    expect(
      overlapsMonth({ HireDate: '2026-01-05', TerminationDate: '2026-10-31' }, '2026-11'),
    ).toBeFalse();
    expect(overlapsMonth({ HireDate: '2026-12-01', TerminationDate: null }, '2026-11')).toBeFalse();
    expect(overlapsMonth({ HireDate: '2026-01-05', TerminationDate: null }, '2026-11')).toBeTrue();
  });

  it('maps the HR rule codes to texts', () => {
    expect(hrErrorText({ error: { code: 'HR_LOCATION_SCOPE_EXPORT_FORBIDDEN' } })).toContain(
      'AFD/AEJ',
    );
    expect(hrErrorText('HR_EMPLOYMENT_PUNCHES_OUTSIDE')).toContain('punches');
    expect(hrErrorText({ error: { code: 'OTHER' } })).toBe('');
  });

  it('uses the real last day of the month', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
    expect(lastDayOfMonth('2026-11')).toBe('2026-11-30');
    expect(overlapsMonth({ HireDate: '2026-12-01' }, '2026-11')).toBeFalse();
  });
});
