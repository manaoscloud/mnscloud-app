import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const days = Array.from({ length: 31 }, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
}));
const closedMonthOptions = [
  { value: 0, label: 'Starting cycle (prepaid)' },
  { value: 1, label: 'Closed month (postpaid)' },
];

const config = defineCrud({
  endpoint: 'customer-billing/due-days',
  uuidField: 'BddUUID',
  pageTitle: 'Due-day rules',
  pageDescription:
    'Fixed due day, billing day and closed month that contracts can follow: their cycles follow the calendar month, are issued on the billing day and fall due on the fixed day.',
  createTitle: 'New due-day rule',
  editTitle: 'Edit due-day rule',
  searchPlaceholder: 'Search rules',
  bulkDelete: false,
  serverSidePagination: true,
  canDeleteRow: (row) => Number(row['ContractCount'] ?? 0) === 0,
  initialValues: { status: 1, name: '', dueDay: 10, billingDay: 1, closedMonth: 0 },
  columns: [
    { id: 'name', label: 'Name', field: 'BddName', uuidField: 'BddUUID', kind: 'identity' },
    { id: 'dueDay', label: 'Due day', field: 'BddDueDay', kind: 'number' },
    { id: 'billingDay', label: 'Billing day', field: 'BddBillingDay', kind: 'number' },
    {
      id: 'closedMonth',
      label: 'Cycle billed',
      field: 'BddClosedMonth',
      options: closedMonthOptions,
    },
    { id: 'contracts', label: 'Contracts', field: 'ContractCount', kind: 'number' },
    { id: 'status', label: 'Status', field: 'BddStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'BddStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'BddName', label: 'Name', required: true, span: 1 },
    {
      key: 'dueDay',
      source: 'BddDueDay',
      label: 'Due day',
      type: 'select',
      options: days,
      translateOptions: false,
      required: true,
      help: 'Months shorter than this day fall due on their last day.',
      span: 1,
    },
    {
      key: 'billingDay',
      source: 'BddBillingDay',
      label: 'Billing day',
      type: 'select',
      options: days,
      translateOptions: false,
      required: true,
      help: 'Day the charge is issued: in the month of the due date, or in the month before when it comes after the due day.',
      span: 1,
    },
    {
      key: 'closedMonth',
      source: 'BddClosedMonth',
      fromRecord: (value) => (Number(value) === 1 ? 1 : 0),
      label: 'Cycle billed',
      type: 'select',
      options: closedMonthOptions,
      required: true,
      help: 'Closed month bills the cycle after it ends, with the usage measured in it.',
    },
  ],
  payload: (values) => ({
    name: values['name'],
    dueDay: Number(values['dueDay']),
    billingDay: Number(values['billingDay']),
    closedMonth: Number(values['closedMonth']) === 1 ? 1 : 0,
    status: Number(values['status']) === 0 ? 0 : 1,
  }),
});

@Component({
  selector: 'app-customer-billing-due-days',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CustomerBillingDueDaysPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
