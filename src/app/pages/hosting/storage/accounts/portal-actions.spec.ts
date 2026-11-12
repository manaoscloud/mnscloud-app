import {
  STORAGE_PORTAL_HIDE_ACTION,
  STORAGE_PORTAL_PUBLISH_ACTION,
  storagePortalActions,
} from './portal-actions';

const visible = (row: Record<string, unknown>) =>
  storagePortalActions(false)
    .filter((action) => action.visible?.(row) !== false)
    .map((action) => action.key);

describe('storage account portal actions', () => {
  it('offers publication only for an active customer account', () => {
    expect(visible({ RegCustomerRcuUUID: 'C1', HsaIsActive: 1, HsaPortalEnabled: 0 })).toEqual([
      'storage-portal-publish',
    ]);
    expect(visible({ RegCustomerRcuUUID: null, HsaIsActive: 1, HsaPortalEnabled: 0 })).toEqual([]);
    expect(visible({ RegCustomerRcuUUID: 'C1', HsaIsActive: 0, HsaPortalEnabled: 0 })).toEqual([]);
  });

  it('offers hiding a published account', () => {
    expect(visible({ RegCustomerRcuUUID: 'C1', HsaIsActive: 1, HsaPortalEnabled: 1 })).toEqual([
      'storage-portal-hide',
    ]);
  });

  it('calls the tenant portal route and shows nothing in platform scope', () => {
    const row = { HsaUUID: 'A1' };
    const publish = STORAGE_PORTAL_PUBLISH_ACTION.request!;
    const hide = STORAGE_PORTAL_HIDE_ACTION.request!;
    expect(typeof publish.endpoint === 'function' ? publish.endpoint(row) : '').toBe(
      'hosting/storage/accounts/A1/portal',
    );
    expect(publish.body?.(row)).toEqual({ enabled: true });
    expect(hide.body?.(row)).toEqual({ enabled: false });
    expect(storagePortalActions(true)).toEqual([]);
  });
});
