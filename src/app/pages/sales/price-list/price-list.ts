import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

// Prices of one list per item and minimum quantity (tiers). The price resolver picks the
// lowest-priority valid list and the largest tier the quantity reaches.
function prices(list: ConfigurableCrudRecord) {
  const listUUID = String(list['SplUUID']);
  return defineCrud({
    endpoint: `sale/price-lists/${listUUID}/items`,
    uuidField: 'SliUUID',
    pageTitle: 'Prices',
    pageDescription: 'Prices of the list for each product and minimum quantity.',
    createTitle: 'New price',
    editTitle: 'Edit price',
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    initialValues: { productUUID: '', minQuantity: 1, price: 0 },
    columns: [
      {
        id: 'product',
        label: 'Product',
        field: 'SaleProductName',
        uuidField: 'SliUUID',
        kind: 'identity',
      },
      { id: 'minQuantity', label: 'Minimum quantity', field: 'SliMinQuantity', kind: 'number' },
      {
        id: 'price',
        label: 'Price',
        field: 'SliPrice',
        kind: 'currency',
      },
      { id: 'base', label: 'Base price', field: 'SaleProductBasePrice', kind: 'currency' },
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
        key: 'minQuantity',
        source: 'SliMinQuantity',
        label: 'Minimum quantity',
        type: 'number',
        required: true,
        help: 'This price applies from this quantity on; use 1 for the regular price.',
        span: 1,
      },
      {
        key: 'price',
        source: 'SliPrice',
        label: 'Price',
        type: 'currency',
        currencyCode: String(list['SplCurrency'] ?? ''),
        required: true,
        span: 1,
      },
    ],
    payload: (values) => ({
      productUUID: values['productUUID'],
      minQuantity: Number(values['minQuantity'] ?? 1),
      price: Number(values['price'] ?? 0),
    }),
  });
}

const config = defineCrud({
  endpoint: 'sale/price-lists',
  uuidField: 'SplUUID',
  pageTitle: 'Price lists',
  pageDescription:
    'Price lists with currency, validity and priority used by quotations, orders and the POS.',
  createTitle: 'New price list',
  editTitle: 'Edit price list',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    name: '',
    currency: '',
    validFrom: '',
    validUntil: '',
    priority: 100,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'SplName', uuidField: 'SplUUID', kind: 'identity' },
    { id: 'currency', label: 'Currency', field: 'SplCurrency' },
    { id: 'priority', label: 'Priority', field: 'SplPriority', kind: 'number' },
    { id: 'validFrom', label: 'Valid from', field: 'SplValidFrom', kind: 'datetime' },
    { id: 'validUntil', label: 'Valid until', field: 'SplValidUntil', kind: 'datetime' },
    { id: 'items', label: 'Prices', field: 'ItemCount', kind: 'number' },
    { id: 'status', label: 'Status', field: 'SplStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'SplStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'SplName', label: 'Name', required: true, span: 2 },
    {
      key: 'currency',
      source: 'SplCurrency',
      label: 'Currency',
      placeholder: 'BRL',
      help: 'ISO 4217 code; empty uses the default currency of the tenant.',
      span: 1,
    },
    {
      key: 'priority',
      source: 'SplPriority',
      label: 'Priority',
      type: 'number',
      required: true,
      help: 'Among valid lists, the lowest number wins.',
      span: 1,
    },
    { key: 'validFrom', source: 'SplValidFrom', label: 'Valid from', type: 'datetime', span: 1 },
    { key: 'validUntil', source: 'SplValidUntil', label: 'Valid until', type: 'datetime', span: 1 },
    {
      key: 'notes',
      source: 'SplNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  rowActions: [{ key: 'prices', label: 'Prices', icon: 'sell', collection: prices }],
  payload: (values) => ({
    name: values['name'],
    currency: String(values['currency'] ?? '').trim() || null,
    validFrom: values['validFrom'] || null,
    validUntil: values['validUntil'] || null,
    priority: Number(values['priority'] ?? 100),
    status: Number(values['status'] ?? 1),
    notes: String(values['notes'] ?? '').trim() || null,
  }),
});

@Component({
  selector: 'app-sale-price-list',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SalePriceListPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
