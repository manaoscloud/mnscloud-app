import { ConfigurableCrudConfig, ConfigurableCrudOption, ConfigurableCrudRecord } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/** PhoneWeb sign-in identity of a phone user (API `VhuRealm`). */
export const PHONE_REALMS: readonly ConfigurableCrudOption[] = [
  { value: 'user', label: 'App member (e-mail)' },
  { value: 'employee', label: 'Employee (Pulse login)' },
  { value: 'customer_user', label: 'Customer (portal login)' },
];

export const PHONE_BLOCK_REASONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Allowed' },
  { value: 'PHONE_USER_INACTIVE', label: 'Phone user inactive' },
  { value: 'TENANT_INACTIVE', label: 'Tenant inactive' },
  { value: 'IDENTITY_INACTIVE', label: 'Identity inactive or blocked' },
  { value: 'MEMBERSHIP_INACTIVE', label: 'No longer a member of the tenant' },
  { value: 'ACCESS_ACCOUNT_INACTIVE', label: 'Pulse access account disabled' },
];

export const PHONE_REVOKE_REASONS: readonly ConfigurableCrudOption[] = [
  { value: 'SIGNED_OUT', label: 'Signed out' },
  { value: 'ADMIN_REVOKED', label: 'Revoked by an administrator' },
  { value: 'SESSION_LIMIT', label: 'Session limit reached' },
  { value: 'REFRESH_REUSE', label: 'Token reused (possible leak)' },
  { value: 'PHONE_USER_INACTIVE', label: 'Phone user inactive' },
  { value: 'PHONE_USER_DELETED', label: 'Phone user deleted' },
  { value: 'IDENTITY_INACTIVE', label: 'Identity inactive or blocked' },
  { value: 'MEMBERSHIP_INACTIVE', label: 'No longer a member of the tenant' },
  { value: 'ACCESS_ACCOUNT_INACTIVE', label: 'Pulse access account disabled' },
];

export const PHONE_CLIENT_KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'web', label: 'Web / PWA' },
  { value: 'native', label: 'Installed app' },
];

/** PhoneWeb sessions, of one phone user (collection dialog) or of the whole tenant (page). */
export function phoneSessionsConfig(phoneUserUUID: string | null): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'voip/phone/sessions',
    uuidField: 'VhsUUID',
    pageTitle: 'PhoneWeb sessions',
    pageDescription:
      'Devices signed in to PhoneWeb. Revoking a session signs that device out at once; the user signs in again to continue.',
    listQuery: phoneUserUUID ? { phoneUserUUID } : undefined,
    serverSidePagination: true,
    statusFilter: false,
    bulkDelete: false,
    canCreate: false,
    canEdit: false,
    canDeleteRow: (row: ConfigurableCrudRecord) => row['Active'] === true,
    deleteEndpoint: (row: ConfigurableCrudRecord) => `voip/phone/sessions/${row['VhsUUID']}`,
    deleteTitle: 'Revoke session',
    deleteMessage: 'Sign this device out of PhoneWeb now?',
    deletedMessage: 'Session revoked.',
    deleteFailedMessage: 'Failed to revoke the session.',
    emptyLabel: 'No PhoneWeb sessions.',
    listFilters: [
      {
        key: 'active',
        paramKey: 'active',
        label: 'Sessions',
        type: 'select',
        span: 1,
        options: [
          { value: 1, label: 'Active only' },
          { value: 0, label: 'All' },
        ],
      },
    ],
    columns: [
      { id: 'device', label: 'Device', field: 'VhsDeviceName', uuidField: 'VhsUUID', kind: 'identity' },
      { id: 'client', label: 'Client', field: 'VhsClientKind', options: PHONE_CLIENT_KINDS },
      { id: 'platform', label: 'Platform', field: 'VhsPlatform' },
      { id: 'ip', label: 'IP', field: 'VhsIP', optional: true },
      { id: 'lastSeen', label: 'Last activity', field: 'VhsLastSeenAt', kind: 'datetime' },
      { id: 'expires', label: 'Expires', field: 'VhsExpiresAt', kind: 'datetime', optional: true },
      { id: 'active', label: 'Active', field: 'Active', kind: 'boolean' },
      { id: 'revoked', label: 'Ended', field: 'VhsRevokedAt', kind: 'datetime', optional: true },
      { id: 'reason', label: 'End reason', field: 'VhsRevokeReason', options: PHONE_REVOKE_REASONS },
    ],
    fields: [],
  });
}
