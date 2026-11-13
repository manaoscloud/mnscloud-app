import {
  SMTP_PORTAL_HIDE_ACTION,
  SMTP_PORTAL_PUBLISH_ACTION,
  SMTP_RESALE_UNLINK_ACTION,
  SMTP_SEND_KEY_REVOKE_ACTION,
  smtpResaleActions,
  smtpResaleBody,
  smtpResaleChanged,
  smtpSendKeyFromResponse,
  smtpSendKeyLabel,
} from './resale-actions';

const visible = (row: Record<string, unknown>) =>
  smtpResaleActions(false)
    .filter((action) => action.visible?.(row) !== false)
    .map((action) => action.key);

describe('SMTP account resale actions', () => {
  it('offers linking always and the customer actions only for an active customer account', () => {
    expect(visible({ RegCustomerRcuUUID: null, HsaIsActive: 1 })).toEqual(['smtp-resale-link']);
    expect(visible({ RegCustomerRcuUUID: 'C1', HsaIsActive: 1, HsaPortalEnabled: 0 })).toEqual([
      'smtp-resale-link',
      'smtp-resale-unlink',
      'smtp-portal-publish',
      'smtp-resale-send-key-generate',
    ]);
    expect(visible({ RegCustomerRcuUUID: 'C1', HsaIsActive: 0, HsaPortalEnabled: 0 })).toEqual([
      'smtp-resale-link',
      'smtp-resale-unlink',
    ]);
  });

  it('offers hiding a published account and revoking an existing key', () => {
    expect(
      visible({
        RegCustomerRcuUUID: 'C1',
        HsaIsActive: 1,
        HsaPortalEnabled: 1,
        HsaSendKeyPrefix: 'ab12',
      }),
    ).toEqual([
      'smtp-resale-link',
      'smtp-resale-unlink',
      'smtp-portal-hide',
      'smtp-resale-send-key-generate',
      'smtp-send-key-revoke',
    ]);
  });

  it('shows nothing in platform scope', () => {
    expect(smtpResaleActions(true)).toEqual([]);
  });

  it('calls the portal, resale and send-key routes', () => {
    const row = { HsaUUID: 'A1', HsaDailyLimit: 500, RegCustomerRcuUUID: 'C1' };
    expect(SMTP_PORTAL_PUBLISH_ACTION.request!.method).toBe('put');
    expect(SMTP_PORTAL_PUBLISH_ACTION.request!.endpoint(row)).toBe(
      'hosting/smtp/accounts/A1/portal',
    );
    expect(SMTP_PORTAL_PUBLISH_ACTION.request!.body?.(row)).toEqual({ enabled: true });
    expect(SMTP_PORTAL_HIDE_ACTION.request!.body?.(row)).toEqual({ enabled: false });
    expect(SMTP_RESALE_UNLINK_ACTION.request!.method).toBe('put');
    expect(SMTP_RESALE_UNLINK_ACTION.request!.endpoint(row)).toBe(
      'hosting/smtp/accounts/A1/resale',
    );
    expect(SMTP_RESALE_UNLINK_ACTION.request!.body?.(row)).toEqual({
      customerUuid: null,
      dailyLimit: 500,
    });
    expect(SMTP_SEND_KEY_REVOKE_ACTION.request!.method).toBe('delete');
    expect(SMTP_SEND_KEY_REVOKE_ACTION.request!.endpoint(row)).toBe(
      'hosting/smtp/accounts/A1/send-key',
    );
  });

  it('builds the resale body and detects changes', () => {
    const row = { RegCustomerRcuUUID: 'C1', HsaDailyLimit: 100 };
    expect(smtpResaleBody({ customerUuid: '', dailyLimit: '250' })).toEqual({
      customerUuid: null,
      dailyLimit: 250,
    });
    expect(smtpResaleChanged(row, { customerUuid: 'C1', dailyLimit: 100 })).toBe(false);
    expect(smtpResaleChanged(row, { customerUuid: 'C2', dailyLimit: 100 })).toBe(true);
    expect(smtpResaleChanged(row, { customerUuid: 'C1', dailyLimit: 101 })).toBe(true);
  });

  it('formats the key column and reads the one-time key', () => {
    expect(smtpSendKeyLabel({ HsaSendKeyPrefix: 'ab12' })).toBe('mnssmtp_ab12_…');
    expect(smtpSendKeyLabel({ HsaSendKeyPrefix: null })).toBe('—');
    expect(smtpSendKeyFromResponse({ data: { sendKey: 'k', prefix: 'p' } })).toBe('k');
    expect(smtpSendKeyFromResponse(null)).toBe('');
  });
});
