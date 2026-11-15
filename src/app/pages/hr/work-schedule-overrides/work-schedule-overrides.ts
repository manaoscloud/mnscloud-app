import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { formatDay, hhmm } from '../hr-time';
import { HR_EMPLOYEE_LOOKUP } from '../hr-crud-shared';

const KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'work', label: 'Work shift' },
  { value: 'off', label: 'Day off' },
];

const SOURCES: readonly ConfigurableCrudOption[] = [
  { value: 'manual', label: 'Recorded by HR' },
  { value: 'swap', label: 'Shift swap' },
];

/** Longest reason the API accepts. */
const REASON_MAX = 500;

const isOff = ({ values }: { values: ConfigurableCrudRecord }) => values['kind'] !== 'work';

/** Time mark of the shift: required for a work day, hidden for a day off. */
function timeField(
  key: string,
  label: string,
  required: boolean,
  extra: Partial<ConfigurableCrudField> = {},
): ConfigurableCrudField {
  return {
    key,
    label,
    type: 'time',
    span: 1,
    hiddenWhen: isOff,
    ...(required ? { requiredWhen: ({ values }) => values['kind'] === 'work' } : {}),
    ...extra,
  };
}

/** `08:00 – 12:00 / 13:00 – 17:00` style summary of the shift of a work exception. */
function shiftText(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  if (row['Kind'] !== 'work') return t('Day off');
  const [start, breakStart, breakEnd, end] = ['Start', 'BreakStart', 'BreakEnd', 'End'].map((key) =>
    hhmm(row[key]),
  );
  return breakStart && breakEnd
    ? `${start} – ${breakStart} / ${breakEnd} – ${end}`
    : `${start} – ${end}`;
}

// Per-day exceptions of the planned schedule: a day off or a different shift for one employee on
// one date. Records are immutable (delete and create again); swap exceptions are written by the
// approval of a shift swap request.
const config = defineCrud({
  listExport: true,
  endpoint: 'hr/work-schedule-overrides',
  uuidField: 'OverrideUUID',
  pageTitle: 'Schedule exceptions',
  pageDescription:
    'A day off or a different shift for one employee on one date, replacing the planned schedule of that day. Shift swaps approved in Requests create their exceptions here. Closed months cannot be changed.',
  createTitle: 'New schedule exception',
  emptyLabel: 'No schedule exceptions found.',
  searchPlaceholder: 'Employee or reason',
  savedMessage: 'Schedule exception saved.',
  canEdit: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {
    employeeUUID: '',
    date: '',
    kind: 'work',
    start: '',
    breakStart: '',
    breakEnd: '',
    end: '',
    reason: '',
  },
  listFilters: [
    {
      key: 'employeeUUID',
      paramKey: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: HR_EMPLOYEE_LOOKUP,
    },
    {
      key: 'source',
      paramKey: 'source',
      label: 'Origin',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: SOURCES,
    },
  ],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'OverrideUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'date', label: 'Date', field: 'Date', value: (row) => formatDay(row['Date'], true) },
    { id: 'kind', label: 'Kind', field: 'Kind', options: KINDS },
    { id: 'shift', label: 'Shift', field: 'Start', value: (row, t) => shiftText(row, t) },
    { id: 'source', label: 'Origin', field: 'Source', options: SOURCES },
    { id: 'reason', label: 'Reason', field: 'Reason', translateValue: false },
    { id: 'createdBy', label: 'Created by', field: 'CreatedByName', translateValue: false },
  ],
  fields: [
    {
      key: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      remoteLookup: HR_EMPLOYEE_LOOKUP,
      quickCreate: quickCreateFor('RegEmployeeRemUUID'),
      required: true,
      span: 1,
    },
    { key: 'date', label: 'Date', type: 'date', required: true, span: 1 },
    {
      key: 'kind',
      label: 'Kind',
      type: 'select',
      options: KINDS,
      required: true,
      help: 'It replaces the planned day of the employee on that date. Holidays keep their own rule.',
      span: 1,
    },
    timeField('start', 'Start', true, {
      breakBefore: true,
      help: 'An end earlier than the start finishes the next day; the break must be inside the shift.',
    }),
    timeField('breakStart', 'Break start', false),
    timeField('breakEnd', 'Break end', false),
    timeField('end', 'End', true),
    {
      key: 'reason',
      label: 'Reason',
      type: 'textarea',
      required: true,
      help: 'Up to 500 characters.',
      span: 4,
      rows: 4,
      breakBefore: true,
    },
  ],
  payload: (values) => {
    const work = values['kind'] === 'work';
    return {
      employeeUUID: values['employeeUUID'],
      date: values['date'],
      kind: work ? 'work' : 'off',
      ...(work
        ? {
            start: hhmm(values['start']),
            breakStart: hhmm(values['breakStart']) || null,
            breakEnd: hhmm(values['breakEnd']) || null,
            end: hhmm(values['end']),
          }
        : {}),
      reason: String(values['reason'] ?? '').trim(),
    };
  },
});

@Component({
  selector: 'app-hr-work-schedule-overrides',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrWorkScheduleOverridesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  /** The API refuses a reason above 500 characters; say so on the field before sending. */
  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (String(payload['reason'] ?? '').length > REASON_MAX) {
      return this.rejectField('reason', 'The reason can have at most 500 characters.');
    }
    return super.validatePayload(payload);
  }
}
