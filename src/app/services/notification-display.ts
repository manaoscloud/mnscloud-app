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
    case 'logs.account.cap_warning':
    case 'logs.account.capped':
      return 'receipt_long';
    case 'voip.pabx.extension.offline':
      return 'phone_disabled';
    case 'dns.monitor.target':
      return item.params['state'] === 'down' ? 'cloud_off' : 'cloud_done';
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
    case 'logs.account.cap_warning':
      return t('notifications.logsCapWarning', {
        account: param('account'),
        percent: param('percent'),
      });
    case 'logs.account.capped':
      return t('notifications.logsCapped', { account: param('account') });
    case 'voip.pabx.extension.offline':
      return t('notifications.pabxExtensionsOffline', {
        account: param('account'),
        count: param('count'),
        minutes: param('minutes'),
      });
    case 'dns.monitor.target':
      return t(
        param('state') === 'down'
          ? 'notifications.dnsTargetDown'
          : 'notifications.dnsTargetRecovered',
        { name: param('name') },
      );
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
        : item.type.startsWith('logs.account.')
          ? item.params['account']
          : item.type === 'voip.pabx.extension.offline'
            ? item.params['extensions']
            : item.type === 'dns.monitor.target'
              ? item.params['failing'] || item.params['target']
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
