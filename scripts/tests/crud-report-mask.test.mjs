import test from 'node:test';
import assert from 'node:assert/strict';
import { crudReportMask } from '../../src/app/shared/crud/configurable-crud/crud-report-mask.ts';

test('password policy controls may stay visible without exposing secret controls', () => {
  assert.equal(
    crudReportMask({ key: 'portalMustChangePassword', type: 'select', reportMask: false }),
    null,
  );
  for (const type of ['password', 'secret-content']) {
    assert.equal(crudReportMask({ key: 'value', type, reportMask: false }), '');
  }
  assert.equal(crudReportMask({ key: 'portalPassword', type: 'text' }), '');
  assert.equal(crudReportMask({ key: 'apiToken' }), '');
  assert.equal(crudReportMask({ key: 'PrivateKey' }), '');
  assert.equal(crudReportMask({ key: 'credentialUUID' }), null);
  assert.equal(crudReportMask({ key: 'name' }), null);
  assert.equal(crudReportMask({ key: 'value', reportMask: true }), '');
});
