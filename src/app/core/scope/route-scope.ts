import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, Router } from '@angular/router';

/**
 * Scope declared by a route (app.md "Master pages and tenant data"): `master` for `/system` pages
 * (the `system` parent declares it for every child) and the other platform pages that declare it,
 * `tenant` for everything else. The endpoint and the tenant header come only from it, never from
 * the browser URL, browser storage or the user's permissions.
 */
export type RouteScope = 'master' | 'tenant';

/** The scope of a route snapshot: the deepest `data.scope` on its path from the root. */
export function routeScopeOf(snapshot: ActivatedRouteSnapshot | null | undefined): RouteScope {
  let scope: unknown;
  for (const step of snapshot?.pathFromRoot ?? []) {
    if (step.data?.['scope'] !== undefined) scope = step.data['scope'];
  }
  return scope === 'master' ? 'master' : 'tenant';
}

/** `true` when the page's own route is a platform (master) route; call in an injection context. */
export function injectPlatformScope(route: ActivatedRoute = inject(ActivatedRoute)): boolean {
  return routeScopeOf(route.snapshot) === 'master';
}

/** Scope of the route that is active now, for services that serve every page (API headers). */
@Injectable({ providedIn: 'root' })
export class RouteScopeService {
  private readonly router = inject(Router);

  current(): RouteScope {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState?.snapshot?.root ?? null;
    while (snapshot?.firstChild) snapshot = snapshot.firstChild;
    return routeScopeOf(snapshot);
  }

  /**
   * `data.apiScope` of the active route (deepest wins): `platform` on the delegated Cyber Security
   * pages, whose API calls then ask for the platform scope explicitly (`scope=platform`).
   */
  apiScope(): string | null {
    let scope: unknown = null;
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState?.snapshot?.root ?? null;
    while (snapshot) {
      if (snapshot.data?.['apiScope'] !== undefined) scope = snapshot.data['apiScope'];
      snapshot = snapshot.firstChild;
    }
    return typeof scope === 'string' ? scope : null;
  }

  isPlatform(): boolean {
    return this.current() === 'master';
  }

  /**
   * `true` while a page of the `system` route tree (`/system/*`) is active: those pages never send
   * the tenant header. Read from the route configuration, not from the browser URL.
   */
  isSystemTree(): boolean {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState?.snapshot?.root ?? null;
    while (snapshot) {
      if (snapshot.routeConfig?.path === 'system') return true;
      snapshot = snapshot.firstChild;
    }
    return false;
  }
}
