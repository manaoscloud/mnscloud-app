import {
  approvalExpiryOrDecisionAt,
  approvalStatusChipClass,
  extractApprovalItem,
  firstReasonLine,
  formatApprovalJsonBody,
  formatApprovalTarget,
  isPendingApproval,
  sortApprovalsNewestFirst,
} from './approvals';

describe('system operations approvals pure helpers', () => {
  it('maps approval status values to the global status chip palette', () => {
    expect(approvalStatusChipClass('pending')).toBe('chip-queued');
    expect(approvalStatusChipClass('approved')).toBe('chip-success');
    expect(approvalStatusChipClass('executed')).toBe('chip-success');
    expect(approvalStatusChipClass('rejected')).toBe('chip-failed');
    expect(approvalStatusChipClass('failed')).toBe('chip-failed');
    expect(approvalStatusChipClass('expired')).toBe('chip-skipped');
  });

  it('detects whether a request is pending', () => {
    expect(isPendingApproval({ status: 'pending' })).toBeTrue();
    expect(isPendingApproval({ status: 'PENDING' })).toBeTrue();
    expect(isPendingApproval({ status: 'executed' })).toBeFalse();
    expect(isPendingApproval(null)).toBeFalse();
  });

  it('formats method + path and the first non-empty line of the reason', () => {
    expect(
      formatApprovalTarget({
        method: 'post',
        path: '/api/v1/system/runtime/reconcile-jobs',
      }),
    ).toBe('POST /api/v1/system/runtime/reconcile-jobs');
    expect(formatApprovalTarget({})).toBe('-');

    expect(firstReasonLine('\n  Apply MariaDB collation plan  \nSecond line details')).toBe(
      'Apply MariaDB collation plan',
    );
    expect(firstReasonLine('   ')).toBe('-');
  });

  it('pretty-prints JSON bodies from objects or strings and preserves non-JSON text', () => {
    expect(formatApprovalJsonBody({ stage: 'apply', planDigest: 'abc123' })).toBe(
      '{\n  "stage": "apply",\n  "planDigest": "abc123"\n}',
    );
    expect(formatApprovalJsonBody('{"note":"approved"}')).toBe('{\n  "note": "approved"\n}');
    expect(formatApprovalJsonBody('raw text payload')).toBe('raw text payload');
    expect(formatApprovalJsonBody(null)).toBe('-');
  });

  it('picks decidedAt, then executedAt, then expiresAt for the expires / decided column', () => {
    expect(
      approvalExpiryOrDecisionAt({
        expiresAt: '2026-11-28T12:00:00Z',
        decidedAt: '2026-11-28T11:10:00Z',
        executedAt: '2026-11-28T11:10:02Z',
      }),
    ).toBe('2026-11-28T11:10:00Z');
    expect(
      approvalExpiryOrDecisionAt({
        expiresAt: '2026-11-28T12:00:00Z',
      }),
    ).toBe('2026-11-28T12:00:00Z');
    expect(approvalExpiryOrDecisionAt({})).toBe('');
  });

  it('sorts approval requests newest first by createdAt with id tie-breaker', () => {
    const sorted = sortApprovalsNewestFirst([
      { uuid: 'a', id: 1, createdAt: '2026-11-28T09:00:00Z' },
      { uuid: 'b', id: 3, createdAt: '2026-11-28T10:00:00Z' },
      { uuid: 'c', id: 2, createdAt: '2026-11-28T10:00:00Z' },
    ]);
    expect(sorted.map((item) => item['uuid'])).toEqual(['b', 'c', 'a']);
  });

  it('extracts the approval item from { data: { item } } or { data } envelopes', () => {
    const base = { uuid: 'u1', title: 'Initial' };
    expect(
      extractApprovalItem({ status: 'success', data: { item: { status: 'executed' } } }, base),
    ).toEqual({
      uuid: 'u1',
      title: 'Initial',
      status: 'executed',
    });
    expect(extractApprovalItem({ status: 'success', data: { status: 'rejected' } }, base)).toEqual({
      uuid: 'u1',
      title: 'Initial',
      status: 'rejected',
    });
  });
});
