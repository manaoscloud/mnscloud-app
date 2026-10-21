import { LoginAppearance } from '../shared/auth-shell/login-appearance';
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
  LoginAppearance?: LoginAppearance;
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
  private readonly loadTimeoutMs = 2500;

  readonly loaded = signal(false);

  readonly context = signal<PublicThemeRuntimeContext | null>(null);

  brandTitle(): string {
    return this.context()?.PageTitle?.trim() || this.fallbackTitle;
  }

  async load(): Promise<void> {
    if (typeof window === 'undefined') return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.loadTimeoutMs);

    try {
      const res = await fetch(resolveApiUrl('public/theme/context'), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`theme context failed: ${res.status}`);
      const response = (await res.json()) as PublicThemeContextResponse;
      const context = response?.data?.context ?? null;
      this.context.set(context);
      this.apply(context);
    } catch {
      this.apply(null);
    } finally {
      window.clearTimeout(timeout);
      this.loaded.set(true);
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

    // The tenant favicon replaces every default icon (browsers prefer the SVG one otherwise).
    this.document
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => link.remove());
    for (const rel of ['icon', 'apple-touch-icon']) {
      const element = this.document.createElement('link');
      element.setAttribute('rel', rel);
      element.setAttribute('href', value);
      this.document.head.appendChild(element);
    }
  }

  private setPrimaryColor(value: string | null) {
    if (!value) {
      this.document.documentElement.style.removeProperty('--tenant-primary-color');
      return;
    }

    this.document.documentElement.style.setProperty('--tenant-primary-color', value);
  }
}
