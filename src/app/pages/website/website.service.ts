import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../services/api.service';
import type { WebsiteContent, WebsiteLocale } from './website-content';

/** Site as listed and returned by `GET /website/sites[/:uuid]` (mnscloud-api `WebsiteSite`). */
export type WebsiteSite = {
  siteUUID: string;
  id?: string | null;
  name: string;
  status: 'draft' | 'published' | 'suspended' | string;
  defaultLocale: WebsiteLocale | string;
  locales: (WebsiteLocale | string)[];
  autoLabel?: string | null;
  autoDomain: string | null;
  themeDomainUUID: string | null;
  themeDomain: string | null;
  /** Custom domain when set, otherwise the automatic address (built by the API). */
  siteUrl: string | null;
  /** 0 = never published. */
  publishedVersion: number;
  publishedAt: string | null;
  revision: number;
  hasUnpublishedChanges?: boolean;
  /** Automatic domain DNS publication; `status` is null when the platform does not publish. */
  dns?: { status: string | null; error: string | null; canRetry: boolean } | null;
  /** Only on the detail (and on mutations that return it). */
  draftContent?: unknown;
  dateCreated?: string | null;
  dateUpdated?: string | null;
};

/** The site with its draft content and whether it differs from the published one. */
export type WebsiteSiteDetail = {
  site: WebsiteSite;
  draftContent: unknown;
  hasUnpublishedChanges: boolean;
};

type Envelope<T> = { status?: string; message?: string; data?: T };

export const WEBSITE_SITES_ENDPOINT = 'website/sites';
export const WEBSITE_PARAMETERS_ENDPOINT = 'system/website/parameters';

/** True for the optimistic-revision failure of the site routes (`WEBSITE_REVISION_CONFLICT`). */
export function isRevisionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { error?: { code?: unknown } }).error?.code === 'WEBSITE_REVISION_CONFLICT';
}

/**
 * Editor path of a content validation failure: the API answers `VALIDATION_FAILED` with
 * `fields: ['content']` and `path: 'content.locales.pt-BR.hero.title'` → `pt-BR.hero.title`.
 */
export function websiteContentErrorPath(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const path = (error as { error?: { path?: unknown } }).error?.path;
  if (typeof path !== 'string' || !/^[A-Za-z0-9_.-]{1,200}$/.test(path)) return null;
  const relative = path.replace(/^content\.?/, '').replace(/^locales\./, '');
  return relative || null;
}

/**
 * Website site lifecycle calls (`mnscloud-api` `/website/sites*`). Every mutation carries the
 * revision the user is editing; the API rejects stale ones and owns status, DNS and publication.
 */
@Injectable({ providedIn: 'root' })
export class WebsiteService {
  private readonly api = inject(ApiService);

  async get(uuid: string): Promise<WebsiteSiteDetail> {
    const detail = this.detail(await this.api.get<Envelope<WebsiteSite>>(this.path(uuid)), true);
    if (!detail) throw new Error('Website site not found.');
    return detail;
  }

  async saveContent(
    uuid: string,
    revision: number,
    content: WebsiteContent,
  ): Promise<WebsiteSiteDetail | null> {
    const response = await this.api.put<Envelope<WebsiteSite>>(`${this.path(uuid)}/content`, {
      revision,
      content,
    });
    return this.detail(response);
  }

  async publish(uuid: string, revision: number): Promise<WebsiteSiteDetail | null> {
    return this.detail(
      await this.api.post<Envelope<WebsiteSite>>(`${this.path(uuid)}/publish`, { revision }),
    );
  }

  async unpublish(uuid: string, revision: number): Promise<WebsiteSiteDetail | null> {
    return this.detail(
      await this.api.post<Envelope<WebsiteSite>>(`${this.path(uuid)}/unpublish`, { revision }),
    );
  }

  async retryDns(uuid: string): Promise<void> {
    await this.api.post(`${this.path(uuid)}/dns/retry`, {});
  }

  private path(uuid: string): string {
    return `${WEBSITE_SITES_ENDPOINT}/${encodeURIComponent(uuid)}`;
  }

  /**
   * Mutations return the updated site; without its draft (or without a site) callers reload, so
   * the editor never replaces the draft with an empty one.
   */
  private detail(
    response: Envelope<WebsiteSite> | null | undefined,
    read = false,
  ): WebsiteSiteDetail | null {
    const site = response?.data;
    if (!site?.siteUUID) return null;
    if (!read && !('draftContent' in site)) return null;
    return {
      site,
      draftContent: site.draftContent ?? null,
      hasUnpublishedChanges: site.hasUnpublishedChanges === true,
    };
  }
}
