import { dayOf, openingPayload } from './openings';

describe('openingPayload', () => {
  const values = {
    title: ' Frentista noturno ',
    companyUUID: 'c1',
    locationUUID: '',
    slug: 'frentista',
    employmentType: '',
    openings: '0',
    published: true,
    status: '',
    closesOn: '2026-12-31T00:00:00.000Z',
    revision: '5',
  };

  it('sends PascalCase keys and the revision only when editing', () => {
    const create = openingPayload(values, false);
    expect(Object.keys(create).every((key) => /^[A-Z]/.test(key))).toBeTrue();
    expect('Revision' in create).toBeFalse();
    expect(openingPayload(values, true)['Revision']).toBe(5);
  });

  it('normalizes text, defaults and the optional location and date', () => {
    const payload = openingPayload(values, false);
    expect(payload['Title']).toBe('Frentista noturno');
    expect(payload['LocationUUID']).toBeNull();
    expect(payload['EmploymentType']).toBe('clt');
    expect(payload['Status']).toBe('draft');
    expect(payload['Openings']).toBe(1);
    expect(payload['Published']).toBeTrue();
    expect(payload['ClosesOn']).toBe('2026-12-31');
    expect(openingPayload({ ...values, closesOn: '' }, false)['ClosesOn']).toBeNull();
  });

  it('reads a day from a date or an instant', () => {
    expect(dayOf('2026-05-01')).toBe('2026-05-01');
    expect(dayOf(null)).toBe('');
  });
});
