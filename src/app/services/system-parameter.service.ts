import { Injectable, inject } from '@angular/core';

import { ApiService } from './api.service';

export type SystemParameterKey =
  | 'GOOGLE_MAPS_EMBED_API_KEY'
  | 'MAPBOX_TOKEN'
  | 'DEFAULT_CURRENCY'
  | 'DEFAULT_LANGUAGE'
  | 'DEFAULT_TIMEZONE';

@Injectable({ providedIn: 'root' })
export class SystemParameterService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<SystemParameterKey, Promise<string | null>>();

  resolveValue(key: SystemParameterKey): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const request = this.fetchResolvedValue(key);
    this.cache.set(key, request);
    return request;
  }

  async resolveDefaultCurrency(fallback = 'BRL'): Promise<string> {
    const value = await this.resolveValue('DEFAULT_CURRENCY');
    return this.normalizeCurrency(value) ?? fallback;
  }

  async resolveDefaultTimezone(fallback = 'UTC'): Promise<string> {
    const value = await this.resolveValue('DEFAULT_TIMEZONE');
    return value?.trim() || fallback;
  }

  private async fetchResolvedValue(key: SystemParameterKey): Promise<string | null> {
    const endpoints = [`settings/parameters/resolve/${key}`, `system/parameters/resolve/${key}`];

    for (const endpoint of endpoints) {
      try {
        const response = await this.api.get<unknown>(endpoint);
        const value = this.readValue(response);
        if (value) return value;
      } catch {
        // Try next scope. Tenant resolve already falls back to master; system is for master pages.
      }
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
    if (Array.isArray(response)) return response[0] ?? null;
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
