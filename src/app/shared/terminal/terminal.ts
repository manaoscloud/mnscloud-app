import { Component, DestroyRef, ElementRef, inject, input, output, viewChild } from '@angular/core';

import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';

import {
  isCopyShortcut,
  isPasteShortcut,
  preparePaste,
  TERMINAL_PASTE_LIMIT_BYTES,
  TerminalSize,
} from './terminal-protocol';

/** Why the terminal could not take a paste (translation keys). */
export type TerminalNotice =
  { code: 'paste_too_large'; bytes: number; limit: number } | { code: 'clipboard_unavailable' };

/** Translation key of a paste the terminal refused. */
export function terminalNoticeMessage(notice: TerminalNotice): string {
  return notice.code === 'paste_too_large'
    ? 'The pasted text is too large for the console.'
    : 'Paste with Ctrl+Shift+V (Cmd+V on macOS): the browser did not allow reading the clipboard.';
}

/**
 * xterm.js terminal shared by the VPS console and the Network device console. It owns the screen
 * only: the caller owns the socket and its framing.
 *
 * - The grid always matches the visible area (fit addon on every resize); `ready` and `resized`
 *   report the real columns and rows so the caller sends them to the remote (apt progress bars,
 *   full-screen apps).
 * - Keystrokes and pastes leave through the same `terminalInput` output (xterm `onData`), so the device
 *   console classifies pasted text exactly like typed text. Ctrl+Shift+V, Shift+Insert, Cmd+V,
 *   the browser paste event and right click paste; bracketed paste is applied by xterm when the
 *   remote enabled it, control characters are removed and a paste above the limit is refused.
 * - Ctrl+Shift+C / Cmd+C copy the selection; right click copies a selection or pastes.
 */
@Component({
  selector: 'mns-terminal',
  standalone: true,
  styles: [
    `
      :host {
        display: flex;
        flex: 1 1 auto;
        min-height: 320px;
        min-width: 0;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        padding: 6px;
        box-sizing: border-box;
      }
      .screen {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
      }
    `,
  ],
  template: `<div class="screen" #screen></div>`,
})
export class TerminalComponent {
  /** Largest paste in UTF-8 bytes. */
  readonly pasteLimit = input(TERMINAL_PASTE_LIMIT_BYTES);
  /** Typed or pasted data, already in terminal form (CR line ends, bracketed when enabled). */
  readonly terminalInput = output<string>();
  /** The terminal is open; carries its fitted size. */
  readonly ready = output<TerminalSize>();
  /** The fitted grid changed. */
  readonly resized = output<TerminalSize>();
  readonly notice = output<TerminalNotice>();

  private readonly screen = viewChild.required<ElementRef<HTMLDivElement>>('screen');
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private pending: (string | Uint8Array)[] = [];
  private teardown: (() => void) | null = null;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.teardown?.();
      this.teardown = null;
    });
    queueMicrotask(() => void this.open());
  }

  /** Current grid (null before the terminal opens). */
  size(): TerminalSize | null {
    return this.terminal ? { cols: this.terminal.cols, rows: this.terminal.rows } : null;
  }

  write(data: string | Uint8Array) {
    if (!data.length) return;
    if (this.terminal) this.terminal.write(data);
    else this.pending.push(data);
  }

  focus() {
    this.terminal?.focus();
  }

  /** Clears the screen and the modes of a previous session (before a reconnect). */
  reset() {
    this.terminal?.reset();
  }

  /** Pastes text through the same path as the keyboard. */
  paste(text: string) {
    const terminal = this.terminal;
    if (!terminal) return;
    const limit = this.pasteLimit();
    const prepared = preparePaste(text, limit);
    if (!prepared.ok) {
      this.notice.emit({ code: 'paste_too_large', bytes: prepared.bytes, limit });
      return;
    }
    if (prepared.text) terminal.paste(prepared.text);
    terminal.focus();
  }

  /** Reads the clipboard (button or right click) and pastes it. */
  async pasteFromClipboard() {
    let text: string;
    try {
      if (!navigator.clipboard?.readText) throw new Error('unavailable');
      text = await navigator.clipboard.readText();
    } catch {
      this.notice.emit({ code: 'clipboard_unavailable' });
      return;
    }
    this.paste(text);
  }

  private copySelection(): boolean {
    const selection = this.terminal?.getSelection() ?? '';
    if (!selection) return false;
    void navigator.clipboard?.writeText(selection).catch(() => undefined);
    return true;
  }

  private async open() {
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]);
    if (this.destroyed) return;
    const host = this.screen().nativeElement;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      convertEol: false,
      scrollback: 5000,
      rightClickSelectsWord: false,
      theme: { background: '#000000' },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host);
    this.terminal = terminal;
    this.fitAddon = fit;

    // The browser fires the paste event for these shortcuts; xterm must not turn them into keys.
    terminal.attachCustomKeyEventHandler((event) => {
      if (isPasteShortcut(event)) return false;
      if (isCopyShortcut(event) && this.copySelection()) {
        event.preventDefault();
        return false;
      }
      return true;
    });
    // One paste path for every source (shortcut, browser menu, middle click on Linux).
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.paste(event.clipboardData?.getData('text/plain') ?? '');
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (this.copySelection()) terminal.clearSelection();
      else void this.pasteFromClipboard();
    };
    host.addEventListener('paste', onPaste, true);
    host.addEventListener('contextmenu', onContextMenu);

    const data = terminal.onData((value) => this.terminalInput.emit(value));
    const resize = terminal.onResize(({ cols, rows }) => this.resized.emit({ cols, rows }));
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.fit());
    };
    const observer = new ResizeObserver(refit);
    observer.observe(host);

    this.fit();
    // Fonts change the cell size: fit again once they are loaded.
    void document.fonts?.ready.then(() => !this.destroyed && this.fit());
    for (const chunk of this.pending) terminal.write(chunk);
    this.pending = [];
    this.teardown = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('paste', onPaste, true);
      host.removeEventListener('contextmenu', onContextMenu);
      data.dispose();
      resize.dispose();
      terminal.dispose();
      this.terminal = null;
      this.fitAddon = null;
    };
    this.ready.emit({ cols: terminal.cols, rows: terminal.rows });
  }

  private fit() {
    const host = this.screen().nativeElement;
    if (!this.fitAddon || !host.clientWidth || !host.clientHeight) return;
    try {
      this.fitAddon.fit();
    } catch {
      /* not rendered yet */
    }
  }
}
