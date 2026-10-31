import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { formatDay } from '../hr-time';

const EMPLOYEE_LOOKUP = {
  endpoint: 'hr/employees',
  uuidField: 'RemUUID',
  labelField: 'RemName',
  selectedLabelField: 'EmployeeName',
};

const SCHEDULE_LOOKUP = {
  endpoint: 'hr/work-schedules?status=1',
  uuidField: 'WorkScheduleUUID',
  labelField: 'Name',
  selectedLabelField: 'WorkScheduleName',
};

// Which work schedule each employee follows and since when; the timesheet uses the assignment
// valid on each day. Cycle schedules (12x36) count their days from the cycle anchor date.
const config = defineCrud({
  endpoint: 'hr/work-schedule-assignments',
  uuidField: 'AssignmentUUID',
  pageTitle: 'Schedule assignments',
  pageDescription:
    'Which work schedule each employee follows and from when; the timesheet compares the punches of each day with the schedule assigned on that day.',
  createTitle: 'New schedule assignment',
  editTitle: 'Edit schedule assignment',
  searchPlaceholder: 'Employee or schedule',
  emptyLabel: 'No schedule assignments found.',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: {
    employeeUUID: '',
    workScheduleUUID: '',
    workScheduleKind: '',
    startDate: '',
    endDate: '',
    cycleAnchorDate: '',
    notes: '',
  },
  listFilters: [
    {
      key: 'employeeUUID',
      paramKey: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: EMPLOYEE_LOOKUP,
    },
    {
      key: 'workScheduleUUID',
      paramKey: 'workScheduleUUID',
      label: 'Work schedule',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: SCHEDULE_LOOKUP,
    },
  ],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'AssignmentUUID',
      kind: 'identity',
      translateValue: false,
    },
    {
      id: 'schedule',
      label: 'Work schedule',
      field: 'WorkScheduleName',
      uuidField: 'WorkScheduleUUID',
      kind: 'related',
      translateValue: false,
    },
    {
      id: 'start',
      label: 'Start date',
      field: 'StartDate',
      value: (row) => formatDay(row['StartDate']),
    },
    {
      id: 'end',
      label: 'End date',
      field: 'EndDate',
      value: (row, t) => (row['EndDate'] ? formatDay(row['EndDate']) : t('No end')),
    },
    { id: 'current', label: 'Current', field: 'Current', kind: 'boolean' },
    {
      id: 'anchor',
      label: 'Cycle anchor date',
      field: 'CycleAnchorDate',
      value: (row) => (row['CycleAnchorDate'] ? formatDay(row['CycleAnchorDate']) : '—'),
      optional: true,
    },
  ],
  fields: [
    {
      key: 'employeeUUID',
      source: 'EmployeeUUID',
      label: 'Employee',
      type: 'search-select',
      required: true,
      remoteLookup: EMPLOYEE_LOOKUP,
      quickCreate: quickCreateFor('RegEmployeeRemUUID'),
    },
    {
      key: 'workScheduleUUID',
      source: 'WorkScheduleUUID',
      label: 'Work schedule',
      type: 'search-select',
      required: true,
      remoteLookup: SCHEDULE_LOOKUP,
      quickCreate: quickCreateFor('HrWorkScheduleHwsUUID'),
    },
    { key: 'workScheduleKind', source: 'WorkScheduleKind', label: 'Kind', hidden: true },
    {
      key: 'startDate',
      source: 'StartDate',
      label: 'Start date',
      type: 'date',
      required: true,
      span: 1,
      breakBefore: true,
    },
    {
      key: 'endDate',
      source: 'EndDate',
      label: 'End date',
      type: 'date',
      help: 'Leave empty while the employee keeps this schedule. A new assignment must start after the previous one ends.',
      span: 1,
    },
    {
      key: 'cycleAnchorDate',
      source: 'CycleAnchorDate',
      label: 'Cycle anchor date',
      type: 'date',
      help: 'Date of Day 1 of the cycle (for 12x36: a day the employee works). Empty uses the start date.',
      hiddenWhen: ({ values }) => values['workScheduleKind'] !== 'cycle',
      span: 1,
    },
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
  payload: (values) => ({
    employeeUUID: values['employeeUUID'],
    workScheduleUUID: values['workScheduleUUID'],
    startDate: values['startDate'],
    endDate: values['endDate'] || null,
    cycleAnchorDate:
      values['workScheduleKind'] === 'cycle' ? values['cycleAnchorDate'] || null : null,
    notes: values['notes'] ?? null,
  }),
});

@Component({
  selector: 'app-hr-work-schedule-assignments',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrWorkScheduleAssignmentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  /** The cycle anchor only applies to cycle schedules: read the kind of the chosen schedule. */
  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'workScheduleUUID') return;
    const uuid = String(value ?? '');
    if (!uuid) {
      this.patchFormValues({ workScheduleKind: '' });
      return;
    }
    void this.api
      .get<{ data?: { item?: ConfigurableCrudRecord } }>(`hr/work-schedules/${uuid}`, {
        silent: true,
      })
      .then((response) => {
        if (String(this.formValues()['workScheduleUUID'] ?? '') !== uuid) return;
        this.patchFormValues({ workScheduleKind: response?.data?.item?.['Kind'] ?? '' });
      })
      .catch(() => undefined);
  }
}
