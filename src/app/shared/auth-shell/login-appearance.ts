export type LoginLocale = 'pt-BR' | 'en-US' | 'es-ES';
export const LOGIN_TEXT_FIELDS = [
  'title',
  'subtitle',
  'eyebrow',
  'heroTitle',
  'heroText',
  'supportLabel',
] as const;
export type LoginTextField = (typeof LOGIN_TEXT_FIELDS)[number];
export type LoginAppearance = {
  layout?: 'split' | 'compact';
  appearance?: 'system' | 'light' | 'dark';
  heroImageUrl?: string | null;
  supportUrl?: string | null;
  privacyUrl?: string | null;
  termsUrl?: string | null;
  texts?: Partial<Record<LoginLocale, Partial<Record<LoginTextField, string>>>>;
};
export function safeAppearanceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function brandColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#1264ed';
}
export function onBrandColor(hex: string): string {
  const rgb = [1, 3, 5].map((offset) => {
    const n = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.179 ? '#101828' : '#ffffff';
}
export function loginText(
  config: LoginAppearance,
  language: LoginLocale,
  key: LoginTextField,
): string | null {
  return config.texts?.[language]?.[key]?.trim() || null;
}
