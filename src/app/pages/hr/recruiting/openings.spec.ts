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

  it('sends camelCase keys and the revision only when editing', () => {
    const create = openingPayload(values, false);
    expect(Object.keys(create).every((key) => /^[a-z]/.test(key))).toBeTrue();
    expect('revision' in create).toBeFalse();
    expect(openingPayload(values, true)['revision']).toBe(5);
  });

  it('normalizes text, defaults and the optional location and date', () => {
    const payload = openingPayload(values, false);
    expect(payload['title']).toBe('Frentista noturno');
    expect(payload['locationUUID']).toBeNull();
    expect(payload['employmentType']).toBe('clt');
    expect(payload['status']).toBe('draft');
    expect(payload['openings']).toBe(1);
    expect(payload['published']).toBeTrue();
    expect(payload['closesOn']).toBe('2026-12-31');
    expect(openingPayload({ ...values, closesOn: '' }, false)['closesOn']).toBeNull();
  });

  it('reads a day from a date or an instant', () => {
    expect(dayOf('2026-05-01')).toBe('2026-05-01');
    expect(dayOf(null)).toBe('');
  });
});
