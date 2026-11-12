import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import {
  TerminalComponent,
  TerminalNotice,
  terminalNoticeMessage,
} from '../../../shared/terminal/terminal';
import { TERMINAL_PING_SECONDS, TerminalSize } from '../../../shared/terminal/terminal-protocol';
import {
  DeviceConsoleConfirmDialogComponent,
  DeviceConsoleConfirmData,
} from './device-console-confirm-dialog';
import {
  commandClassLabel,
  DeviceConsoleAnswer,
  DeviceConsoleHostKey,
  DeviceConsoleSession,
  DeviceConsoleState,
  DeviceConsoleVerdict,
  deviceConsoleCloseMessage,
} from './device-console-session';
import { accessGatewayErrorMessage } from './device-connections';

export type DeviceConsoleData = {
  /** `network` or `system/network`, from the route scope of the page. */
  base: string;
  deviceUUID: string;
  deviceName: string;
};

type ConsoleOpenResponse = {
  data?: {
    connectionUUID?: string;
    relayUrl?: string | null;
    ticket?: string | null;
    expiresAt?: string | null;
  };
};

type Banner = { tone: 'info' | 'success' | 'warning' | 'error'; message: string; params?: object };

/** Relay WebSocket URL with the single-use ticket (the contract appends `?ticket=`). */
export function deviceConsoleSocketUrl(relayUrl: string, ticket: string): string {
  return `${relayUrl}${relayUrl.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`;
}

/**
 * Console of a Network device through an access gateway: the shared terminal, the gateway state,
 * the host key result, and the confirmation of every write command the gateway holds.
 */
