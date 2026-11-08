import test from 'node:test';
import assert from 'node:assert/strict';
import { capacityExpiryInstant } from '../../src/app/pages/user/capacity-expiry.ts';
test('local expiry has an explicit absolute instant and an empty field remains unbounded', () => {
  assert.equal(
    capacityExpiryInstant('2030-01-01T12:34'),
    new Date(2030, 0, 1, 12, 34).toISOString(),
  );
  for (const value of ['', null, undefined]) assert.equal(capacityExpiryInstant(value), null);
});
test('invalid calendar dates and incomplete input cannot silently normalize expiry', () => {
  for (const value of ['2030-02-30T12:00', '2030-01-01T25:00', '2030-01-01', 'invalid', 1]) {
    assert.equal(capacityExpiryInstant(value), undefined);
  }
});
