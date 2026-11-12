import {
  emailConfig,
  whatsappPayload,
  CREATABLE_CHANNEL_KINDS,
  storedOrigins,
  webchatConfig,
  webchatFieldError,
  websiteOrigin,
} from './connections';
import { webchatPreviewDocument } from './webchat-preview-dialog';

describe('conversation connections form', () => {
  it('normalizes typed website addresses to exact HTTPS origins', () => {
    expect(websiteOrigin('')).toBe('');
    expect(websiteOrigin('www.example.com')).toBe('https://www.example.com');
    expect(websiteOrigin('https://example.com/contact?x=1')).toBe('https://example.com');
    expect(websiteOrigin('https://example.com:8443/')).toBe('https://example.com:8443');
    expect(websiteOrigin('http://example.com')).toBe('invalid');
    expect(websiteOrigin('*.example.com')).toBe('invalid');
    expect(websiteOrigin('https://user:pass@example.com')).toBe('invalid');
    expect(websiteOrigin('https://com')).toBe('invalid');
  });

  it('reads stored origins in every legacy shape', () => {
    expect(storedOrigins({ allowedOrigins: ['https://a.com', 'https://b.com'] })).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
    expect(storedOrigins('{"origins":"https://a.com, https://b.com"}')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
    expect(storedOrigins(null)).toEqual([]);
    expect(storedOrigins('[1]')).toEqual([]);
  });

  it('builds the website chat config from fields and keeps unknown keys', () => {
    const config = webchatConfig({
      storedConfig: JSON.stringify({ origins: ['https://old.com'], widget: { color: '#000000' } }),
      allowedOrigins: 'www.example.com',
      otherOrigins: 'shop.example.com\nhttps://www.example.com\n\n',
      allowSubdomains: 1,
    });
    expect(config).toEqual({
      widget: { color: '#000000' },
      allowedOrigins: ['https://www.example.com', 'https://shop.example.com'],
      allowSubdomains: true,
    });
  });

  it('offers only channels with a working driver when creating', () => {
    expect(CREATABLE_CHANNEL_KINDS.map((kind) => kind.value)).toEqual([
      'internal',
      'webchat',
      'whatsapp-cloud',
      'telegram',
      'email',
    ]);
  });

  it('stores only the filled e-mail settings, ports as numbers', () => {
    expect(
      emailConfig({
        imapHost: ' imap.example.com ',
        imapPort: '993',
        smtpPort: '',
        fromName: 'Suporte',
      }),
    ).toEqual({
      imapHost: 'imap.example.com',
      imapPort: 993,
      fromName: 'Suporte',
    });
    expect(emailConfig({})).toEqual({});
  });

  it('sends the WABA in the settings and only the typed WhatsApp secrets', () => {
    expect(whatsappPayload({ wabaId: ' 1022 ', token: ' EAAG ', appSecret: '' })).toEqual({
      ChcConfig: { wabaId: '1022' },
      ChcSecret: { token: 'EAAG' },
    });
    expect(whatsappPayload({ wabaId: '1022' })).toEqual({ ChcConfig: { wabaId: '1022' } });
  });

  it('stores the widget appearance and drops empty values', () => {
    const config = webchatConfig({
      storedConfig: JSON.stringify({ widgetSubtitle: 'old', widgetColor: '#000000' }),
      allowedOrigins: 'example.com',
      widgetTitle: ' Loja ',
      widgetColor: '#0f766e',
      widgetPosition: 'left',
      widgetSubtitle: '',
      widgetGreeting: 'Olá!',
    });
    expect(config).toEqual({
      widgetTitle: 'Loja',
      widgetColor: '#0F766E',
      widgetPosition: 'left',
      widgetGreeting: 'Olá!',
      allowedOrigins: ['https://example.com'],
      allowSubdomains: false,
    });
  });

  it('builds a preview page with escaped attributes only', () => {
    const html = webchatPreviewDocument({
      name: 'x',
      scriptUrl: 'https://app.example.com/api/v1/conversations/webchat/widget.js',
      channelUUID: 'ABC',
      look: { title: '"><script>alert(1)</script>', color: '#0F766E', subtitle: '' },
    });
    expect(html).toContain('data-open="true"');
    expect(html).toContain('data-color="#0F766E"');
    expect(html).not.toContain('data-subtitle');
    expect(html).toContain('data-title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html.match(/<script/g)?.length).toBe(1);
  });

  it('stores pre-chat and business hours only when enabled', () => {
    const off = webchatConfig({
      storedConfig: JSON.stringify({ hoursEnabled: true, hoursDays: [1], preChatMode: 'required' }),
      allowedOrigins: 'example.com',
      preChatMode: 'optional',
      hoursEnabled: 0,
      hoursDays: [1, 2],
    });
    expect(off).toEqual({ allowedOrigins: ['https://example.com'], allowSubdomains: false });
    const on = webchatConfig({
      allowedOrigins: 'example.com',
      preChatMode: 'required',
      hoursEnabled: 1,
      hoursTimezone: 'America/Manaus',
      hoursDays: [5, 1, '3'],
      hoursStart: '08:00',
      hoursEnd: '18:00',
      offlineBehavior: 'hide',
      offlineMessage: '  ',
    });
    expect(on).toEqual({
      preChatMode: 'required',
      hoursEnabled: true,
      hoursTimezone: 'America/Manaus',
      hoursDays: [1, 3, 5],
      hoursStart: '08:00',
      hoursEnd: '18:00',
      offlineBehavior: 'hide',
      allowedOrigins: ['https://example.com'],
      allowSubdomains: false,
    });
  });

  it('reports the first invalid website chat field in form order', () => {
    const ok = { kind: 'webchat', allowedOrigins: 'example.com' };
    expect(webchatFieldError({ kind: 'internal', allowedOrigins: 'http://x' })).toBeNull();
    expect(webchatFieldError(ok)).toBeNull();
    expect(webchatFieldError({ ...ok, allowedOrigins: 'http://x.com' })?.key).toBe(
      'allowedOrigins',
    );
    expect(webchatFieldError({ ...ok, otherOrigins: 'ok.com\n*.bad.com' })?.params).toEqual({
      value: '*.bad.com',
    });
    expect(webchatFieldError({ ...ok, widgetColor: 'blue' })?.key).toBe('widgetColor');
    expect(webchatFieldError({ ...ok, widgetTitle: 'x'.repeat(61) })?.key).toBe('widgetTitle');
    const hours = { ...ok, hoursEnabled: 1, hoursStart: '08:00', hoursEnd: '18:00' };
    expect(webchatFieldError(hours)).toBeNull();
    expect(webchatFieldError({ ...hours, hoursStart: '8h' })?.key).toBe('hoursStart');
    expect(webchatFieldError({ ...hours, hoursEnd: '08:00' })?.message).toBe(
      'conversations.hoursSameTime',
    );
    expect(webchatFieldError({ ...hours, hoursEnabled: 0, hoursStart: 'x' })).toBeNull();
  });
});