@Component({
  selector: 'mns-network-device-console',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule,
    ReportProblemButtonComponent,
    TerminalComponent,
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
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-weight: 600;
      }
      .state {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }
      .banner {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.875rem;
        background: var(--mat-sys-surface-container-highest, #333);
        overflow-wrap: anywhere;
      }
      .banner.error {
        color: var(--mat-sys-on-error-container, #410e0b);
        background: var(--mat-sys-error-container, #f9dedc);
      }
      .banner.warning {
        background: var(--mat-sys-tertiary-container, #ffd8e4);
        color: var(--mat-sys-on-tertiary-container, #31111d);
      }
      .banner code {
        font-family: monospace;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `,
  ],
  template: `
    <div class="header">
      <div>
        <div class="title">{{ 'network.console.title' | transloco }} · {{ data.deviceName }}</div>
        <div class="state">{{ stateLabel() | transloco }}</div>
      </div>
      <div class="header-actions">
        <button
          mat-icon-button
          type="button"
          (click)="terminal()?.pasteFromClipboard()"
          [matTooltip]="'Paste (Ctrl+Shift+V)' | transloco"
          [attr.aria-label]="'Paste (Ctrl+Shift+V)' | transloco"
        >
          <mat-icon>content_paste</mat-icon>
        </button>
        <mns-report-problem-button />
      </div>
    </div>
    @if (hostKey(); as key) {
      <div
        class="banner"
        [class.success]="key.tone === 'success'"
        [class.error]="key.tone === 'error'"
      >
        <mat-icon>{{ key.tone === 'error' ? 'gpp_bad' : 'verified_user' }}</mat-icon>
        <span>
          {{ key.message | transloco }}
          @if (key.fingerprint) {
            <br /><code>{{ key.fingerprint }}</code>
          }
        </span>
      </div>
    }
    @for (banner of banners(); track $index) {
      <div
        class="banner"
        [class.error]="banner.tone === 'error'"
        [class.warning]="banner.tone === 'warning'"
      >
        <mat-icon>{{
          banner.tone === 'error' ? 'error' : banner.tone === 'warning' ? 'warning' : 'info'
        }}</mat-icon>
        <span>{{ banner.message | transloco: banner.params }}</span>
      </div>
    }
    <mns-terminal
      (ready)="terminalReady($event)"
      (terminalInput)="session?.input($event)"
      (resized)="session?.resize($event)"
      (notice)="terminalNotice($event)"
    />
    <div class="actions">
      <button mat-stroked-button type="button" (click)="reconnect()">
        <mat-icon>refresh</mat-icon>
        {{ 'Reconnect' | transloco }}
      </button>
      <button mat-flat-button type="button" (click)="close()">{{ 'Close' | transloco }}</button>
    </div>
  `,
})
export class NetworkDeviceConsoleComponent {
  readonly data = inject<DeviceConsoleData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef);
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  readonly terminal = viewChild(TerminalComponent);

  readonly state = signal<DeviceConsoleState | 'requesting' | 'disconnected'>('requesting');
  readonly hostKey = signal<{
    tone: 'success' | 'error';
    message: string;
    fingerprint: string;
  } | null>(null);
  readonly banners = signal<Banner[]>([]);
  session: DeviceConsoleSession | null = null;
  private socket: WebSocket | null = null;
  private connectionUUID: string | null = null;
  private terminalOpen = false;
  private ping: ReturnType<typeof setInterval> | undefined;
  private readonly openDialogs = new Set<MatDialogRef<unknown>>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  stateLabel(): string {
    return `network.console.state.${this.state()}`;
  }

  terminalReady(_size: TerminalSize) {
    this.terminalOpen = true;
    void this.connect();
  }

  terminalNotice(notice: TerminalNotice) {
    this.addBanner({
      tone: 'warning',
      message:
        notice.code === 'paste_too_large'
          ? 'network.console.pasteTooLarge'
          : terminalNoticeMessage(notice),
      params: notice.code === 'paste_too_large' ? { limit: Math.round(notice.limit / 1024) } : {},
    });
  }

  async reconnect() {
    this.teardown();
    this.banners.set([]);
    this.hostKey.set(null);
    this.terminal()?.reset();
    await this.connect();
  }

  close() {
    this.ref.close();
  }

  private addBanner(banner: Banner) {
    // The latest messages only: the terminal keeps the space.
    this.banners.update((current) => [...current, banner].slice(-3));
  }

  private async connect() {
    if (!this.terminalOpen) return;
    this.state.set('requesting');
    let opened: ConsoleOpenResponse['data'];
    try {
      const response = await this.api.post<ConsoleOpenResponse>(
        `${this.data.base}/devices/${this.data.deviceUUID}/console`,
        {},
      );
      opened = response?.data;
    } catch (error) {
      this.state.set('failed');
      this.addBanner({ tone: 'error', message: accessGatewayErrorMessage(error) });
      return;
    }
    if (!opened?.relayUrl || !opened.ticket || !opened.connectionUUID) {
      this.state.set('failed');
      this.addBanner({ tone: 'error', message: 'network.console.openFailed' });
      return;
    }
    this.connectionUUID = opened.connectionUUID;
    this.state.set('connecting');
    const socket = new WebSocket(deviceConsoleSocketUrl(opened.relayUrl, opened.ticket));
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    const session = new DeviceConsoleSession((frame) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(frame);
    }, this.view());
    this.session = session;
    socket.onmessage = (event) => session.receive(event.data as string | ArrayBuffer);
    socket.onclose = (event) => {
      session.end();
      this.closeQuestions();
      if (this.socket !== socket) return;
      clearInterval(this.ping);
      this.socket = null;
      this.state.set('disconnected');
      this.addBanner({
        tone: event.code === 1000 ? 'info' : 'error',
        message: deviceConsoleCloseMessage(event.code),
      });
    };
    this.ping = setInterval(() => session.ping(), TERMINAL_PING_SECONDS * 1000);
  }

  private view() {
    return {
      ready: () => {
        this.state.set('ready');
        const size = this.terminal()?.size();
        if (size) this.session?.resize(size);
        this.terminal()?.focus();
      },
      output: (data: string) => this.terminal()?.write(data),
      state: (state: DeviceConsoleState) => this.state.set(state),
      hostKey: (key: DeviceConsoleHostKey) => this.showHostKey(key),
      blocked: (blocked: { line: string; commandClass: string; hint: string }) =>
        this.addBanner({
          tone: 'error',
          message: blocked.hint ? 'network.console.blockedWithHint' : 'network.console.blocked',
          params: { line: blocked.line, hint: blocked.hint },
        }),
      resolved: (_id: string, decision: 'confirmed' | 'denied' | 'expired') => {
        if (decision === 'expired') {
          this.addBanner({ tone: 'warning', message: 'network.console.verdictExpired' });
        }
      },
      notice: (code: string, message: string) =>
        this.addBanner({
          tone: 'warning',
          message: code === 'output_throttled' ? 'network.console.outputThrottled' : message,
        }),
      confirm: (verdict: DeviceConsoleVerdict, dismissed: AbortSignal) =>
        this.askVerdict(verdict, dismissed),
    };
  }

  private showHostKey(key: DeviceConsoleHostKey) {
    const fingerprint = [key.algorithm, key.fingerprint].filter(Boolean).join(' ');
    const messages: Record<DeviceConsoleHostKey['result'], string> = {
      match: 'network.console.hostKeyMatch',
      pinned: 'network.console.hostKeyPinned',
      mismatch: 'network.console.hostKeyMismatch',
      rejected: 'network.console.hostKeyRejected',
    };
    this.hostKey.set({
      tone: key.result === 'match' || key.result === 'pinned' ? 'success' : 'error',
      message: messages[key.result],
      fingerprint,
    });
  }

  private async askVerdict(
    verdict: DeviceConsoleVerdict,
    dismissed: AbortSignal,
  ): Promise<DeviceConsoleAnswer> {
    const ref = this.dialog.open<
      DeviceConsoleConfirmDialogComponent,
      DeviceConsoleConfirmData,
      boolean
    >(DeviceConsoleConfirmDialogComponent, {
      data: { verdict, deviceName: this.data.deviceName },
      width: '560px',
      maxWidth: 'calc(100vw - 24px)',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
    });
    this.openDialogs.add(ref);
    const onDismiss = () => ref.close();
    dismissed.addEventListener('abort', onDismiss, { once: true });
    const answer = await firstValueFrom(ref.afterClosed());
    dismissed.removeEventListener('abort', onDismiss);
    this.openDialogs.delete(ref);
    this.terminal()?.focus();
    if (dismissed.aborted) return null;
    if (answer === false) {
      this.addBanner({
        tone: 'info',
        message: 'network.console.denied',
        params: { class: commandClassLabel(verdict.commandClass) },
      });
    }
    return typeof answer === 'boolean' ? answer : null;
  }

  private closeQuestions() {
    for (const ref of this.openDialogs) ref.close();
    this.openDialogs.clear();
  }

  /** Ends the socket and the connection record (the gateway stops it on its next poll). */
  private teardown() {
    clearInterval(this.ping);
    this.session?.end();
    this.session = null;
    this.closeQuestions();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000);
    const connection = this.connectionUUID;
    this.connectionUUID = null;
    if (connection) {
      void this.api.delete(`${this.data.base}/connections/${connection}`).catch(() => undefined);
    }
  }
}

/** Opens the console dialog; Escape belongs to the terminal (vim, menus), never closes it. */
export async function openNetworkDeviceConsole(dialog: MatDialog, data: DeviceConsoleData) {
  const binding = openCrudComponentDialog(
    dialog,
    NetworkDeviceConsoleComponent,
    'crud-form-dialog',
    {
      data,
      onEscape: () => undefined,
    },
  );
  try {
    await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}
