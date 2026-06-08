import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { resolveApiUrl } from '../shared/runtime/app-runtime-config';

export type PublicThemeRuntimeContext = {
  ThemeUUID: string;
  Domain: string;
  PageTitle: string;
  MetaDescription: string | null;
  LogoUrl: string | null;
  FaviconUrl: string | null;
  PrimaryColor: string | null;
  BrandingConfig: Record<string, unknown> | null;
};

type PublicThemeContextResponse = {
  status: 'success';
  message: string;
  data?: { context?: PublicThemeRuntimeContext | null };
};

@Injectable({ providedIn: 'root' })
export class PublicThemeContextService {
  private readonly document = inject(DOCUMENT);
  private readonly fallbackTitle = 'mnscloud';

  readonly context = signal<PublicThemeRuntimeContext | null>(null);

  brandTitle(): string {
    return this.context()?.PageTitle?.trim() || this.fallbackTitle;
  }

  async load(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const res = await fetch(resolveApiUrl('public/theme/context'), {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`theme context failed: ${res.status}`);
      const response = (await res.json()) as PublicThemeContextResponse;
      const context = response?.data?.context ?? null;
      this.context.set(context);
      this.apply(context);
    } catch {
      this.apply(null);
    }
  }

  private apply(context: PublicThemeRuntimeContext | null) {
    this.document.title = this.brandTitle();
    this.setMetaDescription(context?.MetaDescription ?? null);
    this.setFavicon(context?.FaviconUrl ?? null);
    this.setPrimaryColor(context?.PrimaryColor ?? null);
  }

  private setMetaDescription(value: string | null) {
    if (!value) return;

    const selector = 'meta[name="description"]';
    let element = this.document.querySelector<HTMLMetaElement>(selector);

    if (!element) {
      element = this.document.createElement('meta');
      element.setAttribute('name', 'description');
      this.document.head.appendChild(element);
    }

    element.setAttribute('content', value);
  }

  private setFavicon(value: string | null) {
    if (!value) return;

    const selector = 'link[rel="icon"]';
    let element = this.document.querySelector<HTMLLinkElement>(selector);

    if (!element) {
      element = this.document.createElement('link');
      element.setAttribute('rel', 'icon');
      this.document.head.appendChild(element);
    }

    element.setAttribute('href', value);
  }

  private setPrimaryColor(value: string | null) {
    if (!value) {
      this.document.documentElement.style.removeProperty('--tenant-primary-color');
      return;
    }

    this.document.documentElement.style.setProperty('--tenant-primary-color', value);
  }
}
