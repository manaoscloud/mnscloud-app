import { FlowDetail, NodeTypeDef } from '../automation-adapter';
import {
  editorLayoutFor,
  lockedByOther,
  moduleAccent,
  nodeSummary,
  paletteGroups,
} from './editor-helpers';
import { chatLines } from './test-panel';
import { fieldKind, humanize } from './schema-field';

function type(name: string, locked = false): NodeTypeDef {
  return {
    type: name,
    typeVersion: 1,
    module: name.split('.')[0],
    category: '',
    icon: 'x',
    surfaces: [],
    ports: [],
    configSchema: {},
    effect: 'read',
    locked,
    lockReason: locked ? 'module_not_contracted' : '',
  };
}

describe('editor helpers', () => {
  it('falls back to a list on phones and narrows panes on medium widths', () => {
    expect(editorLayoutFor(360)).toBe('phone');
    expect(editorLayoutFor(900)).toBe('medium');
    expect(editorLayoutFor(1400)).toBe('wide');
  });

  it('honors a lock of another user for ten minutes only', () => {
    const now = Date.parse('2026-11-12T12:00:00Z');
    const flow = (userUUID: string, editedAt: string) =>
      ({ lock: { userUUID, userName: 'M', editedAt } }) as FlowDetail;
    expect(lockedByOther(flow('u2', '2026-11-12T11:55:00Z'), 'u1', now)).toBeTrue();
    expect(lockedByOther(flow('u2', '2026-11-12T11:40:00Z'), 'u1', now)).toBeFalse();
    expect(lockedByOther(flow('u1', '2026-11-12T11:59:00Z'), 'u1', now)).toBeFalse();
    expect(lockedByOther(null, 'u1', now)).toBeFalse();
  });

  it('groups the palette by module with core first and locked groups marked', () => {
    const groups = paletteGroups(
      [type('conversations.ask', true), type('core.end'), type('conversations.handoff', true)],
      '',
    );
    expect(groups.map((group) => group.module)).toEqual(['core', 'conversations']);
    expect(groups[0].locked).toBeFalse();
    expect(groups[1].locked).toBeTrue();
    expect(groups[1].reason).toBe('module_not_contracted');
    expect(paletteGroups([type('core.end')], 'zzz')).toEqual([]);
  });

  it('colors core with the primary token and other modules with a stable token', () => {
    expect(moduleAccent('core')).toBe('--mat-sys-color-primary');
    expect(moduleAccent('conversations')).toBe(moduleAccent('conversations'));
    expect(moduleAccent('conversations')).toMatch(/^--mns-/);
  });

  it('summarizes the first filled text of a config', () => {
    const node = (config: Record<string, unknown>) => ({
      id: 'n',
      type: 't',
      typeVersion: 1,
      position: { x: 0, y: 0 },
      config,
    });
    expect(nodeSummary(node({ text: '  Hello   there ' }))).toBe('Hello there');
    expect(nodeSummary(node({ rules: [{ left: '', right: 'x' }] }))).toBe('x');
    expect(nodeSummary(node({ text: 'a'.repeat(100) })).length).toBe(70);
    expect(nodeSummary(node({}))).toBe('');
  });
});

describe('schema field helpers', () => {
  it('picks the control from the schema', () => {
    expect(fieldKind('mode', { type: 'string', enum: ['all', 'any'] })).toBe('enum');
    expect(fieldKind('active', { type: 'boolean' })).toBe('boolean');
    expect(fieldKind('minutes', { type: 'integer' })).toBe('number');
    expect(fieldKind('text', { type: 'string', maxLength: 4096 })).toBe('textarea');
    expect(fieldKind('url', { type: 'string' })).toBe('string');
    expect(fieldKind('start', { type: 'string' })).toBe('time');
    expect(fieldKind('connectionUUIDs', { type: 'array', items: { type: 'string' } })).toBe(
      'picker-multi',
    );
    expect(fieldKind('teamUUID', { type: 'string' })).toBe('picker');
    expect(fieldKind('holidays', { type: 'array', items: { type: 'string' } })).toBe(
      'string-array',
    );
    expect(fieldKind('rules', { type: 'array', items: { type: 'object' } })).toBe('object-array');
  });

  it('humanizes names', () => {
    expect(humanize('timeoutMinutes')).toBe('Timeout minutes');
    expect(humanize('set_variable')).toBe('Set variable');
  });
});

describe('test panel chat', () => {
  it('appends what the contact typed and the flow answers', () => {
    const lines = chatLines([], null, [{ author: 'bot', text: 'Hi', options: ['1 - A'] }]);
    const next = chatLines(lines, 'A', [{ author: 'bot', text: 'Bye', options: [] }]);
    expect(next.map((line) => line.author)).toEqual(['bot', 'contact', 'bot']);
    expect(next[0].options).toEqual(['1 - A']);
  });
});
