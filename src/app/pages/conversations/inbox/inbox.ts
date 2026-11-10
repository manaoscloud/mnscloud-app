// crud-template-exempt: Dedicated omnichannel cockpit and kanban board workspace for live conversations.
// Full-height workspace (src/styles/_workspace.scss): only the panes scroll, never the page.

import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { TenantService } from '../../../services/tenant.service';
import { PhoneDialer } from '../../../shared/phone-dock/phone-dialer';
import { watchConversationChanges } from '../conversation-events';
import {
  CONNECTION_LOOKUP,
  CONVERSATION_PRIORITIES,
  linkContactForm,
} from '../conversation-options';
import { ConfigurableCrudCollectionDialog } from '../../../shared/crud/configurable-crud/configurable-crud-collection-dialog';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { ConfigurableCrudRecord } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { MNS_MENU } from '../../../shared/menu/mns-menu';
import { CONVERSATION_QUICK_REPLIES_CONFIG, QuickReply } from '../quick-replies/quick-replies';

export interface ConversationItem {
  CnvUUID: string;
  ChannelConnectionChcUUID?: string;
  ChannelName?: string;
  ChannelKind?: string;
  ConversationAccountCvaUUID?: string | null;
  AccountName?: string;
  ContactName?: string;
  ContactPhone?: string;
  ContactEmail?: string;
  ContactExternalId?: string;
  LastMessage?: string;
  CnvUnreadCount: number;
  CnvState: 'open' | 'pending' | 'snoozed' | 'resolved';
  CnvPriority: 'low' | 'normal' | 'high' | 'urgent';
  AssignedUserUsrUUID?: string | null;
  AssignedName?: string | null;
  CnvLastMessageAt?: string | null;
  CnvSubject?: string | null;
  CnvServiceWindowEndsAt?: string | null;
  CnvSnoozedUntil?: string | null;
  CnvRevision?: number;
  RegCustomerRcuUUID?: string | null;
  CustomerName?: string | null;
  CrmContactCcoUUID?: string | null;
  CrmContactName?: string | null;
  CrmLeadCleUUID?: string | null;
  CrmLeadName?: string | null;
}

export interface MessageItem {
  CnmUUID: string;
  CnmSentAt: string;
  CnmAuthorType: 'contact' | 'agent' | 'bot' | 'system';
  AuthorName?: string | null;
  CnmDirection: 'inbound' | 'outbound' | 'internal';
  CnmBody: string;
  CnmKind: 'text' | 'note' | 'image' | 'audio' | 'video' | 'document' | 'template';
  CnmDelivery: 'received' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
}

export type InboxLayout = 'wide' | 'medium' | 'phone';

/** Width of the workspace (not of the window) at which the panes rearrange. */
export function inboxLayoutFor(width: number): InboxLayout {
  if (width <= 760) return 'phone';
  if (width <= 1180) return 'medium';
  return 'wide';
}

const DELIVERY_ICONS: Record<string, string> = {
  queued: 'schedule',
  sent: 'check',
  delivered: 'done_all',
  read: 'done_all',
  failed: 'error',
};

/** First word of a name in title case ("ELTON BAHIA" -> "Elton"). */
export function firstName(name?: string | null): string {
  const first =
    String(name || '')
      .trim()
      .split(/\s+/)[0] || '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
}

/** Fills the quick reply variables; an unknown value leaves the text readable (no braces). */
export function fillQuickReply(
  body: string,
  values: { contact?: string; agent?: string; company?: string },
): string {
  return body
    .replace(/\{\{\s*contato\.nome\s*\}\}/gi, values.contact || '')
    .replace(/\{\{\s*atendente\.nome\s*\}\}/gi, values.agent || '')
    .replace(/\{\{\s*empresa\.nome\s*\}\}/gi, values.company || '')
    .replace(/ +([,.!?])/g, '$1')
    .replace(/,([!?.])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** The `/query` token right before the caret, or null when the caret is not on one. */
export function slashTokenAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)\/([^\s/]*)$/.exec(before);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
}

function playNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Audio context may be restricted before first user gesture
  }
}

