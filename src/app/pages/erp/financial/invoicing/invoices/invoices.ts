import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'paid', label: 'Paid' },
  { value: 'canceled', label: 'Canceled' },
];

const config = defineCrud({
  endpoint: 'erp/financial/invoicing/invoices',
  uuidField: 'ErpFinInvInvoiceUUID',
  pageTitle: 'Invoices',
  pageDescription: 'Track invoice issuance and status updates.',
  searchPlaceholder: 'Search invoices',
  bulkDelete: true,
  statusMode: 'string',
  activeValue: 'issued',
  inactiveValue: 'canceled',
  statusOptions: statuses,
  activeStatusValues: ['issued', 'paid'],
  initialValues: { status: 'draft', number: '', issueDate: null, amount: 0, notes: '' },
  columns: [
    {
      id: 'number',
      label: 'Number',
      field: 'Number',
      uuidField: 'ErpFinInvInvoiceUUID',
      kind: 'identity',
    },
    { id: 'issueDate', label: 'Issue date', field: 'IssueDate', kind: 'date' },
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
    { key: 'number', source: 'Number', label: 'Number', required: true, span: 1 },
    {
      key: 'issueDate',
      source: 'IssueDate',
      label: 'Issue date',
      type: 'date',
      required: true,
      span: 1,
    },
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
  selector: 'app-invoicing-invoices',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class InvoicingInvoicesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, amount: Number(payload['amount']), notes: payload['notes'] || null };
  }
}
