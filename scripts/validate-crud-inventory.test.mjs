import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCrudInventory } from './validate-crud-inventory.mjs';

const generic = { path: 'src/app/pages/a/a.ts', kind: 'generic' };
const legacy = { path: 'src/app/pages/b/b.ts', kind: 'legacy' };

test('unlisted legacy CRUD pages fail the inventory', () => {
  assert.deepEqual(checkCrudInventory([generic, legacy], []).unlisted, [legacy.path]);
});

test('listed legacy CRUD pages are tolerated while pending', () => {
  const result = checkCrudInventory([generic, legacy], [legacy.path]);
  assert.deepEqual([result.unlisted, result.stale, result.remaining], [[], [], 1]);
});

test('migrated pages must leave the allowlist', () => {
  assert.deepEqual(checkCrudInventory([generic], [legacy.path]).stale, [legacy.path]);
});
