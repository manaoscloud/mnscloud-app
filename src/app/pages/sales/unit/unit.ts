import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

// Sale catalog records have no status lifecycle; the status filter is disabled.
const config = defineCrud({
  endpoint: 'sale/units',
  uuidField: 'SunUUID',
  pageTitle: 'Unit of Measure',
  pageDescription: 'Register units used for sale items.',
  bulkDelete: true,
  statusFilter: false,
  initialValues: { code: '', name: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'SunName', uuidField: 'SunUUID', kind: 'identity' },
    { id: 'code', label: 'Code', field: 'SunCode' },
  ],
  fields: [
    { key: 'code', source: 'SunCode', label: 'Code', required: true, span: 1 },
    { key: 'name', source: 'SunName', label: 'Name', required: true, span: 1 },
  ],
});

@Component({
  selector: 'app-sale-unit',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleUnitPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
