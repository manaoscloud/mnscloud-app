import {
  aiErrorKey,
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
  it('is thinking while a request has no reply for the same run', () => {
    const request = ev(1, 'ai_request', { runUUID: 'r1' }, 'oi');
    expect(assistThinking(null, [request], NOW)).toBe(true);
    expect(assistThinking(null, [request, ev(2, 'ai_reply', { runUUID: 'r1' })], NOW)).toBe(false);
    expect(assistThinking(null, [request, ev(2, 'ai_error', { runUUID: 'r1' })], NOW)).toBe(false);
    expect(assistThinking(null, [request], NOW + 10 * 60 * 1000)).toBe(false);
  });

  it('is thinking while the session carries an active run', () => {
    const session = { AssistRunUUID: 'r2', AssistStartedAt: '2026-11-14T12:00:30Z' };
    expect(assistThinking(session, [], NOW)).toBe(true);
    expect(assistThinking(session, [ev(1, 'ai_reply', { runUUID: 'r2' })], NOW)).toBe(false);
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
