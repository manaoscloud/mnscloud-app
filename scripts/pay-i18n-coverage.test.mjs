import { test } from 'node:test';
import { deepEqual } from 'node:assert/strict';
import { visibleKeys, missingKeys } from './pay-i18n-coverage.mjs';
test('missing menu, paginator and tuple-driven credential labels fail coverage', () => {
  const keys = visibleKeys(
    "label: 'Fee Plans'; this.i18n.t('Items per page'); ['clientId', 'Client ID', 'password']",
  );
  deepEqual(missingKeys(keys, { 'pt-BR': { 'Fee Plans': 'Planos', 'Client ID': 'ID' } }), [
    'pt-BR: Items per page',
  ]);
});
