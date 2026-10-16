import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import { readStoredEnvironmentUUID } from '../core/environment/environment-context';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';

const POLL_MS = 60_000;

/**
 * Unread answers of the signed-in user's help center tickets (menu badge of "My tickets").
 * Polls while a tenant is selected and the tab is visible; reading a conversation refreshes it.
 * UX only: the API decides what is unread.
 */
@Injectable({ providedIn: 'root' })
export class SupportUnreadService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  /** Tickets with answers the user has not read yet. */
  readonly unreadTickets = signal(0);

  constructor() {
    effect(() => {
      // Restart on sign-in/out and tenant switch; the previous scope's count is dropped at once.
      this.auth.isLoggedIn();
      this.auth.sessionGeneration();
      this.tenants.selectedTenant();
      this.generation++;
      this.unreadTickets.set(0);
      void this.refresh();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.refresh();
      });
    }
    this.start();
  }

  async refresh(): Promise<void> {
    const environment = readStoredEnvironmentUUID();
    if (!this.auth.isLoggedIn() || !environment) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const generation = this.generation;
    try {
      const response = await this.api.get<{ data?: { UnreadTickets?: number } }>(
        'help/tickets/unread-count',
        { timeout: 10_000, silent: true },
      );
      if (generation !== this.generation || environment !== readStoredEnvironmentUUID()) return;
      this.unreadTickets.set(Math.max(0, Number(response?.data?.UnreadTickets ?? 0)));
    } catch {
      // A failed background read keeps the last count; the next poll retries.
    }
  }

  private start() {
    if (this.timer || typeof window === 'undefined') return;
    this.timer = setInterval(() => void this.refresh(), POLL_MS);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
