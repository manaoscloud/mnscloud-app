import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Route, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** Languages a tutorial video can be recorded in (same as the App languages). */
export const HELP_VIDEO_LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
export type HelpVideoLocale = (typeof HELP_VIDEO_LOCALES)[number];

/** Order used when the page has no video in the user language. */
const FALLBACK_ORDER: readonly HelpVideoLocale[] = ['en-US', 'pt-BR', 'es-ES'];
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const REFRESH_MS = 10 * 60_000;

/** One active tutorial video (API `GET /help/videos`). */
export interface HelpVideo {
  Route: string;
  Locale: HelpVideoLocale | string;
  Title: string;
  YoutubeVideoId: string;
}

type CatalogResponse = { data?: { items?: HelpVideo[] } };

/** Angular Router pattern of the active page, e.g. `/voip/pabx/trunks` or `/x/:uuid`. */
export function activeRoutePattern(router: Router): string {
  const parts: string[] = [];
  let snapshot = router.routerState.snapshot.root.firstChild;
  while (snapshot) {
    const path = snapshot.routeConfig?.path;
    if (path) parts.push(path);
    snapshot = snapshot.firstChild;
  }
  return `/${parts.join('/')}`;
}

/** Every page of the App (route pattern + title), for the route select of Settings › Help videos. */
export function appRoutePatterns(
  routes: readonly Route[],
  prefix = '',
): { route: string; title: string }[] {
  const pages: { route: string; title: string }[] = [];
  for (const route of routes) {
    if (route.redirectTo !== undefined || route.path === '**') continue;
    const path = [prefix, route.path ?? ''].filter(Boolean).join('/');
    if (route.component || route.loadComponent) {
      const title =
        typeof route.title === 'string' ? route.title.replace(/\s*\|\s*mnscloud$/i, '') : '';
      pages.push({ route: `/${path}`, title });
    }
    if (route.children?.length) pages.push(...appRoutePatterns(route.children, path));
  }
  const seen = new Set<string>();
  return pages.filter((page) => !seen.has(page.route) && seen.add(page.route));
}

/** The video of a route in the given language, or in the first other language that has one. */
export function pickHelpVideo(
  videos: readonly HelpVideo[],
  route: string,
  language: string,
): HelpVideo | null {
  const ofRoute = videos.filter(
    (video) => video.Route === route && VIDEO_ID.test(video.YoutubeVideoId),
  );
  if (!ofRoute.length) return null;
  for (const locale of [language, ...FALLBACK_ORDER]) {
    const video = ofRoute.find((item) => item.Locale === locale);
    if (video) return video;
  }
  return ofRoute[0];
}

/**
 * Tutorial videos of the App: the active catalog is read once per session (and every 10 minutes)
 * and `current` is the video of the open page in the user language, so the button beside
 * "Report problem" appears only where a video exists. UX only; the API owns the catalog.
 */
@Injectable({ providedIn: 'root' })
export class HelpVideoService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private generation = 0;

  readonly videos = signal<readonly HelpVideo[]>([]);
  private readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  private readonly route = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => activeRoutePattern(this.router)),
    ),
    { initialValue: activeRoutePattern(this.router) },
  );
  /** Video of the open page, in the user language when it exists. */
  readonly current = computed(() => pickHelpVideo(this.videos(), this.route(), this.language()));

  constructor() {
    effect(() => {
      this.auth.isLoggedIn();
      void this.refresh();
    });
    const timer = setInterval(() => void this.refresh(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** Reloads the catalog (after sign-in and after Settings › Help videos saves a change). */
  async refresh(): Promise<void> {
    const generation = ++this.generation;
    if (!this.auth.isLoggedIn()) {
      this.videos.set([]);
      return;
    }
    try {
      const response = await this.api.get<CatalogResponse>('help/videos', { silent: true });
      if (generation === this.generation) this.videos.set(response?.data?.items ?? []);
    } catch {
      // Help is optional: keep the last catalog when the API is unreachable.
    }
  }
}
