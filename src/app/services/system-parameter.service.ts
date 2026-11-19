import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TenantService } from './tenant.service';
import { Injectable, computed, inject } from '@angular/core';

import { AuthService } from './auth.service';
import { readStoredEnvironmentUUID } from '../core/environment/environment-context';
import { RouteScopeService } from '../core/scope/route-scope';
import { ApiService } from './api.service';
import { AppLanguage, isAppLanguage } from './app-i18n.service';

export type SystemParameterKey =
  | 'GOOGLE_MAPS_EMBED_API_KEY'
  | 'MAPBOX_TOKEN'
  | 'SIGNALWIRE_REPO_TOKEN'
  | 'DEFAULT_CURRENCY'
  | 'DEFAULT_LANGUAGE'
  | 'DEFAULT_TIMEZONE';

@Injectable({ providedIn: 'root' })
export class SystemParameterService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly scope = inject(RouteScopeService);
  private readonly tenants = inject(TenantService);
  private readonly navigation = toSignal(
    inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );
  private readonly cache = new Map<SystemParameterKey, Promise<string | null>>();
  private cacheContext = '';

  /** Same identity/session and effective environment as the API; cache scope is not authorization. */
  readonly context = computed(() => {
    this.navigation();
    this.tenants.selectedTenant();
    return this.contextKey();
  });

  /** Re-read effective storage scope on every request, including before navigation settles. */
  contextKey(): string {
    const user = this.auth.user();
    return JSON.stringify([
      this.auth.sessionGeneration(),
      user?.uuid ?? '',
      this.scope.current(),
      this.scope.isSystemTree() ? '' : (readStoredEnvironmentUUID() ?? user?.EnvironmentUUID ?? ''),
    ]);
  }

  resolveValue(key: SystemParameterKey): Promise<string | null> {
    const context = this.contextKey();
    if (context !== this.cacheContext) {
      this.cache.clear();
      this.cacheContext = context;
    }
    const cached = this.cache.get(key);
    if (cached) return cached;
    const request = this.fetchResolvedValue(key, context).catch((error) => {
      if (this.cache.get(key) === request) this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, request);
    return request;
  }

  clearCache(key?: SystemParameterKey) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  async resolveDefaultCurrency(fallback = 'BRL'): Promise<string> {
    const value = await this.resolveValue('DEFAULT_CURRENCY');
    return this.normalizeCurrency(value) ?? fallback;
  }

  async resolveDefaultTimezone(fallback = 'UTC'): Promise<string> {
    const value = await this.resolveValue('DEFAULT_TIMEZONE');
    return value?.trim() || fallback;
  }

  async resolveDefaultLanguage(fallback: AppLanguage = 'pt-BR'): Promise<AppLanguage> {
    const value = await this.resolveValue('DEFAULT_LANGUAGE');
    return isAppLanguage(value) ? value : fallback;
  }

  private async fetchResolvedValue(
    key: SystemParameterKey,
    context: string,
  ): Promise<string | null> {
    const endpoints = [`settings/parameters/resolve/${key}`, `system/parameters/resolve/${key}`];

    for (const endpoint of endpoints) {
      if (context !== this.contextKey()) throw new Error('Parameter context changed');
      let response: unknown;
      try {
        response = await this.api.get<unknown>(endpoint);
      } catch {
        // Tenant resolve already falls back to master; system is for master pages.
      }
      if (context !== this.contextKey()) throw new Error('Parameter context changed');
      const value = this.readValue(response);
      if (value) return value;
    }

    return null;
  }

  private readValue(response: unknown): string | null {
    const row = this.readRow(response);
    if (!row || typeof row !== 'object') return null;
    const item = row as Record<string, unknown>;
    if (Number(item['SprIsActive'] ?? 1) !== 1) return null;
    const value = item['SprValue'];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private readRow(response: unknown): unknown {
    if (!response || typeof response !== 'object') return null;

    const data = (response as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      const items = (data as { items?: unknown }).items;
      if (Array.isArray(items)) return items[0] ?? null;
    }

    return null;
  }

  private normalizeCurrency(value: string | null): string | null {
    const currency = value?.trim().toUpperCase();
    return currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
  }
}
