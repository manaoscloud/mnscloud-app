import {
  notificationDescription,
  notificationIcon,
  notificationTitle,
} from './notification-display';
import type { InboxNotification } from './notification-inbox.service';
import {
  localizedText,
  productLabel,
  releaseNoteIcon,
  releaseNotesRssUrl,
} from './release-note.service';

describe('release note display helpers', () => {
  it('uses the user language, then English, Portuguese and Spanish', () => {
    const value = { 'pt-BR': 'Painel', 'en-US': 'Panel', 'es-ES': null };
    expect(localizedText(value, 'pt-BR')).toBe('Painel');
    expect(localizedText(value, 'es-ES')).toBe('Panel');
    expect(localizedText({ 'es-ES': 'Panel ES' }, 'pt-BR')).toBe('Panel ES');
    expect(localizedText(undefined, 'pt-BR')).toBe('');
  });

  it('names products and types', () => {
    expect(productLabel('mnscloud-api')).toBe('API');
    expect(productLabel('mnscloud-customer-portal')).toBe('Portal');
    expect(productLabel('mnscloud-agent')).toBe('Agent');
    expect(releaseNoteIcon('security')).toBe('verified_user');
    expect(releaseNoteIcon('other')).toBe('campaign');
  });
});

describe('release note channels', () => {
  it('builds the RSS link of the same origin with language and module', () => {
    const url = new URL(releaseNotesRssUrl('es-ES', 'module.dns'));
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/api/v1/public/release-notes/rss');
    expect(url.searchParams.get('lang')).toBe('es-ES');
    expect(url.searchParams.get('module')).toBe('module.dns');
    expect(new URL(releaseNotesRssUrl('pt-BR')).searchParams.has('module')).toBeFalse();
  });

  it('shows a delivered idea in the bell with the note title in the user language', () => {
    const item = {
      type: 'release_note.published',
      params: {
        code: 'IDEA-AAAA-BBBB-CCCC',
        titlePt: 'Painel',
        titleEn: 'Panel',
        subject: 'Ideia',
      },
      lastEventAt: null,
    } as unknown as InboxNotification;
    expect(notificationIcon(item)).toBe('campaign');
    expect(notificationTitle(item, (key, params) => `${key}:${params?.['code']}`)).toBe(
      'notifications.releaseNotePublished:IDEA-AAAA-BBBB-CCCC',
    );
    expect(notificationDescription(item, 'en-US')).toBe('Panel');
    expect(notificationDescription(item, 'pt-BR')).toBe('Painel');
    expect(notificationDescription(item, 'es-ES')).toBe('Panel');
  });
});
