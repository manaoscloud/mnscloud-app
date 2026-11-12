import { portalRowActions } from './instances';

const CUSTOMER = 'CUST-1';

function keys(row: Record<string, unknown>, platformScope = false): string[] {
  return portalRowActions(row, platformScope).map((action) => action.key);
}

describe('VPS instance portal actions', () => {
  it('offers publication for a customer server and nothing without customer', () => {
    expect(keys({ RegCustomerRcuUUID: CUSTOMER, HviPortalEnabled: 0 })).toEqual(['portal-publish']);
    expect(keys({ RegCustomerRcuUUID: null, HviPortalEnabled: 0 })).toEqual([]);
  });

  it('offers hide and the snapshot switch for a published server', () => {
    expect(
      keys({ RegCustomerRcuUUID: CUSTOMER, HviPortalEnabled: 1, HviPortalSnapshots: 0 }),
    ).toEqual(['portal-hide', 'portal-snapshots-allow']);
    expect(
      keys({ RegCustomerRcuUUID: CUSTOMER, HviPortalEnabled: 1, HviPortalSnapshots: 1 }),
    ).toEqual(['portal-hide', 'portal-snapshots-block']);
  });

  it('shows no portal action in platform scope', () => {
    expect(keys({ RegCustomerRcuUUID: CUSTOMER, HviPortalEnabled: 0 }, true)).toEqual([]);
  });
});
