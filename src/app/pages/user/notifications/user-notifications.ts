import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

import { PageShellComponent } from '../../../shared/pages/page-shell';
import { AppI18nService } from '../../../services/app-i18n.service';
import {
  InboxFilter,
  InboxNotification,
  InboxPage,
  NotificationInboxService,
} from '../../../services/notification-inbox.service';
import {
  notificationAriaLabel,
  notificationDescription,
  notificationIcon,
  notificationTitle,
} from '../../../services/notification-display';

const PAGE_SIZE = 25;
/** API page limit (`GET user/notifications`). */
const MAX_REQUEST = 100;

/**
 * Every notification of the signed-in user in the active tenant (last 90 days), with the unread
 * filter, mark read/unread per item and mark all read. The topbar bell shows only the newest ones
 * and links here. UX only: the API decides what exists and what is unread.
 */
@Component({
  selector: 'app-user-notifications',
  standalone: true,
  imports: [
    PageShellComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './user-notifications.html',
  styleUrl: './user-notifications.scss',
})
export class UserNotificationsPage {
  private readonly i18n = inject(AppI18nService);
  private readonly router = inject(Router);
  protected readonly inbox = inject(NotificationInboxService);

  readonly filter = signal<InboxFilter>('all');
  /** Pages of PAGE_SIZE shown; "Load more" grows it and the resource re-reads the window. */
  private readonly pages = signal(1);
  /** Read state changed on this page until the next load (no jumping rows under a filter). */
  private readonly readOverrides = signal<ReadonlyMap<string, string | null>>(new Map());

  readonly notifications = resource({
    params: () => ({ unread: this.filter() === 'unread', size: this.pages() * PAGE_SIZE }),
    defaultValue: { items: [], total: 0 } as InboxPage,
    loader: async ({ params }) => {
      const items: InboxNotification[] = [];
      let total = 0;
      for (let offset = 0; offset < params.size; offset += MAX_REQUEST) {
        const page = await this.inbox.page(
          Math.min(MAX_REQUEST, params.size - offset),
          offset,
          params.unread,
        );
        items.push(...page.items);
        total = page.total;
        if (items.length >= total || !page.items.length) break;
      }
      const seen = new Set<string>();
      return {
        items: items.filter(
          (item) => !seen.has(item.notificationUUID) && !!seen.add(item.notificationUUID),
        ),
        total,
      };
    },
  });

  readonly items = computed(() => {
    const overrides = this.readOverrides();
    return this.notifications
      .value()
      .items.map((item) =>
        overrides.has(item.notificationUUID)
          ? { ...item, readAt: overrides.get(item.notificationUUID) ?? null }
          : item,
      );
  });
  readonly loading = computed(() => this.notifications.isLoading());
  readonly failed = computed(() => this.notifications.status() === 'error');
  readonly hasMore = computed(() => this.items().length < this.notifications.value().total);

  private readonly translate = (key: string, params?: Record<string, string>) =>
    this.i18n.t(key, params);

  setFilter(filter: InboxFilter) {
    if (filter === this.filter()) return;
    this.readOverrides.set(new Map());
    this.pages.set(1);
    this.filter.set(filter);
  }

  reload() {
    this.readOverrides.set(new Map());
    this.notifications.reload();
    void this.inbox.refresh();
  }

  showMore() {
    this.pages.update((pages) => pages + 1);
  }

  async open(item: InboxNotification) {
    if (!item.readAt) await this.markRead(item);
    void this.router.navigateByUrl(item.route || '/');
  }

  async markRead(item: InboxNotification) {
    this.override(item, new Date().toISOString());
    await this.inbox.markRead(item);
  }

  async markUnread(item: InboxNotification) {
    this.override(item, null);
    await this.inbox.markUnread(item);
  }

  async markAllRead() {
    await this.inbox.markAllRead();
    this.reload();
  }

  icon(item: InboxNotification) {
    return notificationIcon(item);
  }

  title(item: InboxNotification) {
    return notificationTitle(item, this.translate);
  }

  description(item: InboxNotification) {
    return notificationDescription(item, this.i18n.language());
  }

  ariaLabel(item: InboxNotification) {
    return notificationAriaLabel(item, this.translate, this.i18n.language());
  }

  private override(item: InboxNotification, readAt: string | null) {
    this.readOverrides.update((current) => new Map(current).set(item.notificationUUID, readAt));
  }
}
