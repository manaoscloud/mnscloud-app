import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { resolveApiBaseUrl } from '../../../../shared/runtime/app-runtime-config';
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';
import { TerminalComponent, terminalNoticeMessage } from '../../../../shared/terminal/terminal';
import {
  encodeTerminalInput,
  encodeTerminalResize,
  TERMINAL_PING,
  TERMINAL_PING_SECONDS,
  TerminalOutputDecoder,
  TerminalSize,
} from '../../../../shared/terminal/terminal-protocol';

export type VpsInstanceConsoleData = {
  uuid: string;
  name?: string;
  scope?: 'tenant' | 'master';
};

type ConsoleSession = {
  type: 'serial' | 'vnc';
  token: string;
  path: string;
  vncPassword?: string;
  /** RouterOS servers: a generated console password exists (reveal endpoint). */
  consolePasswordAvailable?: boolean;
};

type ConsolePasswordEnvelope = { data?: { username?: string; password?: string } };

type ConsoleEnvelope = { data?: ConsoleSession };

type NoVncRfb = InstanceType<typeof import('@novnc/novnc/core/rfb.js').default>;

/** WebSocket URL of a console session on the same API origin as the App. */
export function vpsConsoleSocketUrl(apiBase: string, session: ConsoleSession): string {
  const base = apiBase.replace(/^http/i, 'ws').replace(/\/+$/, '');
  return `${base}${session.path}?token=${encodeURIComponent(session.token)}`;
}

/** App path of the standalone console page (opened in its own browser window). */
export function vpsConsoleWindowPath(data: VpsInstanceConsoleData): string {
  const query = new URLSearchParams();
  if (data.name) query.set('name', data.name);
  if (data.scope === 'master') query.set('scope', 'master');
  const suffix = query.toString();
  return `/console/vps/${encodeURIComponent(data.uuid)}${suffix ? `?${suffix}` : ''}`;
}

/** Error text of a failed console request, when the API returned one. */
export function consoleErrorMessage(error: unknown): string | null {
  const body = (error as { error?: { error?: unknown; message?: unknown } } | null)?.error;
  const text = body?.error ?? body?.message;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
}

/** Proxmox banner of a serial session; it is not output of the VM. */
export function isSerialBanner(text: string): boolean {
  return /^\s*starting serial terminal on interface \S+\s*$/i.test(text);
}

/** Milliseconds of VM silence after connecting before Enter asks the getty to show the login. */
export const SERIAL_WAKE_DELAY_MS = 700;

/** Seconds to wait for the console handshake before showing an error. */
export const VPS_CONSOLE_HANDSHAKE_SECONDS = 15;

/** Proxmox termproxy input frame ("0:<bytes>:<data>"). */
export function termproxyInput(data: string): string {
  return encodeTerminalInput(data);
}

/** Proxmox termproxy resize frame. */
export function termproxyResize(cols: number, rows: number): string {
  return encodeTerminalResize({ cols, rows });
}

