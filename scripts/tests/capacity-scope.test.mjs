import test from 'node:test';
import assert from 'node:assert/strict';
import { capacityScopeLabel } from '../../src/app/pages/user/capacity-scope.ts';
const translate = (key) => key;
test('missing or malformed scope is never displayed as unrestricted', () => {
  for (const conditionScopes of [undefined, null, 'bad-json', {}, '[{}]', '[{"supported":1}]']) {
    assert.notEqual(
      capacityScopeLabel({ conditionScopes }, translate),
      'capacityAccess.unrestricted',
    );
  }
  assert.equal(
    capacityScopeLabel({ conditionScopes: '[]' }, translate),
    'capacityAccess.unrestricted',
  );
});
test('scope labels preserve resource names, unavailable identities and conjunctive restrictions', () => {
  const scopes = [
    { supported: 1, clusters: [{ uuid: 'cluster-a', name: 'PBX A' }], providers: null },
    { supported: 1, clusters: null, providers: [{ uuid: 'provider-b', name: null }] },
  ];
  assert.equal(
    capacityScopeLabel({ conditionScopes: JSON.stringify(scopes) }, translate),
    'capacityAccess.clusters: PBX A capacityAccess.and capacityAccess.providers: capacityAccess.unavailableResource (provider-b)',
  );
});
test('unsupported conditions remain visibly restricted', () => {
  assert.equal(
    capacityScopeLabel({ conditionScopes: [{ supported: 0 }] }, translate),
    'capacityAccess.unsupported',
  );
});
