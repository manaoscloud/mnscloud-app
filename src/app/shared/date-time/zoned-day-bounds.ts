/** UTC instants delimiting the current calendar day in an explicit IANA timezone.
 * Search each midnight independently: DST days may last 23 or 25 hours, and some
 * zones advance at midnight. Browser timezone is never consulted.
 */
export function zonedDayBounds(timeZone: string, now = new Date()): { from: string; to: string } {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid date');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const calendarDay = (epoch: number) => {
    const parts = formatter.formatToParts(new Date(epoch));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(value('year'), value('month') - 1, value('day'));
  };
  const day = calendarDay(now.getTime());
  const boundary = (target: number) => {
    let low = now.getTime() - 3 * 86400000;
    let high = now.getTime() + 3 * 86400000;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (calendarDay(mid) < target) low = mid + 1;
      else high = mid;
    }
    return new Date(low).toISOString();
  };
  return { from: boundary(day), to: boundary(day + 86400000) };
}
