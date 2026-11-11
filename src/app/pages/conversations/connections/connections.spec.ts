import {
  CREATABLE_CHANNEL_KINDS,
  storedOrigins,
  webchatConfig,
  websiteOrigin,
} from './connections';

describe('conversation connections form', () => {
  it('normalizes typed website addresses to exact HTTPS origins', () => {
    expect(websiteOrigin('')).toBe('');
    expect(websiteOrigin('www.example.com')).toBe('https://www.example.com');
    expect(websiteOrigin('https://example.com/contact?x=1')).toBe('https://example.com');
    expect(websiteOrigin('https://example.com:8443/')).toBe('https://example.com:8443');
    expect(websiteOrigin('http://example.com')).toBe('invalid');
    expect(websiteOrigin('*.example.com')).toBe('invalid');
    expect(websiteOrigin('https://user:pass@example.com')).toBe('invalid');
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
});
