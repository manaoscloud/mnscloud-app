import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { INBOX_PANEL_LIMIT, NotificationInboxService } from './notification-inbox.service';
import { TenantService } from './tenant.service';

const ENV = '11111111-2222-3333-4444-555555555555';
const item = (uuid: string, readAt: string | null = null) => ({
  notificationUUID: uuid,
  type: 'support.ticket.reply',
  severity: 'info' as const,
  params: { protocol: 'TKT-A', subject: 'Lentidão' },
  route: `/support/requests?ticket=${uuid}`,
  readAt,
  lastEventAt: '2026-10-16T13:00:00.000000Z',
});

describe('NotificationInboxService', () => {
  let get: jasmine.Spy;
  let post: jasmine.Spy;
  let unread: number;

  beforeEach(() => {
    localStorage.setItem('mc_current_env', ENV);
    unread = 2;
    get = jasmine
      .createSpy('get')
      .and.callFake(async (endpoint: string) =>
        endpoint.startsWith('user/notifications?')
          ? {
              data: {
                items: [item('a'), item('b', '2026-10-16T13:05:00Z'), { notificationUUID: '' }],
              },
            }
          : { data: { UnreadCount: unread } },
      );
    post = jasmine.createSpy('post').and.resolveTo({});
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiService, useValue: { get, post } },
        {
          provide: AuthService,
          useValue: { isLoggedIn: signal(true), sessionGeneration: signal(0) },
        },
        { provide: TenantService, useValue: { selectedTenant: signal(ENV) } },
      ],
    });
  });

  afterEach(() => localStorage.removeItem('mc_current_env'));

  it('reads the unread count and the newest notifications of the active tenant', async () => {
    const inbox = TestBed.inject(NotificationInboxService);
    await inbox.refresh();
    await inbox.load();

    expect(get).toHaveBeenCalledWith('user/notifications/unread-count', {
      timeout: 10_000,
      silent: true,
    });
    expect(get).toHaveBeenCalledWith(`user/notifications?limit=${INBOX_PANEL_LIMIT}&offset=0`, {
      timeout: 10_000,
      silent: true,
    });
    expect(inbox.unreadCount()).toBe(2);
    expect(inbox.state()).toBe('ready');
    expect(inbox.items().map((entry) => entry.notificationUUID)).toEqual(['a', 'b']);
  });

  it('marks one or all notifications read and re-reads the count', async () => {
    const inbox = TestBed.inject(NotificationInboxService);
    await inbox.refresh();
    await inbox.load();

    unread = 1;
    await inbox.markRead(inbox.items()[0]);
    expect(post).toHaveBeenCalledWith('user/notifications/a/read', {});
    expect(inbox.items()[0].readAt).not.toBeNull();

    post.calls.reset();
    await inbox.markRead(inbox.items()[1]);
    expect(post).not.toHaveBeenCalled();

    unread = 0;
    await inbox.markAllRead();
    expect(post).toHaveBeenCalledWith('user/notifications/read-all', {});
    expect(inbox.unreadCount()).toBe(0);
  });

  it('shows an error state when the panel cannot be loaded and skips calls without a tenant', async () => {
    get.and.callFake(async (endpoint: string) => {
      if (endpoint.startsWith('user/notifications?')) throw new Error('offline');
      return { data: { UnreadCount: 0 } };
    });
    const inbox = TestBed.inject(NotificationInboxService);
    await inbox.load();
    expect(inbox.state()).toBe('error');

    localStorage.removeItem('mc_current_env');
    get.calls.reset();
    await inbox.refresh();
    await inbox.load();
    expect(get).not.toHaveBeenCalled();
  });
});
