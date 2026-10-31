import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];

const isDraft = (row: ConfigurableCrudRecord) => row['StrStatus'] === 'draft';

function items(transfer: ConfigurableCrudRecord) {
  const transferUUID = String(transfer['StrUUID']);
  const draft = isDraft(transfer);
  return defineCrud({
    endpoint: `stock/transfers/${transferUUID}/items`,
    uuidField: 'StiUUID',
    pageTitle: 'Transfer items',
    pageDescription: 'Items and quantities moved from the origin to the destination.',
    createTitle: 'New transfer item',
    editTitle: 'Edit transfer item',
    canCreate: draft,
    canEdit: draft,
    canDelete: draft,
    bulkDelete: false,
    statusFilter: false,
    initialValues: { productUUID: '', quantity: 1 },
    columns: [
      {
        id: 'item',
        label: 'Item',
        field: 'SaleProductName',
        uuidField: 'StiUUID',
        kind: 'identity',
      },
      { id: 'quantity', label: 'Quantity', field: 'StiQuantity', kind: 'number' },
    ],
    fields: [
      {
        key: 'productUUID',
        source: 'SaleProductSprUUID',
        label: 'Item',
        type: 'search-select',
        required: true,
        remoteLookup: {
          endpoint: 'sale/products?status=1',
          uuidField: 'SprUUID',
          labelField: 'SprName',
          selectedLabelField: 'SaleProductName',
        },
      },
      {
        key: 'quantity',
        source: 'StiQuantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        span: 1,
      },
    ],
    payload: (values) => ({
      productUUID: values['productUUID'],
      quantity: Number(values['quantity']),
    }),
  });
}

const locationLookup = {
  endpoint: 'stock/locations?status=1',
  uuidField: 'StlUUID',
  labelField: 'StlName',
};

const config = defineCrud({
  endpoint: 'stock/transfers',
  uuidField: 'StrUUID',
  pageTitle: 'Stock transfers',
  pageDescription:
    'Moves of stock between warehouses, stores, routes and devices; completing posts both sides at once.',
  createTitle: 'New stock transfer',
  editTitle: 'Edit stock transfer',
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  canEditRow: isDraft,
  initialValues: { originUUID: '', destinationUUID: '', notes: '' },
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: STATUSES,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'id', label: 'ID', field: 'StrID', uuidField: 'StrUUID', kind: 'identity' },
    { id: 'origin', label: 'Origin', field: 'OriginName' },
    { id: 'destination', label: 'Destination', field: 'DestinationName' },
    { id: 'items', label: 'Items', field: 'ItemCount', kind: 'number' },
    { id: 'status', label: 'Status', field: 'StrStatus', options: STATUSES },
    { id: 'completed', label: 'Completed at', field: 'StrCompletedAt', kind: 'datetime' },
  ],
  fields: [
    {
      key: 'originUUID',
      source: 'StrOriginStlUUID',
      label: 'Origin',
      type: 'search-select',
      required: true,
      remoteLookup: { ...locationLookup, selectedLabelField: 'OriginName' },
      quickCreate: quickCreateFor('StockLocationStlUUID'),
    },
    {
      key: 'destinationUUID',
      source: 'StrDestinationStlUUID',
      label: 'Destination',
      type: 'search-select',
      required: true,
      remoteLookup: { ...locationLookup, selectedLabelField: 'DestinationName' },
      quickCreate: quickCreateFor('StockLocationStlUUID'),
    },
    {
      key: 'notes',
      source: 'StrNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  rowActions: [
    { key: 'items', label: 'Items', icon: 'list', collection: items },
    {
      key: 'complete',
      label: 'Complete',
      icon: 'task_alt',
      visible: isDraft,
      request: {
        method: 'post',
        endpoint: (row) => `stock/transfers/${row['StrUUID']}/complete`,
        successMessage: 'Stock transfer completed.',
        confirm: {
          title: 'Complete stock transfer',
          message: 'Post the transfer out of the origin and into the destination now?',
          confirmLabel: 'Complete',
        },
      },
    },
    {
      key: 'cancel',
      label: 'Cancel transfer',
      icon: 'block',
      visible: isDraft,
      request: {
        method: 'post',
        endpoint: (row) => `stock/transfers/${row['StrUUID']}/cancel`,
        successMessage: 'Stock transfer canceled.',
        confirm: {
          title: 'Cancel stock transfer',
          message: 'Cancel this draft transfer?',
          confirmLabel: 'Cancel transfer',
        },
      },
    },
  ],
  payload: (values) => ({
    originUUID: values['originUUID'],
    destinationUUID: values['destinationUUID'],
    notes: String(values['notes'] ?? '').trim() || null,
  }),
});

@Component({
  selector: 'app-stock-transfers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class StockTransfersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
