import { safeSignupLink, SIGNUP_REFUSAL_MESSAGES, signupStatusOf } from './signup';
import {
  isoToLocalDateTime,
  localDateTimeToIso,
  signupAuditDetail,
} from '../settings/parameters/parameters';
import { notificationIcon, notificationTitle } from '../../services/notification-display';
import type { InboxNotification } from '../../services/notification-inbox.service';

const t = (key: string, params?: Record<string, string>) =>
  params ? `${key}:${Object.values(params).join(',')}` : key;

describe('signup gate (public page)', () => {
  it('reads the public gate status and fails closed on unknown values', () => {
    expect(signupStatusOf('open')).toBe('open');
    expect(signupStatusOf('invite')).toBe('invite');
    expect(signupStatusOf('closed')).toBe('closed');
    expect(signupStatusOf('anything')).toBe('closed');
    expect(signupStatusOf(undefined)).toBe('open');
  });

  it('shows only https links', () => {
    expect(safeSignupLink('https://app.example.com/signup')).toBe('https://app.example.com/signup');
    expect(safeSignupLink('http://app.example.com')).toBeNull();
    expect(safeSignupLink('javascript:alert(1)')).toBeNull();
    expect(safeSignupLink('not a url')).toBeNull();
    expect(safeSignupLink(null)).toBeNull();
  });

  it('has a text for every refusal code', () => {
    for (const code of ['SIGNUP_CLOSED', 'SIGNUP_INVITE_REQUIRED', 'SIGNUP_INVITE_INVALID']) {
      expect(SIGNUP_REFUSAL_MESSAGES[code]).toBeTruthy();
    }
  });
});

describe('signup gate (master parameters)', () => {
  it('round-trips the reopen time through datetime-local', () => {
    const local = isoToLocalDateTime('2026-12-01T15:30:00.000Z');
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(localDateTimeToIso(local)).toBe('2026-12-01T15:30:00.000Z');
    expect(isoToLocalDateTime(null)).toBe('');
    expect(localDateTimeToIso('')).toBeNull();
  });

  it('describes audit entries', () => {
    expect(
      signupAuditDetail(
        {
          action: 'policy_saved',
          details: { before: { mode: 'open' }, after: { mode: 'closed', maxTenants: 150 } },
        },
        t,
      ),
    ).toBe('Signup open → Signup closed · Tenant limit: 150');
    expect(
      signupAuditDetail(
        { action: 'invite_used', inviteHint: 'R1ZC', targetEmail: 'a@example.com' },
        t,
      ),
    ).toBe('…R1ZC · a@example.com');
    expect(
      signupAuditDetail({ action: 'policy_saved', details: { before: {}, after: {} } }, t),
    ).toBe('Text, link or verification rule changed');
  });

  it('renders the capacity and reopen notifications', () => {
    const capacity = {
      type: 'platform.signup.capacity',
      params: { maxTenants: 150 },
      lastEventAt: null,
    } as unknown as InboxNotification;
    expect(notificationIcon(capacity)).toBe('group_off');
    expect(notificationTitle(capacity, t)).toBe('notifications.signupCapacity:150');
    const reopened = {
      type: 'platform.signup.reopened',
      params: {},
      lastEventAt: null,
    } as unknown as InboxNotification;
    expect(notificationTitle(reopened, t)).toBe('notifications.signupReopened');
  });
});
