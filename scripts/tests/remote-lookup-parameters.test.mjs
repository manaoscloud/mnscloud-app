import assert from 'node:assert/strict';
import test from 'node:test';
import { remoteLookupParameters } from '../../src/app/shared/crud/configurable-crud/remote-lookup-parameters.ts';

test('dependent lookups wait for every required parent and escape query values', () => {
  assert.deepEqual(remoteLookupParameters({ packageUUID: 'target' }, { name: 'Draft' }), {
    ready: false,
    query: '',
  });
  assert.deepEqual(remoteLookupParameters({ parent: 'id' }, { id: 'x&status=0' }), {
    ready: true,
    query: 'parent=x%26status%3D0',
  });
  assert.deepEqual(remoteLookupParameters({ parent: 'id', scope: 'scope' }, { id: 'x' }), {
    ready: false,
    query: '',
  });
  assert.deepEqual(remoteLookupParameters(undefined, {}), { ready: true, query: '' });
  assert.deepEqual(remoteLookupParameters({ status: 'status' }, { status: 0 }), {
    ready: true,
    query: 'status=0',
  });
});
