import { hrErrorText } from '../../../shared/crud/configurable-crud/hr-error-codes';
import { closingStateText } from '../timesheets/timesheet-art84';
import {
  closeResultRows,
  durationText,
  monthText,
  parseDuration,
  previousMonth,
  skipReasonText,
} from './closing-shared';

const t = (key: string) => key;

describe('HR month closing helpers', () => {
  it('parses hours typed as H:MM, decimals or whole hours', () => {
    expect(parseDuration('2:30')).toBe(150);
    expect(parseDuration('180:00')).toBe(10800);
    expect(parseDuration('2,5')).toBe(150);
    expect(parseDuration('8')).toBe(480);
    expect(parseDuration('0:75')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });

  it('shows stored minutes as H:MM and nothing when there is no limit', () => {
    expect(durationText(10800)).toBe('180:00');
    expect(durationText(null)).toBe('');
  });

  it('closes the last month that ended by default', () => {
    expect(previousMonth(new Date(2026, 10, 14))).toBe('2026-10');
    expect(previousMonth(new Date(2026, 0, 5))).toBe('2025-12');
    expect(monthText('2026-10')).toBe('10/2026');
    expect(monthText(null)).toBe('—');
  });

  it('translates the skip reasons and keeps unknown codes visible', () => {
    expect(skipReasonText('HR_CLOSING_OPEN_DAY', t)).toBe(
      'A day of the month still has an open shift.',
    );
    expect(skipReasonText('HR_CLOSING_NEW', t)).toBe('HR_CLOSING_NEW');
    expect(skipReasonText(null, t)).toBe('—');
  });

  it('lists what happened to each employee', () => {
    expect(
      closeResultRows(
        [
          { Name: 'Ana', Result: 'closed', Reason: null },
          { Name: 'Bia', Result: 'skipped', Reason: 'HR_CLOSING_PENDING_REQUEST' },
        ],
        t,
      ),
    ).toEqual([
      { name: 'Ana', result: 'Month closed', reason: '—' },
      {
        name: 'Bia',
        result: 'Month skipped',
        reason: 'There are time requests waiting for a decision in the month.',
      },
    ]);
    expect(closeResultRows(undefined, t)).toEqual([]);
  });

  it('describes the closed month and the acknowledgement on the timesheet', () => {
    const closed = { Status: 'closed', ClosedAt: '2026-11-02T13:00:00Z', Acknowledged: false };
    const pending = closingStateText(closed, t, 'en-US', 'America/Sao_Paulo');
    expect(pending).toMatch(/^Closed on .*10.* · Awaiting acknowledgement$/);
    const done = closingStateText(
      { ...closed, Acknowledged: true, AcknowledgedAt: '2026-11-03T12:00:00Z' },
      t,
      'en-US',
      'America/Sao_Paulo',
    );
    expect(done).toContain('Acknowledged on');
    expect(closingStateText(null, t, 'en-US')).toBe('');
    expect(closingStateText({ Status: 'reopened' }, t, 'en-US')).toBe('');
  });

  it('explains a closed month in the adjustments, absences and requests', () => {
    expect(hrErrorText({ error: { code: 'HR_TIMESHEET_CLOSED' } })).toBe(
      'Month closed: reopen the closing to change it.',
    );
    expect(hrErrorText('HR_CLOSING_NOT_LAST')).toContain('latest closed month');
    expect(hrErrorText('HR_HOUR_BANK_INSUFFICIENT')).toContain('hour bank');
  });
});
