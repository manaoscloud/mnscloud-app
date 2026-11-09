import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleNavigation } from '../../src/app/layout/navigation/nav-visibility.ts';
import { NAV_ITEMS } from '../../src/app/layout/navigation/nav-registry.ts';
const voip = NAV_ITEMS.find((item) => item.id === 'voip');
function projection({ resource = false, master = false, tenant = false, entitled = false } = {}) {
  return visibleNavigation([voip], {
    permitted: (item) => !item.resourceAccess || resource,
    entitled: () => entitled || master,
    context: (item) => item.scope === 'public' || (item.scope === 'master' ? master : tenant),
  });
}
function leaves(items) {
  return items.flatMap((item) => (item.children ? leaves(item.children) : [item.id]));
}
test('scoped operator sees only capacity navigation without tenant entitlement or master', () => {
  assert.deepEqual(leaves(projection({ resource: true })), ['voip/clusters']);
  assert.equal(projection({ resource: true })[0].children[0].route, '/system/voip/clusters');
});
test('no resource authority cannot gain capacity navigation from a tenant entitlement', () => {
  assert.deepEqual(projection(), []);
  assert.equal(
    leaves(projection({ tenant: true, entitled: true })).includes('voip/clusters'),
    false,
  );
});
test('ordinary tenant leaves retain inherited commercial gating', () => {
  assert.deepEqual(projection({ tenant: true }), []);
  assert.ok(leaves(projection({ tenant: true, entitled: true })).includes('voip/pabx/registry'));
});
test('master infrastructure remains context-gated independently of capacity availability', () => {
  const visible = leaves(projection({ resource: true, master: true }));
  assert.ok(visible.includes('voip/clusters'));
  assert.ok(visible.length > 1);
});
