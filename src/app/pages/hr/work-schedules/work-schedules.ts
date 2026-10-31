import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { WEEKDAYS, formatMinutes, hhmm } from '../hr-time';

const ENDPOINT = 'hr/work-schedules';

const KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'cycle', label: 'Cycle' },
];

const CYCLE_LENGTHS: readonly ConfigurableCrudOption[] = [2, 3, 4, 5, 6, 7].map((days) => ({
  value: days,
  label: String(days),
}));

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const POSITIONS = [1, 2, 3, 4, 5, 6, 7] as const;

/** The four marks of a schedule day: form key suffix, API body key and API item key. */
const DAY_PARTS = [
  { suffix: 'Start', body: 'start', item: 'Start', label: 'Start' },
  { suffix: 'BreakStart', body: 'breakStart', item: 'BreakStart', label: 'Break start' },
  { suffix: 'BreakEnd', body: 'breakEnd', item: 'BreakEnd', label: 'Break end' },
  { suffix: 'End', body: 'end', item: 'End', label: 'End' },
] as const;

type DayMarks = readonly [string, string, string, string] | null;

/**
 * Quick-fill templates: weekly marks Monday..Sunday or cycle marks Day 1..N (`null` = day off).
 * They only fill the form; the operator reviews and saves as usual.
 */
type Preset = {
  value: string;
  label: string;
  name: string;
  kind: 'weekly' | 'cycle';
  cycleLength: number;
  days: readonly DayMarks[];
};

const COMMERCIAL: DayMarks = ['08:00', '12:00', '13:00', '17:00'];
const SIX_ONE: DayMarks = ['08:00', '12:00', '13:00', '16:20'];
const PRESETS: readonly Preset[] = [
  {
    value: 'commercial-5x2',
    label: 'Commercial 5x2 (08–12 / 13–17)',
    name: 'Comercial 5x2',
    kind: 'weekly',
    cycleLength: 7,
    days: [COMMERCIAL, COMMERCIAL, COMMERCIAL, COMMERCIAL, COMMERCIAL, null, null],
  },
  {
    value: 'six-one-44h',
    label: '6x1 44 h (08–12 / 13–16:20, Monday to Saturday)',
    name: '6x1 44h',
    kind: 'weekly',
    cycleLength: 7,
    days: [SIX_ONE, SIX_ONE, SIX_ONE, SIX_ONE, SIX_ONE, SIX_ONE, null],
  },
  {
    value: '12x36-day',
    label: '12x36 day shift (07–19, 1 h break)',
    name: '12x36 diurno',
    kind: 'cycle',
    cycleLength: 2,
    days: [['07:00', '12:00', '13:00', '19:00'], null],
  },
  {
    value: '12x36-night',
    label: '12x36 night shift (19–07, 1 h break)',
    name: '12x36 noturno',
    kind: 'cycle',
    cycleLength: 2,
    days: [['19:00', '00:00', '01:00', '07:00'], null],
  },
];

const dayKey = (position: number, suffix: string) => `d${position}${suffix}`;

function cycleLengthOf(values: ConfigurableCrudRecord): number {
  if (values['kind'] !== 'cycle') return 7;
  const length = Number(values['cycleLength']);
  return Number.isInteger(length) && length >= 2 && length <= 7 ? length : 2;
}

function recordDay(row: ConfigurableCrudRecord, position: number): ConfigurableCrudRecord | null {
  const days = Array.isArray(row['Days']) ? (row['Days'] as ConfigurableCrudRecord[]) : [];
  return days.find((day) => Number(day['Position']) === position) ?? null;
}

/** Form fields of the day grid: one row per position with start, break start/end and end. */
const DAY_FIELDS: ConfigurableCrudField[] = POSITIONS.flatMap((position) =>
  DAY_PARTS.map((part, index): ConfigurableCrudField => ({
    key: dayKey(position, part.suffix),
    label: part.label,
    type: 'time',
    span: 1,
    breakBefore: index === 0,
    fromRecord: (_value, row) => hhmm(recordDay(row, position)?.[part.item]),
    hiddenWhen: ({ values }) => position > cycleLengthOf(values),
    ...(index === 0 && position === 1
      ? {
          help: 'Leave the start empty for a day off. An end earlier than the start finishes the next day; the break must be inside the shift.',
        }
      : {}),
  })),
);

/** Fills kind, cycle length, an empty name and the day grid from a template. */
export function applySchedulePreset(
  value: unknown,
  current: ConfigurableCrudRecord,
): ConfigurableCrudRecord {
  const preset = PRESETS.find((item) => item.value === value);
  if (!preset) return current;
  const next: ConfigurableCrudRecord = {
    ...current,
    kind: preset.kind,
    cycleLength: preset.kind === 'cycle' ? preset.cycleLength : '',
    name: String(current['name'] ?? '').trim() ? current['name'] : preset.name,
  };
  for (const position of POSITIONS) {
    const marks = preset.days[position - 1] ?? null;
    DAY_PARTS.forEach((part, index) => {
      next[dayKey(position, part.suffix)] = marks?.[index] ?? '';
    });
  }
  return next;
}

