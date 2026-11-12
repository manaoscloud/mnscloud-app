/**
 * Terminal framing shared by the VPS console (Proxmox termproxy and the API SSH console) and the
 * Network device console (mnscloud-access-gateway `docs/runtime-api.md` → WebSocket):
 *
 * - browser → server: `0:<len>:<data>` input (`len` = UTF-8 bytes of `data`), `1:<cols>:<rows>:`
 *   resize, `2` ping; the device console adds `4:<json>` (confirm/deny of a command verdict);
 * - server → browser: `OK` once the shell is open; the VPS console then streams raw output (text
 *   or binary), the device console frames every output as `0:<len>:<data>` and its control
 *   messages as `3:<json>`, so device text is never read as control.
 *
 * Output can split a multibyte UTF-8 character across WebSocket messages: binary chunks go through
 * one streaming `TextDecoder` per connection, which keeps the incomplete bytes for the next chunk.
 */

export type TerminalSize = { cols: number; rows: number };

/** Ping frame (keeps idle proxies from closing the socket). */
export const TERMINAL_PING = '2';

/** Seconds between pings. */
export const TERMINAL_PING_SECONDS = 30;

/** Largest paste sent to a terminal (UTF-8 bytes); a larger paste is refused, never truncated. */
export const TERMINAL_PASTE_LIMIT_BYTES = 64 * 1024;

const encoder = new TextEncoder();

/** UTF-8 byte length of a string (the `<len>` of an input or output frame). */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/** Input frame: keystrokes or pasted text. */
export function encodeTerminalInput(data: string): string {
  return `0:${encoder.encode(data).length}:${data}`;
}

/** Resize frame with the real grid of the terminal. */
export function encodeTerminalResize(size: TerminalSize): string {
  const cols = Math.max(1, Math.floor(size.cols));
  const rows = Math.max(1, Math.floor(size.rows));
  return `1:${cols}:${rows}:`;
}

/** Device console answer to a command verdict (`4:<json>`). */
export type TerminalDecision =
  { type: 'confirm'; id: string; step: number } | { type: 'deny'; id: string };

export function encodeTerminalDecision(decision: TerminalDecision): string {
  const body =
    decision.type === 'confirm'
      ? { type: 'confirm', id: decision.id, step: decision.step }
      : { type: 'deny', id: decision.id };
  return `4:${JSON.stringify(body)}`;
}

/**
 * Raw output of the VPS console: text messages pass as they are and binary chunks are decoded as
 * one UTF-8 stream, so a character split between two messages is written whole.
 */
export class TerminalOutputDecoder {
  private readonly decoder = new TextDecoder('utf-8');

  decode(chunk: string | ArrayBuffer | ArrayBufferView): string {
    if (typeof chunk === 'string') return chunk;
    return this.decoder.decode(chunk, { stream: true });
  }

  /** Bytes still held at the end of the stream (an incomplete character becomes U+FFFD). */
  flush(): string {
    return this.decoder.decode();
  }
}

export type GatewayFrame =
  | { kind: 'ready' }
  | { kind: 'output'; data: string }
  | { kind: 'control'; message: Record<string, unknown> }
  | { kind: 'invalid'; raw: string };

/** Index after `bytes` UTF-8 bytes of `text` from `start`, or -1 when the text is shorter. */
function indexAfterUtf8Bytes(text: string, start: number, bytes: number): number {
  let remaining = bytes;
  let index = start;
  while (remaining > 0) {
    if (index >= text.length) return -1;
    const code = text.charCodeAt(index);
    let size: number;
    let width = 1;
    if (code < 0x80) size = 1;
    else if (code < 0x800) size = 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        size = 4;
        width = 2;
      } else size = 3;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // A high surrogate at the very end: its pair is still to come.
      return -1;
    } else size = 3;
    if (size > remaining) {
      // The sender counted UTF-16 units ("tolerated" by the contract): take the character whole.
      remaining = 0;
    } else remaining -= size;
    index += width;
  }
  return index;
}

/**
 * Frames of the device console (`OK`, `0:<len>:<data>`, `3:<json>`). Binary messages are decoded
 * as one UTF-8 stream; an output frame whose data has not fully arrived waits for the next message,
 * and one message may carry several output frames. Nothing outside a frame reaches the terminal.
 */
export class GatewayFrameReader {
  private readonly decoder = new TextDecoder('utf-8');
  private buffer = '';

