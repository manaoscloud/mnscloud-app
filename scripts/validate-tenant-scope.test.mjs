import assert from 'node:assert/strict';
import test from 'node:test';
import { compare, countSource } from './validate-tenant-scope.mjs';

test('counts endpoint choice by master permission and URL scope', () => {
  const source = `
    const a = this.isMaster() ? 'system/hosting/storage/buckets' : 'hosting/storage/buckets';
    const b = this.auth.hasPermission('platform.master.access') ? 'system/voip' : 'voip';
    if (window.location.pathname.startsWith('/system/monitoring/')) {}
    const c = this.router.url.includes('/system');
    const d = localStorage.getItem('selectedEnvironment');`;
  assert.deepEqual(countSource(source), {
    'endpoint-by-master': 2,
    'scope-from-url': 3,
    'scope-from-storage': 1,
  });
});

test('accepts the route declared scope and labels chosen by master', () => {
  const source = `
    const endpoint = this.route.snapshot.data['scope'] === 'system' ? 'system/voip' : 'voip';
    const label = this.isMaster() ? 'Default' : 'Own';`;
  assert.deepEqual(countSource(source), {});
});

test('fails on growth, new files and stale baseline', () => {
  const base = { 'a.ts': { 'scope-from-url': 1 } };
  assert.deepEqual(compare({ 'a.ts': { 'scope-from-url': 1 } }, base), []);
  assert.equal(compare({ 'a.ts': { 'scope-from-url': 2 } }, base).length, 1);
  assert.equal(
    compare({ 'a.ts': { 'scope-from-url': 1 }, 'b.ts': { 'endpoint-by-master': 1 } }, base).length,
    1,
  );
  assert.equal(compare({}, base).length, 1);
});

test('skips a use marked tenant-scope-exempt with a reason, on its line or the line above', () => {
  const source = `
    // tenant-scope-exempt: the single store of the selected tenant
    if (typeof localStorage === 'undefined') return normalizeEnvironmentUUID(value);
    localStorage.setItem('x', normalizeEnvironmentUUID(v)); // tenant-scope-exempt: same store
    const z = localStorage.getItem('selectedEnvironment');
    localStorage.setItem('y', readEnvironment()); // tenant-scope-exempt:`;
  assert.deepEqual(countSource(source), { 'scope-from-storage': 2 });
});
