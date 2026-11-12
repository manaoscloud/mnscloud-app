import {
  encodeTerminalDecision,
  encodeTerminalInput,
  encodeTerminalResize,
  GatewayFrameReader,
  isCopyShortcut,
  isPasteShortcut,
  preparePaste,
  TerminalOutputDecoder,
  utf8ByteLength,
} from './terminal-protocol';

const bytes = (text: string) => new TextEncoder().encode(text);

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    type: 'keydown',
    key: '',
    code: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...init,
  } as KeyboardEvent;
}

describe('terminal framing', () => {
  it('counts UTF-8 bytes in the input length', () => {
    expect(encodeTerminalInput('ls\r')).toBe('0:3:ls\r');
    expect(encodeTerminalInput('ç')).toBe('0:2:ç');
    expect(encodeTerminalInput('◆')).toBe('0:3:◆');
    expect(encodeTerminalInput('😀')).toBe('0:4:😀');
    expect(utf8ByteLength('a◆😀ç')).toBe(1 + 3 + 4 + 2);
  });

  it('sends the real grid on resize', () => {
    expect(encodeTerminalResize({ cols: 132, rows: 41 })).toBe('1:132:41:');
    expect(encodeTerminalResize({ cols: 0, rows: 0 })).toBe('1:1:1:');
  });

  it('encodes confirm and deny answers', () => {
    expect(encodeTerminalDecision({ type: 'confirm', id: 'v1-ab', step: 2 })).toBe(
      '4:{"type":"confirm","id":"v1-ab","step":2}',
    );
    expect(encodeTerminalDecision({ type: 'deny', id: 'v1-ab' })).toBe(
      '4:{"type":"deny","id":"v1-ab"}',
    );
  });
});

describe('TerminalOutputDecoder', () => {
  it('rebuilds a character split across binary frames', () => {
    const decoder = new TerminalOutputDecoder();
    const diamond = bytes('◆ ok'); // ◆ = e2 97 86
    expect(decoder.decode(diamond.slice(0, 1))).toBe('');
    expect(decoder.decode(diamond.slice(1, 2))).toBe('');
    expect(decoder.decode(diamond.slice(2))).toBe('◆ ok');
  });

  it('passes text frames through', () => {
    expect(new TerminalOutputDecoder().decode('plain')).toBe('plain');
  });
});

describe('GatewayFrameReader', () => {
  it('reads the handshake, output and control frames', () => {
    const reader = new GatewayFrameReader();
    expect(reader.push('OK')).toEqual([{ kind: 'ready' }]);
    expect(reader.push('0:5:a◆b')).toEqual([{ kind: 'output', data: 'a◆b' }]);
    expect(reader.push('3:{"type":"state","state":"ready"}')).toEqual([
      { kind: 'control', message: { type: 'state', state: 'ready' } },
    ]);
  });

  it('reads several output frames of one message by byte length', () => {
    const reader = new GatewayFrameReader();
    expect(reader.push('0:3:◆0:2:ç0:4:😀')).toEqual([
      { kind: 'output', data: '◆' },
      { kind: 'output', data: 'ç' },
      { kind: 'output', data: '😀' },
    ]);
  });

  it('waits for an output frame split across messages', () => {
    const reader = new GatewayFrameReader();
    expect(reader.push('0:6:ab')).toEqual([]);
    expect(reader.push('c◆')).toEqual([{ kind: 'output', data: 'abc◆' }]);
    expect(reader.push('0:')).toEqual([]);
    expect(reader.push('1')).toEqual([]);
    expect(reader.push(':x')).toEqual([{ kind: 'output', data: 'x' }]);
  });

  it('reassembles UTF-8 split across binary messages', () => {
    const reader = new GatewayFrameReader();
    const frame = bytes('0:6:◆◆');
    expect(reader.push(frame.slice(0, 5))).toEqual([]); // "0:6:" + first byte of ◆
    expect(reader.push(frame.slice(5, 9))).toEqual([]);
    expect(reader.push(frame.slice(9))).toEqual([{ kind: 'output', data: '◆◆' }]);
  });

  it('never shows device text outside a frame or reads it as control', () => {
    const reader = new GatewayFrameReader();
    expect(reader.push('hello')).toEqual([{ kind: 'invalid', raw: 'hello' }]);
    // Output that looks like a control message stays output.
    expect(reader.push('0:14:3:{"type":"x"}')).toEqual([
      { kind: 'output', data: '3:{"type":"x"}' },
    ]);
    expect(reader.push('3:not json')).toEqual([{ kind: 'invalid', raw: 'not json' }]);
    expect(reader.push('0:x:abc')).toEqual([{ kind: 'invalid', raw: '0:x:abc' }]);
  });
});

describe('paste handling', () => {
  it('keeps text and line breaks, removes control characters and bracket delimiters', () => {
    expect(preparePaste('a\tb\r\nc\n')).toEqual({ ok: true, text: 'a\tb\r\nc\n' });
    expect(preparePaste('x\x1b[201~; rm -rf /\x1b[200~')).toEqual({
      ok: true,
      text: 'x; rm -rf /',
    });
    expect(preparePaste('a\x00b\x07c\x7fd\x03')).toEqual({ ok: true, text: 'abcd' });
  });

  it('refuses a paste above the limit instead of truncating it', () => {
    expect(preparePaste('◆◆', 5)).toEqual({ ok: false, bytes: 6 });
    expect(preparePaste('◆', 3)).toEqual({ ok: true, text: '◆' });
  });

  it('leaves the paste shortcuts to the browser and keeps Ctrl+V for the remote', () => {
    expect(isPasteShortcut(key({ key: 'V', ctrlKey: true, shiftKey: true }))).toBeTrue();
    expect(isPasteShortcut(key({ key: 'v', metaKey: true }))).toBeTrue();
    expect(isPasteShortcut(key({ key: 'Insert', shiftKey: true }))).toBeTrue();
    expect(isPasteShortcut(key({ key: 'v', ctrlKey: true }))).toBeFalse();
    expect(
      isPasteShortcut(key({ key: 'V', ctrlKey: true, shiftKey: true, type: 'keyup' })),
    ).toBeFalse();
  });

  it('copies with Ctrl+Shift+C or Cmd+C and keeps Ctrl+C as interrupt', () => {
    expect(isCopyShortcut(key({ key: 'C', ctrlKey: true, shiftKey: true }))).toBeTrue();
    expect(isCopyShortcut(key({ key: 'c', metaKey: true }))).toBeTrue();
    expect(isCopyShortcut(key({ key: 'c', ctrlKey: true }))).toBeFalse();
  });
});
