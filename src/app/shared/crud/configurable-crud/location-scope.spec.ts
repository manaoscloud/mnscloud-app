import type { ApiService } from '../../../services/api.service';
import { LOCATION_SCOPE_COLUMN, accountLocationScopeField, locationUuids } from './location-scope';

describe('location scope', () => {
  const t = (key: string) => key;

  it('reads the list from an array or a JSON text and tolerates anything else', () => {
    expect(locationUuids(['a', 'b'])).toEqual(['a', 'b']);
    expect(locationUuids('["a"]')).toEqual(['a']);
    expect(locationUuids('not json')).toEqual([]);
    expect(locationUuids(null)).toEqual([]);
  });

  it('offers only locations of the companies of the account', async () => {
    const calls: string[] = [];
    const scoped = {
      get: async (path: string) => {
        calls.push(path);
        return { data: { items: [{ RcoUUID: 'c1' }] } };
      },
    };
    const api = { withHrAccount: () => scoped } as unknown as ApiService;
    const field = accountLocationScopeField(api, 'a1', 'w1');
    expect(field.payloadKey).toBe('locationUUIDs');
    expect(field.source).toBe('LocationUUIDs');
    expect(field.multiple).toBeTrue();
    await field.remoteLookup!.prepare!();
    await field.remoteLookup!.prepare!();
    expect(calls.length).toBe(1);
    expect(field.remoteLookup!.accept!({ CompanyUUID: 'c1' })).toBeTrue();
    expect(field.remoteLookup!.accept!({ CompanyUUID: 'c2' })).toBeFalse();
  });

  it('shows the count of locations or the whole account in lists', () => {
    const value = LOCATION_SCOPE_COLUMN.value!;
    expect(value({ LocationUUIDs: [] }, t, {})).toBe('Whole account');
    expect(value({ LocationUUIDs: ['a'] }, t, {})).toBe('1 location');
    expect(value({ LocationUUIDs: ['a', 'b'] }, t, {})).toBe('2 locations');
  });
});
