import {
  encodeTerminalDecision,
  encodeTerminalInput,
  encodeTerminalResize,
  GatewayFrameReader,
  TERMINAL_PING,
  TerminalSize,
} from '../../../shared/terminal/terminal-protocol';

/**
 * Browser side of a Network device console (mnscloud-access-gateway `docs/runtime-api.md` →
 * WebSocket). The gateway classifies every command line on Enter; a write waits for the user's
 * answer to its `verdict` (`4:{"type":"confirm"|"deny",...}`), a destructive one asks twice (step
 * 1 and step 2). The App never decides the class: it shows what the gateway reconstructed.
 */

/** Gateway states of the `state` control message. */
export type DeviceConsoleState =
  'connecting' | 'hostkey_check' | 'authenticating' | 'ready' | 'closed' | 'failed';

export type DeviceConsoleVerdict = {
  id: string;
  line: string;
  commandClass: string;
  unknown: boolean;
  requires: 'confirm' | 'double_confirm';
  step: number;
  expiresInSeconds: number;
};

export type DeviceConsoleBlocked = {
  id: string;
  line: string;
  commandClass: string;
  unknown: boolean;
  hint: string;
};

export type DeviceConsoleHostKey = {
  kind: 'ssh' | 'tls';
  result: 'match' | 'pinned' | 'mismatch' | 'rejected';
  algorithm: string;
  fingerprint: string;
};

export type DeviceConsoleDecision = 'confirmed' | 'denied' | 'expired';

/** User answer of a verdict: true runs, false refuses, null when the session dismissed it. */
export type DeviceConsoleAnswer = boolean | null;

export interface DeviceConsoleView {
  ready(): void;
  output(data: string): void;
  state(state: DeviceConsoleState, reason: string | null): void;
  hostKey(hostKey: DeviceConsoleHostKey): void;
  blocked(blocked: DeviceConsoleBlocked): void;
  resolved(id: string, decision: DeviceConsoleDecision): void;
  notice(code: string, message: string): void;
  /** Asks the user about a command; `dismissed` aborts when the gateway resolved or expired it. */
  confirm(verdict: DeviceConsoleVerdict, dismissed: AbortSignal): Promise<DeviceConsoleAnswer>;
}

/** Largest verdict wait the App honors, whatever the gateway asks (seconds). */
const MAX_VERDICT_SECONDS = 600;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseVerdict(message: Record<string, unknown>): DeviceConsoleVerdict | null {
  const id = text(message['id']);
  if (!id) return null;
  const step = Number(message['step']);
  const seconds = Number(message['expiresInSeconds']);
  return {
    id,
    line: text(message['line']),
    commandClass: text(message['class']) || 'unknown',
    unknown: message['unknown'] === true,
    requires: message['requires'] === 'double_confirm' ? 'double_confirm' : 'confirm',
    step: Number.isInteger(step) && step > 0 ? step : 1,
    expiresInSeconds:
      Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, MAX_VERDICT_SECONDS) : 120,
  };
}

const STATES: readonly DeviceConsoleState[] = [
  'connecting',
  'hostkey_check',
  'authenticating',
  'ready',
  'closed',
  'failed',
];

export class DeviceConsoleSession {
  private readonly reader = new GatewayFrameReader();
  private readonly pending = new Map<string, { abort: AbortController; timer: unknown }>();
  private opened = false;
  private ended = false;

  private readonly send: (frame: string) => void;
  private readonly view: DeviceConsoleView;

  constructor(send: (frame: string) => void, view: DeviceConsoleView) {
    this.send = send;
    this.view = view;
  }

  get isOpen(): boolean {
    return this.opened && !this.ended;
  }

  /** One WebSocket message from the gateway. */
  receive(message: string | ArrayBuffer | ArrayBufferView) {
    for (const frame of this.reader.push(message)) {
      if (frame.kind === 'ready') {
        this.opened = true;
        this.view.ready();
      } else if (frame.kind === 'output') this.view.output(frame.data);
      else if (frame.kind === 'control') this.control(frame.message);
      // Invalid frames are dropped: unframed text never reaches the screen.
    }
  }

