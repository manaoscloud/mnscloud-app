import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const STATES_MAP: Record<string, string> = {
  in_stock: 'In stock',
  reserved: 'Reserved',
  installed: 'Installed',
  faulty: 'Faulty',
  maintenance: 'Maintenance',
  returned: 'Returned',
  disposed: 'Disposed',
};

export const STOCK_SERIAL_UNIT_STATES = Object.entries(STATES_MAP).map(([value, label]) => ({
  value,
  label,
}));

const config = defineCrud({
  serverSidePagination: true,
  pageTitle: 'Serialized stock & Comodato',
  endpoint: 'stock/serial-units',
  bulkDelete: false,
  createTitle: 'New serialized unit',
  uuidField: 'SsuUUID',
  editTitle: 'Edit serialized unit',
  pageDescription:
    'Track individualized serial units (ONUs, routers, CPEs), comodato assignments, and field status.',
  initialValues: {
    state: 'in_stock',
    comodato: 1,
    status: 1,
    serialNumber: '',
    macAddress: '',
    gponSerialNumber: '',
    saleProductUUID: '',
    stockLocationUUID: '',
    notes: '',
  },
  listFilters: [
    {
      key: 'state',
      label: 'State',
      type: 'select',
      span: 1,
      options: STOCK_SERIAL_UNIT_STATES,
      emptyLabel: 'All',
    },
    {
      key: 'comodato',
      label: 'Comodato',
      type: 'select',
      span: 1,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'serial', label: 'Serial number', field: 'SsuSerialNumber', uuidField: 'SsuUUID', kind: 'identity' },
    { id: 'mac', label: 'MAC address', field: 'SsuMacAddress' },
    { id: 'gpon', label: 'GPON SN', field: 'SsuGponSn' },
    { id: 'state', label: 'State', field: 'SsuState', options: STOCK_SERIAL_UNIT_STATES },
    { id: 'comodato', label: 'Comodato', field: 'SsuComodato', kind: 'boolean' },
    { id: 'product', label: 'Product', field: 'ProductName' },
    { id: 'location', label: 'Location', field: 'LocationName' },
    { id: 'subscription', label: 'Subscription', field: 'SubscriptionID' },
    { id: 'status', label: 'Status', field: 'SsuStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'SsuStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'serialNumber', source: 'SsuSerialNumber', label: 'Serial number', required: true, span: 1 },
    { key: 'macAddress', source: 'SsuMacAddress', label: 'MAC address', span: 1 },
    { key: 'gponSerialNumber', source: 'SsuGponSn', label: 'GPON SN', span: 1 },
    {
      key: 'state',
      source: 'SsuState',
      label: 'State',
      type: 'select',
      options: STOCK_SERIAL_UNIT_STATES,
      required: true,
      span: 1,
    },
    {
      key: 'comodato',
      source: 'SsuComodato',
      label: 'Comodato',
      type: 'select',
      options: [
        { value: 1, label: 'Yes (Lent to customer)' },
        { value: 0, label: 'No (Sold / Internal)' },
      ],
      fromRecord: (value) => Number(value ?? 1),
      span: 1,
    },
    {
      key: 'saleProductUUID',
      source: 'SaleProductSprUUID',
      label: 'Catalog product',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'sales/products',
        uuidField: 'ProductUUID',
        labelField: 'Name',
        descriptionField: 'Code',
        selectedLabelField: 'ProductName',
      },
      span: 1,
    },
    {
      key: 'stockLocationUUID',
      source: 'StockLocationStlUUID',
      label: 'Stock location',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'stock/locations',
        uuidField: 'LocationUUID',
        labelField: 'Name',
        selectedLabelField: 'LocationName',
      },
      span: 1,
    },
    {
      key: 'notes',
      source: 'SsuNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
    },
  ],
  payload: (values) => ({
    serialNumber: values['serialNumber'],
    macAddress: String(values['macAddress'] ?? '').trim() || null,
    gponSerialNumber: String(values['gponSerialNumber'] ?? '').trim() || null,
    saleProductUUID: values['saleProductUUID'] || null,
    stockLocationUUID: values['stockLocationUUID'] || null,
    state: values['state'] || 'in_stock',
    comodato: Number(values['comodato'] ?? 1),
    status: Number(values['status'] ?? 1),
    notes: String(values['notes'] ?? '').trim() || null,
  }),
});

@Component({
  selector: 'app-stock-serial-units',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class StockSerialUnitsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
