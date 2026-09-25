import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

// Sale catalog records have no status lifecycle; the status filter is disabled.
const config = defineCrud({
  endpoint: 'sale/categories',
  uuidField: 'ScaUUID',
  pageTitle: 'Category',
  pageDescription: 'Register categories used in sales.',
  bulkDelete: true,
  statusFilter: false,
  initialValues: { name: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'ScaName', uuidField: 'ScaUUID', kind: 'identity' },
  ],
  fields: [{ key: 'name', source: 'ScaName', label: 'Name', required: true, span: 1 }],
});

@Component({
  selector: 'app-sale-category',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleCategoryPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
