/**
 * Website storefront content v1 (workspace `docs/handoffs/2026-10-23-website-storefront-program.md`
 * §11.5). The App only edits the shape and checks obvious form errors before submit; the API
 * validates the schema, size, links and colors again and stays the authority.
 */

export const WEBSITE_LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
export type WebsiteLocale = (typeof WEBSITE_LOCALES)[number];

export const WEBSITE_LOCALE_OPTIONS = [
  { value: 'pt-BR', label: 'website.locale.ptBR' },
  { value: 'en-US', label: 'website.locale.enUS' },
  { value: 'es-ES', label: 'website.locale.esES' },
] as const;

export const WEBSITE_SECTION_TYPES = ['features', 'text', 'faq', 'cta', 'offers'] as const;
export type WebsiteSectionType = (typeof WEBSITE_SECTION_TYPES)[number];

export const WEBSITE_SECTION_TYPE_OPTIONS = WEBSITE_SECTION_TYPES.map((value) => ({
  value,
  label: `website.sectionType.${value}`,
}));

/** Section types whose items the editor lists (offers are filled by phase S2). */
export const WEBSITE_SECTION_TYPES_WITH_ITEMS: readonly WebsiteSectionType[] = ['features', 'faq'];

export const WEBSITE_SOCIAL_NETWORKS = [
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'x',
  'tiktok',
  'whatsapp',
] as const;
export type WebsiteSocialNetwork = (typeof WEBSITE_SOCIAL_NETWORKS)[number];

/** Network names are brands: they stay literal in every language. */
export const WEBSITE_SOCIAL_OPTIONS: { value: WebsiteSocialNetwork; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export type WebsiteLink = { label: string; href: string };
export type WebsiteSectionItem = { title: string; text: string };
export type WebsiteSection = {
  id: string;
  type: WebsiteSectionType;
  title: string;
  text: string;
  items: WebsiteSectionItem[];
};
export type WebsiteLocaleContent = {
  seo: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    text: string;
    primaryCta: WebsiteLink;
    secondaryCta: WebsiteLink;
  };
  sections: WebsiteSection[];
  footer: { text: string };
  legal: { privacy: string; terms: string };
};
export type WebsiteContent = {
  version: 1;
  theme: { primaryColor: string; accentColor: string; logoUrl: string };
  contact: { email: string; phone: string; whatsapp: string; address: string };
  social: { network: WebsiteSocialNetwork; url: string }[];
  locales: Partial<Record<WebsiteLocale, WebsiteLocaleContent>>;
};

export const DEFAULT_PRIMARY_COLOR = '#1d5b31';
export const DEFAULT_ACCENT_COLOR = '#f5832e';

const COLOR = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isWebsiteLocale(value: unknown): value is WebsiteLocale {
  return typeof value === 'string' && (WEBSITE_LOCALES as readonly string[]).includes(value);
}

/** Enabled locales in canonical order, default first; unknown codes are dropped. */
export function orderedLocales(
  locales: readonly unknown[],
  defaultLocale: unknown,
): WebsiteLocale[] {
  const set = new Set(locales.filter(isWebsiteLocale));
  if (isWebsiteLocale(defaultLocale)) set.add(defaultLocale);
  const ordered = WEBSITE_LOCALES.filter((locale) => set.has(locale));
  return isWebsiteLocale(defaultLocale)
    ? [defaultLocale, ...ordered.filter((locale) => locale !== defaultLocale)]
    : ordered;
}

