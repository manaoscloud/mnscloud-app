import { parseUtcDate } from './metrics-monitor.types';

describe('parseUtcDate', () => {
  it('keeps an explicit UTC or offset suffix', () => {
    expect(parseUtcDate('2026-10-26T10:00:00Z').toISOString()).toBe('2026-10-26T10:00:00.000Z');
    expect(parseUtcDate('2026-10-26T07:00:00-03:00').toISOString()).toBe(
      '2026-10-26T10:00:00.000Z',
    );
  });

  it('reads a database timestamp without suffix as UTC', () => {
    expect(parseUtcDate('2026-10-26 10:00:00').toISOString()).toBe('2026-10-26T10:00:00.000Z');
  });
});
