import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  HrMonthListPage,
  REPORT_FILTERS,
  REPORT_IDENTITY_COLUMNS,
  REPORT_LIST_SETTINGS,
  minutesColumn,
} from './hr-reports-shared';

export const TIME_REPORT_ORDERS: readonly ConfigurableCrudOption[] = [
  { value: 'overtime', label: 'Most overtime' },
  { value: 'absence', label: 'Most absences' },
  { value: 'late', label: 'Most lateness' },
  { value: 'name', label: 'Name' },
];

// Month totals of the timesheets per employee, grouped by location, with the rankings (overtime,
// absences, lateness). Read-only: the employee timesheet holds the day detail.
const config = defineCrud({
  ...REPORT_LIST_SETTINGS,
  endpoint: 'hr/reports/time',
  pageTitle: 'Time by location',
  pageDescription:
    'Month totals of the timesheets per employee and location: expected and worked hours, overtime at 50% and 100%, lateness, early leaves, absences and balance. Order by overtime, absences or lateness to see the rankings.',
  emptyLabel: 'No time records found in the month.',
  listFilters: [
    ...REPORT_FILTERS,
    {
      key: 'order',
      paramKey: 'order',
      label: 'Order by',
      type: 'select',
      span: 1,
      emptyLabel: 'Name',
      translateOptions: true,
      options: TIME_REPORT_ORDERS.slice(0, 3),
    },
  ],
  columns: [
    ...REPORT_IDENTITY_COLUMNS,
    minutesColumn('expected', 'Expected', 'ExpectedMinutes'),
    minutesColumn('worked', 'Worked', 'WorkedMinutes'),
    minutesColumn('overtime', 'Overtime 50%', 'OvertimeMinutes'),
    minutesColumn('overtimeRest', 'Overtime 100%', 'OvertimeRestMinutes'),
    minutesColumn('late', 'Lates', 'LateMinutes'),
    { id: 'lateDays', label: 'Late days', field: 'LateDays', kind: 'number', optional: true },
    minutesColumn('earlyLeave', 'Early leaves', 'EarlyLeaveMinutes'),
    minutesColumn('absence', 'Absences', 'AbsenceMinutes'),
    {
      id: 'absenceDays',
      label: 'Absence days',
      field: 'AbsenceDays',
      kind: 'number',
      optional: true,
    },
    {
      id: 'excusedDays',
      label: 'Excused days',
      field: 'ExcusedDays',
      kind: 'number',
      optional: true,
    },
    minutesColumn('balance', 'Balance', 'BalanceMinutes', true),
  ],
});

@Component({
  selector: 'app-hr-time-report',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimeReportPage extends HrMonthListPage {
  constructor() {
    super(config);
  }
}