export function emptyLocaleContent(): WebsiteLocaleContent {
  return {
    seo: { title: '', description: '' },
    hero: {
      eyebrow: '',
      title: '',
      text: '',
      primaryCta: { label: '', href: '' },
      secondaryCta: { label: '', href: '' },
    },
    sections: [],
    footer: { text: '' },
    legal: { privacy: '', terms: '' },
  };
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function link(value: unknown): WebsiteLink {
  const source = record(value);
  return { label: text(source['label']), href: text(source['href']) };
}

function section(value: unknown, index: number): WebsiteSection {
  const source = record(value);
  const type = (WEBSITE_SECTION_TYPES as readonly string[]).includes(String(source['type']))
    ? (source['type'] as WebsiteSectionType)
    : 'text';
  const items = Array.isArray(source['items']) ? source['items'] : [];
  return {
    id: text(source['id']) || `s${index + 1}`,
    type,
    title: text(source['title']),
    text: text(source['text']),
    items: items.map((item) => {
      const entry = record(item);
      return { title: text(entry['title']), text: text(entry['text']) };
    }),
  };
}

function localeContent(value: unknown): WebsiteLocaleContent {
  const source = record(value);
  const seo = record(source['seo']);
  const hero = record(source['hero']);
  const footer = record(source['footer']);
  const legal = record(source['legal']);
  const sections = Array.isArray(source['sections']) ? source['sections'] : [];
  return {
    seo: { title: text(seo['title']), description: text(seo['description']) },
    hero: {
      eyebrow: text(hero['eyebrow']),
      title: text(hero['title']),
      text: text(hero['text']),
      primaryCta: link(hero['primaryCta']),
      secondaryCta: link(hero['secondaryCta']),
    },
    sections: sections.map((item, index) => section(item, index)),
    footer: { text: text(footer['text']) },
    legal: { privacy: text(legal['privacy']), terms: text(legal['terms']) },
  };
}

/**
 * Complete v1 content from whatever the API returned (null for a new site): every field the
 * editor binds exists, and each enabled locale has its block (other locales are kept as they are).
 */
export function normalizeWebsiteContent(
  value: unknown,
  locales: readonly WebsiteLocale[],
): WebsiteContent {
  const source = record(value);
  const theme = record(source['theme']);
  const contact = record(source['contact']);
  const social = Array.isArray(source['social']) ? source['social'] : [];
  const storedLocales = record(source['locales']);
  const result: WebsiteContent['locales'] = {};
  for (const locale of WEBSITE_LOCALES) {
    if (locale in storedLocales || locales.includes(locale)) {
      result[locale] = localeContent(storedLocales[locale]);
    }
  }
  return {
    version: 1,
    theme: {
      primaryColor: text(theme['primaryColor']) || DEFAULT_PRIMARY_COLOR,
      accentColor: text(theme['accentColor']) || DEFAULT_ACCENT_COLOR,
      logoUrl: text(theme['logoUrl']),
    },
    contact: {
      email: text(contact['email']),
      phone: text(contact['phone']),
      whatsapp: text(contact['whatsapp']),
      address: text(contact['address']),
    },
    social: social
      .map((entry) => record(entry))
      .filter((entry) =>
        (WEBSITE_SOCIAL_NETWORKS as readonly string[]).includes(String(entry['network'])),
      )
      .map((entry) => ({
        network: entry['network'] as WebsiteSocialNetwork,
        url: text(entry['url']),
      })),
    locales: result,
  };
}

/** Next free section id (`s<n>`), stable across reorders. */
export function nextSectionId(sections: readonly WebsiteSection[]): string {
  const used = new Set(sections.map((entry) => entry.id));
  let index = sections.length + 1;
  while (used.has(`s${index}`)) index += 1;
  return `s${index}`;
}

export function newSection(
  type: WebsiteSectionType,
  sections: readonly WebsiteSection[],
): WebsiteSection {
  return {
    id: nextSectionId(sections),
    type,
    title: '',
    text: '',
    items: WEBSITE_SECTION_TYPES_WITH_ITEMS.includes(type) ? [{ title: '', text: '' }] : [],
  };
}

/** Moves the entry at `index` by `delta` positions; out-of-range moves return the same list. */
export function moveEntry<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [entry] = next.splice(index, 1);
  next.splice(target, 0, entry);
  return next;
}

