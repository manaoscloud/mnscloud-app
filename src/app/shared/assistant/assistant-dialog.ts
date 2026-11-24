import {
  Component,
  afterNextRender,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { AppI18nService } from '../../services/app-i18n.service';
import { openCrudComponentDialog } from '../dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';
import {
  AssistantService,
  assistantActionKey,
  assistantErrorCode,
  assistantToolKey,
  safeAssistantRoute,
  type AssistantConversation,
  type AssistantLink,
  type AssistantMessage,
  type AssistantProposal,
} from './assistant.service';

/** A visible menu entry the user can open (already filtered by permission, scope and contract). */
export type AssistantScreen = { label: string; path: string; route: string; icon?: string };

/**
 * `screens` is read while the user types (not copied at open), so the search works even when the
 * panel opens before the menu finished loading.
 */
export type AssistantDialogData = { screens: () => AssistantScreen[]; route: string };

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Screens whose menu path holds every typed word (instant, no AI, no request). */
export function matchScreens(
  screens: AssistantScreen[],
  query: string,
  limit = 8,
): AssistantScreen[] {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((term) => term.length >= 2);
  if (!terms.length) return [];
  return screens
    .map((screen) => ({ screen, text: normalize(`${screen.path} ${screen.route}`) }))
    .filter((item) => terms.every((term) => item.text.includes(term)))
    .sort((a, b) => a.screen.path.length - b.screen.path.length)
    .slice(0, limit)
    .map((item) => item.screen);
}

const ERROR_KEYS: Record<string, string> = {
  AI_ASSISTANT_PROPOSAL_NOT_PENDING: 'assistant.errorActionDone',
  AI_ASSISTANT_PROPOSAL_EXPIRED: 'assistant.errorActionExpired',
  AI_ASSISTANT_RATE_LIMIT: 'assistant.errorRateLimit',
  AI_ASSISTANT_CONVERSATION_FULL: 'assistant.errorFull',
  AI_ASSISTANT_NOT_FOUND: 'assistant.errorNotFound',
};

/**
 * Ask panel: screen search first (instant), then a conversation with the App assistant, which
 * answers from product knowledge only and links to App screens. The assistant never changes
 * anything; the user opens the screen and does the steps.
 */
@Component({
  selector: 'mns-assistant-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  templateUrl: './assistant-dialog.html',
  styleUrl: './assistant-dialog.scss',
})
export class AssistantDialogComponent {
  private readonly data = inject<AssistantDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AssistantDialogComponent>);
  private readonly router = inject(Router);
  private readonly i18n = inject(AppI18nService);
  readonly assistant = inject(AssistantService);

  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('questionInput');
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  readonly query = signal('');
  readonly messages = signal<AssistantMessage[]>([]);
  readonly conversationUUID = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly showHistory = signal(false);
  readonly history = signal<AssistantConversation[]>([]);
  /** Action cards of the open conversation (A2). */
  readonly proposals = signal<AssistantProposal[]>([]);
  readonly acting = signal<string | null>(null);
  readonly feedbackSent = signal<Record<string, boolean>>({});

  readonly screens = computed(() =>
    this.messages().length ? [] : matchScreens(this.data.screens(), this.query()),
  );
  readonly canAsk = computed(
    () => !this.busy() && this.assistant.available() !== false && this.query().trim().length >= 3,
  );

  constructor() {
    void this.assistant.refreshStatus();
    afterNextRender(() => this.input()?.nativeElement.focus());
  }

  openScreen(route: string | null): void {
    const target = safeAssistantRoute(route);
    if (!target) return;
    this.ref.close();
    void this.router.navigateByUrl(target);
  }

  openLink(link: AssistantLink): void {
    this.openScreen(link.route);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    const first = this.screens()[0];
    if (event.ctrlKey || event.metaKey || !this.canAsk()) {
      if (first) this.openScreen(first.route);
      return;
    }
    void this.ask();
  }

  async ask(text?: string): Promise<void> {
    const question = (text ?? this.query()).trim();
    if (question.length < 3 || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.query.set('');
    const language = this.i18n.language();
    const pending: AssistantMessage = {
      messageUUID: `pending-${Date.now()}`,
      role: 'user',
      text: question,
      links: [],
      outcome: null,
    };
    this.messages.update((list) => [...list, pending]);
    this.scrollDown();
    try {
      const uuid = this.conversationUUID();
      let result: { question: AssistantMessage; answer: AssistantMessage };
      if (uuid) {
        result = await this.assistant.ask(uuid, question, this.data.route, language);
      } else {
        const started = await this.assistant.start(question, this.data.route, language);
        this.conversationUUID.set(started.conversation?.conversationUUID || null);
        result = started;
      }
      this.messages.update((list) => [
        ...list.filter((item) => item !== pending),
        { ...result.question, links: [], outcome: null },
        result.answer,
      ]);
      if (result.answer.proposals?.length) {
        this.proposals.update((list) => [...list, ...result.answer.proposals!]);
      }
    } catch (error) {
      const code = assistantErrorCode(error);
      this.messages.update((list) => list.filter((item) => item !== pending));
      this.query.set(question);
      this.error.set(ERROR_KEYS[code] ?? 'assistant.errorGeneric');
    } finally {
      this.busy.set(false);
      this.scrollDown();
      queueMicrotask(() => this.input()?.nativeElement.focus());
    }
  }

  newConversation(): void {
    this.conversationUUID.set(null);
    this.messages.set([]);
    this.proposals.set([]);
    this.error.set(null);
    this.showHistory.set(false);
    queueMicrotask(() => this.input()?.nativeElement.focus());
  }

  async toggleHistory(): Promise<void> {
    const open = !this.showHistory();
    this.showHistory.set(open);
    if (!open) return;
    try {
      this.history.set(await this.assistant.conversations());
    } catch {
      this.history.set([]);
    }
  }

  async openConversation(item: AssistantConversation): Promise<void> {
    try {
      const data = await this.assistant.conversation(item.conversationUUID);
      this.conversationUUID.set(item.conversationUUID);
      this.messages.set(data.messages ?? []);
      this.proposals.set(data.proposals ?? []);
      this.showHistory.set(false);
      this.error.set(null);
      this.scrollDown();
    } catch {
      this.error.set('assistant.errorNotFound');
    }
  }

  async removeConversation(item: AssistantConversation, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.assistant.remove(item.conversationUUID);
      this.history.update((list) =>
        list.filter((entry) => entry.conversationUUID !== item.conversationUUID),
      );
      if (this.conversationUUID() === item.conversationUUID) this.newConversation();
    } catch {
      this.error.set('assistant.errorGeneric');
    }
  }

  /** Unavailable answers keep their text; the outcome only adds a hint. */
  unavailable(message: AssistantMessage): boolean {
    return message.role === 'assistant' && !!message.outcome?.toLowerCase().startsWith('ai_');
  }

  /** Pending cards, and uncertain ones (resent with the same idempotency key, never run twice). */
  canConfirm(proposal: AssistantProposal): boolean {
    return proposal.status === 'proposed' || proposal.status === 'unknown';
  }

  actionKey(proposal: AssistantProposal): string {
    return assistantActionKey(proposal);
  }

  /** The user's explicit confirmation: the only way an action of the assistant runs. */
  async confirmProposal(proposal: AssistantProposal): Promise<void> {
    if (this.acting() || !this.canConfirm(proposal)) return;
    this.acting.set(proposal.proposalUUID);
    this.error.set(null);
    try {
      const result = await this.assistant.confirm(proposal.proposalUUID, this.i18n.language());
      this.replaceProposal(result.proposal);
      this.messages.update((list) => [
        ...list,
        {
          messageUUID: `result-${proposal.proposalUUID}`,
          role: 'assistant',
          text: result.text,
          links: [],
          outcome: result.proposal.status === 'executed' ? 'action_executed' : 'action_failed',
        },
      ]);
    } catch (error) {
      const code = assistantErrorCode(error);
      this.error.set(ERROR_KEYS[code] ?? 'assistant.errorGeneric');
      if (code === 'AI_ASSISTANT_PROPOSAL_EXPIRED')
        this.replaceProposal({ ...proposal, status: 'expired' });
    } finally {
      this.acting.set(null);
      this.scrollDown();
    }
  }

  async rejectProposal(proposal: AssistantProposal): Promise<void> {
    if (this.acting() || proposal.status !== 'proposed') return;
    this.acting.set(proposal.proposalUUID);
    try {
      const result = await this.assistant.reject(proposal.proposalUUID);
      this.replaceProposal(result.proposal);
    } catch {
      this.error.set('assistant.errorGeneric');
    } finally {
      this.acting.set(null);
    }
  }

  private replaceProposal(next: AssistantProposal): void {
    this.proposals.update((list) =>
      list.map((item) => (item.proposalUUID === next.proposalUUID ? { ...item, ...next } : item)),
    );
  }

  toolKey(tool: string): string {
    return assistantToolKey(tool);
  }

  async submitFeedback(
    message: AssistantMessage,
    helpful: boolean,
    reason?: string,
  ): Promise<void> {
    if (!message.messageUUID || this.feedbackSent()[message.messageUUID]) return;
    this.feedbackSent.update((prev) => ({ ...prev, [message.messageUUID]: true }));
    try {
      await this.assistant.feedback(message.messageUUID, helpful, reason);
    } catch {
      // non-blocking
    }
  }

  paragraphs(text: string): string[] {
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  close(): void {
    this.ref.close();
  }

  private scrollDown(): void {
    queueMicrotask(() => {
      const element = this.thread()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }
}

export function openAssistantDialog(dialog: MatDialog, data: AssistantDialogData): void {
  if (dialog.openDialogs.some((ref) => ref.componentInstance instanceof AssistantDialogComponent)) {
    return;
  }
  const binding = openCrudComponentDialog(dialog, AssistantDialogComponent, 'crud-form-dialog', {
    data,
  });
  void firstValueFrom(binding.ref.afterClosed()).finally(() => binding.stop());
}
