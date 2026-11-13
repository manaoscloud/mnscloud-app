import { LOCATION_SCOPE_COLUMN, LOCATION_SCOPE_FIELD, locationUuids } from './location-scope';

describe('location scope', () => {
  const t = (key: string) => key;

  it('reads the list from an array or a JSON text and tolerates anything else', () => {
    expect(locationUuids(['a', 'b'])).toEqual(['a', 'b']);
    expect(locationUuids('["a"]')).toEqual(['a']);
    expect(locationUuids('not json')).toEqual([]);
    expect(locationUuids(null)).toEqual([]);
  });

  it('sends locationUUIDs ([] clears the scope) from the LocationUUIDs of the record', () => {
    expect(LOCATION_SCOPE_FIELD.payloadKey).toBe('locationUUIDs');
    expect(LOCATION_SCOPE_FIELD.source).toBe('LocationUUIDs');
    expect(LOCATION_SCOPE_FIELD.multiple).toBeTrue();
  });

  it('shows the count of locations or the whole account in lists', () => {
    const value = LOCATION_SCOPE_COLUMN.value!;
    expect(value({ LocationUUIDs: [] }, t, {})).toBe('Whole account');
    expect(value({ LocationUUIDs: ['a'] }, t, {})).toBe('1 location');
    expect(value({ LocationUUIDs: ['a', 'b'] }, t, {})).toBe('2 locations');
  });
});
