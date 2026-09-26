import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'canceled', label: 'Canceled' },
];

// Quotation items are a full child CRUD; the database recalculates the quotation totals
// whenever an item is created, updated or deleted.
function items(quotation: ConfigurableCrudRecord) {
  const quotationUUID = String(quotation['SqtUUID']);
  return defineCrud({
    endpoint: `sale/quotations/${quotationUUID}/items`,
    uuidField: 'SqiUUID',
    pageTitle: 'Items',
    pageDescription: 'Add products and pricing details.',
    bulkDelete: false,
    statusFilter: false,
    initialValues: { productUUID: '', description: '', quantity: 1, unitPrice: 0, discount: 0 },
    columns: [
      {
        id: 'product',
        label: 'Product',
        field: 'SaleProductName',
        uuidField: 'SqiUUID',
        kind: 'identity',
      },
      { id: 'quantity', label: 'Quantity', field: 'SqiQuantity', kind: 'number' },
      { id: 'unitPrice', label: 'Unit Price', field: 'SqiUnitPrice', kind: 'currency' },
      { id: 'discount', label: 'Discount', field: 'SqiDiscount', kind: 'currency' },
      { id: 'total', label: 'Total', field: 'SqiTotal', kind: 'currency' },
    ],
    fields: [
      {
        key: 'productUUID',
        source: 'SaleProductSprUUID',
        label: 'Product',
        type: 'search-select',
        required: true,
        remoteLookup: {
          endpoint: 'sale/products?status=1',
          uuidField: 'SprUUID',
          labelField: 'SprName',
          selectedLabelField: 'SaleProductName',
        },
        span: 2,
      },
      {
        key: 'quantity',
        source: 'SqiQuantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'unitPrice',
        source: 'SqiUnitPrice',
        label: 'Unit Price',
        type: 'currency',
        required: true,
        span: 1,
      },
      { key: 'discount', source: 'SqiDiscount', label: 'Discount', type: 'currency', span: 1 },
      { key: 'description', source: 'SqiDescription', label: 'Description', span: 3 },
    ],
    payload: (values) => ({
      productUUID: values['productUUID'],
      description: String(values['description'] ?? '').trim() || null,
      quantity: Number(values['quantity'] ?? 0),
      unitPrice: Number(values['unitPrice'] ?? 0),
      discount: Number(values['discount'] ?? 0),
    }),
  });
}

const config = defineCrud({
  endpoint: 'sale/quotations',
  uuidField: 'SqtUUID',
  pageTitle: 'Quotation',
  pageDescription: 'Prepare quotations with customer and line items.',
  dialogDescription: 'Fill out the quotation data before adding items.',
  bulkDelete: true,
  statusMode: 'string',
  activeValue: 'approved',
  inactiveValue: 'canceled',
  statusOptions: statuses,
  activeStatusValues: ['sent', 'approved'],
  defaultCurrencyFields: ['currency'],
  initialValues: {
    status: 'draft',
    customerUUID: '',
    number: '',
    title: '',
    currency: '',
    validUntil: null,
    description: '',
    notes: '',
  },
  columns: [
    { id: 'title', label: 'Title', field: 'SqtTitle', uuidField: 'SqtUUID', kind: 'identity' },
    { id: 'number', label: 'Number', field: 'SqtNumber' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'validUntil', label: 'Valid Until', field: 'SqtValidUntil', kind: 'date' },
    {
      id: 'total',
      label: 'Total',
      field: 'SqtTotal',
      kind: 'currency',
      currencyField: 'SqtCurrency',
    },
    { id: 'status', label: 'Status', field: 'SqtStatus', kind: 'status' },
  ],
  fields: [
    {
      key: 'status',
      source: 'SqtStatus',
      label: 'Status',
      type: 'status',
      options: statuses,
      span: 1,
    },
    {
      key: 'customerUUID',
      source: 'CustomerCusUUID',
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
    { key: 'title', source: 'SqtTitle', label: 'Title', required: true, span: 1 },
    { key: 'number', source: 'SqtNumber', label: 'Number', span: 1 },
    { key: 'currency', source: 'SqtCurrency', label: 'Currency', required: true, span: 1 },
    { key: 'validUntil', source: 'SqtValidUntil', label: 'Valid Until', type: 'date', span: 1 },
    { key: 'description', source: 'SqtDescription', label: 'Description', span: 2 },
    {
      key: 'notes',
      source: 'SqtNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  rowActions: [{ key: 'items', label: 'Items', icon: 'list_alt', collection: items }],
});

@Component({
  selector: 'app-sale-quotation',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleQuotationPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  // ProcSaleQuotationUpdate stores the totals it receives; resend the item-derived totals
  // computed by the database so editing the header never resets them.
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const current = this.editingRecord();
    const optional = (key: string) => String(payload[key] ?? '').trim() || null;
    return {
      ...payload,
      number: optional('number'),
      description: optional('description'),
      notes: optional('notes'),
      currency: String(payload['currency'] ?? '')
        .trim()
        .toUpperCase(),
      subtotal: Number(current?.['SqtSubtotal'] ?? 0),
      discount: Number(current?.['SqtDiscount'] ?? 0),
      total: Number(current?.['SqtTotal'] ?? 0),
    };
  }
}
