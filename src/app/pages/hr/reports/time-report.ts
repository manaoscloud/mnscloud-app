import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { formatMinutes } from '../hr-time';
import {
  REPORT_FILTERS,
  REPORT_IDENTITY_COLUMNS,
  REPORT_LIST_SETTINGS,
  reportFilterOptions,
  reportMonthOptions,
  resetReportMonth,
} from './hr-reports-shared';

export const TIME_REPORT_ORDERS: readonly ConfigurableCrudOption[] = [
  { value: 'overtime', label: 'Most overtime' },
  { value: 'absence', label: 'Most absences' },
  { value: 'late', label: 'Most lateness' },
  { value: 'name', label: 'Name' },
];

const minutes = (field: string, signed = false) => ({
  field,
  value: (row: Record<string, unknown>) => formatMinutes(row[field], signed),
});

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
    { id: 'expected', label: 'Expected', ...minutes('ExpectedMinutes') },
    { id: 'worked', label: 'Worked', ...minutes('WorkedMinutes') },
    { id: 'overtime', label: 'Overtime 50%', ...minutes('OvertimeMinutes') },
    { id: 'overtimeRest', label: 'Overtime 100%', ...minutes('OvertimeRestMinutes') },
    { id: 'late', label: 'Lates', ...minutes('LateMinutes') },
    { id: 'lateDays', label: 'Late days', field: 'LateDays', kind: 'number', optional: true },
    { id: 'earlyLeave', label: 'Early leaves', ...minutes('EarlyLeaveMinutes') },
    { id: 'absence', label: 'Absences', ...minutes('AbsenceMinutes') },
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
    { id: 'balance', label: 'Balance', ...minutes('BalanceMinutes', true) },
  ],
});

@Component({
  selector: 'app-hr-time-report',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimeReportPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly months = reportMonthOptions();

  constructor() {
    super(config);
    resetReportMonth(this);
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return reportFilterOptions(filter, this.months, () => super.listFilterOptions(filter));
  }

  override clearSearchFilters(): void {
    super.clearSearchFilters();
    resetReportMonth(this);
  }
}