/** `https://`, site-relative (`/`, `#`), `mailto:` and `tel:` links, as the API accepts. */
export function isWebsiteHref(value: string): boolean {
  const href = value.trim();
  if (!href) return true;
  if (/^https:\/\/[^\s/]+\.[^\s]+$/i.test(href)) return true;
  if (/^(\/(?!\/)|#)[^\s]*$/.test(href)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return true;
  return /^tel:\+?[0-9 ()-]{3,}$/i.test(href);
}

export function isHttpsUrl(value: string): boolean {
  const url = value.trim();
  return !url || /^https:\/\/[^\s/]+\.[^\s]+$/i.test(url);
}

export function isWebsiteColor(value: string): boolean {
  return COLOR.test(value.trim());
}

/** Error of one content field: dotted path (`pt-BR.hero.title`, `theme.primaryColor`) + message. */
export type WebsiteContentError = { path: string; message: string };

export const REQUIRED_MESSAGE = 'form.validation.required';
const LINK_MESSAGE = 'website.validation.link';
const URL_MESSAGE = 'website.validation.httpsUrl';
const COLOR_MESSAGE = 'website.validation.color';
const EMAIL_MESSAGE = 'website.validation.email';

/**
 * Obvious form errors, in the editor's visual order (shared panel, then each locale tab).
 * Formats are always checked; `publishing` also requires the SEO and hero titles of every
 * enabled locale, which a published page cannot go without.
 */
export function validateWebsiteContent(
  content: WebsiteContent,
  locales: readonly WebsiteLocale[],
  publishing: boolean,
): WebsiteContentError[] {
  const errors: WebsiteContentError[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });
  if (!isWebsiteColor(content.theme.primaryColor)) add('theme.primaryColor', COLOR_MESSAGE);
  if (!isWebsiteColor(content.theme.accentColor)) add('theme.accentColor', COLOR_MESSAGE);
  if (!isHttpsUrl(content.theme.logoUrl)) add('theme.logoUrl', URL_MESSAGE);
  const email = content.contact.email.trim();
  if (email && !EMAIL.test(email)) add('contact.email', EMAIL_MESSAGE);
  content.social.forEach((entry, index) => {
    if (!entry.url.trim()) add(`social.${index}.url`, REQUIRED_MESSAGE);
    else if (!isHttpsUrl(entry.url)) add(`social.${index}.url`, URL_MESSAGE);
  });
  for (const locale of locales) {
    const block = content.locales[locale] ?? emptyLocaleContent();
    const at = (path: string) => `${locale}.${path}`;
    if (publishing && !block.seo.title.trim()) add(at('seo.title'), REQUIRED_MESSAGE);
    if (publishing && !block.hero.title.trim()) add(at('hero.title'), REQUIRED_MESSAGE);
    for (const cta of ['primaryCta', 'secondaryCta'] as const) {
      const value = block.hero[cta];
      if (value.label.trim() && !value.href.trim()) add(at(`hero.${cta}.href`), REQUIRED_MESSAGE);
      else if (!isWebsiteHref(value.href)) add(at(`hero.${cta}.href`), LINK_MESSAGE);
    }
    block.sections.forEach((entry, index) => {
      entry.items.forEach((item, itemIndex) => {
        if (!item.title.trim() && item.text.trim()) {
          add(at(`sections.${index}.items.${itemIndex}.title`), REQUIRED_MESSAGE);
        }
      });
    });
  }
  return errors;
}

/** Content sent to the API: trimmed text, only the enabled locales. */
export function websiteContentPayload(
  content: WebsiteContent,
  locales: readonly WebsiteLocale[],
): WebsiteContent {
  const trim = (value: string) => value.trim();
  const localesPayload: WebsiteContent['locales'] = {};
  for (const locale of locales) {
    const block = content.locales[locale] ?? emptyLocaleContent();
    localesPayload[locale] = {
      seo: { title: trim(block.seo.title), description: trim(block.seo.description) },
      hero: {
        eyebrow: trim(block.hero.eyebrow),
        title: trim(block.hero.title),
        text: trim(block.hero.text),
        primaryCta: {
          label: trim(block.hero.primaryCta.label),
          href: trim(block.hero.primaryCta.href),
        },
        secondaryCta: {
          label: trim(block.hero.secondaryCta.label),
          href: trim(block.hero.secondaryCta.href),
        },
      },
      sections: block.sections.map((entry) => ({
        id: entry.id,
        type: entry.type,
        title: trim(entry.title),
        text: trim(entry.text),
        items: entry.items
          .map((item) => ({ title: trim(item.title), text: trim(item.text) }))
          .filter((item) => item.title || item.text),
      })),
      footer: { text: trim(block.footer.text) },
      legal: { privacy: trim(block.legal.privacy), terms: trim(block.legal.terms) },
    };
  }
  return {
    version: 1,
    theme: {
      primaryColor: trim(content.theme.primaryColor).toLowerCase(),
      accentColor: trim(content.theme.accentColor).toLowerCase(),
      logoUrl: trim(content.theme.logoUrl),
    },
    contact: {
      email: trim(content.contact.email),
      phone: trim(content.contact.phone),
      whatsapp: trim(content.contact.whatsapp),
      address: trim(content.contact.address),
    },
    social: content.social.map((entry) => ({ network: entry.network, url: trim(entry.url) })),
    locales: localesPayload,
  };
}

/** Public address of the site: the custom domain when bound, else the automatic one. */
export function websiteSiteUrl(site: {
  autoDomain?: unknown;
  customDomain?: unknown;
}): string | null {
  const host = text(site.customDomain).trim() || text(site.autoDomain).trim();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? `https://${host.toLowerCase()}` : null;
}

/** Root of a field path: a locale block (`pt-BR.hero.title`) or the shared part (`theme.logoUrl`). */
export function contentPathLocale(path: string): WebsiteLocale | null {
  const first = path.split('.')[0];
  return isWebsiteLocale(first) ? first : null;
}

/**
 * Copy of `content` with the value at `path` replaced. Locale paths start with the locale code;
 * numeric segments index lists (`pt-BR.sections.0.items.1.title`). Unknown paths change nothing.
 */
export function setContentValue(
  content: WebsiteContent,
  path: string,
  value: unknown,
): WebsiteContent {
  const next = structuredClone(content);
  const segments = path.split('.');
  const locale = contentPathLocale(path);
  let target: unknown = next;
  if (locale) {
    next.locales[locale] ??= emptyLocaleContent();
    target = next.locales[locale];
    segments.shift();
  }
  const last = segments.pop();
  for (const segment of segments) {
    if (!target || typeof target !== 'object') return content;
    target = (target as Record<string, unknown>)[segment];
  }
  if (!last || !target || typeof target !== 'object' || !(last in target)) return content;
  (target as Record<string, unknown>)[last] = value;
  return next;
}

/** Copy of `content` with the locale block replaced by `change(block)`. */
export function updateLocaleContent(
  content: WebsiteContent,
  locale: WebsiteLocale,
  change: (block: WebsiteLocaleContent) => WebsiteLocaleContent,
): WebsiteContent {
  const next = structuredClone(content);
  next.locales[locale] = change(next.locales[locale] ?? emptyLocaleContent());
  return next;
}
