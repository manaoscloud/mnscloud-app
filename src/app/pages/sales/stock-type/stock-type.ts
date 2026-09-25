import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

// Sale catalog records have no status lifecycle; the status filter is disabled.
const config = defineCrud({
  endpoint: 'sale/stock-types',
  uuidField: 'SstUUID',
  pageTitle: 'Stock Type',
  pageDescription: 'Register stock type definitions for POS.',
  bulkDelete: true,
  statusFilter: false,
  initialValues: { name: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'SstName', uuidField: 'SstUUID', kind: 'identity' },
  ],
  fields: [{ key: 'name', source: 'SstName', label: 'Name', required: true, span: 1 }],
});

@Component({
  selector: 'app-sale-stock-type',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleStockTypePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
