import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import { readStoredEnvironmentUUID } from '../core/environment/environment-context';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';

const POLL_MS = 60_000;
/** Notifications shown in the topbar panel. */
export const INBOX_PANEL_LIMIT = 8;

export type NotificationType =
  | 'support.ticket.reply'
  | 'billing.subscription'
  | 'feature_request.status'
  | 'logs.account.cap_warning'
  | 'logs.account.capped'
  | 'voip.pabx.extension.offline'
  | 'dns.monitor.target'
  | 'workorders.order.overdue';

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

/** Panel/page filter: every notification or only the unread ones. */
export type InboxFilter = 'all' | 'unread';

/** One page of the full notifications page (`/user/notifications`). */
export interface InboxPage {
  items: InboxNotification[];
  total: number;
}

const EMPTY_ROUTES: ReadonlyMap<string, number> = new Map();

/**
 * In-app notifications (ticket answers, dunning notices, idea status): the single unread source of
 * the topbar bell and of the menu path badges. Polls the unread summary per App page while a
 * tenant is selected and the tab is visible; the panel loads the newest items when it opens.
 * UX only: the API decides what exists and what is unread.
 */
@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  readonly unreadCount = signal(0);
  /** Unread notifications per App page (route without query string); feeds the menu path. */
  readonly unreadByRoute = signal<ReadonlyMap<string, number>>(EMPTY_ROUTES);
  readonly items = signal<InboxNotification[]>([]);
  readonly state = signal<InboxState>('idle');
  readonly filter = signal<InboxFilter>('all');

  constructor() {
    effect(() => {
      // Restart on sign-in/out and tenant switch; the previous scope's data is dropped at once.
      this.auth.isLoggedIn();
      this.auth.sessionGeneration();
      this.tenants.selectedTenant();
      this.generation++;
      this.unreadCount.set(0);
      this.unreadByRoute.set(EMPTY_ROUTES);
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

  /** Unread total (bell) and per page (menu). Failures keep the last values; the next poll retries. */
  async refresh(): Promise<void> {
    const environment = readStoredEnvironmentUUID();
    if (!this.auth.isLoggedIn() || !environment) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const generation = this.generation;
    try {
      const response = await this.api.get<{
        data?: { UnreadCount?: number; routes?: { route?: string; count?: number }[] };
      }>('user/notifications/unread-summary', { timeout: 10_000, silent: true });
      if (!this.current(generation, environment)) return;
      this.unreadCount.set(Math.max(0, Number(response?.data?.UnreadCount ?? 0) || 0));
      const routes = new Map<string, number>();
      for (const entry of response?.data?.routes ?? []) {
        const count = Math.max(0, Math.trunc(Number(entry?.count ?? 0)) || 0);
        const route = typeof entry?.route === 'string' ? entry.route : '';
        if (count && route.startsWith('/') && !route.startsWith('//')) routes.set(route, count);
      }
      this.unreadByRoute.set(routes);
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
      const page = await this.fetchPage(INBOX_PANEL_LIMIT, 0, this.filter() === 'unread');
      if (!this.current(generation, environment)) return;
      this.items.set(page.items);
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
    this.adjustRoute(notification.route, -1);
    try {
      await this.api.post(
        `user/notifications/${encodeURIComponent(notification.notificationUUID)}/read`,
        {},
      );
    } finally {
      void this.refresh();
    }
  }

  /** Panel filter; reloads the panel list. */
  setFilter(filter: InboxFilter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    void this.load();
  }

  /** One page of the full notifications page; throws on failure (the page shows the error). */
  async page(limit: number, offset: number, unreadOnly: boolean): Promise<InboxPage> {
    if (!this.auth.isLoggedIn() || !readStoredEnvironmentUUID()) return { items: [], total: 0 };
    return this.fetchPage(limit, offset, unreadOnly);
  }

  /** Marks one notification unread again (optimistic; the count is re-read from the API). */
  async markUnread(notification: InboxNotification): Promise<void> {
    if (!notification.readAt) return;
    this.items.update((items) =>
      items.map((item) =>
        item.notificationUUID === notification.notificationUUID ? { ...item, readAt: null } : item,
      ),
    );
    this.unreadCount.update((count) => count + 1);
    this.adjustRoute(notification.route, 1);
    try {
      await this.api.post(
        `user/notifications/${encodeURIComponent(notification.notificationUUID)}/unread`,
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
    this.unreadByRoute.set(EMPTY_ROUTES);
    try {
      await this.api.post('user/notifications/read-all', {});
    } finally {
      void this.refresh();
    }
  }

  /** Optimistic per-page count while the API call runs (the next refresh replaces it). */
  private adjustRoute(route: string, delta: number) {
    const path = (route || '').split(/[?#]/)[0];
    if (!path) return;
    const routes = new Map(this.unreadByRoute());
    const count = Math.max(0, (routes.get(path) ?? 0) + delta);
    if (count) routes.set(path, count);
    else routes.delete(path);
    this.unreadByRoute.set(routes);
  }

  private async fetchPage(limit: number, offset: number, unreadOnly: boolean): Promise<InboxPage> {
    const query = `limit=${limit}&offset=${offset}${unreadOnly ? '&unread=true' : ''}`;
    const response = await this.api.get<{
      data?: { items?: InboxNotification[]; total?: number };
    }>(`user/notifications?${query}`, { timeout: 10_000, silent: true });
    return {
      items: (response?.data?.items ?? []).filter((item) => !!item?.notificationUUID),
      total: Math.max(0, Number(response?.data?.total ?? 0) || 0),
    };
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
