import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCrudPassword } from '../../src/app/shared/crud/configurable-crud/password-generation.ts';

test('generated credentials satisfy configured lengths and safe NAS syntax', () => {
  for (const length of [10, 20, 32, 128]) {
    const values = Array.from({ length: 100 }, () => generateCrudPassword(length));
    assert.equal(new Set(values).size, values.length);
    for (const value of values) {
      assert.equal(value.length, length);
      assert.match(value, /^[a-zA-Z0-9]+$/);
    }
  }
});
test('invalid generation policies fail instead of truncating or falling back', () => {
  for (const length of [0, -1, 129, NaN, 2.5]) {
    assert.throws(() => generateCrudPassword(length), RangeError);
  }
});
