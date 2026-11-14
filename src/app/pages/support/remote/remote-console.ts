import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ComponentType } from '@angular/cdk/portal';
import { Observable, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { APP_BUILD_INFO } from '../../../app-build-info';
import {
  normalizeEnvironmentUUID,
  readStoredEnvironmentUUID,
} from '../../../core/environment/environment-context';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { MNS_MENU } from '../../../shared/menu/mns-menu';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';
import { resolveApiUrl } from '../../../shared/runtime/app-runtime-config';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import { REMOTE_LOOKUPS } from './remote-lookup';
import {
  NewSessionResult,
  PromptData,
  PromptResult,
  SupportRemoteNewDialogComponent,
  SupportRemotePromptDialogComponent,
} from './remote-dialogs';
import {
  REMOTE_BASE,
  REMOTE_EVENT_KINDS,
  REMOTE_MAX_TABS,
  RemoteEvent,
  RemoteEventFeed,
  RemoteRecord,
  RemoteSessionDetail,
  deviceName,
  eventData,
  isClosed,
  lastSeq,
  mergeEvents,
  personName,
  pick,
  stateChipClass,
  text,
  unwrap,
} from './remote-session';
import { SupportRemoteTerminalComponent } from './remote-terminal';
import { SupportRemoteAssistantComponent } from './remote-assistant-panel';
import { RemoteAssistService } from './remote-assistant';

const UI_KEY = 'mns.support.remote.ui';
const EVENT_PAGE = 500;
/** Events that change the session itself: the header, members and devices are read again. */
const DETAIL_EVENTS = new Set([
  'device_added',
  'device_removed',
  'member_added',
  'member_removed',
  'transferred',
  'state',
  'closed',
  // The assistant run (AssistRunUUID) and the mode live on the session record.
  'ai_request',
  'ai_reply',
  'ai_error',
]);

type UiState = {
  /** Session shown last, and the device whose terminal is reattached on reload. */
  selected: string;
  devices: Record<string, string>;
  /** Sessions opened from the list that are not mine (supervision), kept as tabs. */
  extra: string[];
  /** Assistant panel open (per browser, all sessions). */
  assistant?: boolean;
};

type TimelineItem = {
  seq: number;
  icon: string;
  key: string;
  params: Record<string, string>;
  text: string;
  date: string;
};

const EVENT_ICONS: Record<string, string> = {
  created: 'add_circle',
  note: 'sticky_note_2',
  device_added: 'dns',
  device_removed: 'dns',
  connection_opened: 'terminal',
  connection_resumed: 'sync',
  connection_closed: 'link_off',
  observer_joined: 'visibility',
  transferred: 'swap_horiz',
  member_added: 'person_add',
  member_removed: 'person_remove',
  state: 'flag',
  summary: 'summarize',
  closed: 'task_alt',
  ai_request: 'smart_toy',
  ai_reply: 'smart_toy',
  ai_exec: 'manage_search',
  ai_error: 'error',
  proposal_created: 'lightbulb',
  proposal_approved: 'thumb_up',
  proposal_rejected: 'thumb_down',
  proposal_expired: 'timer_off',
  change_applied: 'check_circle',
  change_failed: 'error',
  change_rolled_back: 'undo',
  change_blocked: 'block',
};

/**
 * Suporte › Remoto › Console: my open support sessions as tabs, each with its timeline (live by SSE,
 * polling as fallback), notes and actions on the left, and the device terminals on the right. The
 * terminal connection belongs to the session, not to the page: reloading reopens the same tabs and
 * reattaches through `POST .../terminal`.
 */
@Component({
  selector: 'app-support-remote-console',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    ...MNS_MENU,
    MnsDateTimePipe,
    ReportProblemButtonComponent,
    SupportRemoteAssistantComponent,
    SupportRemoteTerminalComponent,
    TranslocoPipe,
  ],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
      }
      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      h1 {
        margin: 0;
        font-size: 1.25rem;
      }
      .page-head p {
        margin: 2px 0 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }
      .tabs {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        align-items: center;
        padding-bottom: 2px;
      }
      .tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid var(--mat-sys-outline-variant, #ccc);
        background: transparent;
        color: inherit;
        cursor: pointer;
        white-space: nowrap;
        max-width: 240px;
      }
      .tab.active {
        background: var(--mat-sys-secondary-container, #e8def8);
        border-color: transparent;
      }
      .tab .name {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex: none;
        background: var(--mat-sys-outline, #888);
      }
      .dot.chip-success {
        background: #2e7d32;
      }
      .dot.chip-warning {
        background: #f9a825;
      }
      .dot.chip-skipped {
        background: var(--mat-sys-outline, #888);
      }
      .workspace {
        display: grid;
        grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
        gap: 12px;
        flex: 1 1 auto;
        min-height: 0;
      }
      .workspace.with-assistant {
        grid-template-columns: minmax(260px, 340px) minmax(0, 1fr) minmax(300px, 400px);
      }
      @media (max-width: 900px) {
        .workspace,
        .workspace.with-assistant {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      /* Narrow screens: the assistant is a bottom sheet over the page instead of a third column. */
      @media (max-width: 1280px) {
        .workspace.with-assistant {
          grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
        }
        .workspace.with-assistant > .assistant {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 20;
          height: min(70vh, 640px);
          border-radius: 16px 16px 0 0;
          background: var(--mat-sys-surface, #fff);
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.35);
        }
      }
      @media (max-width: 900px) {
        .workspace.with-assistant {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        min-width: 0;
        border: 1px solid var(--mat-sys-outline-variant, #ccc);
        border-radius: 12px;
        padding: 12px;
      }
      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .panel-head h2 {
        margin: 0;
        font-size: 1rem;
      }
      .meta {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8125rem;
        overflow-wrap: anywhere;
      }
      .timeline {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        flex: 1 1 auto;
        min-height: 160px;
        max-height: 60vh;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .timeline li {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .timeline mat-icon {
        flex: none;
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--mat-sys-on-surface-variant);
      }
      .timeline .body {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .timeline .when {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.75rem;
      }
      .timeline .note {
        white-space: pre-wrap;
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
      .chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        align-items: center;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 4px 4px 10px;
        border-radius: 16px;
        border: 1px solid var(--mat-sys-outline-variant, #ccc);
        cursor: pointer;
        background: transparent;
        color: inherit;
      }
      .chip.active {
        background: var(--mat-sys-secondary-container, #e8def8);
        border-color: transparent;
      }
      .chip .remove {
        width: 24px;
        height: 24px;
        padding: 0;
        line-height: 24px;
      }
      .empty {
        color: var(--mat-sys-on-surface-variant);
        padding: 24px 8px;
        text-align: center;
      }
      .closed-banner {
        padding: 8px 12px;
        border-radius: 8px;
        background: var(--mat-sys-surface-container-highest, #333);
      }
    `,
  ],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ 'support.remote.console.title' | transloco }}</h1>
        <p>{{ 'support.remote.console.description' | transloco }}</p>
      </div>
      <mns-report-problem-button />
    </div>
    <nav class="tabs" role="tablist" [attr.aria-label]="'support.remote.console.title' | transloco">
      @for (tab of tabs(); track tab['SrsUUID']) {
        <button
          type="button"
          class="tab"
          role="tab"
          [class.active]="tab['SrsUUID'] === selected()"
          [attr.aria-selected]="tab['SrsUUID'] === selected()"
          (click)="select(text(tab['SrsUUID']))"
        >
          <span
            class="dot"
            [class]="stateChip(tab['SrsState'])"
            [matTooltip]="'support.remote.state.' + tab['SrsState'] | transloco"
          ></span>
          <span class="name">{{ tab['SrsTitle'] }}</span>
        </button>
      }
      <button
        mat-stroked-button
        type="button"
        [disabled]="tabs().length >= maxTabs || !canWrite()"
        (click)="createSession()"
      >
        <mat-icon>add</mat-icon>
        {{ 'support.remote.new.button' | transloco }}
      </button>
    </nav>
    @if (!loading() && !tabs().length) {
      <div class="empty">{{ 'support.remote.console.empty' | transloco }}</div>
    }
    @if (session(); as current) {
      <div class="workspace" [class.with-assistant]="assistantOpen()">
        <section class="panel" [attr.aria-label]="'support.remote.timeline' | transloco">
          <div class="panel-head">
            <div>
              <h2>{{ current['SrsTitle'] }}</h2>
              <div class="meta">
                {{ 'support.remote.state.' + current['SrsState'] | transloco }} ·
                {{ 'support.remote.level.' + current['SrsLevel'] | transloco }} ·
                {{ technicianName() }}
                @if (customerText()) {
                  · {{ customerText() }}
                }
              </div>
            </div>
            <button
              mat-icon-button
              type="button"
              [attr.aria-pressed]="assistantOpen()"
              (click)="toggleAssistant()"
              [matTooltip]="'support.remote.ai.toggle' | transloco"
              [attr.aria-label]="'support.remote.ai.toggle' | transloco"
            >
              <mat-icon>smart_toy</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              [matMenuTriggerFor]="actions"
              [attr.aria-label]="'support.remote.actions' | transloco"
            >
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #actions="matMenu" class="mns-menu mns-menu-compact">
              @if (canWatch()) {
                <button mat-menu-item mnsMenuItem type="button" (click)="watch()">
                  <mat-icon>visibility</mat-icon>
                  <span>{{ 'support.remote.action.watch' | transloco }}</span>
                </button>
              }
              @if (canTransfer()) {
                <button mat-menu-item mnsMenuItem type="button" (click)="transfer()">
                  <mat-icon>swap_horiz</mat-icon>
                  <span>{{ 'support.remote.action.transfer' | transloco }}</span>
                </button>
              }
              @if (canMembers()) {
                <button mat-menu-item mnsMenuItem type="button" (click)="addSupervisor()">
                  <mat-icon>person_add</mat-icon>
                  <span>{{ 'support.remote.action.addSupervisor' | transloco }}</span>
                </button>
              }
              @if (isTechnician()) {
                <button mat-menu-item mnsMenuItem type="button" (click)="addDevice()">
                  <mat-icon>dns</mat-icon>
                  <span>{{ 'support.remote.action.addDevice' | transloco }}</span>
                </button>
                <button mat-menu-item mnsMenuItem type="button" (click)="toggleWaiting()">
                  <mat-icon>hourglass_empty</mat-icon>
                  <span>{{
                    (current['SrsState'] === 'waiting_customer'
                      ? 'support.remote.action.resume'
                      : 'support.remote.action.waitCustomer'
                    ) | transloco
                  }}</span>
                </button>
                <button mat-menu-item mnsMenuItem type="button" (click)="closeSession()">
                  <mat-icon>task_alt</mat-icon>
                  <span>{{ 'support.remote.action.close' | transloco }}</span>
                </button>
              }
            </mat-menu>
          </div>
          @if (feedMode() === 'polling') {
            <div class="meta">{{ 'support.remote.feed.polling' | transloco }}</div>
          }
          <ul class="timeline" aria-live="polite">
            @for (item of timeline(); track item.seq) {
              <li>
                <mat-icon>{{ item.icon }}</mat-icon>
                <div class="body">
                  <div>{{ item.key | transloco: item.params }}</div>
                  @if (item.text) {
                    <div class="note" data-report-mask>{{ item.text }}</div>
                  }
                  <div class="when">{{ item.date | mnsDateTime: 'short' : 'medium' }}</div>
                </div>
              </li>
            }
          </ul>
          @if (!closed() && canWrite()) {
            <div class="composer">
              <textarea
                rows="2"
                maxlength="4000"
                [attr.aria-label]="'support.remote.note.placeholder' | transloco"
                [placeholder]="'support.remote.note.placeholder' | transloco"
                [ngModel]="note()"
                (ngModelChange)="note.set($event)"
                (keydown.control.enter)="sendNote()"
              ></textarea>
              <button
                mat-icon-button
                type="button"
                [disabled]="!note().trim()"
                (click)="sendNote()"
                [attr.aria-label]="'support.remote.note.send' | transloco"
              >
                <mat-icon>send</mat-icon>
              </button>
            </div>
          }
        </section>
        <section class="panel" [attr.aria-label]="'support.remote.terminal' | transloco">
          <div class="chips">
            @for (device of devices(); track device['NetworkDeviceNwdUUID']) {
              <span
                class="chip"
                role="button"
                tabindex="0"
                [class.active]="device['NetworkDeviceNwdUUID'] === activeDevice()"
                (click)="openDevice(text(device['NetworkDeviceNwdUUID']))"
                (keydown.enter)="openDevice(text(device['NetworkDeviceNwdUUID']))"
              >
                <mat-icon>terminal</mat-icon>
                {{ name(device) }}
                @if (isTechnician() && !closed()) {
                  <button
                    mat-icon-button
                    type="button"
                    class="remove"
                    [attr.aria-label]="'support.remote.device.remove' | transloco"
                    (click)="removeDevice(device, $event)"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </span>
            }
            @if (!devices().length) {
              <span class="meta">{{ 'support.remote.device.none' | transloco }}</span>
            }
          </div>
          @if (closed()) {
            <div class="closed-banner">{{ 'support.remote.closedBanner' | transloco }}</div>
          } @else if (terminalKey(); as key) {
            @for (k of [key]; track k) {
              <mns-support-remote-terminal
                [sessionUUID]="text(current['SrsUUID'])"
                [deviceUUID]="activeDevice()"
                [deviceName]="activeDeviceName()"
                (opened)="refreshAfterOpen()"
              />
            }
          } @else if (devices().length) {
            <div class="empty">{{ 'support.remote.device.pick' | transloco }}</div>
          }
        </section>
        @if (assistantOpen()) {
          <section
            class="panel assistant"
            [attr.aria-label]="'support.remote.ai.title' | transloco"
          >
            <mns-support-remote-assistant
              [sessionUUID]="text(current['SrsUUID'])"
              [session]="current"
              [events]="events()"
              [technician]="isTechnician()"
              [canAssist]="canAssist()"
              [canConsole]="can('tenant.network.devices.console')"
              [closed]="closed()"
              (sessionChanged)="reloadDetail()"
              (closeRequested)="toggleAssistant()"
            />
          </section>
        }
      </div>
    }
  `,
})
export class SupportRemoteConsolePage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  readonly maxTabs = REMOTE_MAX_TABS;
  readonly text = text;
  readonly stateChip = stateChipClass;
  readonly name = deviceName;

  readonly loading = signal(true);
  readonly tabs = signal<RemoteRecord[]>([]);
  readonly selected = signal('');
  readonly detail = signal<RemoteSessionDetail | null>(null);
  readonly events = signal<RemoteEvent[]>([]);
  readonly feedMode = signal<'live' | 'polling'>('live');
  readonly activeDevice = signal('');
  readonly note = signal('');
  readonly assistantOpen = signal(false);

  readonly session = computed(() => this.detail()?.session ?? null);
  readonly devices = computed(() => this.detail()?.devices ?? []);
  readonly members = computed(() => this.detail()?.members ?? []);
  readonly closed = computed(() => isClosed(this.session()));
  readonly isTechnician = computed(
    () => this.detail()?.myRole === 'technician' && !this.closed() && this.canWrite(),
  );
  readonly terminalKey = computed(() => {
    const session = text(this.session()?.['SrsUUID']);
    return session && this.activeDevice() ? `${session}:${this.activeDevice()}` : '';
  });
  readonly activeDeviceName = computed(() => {
    const device = this.devices().find(
      (item) => text(item['NetworkDeviceNwdUUID']) === this.activeDevice(),
    );
    return device ? deviceName(device) : '';
  });
  readonly technicianName = computed(
    () =>
      pick(this.session(), 'TechnicianName', 'SrsTechnicianName') ||
      this.memberName(this.session()?.['SrsTechnicianUUID']),
  );
  readonly customerText = computed(() => pick(this.session(), 'CustomerName', 'RegCustomerName'));
  readonly timeline = computed<TimelineItem[]>(() => this.events().map((e) => this.toItem(e)));

  private readonly assist = inject(RemoteAssistService);
  private feed: RemoteEventFeed | null = null;
  private detailTimer: ReturnType<typeof setTimeout> | undefined;
  private loadSequence = 0;
  private destroyed = false;

  /** True once the page is gone or a newer load replaced this one (checked after every await). */
  private stale(ticket = this.loadSequence): boolean {
    return this.destroyed || ticket !== this.loadSequence;
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.loadSequence += 1;
      this.feed?.stop();
      this.feed = null;
      clearTimeout(this.detailTimer);
    });
    effect(() => {
      const uuid = this.selected();
      untracked(() => void this.openSession(uuid));
    });
    this.assistantOpen.set(this.ui().assistant === true);
    void this.init();
  }

  // ------------------------------------------------------------------ permissions (UX only)

  can(permission: string): boolean {
    return hasEffectivePermission(this.auth.user()?.permissions ?? [], permission);
  }
  canWrite = () => this.can('tenant.support.remote.sessions.write');
  /** Chat with the AI copilot: the session technician who also holds the assist permission. */
  canAssist = () => this.isTechnician() && this.can('tenant.support.remote.assist');
  private canSupervise = () => this.can('tenant.support.remote.sessions.supervise');
  private isMember(): boolean {
    const me = this.auth.user()?.uuid;
    return this.members().some((m) => text(m['SrmUserUUID']) === me);
  }
  canWatch = () =>
    this.detail()?.myRole === 'supervisor' &&
    this.canSupervise() &&
    !this.closed() &&
    !this.isMember() &&
    text(this.session()?.['SrsTechnicianUUID']) !== this.auth.user()?.uuid;
  canTransfer = () =>
    !this.closed() && (this.isTechnician() || (this.canSupervise() && this.canWrite()));
  canMembers = () => !this.closed() && (this.isTechnician() || this.canSupervise());

  // ------------------------------------------------------------------ tabs and persistence

  private ui(): UiState {
    try {
      const key = this.uiKey();
      if (!key) return { selected: '', devices: {}, extra: [] };
      const raw = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<UiState>;
      return {
        selected: text(raw.selected),
        devices: raw.devices && typeof raw.devices === 'object' ? raw.devices : {},
        extra: Array.isArray(raw.extra) ? raw.extra.map(text) : [],
        assistant: raw.assistant === true,
      };
    } catch {
      return { selected: '', devices: {}, extra: [] };
    }
  }

  private saveUi(patch: Partial<UiState>) {
    try {
      const key = this.uiKey();
      if (!key) return;
      localStorage.setItem(key, JSON.stringify({ ...this.ui(), ...patch }));
    } catch {
      // storage unavailable: the tabs still come from the API
    }
  }

  /** Per user and tenant, so another account never inherits the open terminals. */
  private uiKey(): string {
    const user = this.auth.user()?.uuid;
    if (!user) return '';
    // Same resolution as ApiService.currentEnvironmentUUID: stored selection first.
    const env =
      readStoredEnvironmentUUID() ?? normalizeEnvironmentUUID(this.auth.user()?.EnvironmentUUID);
    return `${UI_KEY}.${user}.${env ?? ''}`;
  }

  private async init() {
    const requested = text(this.route.snapshot.queryParamMap.get('session'));
    await this.loadTabs(requested);
    this.loading.set(false);
  }

  async loadTabs(preferred = '') {
    let items: RemoteRecord[] = [];
    try {
      const response = await this.api.get<unknown>(
        `${REMOTE_BASE}/sessions?scope=mine&state=open&limit=${REMOTE_MAX_TABS}&offset=0`,
        { silent: true },
      );
      items = unwrap<{ items?: RemoteRecord[] }>(response)?.items ?? [];
    } catch {
      if (!this.destroyed) this.tabs.set([]);
      return;
    }
    if (this.destroyed) return;
    const known = new Set(items.map((s) => text(s['SrsUUID'])));
    // Sessions opened from the list (supervision of someone else's session) stay as tabs.
    const wanted = [...new Set([...this.ui().extra, preferred].filter(Boolean))].filter(
      (uuid) => !known.has(uuid),
    );
    const extra: string[] = [];
    for (const uuid of wanted) {
      if (items.length >= REMOTE_MAX_TABS) break;
      try {
        const response = await this.api.get<unknown>(`${REMOTE_BASE}/sessions/${uuid}`, {
          silent: true,
        });
        if (this.destroyed) return;
        const found = unwrap<RemoteSessionDetail>(response)?.session;
        if (found && !isClosed(found)) {
          items.push(found);
          extra.push(uuid);
        }
      } catch {
        // gone or no longer visible: the tab is dropped
      }
    }
    if (this.destroyed) return;
    this.saveUi({ extra });
    this.tabs.set(items);
    const remembered = this.ui().selected;
    const pick = [preferred, this.selected(), remembered]
      .filter(Boolean)
      .find((uuid) => items.some((s) => text(s['SrsUUID']) === uuid));
    const next = pick ?? (items[0] ? text(items[0]['SrsUUID']) : '');
    if (next !== this.selected()) this.selected.set(next);
    else if (!next) this.detail.set(null);
  }

  select(uuid: string) {
    if (uuid === this.selected()) return;
    this.saveUi({ selected: uuid });
    this.selected.set(uuid);
  }

  // ------------------------------------------------------------------ session loading

  private async openSession(uuid: string) {
    const ticket = ++this.loadSequence;
    this.feed?.stop();
    this.feed = null;
    this.events.set([]);
    this.activeDevice.set('');
    if (!uuid) {
      this.detail.set(null);
      return;
    }
    await this.reloadDetail(uuid);
    if (this.stale(ticket)) return;
    let all: RemoteEvent[] = [];
    try {
      for (;;) {
        const response = await this.api.get<unknown>(
          `${REMOTE_BASE}/sessions/${uuid}/events?after=${lastSeq(all)}&limit=${EVENT_PAGE}`,
          { silent: true },
        );
        const page = unwrap<{ items?: RemoteEvent[] }>(response)?.items ?? [];
        all = mergeEvents(all, page);
        if (this.stale(ticket)) return;
        if (page.length < EVENT_PAGE) break;
      }
    } catch {
      // the feed below still delivers what follows
    }
    if (this.stale(ticket)) return;
    this.events.set(all);
    this.startFeed(uuid, lastSeq(all));
    // Reload reattaches the terminal the technician had open; a supervisor never auto-opens one.
    const remembered = this.ui().devices[uuid];
    if (
      remembered &&
      this.detail()?.myRole === 'technician' &&
      !this.closed() &&
      this.devices().some((d) => text(d['NetworkDeviceNwdUUID']) === remembered)
    ) {
      this.activeDevice.set(remembered);
    }
  }

  async reloadDetail(uuid = this.selected()) {
    if (!uuid) return;
    try {
      const response = await this.api.get<unknown>(`${REMOTE_BASE}/sessions/${uuid}`, {
        silent: true,
      });
      const detail = unwrap<RemoteSessionDetail>(response);
      if (this.destroyed || uuid !== this.selected() || !detail?.session) return;
      this.detail.set({
        session: detail.session,
        devices: detail.devices ?? [],
        members: detail.members ?? [],
        myRole: detail.myRole === 'technician' ? 'technician' : 'supervisor',
      });
      this.tabs.update((tabs) =>
        tabs.map((tab) => (text(tab['SrsUUID']) === uuid ? { ...tab, ...detail.session } : tab)),
      );
    } catch {
      // keep the last detail; the next event reloads it
    }
  }

  private startFeed(uuid: string, after: number) {
    if (this.destroyed) return;
    const url = `${REMOTE_BASE}/sessions/${uuid}/events/stream`;
    this.feed = new RemoteEventFeed({
      after,
      openStream: (seq, signal) => this.openStream(url, seq, signal),
      poll: async (seq) => {
        const response = await this.api.get<unknown>(
          `${REMOTE_BASE}/sessions/${uuid}/events?after=${seq}&limit=${EVENT_PAGE}`,
          { silent: true },
        );
        return unwrap<{ items?: RemoteEvent[] }>(response)?.items ?? [];
      },
      onEvents: (incoming) => {
        if (this.destroyed || uuid !== this.selected()) return;
        this.events.update((current) => mergeEvents(current, incoming));
        if (incoming.some((e) => DETAIL_EVENTS.has(e.SreKind))) this.scheduleDetail(uuid);
      },
      onMode: (mode) => {
        if (!this.destroyed) this.feedMode.set(mode);
      },
      onGone: () => this.dropTab(uuid),
    });
    this.feed.start();
  }

  /** SSE by fetch: the session cookie and headers of the HTTP layer, never a token in the URL. */
  private openStream(endpoint: string, after: number, signal: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'X-Mns-Client': `${APP_BUILD_INFO.product}/${APP_BUILD_INFO.version}`,
    };
    const environment =
      readStoredEnvironmentUUID() ?? normalizeEnvironmentUUID(this.auth.user()?.EnvironmentUUID);
    if (environment) headers['X-Environment-UUID'] = environment;
    const bootstrap = this.auth.sessionBootstrapToken();
    if (bootstrap) headers['Authorization'] = `Bearer ${bootstrap}`;
    return fetch(resolveApiUrl(`${endpoint}?after=${after}`), {
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
  }

  private scheduleDetail(uuid: string) {
    clearTimeout(this.detailTimer);
    this.detailTimer = setTimeout(() => {
      if (this.destroyed) return;
      void this.reloadDetail(uuid);
      void this.refreshTabsQuietly();
    }, 300);
  }

  /** The session is gone or hidden from this user (401/403/404): its tab is dropped. */
  private dropTab(uuid: string) {
    if (this.destroyed) return;
    this.tabs.update((tabs) => tabs.filter((tab) => text(tab['SrsUUID']) !== uuid));
    this.saveUi({ extra: this.ui().extra.filter((item) => item !== uuid) });
    if (this.selected() === uuid) {
      const next = this.tabs()[0];
      this.selected.set(next ? text(next['SrsUUID']) : '');
    }
  }

  private async refreshTabsQuietly() {
    const detail = this.detail();
    await this.loadTabs();
    if (this.destroyed) return;
    // A closed or transferred-away session leaves the tabs: the page moves to the next one.
    if (
      detail &&
      !this.tabs().some((s) => text(s['SrsUUID']) === this.selected()) &&
      this.selected()
    ) {
      this.selected.set(this.tabs()[0] ? text(this.tabs()[0]['SrsUUID']) : '');
    }
  }

  toggleAssistant() {
    const open = !this.assistantOpen();
    this.assistantOpen.set(open);
    this.saveUi({ assistant: open });
  }

  refreshAfterOpen() {
    this.scheduleDetail(this.selected());
  }

  // ------------------------------------------------------------------ timeline text

  private memberName(uuid: unknown): string {
    const id = text(uuid);
    if (!id) return '';
    const me = this.auth.user();
    if (me?.uuid === id) return `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() || me.email;
    const session = this.session();
    if (text(session?.['SrsTechnicianUUID']) === id) {
      const known = pick(session, 'TechnicianName', 'SrsTechnicianName');
      if (known) return known;
    }
    const member = this.members().find((m) => text(m['SrmUserUUID']) === id);
    return personName(member) || id.slice(0, 8);
  }

  private toItem(event: RemoteEvent): TimelineItem {
    const data = eventData(event);
    const device = this.devices().find(
      (d) => text(d['NetworkDeviceNwdUUID']) === text(event.NetworkDeviceNwdUUID),
    );
    const params: Record<string, string> = {
      actor: text(event.ActorName).trim() || this.memberName(event.SreActorUUID) || '—',
      device:
        text(event.DeviceName).trim() ||
        (device ? deviceName(device) : text(event.NetworkDeviceNwdUUID).slice(0, 8)),
      from: this.memberName(data['from']),
      to: this.memberName(data['to']),
      title: text(data['title'] ?? event.SreText),
    };
    const known = (REMOTE_EVENT_KINDS as readonly string[]).includes(event.SreKind);
    const kind = known ? event.SreKind : 'unknown';
    if (event.SreKind === 'state') {
      const next = text(data['to'] ?? data['state']);
      params['state'] = next ? this.transloco.translate(`support.remote.state.${next}`) : '';
    }
    return {
      seq: Number(event.SreSeq),
      icon: EVENT_ICONS[event.SreKind] ?? 'info',
      key: `support.remote.event.${kind}`,
      params,
      text: ['note', 'summary', 'transferred', 'closed'].includes(event.SreKind)
        ? text(event.SreText)
        : '',
      date: text(event.SreDateCreated),
    };
  }

  // ------------------------------------------------------------------ actions

  async createSession() {
    const result = await this.ask<NewSessionResult>(SupportRemoteNewDialogComponent, undefined);
    if (!result) return;
    const response = await this.api.post<unknown>(`${REMOTE_BASE}/sessions`, {
      title: result.title,
      level: result.level,
      customerUUID: result.customerUUID,
      ticketUUID: result.ticketUUID,
      deviceUUIDs: result.deviceUUIDs,
    });
    const created = unwrap<RemoteRecord & { session?: RemoteRecord }>(response);
    const uuid = text(created?.session?.['SrsUUID'] ?? created?.['SrsUUID']);
    this.snack.success('support.remote.created');
    await this.loadTabs(uuid);
    if (uuid) this.select(uuid);
  }

  async sendNote() {
    const body = this.note().trim();
    if (!body || this.closed()) return;
    await this.api.post(`${REMOTE_BASE}/sessions/${this.selected()}/notes`, { text: body });
    this.note.set('');
  }

  openDevice(uuid: string) {
    if (this.closed()) return;
    this.saveUi({ devices: { ...this.ui().devices, [this.selected()]: uuid } });
    this.activeDevice.set(uuid);
  }

  async addDevice() {
    const result = await this.prompt({
      title: 'support.remote.action.addDevice',
      confirm: 'support.remote.action.add',
      lookup: {
        label: 'support.remote.field.device',
        spec: REMOTE_LOOKUPS.device,
        exclude: this.devices().map((d) => text(d['NetworkDeviceNwdUUID'])),
      },
    });
    if (!result) return;
    await this.api.post(`${REMOTE_BASE}/sessions/${this.selected()}/devices`, {
      deviceUUID: result.uuid,
    });
    await this.reloadDetail();
  }

  async removeDevice(device: RemoteRecord, event: Event) {
    event.stopPropagation();
    const uuid = text(device['NetworkDeviceNwdUUID']);
    await this.api.delete(`${REMOTE_BASE}/sessions/${this.selected()}/devices/${uuid}`);
    if (this.activeDevice() === uuid) this.activeDevice.set('');
    await this.reloadDetail();
  }

  async addSupervisor() {
    const result = await this.prompt({
      title: 'support.remote.action.addSupervisor',
      description: 'support.remote.action.addSupervisorHelp',
      confirm: 'support.remote.action.add',
      lookup: {
        label: 'support.remote.field.user',
        spec: REMOTE_LOOKUPS.user,
        exclude: this.members().map((m) => text(m['SrmUserUUID'])),
      },
    });
    if (!result) return;
    await this.api.post(`${REMOTE_BASE}/sessions/${this.selected()}/members`, {
      userUUID: result.uuid,
    });
    await this.reloadDetail();
  }

  async watch() {
    await this.api.post(`${REMOTE_BASE}/sessions/${this.selected()}/watch`, {});
    await this.reloadDetail();
  }

  async transfer() {
    const result = await this.prompt({
      title: 'support.remote.action.transfer',
      description: 'support.remote.action.transferHelp',
      confirm: 'support.remote.action.transferConfirm',
      lookup: {
        label: 'support.remote.field.technician',
        spec: REMOTE_LOOKUPS.user,
        exclude: [text(this.session()?.['SrsTechnicianUUID'])],
      },
      text: { label: 'support.remote.field.transferNote', required: false, max: 4000 },
    });
    const session = this.session();
    if (!result || !session) return;
    await this.api.post(`${REMOTE_BASE}/sessions/${this.selected()}/transfer`, {
      revision: Number(session['SrsRevision']),
      technicianUUID: result.uuid,
      ...(result.text ? { note: result.text } : {}),
    });
    this.snack.success('support.remote.transferred');
    await this.refreshTabsQuietly();
  }

  async toggleWaiting() {
    const session = this.session();
    if (!session) return;
    await this.api.put(`${REMOTE_BASE}/sessions/${this.selected()}`, {
      revision: Number(session['SrsRevision']),
      state: session['SrsState'] === 'waiting_customer' ? 'open' : 'waiting_customer',
    });
    await this.reloadDetail();
  }

  async closeSession() {
    const session = this.session();
    if (!session) return;
    const result = await this.prompt({
      title: 'support.remote.action.close',
      description: 'support.remote.action.closeHelp',
      confirm: 'support.remote.action.closeConfirm',
      text: { label: 'support.remote.field.summary', required: true, max: 4000 },
      // Draft from the AI copilot; the technician reviews it before closing.
      aiSummary: this.canAssist() ? () => this.assist.summary(this.selected()) : undefined,
    });
    if (!result) return;
    await this.api.post(`${REMOTE_BASE}/sessions/${this.selected()}/close`, {
      revision: Number(session['SrsRevision']),
      summary: result.text,
    });
    this.snack.success('support.remote.closed');
    this.activeDevice.set('');
    await this.reloadDetail();
    await this.refreshTabsQuietly();
  }

  private prompt(data: PromptData): Promise<PromptResult | undefined> {
    return this.ask<PromptResult>(SupportRemotePromptDialogComponent, data);
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