@Component({
  selector: 'mns-vps-instance-console',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
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
      :host(.page) {
        height: 100dvh;
        background: var(--mat-sys-color-surface, #111);
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
        gap: 8px;
        flex-wrap: wrap;
      }
      .title {
        font-weight: 600;
      }
      .password {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        font-family: var(--mat-sys-typescale-body-medium-font, monospace);
        font-size: 0.875rem;
      }
      .password code {
        user-select: all;
      }
      .status {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }
      .status.error {
        color: var(--mat-sys-error, #ff6b6b);
      }
      .screen {
        background: #000;
        border-radius: 8px;
        flex: 1 1 auto;
        min-height: 320px;
        overflow: hidden;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `,
  ],
  host: { '[class.page]': '!dialogRef' },
  template: `
    <div class="header">
      <div>
        <div class="title">{{ 'VPS console' | transloco }} · {{ data.name }}</div>
        <div class="status" [class.error]="failed()">{{ status() | transloco }}</div>
        @if (notice(); as message) {
          <div class="status">{{ message | transloco }}</div>
        }
      </div>
      <div class="header-actions">
        @if (passwordAvailable()) {
          @if (credential(); as shown) {
            <span class="password">
              {{ 'User' | transloco }}: <code>{{ shown.username }}</code> ·
              {{ 'Password' | transloco }}: <code>{{ shown.password }}</code>
              <button
                mat-icon-button
                type="button"
                (click)="copyPassword()"
                [matTooltip]="'Copy password' | transloco"
                [attr.aria-label]="'Copy password' | transloco"
              >
                <mat-icon>content_copy</mat-icon>
              </button>
              @if (type() === 'serial') {
                <button
                  mat-icon-button
                  type="button"
                  (click)="typePassword()"
                  [matTooltip]="'Type password in the console' | transloco"
                  [attr.aria-label]="'Type password in the console' | transloco"
                >
                  <mat-icon>keyboard</mat-icon>
                </button>
              }
            </span>
          } @else {
            <button mat-stroked-button type="button" (click)="revealPassword()">
              <mat-icon>key</mat-icon>
              {{ 'Console password' | transloco }}
            </button>
          }
        }
        @if (type() === 'serial') {
          <button
            mat-icon-button
            type="button"
            (click)="terminal()?.pasteFromClipboard()"
            [matTooltip]="'Paste (Ctrl+Shift+V)' | transloco"
            [attr.aria-label]="'Paste (Ctrl+Shift+V)' | transloco"
          >
            <mat-icon>content_paste</mat-icon>
          </button>
        }
        @if (type() === 'vnc') {
          <button mat-stroked-button type="button" (click)="sendCtrlAltDel()">
            <mat-icon>keyboard</mat-icon>
            Ctrl+Alt+Del
          </button>
        }
        @if (dialogRef) {
          <button
            mat-icon-button
            type="button"
            (click)="openInNewWindow()"
            [matTooltip]="'Open in new window' | transloco"
            [attr.aria-label]="'Open in new window' | transloco"
          >
            <mat-icon>open_in_new</mat-icon>
          </button>
        }
      </div>
    </div>
    @if (type() === 'serial') {
      <mns-terminal
        (ready)="terminalReady($event)"
        (terminalInput)="sendInput($event)"
        (resized)="sendResize($event)"
        (notice)="notice.set(terminalNoticeMessage($event))"
      />
    } @else {
      <div class="screen" #screen></div>
    }
    <div class="actions">
      <button mat-stroked-button type="button" (click)="reconnect()">
        <mat-icon>refresh</mat-icon>
        {{ 'Reconnect' | transloco }}
      </button>
      @if (dialogRef) {
        <button mat-flat-button type="button" mat-dialog-close>{{ 'Close' | transloco }}</button>
      }
    </div>
  `,
})
export class VpsInstanceConsoleComponent {
  readonly dialogRef = inject(MatDialogRef, { optional: true });
  readonly data: VpsInstanceConsoleData =
    inject<VpsInstanceConsoleData | null>(MAT_DIALOG_DATA, { optional: true }) ??
    consoleDataFromRoute(inject(ActivatedRoute, { optional: true }));
  private readonly api = inject(ApiService);
  private readonly screen = viewChild<ElementRef<HTMLDivElement>>('screen');
  readonly terminal = viewChild(TerminalComponent);
  readonly notice = signal<string | null>(null);
  readonly terminalNoticeMessage = terminalNoticeMessage;
  readonly status = signal('Connecting...');
  readonly failed = signal(false);
  readonly type = signal<'serial' | 'vnc' | null>(null);
  readonly passwordAvailable = signal(false);
  readonly credential = signal<{ username: string; password: string } | null>(null);
  private teardown: (() => void) | null = null;
  private typeInput: ((data: string) => void) | null = null;
  /** Serial session waiting for the terminal to open. */
  private serialUrl: string | null = null;
  private terminalOpen = false;
  private socket: WebSocket | null = null;
  private socketReady = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
    queueMicrotask(() => void this.connect());
  }

  private close() {
    this.teardown?.();
    this.teardown = null;
  }

  async reconnect() {
    this.close();
    this.screen()?.nativeElement.replaceChildren();
    this.terminal()?.reset();
    await this.connect();
  }

  /** The shared terminal opened: start the pending serial session. */
  terminalReady(_size: TerminalSize) {
    this.terminalOpen = true;
    if (this.serialUrl) this.connectSerial(this.serialUrl);
  }

  sendInput(data: string) {
    if (this.socketReady && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(encodeTerminalInput(data));
    }
  }

  /** Every fitted size reaches the remote PTY (full-screen apps and progress bars redraw right). */
  sendResize(size: TerminalSize) {
    if (this.socketReady && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(encodeTerminalResize(size));
    }
  }

  /** The console in its own browser window, so the customer keeps working in the App. */
  openInNewWindow() {
    const opened = window.open(
      vpsConsoleWindowPath(this.data),
      `mns-vps-console-${this.data.uuid}`,
      'popup,width=1100,height=760',
    );
    if (opened) this.dialogRef?.close();
  }

  private fail(message: string) {
    this.failed.set(true);
    this.status.set(message);
  }

  private rfb: NoVncRfb | null = null;

  sendCtrlAltDel() {
    this.rfb?.sendCtrlAltDel?.();
  }

  /** Generated console password of a RouterOS VPS (never kept after the console closes). */
  async revealPassword() {
    const prefix = this.data.scope === 'master' ? 'system/' : '';
    try {
      const envelope = await this.api.post<ConsolePasswordEnvelope>(
        `${prefix}hosting/vps/instances/${this.data.uuid}/console-password/reveal`,
        {},
      );
      const password = envelope.data?.password;
      if (password) {
        this.credential.set({ username: envelope.data?.username ?? 'mnsadmin', password });
      }
    } catch (error) {
      this.fail(consoleErrorMessage(error) ?? 'The console password could not be read.');
    }
  }

  async copyPassword() {
    const password = this.credential()?.password;
    if (password) await navigator.clipboard?.writeText(password);
  }

  /** Types the password and Enter at the serial console (for the Password: prompt). */
  typePassword() {
    const password = this.credential()?.password;
    if (password) this.typeInput?.(`${password}\r`);
  }

  private async connect() {
    this.failed.set(false);
    this.status.set('Connecting...');
    const prefix = this.data.scope === 'master' ? 'system/' : '';
    let session: ConsoleSession | undefined;
    try {
      const envelope = await this.api.post<ConsoleEnvelope>(
        `${prefix}hosting/vps/instances/${this.data.uuid}/console`,
        {},
      );
      session = envelope.data;
    } catch (error) {
      // The API explains why (server created before the console, no public IPv4, stopped VPS).
      this.fail(consoleErrorMessage(error) ?? 'The console could not be opened.');
      return;
    }
    if (!session?.token) {
      this.fail('The console could not be opened.');
      return;
    }
    this.type.set(session.type);
    this.passwordAvailable.set(session.consolePasswordAvailable === true);
    const url = vpsConsoleSocketUrl(resolveApiBaseUrl(), session);
    if (session.type === 'vnc') {
      await this.connectVnc(url, session.vncPassword ?? '');
      return;
    }
    this.serialUrl = url;
    if (this.terminalOpen) this.connectSerial(url);
  }

  private connectSerial(url: string) {
    this.serialUrl = null;
    this.notice.set(null);
    const socket = new WebSocket(url, ['binary']);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    this.socketReady = false;
    let guestSpoke = false;
    let wake: ReturnType<typeof setTimeout> | undefined;
    // One UTF-8 stream per connection: a character split between two frames is written whole.
    const output = new TerminalOutputDecoder();
    const write = (text: string) => this.terminal()?.write(text);
    const ping = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(TERMINAL_PING);
    }, TERMINAL_PING_SECONDS * 1000);
    // Without the handshake the terminal would wait forever and swallow every key.
    const handshake = setTimeout(() => {
      if (this.socketReady) return;
      this.fail('The console did not answer. Try Reconnect.');
      socket.close();
    }, VPS_CONSOLE_HANDSHAKE_SECONDS * 1000);
    socket.onmessage = (event) => {
      const text = output.decode(event.data as string | ArrayBuffer);
      if (!this.socketReady) {
        if (text.startsWith('OK')) {
          this.socketReady = true;
          clearTimeout(handshake);
          this.status.set('Connected');
          // The real grid of the screen, not a default 80x24.
          const size = this.terminal()?.size();
          if (size) socket.send(encodeTerminalResize(size));
          this.terminal()?.focus();
          const rest = text.slice(2);
          if (rest) {
            write(rest);
            if (!isSerialBanner(rest)) guestSpoke = true;
          }
          // The login prompt was printed at boot and a serial port does not replay it: when the
          // VM stays silent, one Enter makes the getty show the login (an SSH shell already did).
          wake = setTimeout(() => {
            if (!guestSpoke && socket.readyState === WebSocket.OPEN) {
              socket.send(encodeTerminalInput('\r'));
            }
          }, SERIAL_WAKE_DELAY_MS);
          return;
        }
        clearTimeout(handshake);
        this.fail('The console could not be opened.');
        socket.close();
        return;
      }
      if (!isSerialBanner(text)) guestSpoke = true;
      write(text);
    };
    socket.onclose = () => {
      clearTimeout(handshake);
      if (this.socket !== socket) return;
      write(output.flush());
      if (this.socketReady) this.status.set('Disconnected');
      else if (!this.failed()) this.fail('The console connection was closed. Try Reconnect.');
    };
    this.typeInput = (data) => {
      this.sendInput(data);
      this.terminal()?.focus();
    };
    this.teardown = () => {
      this.typeInput = null;
      clearInterval(ping);
      clearTimeout(handshake);
      clearTimeout(wake);
      if (this.socket === socket) {
        this.socket = null;
        this.socketReady = false;
      }
      socket.close();
    };
  }

  private async connectVnc(url: string, password: string) {
    const { default: RFB } = await import('@novnc/novnc/core/rfb.js');
    const host = this.screen()?.nativeElement;
    if (!host) return;
    const rfb = new RFB(host, url, { credentials: { password }, wsProtocols: ['binary'] });
    rfb.scaleViewport = true;
    rfb.resizeSession = false;
    rfb.addEventListener('connect', () => {
      this.status.set('Connected');
      rfb.focus();
    });
    rfb.addEventListener('disconnect', () => this.status.set('Disconnected'));
    rfb.addEventListener('securityfailure', () => this.fail('The console could not be opened.'));
    this.rfb = rfb;
    this.teardown = () => {
      try {
        rfb.disconnect();
      } catch {
        /* already closed */
      }
      this.rfb = null;
    };
  }
}

export async function openVpsInstanceConsole(dialog: MatDialog, data: VpsInstanceConsoleData) {
  // Same geometry as the CRUD form dialog (fills the page content area).
  // Escape belongs to the terminal (vim, menus): it never closes the console.
  const binding = openCrudComponentDialog(dialog, VpsInstanceConsoleComponent, 'crud-form-dialog', {
    data,
    onEscape: () => undefined,
  });
  try {
    await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}

function consoleDataFromRoute(route: ActivatedRoute | null): VpsInstanceConsoleData {
  const snapshot = route?.snapshot;
  return {
    uuid: snapshot?.paramMap.get('uuid') ?? '',
    name: snapshot?.queryParamMap.get('name') ?? undefined,
    scope: snapshot?.queryParamMap.get('scope') === 'master' ? 'master' : 'tenant',
  };
}
