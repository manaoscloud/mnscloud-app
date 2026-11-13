import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
  TerminalComponent,
  TerminalNotice,
  terminalNoticeMessage,
} from '../../../shared/terminal/terminal';
import { TERMINAL_PING_SECONDS } from '../../../shared/terminal/terminal-protocol';
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

export type ConsoleBanner = {
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
  params?: object;
};

/** What the API returns to open (or reattach) a console socket. */
export type ConsoleOpened = {
  connectionUUID?: string | null;
  relayUrl?: string | null;
  ticket?: string | null;
  /** `observer` makes the channel read-only: no input, no resize, no confirmation. */
  role?: string | null;
};

/** Relay WebSocket URL with the single-use ticket (the contract appends `?ticket=`). */
export function deviceConsoleSocketUrl(relayUrl: string, ticket: string): string {
  return `${relayUrl}${relayUrl.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`;
}

export type ConsoleChannelOptions = {
  dialog: MatDialog;
  terminal: () => TerminalComponent | undefined;
  deviceName: () => string;
  /** Asks the API for a socket; a throw becomes an error banner. */
  open: () => Promise<ConsoleOpened | null | undefined>;
  /** Called with the connection when the channel is torn down (the network console ends it). */
  onTeardown?: (connectionUUID: string) => void;
  /** Called when the socket closed by itself (not by `disconnect`). */
  onClosed?: (code: number) => void;
  /** Called when the gateway handshake completed (the socket is usable). */
  onReady?: () => void;
};

/**
 * Browser side of one console socket, shared by the Network device console and the support remote
 * console: gateway state, host key, banners, the command confirmation dialog, ping and teardown.
 * An observer role never writes: input, resize and confirmations are dropped on this side too
 * (the gateway ignores them as well).
 */
export class DeviceConsoleChannel {
  readonly state = signal<DeviceConsoleState | 'requesting' | 'disconnected'>('requesting');
  readonly hostKey = signal<{
    tone: 'success' | 'error';
    message: string;
    fingerprint: string;
  } | null>(null);
  readonly banners = signal<ConsoleBanner[]>([]);
  readonly readOnly = signal(false);
  session: DeviceConsoleSession | null = null;

  private socket: WebSocket | null = null;
  private connectionUUID: string | null = null;
  private terminalOpen = false;
  /** Bumped by every teardown: an open() answered after it belongs to a dead attempt. */
  private generation = 0;
  private ping: ReturnType<typeof setInterval> | undefined;
  private readonly openDialogs = new Set<{ close(): void }>();

  private readonly options: ConsoleChannelOptions;

  constructor(options: ConsoleChannelOptions) {
    this.options = options;
  }

  stateLabel(): string {
    return `network.console.state.${this.state()}`;
  }

  /** The terminal is open: the first connection starts. */
  terminalReady() {
    this.terminalOpen = true;
    void this.connect();
  }

  input(data: string) {
    if (!this.readOnly()) this.session?.input(data);
  }

  resize(size: { cols: number; rows: number }) {
    if (!this.readOnly()) this.session?.resize(size);
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
    this.options.terminal()?.reset();
    await this.connect();
  }

  addBanner(banner: ConsoleBanner) {
    // The latest messages only: the terminal keeps the space.
    this.banners.update((current) => [...current, banner].slice(-3));
  }

  /** Ends the socket (and, for the network console, the connection record). */
  teardown() {
    this.generation += 1;
    clearInterval(this.ping);
    this.session?.end();
    this.session = null;
    this.closeQuestions();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000);
    const connection = this.connectionUUID;
    this.connectionUUID = null;
    if (connection) this.options.onTeardown?.(connection);
  }

  async connect() {
    if (!this.terminalOpen) return;
    const generation = this.generation;
    this.state.set('requesting');
    // The gateway repaints with a replay of the last output on attach: start from a clean screen.
    this.options.terminal()?.reset();
    let opened: ConsoleOpened | null | undefined;
    try {
      opened = await this.options.open();
    } catch (error) {
      if (generation !== this.generation) return;
      this.state.set('failed');
      this.addBanner({ tone: 'error', message: accessGatewayErrorMessage(error) });
      return;
    }
    if (generation !== this.generation) {
      // Torn down while the API answered: never open the socket; release what the API created.
      if (opened?.connectionUUID) this.options.onTeardown?.(opened.connectionUUID);
      return;
    }
    if (!opened?.relayUrl || !opened.ticket || !opened.connectionUUID) {
      this.state.set('failed');
      this.addBanner({ tone: 'error', message: 'network.console.openFailed' });
      return;
    }
    this.readOnly.set(opened.role === 'observer');
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
        message:
          event.code === 4410 ? 'support.remote.replaced' : deviceConsoleCloseMessage(event.code),
      });
      this.options.onClosed?.(event.code);
    };
    this.ping = setInterval(() => session.ping(), TERMINAL_PING_SECONDS * 1000);
  }

  private view() {
    return {
      ready: () => {
        this.state.set('ready');
        this.options.onReady?.();
        const size = this.options.terminal()?.size();
        if (size) this.resize(size);
        if (!this.readOnly()) this.options.terminal()?.focus();
      },
      output: (data: string) => this.options.terminal()?.write(data),
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
        this.readOnly() ? Promise.resolve(null) : this.askVerdict(verdict, dismissed),
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
    const ref = this.options.dialog.open<
      DeviceConsoleConfirmDialogComponent,
      DeviceConsoleConfirmData,
      boolean
    >(DeviceConsoleConfirmDialogComponent, {
      data: { verdict, deviceName: this.options.deviceName() },
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
    this.options.terminal()?.focus();
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
}
