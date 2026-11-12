import type { ConfigurableCrudRecord } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  escapeHtml,
  printDocumentHtml,
  printKeyValueHtml,
  printTableHtml,
} from '../../../shared/print/print-html';
import {
  DAY_KINDS,
  PUNCH_TYPES,
  WEEKDAYS,
  flagLabels,
  formatDay,
  formatMinutes,
  hhmm,
  optionLabel,
} from '../hr-time';

type Row = ConfigurableCrudRecord;
export type Translate = (key: string) => string;

/** Portaria MTP 671/2021 art. 84 header; every part may be absent on an older API. */
export type TimesheetHeader = {
  employer?: { Name?: string; Document?: string; DocumentKind?: string } | null;
  employee?: {
    Name?: string;
    Document?: string;
    HireDate?: string | null;
    PositionName?: string;
    DepartmentName?: string;
  } | null;
  schedules?: {
    Name?: string;
    Kind?: string;
    CycleLength?: number | null;
    StartDate?: string | null;
    EndDate?: string | null;
    Days?: {
      Position?: number;
      Start?: string;
      BreakStart?: string;
      BreakEnd?: string;
      End?: string;
    }[];
  }[];
  period?: { From?: string; To?: string } | null;
  IssuedAt?: string;
  Timezone?: string;
};

export type TimesheetPrintData = {
  employee: Row;
  month: string;
  timezone: string;
  days: Row[];
  totals: Row;
  header?: TimesheetHeader | null;
};

function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

export function formatDocument(value: unknown, kind?: unknown): string {
  const text = String(value ?? '').trim();
  const digits = text.replace(/\D/g, '');
  if (text !== digits) return text;
  if (digits.length === 14)
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return text || (kind ? '' : '');
}

function punchId(punch: Row): string {
  return String(punch['PunchUUID'] ?? punch['TimePunchUUID'] ?? '');
}

/** Treatment marks of one day: `(I)` included marks and `(D)` disregarded punches. */
export function dayTreatments(
  day: Row,
  t: Translate,
): { marker: 'I' | 'D'; text: string; reason: string }[] {
  const punches = rowsOf(day['punches']);
  return rowsOf(day['adjustments']).map((item) => {
    const include = item['Kind'] === 'include';
    if (include) {
      const type = item['PunchType'] ? t(optionLabel(PUNCH_TYPES, item['PunchType'])) : '';
      return {
        marker: 'I' as const,
        text: `(I) ${String(item['LocalTime'] ?? '')} ${type}`.trim(),
        reason: String(item['Reason'] ?? ''),
      };
    }
    const target = punches.find((punch) => punchId(punch) && punchId(punch) === item['PunchUUID']);
    return {
      marker: 'D' as const,
      text: `(D) ${String(target?.['LocalTime'] ?? item['LocalTime'] ?? '')}`.trim(),
      reason: String(item['Reason'] ?? ''),
    };
  });
}

/** Punch times of the day; disregarded punches carry `(D)`. */
export function punchTimesMarked(day: Row): string {
  return rowsOf(day['punches'])
    .map((punch) => `${String(punch['LocalTime'] ?? '')}${punch['Disregarded'] ? ' (D)' : ''}`)
    .join(' · ');
}

export function treatmentsText(day: Row, t: Translate): string {
  return dayTreatments(day, t)
    .map((item) => item.text)
    .join(' · ');
}

export function scheduleDayLine(
  day: { Position?: number; Start?: string; BreakStart?: string; BreakEnd?: string; End?: string },
  kind: string | undefined,
  t: Translate,
): string {
  const position = Number(day.Position ?? 0);
  const label = kind === 'weekly' ? t(WEEKDAYS[position - 1] ?? '') : `${t('Day')} ${position}`;
  const times = [hhmm(day.Start), hhmm(day.BreakStart), hhmm(day.BreakEnd), hhmm(day.End)];
  if (!times[0]) return `${label}: ${t('Day off')}`;
  const brk = times[1] && times[2] ? ` (${t('Break')} ${times[1]}–${times[2]})` : '';
  return `${label}: ${times[0]}–${times[3] || '…'}${brk}`;
}

function scheduleTitle(
  schedule: NonNullable<TimesheetHeader['schedules']>[number],
  t: Translate,
): string {
  const period = [schedule.StartDate, schedule.EndDate]
    .map((date) => (date ? formatDay(date) : ''))
    .filter(Boolean)
    .join(' – ');
  const kind =
    schedule.Kind === 'cycle' ? `${t('Cycle')} ${schedule.CycleLength ?? ''}`.trim() : t('Weekly');
  return [schedule.Name, kind, period].filter(Boolean).join(' · ');
}

function dateTimeInZone(
  iso: string | undefined,
  timezone: string | undefined,
  locale: string,
): string {
  const at = Date.parse(iso ?? '');
  const date = Number.isNaN(at) ? new Date() : new Date(at);
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'medium',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(
      date,
    );
  }
}

