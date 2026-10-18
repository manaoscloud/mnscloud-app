import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { STOCK_LOCATION_KINDS } from './locations';

// Balances are a projection of the movement ledger: read-only here, changed only by movements,
// transfers and sales.
const config = defineCrud({
  endpoint: 'stock/balances',
  uuidField: 'BalanceKey',
  pageTitle: 'Stock balances',
  pageDescription:
    'Physical, reserved and available quantity of each item per location, kept by the movement ledger.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'locationUUID',
      label: 'Location',
      paramKey: 'locationUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'stock/locations', uuidField: 'StlUUID', labelField: 'StlName' },
    },
  ],
  columns: [
    {
      id: 'item',
      label: 'Item',
      field: 'SaleProductName',
      uuidField: 'BalanceKey',
      kind: 'identity',
    },
    { id: 'location', label: 'Location', field: 'StockLocationName' },
    { id: 'kind', label: 'Kind', field: 'StockLocationKind', options: STOCK_LOCATION_KINDS },
    { id: 'quantity', label: 'Quantity', field: 'StbQuantity', kind: 'number' },
    { id: 'reserved', label: 'Reserved', field: 'StbReserved', kind: 'number' },
    { id: 'available', label: 'Available', field: 'StbAvailable', kind: 'number' },
    { id: 'last', label: 'Last movement', field: 'StbLastMovementAt', kind: 'datetime' },
  ],
  fields: [],
});

@Component({
  selector: 'app-stock-balances',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class StockBalancesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
