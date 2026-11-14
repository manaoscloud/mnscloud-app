import {
  aiErrorKey,
  assistRequestErrorKey,
  parseServerDate,
  assistEntries,
  assistThinking,
  canApprove,
  changeResults,
  RemoteProposal,
} from './remote-assistant';
import { RemoteEvent } from './remote-session';

const ev = (
  seq: number,
  kind: string,
  data: Record<string, unknown> = {},
  textValue = '',
  date = '2026-11-14T12:00:00Z',
): RemoteEvent => ({
  SreSeq: seq,
  SreKind: kind,
  SreText: textValue,
  SreData: data,
  SreDateCreated: date,
});
const NOW = Date.parse('2026-11-14T12:01:00Z');

describe('remote assistant helpers', () => {
  it('is thinking from server state, not from dates', () => {
    const request = ev(5, 'ai_request', { runUUID: 'r1' }, 'oi', '2026-11-14 12:00:00');
    // The record was not reloaded yet (older last seq): the request is still running.
    expect(assistThinking({ SrsLastEventSeq: 4 }, [request])).toBe(true);
    // The record already knows the request and carries no active run: stale, not thinking.
    expect(assistThinking({ SrsLastEventSeq: 5 }, [request])).toBe(false);
    expect(
      assistThinking({ SrsLastEventSeq: 4 }, [request, ev(6, 'ai_reply', { runUUID: 'r1' })]),
    ).toBe(false);
    const active = { AssistRunUUID: 'r2', SrsLastEventSeq: 9 };
    expect(assistThinking(active, [])).toBe(true);
    expect(assistThinking(active, [ev(10, 'ai_error', { runUUID: 'r2' })])).toBe(false);
  });

  it('reads zone-less server dates as UTC', () => {
    expect(parseServerDate('2026-11-14 12:00:00')).toBe(Date.parse('2026-11-14T12:00:00Z'));
    expect(parseServerDate('2026-11-14T12:00:00Z')).toBe(Date.parse('2026-11-14T12:00:00Z'));
    expect(parseServerDate('2026-11-14T12:00:00-03:00')).toBe(Date.parse('2026-11-14T15:00:00Z'));
    expect(Number.isNaN(parseServerDate(''))).toBe(true);
  });

  it('maps request failures to messages', () => {
    const http = (status: number, code?: string) => ({ status, error: code ? { code } : {} });
    expect(assistRequestErrorKey(http(409, 'SUPPORT_REMOTE_ASSIST_BUSY'))).toBe(
      'support.remote.ai.busy',
    );
    expect(assistRequestErrorKey(http(409))).toBe('support.remote.error.conflict');
    expect(assistRequestErrorKey(http(402))).toContain('AI_NO_CREDIT');
    expect(assistRequestErrorKey(http(429))).toContain('rateLimited');
    expect(assistRequestErrorKey(http(403))).toBe('support.remote.error.forbidden');
    expect(assistRequestErrorKey(http(500))).toBe('');
  });

  it('builds chat entries and keeps hidden outputs marked', () => {
    const entries = assistEntries([
      ev(1, 'ai_request', {}, 'oi'),
      ev(2, 'ai_exec', {
        device: 'rb1',
        status: 'ok',
        commands: [{ command: '/system resource print', class: 'read', exitCode: 0 }],
      }),
      ev(3, 'ai_error', { code: 'AI_NO_CREDIT' }),
    ]);
    expect(entries.map((e) => e.type)).toEqual(['request', 'exec', 'error']);
    const exec = entries[1];
    expect(exec.type === 'exec' && exec.commands[0].hidden).toBe(true);
  });

  it('keeps an empty output visible, not hidden', () => {
    const [entry] = assistEntries([
      ev(1, 'ai_exec', { commands: [{ command: 'a', output: '' }, { command: 'b' }] }),
    ]);
    expect(entry.type === 'exec' && entry.commands.map((c) => c.hidden)).toEqual([false, true]);
  });

  it('maps ai error codes and change results', () => {
    expect(aiErrorKey('AI_INTERRUPTED')).toContain('AI_INTERRUPTED');
    expect(aiErrorKey('whatever')).toContain('unknown');
    const results = changeResults([
      ev(1, 'change_rolled_back', {
        proposalUUID: 'p1',
        status: 'rolled_back',
        rollback: { method: 'safe_mode', fired: true },
        error: { code: 'VERIFY_FAILED', message: 'x' },
      }),
    ]);
    expect(results.get('p1')?.errorCode).toBe('VERIFY_FAILED');
    expect(results.get('p1')?.rollbackFired).toBe(true);
  });

  it('offers approve for proposed and approved proposals only', () => {
    const base = { SrpStatus: 'proposed' } as RemoteProposal;
    expect(canApprove(base)).toBe(true);
    expect(canApprove({ ...base, SrpStatus: 'approved' })).toBe(true);
    expect(canApprove({ ...base, SrpStatus: 'applying' })).toBe(false);
  });
});
