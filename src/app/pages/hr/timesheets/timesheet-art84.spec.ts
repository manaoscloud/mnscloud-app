import { dayTreatments, punchTimesMarked, timesheetPrintHtml } from './timesheet-art84';

const t = (key: string) => key;

describe('timesheet art. 84', () => {
  const day = {
    Date: '2026-11-03',
    DayKind: 'work',
    punches: [
      { LocalTime: '08:00', NSR: 10, TimePunchUUID: 'p1', Disregarded: true },
      { LocalTime: '08:05', NSR: 11, TimePunchUUID: 'p2' },
    ],
    adjustments: [
      { Kind: 'include', PunchType: 'clock_out', LocalTime: '17:00', Reason: '<b>forgot</b>' },
      { Kind: 'disregard', PunchUUID: 'p1', Reason: 'duplicate' },
    ],
  };

  it('marks included and disregarded treatments', () => {
    const items = dayTreatments(day, t);
    expect(items[0].text).toBe('(I) 17:00 Clock out');
    expect(items[1].text).toBe('(D) 08:00');
    expect(punchTimesMarked(day)).toBe('08:00 (D) · 08:05');
  });

  it('tolerates an older API without header or adjustments', () => {
    const html = timesheetPrintHtml(
      {
        employee: { Name: 'Ana' },
        month: '2026-11',
        timezone: 'UTC',
        days: [{ Date: '2026-11-03' }],
        totals: {},
      },
      t,
      'pt-BR',
    );
    expect(html).toContain('Ana');
  });

  it('escapes every value of the printable document', () => {
    const html = timesheetPrintHtml(
      {
        employee: { Name: '<script>x</script>' },
        month: '2026-11',
        timezone: 'UTC',
        days: [day],
        totals: {},
        header: {
          employer: { Name: '<i>ACME</i>', Document: '12345678000190', DocumentKind: 'cnpj' },
        },
      },
      t,
      'pt-BR',
    );
    expect(html).not.toContain('<script>x');
    expect(html).not.toContain('<i>ACME');
    expect(html).not.toContain('<b>forgot');
    expect(html).toContain('12.345.678/0001-90');
    expect(html).toContain('NSR 10');
  });
});