function newConversationConfig() {
  return defineCrud({
    endpoint: 'conversations',
    uuidField: 'CnvUUID',
    pageTitle: 'Start conversation',
    pageDescription:
      'Conversations with customers and contacts from every connected channel, in one place: reply, add internal notes, assign and resolve.',
    createTitle: 'Start conversation',
    canDelete: false,
    canEdit: false,
    serverSidePagination: false,
    columns: [],
    initialValues: {
      connection: '',
      name: '',
      phone: '',
      email: '',
      subject: '',
      priority: 'normal',
    },
    fields: [
      {
        key: 'connection',
        source: 'ChannelConnectionChcUUID',
        label: 'Channel',
        type: 'search-select',
        required: true,
        remoteLookup: CONNECTION_LOOKUP,
      },
      {
        key: 'name',
        source: 'ContactName',
        label: 'Contact name',
      },
      {
        key: 'phone',
        source: 'ContactPhone',
        label: 'Contact phone',
        placeholder: '+5592999990000',
        help: 'International format with country code.',
      },
      {
        key: 'email',
        source: 'ContactEmail',
        label: 'Contact e-mail',
        type: 'email',
      },
      {
        key: 'subject',
        source: 'CnvSubject',
        label: 'Subject',
      },
      {
        key: 'priority',
        source: 'CnvPriority',
        label: 'Priority',
        type: 'search-select',
        options: CONVERSATION_PRIORITIES,
        translateOptions: true,
      },
    ],
    payload: (values) => ({
      ChannelConnectionChcUUID: values['connection'],
      contact: {
        name: values['name'] || undefined,
        phone: values['phone'] || undefined,
        email: values['email'] || undefined,
      },
      CnvSubject: values['subject'] || undefined,
      CnvPriority: values['priority'] || 'normal',
    }),
  });
}

