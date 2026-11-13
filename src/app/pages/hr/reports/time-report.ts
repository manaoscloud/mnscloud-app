import { Component, computed, inject } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AppI18nService } from '../../../services/app-i18n.service';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { currentMonth, formatMinutes, monthOptions } from '../hr-time';
import { MONTH_FILTER_KEY, REPORT_FILTERS } from './hr-reports-shared';

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
  listExport: true,
  endpoint: 'hr/reports/time',
  uuidField: 'RowKey',
  pageTitle: 'Time by location',
  pageDescription:
    'Month totals of the timesheets per employee and location: expected and worked hours, overtime at 50% and 100%, lateness, early leaves, absences and balance. Order by overtime, absences or lateness to see the rankings.',
  searchPlaceholder: 'Employee or registration number',
  emptyLabel: 'No time records found in the month.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {},
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
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'EmployeeUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'location', label: 'Location', field: 'LocationName', translateValue: false },
    {
      id: 'company',
      label: 'Company',
      field: 'CompanyName',
      translateValue: false,
      optional: true,
    },
    {
      id: 'registration',
      label: 'Registration',
      field: 'RegistrationNumber',
      translateValue: false,
      optional: true,
    },
    { id: 'days', label: 'Days', field: 'Days', kind: 'number' },
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
  fields: [],
});

@Component({
  selector: 'app-hr-time-report',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimeReportPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly i18n = inject(AppI18nService);
  private readonly months = computed(() => monthOptions(this.i18n.language()));

  constructor() {
    super(config);
    this.resetMonth();
  }

  /** The month filter always has a value and offers localized month names. */
  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return filter.key === MONTH_FILTER_KEY ? this.months() : super.listFilterOptions(filter);
  }

  /** Clearing the filters keeps the current month. */
  override clearSearchFilters(): void {
    super.clearSearchFilters();
    this.resetMonth();
  }

  private resetMonth(): void {
    const month = currentMonth();
    this.listFilterValues.update((values) => ({ ...values, [MONTH_FILTER_KEY]: month }));
    this.appliedFilters.update((filters) => ({
      ...filters,
      extra: { ...filters.extra, [MONTH_FILTER_KEY]: month },
    }));
  }
}
