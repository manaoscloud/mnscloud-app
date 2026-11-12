import type {
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * V4 of workspace handoff 2026-11-11-hosting-vps-storage-resale.md: the tenant publishes one active
 * customer storage account in the Customer Portal (read-only there). None in platform scope.
 */
function isCustomerAccount(row: ConfigurableCrudRecord): boolean {
  return !!row['RegCustomerRcuUUID'] && Number(row['HsaIsActive'] ?? 0) === 1;
}

export const STORAGE_PORTAL_PUBLISH_ACTION: ConfigurableCrudRowAction = {
  key: 'storage-portal-publish',
  label: 'hostingStorage.portalPublish',
  icon: 'public',
  tooltip: 'hostingStorage.portalPublish',
  visible: (row) => isCustomerAccount(row) && Number(row['HsaPortalEnabled'] ?? 0) !== 1,
  request: {
    method: 'put',
    endpoint: (row) => `hosting/storage/accounts/${row['HsaUUID']}/portal`,
    body: () => ({ enabled: true }),
    successMessage: 'hostingStorage.portalPublished',
    confirm: {
      title: 'hostingStorage.portalPublish',
      message: 'hostingStorage.portalPublishConfirm',
      confirmLabel: 'hostingStorage.portalPublish',
    },
  },
};

export const STORAGE_PORTAL_HIDE_ACTION: ConfigurableCrudRowAction = {
  key: 'storage-portal-hide',
  label: 'hostingStorage.portalHide',
  icon: 'public_off',
  tooltip: 'hostingStorage.portalHide',
  visible: (row) => Number(row['HsaPortalEnabled'] ?? 0) === 1,
  request: {
    method: 'put',
    endpoint: (row) => `hosting/storage/accounts/${row['HsaUUID']}/portal`,
    body: () => ({ enabled: false }),
    successMessage: 'hostingStorage.portalHidden',
    confirm: {
      title: 'hostingStorage.portalHide',
      message: 'hostingStorage.portalHideConfirm',
      confirmLabel: 'hostingStorage.portalHide',
    },
  },
};

export function storagePortalActions(master: boolean): ConfigurableCrudRowAction[] {
  return master ? [] : [STORAGE_PORTAL_PUBLISH_ACTION, STORAGE_PORTAL_HIDE_ACTION];
}
