import { attachableInstances, isAccountDefaultNetwork, serverRowRight } from './vps.types';

describe('VPS network scope helpers (tenant scope T5)', () => {
  it('reads the zone default network from the server flag first', () => {
    expect(isAccountDefaultNetwork({ HvnIsZoneDefault: 1 })).toBeTrue();
    expect(
      isAccountDefaultNetwork({ HvnIsZoneDefault: 0, HvnConfig: '{"tenantDefaultZone":"t1"}' }),
    ).toBeFalse();
    expect(isAccountDefaultNetwork({ HvnConfig: '{"tenantDefaultZone":"t1"}' })).toBeTrue();
    expect(isAccountDefaultNetwork({ HvnConfig: 'not json' })).toBeFalse();
  });

  it('uses the server edit/delete rights and falls back only without the field', () => {
    expect(serverRowRight({ CanDelete: 0 }, 'CanDelete', () => true)).toBeFalse();
    expect(serverRowRight({ CanEdit: '1' }, 'CanEdit', () => false)).toBeTrue();
    expect(serverRowRight({}, 'CanEdit', () => true)).toBeTrue();
  });

  it('offers only same-owner instances: /system acts on platform instances only', () => {
    const instances = [
      { HviUUID: 'p', UserUsrUUID: null },
      { HviUUID: 'a', UserUsrUUID: 'tenant-a' },
    ];
    expect(attachableInstances(instances, true).map((item) => item.HviUUID)).toEqual(['p']);
    expect(attachableInstances(instances, false).map((item) => item.HviUUID)).toEqual(['p', 'a']);
  });
});