@Component({
  selector: 'app-conversations-inbox',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    TranslocoPipe,
    MNS_MENU,
  ],
  templateUrl: './inbox.html',
  styleUrls: ['./inbox.scss'],
})
export class ConversationsInboxPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly phoneDialer = inject(PhoneDialer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly datePipe = new DatePipe('en-US');

  readonly timelineContainer = viewChild<ElementRef<HTMLDivElement>>('timelineContainer');
  readonly composerInput = viewChild<ElementRef<HTMLTextAreaElement>>('composerInput');

  // State Signals
  readonly viewMode = signal<'cockpit' | 'kanban'>('cockpit');
  readonly conversations = signal<ConversationItem[]>([]);
  readonly selectedConversation = signal<ConversationItem | null>(null);
  readonly messages = signal<MessageItem[]>([]);
  readonly loadingConversations = signal(false);
  readonly loadingMessages = signal(false);
  readonly sendingMessage = signal(false);

  // Layout: the panes follow the workspace width; on phones one pane is shown at a time.
  readonly layout = signal<InboxLayout>('wide');
  readonly mobilePane = signal<'list' | 'chat'>('list');

  // Filters & Composer
  readonly searchQuery = signal('');
  readonly stateFilter = signal<string>('active');
  readonly assigneeFilter = signal<string>('all');
  readonly channelFilter = signal<string>('all');
  readonly replyKind = signal<'text' | 'note'>('text');
  readonly replyText = signal('');
  readonly showContactDetails = signal(true);
  readonly draggedConversation = signal<ConversationItem | null>(null);

  // Quick replies (tenant records; `/shortcut` in the composer)
  readonly quickReplies = signal<QuickReply[]>([]);
  readonly quickRepliesOpen = signal(false);
  readonly quickReplyQuery = signal('');
  readonly quickReplyIndex = signal(0);
  private quickReplyStart = -1;

  // Computed signals
  readonly currentUser = computed(() => this.auth.user());

  readonly stateFilters = [
    { value: 'active', label: 'conversations.filterActive' },
    { value: 'all', label: 'conversations.filterAll' },
    { value: 'open', label: 'conversations.filterOpen' },
    { value: 'pending', label: 'conversations.filterPending' },
    { value: 'snoozed', label: 'conversations.filterSnoozed' },
    { value: 'resolved', label: 'conversations.filterResolved' },
  ];

  readonly assigneeFilters = [
    { value: 'all', label: 'conversations.filterAllAssignees' },
    { value: 'me', label: 'conversations.filterAssignedMe' },
    { value: 'unassigned', label: 'conversations.filterUnassigned' },
  ];

  readonly stateFilterLabel = computed(
    () => this.stateFilters.find((f) => f.value === this.stateFilter())?.label ?? '',
  );
  readonly assigneeFilterLabel = computed(
    () => this.assigneeFilters.find((f) => f.value === this.assigneeFilter())?.label ?? '',
  );

  /** Channel kinds present in the loaded conversations, for the channel filter. */
  readonly channelKinds = computed(() => [
    ...new Set(this.conversations().map((c) => this.channelGroup(c.ChannelKind))),
  ]);

  readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.stateFilter();
    const as = this.assigneeFilter();
    const ch = this.channelFilter();
    const myUuid = this.currentUser()?.uuid;

    return this.conversations().filter((c) => {
      if (q) {
        const text =
          `${c.ContactName || ''} ${c.ContactPhone || ''} ${c.ContactEmail || ''} ${c.ContactExternalId || ''} ${c.CnvSubject || ''} ${c.LastMessage || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (st === 'active') {
        if (c.CnvState === 'resolved') return false;
      } else if (st !== 'all' && c.CnvState !== st) {
        return false;
      }

      if (as === 'me') {
        if (!myUuid || c.AssignedUserUsrUUID !== myUuid) return false;
      } else if (as === 'unassigned') {
        if (c.AssignedUserUsrUUID) return false;
      }

      if (ch !== 'all' && this.channelGroup(c.ChannelKind) !== ch) return false;

      return true;
    });
  });

  readonly unreadCount = computed(() =>
    this.conversations().reduce((acc, c) => acc + (Number(c.CnvUnreadCount) || 0), 0),
  );

  readonly kanbanColumns = computed(() => {
    const all = this.filteredConversations();
    return {
      waiting: all.filter((c) => c.CnvState === 'open' && !c.AssignedUserUsrUUID),
      active: all.filter((c) => c.CnvState === 'open' && Boolean(c.AssignedUserUsrUUID)),
      pending: all.filter((c) => c.CnvState === 'pending'),
      snoozed: all.filter((c) => c.CnvState === 'snoozed'),
      resolved: all.filter((c) => c.CnvState === 'resolved'),
    };
  });

  readonly kanbanStages = computed(() => {
    const cols = this.kanbanColumns();
    return [
      { key: 'waiting' as const, title: 'conversations.waitingQueue', items: cols.waiting },
      { key: 'active' as const, title: 'conversations.inProgress', items: cols.active },
      { key: 'pending' as const, title: 'conversations.waitingCustomer', items: cols.pending },
      { key: 'snoozed' as const, title: 'conversations.stageSnoozed', items: cols.snoozed },
      { key: 'resolved' as const, title: 'conversations.stageResolved', items: cols.resolved },
    ];
  });

  readonly isWindowClosed = computed(() => {
    const sel = this.selectedConversation();
    if (!sel?.CnvServiceWindowEndsAt) return false;
    const expiry = new Date(sel.CnvServiceWindowEndsAt).getTime();
    return !Number.isNaN(expiry) && expiry < Date.now();
  });

  /** Short hint on phones, where the full hint would wrap inside the one-line field. */
  readonly composerPlaceholder = computed(() => {
    if (this.replyKind() === 'note') return 'conversations.typeNotePlaceholder';
    return this.layout() === 'phone'
      ? 'conversations.typeReplyShort'
      : 'conversations.typeReplyPlaceholder';
  });

  /** Active replies offered in the selected conversation's account (shared ones included). */
  readonly availableQuickReplies = computed(() => {
    const account = this.selectedConversation()?.ConversationAccountCvaUUID ?? null;
    return this.quickReplies().filter(
      (r) =>
        Number(r.CqrStatus) === 1 &&
        (!r.ConversationAccountCvaUUID || r.ConversationAccountCvaUUID === account),
    );
  });

  readonly quickReplyMatches = computed(() => {
    const q = this.quickReplyQuery().toLowerCase();
    if (!q) return this.availableQuickReplies();
    return this.availableQuickReplies().filter(
      (r) =>
        r.CqrShortcut.toLowerCase().startsWith(q) ||
        r.CqrTitle.toLowerCase().includes(q) ||
        r.CqrBody.toLowerCase().includes(q),
    );
  });

  constructor() {
    queueMicrotask(() => {
      void this.loadConversations();
      void this.loadQuickReplies();
    });
    watchConversationChanges(this.api, this.destroyRef, (changes) =>
      this.handleRealtimeChanges(changes),
    );
    afterNextRender(() => this.observeWidth());
  }

  /** Follows the workspace width (sidebar open or compact included) with a ResizeObserver. */
  private observeWidth(): void {
    const element = this.host.nativeElement as HTMLElement;
    if (typeof ResizeObserver === 'undefined' || !element) return;
    const apply = (width: number) => {
      const next = inboxLayoutFor(width);
      if (next === this.layout()) return;
      this.layout.set(next);
      // The contact panel is a column only on wide screens; elsewhere it opens on demand.
      this.showContactDetails.set(next === 'wide');
    };
    apply(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => apply(entries[0].contentRect.width));
    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  setViewMode(mode: 'cockpit' | 'kanban'): void {
    this.viewMode.set(mode);
    if (mode === 'kanban') this.mobilePane.set('list');
  }

  setStateFilter(val: string): void {
    this.stateFilter.set(val);
  }

  setAssigneeFilter(val: string): void {
    this.assigneeFilter.set(val);
  }

  setChannelFilter(val: string): void {
    this.channelFilter.set(val);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  setReplyKind(kind: 'text' | 'note'): void {
    this.replyKind.set(kind);
  }

  backToList(): void {
    this.mobilePane.set('list');
    if (this.layout() !== 'wide') this.showContactDetails.set(false);
  }

  onTextInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.replyText.set(target.value);
    this.autoGrow(target);
    const token = slashTokenAt(target.value, target.selectionStart ?? target.value.length);
    if (token) {
      this.quickReplyStart = token.start;
      this.openQuickReplies(token.query);
    } else if (this.quickReplyStart >= 0) {
      this.closeQuickReplies();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.quickRepliesOpen()) {
      const items = this.quickReplyMatches();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (items.length) {
          const step = event.key === 'ArrowDown' ? 1 : items.length - 1;
          this.quickReplyIndex.set((this.quickReplyIndex() + step) % items.length);
          this.scrollActiveQuickReply();
        }
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && items.length) {
        event.preventDefault();
        this.insertQuickReply(items[Math.min(this.quickReplyIndex(), items.length - 1)]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeQuickReplies();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
    }
  }

  /** Opens the list from the toolbar button (no `/` token: the reply is appended). */
  toggleQuickReplies(): void {
    if (this.quickRepliesOpen()) {
      this.closeQuickReplies();
      return;
    }
    this.quickReplyStart = -1;
    this.openQuickReplies('');
  }

  private openQuickReplies(query: string): void {
    if (query !== this.quickReplyQuery() || !this.quickRepliesOpen()) this.quickReplyIndex.set(0);
    this.quickReplyQuery.set(query);
    this.quickRepliesOpen.set(true);
  }

  closeQuickReplies(): void {
    this.quickRepliesOpen.set(false);
    this.quickReplyQuery.set('');
    this.quickReplyStart = -1;
  }

  quickReplyText(reply: QuickReply): string {
    const conv = this.selectedConversation();
    return fillQuickReply(reply.CqrBody, {
      contact: firstName(conv?.ContactName),
      agent: firstName(this.currentUser()?.firstName),
      company: this.tenants.selectedTenant()?.EnvironmentName || '',
    });
  }

  insertQuickReply(reply: QuickReply): void {
    const text = this.quickReplyText(reply);
    const input = this.composerInput()?.nativeElement;
    const current = this.replyText();
    let next: string;
    let caret: number;
    if (this.quickReplyStart >= 0) {
      const end = input?.selectionStart ?? current.length;
      next = current.slice(0, this.quickReplyStart) + text + current.slice(end);
      caret = this.quickReplyStart + text.length;
    } else {
      next = current.trim() ? `${current.replace(/\s*$/, '')} ${text}` : text;
      caret = next.length;
    }
    this.replyText.set(next);
    this.closeQuickReplies();
    if (input) {
      input.value = next;
      this.autoGrow(input);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(caret, caret);
      });
    }
  }

  private scrollActiveQuickReply(): void {
    setTimeout(() =>
      this.host.nativeElement
        .querySelector('.quick-reply-item.is-active')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }

  private autoGrow(input: HTMLTextAreaElement): void {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  async loadQuickReplies(): Promise<void> {
    try {
      const resp = await this.api.get<{ data: { items: QuickReply[] } }>(
        'conversations/quick-replies?status=1&limit=500',
      );
      this.quickReplies.set(resp.data?.items ?? []);
    } catch {
      // Without quick replies the composer still works; the list shows its empty state.
      this.quickReplies.set([]);
    }
  }

  async openNewQuickReply(): Promise<void> {
    const shortcut = this.quickReplyQuery();
    this.closeQuickReplies();
    const ref = this.dialog.open(ConfigurableCrudCollectionDialog, {
      data: {
        ...CONVERSATION_QUICK_REPLIES_CONFIG,
        initialValues: { ...CONVERSATION_QUICK_REPLIES_CONFIG.initialValues, shortcut },
        formOnly: true,
      },
      width: '720px',
    });
    await firstValueFrom(ref.afterClosed());
    await this.loadQuickReplies();
  }

  manageQuickReplies(): void {
    this.closeQuickReplies();
    void this.router.navigate(['/conversations/quick-replies']);
  }

  toggleContactDetails(): void {
    this.showContactDetails.set(!this.showContactDetails());
  }

  private t(key: string): string {
    return this.transloco.translate(key);
  }

  async loadConversations(silent = false): Promise<void> {
    if (!silent) this.loadingConversations.set(true);
    try {
      const resp = await this.api.get<{
        data: { items: ConversationItem[]; total: number };
      }>('conversations?limit=100');
      const items = resp.data?.items ?? [];
      this.conversations.set(items);

      const sel = this.selectedConversation();
      if (sel) {
        const updated = items.find((c) => c.CnvUUID === sel.CnvUUID);
        if (updated) {
          this.selectedConversation.set(updated);
        }
      }
    } catch {
      if (!silent) {
        this.snackBar.open(this.t('conversations.loadConversationsFailed'), 'OK', {
          duration: 3000,
        });
      }
    } finally {
      if (!silent) this.loadingConversations.set(false);
    }
  }

  async selectConversation(conv: ConversationItem): Promise<void> {
    this.selectedConversation.set(conv);
    this.mobilePane.set('chat');
    this.replyText.set('');
    this.closeQuickReplies();
    this.replyKind.set(this.isWindowClosed() ? 'note' : 'text');
    await this.loadMessages(conv.CnvUUID);

    if (conv.CnvUnreadCount > 0) {
      await this.markAsRead(conv);
    }
  }

  openFromKanban(conv: ConversationItem): void {
    this.viewMode.set('cockpit');
    void this.selectConversation(conv);
  }

  async loadMessages(conversationUUID: string, silent = false): Promise<void> {
    if (!silent) this.loadingMessages.set(true);
    try {
      const resp = await this.api.get<{
        data: { items: MessageItem[] };
      }>(`conversations/${conversationUUID}/messages?limit=100`);
      // Server returns newest first; the timeline reads oldest to newest.
      const list = [...(resp.data?.items ?? [])].reverse();
      const grew = list.length !== this.messages().length;
      this.messages.set(list);
      if (!silent || grew) this.scrollToBottom();
    } catch {
      if (!silent) {
        this.snackBar.open(this.t('conversations.loadMessagesFailed'), 'OK', { duration: 3000 });
      }
    } finally {
      if (!silent) this.loadingMessages.set(false);
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.timelineContainer()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  async sendMessage(): Promise<void> {
    const sel = this.selectedConversation();
    const text = this.replyText().trim();
    if (!sel || !text || this.sendingMessage()) return;

    this.sendingMessage.set(true);
    const kind = this.replyKind();

    try {
      await this.api.post(`conversations/${sel.CnvUUID}/messages`, {
        kind,
        body: text,
      });
      this.replyText.set('');
      const input = this.composerInput()?.nativeElement;
      if (input) {
        input.value = '';
        this.autoGrow(input);
      }
      await this.loadMessages(sel.CnvUUID, true);
      await this.loadConversations(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : this.t('conversations.sendFailed');
      this.snackBar.open(message, 'OK', { duration: 3500 });
    } finally {
      this.sendingMessage.set(false);
    }
  }

  async takeConversation(conv: ConversationItem, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const myUuid = this.currentUser()?.uuid;
    if (!myUuid) return;

    try {
      await this.api.put(`conversations/${conv.CnvUUID}`, {
        CnvRevision: conv.CnvRevision,
        AssignedUserUsrUUID: myUuid,
        CnvState: 'open',
      });
      this.snackBar.open(this.t('conversations.takeSuccess'), 'OK', { duration: 2500 });
      await this.loadConversations(true);
      if (this.selectedConversation()?.CnvUUID === conv.CnvUUID) {
        const updated = this.conversations().find((c) => c.CnvUUID === conv.CnvUUID);
        if (updated) this.selectedConversation.set(updated);
      }
    } catch {
      this.snackBar.open(this.t('conversations.takeFailed'), 'OK', { duration: 3000 });
    }
  }

  async changeState(
    conv: ConversationItem,
    newState: 'open' | 'pending' | 'snoozed' | 'resolved',
  ): Promise<void> {
    try {
      await this.api.put(`conversations/${conv.CnvUUID}`, {
        CnvRevision: conv.CnvRevision,
        CnvState: newState,
      });
      await this.loadConversations(true);
      if (this.selectedConversation()?.CnvUUID === conv.CnvUUID) {
        const updated = this.conversations().find((c) => c.CnvUUID === conv.CnvUUID);
        if (updated) this.selectedConversation.set(updated);
      }
    } catch {
      this.snackBar.open(this.t('conversations.stateFailed'), 'OK', { duration: 3000 });
    }
  }

  async resolveConversation(conv: ConversationItem, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    await this.changeState(conv, 'resolved');
    this.snackBar.open(this.t('conversations.resolvedToast'), 'OK', { duration: 2500 });
  }

  async reopenConversation(conv: ConversationItem, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    await this.changeState(conv, 'open');
    this.snackBar.open(this.t('conversations.reopenedToast'), 'OK', { duration: 2500 });
  }

  async markAsRead(conv: ConversationItem, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    try {
      await this.api.post(`conversations/${conv.CnvUUID}/read`, {});
      conv.CnvUnreadCount = 0;
      this.conversations.update((items) =>
        items.map((i) => (i.CnvUUID === conv.CnvUUID ? { ...i, CnvUnreadCount: 0 } : i)),
      );
    } catch {
      // Non-critical
    }
  }

  dialContact(phone?: string | null): void {
    if (!phone) return;
    if (this.phoneDialer.canDial(phone)) {
      this.phoneDialer.dial(phone);
    } else {
      window.open(`tel:${phone}`, '_blank');
    }
  }

  async copyText(value?: string | null): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.snackBar.open(this.t('conversations.copied'), 'OK', { duration: 2000 });
    } catch {
      // Clipboard may be unavailable; the value stays selectable on screen.
    }
  }

  async openLinkContact(conv: ConversationItem): Promise<void> {
    const ref = this.dialog.open(ConfigurableCrudCollectionDialog, {
      data: {
        ...linkContactForm(conv as unknown as ConfigurableCrudRecord),
        formOnly: true,
      },
      width: '640px',
    });
    await firstValueFrom(ref.afterClosed());
    await this.loadConversations(true);
  }

  async openNewConversation(): Promise<void> {
    const ref = this.dialog.open(ConfigurableCrudCollectionDialog, {
      data: {
        ...newConversationConfig(),
        formOnly: true,
      },
      width: '720px',
    });
    await firstValueFrom(ref.afterClosed());
    await this.loadConversations();
  }

  private handleRealtimeChanges(
    changes: Array<{ ConversationCnvUUID: string; kind: 'conversation' | 'message' }>,
  ): void {
    const current = this.selectedConversation();
    const hasActiveChange =
      current && changes.some((c) => c.ConversationCnvUUID === current.CnvUUID);

    void this.loadConversations(true);

    if (hasActiveChange && current) {
      void this.loadMessages(current.CnvUUID, true);
    }

    const hasMessage = changes.some((c) => c.kind === 'message');
    if (hasMessage) {
      playNotificationChime();
    }
  }

  onDragStart(conv: ConversationItem): void {
    this.draggedConversation.set(conv);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(targetStage: 'waiting' | 'active' | 'pending' | 'snoozed' | 'resolved'): void {
    const conv = this.draggedConversation();
    this.draggedConversation.set(null);
    if (!conv) return;

    if (targetStage === 'waiting') {
      void this.changeState(conv, 'open');
    } else if (targetStage === 'active') {
      void this.takeConversation(conv);
    } else if (targetStage === 'pending') {
      void this.changeState(conv, 'pending');
    } else if (targetStage === 'snoozed') {
      void this.changeState(conv, 'snoozed');
    } else if (targetStage === 'resolved') {
      void this.resolveConversation(conv);
    }
  }

  // Helpers
  contactLabel(conv?: ConversationItem | null): string {
    return (
      conv?.ContactName ||
      conv?.ContactPhone ||
      conv?.ContactEmail ||
      conv?.ContactExternalId ||
      this.t('conversations.visitor')
    );
  }

  getInitials(name?: string | null): string {
    const clean = String(name || '').trim();
    if (!clean) return 'C';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  /** Channel family of a connection kind (WhatsApp Cloud and Twilio are one family). */
  channelGroup(kind?: string): string {
    switch (kind) {
      case 'whatsapp-cloud':
      case 'whatsapp-twilio':
      case 'whatsapp':
        return 'whatsapp';
      case 'webchat':
      case 'instagram':
      case 'messenger':
      case 'telegram':
      case 'email':
      case 'internal':
        return kind;
      default:
        return 'other';
    }
  }

  getChannelIcon(kind?: string): string {
    switch (this.channelGroup(kind)) {
      case 'webchat':
        return 'language';
      case 'whatsapp':
        return 'chat';
      case 'instagram':
        return 'photo_camera';
      case 'messenger':
        return 'sms';
      case 'telegram':
        return 'send';
      case 'email':
        return 'mail';
      case 'internal':
        return 'group';
      default:
        return 'forum';
    }
  }

  /** Theme token of the channel accent (`--mns-channel-*`), readable in light and dark. */
  getChannelColor(kind?: string): string {
    const group = this.channelGroup(kind);
    return group === 'other' ? 'var(--mat-sys-color-primary)' : `var(--mns-channel-${group})`;
  }

  getChannelLabel(kind?: string): string {
    return this.t(`conversations.channelKind.${this.channelGroup(kind)}`);
  }

  channelText(conv?: ConversationItem | null): string {
    return conv?.ChannelName || this.getChannelLabel(conv?.ChannelKind);
  }

  getStateLabel(state?: string): string {
    return state ? this.t(`conversations.state.${state}`) : '—';
  }

  deliveryIcon(delivery?: string): string {
    return DELIVERY_ICONS[delivery || ''] ?? 'schedule';
  }

  deliveryLabel(delivery?: string): string {
    return this.t(
      `conversations.delivery.${delivery && DELIVERY_ICONS[delivery] ? delivery : 'queued'}`,
    );
  }

  formatTime(iso?: string | null): string {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return this.datePipe.transform(date, 'HH:mm') || '';
      }
      return this.datePipe.transform(date, 'dd/MM HH:mm') || '';
    } catch {
      return '';
    }
  }

  formatDateTime(iso?: string | null): string {
    if (!iso) return '—';
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '—';
      return this.datePipe.transform(date, 'dd/MM/yyyy HH:mm') || '—';
    } catch {
      return '—';
    }
  }
}
