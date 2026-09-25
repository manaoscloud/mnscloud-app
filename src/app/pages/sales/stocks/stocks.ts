import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

// Sale catalog records have no status lifecycle; the status filter is disabled.
const config = defineCrud({
  endpoint: 'sale/stocks',
  uuidField: 'SskUUID',
  pageTitle: 'Stocks',
  pageDescription: 'Manage POS stock definitions for your environment.',
  bulkDelete: true,
  statusFilter: false,
  initialValues: { name: '', saleStockTypeUUID: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'SskName', uuidField: 'SskUUID', kind: 'identity' },
    { id: 'type', label: 'Stock type', field: 'SaleStockTypeName' },
  ],
  fields: [
    { key: 'name', source: 'SskName', label: 'Name', required: true, span: 1 },
    {
      key: 'saleStockTypeUUID',
      source: 'SaleStockTypeSstUUID',
      label: 'Stock type',
      type: 'search-select',
      required: true,
      remoteLookup: { endpoint: 'sale/stock-types', uuidField: 'SstUUID', labelField: 'SstName' },
      span: 1,
    },
  ],
});

@Component({
  selector: 'app-sales-stocks',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SalesStocksPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