/** Self-contained printable HTML of the art. 84 timesheet; every value is escaped. */
export function timesheetPrintHtml(data: TimesheetPrintData, t: Translate, locale: string): string {
  const header = data.header ?? {};
  const employer = header.employer ?? {};
  const employee = header.employee ?? {};
  const name = employee.Name || String(data.employee['Name'] ?? '');
  const position = employee.PositionName || String(data.employee['PositionName'] ?? '');
  const department = employee.DepartmentName || String(data.employee['DepartmentName'] ?? '');
  const timezone = header.Timezone || data.timezone;
  const period = `${formatDay(header.period?.From)} – ${formatDay(header.period?.To)}`;
  const meta = (label: string, value: unknown): [string, unknown] => [label, value || '—'];

  const schedules = (header.schedules ?? [])
    .map(
      (schedule) =>
        `<p><strong>${escapeHtml(scheduleTitle(schedule, t))}</strong></p>` +
        printTableHtml({
          headers: [t('Day'), t('Schedule hours')],
          rows: (schedule.Days ?? []).map((day) => [
            scheduleDayLine(day, schedule.Kind, t).split(': ')[0],
            scheduleDayLine(day, schedule.Kind, t).split(': ').slice(1).join(': '),
          ]),
        }),
    )
    .join('');

  const legend: string[][] = [];
  const rows = data.days.map((day) => {
    const treatments = dayTreatments(day, t);
    const marks = rowsOf(day['punches'])
      .map(
        (punch) =>
          `${String(punch['LocalTime'] ?? '')}${punch['Disregarded'] ? ' (D)' : ''} · NSR ${String(punch['NSR'] ?? '—')}`,
      )
      .concat(treatments.filter((item) => item.marker === 'I').map((item) => item.text))
      .join('\n');
    for (const item of treatments)
      legend.push([formatDay(day['Date']), item.text, item.reason || '—']);
    const overtime = Number(day['OvertimeMinutes'] ?? 0) + Number(day['OvertimeRestMinutes'] ?? 0);
    return [
      formatDay(day['Date']),
      optionLabel(DAY_KINDS, day['DayKind']) ? t(optionLabel(DAY_KINDS, day['DayKind'])) : '',
      String(day['ExpectedStartLocal'] ?? '')
        ? `${String(day['ExpectedStartLocal'])}–${String(day['ExpectedEndLocal'] ?? '')} (${formatMinutes(day['ExpectedMinutes'])})`
        : '—',
      marks || '—',
      formatMinutes(day['WorkedMinutes']),
      formatMinutes(overtime),
      `${formatMinutes(day['AbsenceMinutes'])} / ${formatMinutes(day['LateMinutes'])}`,
      formatMinutes(day['NightReducedMinutes'] ?? day['NightMinutes']),
      formatMinutes(day['BalanceMinutes'], true),
      flagLabels(day['Flags'], t),
    ];
  });

  const totals = data.totals;
  const totalLine = [
    [t('Expected'), formatMinutes(totals['ExpectedMinutes'])],
    [t('Worked'), formatMinutes(totals['WorkedMinutes'])],
    [
      t('Overtime'),
      formatMinutes(
        Number(totals['OvertimeMinutes'] ?? 0) + Number(totals['OvertimeRestMinutes'] ?? 0),
      ),
    ],
    [t('Absences'), formatMinutes(totals['AbsenceMinutes'])],
    [t('Late arrivals'), formatMinutes(totals['LateMinutes'])],
    [t('Night hours'), formatMinutes(totals['NightReducedMinutes'] ?? totals['NightMinutes'])],
    [t('Balance'), formatMinutes(totals['BalanceMinutes'], true)],
  ];

  const body =
    `<h1>${escapeHtml(t('Timesheet'))}</h1>` +
    `<p class="muted">${escapeHtml(t('Period'))}: ${escapeHtml(period)}</p>` +
    `<h2>${escapeHtml(t('Employer'))}</h2>` +
    printKeyValueHtml([
      meta(t('Legal name'), employer.Name),
      meta(employer.DocumentKind === 'cpf' ? 'CPF' : 'CNPJ', formatDocument(employer.Document)),
    ]) +
    `<h2>${escapeHtml(t('Employee'))}</h2>` +
    printKeyValueHtml([
      meta(t('Name'), name),
      meta('CPF', formatDocument(employee.Document)),
      meta(t('Admission date'), employee.HireDate ? formatDay(employee.HireDate) : ''),
      meta(t('Position'), position),
      meta(t('Department'), department),
    ]) +
    (schedules ? `<h2>${escapeHtml(t('Contractual schedules'))}</h2>${schedules}` : '') +
    `<h2>${escapeHtml(t('Days'))}</h2>` +
    printTableHtml({
      headers: [
        t('Date'),
        t('Day'),
        t('Expected'),
        t('Punches'),
        t('Worked'),
        t('Overtime'),
        `${t('Absence')} / ${t('Late')}`,
        t('Night hours'),
        t('Balance'),
        t('Inconsistencies'),
      ],
      rows,
      numericColumns: [4, 5, 6, 7, 8],
    }) +
    `<h2>${escapeHtml(t('Totals'))}</h2>` +
    printTableHtml({
      headers: totalLine.map((item) => item[0]),
      rows: [totalLine.map((item) => item[1])],
      numericColumns: [0, 1, 2, 3, 4, 5, 6],
    }) +
    `<h2>${escapeHtml(t('Treatments'))}</h2>` +
    `<p class="muted">(I) ${escapeHtml(t('Included mark'))} · (D) ${escapeHtml(t('Disregarded punch'))}</p>` +
    (legend.length
      ? printTableHtml({ headers: [t('Date'), t('Treatment mark'), t('Reason')], rows: legend })
      : `<p>${escapeHtml(t('No treatments in the period.'))}</p>`) +
    `<p class="footer">${escapeHtml(t('Issued at'))} ${escapeHtml(dateTimeInZone(header.IssuedAt, timezone, locale))} (${escapeHtml(timezone)})</p>`;

  return printDocumentHtml(`${t('Timesheet')} - ${name}`, body, locale);
}
