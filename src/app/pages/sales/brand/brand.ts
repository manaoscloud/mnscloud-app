import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

// Sale catalog records have no status lifecycle; the status filter is disabled.
const config = defineCrud({
  endpoint: 'sale/brands',
  uuidField: 'SbrUUID',
  pageTitle: 'Brand',
  pageDescription: 'Register brand definitions used in sales.',
  bulkDelete: true,
  statusFilter: false,
  initialValues: { name: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'SbrName', uuidField: 'SbrUUID', kind: 'identity' },
  ],
  fields: [{ key: 'name', source: 'SbrName', label: 'Name', required: true, span: 1 }],
});

@Component({
  selector: 'app-sale-brand',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleBrandPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
