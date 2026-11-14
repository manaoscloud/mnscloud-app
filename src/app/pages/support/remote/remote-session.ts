/**
 * Support remote sessions (Suporte › Remoto): REST contract of `/support/remote/*` (mnscloud-api),
 * the event timeline feed (SSE through fetch with the session headers, polling as fallback) and the
 * small pure helpers the console and the sessions list share. Records keep the database column names.
 */

export const REMOTE_BASE = 'support/remote';
export const REMOTE_MAX_TABS = 8;

export type RemoteRecord = Record<string, unknown>;

export type RemoteSessionState =
  'open' | 'idle' | 'waiting_approval' | 'running' | 'waiting_customer' | 'closed';

export const REMOTE_STATES: readonly RemoteSessionState[] = [
  'open',
  'idle',
  'waiting_approval',
  'running',
  'waiting_customer',
  'closed',
];
export const REMOTE_LEVELS = ['n1', 'n2', 'n3'] as const;

export const REMOTE_EVENT_KINDS = [
  'created',
  'note',
  'device_added',
  'device_removed',
  'connection_opened',
  'connection_resumed',
  'connection_closed',
  'observer_joined',
  'transferred',
  'member_added',
  'member_removed',
  'state',
  'summary',
  'closed',
  'ai_request',
  'ai_reply',
  'ai_exec',
  'ai_error',
  'proposal_created',
  'proposal_approved',
  'proposal_rejected',
  'proposal_expired',
  'change_applied',
  'change_failed',
  'change_rolled_back',
  'change_blocked',
] as const;

export type RemoteEvent = {
  SreUUID?: string;
  SreSeq: number;
  SreKind: string;
  SreActorUUID?: string | null;
  NetworkDeviceNwdUUID?: string | null;
  AccessGatewayConnectionAgcUUID?: string | null;
  SreText?: string | null;
  /** JSON object from the API (a JSON string is accepted too). */
  SreData?: Record<string, unknown> | string | null;
  ActorName?: string | null;
  DeviceName?: string | null;
  SreDateCreated?: string | null;
  [key: string]: unknown;
};

export type RemoteSessionDetail = {
  session: RemoteRecord;
  devices: RemoteRecord[];
  members: RemoteRecord[];
  myRole: 'technician' | 'supervisor';
};

export type RemoteTerminalOpened = {
  connectionUUID?: string;
  relayUrl?: string | null;
  ticket?: string | null;
  expiresAt?: string | null;
  role?: 'operator' | 'observer' | string;
  resumed?: boolean;
};

