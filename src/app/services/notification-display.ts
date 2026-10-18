import { featureRequestStatusLabel } from '../pages/support/shared/feature-requests';
import type { InboxNotification } from './notification-inbox.service';

type Translate = (key: string, params?: Record<string, string>) => string;

/** Icon by notification type (never by read state; the row style carries the state). */
export function notificationIcon(item: InboxNotification): string {
  switch (item.type) {
    case 'support.ticket.reply':
      return 'forum';
    case 'billing.subscription':
      return 'payments';
    case 'feature_request.status':
      return 'lightbulb';
    default:
      return 'notifications';
  }
}

export function notificationTitle(item: InboxNotification, t: Translate): string {
  const param = (key: string) => String(item.params[key] ?? '');
  switch (item.type) {
    case 'support.ticket.reply':
      return t('notifications.ticketReply', { protocol: param('protocol') });
    case 'billing.subscription':
      return t(`notifications.billing.${param('kind') || 'PAYMENT_FAILED'}`);
    case 'feature_request.status':
      return t('notifications.ideaStatus', {
        code: param('code'),
        status: featureRequestStatusLabel(param('status'), (key) => t(key)),
      });
    default:
      return t('notifications.generic');
  }
}

/** Subject/offer/title plus the local date of the last event. */
export function notificationDescription(item: InboxNotification, language: string): string {
  const subject =
    item.type === 'billing.subscription'
      ? item.params['offer']
      : item.type === 'feature_request.status'
        ? item.params['title']
        : item.params['subject'];
  const date = item.lastEventAt ? new Date(item.lastEventAt) : null;
  const when =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(date)
      : '';
  return [subject ? String(subject) : '', when].filter(Boolean).join(' · ');
}

/** Accessible name: the state first, so screen readers hear what the color shows. */
export function notificationAriaLabel(
  item: InboxNotification,
  t: Translate,
  language: string,
): string {
  const state = t(item.readAt ? 'notifications.read' : 'notifications.unread');
  return `${state}: ${notificationTitle(item, t)}. ${notificationDescription(item, language)}`;
}
