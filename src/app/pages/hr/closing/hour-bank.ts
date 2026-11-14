import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { currentMonth, formatDay, formatMinutes, monthOptions } from '../hr-time';
import {
  REPORT_FILTERS,
  REPORT_LIST_SETTINGS,
  REPORT_PERSON_COLUMNS,
  minutesColumn,
} from '../reports/hr-reports-shared';
import { BANK_ENTRY_KINDS, monthText, parseDuration, uiLocale } from './closing-shared';

const DEBIT_KINDS = ['debit', 'expire_paid', 'manual_paid'];

const entryChip = (value: unknown) =>
  value === 'credit' ? 'chip-success' : value === 'debit' ? 'chip-warning' : 'chip-running';

/** Ledger of one employee, newest month first; read only. */
function ledgerConfig(row: ConfigurableCrudRecord) {
  return defineCrud({
    endpoint: 'hr/hour-bank/entries',
    uuidField: 'EntryUUID',
    listQuery: { employeeUUID: String(row['EmployeeUUID'] ?? '') },
    pageTitle: 'Hour bank ledger',
    pageDescription: String(row['EmployeeName'] ?? ''),
    emptyLabel: 'No hour bank entries found.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    initialPageSize: 25,
    fields: [],
    columns: [
      { id: 'month', label: 'Month', field: 'MonthKey', value: (r) => monthText(r['MonthKey']) },
      {
        id: 'kind',
        label: 'Entry',
        field: 'Kind',
        kind: 'status',
        options: BANK_ENTRY_KINDS,
        chipClass: entryChip,
      },
      {
        id: 'minutes',
        label: 'Hours',
        field: 'Minutes',
        value: (r) =>
          formatMinutes(
            Number(r['Minutes'] ?? 0) * (DEBIT_KINDS.includes(String(r['Kind'])) ? -1 : 1),
            true,
          ),
      },
      {
        id: 'expiresOn',
        label: 'Expires on',
        field: 'ExpiresOn',
        value: (r) => (r['ExpiresOn'] ? formatDay(r['ExpiresOn']) : '—'),
      },
      minutesColumn('consumed', 'Compensated', 'ConsumedMinutes'),
      { id: 'reason', label: 'Reason', field: 'Reason', translateValue: false },
      { id: 'created', label: 'Recorded at', field: 'DateCreated', kind: 'datetime' },
    ],
  });
}

/** Manual payment of bank minutes in an open month; the reason is audited. */
function paymentConfig(row: ConfigurableCrudRecord) {
  return defineCrud({
    endpoint: 'hr/hour-bank/payments',
    uuidField: 'EntryUUID',
    pageTitle: 'Register payment',
    pageDescription:
      'Pays hour bank minutes in an open month. The balance falls by the minutes paid and the payment appears in the closing of that month.',
    createTitle: 'Register payment',
    dialogDescription:
      'The minutes leave the hour bank balance and are paid as overtime in the month chosen, which must still be open.',
    savedMessage: 'Payment registered.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    columns: [],
    initialValues: {
      employee: String(row['EmployeeName'] ?? ''),
      month: currentMonth(),
      minutes: '',
      reason: '',
    },
    fields: [
      { key: 'employee', label: 'Employee', disabledWhen: () => true },
      {
        key: 'month',
        label: 'Month',
        type: 'select',
        options: monthOptions(uiLocale()),
        translateOptions: false,
        required: true,
        help: 'The month in which the minutes are paid. A closed month must be reopened first.',
      },
      {
        key: 'minutes',
        label: 'Hours to pay',
        required: true,
        placeholder: '02:30',
        help: 'Hours and minutes (02:30) or hours with decimals (2,5). It cannot exceed the balance.',
      },
      { key: 'reason', label: 'Reason', type: 'textarea', required: true, span: 4, rows: 4 },
    ],
    payload: (values) => ({
      employeeUUID: row['EmployeeUUID'],
      month: values['month'],
      minutes: parseDuration(values['minutes']),
      reason: String(values['reason'] ?? '').trim(),
    }),
  });
}

// Hour bank balance per employee (credits - debits - payments), with its ledger and the manual
// payment of minutes. The closing of each month posts the entries; payment mode policies have none.
const config = defineCrud({
  ...REPORT_LIST_SETTINGS,
  endpoint: 'hr/hour-bank',
  pageTitle: 'Hour bank',
  pageDescription:
    'Hour bank balance per employee: credits of overtime, debits of lateness and absences, payments and the next expiry. Open the ledger of an employee or register a payment of minutes.',
  emptyLabel: 'No hour bank balances found.',
  listFilters: REPORT_FILTERS.slice(1),
  rowActions: [
    { key: 'ledger', label: 'Ledger', icon: 'receipt_long', collection: ledgerConfig },
    { key: 'payment', label: 'Register payment', icon: 'payments', form: paymentConfig },
  ],
  columns: [
    ...REPORT_PERSON_COLUMNS,
    minutesColumn('credit', 'Credits', 'CreditMinutes'),
    minutesColumn('debit', 'Debits', 'DebitMinutes'),
    minutesColumn('paid', 'Paid', 'PaidMinutes'),
    minutesColumn('balance', 'Balance', 'BalanceMinutes', true),
    {
      id: 'nextExpiry',
      label: 'Next expiry',
      field: 'NextExpiresOn',
      value: (row) => (row['NextExpiresOn'] ? formatDay(row['NextExpiresOn']) : '—'),
    },
  ],
});

@Component({
  selector: 'app-hr-hour-bank',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrHourBankPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
