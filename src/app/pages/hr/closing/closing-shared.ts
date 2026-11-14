import type {
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { currentMonth, formatMinutes, shiftMonth } from '../hr-time';

/** Status of a month closing (`HrTimesheetClosing.HclStatus`). */
export const CLOSING_STATUSES: readonly ConfigurableCrudOption[] = [
  { value: 'closed', label: 'Month closed' },
  { value: 'reopened', label: 'Reopened' },
];

/** Employee acknowledgement (ciência) of a closed month, as the list filter offers it. */
export const CLOSING_ACKS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Awaiting acknowledgement' },
  { value: 'acknowledged', label: 'Employee acknowledged' },
];

/** Overtime treatment of a time policy (`HrTimePolicy.HplOvertimeMode`). */
export const OVERTIME_MODES: readonly ConfigurableCrudOption[] = [
  { value: 'payment', label: 'Monthly payment' },
  { value: 'bank', label: 'Hour bank' },
];

/** Direction of one hour bank ledger entry. */
export const BANK_ENTRY_KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'expire_paid', label: 'Expired and paid' },
  { value: 'manual_paid', label: 'Paid by HR' },
];

/** Why an employee was skipped when a month was closed for a scope. */
const SKIP_REASONS: Record<string, string> = {
  HR_CLOSING_ALREADY_CLOSED: 'The month is already closed.',
  HR_CLOSING_PENDING_RECALC: 'The month is being recalculated. Try again in a few minutes.',
  HR_CLOSING_PENDING_REQUEST: 'There are time requests waiting for a decision in the month.',
  HR_CLOSING_OPEN_DAY: 'A day of the month still has an open shift.',
  HR_CLOSING_LATER_CLOSED: 'A later month of the employee is already closed.',
};

export type Translate = (key: string) => string;

/** Translated skip reason of the close answer; the raw code for a reason this App does not know. */
export function skipReasonText(reason: unknown, t: Translate): string {
  const code = String(reason ?? '');
  if (!code) return '—';
  return SKIP_REASONS[code] ? t(SKIP_REASONS[code]) : code;
}

/** Month closed by default: the last one that ended. */
export function previousMonth(now = new Date()): string {
  return shiftMonth(currentMonth(now), -1);
}

/** `MM/YYYY` of a `YYYY-MM` month key; `—` when missing. */
export function monthText(key: unknown): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(String(key ?? ''));
  return match ? `${match[2]}/${match[1]}` : '—';
}

/**
 * Minutes typed by HR as `H:MM` (`12:30`), as hours with a decimal part (`2,5`) or as whole
 * hours (`8`). `null` when the text is empty or not a positive duration.
 */
export function parseDuration(value: unknown): number | null {
  const text = String(value ?? '').trim();
  const clock = /^(\d{1,4}):([0-5]\d)$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const hours = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(text);
  if (!hours) return null;
  return Math.round(Number(`${hours[1]}.${hours[2] ?? '0'}`) * 60);
}

/** Minutes of a duration field in the form (`H:MM`), empty when none. */
export function durationText(minutes: unknown): string {
  return minutes === null || minutes === undefined || minutes === '' ? '' : formatMinutes(minutes);
}

/** Rows of the per-employee result shown after a month was closed for a scope. */
export function closeResultRows(
  items: unknown,
  t: Translate,
): { name: string; result: string; reason: string }[] {
  return (Array.isArray(items) ? (items as ConfigurableCrudRecord[]) : []).map((item) => ({
    name: String(item['Name'] ?? item['EmployeeUUID'] ?? ''),
    result: t(item['Result'] === 'closed' ? 'Month closed' : 'Month skipped'),
    reason: skipReasonText(item['Reason'], t),
  }));
}

/** Language of the App chrome, for the month options of a dialog built outside a component. */
export function uiLocale(): string {
  return (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
}
