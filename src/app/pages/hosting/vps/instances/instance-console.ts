import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { resolveApiBaseUrl } from '../../../../shared/runtime/app-runtime-config';

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

type NoVncRfb = InstanceType<typeof import('@novnc/novnc').default>;

/** WebSocket URL of a console session on the same API origin as the App. */
export function vpsConsoleSocketUrl(apiBase: string, session: ConsoleSession): string {
  const base = apiBase.replace(/^http/i, 'ws').replace(/\/+$/, '');
  return `${base}${session.path}?token=${encodeURIComponent(session.token)}`;
}

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
        min-width: min(960px, 92vw);
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .title {
        font-weight: 600;
      }
      .status {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }
      .screen {
        background: #000;
        border-radius: 8px;
        height: min(600px, 70vh);
        overflow: hidden;
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
        <div class="title">{{ 'VPS console' | transloco }} · {{ data.name }}</div>
        <div class="status">{{ status() | transloco }}</div>
      </div>
      @if (type() === 'vnc') {
        <button mat-stroked-button type="button" (click)="sendCtrlAltDel()">
          <mat-icon>keyboard</mat-icon>
          Ctrl+Alt+Del
        </button>
      }
    </div>
    <div class="screen" #screen></div>
    <div class="actions">
      <button mat-stroked-button type="button" (click)="reconnect()">
        <mat-icon>refresh</mat-icon>
        {{ 'Reconnect' | transloco }}
      </button>
      <button mat-flat-button type="button" mat-dialog-close>{{ 'Close' | transloco }}</button>
    </div>
  `,
})
export class VpsInstanceConsoleComponent {
  readonly data = inject<VpsInstanceConsoleData>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly screen = viewChild.required<ElementRef<HTMLDivElement>>('screen');
  readonly status = signal('Connecting...');
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

  private rfb: NoVncRfb | null = null;

  sendCtrlAltDel() {
    this.rfb?.sendCtrlAltDel?.();
  }

  private async connect() {
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
      this.status.set('The console could not be opened.');
      return;
    }
    if (!session?.token) {
      this.status.set('The console could not be opened.');
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
    socket.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : decoder.decode(event.data);
      if (!ready) {
        if (text.startsWith('OK')) {
          ready = true;
          this.status.set('Connected');
          socket.send(termproxyResize(terminal.cols, terminal.rows));
          terminal.focus();
          const rest = text.slice(2);
          if (rest) terminal.write(rest);
          return;
        }
        this.status.set('The console could not be opened.');
        socket.close();
        return;
      }
      terminal.write(text);
    };
    socket.onclose = () => this.status.set(ready ? 'Disconnected' : this.status());
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
      observer.disconnect();
      input.dispose();
      resize.dispose();
      socket.close();
      terminal.dispose();
    };
  }

  private async connectVnc(url: string, password: string) {
    const { default: RFB } = await import('@novnc/novnc');
    const host = this.screen().nativeElement;
    const rfb = new RFB(host, url, { credentials: { password }, wsProtocols: ['binary'] });
    rfb.scaleViewport = true;
    rfb.resizeSession = false;
    rfb.addEventListener('connect', () => {
      this.status.set('Connected');
      rfb.focus();
    });
    rfb.addEventListener('disconnect', () => this.status.set('Disconnected'));
    rfb.addEventListener('securityfailure', () =>
      this.status.set('The console could not be opened.'),
    );
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
  const ref = dialog.open(VpsInstanceConsoleComponent, {
    data,
    maxWidth: '96vw',
    autoFocus: false,
    panelClass: 'crud-form-dialog',
  });
  await firstValueFrom(ref.afterClosed());
}