  /** Keystrokes and pastes: the same input frame the gateway classifies. */
  input(data: string) {
    if (this.isOpen && data) this.send(encodeTerminalInput(data));
  }

  resize(size: TerminalSize) {
    if (this.isOpen) this.send(encodeTerminalResize(size));
  }

  ping() {
    if (!this.ended) this.send(TERMINAL_PING);
  }

  /** The socket closed: open questions are dismissed. */
  end() {
    this.ended = true;
    for (const id of [...this.pending.keys()]) this.dismiss(id);
  }

  private control(message: Record<string, unknown>) {
    switch (message['type']) {
      case 'state': {
        const state = text(message['state']) as DeviceConsoleState;
        if (STATES.includes(state)) this.view.state(state, text(message['reason']) || null);
        return;
      }
      case 'hostkey': {
        const result = text(message['result']);
        if (!['match', 'pinned', 'mismatch', 'rejected'].includes(result)) return;
        this.view.hostKey({
          kind: message['kind'] === 'tls' ? 'tls' : 'ssh',
          result: result as DeviceConsoleHostKey['result'],
          algorithm: text(message['algorithm']),
          fingerprint: text(message['fingerprint']),
        });
        return;
      }
      case 'verdict': {
        const verdict = parseVerdict(message);
        if (verdict) void this.ask(verdict);
        return;
      }
      case 'blocked':
        this.view.blocked({
          id: text(message['id']),
          line: text(message['line']),
          commandClass: text(message['class']) || 'unknown',
          unknown: message['unknown'] === true,
          hint: text(message['hint']),
        });
        return;
      case 'resolved': {
        const id = text(message['id']);
        const decision = text(message['decision']);
        this.dismiss(id);
        if (decision === 'confirmed' || decision === 'denied' || decision === 'expired') {
          this.view.resolved(id, decision);
        }
        return;
      }
      case 'notice':
        this.view.notice(text(message['code']), text(message['message']));
        return;
    }
  }

  private async ask(verdict: DeviceConsoleVerdict) {
    // Step 2 of a double confirmation replaces the step 1 question of the same command.
    this.dismiss(verdict.id);
    if (this.ended) return;
    const abort = new AbortController();
    const timer = setTimeout(() => this.dismiss(verdict.id), verdict.expiresInSeconds * 1000);
    this.pending.set(verdict.id, { abort, timer });
    let answer: DeviceConsoleAnswer;
    try {
      answer = await this.view.confirm(verdict, abort.signal);
    } catch {
      answer = null;
    }
    if (abort.signal.aborted || this.pending.get(verdict.id)?.abort !== abort) return;
    clearTimeout(timer as ReturnType<typeof setTimeout>);
    this.pending.delete(verdict.id);
    if (answer === null || this.ended) return;
    this.send(
      encodeTerminalDecision(
        answer
          ? { type: 'confirm', id: verdict.id, step: verdict.step }
          : { type: 'deny', id: verdict.id },
      ),
    );
  }

  private dismiss(id: string) {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer as ReturnType<typeof setTimeout>);
    this.pending.delete(id);
    entry.abort.abort();
  }
}

/** Translation key of a WebSocket close code of the gateway. */
export function deviceConsoleCloseMessage(code: number): string {
  switch (code) {
    case 1000:
      return 'network.console.closed';
    case 4401:
      return 'network.console.close4401';
    case 4403:
      return 'network.console.close4403';
    case 4408:
      return 'network.console.close4408';
    case 4409:
      return 'network.console.close4409';
    case 4413:
      return 'network.console.close4413';
    default:
      return 'network.console.close4500';
  }
}

/** Translation key of a command class reported by the gateway. */
export function commandClassLabel(commandClass: string): string {
  const known = [
    'read',
    'write_low',
    'write_reversible',
    'write_risky',
    'destructive',
    'secret_read',
    'pivot',
    'unknown',
  ];
  return `network.console.class.${known.includes(commandClass) ? commandClass : 'unknown'}`;
}
