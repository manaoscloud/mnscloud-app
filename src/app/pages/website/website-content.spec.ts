import {
  isWebsiteHref,
  moveEntry,
  newSection,
  normalizeWebsiteContent,
  orderedLocales,
  setContentValue,
  validateWebsiteContent,
  websiteContentPayload,
  websiteSiteUrl,
} from './website-content';
import { websiteSitePayload, websiteSiteRow } from './sites/sites';

describe('Website content v1', () => {
  it('orders the enabled locales with the default first and drops unknown codes', () => {
    expect(orderedLocales(['es-ES', 'xx', 'pt-BR'], 'en-US')).toEqual(['en-US', 'pt-BR', 'es-ES']);
    expect(orderedLocales([], 'pt-BR')).toEqual(['pt-BR']);
  });

  it('completes a new site with every bound field and the default theme', () => {
    const content = normalizeWebsiteContent(null, ['pt-BR', 'en-US']);
    expect(content.version).toBe(1);
    expect(content.theme.primaryColor).toBe('#1d5b31');
    expect(Object.keys(content.locales)).toEqual(['pt-BR', 'en-US']);
    expect(content.locales['pt-BR']?.hero.primaryCta).toEqual({ label: '', href: '' });
  });

  it('keeps stored sections and drops unknown section types and networks', () => {
    const content = normalizeWebsiteContent(
      {
        social: [
          { network: 'instagram', url: 'https://instagram.com/a' },
          { network: 'myspace', url: 'https://x' },
        ],
        locales: {
          'pt-BR': {
            sections: [{ id: 'a', type: 'weird', title: 'T', items: [{ title: 'i' }] }],
          },
        },
      },
      ['pt-BR'],
    );
    expect(content.social).toEqual([{ network: 'instagram', url: 'https://instagram.com/a' }]);
    expect(content.locales['pt-BR']?.sections[0]).toEqual({
      id: 'a',
      type: 'text',
      title: 'T',
      text: '',
      items: [{ title: 'i', text: '' }],
    });
  });

  it('sets nested values by path without touching the original', () => {
    const content = normalizeWebsiteContent(null, ['pt-BR']);
    const next = setContentValue(content, 'pt-BR.hero.title', 'Olá');
    expect(next.locales['pt-BR']?.hero.title).toBe('Olá');
    expect(content.locales['pt-BR']?.hero.title).toBe('');
    expect(setContentValue(content, 'theme.unknown', 'x')).toBe(content);
  });

  it('adds sections with stable ids and reorders entries', () => {
    const first = newSection('features', []);
    const second = newSection('faq', [first]);
    expect([first.id, second.id]).toEqual(['s1', 's2']);
    expect(first.items.length).toBe(1);
    expect(newSection('text', []).items).toEqual([]);
    expect(moveEntry(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveEntry(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('accepts only the link forms the API accepts', () => {
    for (const ok of [
      '',
      'https://example.com/x',
      '/contact',
      '#offers',
      'mailto:a@b.co',
      'tel:+55 11 9999-0000',
    ]) {
      expect(isWebsiteHref(ok)).withContext(ok).toBeTrue();
    }
    for (const bad of ['http://example.com', 'javascript:alert(1)', '//evil.com', 'ftp://x.y']) {
      expect(isWebsiteHref(bad)).withContext(bad).toBeFalse();
    }
  });

  it('requires the SEO and hero titles only to publish', () => {
    const content = normalizeWebsiteContent(null, ['pt-BR']);
    expect(validateWebsiteContent(content, ['pt-BR'], false)).toEqual([]);
    expect(validateWebsiteContent(content, ['pt-BR'], true).map((e) => e.path)).toEqual([
      'pt-BR.seo.title',
      'pt-BR.hero.title',
    ]);
  });

  it('flags invalid colors, links and incomplete items in visual order', () => {
    let content = normalizeWebsiteContent(null, ['pt-BR']);
    content = setContentValue(content, 'theme.primaryColor', 'green');
    content = setContentValue(content, 'pt-BR.hero.primaryCta.label', 'Buy');
    content.locales['pt-BR']!.sections = [
      { id: 's1', type: 'faq', title: '', text: '', items: [{ title: '', text: 'answer' }] },
    ];
    expect(validateWebsiteContent(content, ['pt-BR'], false).map((e) => e.path)).toEqual([
      'theme.primaryColor',
      'pt-BR.hero.primaryCta.href',
      'pt-BR.sections.0.items.0.title',
    ]);
  });

  it('sends trimmed content of the enabled locales only, without empty items', () => {
    let content = normalizeWebsiteContent({ locales: { 'es-ES': {} } }, ['pt-BR']);
    content = setContentValue(content, 'pt-BR.seo.title', '  Loja  ');
    content.locales['pt-BR']!.sections = [
      { id: 's1', type: 'features', title: 'A', text: '', items: [{ title: ' ', text: '' }] },
    ];
    const payload = websiteContentPayload(content, ['pt-BR']);
    expect(Object.keys(payload.locales)).toEqual(['pt-BR']);
    expect(payload.locales['pt-BR']?.seo.title).toBe('Loja');
    expect(payload.locales['pt-BR']?.sections[0].items).toEqual([]);
  });

  it('builds the public address from the custom domain, else the automatic one', () => {
    expect(websiteSiteUrl({ autoDomain: 'abc123.site.example.com' })).toBe(
      'https://abc123.site.example.com',
    );
    expect(websiteSiteUrl({ autoDomain: 'a.example.com', customDomain: 'shop.example.org' })).toBe(
      'https://shop.example.org',
    );
    expect(websiteSiteUrl({ autoDomain: 'not a host' })).toBeNull();
  });

  it('site payload always includes the default locale and sends the revision on update', () => {
    expect(
      websiteSitePayload(
        { name: ' Shop ', defaultLocale: 'en-US', locales: ['pt-BR'], themeDomainUUID: '' },
        false,
      ),
    ).toEqual({
      name: 'Shop',
      defaultLocale: 'en-US',
      locales: ['en-US', 'pt-BR'],
      themeDomainUUID: null,
    });
    expect(
      websiteSitePayload(
        {
          name: 'S',
          defaultLocale: 'pt-BR',
          locales: ['pt-BR'],
          themeDomainUUID: 't',
          revision: '3',
        },
        true,
      )['revision'],
    ).toBe(3);
  });

  it('flattens the nested DNS state of a list row', () => {
    const row = websiteSiteRow({
      siteUUID: 'u',
      dns: { status: 'failed', error: 'x', canRetry: true },
      publishedVersion: 0,
    });
    expect(row['dnsState']).toBe('failed');
    expect(row['dnsCanRetry']).toBeTrue();
    expect(row['publishedVersion']).toBeNull();
    expect(websiteSiteRow({ dns: { status: null } })['dnsState']).toBe('external');
  });
});
