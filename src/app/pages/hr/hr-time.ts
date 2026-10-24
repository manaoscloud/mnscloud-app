import type { ConfigurableCrudOption } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * Shared vocabulary of the Pulse timesheet pages (HR › Dashboard, Timesheets, Issues, Work
 * schedules): flag and day-kind labels, minute formatting and the month helpers. The API computes
 * every number; these helpers only format what it returns.
 */

/** Inconsistency flags returned by the timesheet engine (`HrTimesheetDay.Flags`). */
export const TIMESHEET_FLAGS: readonly ConfigurableCrudOption[] = [
  { value: 'absence', label: 'Absence' },
  { value: 'missing_punch', label: 'Missing punch' },
  { value: 'late', label: 'Late arrival' },
  { value: 'early_leave', label: 'Early leave' },
  { value: 'short_break', label: 'Break below the minimum' },
  { value: 'rest_violation', label: 'Rest between shifts under 11 h' },
  { value: 'overtime_limit', label: 'Overtime above the limit' },
  { value: 'worked_day_off', label: 'Work on a day off or holiday' },
  { value: 'flagged_punch', label: 'Flagged punch' },
  { value: 'no_schedule', label: 'No work schedule' },
];

export const DAY_KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'work', label: 'Workday' },
  { value: 'off', label: 'Day off' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'no_schedule', label: 'No work schedule' },
];

export const PUNCH_TYPES: readonly ConfigurableCrudOption[] = [
  { value: 'clock_in', label: 'Clock in' },
  { value: 'break_start', label: 'Break start' },
  { value: 'break_end', label: 'Break end' },
  { value: 'clock_out', label: 'Clock out' },
];

/** Integrity flags of one punch (`HrTimePunch.Flags`), shown on punches and timesheets. */
export const PUNCH_FLAGS: Record<string, string> = {
  offline: 'Sent later (offline)',
  late_sync: 'Sent more than 72 h later',
  future_time: 'Device clock ahead (server time used)',
  clock_skew: 'Device clock off by more than 2 min',
  sequence: 'Same mark as the previous one',
};

/** Weekly schedule positions: 1 = Monday .. 7 = Sunday (ISO). */
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function optionLabel(options: readonly ConfigurableCrudOption[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value ?? '');
}

/** Translated, comma-separated flag labels. */
export function flagLabels(flags: unknown, translate: (key: string) => string): string {
  if (!Array.isArray(flags)) return '';
  return flags.map((flag) => translate(optionLabel(TIMESHEET_FLAGS, flag))).join(', ');
}

/** Minutes as `H:MM` (`-0:20` for a debit); `—` when the value is missing. */
export function formatMinutes(value: unknown, signed = false): string {
  if (value === null || value === undefined || value === '') return '—';
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes)) return '—';
  const sign = minutes < 0 ? '-' : signed && minutes > 0 ? '+' : '';
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
}

/** `HH:MM` of an API time (`08:00` or `08:00:00`); empty when missing. */
export function hhmm(value: unknown): string {
  const text = String(value ?? '').trim();
  return /^\d{2}:\d{2}/.test(text) ? text.slice(0, 5) : '';
}

/** Current month as `YYYY-MM` (browser clock; the API answers in the policy time zone). */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value - 1 + delta, 1);
  return currentMonth(date);
}

/** Months offered by the timesheet selector: the last two years up to next month. */
export function monthOptions(locale: string, now = new Date()): ConfigurableCrudOption[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const options: ConfigurableCrudOption[] = [];
  for (let delta = 1; delta >= -24; delta--) {
    const date = new Date(now.getFullYear(), now.getMonth() + delta, 1);
    const label = format.format(date);
    options.push({
      value: currentMonth(date),
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }
  return options;
}

/** Link to the timesheet of an employee in a month (from issues, dashboard and alerts). */
export function timesheetQuery(employeeUUID: unknown, date: unknown): Record<string, string> {
  const day = String(date ?? '');
  return {
    employeeUUID: String(employeeUUID ?? ''),
    month: isMonth(day.slice(0, 7)) ? day.slice(0, 7) : currentMonth(),
  };
}

/**
 * Date-only API values (`YYYY-MM-DD`) in the App language. Parsed as a calendar day (UTC), never
 * shifted by the browser time zone; `weekday` adds the short weekday name.
 */
export function formatDay(value: unknown, weekday = false): string {
  const text = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '—';
  const locale = (typeof document !== 'undefined' && document.documentElement.lang) || undefined;
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(weekday ? { weekday: 'short' as const } : {}),
  }).format(new Date(`${text}T00:00:00Z`));
}
