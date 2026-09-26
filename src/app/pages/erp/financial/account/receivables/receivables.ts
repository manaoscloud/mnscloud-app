import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../../../shared/crud/configurable-crud/quick-create';

const statuses = [
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'canceled', label: 'Canceled' },
];

const config = defineCrud({
  endpoint: 'erp/financial/accounts/receivables',
  uuidField: 'ErpFinAccReceivableUUID',
  pageTitle: 'Accounts Receivable',
  pageDescription: 'Track incoming payments and outstanding customer invoices.',
  bulkDelete: true,
  statusMode: 'string',
  activeValue: 'open',
  inactiveValue: 'canceled',
  statusOptions: statuses,
  activeStatusValues: ['open', 'paid'],
  initialValues: {
    status: 'open',
    customerUUID: '',
    description: '',
    docNumber: '',
    dueDate: null,
    amount: 0,
    notes: '',
  },
  columns: [
    {
      id: 'description',
      label: 'Description',
      field: 'Description',
      uuidField: 'ErpFinAccReceivableUUID',
      kind: 'identity',
    },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'docNumber', label: 'Document number', field: 'DocNumber' },
    { id: 'dueDate', label: 'Due date', field: 'DueDate', kind: 'date' },
    { id: 'amount', label: 'Amount', field: 'Amount', kind: 'currency' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'status',
      options: statuses,
      span: 1,
    },
    {
      key: 'customerUUID',
      source: 'CustomerUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'erp/customers',
        searchParam: 'q',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
      quickCreate: quickCreateFor('CustomerCusUUID'),
      span: 1,
    },
    { key: 'description', source: 'Description', label: 'Description', required: true, span: 2 },
    { key: 'docNumber', source: 'DocNumber', label: 'Document number', span: 1 },
    { key: 'dueDate', source: 'DueDate', label: 'Due date', type: 'date', required: true, span: 1 },
    { key: 'amount', source: 'Amount', label: 'Amount', type: 'currency', required: true, span: 1 },
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
});

@Component({
  selector: 'app-financial-receivables',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialReceivablesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (Number(payload['amount']) > 0) return super.validatePayload(payload);
    this.snack.warning(this.t('Amount must be greater than zero.'));
    return false;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      docNumber: payload['docNumber'] || null,
      notes: payload['notes'] || null,
      amount: Number(payload['amount']),
    };
  }
}
