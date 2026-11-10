import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { PhoneDialer } from '../../../shared/phone-dock/phone-dialer';
import { ConversationsInboxPage, ConversationItem } from './inbox';
import { signal } from '@angular/core';
import { of } from 'rxjs';

class FakeDestroyRef implements DestroyRef {
  private callbacks: (() => void)[] = [];
  destroyed = false;
  onDestroy(callback: () => void) {
    this.callbacks.push(callback);
    return () => undefined;
  }
}

describe('ConversationsInboxPage', () => {
  let apiMock: {
    get: jasmine.Spy;
    post: jasmine.Spy;
    put: jasmine.Spy;
  };
  let authMock: {
    user: jasmine.Spy;
  };
  let phoneDialerMock: {
    canDial: jasmine.Spy;
    dial: jasmine.Spy;
  };
  let dialogMock: {
    open: jasmine.Spy;
  };
  let snackBarMock: {
    open: jasmine.Spy;
  };

  const sampleConversations: ConversationItem[] = [
    {
      CnvUUID: 'C1',
      ContactName: 'Maria Silva',
      ContactPhone: '+5511999991111',
      ChcKind: 'webchat',
      ChannelName: 'Chat do Site',
      CnvState: 'open',
      CnvPriority: 'normal',
      CnvUnreadCount: 2,
      AssignedUserUsrUUID: null,
      AssignedName: null,
      LastMessage: 'Olá, preciso de ajuda com PABX',
      CnvLastMessageAt: '2026-11-10T12:00:00Z',
    },
    {
      CnvUUID: 'C2',
      ContactName: 'João Santos',
      ContactPhone: '+5511999992222',
      ChcKind: 'whatsapp-cloud',
      ChannelName: 'WhatsApp Vendas',
      CnvState: 'open',
      CnvPriority: 'high',
      CnvUnreadCount: 0,
      AssignedUserUsrUUID: 'user-123',
      AssignedName: 'Elton Bahia',
      LastMessage: 'Contrato enviado por e-mail',
      CnvLastMessageAt: '2026-11-10T12:10:00Z',
    },
    {
      CnvUUID: 'C3',
      ContactName: 'Carlos Lima',
      ChcKind: 'webchat',
      CnvState: 'pending',
      CnvPriority: 'low',
      CnvUnreadCount: 0,
      AssignedUserUsrUUID: 'user-123',
      AssignedName: 'Elton Bahia',
      LastMessage: 'Aguardando retorno do cliente',
      CnvLastMessageAt: '2026-11-10T11:00:00Z',
    },
    {
      CnvUUID: 'C4',
      ContactName: 'Ana Souza',
      ChcKind: 'webchat',
      CnvState: 'resolved',
      CnvPriority: 'normal',
      CnvUnreadCount: 0,
      AssignedUserUsrUUID: 'user-123',
      AssignedName: 'Elton Bahia',
      LastMessage: 'Atendimento finalizado com sucesso',
      CnvLastMessageAt: '2026-11-10T10:00:00Z',
    },
  ];

  beforeEach(() => {
    apiMock = {
      get: jasmine.createSpy('get').and.callFake((endpoint: string) => {
        if (endpoint.startsWith('conversations?')) {
          return Promise.resolve({ data: { items: sampleConversations, total: sampleConversations.length } });
        }
        if (endpoint.includes('/messages')) {
          return Promise.resolve({
            data: {
              items: [
                {
                  CnmUUID: 'M1',
                  CnmSentAt: '2026-11-10T12:00:00Z',
                  CnmAuthorType: 'contact',
                  CnmDirection: 'inbound',
                  CnmBody: 'Olá, preciso de ajuda com PABX',
                  CnmDelivery: 'delivered',
                },
              ],
            },
          });
        }
        if (endpoint.startsWith('conversations/events')) {
          return Promise.resolve({ data: { cursor: '1', items: [] } });
        }
        return Promise.resolve({ data: {} });
      }),
      post: jasmine.createSpy('post').and.returnValue(Promise.resolve({ data: {} })),
      put: jasmine.createSpy('put').and.returnValue(Promise.resolve({ data: {} })),
    };

    authMock = {
      user: jasmine.createSpy('user').and.returnValue({ uuid: 'user-123', name: 'Elton Bahia' }),
    };

    phoneDialerMock = {
      canDial: jasmine.createSpy('canDial').and.returnValue(true),
      dial: jasmine.createSpy('dial'),
    };

    dialogMock = {
      open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(true) }),
    };

    snackBarMock = {
      open: jasmine.createSpy('open'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: apiMock },
        { provide: AuthService, useValue: authMock },
        { provide: PhoneDialer, useValue: phoneDialerMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: DestroyRef, useClass: FakeDestroyRef },
      ],
    });
  });

  it('initializes and loads conversations', async () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(page.conversations().length).toBe(4);
    expect(page.unreadCount()).toBe(2);
  });

  it('filters active conversations by default (excluding resolved)', async () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Default filter is 'active' (excludes resolved C4)
    expect(page.filteredConversations().length).toBe(3);
    expect(page.filteredConversations().map((c) => c.CnvUUID)).toEqual(['C1', 'C2', 'C3']);
  });

  it('filters by search query', async () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    await new Promise((resolve) => setTimeout(resolve, 0));

    page.searchQuery.set('Maria');
    expect(page.filteredConversations().length).toBe(1);
    expect(page.filteredConversations()[0].ContactName).toBe('Maria Silva');
  });

  it('groups conversations into kanban columns properly', async () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const cols = page.kanbanColumns();
    // C1 is open and unassigned -> waiting
    expect(cols.waiting.map((c) => c.CnvUUID)).toEqual(['C1']);
    // C2 is open and assigned -> active
    expect(cols.active.map((c) => c.CnvUUID)).toEqual(['C2']);
    // C3 is pending -> pending
    expect(cols.pending.map((c) => c.CnvUUID)).toEqual(['C3']);
    // C4 is resolved (when stateFilter is 'all')
    page.stateFilter.set('all');
    expect(page.kanbanColumns().resolved.map((c) => c.CnvUUID)).toEqual(['C4']);
  });

  it('selects a conversation, loads messages and marks as read', async () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const conv = page.conversations()[0]; // C1 with unreadCount = 2
    await page.selectConversation(conv);

    expect(page.selectedConversation()).toBe(conv);
    expect(apiMock.get).toHaveBeenCalledWith('conversations/C1/messages?limit=100');
    expect(apiMock.post).toHaveBeenCalledWith('conversations/C1/read', {});
    expect(page.messages().length).toBe(1);
    expect(page.messages()[0].CnmBody).toBe('Olá, preciso de ajuda com PABX');
  });

  it('sends a reply message and refreshes messages', async () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    await new Promise((resolve) => setTimeout(resolve, 0));

    await page.selectConversation(page.conversations()[0]);
    page.replyText.set('Olá! Como posso ajudar você?');
    page.replyKind.set('text');

    await page.sendMessage();

    expect(apiMock.post).toHaveBeenCalledWith('conversations/C1/messages', {
      kind: 'text',
      body: 'Olá! Como posso ajudar você?',
    });
    expect(page.replyText()).toBe('');
  });

  it('takes a conversation assigning to current user', async () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const conv = page.conversations()[0]; // unassigned
    await page.takeConversation(conv);

    expect(apiMock.put).toHaveBeenCalledWith('conversations/C1', {
      CnvRevision: undefined,
      AssignedUserUsrUUID: 'user-123',
      CnvState: 'open',
    });
  });

  it('switches between cockpit and kanban views', () => {
    const page = TestBed.createComponent(ConversationsInboxPage).componentInstance;
    expect(page.viewMode()).toBe('cockpit');

    page.setViewMode('kanban');
    expect(page.viewMode()).toBe('kanban');

    page.setViewMode('cockpit');
    expect(page.viewMode()).toBe('cockpit');
  });
});
