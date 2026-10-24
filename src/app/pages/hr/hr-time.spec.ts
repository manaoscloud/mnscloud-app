import {
  flagLabels,
  formatDay,
  formatMinutes,
  hhmm,
  monthOptions,
  shiftMonth,
  timesheetQuery,
} from './hr-time';
import { punchLocations } from './time-punches/punch-map-dialog';
import { applySchedulePreset, workSchedulePayload } from './work-schedules/work-schedules';

describe('Pulse timesheet helpers', () => {
  it('formats minutes as H:MM with an optional sign', () => {
    expect(formatMinutes(480)).toBe('8:00');
    expect(formatMinutes(-20, true)).toBe('-0:20');
    expect(formatMinutes(95, true)).toBe('+1:35');
    expect(formatMinutes(0, true)).toBe('0:00');
    expect(formatMinutes(null)).toBe('—');
  });

  it('reads API times and date-only values without time zone shifts', () => {
    expect(hhmm('08:00:00')).toBe('08:00');
    expect(hhmm('')).toBe('');
    document.documentElement.lang = 'pt-BR';
    expect(formatDay('2026-10-01')).toBe('01/10/2026');
    expect(formatDay('bad')).toBe('—');
  });

  it('moves months across years and lists the selector months', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    const options = monthOptions('en-US', new Date(2026, 9, 15));
    expect(options[0].value).toBe('2026-11');
    expect(options[1].value).toBe('2026-10');
    expect(options.length).toBe(26);
  });

  it('labels flags and links a day to its timesheet month', () => {
    expect(flagLabels(['late', 'absence'], (key) => key)).toBe('Late arrival, Absence');
    expect(timesheetQuery('e1', '2026-10-21')).toEqual({ employeeUUID: 'e1', month: '2026-10' });
  });
});

describe('Work schedule form mapping', () => {
  it('maps the weekly grid to seven positions (empty start = day off)', () => {
    const values = applySchedulePreset('commercial-5x2', { name: '', status: 1 });
    const body = workSchedulePayload(values);
    expect(body['kind']).toBe('weekly');
    expect(body['cycleLength']).toBeUndefined();
    expect(body['name']).toBe('Comercial 5x2');
    const days = body['days'] as Record<string, unknown>[];
    expect(days.length).toBe(7);
    expect(days[0]).toEqual({
      position: 1,
      start: '08:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      end: '17:00',
    });
    expect(days[6]).toEqual({
      position: 7,
      start: null,
      breakStart: null,
      breakEnd: null,
      end: null,
    });
  });

  it('keeps only the cycle positions of a 12x36 schedule and the typed name', () => {
    const values = applySchedulePreset('12x36-night', { name: 'Portaria', status: 0 });
    const body = workSchedulePayload(values);
    expect(body).toEqual(
      jasmine.objectContaining({ name: 'Portaria', kind: 'cycle', cycleLength: 2, status: 0 }),
    );
    const days = body['days'] as Record<string, unknown>[];
    expect(days.map((day) => day['position'])).toEqual([1, 2]);
    expect(days[0]['start']).toBe('19:00');
    expect(days[0]['end']).toBe('07:00');
    expect(days[1]['start']).toBeNull();
  });
});

describe('Punch map points', () => {
  it('keeps only punches with a captured location', () => {
    const points = punchLocations(
      [
        {
          TimePunchUUID: 'a',
          Latitude: -3.1,
          Longitude: -60,
          AccuracyMeters: 12,
          Type: 'clock_in',
        },
        { TimePunchUUID: 'b', Latitude: null, Longitude: null, Type: 'clock_out' },
      ],
      (type) => String(type),
    );
    expect(points.length).toBe(1);
    expect(points[0]).toEqual(
      jasmine.objectContaining({ id: 'a', latitude: -3.1, longitude: -60, accuracy: 12 }),
    );
  });
});
