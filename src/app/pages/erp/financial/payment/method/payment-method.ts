import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';

/** Canonical payment method types (validated by the API and the database). */
export const PAYMENT_METHOD_TYPES: readonly ConfigurableCrudOption[] = [
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'pix', label: 'Pix' },
  { value: 'cash', label: 'Cash' },
  { value: 'boleto', label: 'Boleto' },
];
const statusOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export const paymentMethodConfig = defineCrud({
  serverSidePagination: true,
  endpoint: 'erp/financial/payment/methods',
  uuidField: 'ErpFinPayMethodUUID',
  pageTitle: 'Payment Methods',
  pageDescription: 'Ways your customers can pay, used by receivables and invoices.',
  createTitle: 'New payment method',
  editTitle: 'Edit payment method',
  searchPlaceholder: 'ID, name, code or type',
  emptyLabel: 'No payment methods found.',
  savedMessage: 'Payment method saved.',
  canDelete: true,
  bulkDelete: false,
  statusOptions,
  initialValues: { status: 1, type: 'card', name: '', code: '', notes: '' },
  fields: [
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'status',
      span: 1,
      options: statusOptions,
    },
    {
      key: 'type',
      source: 'Type',
      label: 'Type',
      type: 'select',
      span: 1,
      required: true,
      options: PAYMENT_METHOD_TYPES,
    },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
    { key: 'code', source: 'Code', label: 'Code', span: 1, autocomplete: 'off' },
    { key: 'notes', source: 'Notes', label: 'Notes', type: 'textarea', span: 4, rows: 3 },
  ],
  columns: [
    { id: 'id', label: 'ID', field: 'ErpFinPayMethodID', kind: 'text' },
    { id: 'name', label: 'Name', field: 'Name', kind: 'identity' },
    { id: 'type', label: 'Type', field: 'Type', options: PAYMENT_METHOD_TYPES },
    { id: 'code', label: 'Code', field: 'Code', kind: 'text' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ],
  payload: (values) => ({
    type: text(values['type']),
    name: text(values['name']),
    code: text(values['code']) || null,
    notes: text(values['notes']) || null,
    status: Number(values['status']) === 1 ? 1 : 0,
  }),
});

@Component({
  selector: 'app-finance-payment-method',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialPaymentMethodPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(paymentMethodConfig);
  }
}
