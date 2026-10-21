import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

export const STOCK_LOCATION_KINDS = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'store', label: 'Store' },
  { value: 'route', label: 'Sales route' },
  { value: 'device', label: 'POS device' },
  { value: 'in_transit', label: 'In transit' },
];

const config = defineCrud({
  endpoint: 'stock/locations',
  uuidField: 'StlUUID',
  pageTitle: 'Stock locations',
  pageDescription:
    'Warehouses, stores, sales routes and POS devices that hold stock of the catalog items.',
  createTitle: 'New stock location',
  editTitle: 'Edit stock location',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    name: '',
    kind: 'warehouse',
    companyUUID: '',
    allowNegative: 0,
    notes: '',
  },
  listFilters: [
    {
      key: 'kind',
      label: 'Kind',
      type: 'select',
      span: 1,
      options: STOCK_LOCATION_KINDS,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'name', label: 'Name', field: 'StlName', uuidField: 'StlUUID', kind: 'identity' },
    { id: 'kind', label: 'Kind', field: 'StlKind', options: STOCK_LOCATION_KINDS },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    { id: 'negative', label: 'Negative stock', field: 'StlAllowNegative', kind: 'boolean' },
    { id: 'items', label: 'Items with stock', field: 'ItemCount', kind: 'number' },
    { id: 'status', label: 'Status', field: 'StlStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'StlStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'StlName', label: 'Name', required: true, span: 2 },
    {
      key: 'kind',
      source: 'StlKind',
      label: 'Kind',
      type: 'select',
      options: STOCK_LOCATION_KINDS,
      required: true,
      span: 1,
    },
    {
      key: 'companyUUID',
      source: 'RegCompanyRcoUUID',
      label: 'Company',
      type: 'search-select',
      help: 'Establishment that owns the stock of this location.',
      remoteLookup: {
        endpoint: 'registry/companies',
        uuidField: 'CompanyUUID',
        labelField: 'Name',
        descriptionField: 'Document',
        selectedLabelField: 'CompanyName',
      },
      span: 2,
    },
    {
      key: 'allowNegative',
      source: 'StlAllowNegative',
      label: 'Negative stock',
      type: 'select',
      options: [
        { value: 0, label: 'Blocked' },
        { value: 1, label: 'Allowed (risk accepted)' },
      ],
      fromRecord: (value) => Number(value ?? 0),
      help: 'Allowed lets sales continue without balance here, for example on routes; the divergence stays in the ledger.',
      span: 2,
    },
    {
      key: 'notes',
      source: 'StlNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  payload: (values) => ({
    name: values['name'],
    kind: values['kind'],
    companyUUID: values['companyUUID'] || null,
    allowNegative: Number(values['allowNegative'] ?? 0),
    status: Number(values['status'] ?? 1),
    notes: String(values['notes'] ?? '').trim() || null,
  }),
});

@Component({
  selector: 'app-stock-locations',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class StockLocationsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