  push(message: string | ArrayBuffer | ArrayBufferView): GatewayFrame[] {
    this.buffer +=
      typeof message === 'string' ? message : this.decoder.decode(message, { stream: true });
    const frames: GatewayFrame[] = [];
    while (this.buffer.length) {
      if (this.buffer.startsWith('OK')) {
        frames.push({ kind: 'ready' });
        this.buffer = this.buffer.slice(2);
        continue;
      }
      if (this.buffer.startsWith('3:')) {
        // A control message is a whole WebSocket message.
        const raw = this.buffer.slice(2);
        this.buffer = '';
        frames.push(parseControl(raw));
        continue;
      }
      if (this.buffer.startsWith('0:')) {
        const separator = this.buffer.indexOf(':', 2);
        if (separator < 0) {
          if (/^0:\d{0,12}$/.test(this.buffer)) break; // the length is still arriving
          frames.push({ kind: 'invalid', raw: this.buffer });
          this.buffer = '';
          break;
        }
        const lengthText = this.buffer.slice(2, separator);
        if (!/^\d{1,12}$/.test(lengthText)) {
          frames.push({ kind: 'invalid', raw: this.buffer });
          this.buffer = '';
          break;
        }
        const end = indexAfterUtf8Bytes(this.buffer, separator + 1, Number(lengthText));
        if (end < 0) break; // wait for the rest of the data
        frames.push({ kind: 'output', data: this.buffer.slice(separator + 1, end) });
        this.buffer = this.buffer.slice(end);
        continue;
      }
      if (this.buffer === 'O' || this.buffer === '0' || this.buffer === '3') break;
      frames.push({ kind: 'invalid', raw: this.buffer });
      this.buffer = '';
    }
    return frames;
  }
}

function parseControl(raw: string): GatewayFrame {
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { kind: 'control', message: value as Record<string, unknown> };
    }
  } catch {
    /* not JSON */
  }
  return { kind: 'invalid', raw };
}

/** Bracketed paste delimiters: a pasted copy of them could end the paste early on the remote. */
// eslint-disable-next-line no-control-regex
const PASTE_BRACKETS = /\x1b\[20[01]~/g;
/** C0 controls other than Tab, LF and CR, plus DEL: never sent from a paste. */
// eslint-disable-next-line no-control-regex
const PASTE_CONTROLS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

export type PreparedPaste = { ok: true; text: string } | { ok: false; bytes: number };

/**
 * Clipboard text ready for `Terminal.paste` (which turns line breaks into CR and adds the bracketed
 * paste delimiters when the remote enabled them): control characters removed, refused above the
 * limit so a huge clipboard never floods the device.
 */
export function preparePaste(text: string, limitBytes = TERMINAL_PASTE_LIMIT_BYTES): PreparedPaste {
  const clean = text.replace(PASTE_BRACKETS, '').replace(PASTE_CONTROLS, '');
  const bytes = utf8ByteLength(clean);
  if (bytes > limitBytes) return { ok: false, bytes };
  return { ok: true, text: clean };
}

type ShortcutEvent = Pick<
  KeyboardEvent,
  'type' | 'key' | 'code' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
>;

function isKey(event: ShortcutEvent, letter: string): boolean {
  return event.key?.toLowerCase() === letter || event.code === `Key${letter.toUpperCase()}`;
}

/**
 * Paste shortcuts the terminal leaves to the browser paste event: Ctrl+Shift+V, Shift+Insert and
 * Cmd+V. Plain Ctrl+V stays a control key for the remote (literal next in shells).
 */
export function isPasteShortcut(event: ShortcutEvent): boolean {
  if (event.type !== 'keydown' || event.altKey) return false;
  if (event.ctrlKey && event.shiftKey && !event.metaKey && isKey(event, 'v')) return true;
  if (event.metaKey && !event.ctrlKey && !event.shiftKey && isKey(event, 'v')) return true;
  return event.shiftKey && !event.ctrlKey && !event.metaKey && event.key === 'Insert';
}

/** Copy shortcuts of the selection: Ctrl+Shift+C and Cmd+C (Ctrl+C stays an interrupt). */
export function isCopyShortcut(event: ShortcutEvent): boolean {
  if (event.type !== 'keydown' || event.altKey) return false;
  if (event.ctrlKey && event.shiftKey && !event.metaKey && isKey(event, 'c')) return true;
  return event.metaKey && !event.ctrlKey && !event.shiftKey && isKey(event, 'c');
}
