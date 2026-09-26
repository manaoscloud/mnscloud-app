import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyCrudPages } from './validate-crud-inventory.mjs';

test('any legacy CRUD page fails the inventory', () => {
  assert.deepEqual(
    legacyCrudPages([
      { path: 'src/app/pages/b/b.ts', kind: 'legacy' },
      { path: 'src/app/pages/a/a.ts', kind: 'generic' },
    ]),
    ['src/app/pages/b/b.ts'],
  );
});

test('generic-only inventory passes', () => {
  assert.deepEqual(legacyCrudPages([{ path: 'src/app/pages/a/a.ts', kind: 'generic' }]), []);
});