/** The API wraps payloads in `{ data }`; accept the bare payload too. */
export function unwrap<T>(response: unknown): T {
  const body = response as { data?: unknown } | null | undefined;
  return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/** First non-empty text among the candidate fields (the API names display fields per record). */
export function pick(row: RemoteRecord | null | undefined, ...keys: string[]): string {
  for (const key of keys) {
    const value = text(row?.[key]).trim();
    if (value) return value;
  }
  return '';
}

export function deviceName(row: RemoteRecord): string {
  return (
    pick(row, 'NwdName', 'NetworkDeviceName', 'DeviceName', 'Name') ||
    text(row['NetworkDeviceNwdUUID']).slice(0, 8)
  );
}

export function personName(row: RemoteRecord | null | undefined): string {
  return pick(row, 'TechnicianName', 'UserName', 'MemberName', 'Name', 'UsrName');
}

export function isClosed(session: RemoteRecord | null | undefined): boolean {
  return text(session?.['SrsState']) === 'closed';
}

export function stateChipClass(state: unknown): string {
  switch (text(state)) {
    case 'running':
      return 'chip-success';
    case 'open':
      return 'chip-success';
    case 'waiting_approval':
    case 'waiting_customer':
      return 'chip-warning';
    case 'closed':
      return 'chip-skipped';
    default:
      return 'chip-skipped';
  }
}

export function eventData(event: RemoteEvent): Record<string, unknown> {
  const raw = event.SreData;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Merges events by sequence, ascending, without duplicates. */
export function mergeEvents(current: readonly RemoteEvent[], incoming: readonly RemoteEvent[]) {
  const bySeq = new Map<number, RemoteEvent>();
  for (const event of current) bySeq.set(Number(event.SreSeq), event);
  for (const event of incoming) {
    if (Number.isFinite(Number(event.SreSeq))) bySeq.set(Number(event.SreSeq), event);
  }
  return [...bySeq.values()].sort((a, b) => Number(a.SreSeq) - Number(b.SreSeq));
}

export function lastSeq(events: readonly RemoteEvent[]): number {
  return events.reduce((max, event) => Math.max(max, Number(event.SreSeq) || 0), 0);
}

export type SseMessage = { id: string; event: string; data: string };

/** Incremental parser of a `text/event-stream` body (comments and heartbeats are dropped). */
export class SseParser {
  private buffer = '';

  push(chunk: string): SseMessage[] {
    this.buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const messages: SseMessage[] = [];
    let index = this.buffer.indexOf('\n\n');
    while (index >= 0) {
      const block = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const message = { id: '', event: 'message', data: '' };
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (!line || line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'id') message.id = value;
        else if (field === 'event') message.event = value;
        else if (field === 'data') data.push(value);
      }
      if (data.length) {
        message.data = data.join('\n');
        messages.push(message);
      }
      index = this.buffer.indexOf('\n\n');
    }
    return messages;
  }
}

export type EventFeedOptions = {
  /** Sequence already shown; only newer events are delivered. */
  after: number;
  /** Opens the SSE response for the sequence (headers and credentials belong to the caller). */
  openStream: (after: number, signal: AbortSignal) => Promise<Response>;
  /** Polling read: `events?after=` of the session. */
  poll: (after: number) => Promise<readonly RemoteEvent[]>;
  onEvents: (events: RemoteEvent[]) => void;
  /** Reports the transport in use for the status line of the timeline. */
  onMode?: (mode: 'live' | 'polling') => void;
  /** The session is gone or no longer visible (401/403/404): the feed stops. */
  onGone?: () => void;
  /** No chunk within this time aborts the stream and reconnects (ms, default 45 s). */
  watchdogMs?: number;
  /** Delays (ms), replaceable in tests. */
  pollMs?: number;
  retryMs?: number;
  streamRetryAfterPollsMs?: number;
};

/**
 * Timeline feed: SSE by fetch streaming (the stream ends by itself after about a minute, so it is
 * reopened at once with the last sequence, like Last-Event-ID), and `events?after=` polling while
 * the stream is unavailable. Delivers each sequence once, ascending.
 */
const GONE_STATUSES = [401, 403, 404];

function isGone(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === 'number' && GONE_STATUSES.includes(status);
}

export class RemoteEventFeed {
  private after: number;
  private stopped = true;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly options: EventFeedOptions;

  constructor(options: EventFeedOptions) {
    this.options = options;
    this.after = options.after;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.run();
  }

  stop() {
    this.stopped = true;
    this.abort?.abort();
    this.abort = null;
    clearTimeout(this.timer);
  }

  private gone() {
    this.stop();
    this.options.onGone?.();
  }

  private deliver(events: RemoteEvent[]) {
    const fresh = events
      .filter((event) => Number(event.SreSeq) > this.after)
      .sort((a, b) => Number(a.SreSeq) - Number(b.SreSeq));
    if (!fresh.length) return;
    this.after = Number(fresh[fresh.length - 1].SreSeq);
    this.options.onEvents(fresh);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }

  private async run() {
    const retryMs = this.options.retryMs ?? 2000;
    const pollMs = this.options.pollMs ?? 4000;
    const pollingWindowMs = this.options.streamRetryAfterPollsMs ?? 30000;
    let failures = 0;
    while (!this.stopped) {
      try {
        const started = Date.now();
        await this.stream();
        // A stream that ends at once is not the scheduled end: treat it as a failure (no busy loop).
        if (Date.now() - started < 1500) throw new Error('stream ended early');
        failures = 0;
        continue; // the server ended the stream on schedule: reconnect at once
      } catch (error) {
        if (this.stopped) return;
        if (isGone(error)) return this.gone();
        failures += 1;
      }
      if (failures < 2) {
        await this.sleep(retryMs * failures);
        continue;
      }
      // The stream keeps failing (proxy, buffering, old API): poll for a while, then try it again.
      this.options.onMode?.('polling');
      const until = Date.now() + pollingWindowMs;
      while (!this.stopped && Date.now() < until) {
        try {
          this.deliver([...(await this.options.poll(this.after))]);
        } catch (error) {
          if (isGone(error)) return this.gone();
          // keep polling; the page shows nothing new until the API answers again
        }
        await this.sleep(pollMs);
      }
      failures = 1;
    }
  }

  private async stream() {
    const abort = new AbortController();
    this.abort = abort;
    const response = await this.options.openStream(this.after, abort.signal);
    if (!response.ok || !response.body) {
      throw Object.assign(new Error(`stream ${response.status}`), { status: response.status });
    }
    this.options.onMode?.('live');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    // Heartbeats arrive every 15 s: silence means a dead connection (proxy, sleep, network).
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => abort.abort(), this.options.watchdogMs ?? 45000);
    };
    arm();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        arm();
        if (done) return;
        for (const message of parser.push(decoder.decode(value, { stream: true }))) {
          if (message.event !== 'session-event') continue;
          try {
            const event = JSON.parse(message.data) as RemoteEvent;
            if (message.id && event.SreSeq == null) event.SreSeq = Number(message.id);
            this.deliver([event]);
          } catch {
            // a malformed event is skipped; the next reconnect resumes after the last good one
          }
        }
      }
    } finally {
      clearTimeout(watchdog);
      reader.releaseLock();
    }
  }
}
