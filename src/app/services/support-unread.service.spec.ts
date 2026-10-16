import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SupportUnreadService, UNREAD_PANEL_LIMIT } from './support-unread.service';
import { TenantService } from './tenant.service';

const ENV = '11111111-2222-3333-4444-555555555555';

describe('SupportUnreadService', () => {
  let get: jasmine.Spy;
  let service: SupportUnreadService;

  beforeEach(() => {
    localStorage.setItem('mc_current_env', ENV);
    get = jasmine.createSpy('get');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiService, useValue: { get } },
        {
          provide: AuthService,
          useValue: { isLoggedIn: signal(true), sessionGeneration: signal(0) },
        },
        { provide: TenantService, useValue: { selectedTenant: signal(ENV) } },
      ],
    });
  });

  afterEach(() => localStorage.removeItem('mc_current_env'));

  it('lists only my tickets with unread answers, newest activity first', async () => {
    get.and.callFake(async (endpoint: string) =>
      endpoint.startsWith('help/tickets?')
        ? {
            data: {
              items: [
                {
                  SupportTicketUUID: 'a',
                  SupportTicketID: 'TKT-A',
                  Subject: 'Old',
                  UnreadCount: 1,
                  LastActivityAt: '2026-10-15T10:00:00Z',
                },
                { SupportTicketUUID: '', Subject: 'Broken row' },
                {
                  SupportTicketUUID: 'b',
                  SupportTicketID: 'TKT-B',
                  Subject: 'New',
                  UnreadCount: '3',
                  LastActivityAt: '2026-10-16T10:00:00Z',
                },
              ],
            },
          }
        : { data: { UnreadTickets: 2 } },
    );
    service = TestBed.inject(SupportUnreadService);

    await service.loadUnreadItems();

    expect(get).toHaveBeenCalledWith(
      `help/tickets?scope=mine&status=unread&limit=${UNREAD_PANEL_LIMIT}&offset=0`,
      { timeout: 10_000, silent: true },
    );
    expect(service.unreadItemsState()).toBe('ready');
    expect(service.unreadItems().map((item) => [item.uuid, item.unread])).toEqual([
      ['b', 3],
      ['a', 1],
    ]);
  });

  it('keeps the panel in an error state when the background read fails', async () => {
    get.and.callFake(async (endpoint: string) => {
      if (endpoint.startsWith('help/tickets?')) throw new Error('offline');
      return { data: { UnreadTickets: 0 } };
    });
    service = TestBed.inject(SupportUnreadService);

    await service.loadUnreadItems();

    expect(service.unreadItemsState()).toBe('error');
    expect(service.unreadItems()).toEqual([]);
  });

  it('does not call the API without a selected environment', async () => {
    localStorage.removeItem('mc_current_env');
    service = TestBed.inject(SupportUnreadService);

    await service.loadUnreadItems();

    expect(get).not.toHaveBeenCalled();
    expect(service.unreadItemsState()).toBe('ready');
  });
});
