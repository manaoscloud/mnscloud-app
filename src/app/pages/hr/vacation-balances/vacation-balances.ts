import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { formatDay } from '../hr-time';

const PERIOD_STATUSES: readonly ConfigurableCrudOption[] = [
  { value: 'accruing', label: 'Accruing' },
  { value: 'available', label: 'Available' },
  { value: 'used', label: 'Taken' },
  { value: 'overdue', label: 'Overdue' },
];

const PERIODS: ConfigurableCrudRowAction = {
  key: 'periods',
  label: 'Acquisition periods',
  icon: 'date_range',
};

// Vacation balance of each employee (F6, read only): CLT acquisition periods of 12 months from the
// hire date, 30 days for each completed one, the deadline to take them, vacations taken (absences
// of type Vacation) and days in pending vacation requests. Employees request vacation in Pulse
// within this balance; HR decides in Requests.
const config = defineCrud({
  endpoint: 'hr/vacation-balances',
  uuidField: 'EmployeeUUID',
  pageTitle: 'Vacation',
  pageDescription:
    'Vacation balance of each employee by acquisition period, from the hire date in Registry. Requests are decided in Requests and become absences of type Vacation.',
  searchPlaceholder: 'Employee',
  emptyLabel: 'No employees found.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {},
  rowActions: [PERIODS],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'EmployeeUUID',
      kind: 'identity',
      translateValue: false,
      rowAction: 'periods',
    },
    { id: 'company', label: 'Company', field: 'CompanyName', translateValue: false },
    {
      id: 'hire',
      label: 'Hire date',
      value: (row, t) => (row['HireDate'] ? formatDay(row['HireDate']) : t('Not registered')),
    },
    { id: 'available', label: 'Days available', field: 'AvailableDays', kind: 'number' },
    { id: 'pending', label: 'Days requested', field: 'PendingDays', kind: 'number' },
    { id: 'accruing', label: 'Proportional days', field: 'AccruingDays', kind: 'number' },
    { id: 'deadline', label: 'Take by', value: (row) => formatDay(row['NextDeadline']) },
    { id: 'overdue', label: 'Overdue', value: (row, t) => (row['Overdue'] ? t('Yes') : t('No')) },
    { id: 'taken', label: 'Days taken', field: 'TakenDays', kind: 'number', optional: true },
  ],
  fields: [],
});

@Component({
  selector: 'app-hr-vacation-balances',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrVacationBalancesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== PERIODS.key) return;
    const periods = Array.isArray(row['Periods'])
      ? (row['Periods'] as Record<string, unknown>[])
      : [];
    openDataViewerDialog(this.dialog, {
      title: 'Acquisition periods',
      description:
        'Each completed period of 12 months gives 30 days, to be taken within the next 12 months.',
      details: [
        { label: 'Employee', value: row['EmployeeName'] ?? '', translate: false },
        {
          label: 'Hire date',
          value: row['HireDate'] ? formatDay(row['HireDate']) : this.t('Not registered'),
          translate: false,
        },
        { label: 'Days available', value: String(row['AvailableDays'] ?? 0), translate: false },
        { label: 'Days requested', value: String(row['PendingDays'] ?? 0), translate: false },
      ],
      sections: [
        {
          title: 'Periods',
          table: {
            columns: [
              { key: 'period', label: 'Period', translate: false },
              { key: 'deadline', label: 'Take by', translate: false },
              { key: 'days', label: 'Days taken', translate: false },
              { key: 'status', label: 'Status' },
            ],
            rows: [...periods].reverse().map((p) => ({
              period: `${formatDay(p['start'])} – ${formatDay(p['end'])}`,
              deadline: formatDay(p['deadline']),
              days: `${p['takenDays'] ?? 0} / ${p['entitledDays'] ?? 0}`,
              status: PERIOD_STATUSES.find((s) => s.value === p['status'])?.label ?? '',
            })),
            emptyLabel: 'Register the hire date of the employee in Registry.',
          },
        },
      ],
    });
  }
}
