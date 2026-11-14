import {
  Component,
  DestroyRef,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ComponentType } from '@angular/cdk/portal';
import { Observable, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleGroup, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../../services/snackbar.service';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import {
  AssistMode,
  ChangeResult,
  RemoteAssistService,
  RemoteProposal,
  aiErrorKey,
  assistEntries,
  assistRequestErrorKey,
  assistThinking,
  canApprove,
  parseServerDate,
  canReject,
  changeResults,
  isProposalEvent,
  proposalChipClass,
  riskChipClass,
  safeChangeKey,
  sessionMode,
} from './remote-assistant';
import {
  ProposalDecisionData,
  ProposalDecisionResult,
  SupportRemoteProposalDecisionDialogComponent,
} from './remote-assistant-dialogs';
import { RemoteEvent, RemoteRecord, text } from './remote-session';

/**
 * Assistant side panel of one support session (ST-F): the AI copilot chat, the change proposals the
 * technician approves or rejects, and the Manual/Copiloto switch. It reads the session timeline the
 * console already streams (no stream of its own); only the proposals list is fetched, again after
 * every proposal_* / change_* event. Every AI text is shown as plain text (never as markup).
 */
@Component({
  selector: 'mns-support-remote-assistant',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
    MnsDateTimePipe,
    TranslocoPipe,
  ],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        min-width: 0;
        height: 100%;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }
      .head h2 {
        margin: 0;
        font-size: 1rem;
      }
      .meta {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8125rem;
        overflow-wrap: anywhere;
      }
      .head-end {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .proposals {
        flex: 0 0 auto;
      }
      .proposals summary {
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
      }
      .proposals-body {
        max-height: 38vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 6px;
      }
      .chat {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      h3 {
        margin: 4px 0 0;
        font-size: 0.875rem;
      }
      .bubble {
        padding: 8px 12px;
        border-radius: 12px;
        max-width: 92%;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .bubble.user {
        align-self: flex-end;
        background: var(--mat-sys-secondary-container, #e8def8);
      }
      .bubble.assistant {
        align-self: flex-start;
        background: var(--mat-sys-surface-container-highest, #333);
      }
      .when {
        display: block;
        margin-top: 4px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.6875rem;
      }
      .notice {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.875rem;
        overflow-wrap: anywhere;
        color: var(--mat-sys-on-error-container, #410e0b);
        background: var(--mat-sys-error-container, #f9dedc);
      }
      .thinking {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }
      .card {
        border: 1px solid var(--mat-sys-outline-variant, #ccc);
        border-radius: 10px;
        padding: 8px 10px;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .card summary {
        cursor: pointer;
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .card-head {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: space-between;
      }
      .card-head strong {
        overflow-wrap: anywhere;
      }
      .chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        align-items: center;
      }
      pre {
        margin: 0;
        padding: 6px 8px;
        border-radius: 6px;
        max-height: 200px;
        overflow: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 0.75rem;
        background: var(--mat-sys-surface-container-highest, #333);
      }
      .cmd {
        font-family: monospace;
        font-size: 0.75rem;
        overflow-wrap: anywhere;
      }
      .safe {
        display: flex;
        gap: 6px;
        align-items: flex-start;
        font-size: 0.8125rem;
        color: var(--mat-sys-on-tertiary-container, #31111d);
        background: var(--mat-sys-tertiary-container, #ffd8e4);
        padding: 6px 8px;
        border-radius: 8px;
      }
      .safe mat-icon,
      .notice mat-icon {
        flex: none;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .result {
        font-size: 0.8125rem;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .composer {
        display: flex;
        gap: 6px;
        align-items: flex-end;
      }
      .composer textarea {
        flex: 1 1 auto;
        min-height: 40px;
        resize: vertical;
        border-radius: 8px;
        padding: 8px;
        font: inherit;
        color: inherit;
        background: transparent;
        border: 1px solid var(--mat-sys-outline, #888);
      }
      .empty {
        color: var(--mat-sys-on-surface-variant);
        padding: 16px 8px;
        text-align: center;
        font-size: 0.875rem;
      }
    `,
  ],
  template: `
    <div class="head">
      <h2>{{ 'support.remote.ai.title' | transloco }}</h2>
      <span class="head-end">
        @if (technician() && !closed()) {
          <mat-button-toggle-group
            #modeGroup
            [value]="mode()"
            [disabled]="modeBusy() || mode() === 'runbook'"
            (change)="changeMode($event.value)"
            hideSingleSelectionIndicator
            [attr.aria-label]="'support.remote.ai.mode' | transloco"
            [matTooltip]="'support.remote.ai.modeHelp' | transloco"
          >
            <mat-button-toggle value="manual">{{
              'support.remote.ai.mode.manual' | transloco
            }}</mat-button-toggle>
            <mat-button-toggle value="copilot">{{
              'support.remote.ai.mode.copilot' | transloco
            }}</mat-button-toggle>
          </mat-button-toggle-group>
        }
        @if (mode() === 'runbook' || !technician() || closed()) {
          <span class="status-pill status-chip chip-skipped">{{
            'support.remote.ai.mode.' + mode() | transloco
          }}</span>
        }
        <button
          mat-icon-button
          type="button"
          (click)="closeRequested.emit()"
          [matTooltip]="'support.remote.ai.close' | transloco"
          [attr.aria-label]="'support.remote.ai.close' | transloco"
        >
          <mat-icon>close</mat-icon>
        </button>
      </span>
    </div>
    <div class="meta">
      {{
        (mode() === 'copilot'
          ? 'support.remote.ai.modeCopilotHelp'
          : mode() === 'runbook'
            ? 'support.remote.ai.modeRunbookHelp'
            : 'support.remote.ai.modeManualHelp'
        ) | transloco
      }}
    </div>
    @if (proposals().length) {
      <details class="proposals" [open]="hasOpenProposals()">
        <summary>
          {{ 'support.remote.proposal.title' | transloco }} ({{ proposals().length }})
        </summary>
        <div class="proposals-body">
          @for (proposal of proposals(); track proposal.SrpUUID) {
            <article class="card" [attr.aria-label]="proposal.SrpTitle">
              <div class="card-head">
                <strong data-report-mask>{{ proposal.SrpTitle }}</strong>
                <span class="chips">
                  <span
                    class="status-pill status-chip"
                    [class]="'status-pill status-chip ' + risk(proposal.SrpRisk)"
                    >{{ 'support.remote.proposal.risk.' + proposal.SrpRisk | transloco }}</span
                  >
                  <span
                    class="status-pill status-chip"
                    [class]="'status-pill status-chip ' + statusChip(proposal.SrpStatus)"
                    >{{ 'support.remote.proposal.status.' + proposal.SrpStatus | transloco }}</span
                  >
                </span>
              </div>
              <div class="meta">
                {{ proposal.DeviceName }}
                @if (proposal.SrpStatus === 'proposed' && proposal.SrpExpiresAt) {
                  ·
                  {{
                    'support.remote.proposal.expires'
                      | transloco
                        : { date: (proposal.SrpExpiresAt | mnsDateTime: 'short' : 'short') }
                  }}
                }
              </div>
              @if (proposal.SrpJustification) {
                <div class="result" data-report-mask>{{ proposal.SrpJustification }}</div>
              }
              <details>
                <summary>
                  {{ 'support.remote.proposal.commands' | transloco }} ({{
                    proposal.SrpCommands.length
                  }})
                </summary>
                <pre data-report-mask>{{ proposal.SrpCommands.join('\\n') }}</pre>
                <div class="meta">{{ 'support.remote.proposal.verify' | transloco }}</div>
                <pre data-report-mask>{{ proposal.SrpVerify.join('\\n') }}</pre>
                @if (proposal.SrpRollback.length) {
                  <div class="meta">{{ 'support.remote.proposal.rollback' | transloco }}</div>
                  <pre data-report-mask>{{ proposal.SrpRollback.join('\\n') }}</pre>
                }
              </details>
              <div class="safe">
                <mat-icon>shield</mat-icon>
                <span>{{ safeKey(proposal.SrpSafeChange) | transloco }}</span>
              </div>
              @if (resultOf(proposal); as result) {
                <div class="result" role="status">
                  <strong>{{ 'support.remote.proposal.result' | transloco }}:</strong>
                  {{ 'support.remote.proposal.status.' + result.status | transloco }}
                  @if (result.rollbackMethod && result.rollbackMethod !== 'none') {
                    ·
                    {{
                      (result.rollbackFired || result.status === 'rolled_back'
                        ? 'support.remote.proposal.rollbackFired'
                        : 'support.remote.proposal.rollbackArmed'
                      ) | transloco
                    }}
                  }
                  @if (result.pendingReboot) {
                    · {{ 'support.remote.proposal.pendingReboot' | transloco }}
                  }
                  @if (result.errorCode || result.errorMessage) {
                    <br />
                    <span data-report-mask>{{ result.errorCode }} {{ result.errorMessage }}</span>
                  }
                </div>
              }
              @if (proposal.SrpDecisionNote) {
                <div class="meta" data-report-mask>{{ proposal.SrpDecisionNote }}</div>
              }
              @if (technician() && !closed() && !canConsole() && showApprove(proposal)) {
                <div class="meta">{{ 'support.remote.proposal.needsConsole' | transloco }}</div>
              }
              @if (technician() && !closed() && (showApprove(proposal) || canRejectIt(proposal))) {
                <div class="actions">
                  @if (canRejectIt(proposal)) {
                    <button
                      mat-stroked-button
                      type="button"
                      [disabled]="busyProposal() === proposal.SrpUUID"
                      (click)="decide(proposal, 'reject')"
                    >
                      {{ 'support.remote.proposal.reject' | transloco }}
                    </button>
                  }
                  @if (showApprove(proposal) && canConsole()) {
                    <button
                      mat-flat-button
                      type="button"
                      [disabled]="busyProposal() === proposal.SrpUUID"
                      (click)="decide(proposal, 'approve')"
                    >
                      {{
                        (proposal.SrpStatus === 'approved'
                          ? 'support.remote.proposal.retry'
                          : 'support.remote.proposal.approve'
                        ) | transloco
                      }}
                    </button>
                  }
                </div>
              }
            </article>
          }
        </div>
      </details>
    }
    <div class="scroll" #scroll (scroll)="onScroll()">
      <div class="chat" aria-live="polite">
        @if (!entries().length && !thinking()) {
          <div class="empty">
            {{
              (canAssist() ? 'support.remote.ai.empty' : 'support.remote.ai.emptyReadOnly')
                | transloco
            }}
          </div>
        }
        @for (entry of entries(); track entry.seq) {
          @if (entry.type === 'request') {
            <div class="bubble user" data-report-mask>
              {{ entry.text }}
              <span class="when">{{ entry.date | mnsDateTime: 'short' : 'short' }}</span>
            </div>
          } @else if (entry.type === 'reply') {
            <div class="bubble assistant" data-report-mask>
              {{ entry.text }}
              <span class="when">{{ entry.date | mnsDateTime: 'short' : 'short' }}</span>
            </div>
          } @else if (entry.type === 'error') {
            <div class="notice" role="alert">
              <mat-icon>error</mat-icon>
              <span>
                {{ errorKey(entry.code) | transloco }}
                {{ 'support.remote.ai.manualStillAvailable' | transloco }}
              </span>
            </div>
          } @else if (entry.type === 'exec') {
            <details class="card">
              <summary>
                <mat-icon>terminal</mat-icon>
                <strong>{{ entry.device }}</strong>
                <span
                  class="status-pill status-chip"
                  [class]="'status-pill status-chip ' + execChip(entry.status)"
                  >{{ execStatusKey(entry.status) | transloco }}</span
                >
                <span class="meta">
                  {{
                    'support.remote.ai.exec.commands' | transloco: { count: entry.commands.length }
                  }}
                </span>
              </summary>
              @for (command of entry.commands; track $index) {
                <div class="cmd" data-report-mask>
                  $ {{ command.command }}
                  <span class="meta"
                    >[{{ command.class }}
                    @if (command.exitCode !== null) {
                      · {{ 'support.remote.ai.exec.exit' | transloco: { code: command.exitCode } }}
                    }
                    @if (command.verdict === 'blocked') {
                      · {{ 'support.remote.ai.exec.blocked' | transloco }}
                    }
                    ]</span
                  >
                </div>
                @if (command.hidden) {
                  <div class="meta">{{ 'support.remote.ai.exec.hidden' | transloco }}</div>
                } @else if (command.output) {
                  <pre data-report-mask>{{ command.output }}</pre>
                }
                @if (command.truncated) {
                  <div class="meta">{{ 'support.remote.ai.exec.truncated' | transloco }}</div>
                }
              }
              @if (entry.omitted) {
                <div class="meta">
                  {{ 'support.remote.ai.exec.omitted' | transloco: { count: entry.omitted } }}
                </div>
              }
              @if (entry.error) {
                <div class="meta" data-report-mask>{{ entry.error }}</div>
              }
            </details>
          }
        }
        @if (thinking()) {
          <div class="thinking" role="status">
            <mat-icon>hourglass_top</mat-icon>
            {{ 'support.remote.ai.thinking' | transloco }}
          </div>
        }
      </div>
    </div>
    @if (canAssist() && !closed()) {
      <div class="composer">
        <textarea
          rows="2"
          maxlength="4000"
          [attr.aria-label]="'support.remote.ai.placeholder' | transloco"
          [placeholder]="'support.remote.ai.placeholder' | transloco"
          [ngModel]="message()"
          (ngModelChange)="message.set($event)"
          (keydown.control.enter)="send()"
        ></textarea>
        <button
          mat-icon-button
          type="button"
          [disabled]="!message().trim() || sending()"
          (click)="send()"
          [attr.aria-label]="'support.remote.ai.send' | transloco"
          [matTooltip]="'support.remote.ai.send' | transloco"
        >
          <mat-icon>send</mat-icon>
        </button>
      </div>
    } @else if (!closed()) {
      <div class="meta">{{ 'support.remote.ai.readOnly' | transloco }}</div>
    }
  `,
})
export class SupportRemoteAssistantComponent {
  readonly sessionUUID = input.required<string>();
  readonly session = input<RemoteRecord | null>(null);
  readonly events = input<readonly RemoteEvent[]>([]);
  /** The session technician with the write permission (mode and proposals). */
  readonly technician = input(false);
  /** The technician who also holds `tenant.support.remote.assist` (chat). */
  readonly canAssist = input(false);
  readonly closed = input(false);
  /** Holds tenant.network.devices.console, required by the API to approve a change. */
  readonly canConsole = input(false);
  /** The session record changed (mode): the console reads it again. */
  readonly sessionChanged = output<void>();
  /** The user closed the panel (bottom sheet on narrow screens). */
  readonly closeRequested = output<void>();

  private readonly service = inject(RemoteAssistService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly message = signal('');
  readonly sending = signal(false);
  readonly modeBusy = signal(false);
  readonly busyProposal = signal('');
  readonly proposals = signal<RemoteProposal[]>([]);
  private readonly now = signal(Date.now());
  private readonly modeGroup = viewChild<MatButtonToggleGroup>('modeGroup');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroll');
  private nearBottom = true;
  private lastDecision = { uuid: '', at: 0 };

  readonly mode = computed<AssistMode | 'runbook'>(() => sessionMode(this.session()));
  readonly entries = computed(() => assistEntries(this.events()));
  readonly thinking = computed(() => assistThinking(this.session(), this.events()));
  readonly hasOpenProposals = computed(() =>
    this.proposals().some((p) => ['proposed', 'approved', 'applying'].includes(p.SrpStatus)),
  );
  readonly results = computed(() => changeResults(this.events()));
  /** Highest proposal_* / change_* sequence: a change reloads the proposal list. */
  private readonly proposalMark = computed(() =>
    this.events().reduce(
      (max, event) => (isProposalEvent(event.SreKind) ? Math.max(max, Number(event.SreSeq)) : max),
      0,
    ),
  );

  readonly risk = riskChipClass;
  readonly statusChip = proposalChipClass;
  readonly safeKey = safeChangeKey;
  readonly errorKey = aiErrorKey;

  private destroyed = false;
  private loadTicket = 0;

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30000);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearInterval(timer);
    });
    effect(() => {
      const uuid = this.sessionUUID();
      // A different session: nothing of the previous one (proposals, draft) stays on screen.
      untracked(() => {
        this.proposals.set([]);
        this.message.set('');
        this.nearBottom = true;
      });
      void uuid;
    });
    effect(() => {
      const uuid = this.sessionUUID();
      this.proposalMark();
      untracked(() => void this.loadProposals(uuid));
    });
    // Follow the newest entry or the "thinking" indicator while the user is near the bottom.
    effect(() => {
      this.entries();
      this.thinking();
      untracked(() =>
        setTimeout(() => {
          const el = this.scroller()?.nativeElement;
          if (el && this.nearBottom) el.scrollTop = el.scrollHeight;
        }, 0),
      );
    });
  }

  canApproveIt = canApprove;

  /**
   * Approve (or retry an approved one): not while a decision is under 30 s old, and not when the
   * latest change_* of the proposal already finished without failing.
   */
  showApprove(proposal: RemoteProposal): boolean {
    if (!canApprove(proposal)) return false;
    if (proposal.SrpStatus === 'proposed') return true;
    const decided = parseServerDate(proposal.SrpDecidedAt);
    const recent = this.lastDecision.uuid === proposal.SrpUUID ? this.lastDecision.at : decided;
    if (Number.isFinite(recent) && this.now() - recent < 30000) return false;
    const result = this.results().get(proposal.SrpUUID);
    return !result || result.status === 'failed' || result.status === 'blocked';
  }

  onScroll() {
    const el = this.scroller()?.nativeElement;
    if (el) this.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }
  canRejectIt = canReject;

  resultOf(proposal: RemoteProposal): ChangeResult | undefined {
    if (['proposed', 'rejected', 'expired'].includes(text(proposal.SrpStatus))) return undefined;
    return this.results().get(proposal.SrpUUID);
  }

  execChip(status: string): string {
    return status === 'ok'
      ? 'chip-success'
      : status === 'blocked' || status === 'timeout'
        ? 'chip-warning'
        : 'chip-danger';
  }

  execStatusKey(status: string): string {
    return ['ok', 'blocked', 'failed', 'timeout'].includes(status)
      ? `support.remote.ai.exec.status.${status}`
      : 'support.remote.ai.exec.status.failed';
  }

  private async loadProposals(uuid: string) {
    const ticket = ++this.loadTicket;
    if (!uuid) {
      this.proposals.set([]);
      return;
    }
    try {
      const items = await this.service.proposals(uuid);
      if (this.destroyed || ticket !== this.loadTicket) return;
      // Open proposals first, then the most recent.
      const open = (p: RemoteProposal) =>
        ['proposed', 'approved', 'applying'].includes(p.SrpStatus) ? 0 : 1;
      this.proposals.set(
        [...items].sort(
          (a, b) =>
            open(a) - open(b) || text(b['SrpDateCreated']).localeCompare(text(a['SrpDateCreated'])),
        ),
      );
    } catch {
      // keep the last list; the next proposal event reads it again
    }
  }

  async send() {
    const body = this.message().trim();
    if (!body || this.sending() || this.closed()) return;
    this.sending.set(true);
    try {
      await this.service.send(this.sessionUUID(), body);
      this.message.set('');
      this.nearBottom = true;
    } catch (error) {
      this.snack.error(assistRequestErrorKey(error) || 'support.remote.ai.sendFailed', 6000);
    } finally {
      this.sending.set(false);
    }
  }

  async changeMode(value: AssistMode) {
    const session = this.session();
    if (!session || value === this.mode() || this.modeBusy()) return;
    this.modeBusy.set(true);
    try {
      await this.service.setMode(this.sessionUUID(), Number(session['SrsRevision']), value);
      this.snack.success(
        value === 'copilot' ? 'support.remote.ai.modeCopilotOn' : 'support.remote.ai.modeManualOn',
      );
    } catch (error) {
      this.snack.error(assistRequestErrorKey(error) || 'support.remote.ai.modeFailed', 6000);
      // The toggle already moved: put it back on the mode the session really has.
      const group = this.modeGroup();
      if (group) group.value = this.mode();
    } finally {
      this.modeBusy.set(false);
      this.sessionChanged.emit();
    }
  }

  async decide(proposal: RemoteProposal, decision: 'approve' | 'reject') {
    const result = await this.ask<ProposalDecisionResult>(
      SupportRemoteProposalDecisionDialogComponent,
      { proposal, decision } satisfies ProposalDecisionData,
    );
    if (!result || this.destroyed) return;
    this.busyProposal.set(proposal.SrpUUID);
    try {
      if (decision === 'approve') {
        await this.service.approve(this.sessionUUID(), proposal, result.note);
        this.lastDecision = { uuid: proposal.SrpUUID, at: Date.now() };
        this.snack.success('support.remote.proposal.approved');
      } else {
        await this.service.reject(this.sessionUUID(), proposal, result.note);
        this.snack.success('support.remote.proposal.rejected');
      }
    } catch (error) {
      this.snack.error(assistRequestErrorKey(error) || 'support.remote.proposal.failed', 7000);
    } finally {
      this.busyProposal.set('');
      await this.loadProposals(this.sessionUUID());
    }
  }

  private async ask<R>(component: ComponentType<unknown>, data: unknown): Promise<R | undefined> {
    const binding = openCrudComponentDialog(this.dialog, component, 'crud-form-dialog', { data });
    try {
      return await firstValueFrom(binding.ref.afterClosed() as Observable<R | undefined>);
    } finally {
      binding.stop();
    }
  }
}
