import { currentMonth } from '../hr-time';
import { formatDeviation, formatShare, reportMonth } from './hr-reports-shared';
import { TIME_REPORT_ORDERS } from './time-report';

describe('HR reports helpers', () => {
  it('formats standard deviations with one decimal and a dash when missing', () => {
    expect(formatDeviation(1.234)).toBe('1.2');
    expect(formatDeviation(0)).toBe('0.0');
    expect(formatDeviation(null)).toBe('—');
    expect(formatDeviation('x')).toBe('—');
  });

  it('formats the round-minute share as a whole percentage', () => {
    expect(formatShare(0.8)).toBe('80%');
    expect(formatShare(0.456)).toBe('46%');
    expect(formatShare(undefined)).toBe('—');
  });

  it('uses the chosen month or falls back to the current one', () => {
    const now = new Date(2026, 10, 13);
    expect(reportMonth({ month: '2026-09' }, now)).toBe('2026-09');
    expect(reportMonth({ month: 'bad' }, now)).toBe(currentMonth(now));
    expect(reportMonth(undefined, now)).toBe('2026-11');
  });

  it('offers the API orders', () => {
    expect(TIME_REPORT_ORDERS.map((order) => order.value)).toEqual([
      'overtime',
      'absence',
      'late',
      'name',
    ]);
  });
});
