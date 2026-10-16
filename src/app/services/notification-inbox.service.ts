import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import { readStoredEnvironmentUUID } from '../core/environment/environment-context';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';

const POLL_MS = 60_000;
/** Notifications shown in the topbar panel. */
export const INBOX_PANEL_LIMIT = 8;

export type NotificationType =
  'support.ticket.reply' | 'billing.subscription' | 'feature_request.status';

/** One notification of the signed-in user in the active tenant (API `/user/notifications`). */
export interface InboxNotification {
  notificationUUID: string;
  type: NotificationType | string;
  severity: 'info' | 'warning' | 'error';
  params: Record<string, string | number | boolean>;
  route: string;
  readAt: string | null;
  lastEventAt: string | null;
}

export type InboxState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * In-app notifications of the topbar bell (ticket answers, dunning notices, idea status).
 * Polls the unread count while a tenant is selected and the tab is visible; the panel loads the
 * newest items when it opens. UX only: the API decides what exists and what is unread.
 */
@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  readonly unreadCount = signal(0);
  readonly items = signal<InboxNotification[]>([]);
  readonly state = signal<InboxState>('idle');

  constructor() {
    effect(() => {
      // Restart on sign-in/out and tenant switch; the previous scope's data is dropped at once.
      this.auth.isLoggedIn();
      this.auth.sessionGeneration();
      this.tenants.selectedTenant();
      this.generation++;
      this.unreadCount.set(0);
      this.items.set([]);
      this.state.set('idle');
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

  /** Unread counter (badge). Failures keep the last count; the next poll retries. */
  async refresh(): Promise<void> {
    const environment = readStoredEnvironmentUUID();
    if (!this.auth.isLoggedIn() || !environment) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const generation = this.generation;
    try {
      const response = await this.api.get<{ data?: { UnreadCount?: number } }>(
        'user/notifications/unread-count',
        { timeout: 10_000, silent: true },
      );
      if (!this.current(generation, environment)) return;
      this.unreadCount.set(Math.max(0, Number(response?.data?.UnreadCount ?? 0) || 0));
    } catch {
      // Background read: keep the last count.
    }
  }

  /** Newest notifications for the panel. */
  async load(): Promise<void> {
    const environment = readStoredEnvironmentUUID();
    if (!this.auth.isLoggedIn() || !environment) {
      this.items.set([]);
      this.state.set('ready');
      return;
    }
    const generation = this.generation;
    this.state.set('loading');
    try {
      const response = await this.api.get<{ data?: { items?: InboxNotification[] } }>(
        `user/notifications?limit=${INBOX_PANEL_LIMIT}&offset=0`,
        { timeout: 10_000, silent: true },
      );
      if (!this.current(generation, environment)) return;
      this.items.set((response?.data?.items ?? []).filter((item) => !!item?.notificationUUID));
      this.state.set('ready');
    } catch {
      if (generation === this.generation) this.state.set('error');
    }
  }

  /** Marks one notification read (optimistic; the count is re-read from the API). */
  async markRead(notification: InboxNotification): Promise<void> {
    if (notification.readAt) return;
    const now = new Date().toISOString();
    this.items.update((items) =>
      items.map((item) =>
        item.notificationUUID === notification.notificationUUID ? { ...item, readAt: now } : item,
      ),
    );
    this.unreadCount.update((count) => Math.max(0, count - 1));
    try {
      await this.api.post(
        `user/notifications/${encodeURIComponent(notification.notificationUUID)}/read`,
        {},
      );
    } finally {
      void this.refresh();
    }
  }

  async markAllRead(): Promise<void> {
    const now = new Date().toISOString();
    this.items.update((items) =>
      items.map((item) => (item.readAt ? item : { ...item, readAt: now })),
    );
    this.unreadCount.set(0);
    try {
      await this.api.post('user/notifications/read-all', {});
    } finally {
      void this.refresh();
    }
  }

  private current(generation: number, environment: string): boolean {
    return generation === this.generation && environment === readStoredEnvironmentUUID();
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
