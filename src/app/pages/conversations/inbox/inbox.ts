// crud-template-exempt: Dedicated omnichannel cockpit and kanban board workspace for live conversations.

import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
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

export interface ConversationItem {
  CnvUUID: string;
  ChannelConnectionChcUUID?: string;
  ChannelName?: string;
  ChcKind?: string;
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
  CrmLeadCleUUID?: string | null;
}

export interface MessageItem {
  CnmUUID: string;
  CnmSentAt: string;
  CnmAuthorType: 'contact' | 'agent' | 'bot' | 'system';
  AuthorName?: string | null;
  CnmDirection: 'inbound' | 'outbound' | 'internal';
  CnmBody: string;
  CnmKind: 'text' | 'note' | 'image' | 'audio' | 'video' | 'document' | 'template';
  CnmDelivery: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
}

export const CANNED_RESPONSES = [
  { label: 'Saudação inicial', text: 'Olá! Como posso ajudar você hoje?' },
  { label: 'Aguardar um momento', text: 'Um momento, por favor. Estou verificando suas informações em nosso sistema.' },
  { label: 'Solicitar CPF/CNPJ', text: 'Por gentileza, poderia me confirmar seu CPF ou CNPJ para localizar seu cadastro?' },
  { label: 'Chave PIX', text: 'Para pagamento via PIX, utilize nossa chave cadastrada e nos envie o comprovante.' },
  { label: 'Encerramento cordial', text: 'Foi um prazer atendê-lo(a)! Caso precise de algo mais, estamos à disposição. Tenha um ótimo dia!' },
];

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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    TranslocoPipe,
    MNS_MENU,
  ],
  templateUrl: './inbox.html',
  styleUrls: ['./inbox.scss'],
})
export class ConversationsInboxPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly phoneDialer = inject(PhoneDialer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly datePipe = new DatePipe('en-US');

  readonly timelineContainer = viewChild<ElementRef<HTMLDivElement>>('timelineContainer');

  // State Signals
  readonly viewMode = signal<'cockpit' | 'kanban'>('cockpit');
  readonly conversations = signal<ConversationItem[]>([]);
  readonly selectedConversation = signal<ConversationItem | null>(null);
  readonly messages = signal<MessageItem[]>([]);
  readonly loadingConversations = signal(false);
  readonly loadingMessages = signal(false);
  readonly sendingMessage = signal(false);

  // Filters & Composer
  readonly searchQuery = signal('');
  readonly stateFilter = signal<string>('active');
  readonly assigneeFilter = signal<string>('all');
  readonly replyKind = signal<'text' | 'note'>('text');
  readonly replyText = signal('');
  readonly showContactDetails = signal(true);
  readonly draggedConversation = signal<ConversationItem | null>(null);

  readonly cannedResponses = CANNED_RESPONSES;

  // Computed signals
  readonly currentUser = computed(() => this.auth.user());

  readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.stateFilter();
    const as = this.assigneeFilter();
    const myUuid = this.currentUser()?.uuid;

    return this.conversations().filter((c) => {
      // Search
      if (q) {
        const text = `${c.ContactName || ''} ${c.ContactPhone || ''} ${c.ContactEmail || ''} ${c.ContactExternalId || ''} ${c.CnvSubject || ''} ${c.LastMessage || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      // State filter
      if (st === 'active') {
        if (c.CnvState === 'resolved') return false;
      } else if (st !== 'all' && c.CnvState !== st) {
        return false;
      }

      // Assignee filter
      if (as === 'me') {
        if (!myUuid || c.AssignedUserUsrUUID !== myUuid) return false;
      } else if (as === 'unassigned') {
        if (c.AssignedUserUsrUUID) return false;
      }

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

  readonly isWindowClosed = computed(() => {
    const sel = this.selectedConversation();
    if (!sel?.CnvServiceWindowEndsAt) return false;
    const expiry = new Date(sel.CnvServiceWindowEndsAt).getTime();
    return !Number.isNaN(expiry) && expiry < Date.now();
  });

  constructor() {
    // Realtime event gateway
    watchConversationChanges(this.api, this.destroyRef, (changes) =>
      this.handleRealtimeChanges(changes),
    );
  }

  ngOnInit(): void {
    void this.loadConversations();
  }

  setViewMode(mode: 'cockpit' | 'kanban'): void {
    this.viewMode.set(mode);
  }

  setStateFilter(val: string): void {
    this.stateFilter.set(val);
  }

  setAssigneeFilter(val: string): void {
    this.assigneeFilter.set(val);
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

  onTextInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.replyText.set(target.value);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
    }
  }

  insertCanned(text: string): void {
    const current = this.replyText();
    this.replyText.set(current ? `${current} ${text}` : text);
  }

  toggleContactDetails(): void {
    this.showContactDetails.set(!this.showContactDetails());
  }

  // Load conversations from API
  async loadConversations(silent = false): Promise<void> {
    if (!silent) this.loadingConversations.set(true);
    try {
      const resp = await this.api.get<{
        data: { items: ConversationItem[]; total: number };
      }>('conversations?limit=100');
      const items = resp.data?.items ?? [];
      this.conversations.set(items);

      // If a conversation was selected, refresh reference
      const sel = this.selectedConversation();
      if (sel) {
        const updated = items.find((c) => c.CnvUUID === sel.CnvUUID);
        if (updated) {
          this.selectedConversation.set(updated);
        }
      }
    } catch {
      if (!silent) {
        this.snackBar.open('Falha ao carregar conversas.', 'OK', { duration: 3000 });
      }
    } finally {
      if (!silent) this.loadingConversations.set(false);
    }
  }

  // Select a conversation and load its messages
  async selectConversation(conv: ConversationItem): Promise<void> {
    this.selectedConversation.set(conv);
    this.replyText.set('');
    this.replyKind.set(this.isWindowClosed() ? 'note' : 'text');
    await this.loadMessages(conv.CnvUUID);

    // Auto mark as read if unread
    if (conv.CnvUnreadCount > 0) {
      await this.markAsRead(conv);
    }
  }

  openFromKanban(conv: ConversationItem): void {
    this.viewMode.set('cockpit');
    void this.selectConversation(conv);
  }

  // Load messages for a conversation
  async loadMessages(conversationUUID: string, silent = false): Promise<void> {
    if (!silent) this.loadingMessages.set(true);
    try {
      const resp = await this.api.get<{
        data: { items: MessageItem[] };
      }>(`conversations/${conversationUUID}/messages?limit=100`);
      // Server returns newest first, we reverse for natural chat timeline (oldest to newest)
      const list = [...(resp.data?.items ?? [])].reverse();
      this.messages.set(list);
      this.scrollToBottom();
    } catch {
      if (!silent) {
        this.snackBar.open('Falha ao carregar mensagens.', 'OK', { duration: 3000 });
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

  // Send a message or internal note
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
      // Refresh messages
      await this.loadMessages(sel.CnvUUID, true);
      // Refresh conversations list to update LastMessage
      await this.loadConversations(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Falha ao enviar mensagem.';
      this.snackBar.open(message, 'OK', { duration: 3500 });
    } finally {
      this.sendingMessage.set(false);
    }
  }

  // Assign conversation to current user
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
      this.snackBar.open('Atendimento assumido com sucesso.', 'OK', { duration: 2500 });
      await this.loadConversations(true);
      if (this.selectedConversation()?.CnvUUID === conv.CnvUUID) {
        const updated = this.conversations().find((c) => c.CnvUUID === conv.CnvUUID);
        if (updated) this.selectedConversation.set(updated);
      }
    } catch {
      this.snackBar.open('Falha ao assumir atendimento.', 'OK', { duration: 3000 });
    }
  }

  // Change conversation state
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
      this.snackBar.open('Falha ao atualizar status.', 'OK', { duration: 3000 });
    }
  }

  async resolveConversation(conv: ConversationItem, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    await this.changeState(conv, 'resolved');
    this.snackBar.open('Conversa resolvida.', 'OK', { duration: 2500 });
  }

  async reopenConversation(conv: ConversationItem, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    await this.changeState(conv, 'open');
    this.snackBar.open('Conversa reaberta.', 'OK', { duration: 2500 });
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

  // PhoneWeb dialer integration
  dialContact(phone?: string | null): void {
    if (!phone) return;
    if (this.phoneDialer.canDial(phone)) {
      this.phoneDialer.dial(phone);
    } else {
      window.open(`tel:${phone}`, '_blank');
    }
  }

  // Dialog actions
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

  // Real-time Event handling
  private handleRealtimeChanges(
    changes: Array<{ ConversationCnvUUID: string; kind: 'conversation' | 'message' }>,
  ): void {
    const current = this.selectedConversation();
    const hasActiveChange = current && changes.some((c) => c.ConversationCnvUUID === current.CnvUUID);

    // Refresh conversations list in background
    void this.loadConversations(true);

    if (hasActiveChange && current) {
      void this.loadMessages(current.CnvUUID, true);
    }

    // Play chime on message events
    const hasMessage = changes.some((c) => c.kind === 'message');
    if (hasMessage) {
      playNotificationChime();
    }
  }

  // HTML5 Drag and Drop for Kanban
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
  getInitials(name?: string | null): string {
    const clean = String(name || '').trim();
    if (!clean) return 'C';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  getChannelIcon(kind?: string): string {
    switch (kind) {
      case 'webchat':
        return 'language';
      case 'whatsapp-cloud':
      case 'whatsapp-twilio':
      case 'whatsapp':
        return 'chat';
      case 'instagram':
        return 'photo_camera';
      case 'messenger':
        return 'sms';
      case 'telegram':
        return 'send';
      case 'email':
        return 'email';
      case 'internal':
        return 'group';
      default:
        return 'forum';
    }
  }

  getChannelColor(kind?: string): string {
    switch (kind) {
      case 'webchat':
        return '#0284c7';
      case 'whatsapp-cloud':
      case 'whatsapp-twilio':
      case 'whatsapp':
        return '#16a34a';
      case 'instagram':
        return '#e1306c';
      case 'messenger':
        return '#0084ff';
      case 'telegram':
        return '#229ed9';
      case 'email':
        return '#ea580c';
      case 'internal':
        return '#7c3aed';
      default:
        return '#475569';
    }
  }

  getChannelLabel(kind?: string): string {
    switch (kind) {
      case 'webchat':
        return 'Chat do Site';
      case 'whatsapp-cloud':
      case 'whatsapp-twilio':
      case 'whatsapp':
        return 'WhatsApp';
      case 'instagram':
        return 'Instagram';
      case 'messenger':
        return 'Messenger';
      case 'telegram':
        return 'Telegram';
      case 'email':
        return 'E-mail';
      case 'internal':
        return 'Interno';
      default:
        return 'Canal';
    }
  }

  getStateLabel(state?: string): string {
    switch (state) {
      case 'open':
        return 'Aberta';
      case 'pending':
        return 'Aguardando cliente';
      case 'snoozed':
        return 'Adiada';
      case 'resolved':
        return 'Resolvida';
      default:
        return state || '—';
    }
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
