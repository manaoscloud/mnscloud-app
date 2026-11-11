import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { PhoneDialer } from '../../../shared/phone-dock/phone-dialer';
import { TenantService } from '../../../services/tenant.service';
import {
  ConversationsInboxPage,
  ConversationItem,
  fillQuickReply,
  firstName,
  inboxLayoutFor,
  slashTokenAt,
} from './inbox';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';

const QUICK_REPLIES = [
  {
    CqrUUID: 'Q1',
    CqrShortcut: 'saudacao',
    CqrTitle: 'SAUDAÇÃO INICIAL',
    CqrBody: 'Olá, {{contato.nome}}! Sou {{atendente.nome}}, da {{empresa.nome}}.',
    CqrStatus: 1,
    ConversationAccountCvaUUID: null,
  },
  {
    CqrUUID: 'Q2',
    CqrShortcut: 'encerrar',
    CqrTitle: 'ENCERRAMENTO CORDIAL',
    CqrBody: 'Foi um prazer!',
    CqrStatus: 1,
    ConversationAccountCvaUUID: null,
  },
  {
    CqrUUID: 'Q3',
    CqrShortcut: 'pix',
    CqrTitle: 'CHAVE PIX',
    CqrBody: 'Chave PIX da conta B',
    CqrStatus: 1,
    ConversationAccountCvaUUID: 'ACC-B',
  },
];

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
      ChannelKind: 'webchat',
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
      ChannelKind: 'whatsapp-cloud',
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
      ChannelKind: 'webchat',
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
      ChannelKind: 'webchat',
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
          return Promise.resolve({
            data: {
              items: structuredClone(sampleConversations),
              total: sampleConversations.length,
            },
          });
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
        if (endpoint.startsWith('conversations/quick-replies')) {
          return Promise.resolve({ data: { items: QUICK_REPLIES } });
        }
        if (endpoint.startsWith('conversations/events')) {
          // A real long-poll waits; an instantly resolved one would spin the watcher forever.
          return new Promise(() => undefined);
        }
        return Promise.resolve({ data: {} });
      }),
      post: jasmine.createSpy('post').and.returnValue(Promise.resolve({ data: {} })),
      put: jasmine.createSpy('put').and.returnValue(Promise.resolve({ data: {} })),
    };

    authMock = {
      user: jasmine
        .createSpy('user')
        .and.returnValue({ uuid: 'user-123', firstName: 'ELTON', lastName: 'BAHIA' }),
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
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: TenantService,
          useValue: { selectedTenant: signal({ EnvironmentName: 'Manaos Telecom' }) },
        },
        { provide: ApiService, useValue: apiMock },
        { provide: AuthService, useValue: authMock },
        { provide: PhoneDialer, useValue: phoneDialerMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: DestroyRef, useClass: FakeDestroyRef },
      ],
    });
  });

  function createPage(): ConversationsInboxPage {
    return TestBed.createComponent(ConversationsInboxPage).componentInstance;
  }

  it('initializes and loads conversations', async () => {
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(page.conversations()).toHaveSize(4);
    expect(page.unreadCount()).toBe(2);
  });

  it('filters active conversations by default (excluding resolved)', async () => {
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Default filter is 'active' (excludes resolved C4)
    expect(page.filteredConversations()).toHaveSize(3);
    expect(page.filteredConversations().map((c) => c.CnvUUID)).toEqual(['C1', 'C2', 'C3']);
  });

  it('filters by search query', async () => {
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    page.searchQuery.set('Maria');
    expect(page.filteredConversations()).toHaveSize(1);
    expect(page.filteredConversations()[0].ContactName).toBe('Maria Silva');
  });

  it('groups conversations into kanban columns properly', async () => {
    const page = createPage();
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
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const conv = page.conversations()[0]; // C1 with unreadCount = 2
    await page.selectConversation(conv);

    expect(page.selectedConversation()).toBe(conv);
    expect(apiMock.get).toHaveBeenCalledWith('conversations/C1/messages?limit=100');
    expect(apiMock.post).toHaveBeenCalledWith('conversations/C1/read', {});
    expect(page.messages()).toHaveSize(1);
    expect(page.messages()[0].CnmBody).toBe('Olá, preciso de ajuda com PABX');
  });

  it('sends a reply message and refreshes messages', async () => {
    const page = createPage();
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
    const page = createPage();
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
    const page = createPage();
    expect(page.viewMode()).toBe('cockpit');

    page.setViewMode('kanban');
    expect(page.viewMode()).toBe('kanban');

    page.setViewMode('cockpit');
    expect(page.viewMode()).toBe('cockpit');
  });
  it('rearranges the panes by workspace width', () => {
    expect(inboxLayoutFor(1400)).toBe('wide');
    expect(inboxLayoutFor(1180)).toBe('medium');
    expect(inboxLayoutFor(761)).toBe('medium');
    expect(inboxLayoutFor(760)).toBe('phone');
    expect(inboxLayoutFor(360)).toBe('phone');
  });

  it('finds the slash token only right before the caret', () => {
    expect(slashTokenAt('/enc', 4)).toEqual({ start: 0, query: 'enc' });
    expect(slashTokenAt('Olá /', 5)).toEqual({ start: 4, query: '' });
    expect(slashTokenAt('ver http://x', 12)).toBeNull();
    expect(slashTokenAt('a/b', 3)).toBeNull();
    expect(slashTokenAt('/enc texto', 10)).toBeNull();
  });

  it('fills quick reply variables and keeps the text readable without values', () => {
    expect(firstName('ELTON BAHIA')).toBe('Elton');
    expect(
      fillQuickReply('Olá, {{contato.nome}}! Sou {{atendente.nome}}.', {
        contact: 'Maria',
        agent: 'Elton',
      }),
    ).toBe('Olá, Maria! Sou Elton.');
    expect(fillQuickReply('Olá, {{contato.nome}}! Tudo bem?', {})).toBe('Olá! Tudo bem?');
  });

  it('loads quick replies from the API and offers only those of the conversation account', async () => {
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(apiMock.get).toHaveBeenCalledWith('conversations/quick-replies?status=1&limit=500');
    page.selectedConversation.set({
      ...sampleConversations[0],
      ConversationAccountCvaUUID: 'ACC-A',
    });
    expect(page.availableQuickReplies().map((r) => r.CqrUUID)).toEqual(['Q1', 'Q2']);
    page.selectedConversation.set({
      ...sampleConversations[0],
      ConversationAccountCvaUUID: 'ACC-B',
    });
    expect(page.availableQuickReplies().map((r) => r.CqrUUID)).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('typing /enc filters the quick replies and Enter inserts the filled text', async () => {
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));
    page.selectedConversation.set(sampleConversations[0]);

    const input = document.createElement('textarea');
    input.value = '/enc';
    input.setSelectionRange(4, 4);
    page.onTextInput({ target: input } as unknown as Event);
    expect(page.quickRepliesOpen()).toBeTrue();
    expect(page.quickReplyMatches().map((r) => r.CqrShortcut)).toEqual(['encerrar']);

    page.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(page.replyText()).toBe('Foi um prazer!');
    expect(page.quickRepliesOpen()).toBeFalse();
    expect(apiMock.post).not.toHaveBeenCalledWith('conversations/C1/messages', jasmine.anything());
  });

  it('the quick replies button appends the filled reply to the typed text', async () => {
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));
    page.selectedConversation.set(sampleConversations[0]);
    page.replyText.set('Bom dia.');

    page.toggleQuickReplies();
    expect(page.quickRepliesOpen()).toBeTrue();
    page.insertQuickReply(page.quickReplyMatches()[0]);
    expect(page.replyText()).toBe('Bom dia. Olá, Maria! Sou Elton, da Manaos Telecom.');
  });

  it('shows the delivery state of each reply (read is not queued)', () => {
    const page = createPage();
    expect(page.deliveryIcon('queued')).toBe('schedule');
    expect(page.deliveryIcon('sent')).toBe('check');
    expect(page.deliveryIcon('delivered')).toBe('done_all');
    expect(page.deliveryIcon('read')).toBe('done_all');
    expect(page.deliveryIcon('failed')).toBe('error');
  });

  it('uses the channel kind the API returns for icon, family and theme color', () => {
    const page = createPage();
    expect(page.getChannelIcon('whatsapp-cloud')).toBe('chat');
    expect(page.channelGroup('whatsapp-twilio')).toBe('whatsapp');
    expect(page.getChannelColor('webchat')).toBe('var(--mns-channel-webchat)');
    expect(page.getChannelColor(undefined)).toBe('var(--mat-sys-color-primary)');
  });

  it('opens the chat pane on phones when a conversation is selected and goes back to the list', async () => {
    const page = createPage();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await page.selectConversation(page.conversations()[1]);
    expect(page.mobilePane()).toBe('chat');
    page.backToList();
    expect(page.mobilePane()).toBe('list');
  });
});
