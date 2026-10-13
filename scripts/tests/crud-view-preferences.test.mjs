import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CRUD_VIEW,
  crudViewStorageKey,
  isCrudColumnVisible,
  parseCrudViewPreferences,
  readCrudViewPreferences,
  setCrudColumnVisible,
  writeCrudViewPreferences,
} from '../../src/app/shared/crud/configurable-crud/crud-view-preferences.ts';

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('corrupt or foreign values fall back to the default view', () => {
  for (const raw of [
    null,
    '',
    '{',
    '"x"',
    '[]',
    '{"density":"huge","hidden":"a","shown":[1,null]}',
  ]) {
    const value = parseCrudViewPreferences(raw);
    assert.equal(value.density, 'comfortable');
    assert.deepEqual([...value.hidden], []);
    assert.deepEqual([...value.shown], []);
  }
});

test('default and optional columns toggle independently and round-trip', () => {
  let view = DEFAULT_CRUD_VIEW;
  assert.equal(isCrudColumnVisible(view, 'domain', false), true);
  assert.equal(isCrudColumnVisible(view, 'codecs', true), false);
  view = setCrudColumnVisible(view, 'domain', false, false);
  view = setCrudColumnVisible(view, 'codecs', true, true);
  view = { ...view, density: 'compact' };
  const storage = memoryStorage();
  const key = crudViewStorageKey('voip/pabx/extensions');
  writeCrudViewPreferences(key, view, storage);
  const restored = readCrudViewPreferences(key, storage);
  assert.equal(restored.density, 'compact');
  assert.equal(isCrudColumnVisible(restored, 'domain', false), false);
  assert.equal(isCrudColumnVisible(restored, 'codecs', true), true);
  const reset = setCrudColumnVisible(
    setCrudColumnVisible(restored, 'domain', false, true),
    'codecs',
    true,
    false,
  );
  writeCrudViewPreferences(key, { ...reset, density: 'comfortable' }, storage);
  assert.equal(storage.data.has(key), false);
});

test('blocked storage never breaks the page', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(readCrudViewPreferences('k', blocked), DEFAULT_CRUD_VIEW);
  assert.doesNotThrow(() =>
    writeCrudViewPreferences('k', { ...DEFAULT_CRUD_VIEW, density: 'compact' }, blocked),
  );
  assert.deepEqual(readCrudViewPreferences('k', null), DEFAULT_CRUD_VIEW);
});

test('child collection endpoints share one key per resource', () => {
  assert.equal(
    crudViewStorageKey('voip/pabx/5f54a4bf-c6fc-11f1-9300-bc2411f7dd2d/rules?limit=5'),
    'mns.crud.view.voip/pabx/:id/rules',
  );
  assert.equal(crudViewStorageKey('/erp/orders/42/items'), 'mns.crud.view.erp/orders/:id/items');
});
