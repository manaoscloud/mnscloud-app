import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import { readStoredEnvironmentUUID } from '../core/environment/environment-context';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';

const POLL_MS = 60_000;
/** Tickets listed in the topbar notifications panel; the rest is in "My tickets". */
export const UNREAD_PANEL_LIMIT = 5;

/** One of my tickets with answers I have not read yet (topbar notifications panel). */
export interface UnreadTicket {
  uuid: string;
  protocol: string;
  subject: string;
  unread: number;
  lastActivityAt: string | null;
}

export type UnreadTicketsState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Unread answers of the signed-in user's help center tickets (menu badge of "My tickets" and the
 * topbar notifications bell).
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
  /** Newest tickets with unread answers, loaded when the notifications panel opens. */
  readonly unreadItems = signal<UnreadTicket[]>([]);
  readonly unreadItemsState = signal<UnreadTicketsState>('idle');

  constructor() {
    effect(() => {
      // Restart on sign-in/out and tenant switch; the previous scope's count is dropped at once.
      this.auth.isLoggedIn();
      this.auth.sessionGeneration();
      this.tenants.selectedTenant();
      this.generation++;
      this.unreadTickets.set(0);
      this.unreadItems.set([]);
      this.unreadItemsState.set('idle');
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

  /** Loads the tickets of the notifications panel (`status=unread`, same set as the counter). */
  async loadUnreadItems(): Promise<void> {
    const environment = readStoredEnvironmentUUID();
    if (!this.auth.isLoggedIn() || !environment) {
      this.unreadItems.set([]);
      this.unreadItemsState.set('ready');
      return;
    }
    const generation = this.generation;
    this.unreadItemsState.set('loading');
    try {
      const response = await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
        `help/tickets?scope=mine&status=unread&limit=${UNREAD_PANEL_LIMIT}&offset=0`,
        { timeout: 10_000, silent: true },
      );
      if (generation !== this.generation || environment !== readStoredEnvironmentUUID()) return;
      const items = (response?.data?.items ?? [])
        .map(toUnreadTicket)
        .filter((item): item is UnreadTicket => item !== null)
        .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
      this.unreadItems.set(items);
      this.unreadItemsState.set('ready');
    } catch {
      if (generation === this.generation) this.unreadItemsState.set('error');
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

function toUnreadTicket(row: Record<string, unknown>): UnreadTicket | null {
  const uuid = typeof row['SupportTicketUUID'] === 'string' ? row['SupportTicketUUID'] : '';
  if (!uuid) return null;
  return {
    uuid,
    protocol: String(row['SupportTicketID'] ?? ''),
    subject: String(row['Subject'] ?? ''),
    unread: Math.max(0, Number(row['UnreadCount'] ?? 0) || 0),
    lastActivityAt: typeof row['LastActivityAt'] === 'string' ? row['LastActivityAt'] : null,
  };
}
