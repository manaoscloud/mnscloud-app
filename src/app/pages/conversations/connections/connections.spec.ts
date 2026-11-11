import {
  CREATABLE_CHANNEL_KINDS,
  storedOrigins,
  webchatConfig,
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
    expect(CREATABLE_CHANNEL_KINDS.map((kind) => kind.value)).toEqual(['internal', 'webchat']);
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
});
