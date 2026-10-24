import { Injectable, inject } from '@angular/core';

import { ApiService } from './api.service';

/** Release note types (workspace docs/release-notes.md). */
export const RELEASE_NOTE_TYPES = [
  'new',
  'improvement',
  'fix',
  'security',
  'breaking',
  'deprecated',
] as const;
export type ReleaseNoteType = (typeof RELEASE_NOTE_TYPES)[number];
export const RELEASE_NOTE_AUDIENCES = ['tenant', 'admin', 'developer'] as const;
export type ReleaseNoteLocale = 'pt-BR' | 'en-US' | 'es-ES';
type Localized = Partial<Record<ReleaseNoteLocale, string | null>>;

/** One entry of `GET /release-notes`: a feature, shown once every component is deployed here. */
export interface ReleaseNote {
  uuid: string;
  featureKey: string;
  type: ReleaseNoteType | string;
  audience: string;
  modules: string[];
  title: Localized;
  text: Localized;
  action: Localized;
  ideaCode: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  status: 'live' | 'pending';
  components: { product: string; version: string; deployed?: boolean }[];
}

export interface ReleaseNoteQuery {
  scope: 'mine' | 'all';
  status: 'live' | 'pending';
}

const FALLBACK: readonly ReleaseNoteLocale[] = ['en-US', 'pt-BR', 'es-ES'];

/** Text in the user language, else English, Portuguese, Spanish. */
export function localizedText(value: Localized | undefined, language: string): string {
  if (!value) return '';
  const order = [language as ReleaseNoteLocale, ...FALLBACK];
  for (const locale of order) {
    const text = value[locale];
    if (text) return text;
  }
  return '';
}

/** Material icon of a release note type. */
export function releaseNoteIcon(type: string): string {
  switch (type) {
    case 'new':
      return 'new_releases';
    case 'improvement':
      return 'trending_up';
    case 'fix':
      return 'build';
    case 'security':
      return 'verified_user';
    case 'breaking':
      return 'warning';
    case 'deprecated':
      return 'event_busy';
    default:
      return 'campaign';
  }
}

/** Product name shown beside a component version (`mnscloud-api` → `API`). */
export function productLabel(product: string): string {
  const name = product.replace(/^mnscloud-/, '');
  const known: Record<string, string> = {
    api: 'API',
    app: 'App',
    db: 'DB',
    'customer-portal': 'Portal',
    phoneweb: 'PhoneWeb',
    pos: 'POS',
    pulse: 'Pulse',
  };
  return known[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

/** Weekly e-mail digest of the signed-in user (`/release-notes/subscription`). */
export interface ReleaseNoteDigest {
  enabled: boolean;
  locale: ReleaseNoteLocale;
  scope: 'mine' | 'all';
  lastSentAt: string | null;
  nextDueAt: string | null;
}

/** RSS 2.0 feed of the public changelog of this environment (same origin as the App). */
export function releaseNotesRssUrl(language: string, module = ''): string {
  const params = new URLSearchParams({ lang: language });
  if (module) params.set('module', module);
  return `${window.location.origin}/api/v1/public/release-notes/rss?${params.toString()}`;
}

/** Release notes of this environment (`GET /release-notes`). UX only: the API filters access. */
@Injectable({ providedIn: 'root' })
export class ReleaseNoteService {
  private readonly api = inject(ApiService);

  async list(query: ReleaseNoteQuery): Promise<ReleaseNote[]> {
    const params = new URLSearchParams({ scope: query.scope, status: query.status });
    const response = await this.api.get<{ data?: { items?: ReleaseNote[] } }>(
      `release-notes?${params.toString()}`,
    );
    return response?.data?.items ?? [];
  }

  /** Public changelog (every module), readable without signing in. */
  async publicList(): Promise<ReleaseNote[]> {
    const response = await this.api.get<{ data?: { items?: ReleaseNote[] } }>(
      'public/release-notes',
    );
    return response?.data?.items ?? [];
  }

  async digest(): Promise<ReleaseNoteDigest> {
    const response = await this.api.get<{ data: ReleaseNoteDigest }>('release-notes/subscription');
    return response.data;
  }

  async saveDigest(digest: Pick<ReleaseNoteDigest, 'enabled' | 'locale' | 'scope'>) {
    const response = await this.api.put<{ data: ReleaseNoteDigest }>(
      'release-notes/subscription',
      digest,
    );
    return response.data;
  }

  /** One-click unsubscribe from the signed link of a digest e-mail. */
  async unsubscribe(subscription: string, token: string): Promise<boolean> {
    const response = await this.api.post<{ data?: { unsubscribed?: boolean } }>(
      'public/release-notes/unsubscribe',
      { subscription, token },
    );
    return response?.data?.unsubscribed === true;
  }
}
