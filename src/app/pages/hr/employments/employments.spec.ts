import { employmentDay, employmentPayload } from './employments';
import { employmentLabel } from '../timesheets/timesheets';

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
});
