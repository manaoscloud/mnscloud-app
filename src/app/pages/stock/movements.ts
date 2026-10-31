import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const MOVEMENT_KINDS = [
  { value: 'receipt', label: 'Receipt' },
  { value: 'issue', label: 'Issue' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'transfer_out', label: 'Transfer out' },
  { value: 'transfer_in', label: 'Transfer in' },
  { value: 'sale', label: 'Sale' },
  { value: 'sale_return', label: 'Sale return' },
  { value: 'reversal', label: 'Reversal' },
];

const MANUAL_KINDS = MOVEMENT_KINDS.filter((kind) =>
  ['receipt', 'issue', 'adjustment'].includes(kind.value),
);

// The ledger is append-only: a movement is never edited or deleted; a wrong one is reversed.
const config = defineCrud({
  endpoint: 'stock/movements',
  uuidField: 'StvUUID',
  pageTitle: 'Stock movements',
  pageDescription:
    'Append-only ledger of stock receipts, issues, adjustments, transfers and sales; errors are reversed, never edited.',
  createTitle: 'New stock movement',
  createLabel: 'New movement',
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValuesFactory: () => ({
    locationUUID: '',
    productUUID: '',
    kind: 'receipt',
    quantity: 1,
    unitCost: null,
    notes: '',
    idempotencyKey: crypto.randomUUID(),
  }),
  initialValues: {
    locationUUID: '',
    productUUID: '',
    kind: 'receipt',
    quantity: 1,
    unitCost: null,
    notes: '',
  },
  listFilters: [
    {
      key: 'locationUUID',
      label: 'Location',
      paramKey: 'locationUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'stock/locations', uuidField: 'StlUUID', labelField: 'StlName' },
    },
    {
      key: 'kind',
      label: 'Kind',
      paramKey: 'kind',
      type: 'select',
      span: 1,
      options: MOVEMENT_KINDS,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'id', label: 'ID', field: 'StvID', uuidField: 'StvUUID', kind: 'identity' },
    { id: 'occurred', label: 'Occurred at', field: 'StvOccurredAt', kind: 'datetime' },
    { id: 'location', label: 'Location', field: 'StockLocationName' },
    { id: 'item', label: 'Item', field: 'SaleProductName' },
    { id: 'kind', label: 'Kind', field: 'StvKind', options: MOVEMENT_KINDS },
    { id: 'quantity', label: 'Quantity', field: 'StvQuantity', kind: 'number' },
    { id: 'balance', label: 'Balance after', field: 'StvBalanceAfter', kind: 'number' },
    { id: 'notes', label: 'Notes', field: 'StvNotes' },
  ],
  fields: [
    {
      key: 'locationUUID',
      source: 'StockLocationStlUUID',
      label: 'Location',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'stock/locations?status=1',
        uuidField: 'StlUUID',
        labelField: 'StlName',
      },
    },
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
      },
    },
    { key: 'kind', label: 'Kind', type: 'select', options: MANUAL_KINDS, required: true, span: 1 },
    {
      key: 'quantity',
      label: 'Quantity',
      type: 'number',
      required: true,
      help: 'Receipts add, issues remove; an adjustment may be negative to correct a count.',
      span: 1,
    },
    { key: 'unitCost', label: 'Unit cost', type: 'currency', span: 1 },
    { key: 'notes', label: 'Notes', span: 1 },
    { key: 'idempotencyKey', label: 'Idempotency key', hidden: true },
  ],
  rowActions: [
    {
      key: 'reverse',
      label: 'Reverse',
      icon: 'undo',
      disabledReason: (row) =>
        row['StvKind'] === 'reversal' ? 'A reversal cannot be reversed.' : null,
      request: {
        method: 'post',
        endpoint: (row) => `stock/movements/${row['StvUUID']}/reversal`,
        successMessage: 'Stock movement reversed.',
        confirm: {
          title: 'Reverse stock movement',
          message: 'Post the opposite movement? The original stays in the ledger.',
          confirmLabel: 'Reverse',
        },
      },
    },
  ],
  payload: (values) => {
    const kind = String(values['kind']);
    const quantity = Math.abs(Number(values['quantity'] ?? 0));
    return {
      locationUUID: values['locationUUID'],
      productUUID: values['productUUID'],
      kind,
      quantity:
        kind === 'issue' ? -quantity : kind === 'receipt' ? quantity : Number(values['quantity']),
      unitCost:
        values['unitCost'] === null || values['unitCost'] === ''
          ? null
          : Number(values['unitCost']),
      notes: String(values['notes'] ?? '').trim() || null,
      idempotencyKey: values['idempotencyKey'],
    };
  },
});

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class StockMovementsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
