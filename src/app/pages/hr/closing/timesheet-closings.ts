import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ConfigurableCrudCollectionDialog } from '../../../shared/crud/configurable-crud/configurable-crud-collection-dialog';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { formatMinutes } from '../hr-time';
import {
  COMPANY_FILTER_LOOKUP,
  EMPLOYEE_FILTER_LOOKUP,
  HrMonthListPage,
  LOCATION_FILTER_LOOKUP,
  REPORT_FILTERS,
  REPORT_LIST_SETTINGS,
  REPORT_PERSON_COLUMNS,
  minutesColumn,
} from '../reports/hr-reports-shared';
import {
  CLOSING_ACKS,
  CLOSING_STATUSES,
  closeResultRows,
  monthText,
  previousMonth,
} from './closing-shared';

const EXEMPT = 'Selector of an existing record that scopes the closing; it is created elsewhere.';

const scopeField = (
  key: string,
  label: string,
  lookup: typeof COMPANY_FILTER_LOOKUP | typeof EMPLOYEE_FILTER_LOOKUP,
  help?: string,
) => ({
  key,
  label,
  type: 'search-select' as const,
  remoteLookup: lookup,
  quickCreate: false as const,
  quickCreateExemptReason: EXEMPT,
  ...(help ? { help } : {}),
});

/** Close month dialog: the month and, optionally, the scope of employees to close. */
function closeMonthConfig(months: readonly ConfigurableCrudOption[]) {
  const emptyScope = { companyUUID: '', locationUUID: '', employeeUUID: '' };
  return defineCrud({
    endpoint: 'hr/timesheet-closings',
    uuidField: 'ClosingUUID',
    pageTitle: 'Close month',
    pageDescription:
      'Freezes the timesheet of the month for every employee in scope. Employees with pending recalculations, pending requests or open days are skipped and listed with the reason.',
    createTitle: 'Close month',
    dialogDescription:
      'Choose the month and, optionally, a company, a location or one employee. Without a scope every employee of the account is closed. A month can only be closed after it has ended.',
    savedMessage: 'Closing finished.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    columns: [],
    initialValues: { month: previousMonth(), ...emptyScope },
    fields: [
      {
        key: 'month',
        label: 'Month',
        type: 'select',
        options: months,
        translateOptions: false,
        required: true,
      },
      scopeField('companyUUID', 'Company', COMPANY_FILTER_LOOKUP),
      scopeField('locationUUID', 'Location', LOCATION_FILTER_LOOKUP),
      scopeField(
        'employeeUUID',
        'Employee',
        EMPLOYEE_FILTER_LOOKUP,
        'Empty closes every employee that matches the company and location.',
      ),
    ],
    payload: (values) => ({
      month: values['month'],
      companyUUID: values['companyUUID'] || null,
      locationUUID: values['locationUUID'] || null,
      employeeUUID: values['employeeUUID'] || null,
    }),
  });
}

/** Reopen dialog of one closing: the reason is audited. */
function reopenConfig(row: ConfigurableCrudRecord) {
  return defineCrud({
    endpoint: `hr/timesheet-closings/${row['ClosingUUID']}/reopen`,
    uuidField: 'ClosingUUID',
    pageTitle: 'Reopen closing',
    pageDescription:
      'Reopens the latest closed month of the employee: the month is recalculated, the hour bank entries of this closing are removed and the acknowledgement is cleared.',
    createTitle: 'Reopen closing',
    dialogDescription:
      'The month is recalculated, the hour bank entries of this closing are removed and the acknowledgement is cleared. Only the latest closed month of an employee can be reopened.',
    savedMessage: 'Closing reopened.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    columns: [],
    initialValues: { reason: '' },
    fields: [
      { key: 'reason', label: 'Reason', type: 'textarea', required: true, span: 4, rows: 4 },
    ],
    payload: (values) => ({ reason: String(values['reason'] ?? '').trim() }),
  });
}

const statusChip = (value: unknown) => (value === 'closed' ? 'chip-success' : 'chip-warning');

const isClosed = (row: ConfigurableCrudRecord) => row['Status'] === 'closed';

