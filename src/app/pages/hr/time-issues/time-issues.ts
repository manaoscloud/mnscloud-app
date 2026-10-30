import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilters,
  ConfigurableCrudListParams,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  DAY_KINDS,
  TIMESHEET_FLAGS,
  flagLabels,
  formatDay,
  formatMinutes,
  timesheetQuery,
} from '../hr-time';

const TIMESHEET_ACTION = 'timesheet';

// Days with inconsistencies (flags) computed by the timesheet engine, newest first. Read-only:
// treatment happens on the employee timesheet, opened from each row.
const config = defineCrud({
  endpoint: 'hr/time-issues',
  uuidField: 'IssueKey',
  pageTitle: 'Timesheet issues',
  pageDescription:
    'Days of your employees with inconsistencies found by the timesheet: absences, missing punches, lateness, short breaks, rest under 11 hours and overtime above the limit. Open the timesheet of a row to check its punches.',
  searchPlaceholder: 'Employee',
  emptyLabel: 'No issues found in the period.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {},
  listFilters: [
    {
      key: 'days',
      paramKey: 'days',
      label: 'Period',
      type: 'select',
      span: 1,
      emptyLabel: 'Last 30 days',
      options: [
        { value: '7', label: 'Last 7 days' },
        { value: '90', label: 'Last 90 days' },
      ],
    },
    {
      key: 'flag',
      paramKey: 'flag',
      label: 'Inconsistency',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: TIMESHEET_FLAGS,
    },
    {
      key: 'employeeUUID',
      paramKey: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: {
        endpoint: 'hr/employees',
        uuidField: 'RemUUID',
        labelField: 'RemName',
      },
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
    {
      id: 'date',
      label: 'Date',
      field: 'Date',
      value: (row) => formatDay(row['Date'], true),
      rowAction: TIMESHEET_ACTION,
    },
    { id: 'kind', label: 'Day', field: 'DayKind', options: DAY_KINDS },
    {
      id: 'flags',
      label: 'Inconsistencies',
      field: 'Flags',
      kind: 'status',
      value: (row, t) => flagLabels(row['Flags'], t),
      chipClass: () => 'chip-warning',
    },
    {
      id: 'expected',
      label: 'Expected',
      field: 'ExpectedMinutes',
      value: (row) => formatMinutes(row['ExpectedMinutes']),
    },
    {
      id: 'worked',
      label: 'Worked',
      field: 'WorkedMinutes',
      value: (row) => formatMinutes(row['WorkedMinutes']),
    },
    {
      id: 'balance',
      label: 'Balance',
      field: 'BalanceMinutes',
      value: (row) => formatMinutes(row['BalanceMinutes'], true),
    },
    {
      id: 'late',
      label: 'Late',
      field: 'LateMinutes',
      value: (row) => formatMinutes(row['LateMinutes']),
      optional: true,
    },
    { id: 'punches', label: 'Punches', field: 'PunchCount', kind: 'number' },
    {
      id: 'company',
      label: 'Company',
      field: 'CompanyName',
      translateValue: false,
      optional: true,
    },
  ],
  fields: [],
  rowActions: [
    {
      key: TIMESHEET_ACTION,
      label: 'Open timesheet',
      icon: 'event_note',
      tooltip: 'Timesheet of the employee in the month of this day',
    },
  ],
});

@Component({
  selector: 'app-hr-time-issues',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimeIssuesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly router = inject(Router);

  constructor() {
    super(config);
    // `?flag=` opens the list already filtered (links from the HR dashboard).
    const flag = inject(ActivatedRoute).snapshot.queryParamMap.get('flag') ?? '';
    if (TIMESHEET_FLAGS.some((option) => option.value === flag)) {
      this.listFilterValues.set({ flag });
      this.appliedFilters.update((filters) => ({ ...filters, extra: { flag } }));
    }
  }

  /** Issue rows are one employee day: their key is the employee and the date. */
  protected override async fetchItems(
    filters: ConfigurableCrudFilters | ConfigurableCrudListParams,
  ): Promise<ConfigurableCrudRecord[]> {
    const rows = await super.fetchItems(filters);
    return rows.map((row) => ({ ...row, IssueKey: `${row['EmployeeUUID']}:${row['Date']}` }));
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== TIMESHEET_ACTION) return;
    await this.router.navigate(['/hr/timesheets'], {
      queryParams: timesheetQuery(row['EmployeeUUID'], row['Date']),
      queryParamsHandling: 'merge',
    });
  }
}
