import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isRecordUUID,
  shortRecordUUID,
} from '../../src/app/shared/crud/configurable-crud/record-uuid-label.ts';

test('record UUIDs with or without dashes are shortened to their first 8 characters', () => {
  assert.equal(shortRecordUUID('5f54a4bf-c6fc-11f1-9300-bc2411f7dd2d'), '5f54a4bf…');
  assert.equal(shortRecordUUID('5F54A4BFC6FC11F19300BC2411F7DD2D'), '5F54A4BF…');
  assert.equal(isRecordUUID(' cf247d16-c2c6-11f1-9300-bc2411f7dd2d '), true);
});

test('readable details and partial identifiers are kept as is', () => {
  for (const value of ['', '-', 'PABX-CCS · freeswitch', '5f54a4bf', '5f54a4bf-c6fc-11f1-9300']) {
    assert.equal(isRecordUUID(value), false);
    assert.equal(shortRecordUUID(value), value);
  }
});
