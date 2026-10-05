import { SupportRequestDraft } from './support-request-draft';

describe('Support request retries', () => {
  it('reuses the exact payload for retries but separates changed drafts and environments', () => {
    const draft = new SupportRequestDraft();
    const first = draft.prepare(
      'environment-a',
      { subject: 'Help', diagnostics: { time: 1 } },
      'Help',
    );
    expect(
      draft.prepare('environment-a', { subject: 'Help', diagnostics: { time: 2 } }, 'Help'),
    ).toEqual(first);
    (first['diagnostics'] as { time: number }).time = 99;
    expect(draft.prepare('environment-a', {}, 'Help')['diagnostics']).toEqual({ time: 1 });
    const changed = draft.prepare('environment-a', { subject: 'Changed' });
    expect(changed['idempotencyKey']).not.toBe(first['idempotencyKey']);
    const other = draft.prepare('environment-b', { subject: 'Changed' });
    expect(other['idempotencyKey']).not.toBe(changed['idempotencyKey']);
    draft.clear();
    expect(draft.prepare('environment-b', { subject: 'Changed' })['idempotencyKey']).not.toBe(
      other['idempotencyKey'],
    );
  });
});
