import { Component } from '@angular/core';
import { CONFIGURABLE_CRUD_IMPORTS, ConfigurableCrudPageBase, ConfigurableCrudRecord } from '__ROOT__shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '__ROOT__shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: '__ENDPOINT__', uuidField: '__UUID__', pageTitle: 'Records',
  initialValues: { name: '', status: 1 },
  fields: [
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
  ],
  columns: [
    { id: 'name', field: 'Name', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'Status', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-__SELECTOR__', standalone: true, imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '__ROOT__shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['__ROOT__shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class __CLASS__ extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() { super(config); }
}