/** API body of a work schedule: the flat day grid becomes the `days` list (1..cycle length). */
export function workSchedulePayload(values: ConfigurableCrudRecord): ConfigurableCrudRecord {
  const length = cycleLengthOf(values);
  const days = POSITIONS.filter((position) => position <= length).map((position) => {
    const day: Record<string, unknown> = { position };
    for (const part of DAY_PARTS) {
      day[part.body] = hhmm(values[dayKey(position, part.suffix)]) || null;
    }
    return day;
  });
  return {
    name: values['name'],
    kind: values['kind'] === 'cycle' ? 'cycle' : 'weekly',
    ...(values['kind'] === 'cycle' ? { cycleLength: length } : {}),
    preAssignedBreak: values['preAssignedBreak'] === true,
    status: Number(values['status'] ?? 1) === 0 ? 0 : 1,
    notes: values['notes'] ?? null,
    days,
  };
}

// Work schedules of the Pulse timesheet: weekly (Monday..Sunday) or cycle (Day 1..N, e.g. 12x36).
// The generic form is flat, so the day grid is one field per mark mapped to the API `days` list.
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'WorkScheduleUUID',
  pageTitle: 'Work schedules',
  pageDescription:
    'Expected working hours of your employees, weekly or in cycles such as 12x36, used by the timesheet to compute lateness, overtime and absences.',
  createTitle: 'New work schedule',
  editTitle: 'Edit work schedule',
  searchPlaceholder: 'Name',
  emptyLabel: 'No work schedules found.',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    preset: '',
    name: '',
    kind: 'weekly',
    cycleLength: '',
    preAssignedBreak: false,
    notes: '',
  },
  columns: [
    {
      id: 'name',
      label: 'Name',
      field: 'Name',
      uuidField: 'WorkScheduleUUID',
      kind: 'identity',
      translateValue: false,
    },
    {
      id: 'kind',
      label: 'Kind',
      field: 'Kind',
      value: (row, t) =>
        row['Kind'] === 'cycle'
          ? `${t('Cycle')} · ${row['CycleLength']} ${t('days')}`
          : t('Weekly'),
    },
    {
      id: 'weekly',
      label: 'Weekly hours',
      field: 'WeeklyMinutes',
      value: (row) => formatMinutes(row['WeeklyMinutes']),
    },
    { id: 'assigned', label: 'Assigned employees', field: 'AssignedCount', kind: 'number' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
    { id: 'revision', label: 'Revision', field: 'Revision', kind: 'number', optional: true },
  ],
  fields: [
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    {
      key: 'preset',
      label: 'Template',
      type: 'select',
      options: PRESETS.map((preset) => ({ value: preset.value, label: preset.label })),
      help: 'Fills the kind and the day grid with a common Brazilian schedule; review the times before saving.',
    },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1, breakBefore: true },
    {
      key: 'kind',
      source: 'Kind',
      label: 'Kind',
      type: 'select',
      options: KINDS,
      required: true,
      help: 'Weekly: the same times every week (Monday to Sunday). Cycle: a sequence of 2 to 7 days that repeats, such as 12x36 (work one day, rest the next).',
      span: 1,
    },
    {
      key: 'cycleLength',
      source: 'CycleLength',
      label: 'Cycle length (days)',
      type: 'select',
      options: CYCLE_LENGTHS,
      translateOptions: false,
      requiredWhen: ({ values }) => values['kind'] === 'cycle',
      hiddenWhen: ({ values }) => values['kind'] !== 'cycle',
      fromRecord: (value, row) => (row['Kind'] === 'cycle' ? Number(value) : ''),
      span: 1,
    },
    {
      key: 'preAssignedBreak',
      source: 'PreAssignedBreak',
      label: 'Pre-assigned break',
      type: 'select',
      options: YES_NO,
      help: 'CLT art. 74 §2: with only two marks a day (clock in and clock out), the scheduled break is deducted as if it had been punched.',
      breakBefore: true,
    },
    ...DAY_FIELDS,
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  fieldChange: (key, value, current) =>
    key === 'preset' ? applySchedulePreset(value, current) : current,
  payload: (values) => workSchedulePayload(values),
});

@Component({
  selector: 'app-hr-work-schedules',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrWorkSchedulesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  /** Day fields read `Monday · Start` (weekly) or `Day 2 · Break end` (cycle). */
  override translatedFieldLabel(field: ConfigurableCrudField): string {
    const match = /^d([1-7])(Start|BreakStart|BreakEnd|End)$/.exec(field.key);
    if (!match) return super.translatedFieldLabel(field);
    const position = Number(match[1]);
    const day =
      this.formValues()['kind'] === 'cycle'
        ? this.t('Day {{ number }}', { number: position })
        : this.t(WEEKDAYS[position - 1]);
    return `${day} · ${this.t(field.label)}`;
  }

  /** The list carries the day grid; a row without it (older cache) loads the full record first. */
  override startEdit(row: ConfigurableCrudRecord): void {
    if (Array.isArray(row['Days']) && row['Days'].length) {
      super.startEdit(row);
      return;
    }
    void this.loadAndEdit(row);
  }

  private async loadAndEdit(row: ConfigurableCrudRecord): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { item?: ConfigurableCrudRecord } }>(
        `${ENDPOINT}/${row['WorkScheduleUUID']}`,
      );
      super.startEdit(response?.data?.item ?? row);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'Failed to load the work schedule.'));
    }
  }
}
