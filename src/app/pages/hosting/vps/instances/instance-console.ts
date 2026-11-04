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
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { resolveApiBaseUrl } from '../../../../shared/runtime/app-runtime-config';
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';

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
};

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

/** Seconds to wait for the console handshake before showing an error. */
export const VPS_CONSOLE_HANDSHAKE_SECONDS = 15;

/** Proxmox termproxy input frame ("0:<bytes>:<data>"). */
export function termproxyInput(data: string): string {
  return `0:${new TextEncoder().encode(data).length}:${data}`;
}

/** Proxmox termproxy resize frame. */
export function termproxyResize(cols: number, rows: number): string {
  return `1:${cols}:${rows}:`;
}

@Component({
  selector: 'mns-vps-instance-console',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslocoPipe],
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
      </div>
      <div class="header-actions">
        @if (type() === 'vnc') {
          <button mat-stroked-button type="button" (click)="sendCtrlAltDel()">
            <mat-icon>keyboard</mat-icon>
            Ctrl+Alt+Del
          </button>
        }
        @if (dialogRef) {
          <button mat-stroked-button type="button" (click)="openInNewWindow()">
            <mat-icon>open_in_new</mat-icon>
            {{ 'Open in new window' | transloco }}
          </button>
        }
      </div>
    </div>
    <div class="screen" #screen></div>
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
  private readonly screen = viewChild.required<ElementRef<HTMLDivElement>>('screen');
  readonly status = signal('Connecting...');
  readonly failed = signal(false);
  readonly type = signal<'serial' | 'vnc' | null>(null);
  private teardown: (() => void) | null = null;

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
    this.screen().nativeElement.replaceChildren();
    await this.connect();
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
    } catch {
      this.fail('The console could not be opened.');
      return;
    }
    if (!session?.token) {
      this.fail('The console could not be opened.');
      return;
    }
    this.type.set(session.type);
    const url = vpsConsoleSocketUrl(resolveApiBaseUrl(), session);
    if (session.type === 'vnc') await this.connectVnc(url, session.vncPassword ?? '');
    else await this.connectSerial(url);
  }

  private async connectSerial(url: string) {
    const { Terminal } = await import('@xterm/xterm');
    const host = this.screen().nativeElement;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      convertEol: false,
      theme: { background: '#000000' },
    });
    terminal.open(host);
    const fit = () => {
      const cell = 9;
      const line = 17;
      const cols = Math.max(40, Math.floor(host.clientWidth / cell));
      const rows = Math.max(10, Math.floor(host.clientHeight / line));
      terminal.resize(cols, rows);
    };
    fit();
    const socket = new WebSocket(url, ['binary']);
    socket.binaryType = 'arraybuffer';
    let ready = false;
    const decoder = new TextDecoder();
    const ping = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send('2');
    }, 30_000);
    // Without the handshake the terminal would wait forever and swallow every key.
    const handshake = setTimeout(() => {
      if (ready) return;
      this.fail('The console did not answer. Try Reconnect.');
      socket.close();
    }, VPS_CONSOLE_HANDSHAKE_SECONDS * 1000);
    socket.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : decoder.decode(event.data);
      if (!ready) {
        if (text.startsWith('OK')) {
          ready = true;
          clearTimeout(handshake);
          this.status.set('Connected');
          socket.send(termproxyResize(terminal.cols, terminal.rows));
          terminal.focus();
          const rest = text.slice(2);
          if (rest) terminal.write(rest);
          return;
        }
        clearTimeout(handshake);
        this.fail('The console could not be opened.');
        socket.close();
        return;
      }
      terminal.write(text);
    };
    socket.onclose = () => {
      clearTimeout(handshake);
      if (ready) this.status.set('Disconnected');
      else if (!this.failed()) this.fail('The console connection was closed. Try Reconnect.');
    };
    const input = terminal.onData((data) => {
      if (ready && socket.readyState === WebSocket.OPEN) socket.send(termproxyInput(data));
    });
    const resize = terminal.onResize(({ cols, rows }) => {
      if (ready && socket.readyState === WebSocket.OPEN) {
        socket.send(termproxyResize(cols, rows));
      }
    });
    const observer = new ResizeObserver(() => fit());
    observer.observe(host);
    this.teardown = () => {
      clearInterval(ping);
      clearTimeout(handshake);
      observer.disconnect();
      input.dispose();
      resize.dispose();
      socket.close();
      terminal.dispose();
    };
  }

  private async connectVnc(url: string, password: string) {
    const { default: RFB } = await import('@novnc/novnc/core/rfb.js');
    const host = this.screen().nativeElement;
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
