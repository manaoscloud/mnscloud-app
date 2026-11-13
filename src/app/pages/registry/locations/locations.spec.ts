import { locationPayload } from './locations';

describe('locationPayload', () => {
  const values = {
    name: ' Posto Centro ',
    companyUUID: 'c1',
    slug: 'centro',
    state: 'am',
    country: '',
    latitude: '-3.1',
    longitude: '',
    open24h: false,
    weekdayOpens: '06:00:00',
    weekdayCloses: '',
    published: true,
    status: 'active',
    revision: 3,
  };

  it('uses PascalCase keys only and sends Revision only when editing', () => {
    const create = locationPayload(values, false);
    expect(Object.keys(create).every((key) => /^[A-Z]/.test(key))).toBeTrue();
    expect('Revision' in create).toBeFalse();
    expect(locationPayload(values, true)['Revision']).toBe(3);
  });

  it('normalizes text, times and defaults', () => {
    const payload = locationPayload(values, false);
    expect(payload['Name']).toBe('Posto Centro');
    expect(payload['State']).toBe('AM');
    expect(payload['Country']).toBe('BR');
    expect(payload['WeekdayOpens']).toBe('06:00');
    expect(payload['WeekdayCloses']).toBeNull();
    expect(payload['Published']).toBeTrue();
  });

  it('sends latitude and longitude together or not at all', () => {
    const half = locationPayload(values, false);
    expect(half['Latitude']).toBeNull();
    expect(half['Longitude']).toBeNull();
    const both = locationPayload({ ...values, longitude: '-60' }, false);
    expect(both['Latitude']).toBe(-3.1);
    expect(both['Longitude']).toBe(-60);
  });

  it('sends the fence radius as a number or null', () => {
    expect(
      locationPayload({ ...values, geofenceRadiusMeters: '150' }, false)['GeofenceRadiusMeters'],
    ).toBe(150);
    expect(
      locationPayload({ ...values, geofenceRadiusMeters: '' }, false)['GeofenceRadiusMeters'],
    ).toBeNull();
    expect(locationPayload(values, false)['GeofenceRadiusMeters']).toBeNull();
  });
});
