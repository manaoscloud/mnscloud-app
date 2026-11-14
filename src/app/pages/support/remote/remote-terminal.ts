import { Component, DestroyRef, inject, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { TerminalComponent, TerminalNotice } from '../../../shared/terminal/terminal';
import { TerminalSize } from '../../../shared/terminal/terminal-protocol';
import { DeviceConsoleChannel } from '../../network/devices/device-console-channel';
import { REMOTE_BASE, RemoteTerminalOpened, unwrap } from './remote-session';

/** Pauses (ms) before each automatic reattach after the network dropped the socket. */
export const REATTACH_DELAYS_MS: readonly number[] = [1500, 4000, 10000];

/**
 * One device terminal of a support session. Opening always goes through
 * `POST support/remote/sessions/:uuid/devices/:deviceUUID/terminal`: the API either resumes the live
 * connection (operator ticket), starts a new one, or, for a supervisor, attaches read-only. The
 * connection outlives this component (closing the browser detaches); only a session close ends it.
 */
@Component({
  selector: 'mns-support-remote-terminal',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TerminalComponent, TranslocoPipe],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        flex: 1 1 auto;
      }
      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
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
      .banner.warning,
      .banner.observer {
        background: var(--mat-sys-tertiary-container, #ffd8e4);
        color: var(--mat-sys-on-tertiary-container, #31111d);
      }
      .banner code {
        font-family: monospace;
      }
    `,
  ],
  template: `
    <div class="bar">
      <span class="state">{{ channel.stateLabel() | transloco }}</span>
      <span>
        <button
          mat-icon-button
          type="button"
          [disabled]="channel.readOnly()"
          (click)="terminal()?.pasteFromClipboard()"
          [matTooltip]="'Paste (Ctrl+Shift+V)' | transloco"
          [attr.aria-label]="'Paste (Ctrl+Shift+V)' | transloco"
        >
          <mat-icon>content_paste</mat-icon>
        </button>
        <button mat-stroked-button type="button" (click)="reattach()">
          <mat-icon>refresh</mat-icon>
          {{ 'support.remote.reattach' | transloco }}
        </button>
      </span>
    </div>
    @if (channel.readOnly()) {
      <div class="banner observer" role="status">
        <mat-icon>visibility</mat-icon>
        <span>{{ 'support.remote.observerBanner' | transloco }}</span>
      </div>
    }
    @if (channel.hostKey(); as key) {
      <div class="banner" [class.error]="key.tone === 'error'">
        <mat-icon>{{ key.tone === 'error' ? 'gpp_bad' : 'verified_user' }}</mat-icon>
        <span>
          {{ key.message | transloco }}
          @if (key.fingerprint) {
            <br /><code>{{ key.fingerprint }}</code>
          }
        </span>
      </div>
    }
    @for (banner of channel.banners(); track $index) {
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
      (terminalInput)="channel.input($event)"
      (resized)="channel.resize($event)"
      (notice)="terminalNotice($event)"
    />
  `,
})
export class SupportRemoteTerminalComponent {
  readonly sessionUUID = input.required<string>();
  readonly deviceUUID = input.required<string>();
  readonly deviceName = input('');
  /** Emits when the API opened or resumed a connection (the timeline refreshes by itself). */
  readonly opened = output<RemoteTerminalOpened>();

  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  readonly terminal = viewChild(TerminalComponent);
  private attempts = 0;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  readonly channel: DeviceConsoleChannel = new DeviceConsoleChannel({
    dialog: this.dialog,
    terminal: () => this.terminal(),
    deviceName: () => this.deviceName(),
    open: async () => {
      const size = this.terminal()?.size() ?? { cols: 120, rows: 32 };
      const response = await this.api.post<unknown>(
        `${REMOTE_BASE}/sessions/${this.sessionUUID()}/devices/${this.deviceUUID()}/terminal`,
        { cols: size.cols, rows: size.rows },
      );
      const opened = unwrap<RemoteTerminalOpened>(response);
      if (!this.destroyed) this.opened.emit(opened);
      return opened;
    },
    // Closing the page never ends the connection: the gateway keeps it for the next attach.
    onClosed: (code) => this.scheduleReattach(code),
    // A successful attach restores the full set of automatic retries for the next drop.
    onReady: () => {
      this.attempts = 0;
    },
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.retry);
      this.channel.teardown();
    });
  }

  terminalReady(_size: TerminalSize) {
    this.attempts = 0;
    this.channel.terminalReady();
  }

  terminalNotice(notice: TerminalNotice) {
    this.channel.terminalNotice(notice);
  }

  async reattach() {
    clearTimeout(this.retry);
    this.attempts = 0;
    await this.channel.reconnect();
  }

  /** A dropped network (1006) reattaches by itself a few times; other closes wait for the user. */
  private scheduleReattach(code: number) {
    if (this.destroyed || code !== 1006) return;
    const delay = REATTACH_DELAYS_MS[this.attempts];
    if (delay === undefined) return;
    this.attempts += 1;
    this.retry = setTimeout(() => void this.channel.reconnect(), delay);
  }
}
