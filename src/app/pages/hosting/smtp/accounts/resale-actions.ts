import type {
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * V5 of workspace handoff 2026-11-11-hosting-vps-storage-resale.md: the tenant binds one SMTP
 * account to a registry customer, sets its daily limit, publishes it in the Customer Portal and
 * issues the customer's send key. None of this exists in platform scope.
 */
const BASE = 'hosting/smtp/accounts';

export const SMTP_RESALE_LINK_KEY = 'smtp-resale-link';
export const SMTP_RESALE_SEND_KEY_GENERATE_KEY = 'smtp-resale-send-key-generate';

export const SMTP_SEND_KEY_PREFIX = 'mnssmtp_';

function isCustomerAccount(row: ConfigurableCrudRecord): boolean {
  return !!row['RegCustomerRcuUUID'] && Number(row['HsaIsActive'] ?? 0) === 1;
}

/** `mnssmtp_<prefix>_…` or an em dash when the account has no send key. */
export function smtpSendKeyLabel(row: ConfigurableCrudRecord): string {
  const prefix = String(row['HsaSendKeyPrefix'] ?? '');
  return prefix ? `${SMTP_SEND_KEY_PREFIX}${prefix}_…` : '—';
}

/** Opens the edit dialog, whose customer and daily limit fields call PUT .../resale on save. */
export const SMTP_RESALE_LINK_ACTION: ConfigurableCrudRowAction = {
  key: SMTP_RESALE_LINK_KEY,
  label: 'hostingSmtp.resale.link',
  icon: 'person_add',
  tooltip: 'hostingSmtp.resale.link',
};

export const SMTP_RESALE_UNLINK_ACTION: ConfigurableCrudRowAction = {
  key: 'smtp-resale-unlink',
  label: 'hostingSmtp.resale.unlink',
  icon: 'person_remove',
  tooltip: 'hostingSmtp.resale.unlink',
  visible: (row) => !!row['RegCustomerRcuUUID'],
  request: {
    method: 'put',
    endpoint: (row) => `${BASE}/${row['HsaUUID']}/resale`,
    body: (row) => ({ customerUuid: null, dailyLimit: Number(row['HsaDailyLimit'] ?? 0) || 1 }),
    successMessage: 'hostingSmtp.resale.unlinked',
    confirm: {
      title: 'hostingSmtp.resale.unlink',
      message: 'hostingSmtp.resale.unlinkConfirm',
      confirmLabel: 'hostingSmtp.resale.unlink',
    },
  },
};

export const SMTP_PORTAL_PUBLISH_ACTION: ConfigurableCrudRowAction = {
  key: 'smtp-portal-publish',
  label: 'hostingSmtp.resale.portalPublish',
  icon: 'public',
  tooltip: 'hostingSmtp.resale.portalPublish',
  visible: (row) => isCustomerAccount(row) && Number(row['HsaPortalEnabled'] ?? 0) !== 1,
  request: {
    method: 'put',
    endpoint: (row) => `${BASE}/${row['HsaUUID']}/portal`,
    body: () => ({ enabled: true }),
    successMessage: 'hostingSmtp.resale.portalPublished',
    confirm: {
      title: 'hostingSmtp.resale.portalPublish',
      message: 'hostingSmtp.resale.portalPublishConfirm',
      confirmLabel: 'hostingSmtp.resale.portalPublish',
    },
  },
};

export const SMTP_PORTAL_HIDE_ACTION: ConfigurableCrudRowAction = {
  key: 'smtp-portal-hide',
  label: 'hostingSmtp.resale.portalHide',
  icon: 'public_off',
  tooltip: 'hostingSmtp.resale.portalHide',
  visible: (row) => Number(row['HsaPortalEnabled'] ?? 0) === 1,
  request: {
    method: 'put',
    endpoint: (row) => `${BASE}/${row['HsaUUID']}/portal`,
    body: () => ({ enabled: false }),
    successMessage: 'hostingSmtp.resale.portalHidden',
    confirm: {
      title: 'hostingSmtp.resale.portalHide',
      message: 'hostingSmtp.resale.portalHideConfirm',
      confirmLabel: 'hostingSmtp.resale.portalHide',
    },
  },
};

/** Confirmed and run by the page: the generated key must be shown once and never kept. */
export const SMTP_SEND_KEY_GENERATE_ACTION: ConfigurableCrudRowAction = {
  key: SMTP_RESALE_SEND_KEY_GENERATE_KEY,
  label: 'hostingSmtp.resale.keyGenerate',
  icon: 'key',
  tooltip: 'hostingSmtp.resale.keyGenerate',
  visible: isCustomerAccount,
};

export const SMTP_SEND_KEY_REVOKE_ACTION: ConfigurableCrudRowAction = {
  key: 'smtp-send-key-revoke',
  label: 'hostingSmtp.resale.keyRevoke',
  icon: 'key_off',
  tooltip: 'hostingSmtp.resale.keyRevoke',
  visible: (row) => !!row['HsaSendKeyPrefix'],
  request: {
    method: 'delete',
    endpoint: (row) => `${BASE}/${row['HsaUUID']}/send-key`,
    successMessage: 'hostingSmtp.resale.keyRevoked',
    confirm: {
      title: 'hostingSmtp.resale.keyRevoke',
      message: 'hostingSmtp.resale.keyRevokeConfirm',
      confirmLabel: 'hostingSmtp.resale.keyRevoke',
    },
  },
};

export function smtpResaleActions(master: boolean): ConfigurableCrudRowAction[] {
  return master
    ? []
    : [
        SMTP_RESALE_LINK_ACTION,
        SMTP_RESALE_UNLINK_ACTION,
        SMTP_PORTAL_PUBLISH_ACTION,
        SMTP_PORTAL_HIDE_ACTION,
        SMTP_SEND_KEY_GENERATE_ACTION,
        SMTP_SEND_KEY_REVOKE_ACTION,
      ];
}

export function smtpResaleBody(values: ConfigurableCrudRecord): {
  customerUuid: string | null;
  dailyLimit: number;
} {
  return {
    customerUuid: String(values['customerUuid'] ?? '') || null,
    dailyLimit: Number(values['dailyLimit']),
  };
}

export function smtpResaleChanged(
  row: ConfigurableCrudRecord,
  values: ConfigurableCrudRecord,
): boolean {
  const body = smtpResaleBody(values);
  return (
    body.customerUuid !== (row['RegCustomerRcuUUID'] ?? null) ||
    body.dailyLimit !== Number(row['HsaDailyLimit'] ?? 0)
  );
}

/** Extracts the one-time key from the POST send-key envelope. */
export function smtpSendKeyFromResponse(response: unknown): string {
  const data = (response as { data?: { sendKey?: unknown } } | null)?.data;
  return typeof data?.sendKey === 'string' ? data.sendKey : '';
}
