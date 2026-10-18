import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

export const POS_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'pix', label: 'Pix' },
  { value: 'card_credit', label: 'Credit card' },
  { value: 'card_debit', label: 'Debit card' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'other', label: 'Other' },
];

const config = defineCrud({
  endpoint: 'pos/terminals',
  uuidField: 'PtmUUID',
  pageTitle: 'POS terminals',
  pageDescription:
    'Cash registers of the point of sale with their establishment, stock location, price list and payment methods.',
  createTitle: 'New POS terminal',
  editTitle: 'Edit POS terminal',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    name: '',
    companyUUID: '',
    locationUUID: '',
    priceListUUID: '',
    customerUUID: '',
    paymentMethods: ['cash', 'pix', 'card_credit', 'card_debit'],
    maxDiscountPercent: 0,
    offlineEnabled: 0,
    revision: null,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'PtmName', uuidField: 'PtmUUID', kind: 'identity' },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    { id: 'location', label: 'Stock location', field: 'StockLocationName' },
    { id: 'priceList', label: 'Price list', field: 'PriceListName' },
    { id: 'session', label: 'Open register', field: 'OpenSessionUUID', kind: 'boolean' },
    { id: 'offline', label: 'Offline sales', field: 'PtmOfflineEnabled', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'PtmStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'PtmStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'PtmName', label: 'Name', required: true, span: 2 },
    {
      key: 'maxDiscountPercent',
      source: 'PtmMaxDiscountPercent',
      label: 'Maximum discount (%)',
      type: 'number',
      help: 'Line discount the operator may give without authorization; the server checks it.',
      span: 1,
    },
    {
      key: 'companyUUID',
      source: 'ErpCompanyComUUID',
      label: 'Company',
      type: 'search-select',
      required: true,
      help: 'Establishment that sells through this terminal and issues its fiscal documents.',
      remoteLookup: {
        endpoint: 'erp/companies',
        uuidField: 'CompanyUUID',
        labelField: 'Name',
        descriptionField: 'Document',
        selectedLabelField: 'CompanyName',
      },
      span: 2,
    },
    {
      key: 'locationUUID',
      source: 'StockLocationStlUUID',
      label: 'Stock location',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'stock/locations?status=1',
        uuidField: 'StlUUID',
        labelField: 'StlName',
        selectedLabelField: 'StockLocationName',
      },
      span: 2,
    },
    {
      key: 'priceListUUID',
      source: 'SalePriceListSplUUID',
      label: 'Price list',
      type: 'search-select',
      help: 'Empty uses the best valid price list, then the base price of each item.',
      remoteLookup: {
        endpoint: 'sale/price-lists?status=1',
        uuidField: 'SplUUID',
        labelField: 'SplName',
        selectedLabelField: 'PriceListName',
      },
      span: 2,
    },
    {
      key: 'customerUUID',
      source: 'CustomerCusUUID',
      label: 'Default customer',
      type: 'search-select',
      help: 'Empty uses the walk-in customer (CONSUMIDOR FINAL), created once.',
      remoteLookup: {
        endpoint: 'erp/customers',
        searchParam: 'q',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
      span: 2,
    },
    {
      key: 'paymentMethods',
      source: 'PtmPaymentMethods',
      label: 'Payment methods',
      type: 'checkbox-group',
      options: POS_PAYMENT_METHODS,
      required: true,
      fromRecord: (value) =>
        String(value ?? '')
          .split(',')
          .filter(Boolean),
      span: 2,
    },
    {
      key: 'offlineEnabled',
      source: 'PtmOfflineEnabled',
      label: 'Offline sales',
      type: 'select',
      options: [
        { value: 0, label: 'Online only' },
        { value: 1, label: 'Allowed on installed apps' },
      ],
      fromRecord: (value) => Number(value ?? 0),
      help: 'Installed apps keep selling without internet within their offline authorization; the web version is always online.',
      span: 2,
    },
    { key: 'revision', source: 'PtmRevision', label: 'Revision', hidden: true },
    {
      key: 'notes',
      source: 'PtmNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    name: values['name'],
    companyUUID: values['companyUUID'],
    locationUUID: values['locationUUID'],
    priceListUUID: values['priceListUUID'] || null,
    customerUUID: values['customerUUID'] || null,
    paymentMethods: Array.isArray(values['paymentMethods'])
      ? (values['paymentMethods'] as string[]).join(',')
      : values['paymentMethods'],
    maxDiscountPercent: Number(values['maxDiscountPercent'] ?? 0),
    offlineEnabled: Number(values['offlineEnabled'] ?? 0),
    status: Number(values['status'] ?? 1),
    notes: String(values['notes'] ?? '').trim() || null,
  }),
});

@Component({
  selector: 'app-pos-terminals',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PosTerminalsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