// Month closings per employee: the frozen totals, DSR, hour bank and the employee's
// acknowledgement. HR closes a month for a scope and reopens the latest closed month of an employee.
const config = defineCrud({
  ...REPORT_LIST_SETTINGS,
  uuidField: 'ClosingUUID',
  endpoint: 'hr/timesheet-closings',
  pageTitle: 'Timesheet closing',
  pageDescription:
    'Monthly closing of the timesheets: the totals frozen per employee, the weekly rest (DSR) lost, the hour bank and the employee acknowledgement. Close a month for a company, a location or one employee, and reopen the latest closed month with a reason.',
  emptyLabel: 'No closings found in the month.',
  listFilters: [
    ...REPORT_FILTERS,
    {
      key: 'status',
      paramKey: 'status',
      label: 'Status',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: CLOSING_STATUSES,
    },
    {
      key: 'ack',
      paramKey: 'ack',
      label: 'Acknowledgement',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: CLOSING_ACKS,
    },
  ],
  filterActions: [
    {
      key: 'close',
      label: 'Close month',
      icon: 'lock',
      tooltip: 'Close the timesheets of a month for a company, a location or one employee.',
    },
  ],
  rowActions: [
    {
      key: 'reopen',
      label: 'Reopen closing',
      icon: 'lock_open',
      visible: isClosed,
      form: reopenConfig,
    },
  ],
  columns: [
    ...REPORT_PERSON_COLUMNS,
    { id: 'month', label: 'Month', field: 'MonthKey', value: (row) => monthText(row['MonthKey']) },
    minutesColumn('worked', 'Worked', 'WorkedMinutes'),
    minutesColumn('overtime', 'Overtime 50%', 'OvertimeMinutes'),
    minutesColumn('overtimeRest', 'Overtime 100%', 'OvertimeRestMinutes'),
    { id: 'absenceDays', label: 'Absence days', field: 'AbsenceDays', kind: 'number' },
    { id: 'dsrLost', label: 'DSR lost', field: 'DsrLostDays', kind: 'number' },
    {
      id: 'bankBalance',
      label: 'Hour bank balance',
      field: 'BankBalanceMinutes',
      value: (row) =>
        row['BankBalanceMinutes'] === null ? '—' : formatMinutes(row['BankBalanceMinutes'], true),
    },
    {
      id: 'status',
      label: 'Status',
      field: 'Status',
      kind: 'status',
      options: CLOSING_STATUSES,
      chipClass: statusChip,
    },
    {
      id: 'ack',
      label: 'Acknowledgement',
      field: 'Acknowledged',
      kind: 'status',
      value: (row, t) =>
        !isClosed(row)
          ? '—'
          : t(row['Acknowledged'] ? 'Employee acknowledged' : 'Awaiting acknowledgement'),
      chipClass: (_value, row) =>
        !isClosed(row) ? 'chip-skipped' : row['Acknowledged'] ? 'chip-success' : 'chip-warning',
    },
    minutesColumn('balance', 'Balance', 'BalanceMinutes', true, true),
    minutesColumn('night', 'Night hours', 'NightMinutes', false, true),
    {
      id: 'flags',
      label: 'Inconsistencies',
      field: 'Flags',
      optional: true,
      value: (row, t) =>
        Array.isArray(row['Flags']) && row['Flags'].includes('monthly_limit')
          ? t('Above the monthly limit')
          : '—',
    },
    { id: 'closedAt', label: 'Closed on', field: 'ClosedAt', kind: 'datetime', optional: true },
    {
      id: 'reopenReason',
      label: 'Reopen reason',
      field: 'ReopenReason',
      translateValue: false,
      optional: true,
    },
  ],
});

/** Close month dialog that shows what happened to each employee once the API answered. */
@Component({
  selector: 'app-hr-close-month-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrCloseMonthDialog extends ConfigurableCrudCollectionDialog {
  protected override afterSave(context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>) {
    const answer = (context.response as { data?: ConfigurableCrudRecord } | null)?.data;
    if (!answer) return;
    const t = (key: string) => this.transloco.translate(key);
    const closed = t('Month closed');
    const rows = closeResultRows(answer['items'], t).sort(
      (a, b) => Number(a.result === closed) - Number(b.result === closed),
    );
    openDataViewerDialog(this.dialog, {
      title: 'Closing result',
      description:
        'Employees skipped keep their month open: fix the reason and close the month again.',
      details: [
        { label: 'Month', value: monthText(answer['MonthKey']), translate: false },
        { label: 'Closed employees', value: answer['Closed'], translate: false },
        { label: 'Skipped employees', value: answer['Skipped'], translate: false },
      ],
      sections: [
        {
          title: 'Employees',
          table: {
            emptyLabel: 'No employees found in the scope.',
            columns: [
              { key: 'name', label: 'Employee', translate: false },
              { key: 'result', label: 'Result', translate: false },
              { key: 'reason', label: 'Reason', translate: false },
            ],
            rows,
          },
        },
      ],
    });
  }
}

@Component({
  selector: 'app-hr-timesheet-closings',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimesheetClosingsPage extends HrMonthListPage {
  constructor() {
    super(config, previousMonth);
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== 'close') return;
    await this.openFormOnlyDialog(closeMonthConfig(this.months()), HrCloseMonthDialog);
  }
}
