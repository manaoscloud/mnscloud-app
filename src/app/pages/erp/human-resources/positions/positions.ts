import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'erp/human-resources/positions',
  uuidField: 'PositionUUID',
  pageTitle: 'Positions',
  pageDescription: 'Manage human resources job positions.',
  bulkDelete: true,
  initialValues: { status: 1, name: '', description: '', notes: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'Name', uuidField: 'PositionUUID', kind: 'identity' },
    { id: 'description', label: 'Description', field: 'Description' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
    { key: 'description', source: 'Description', label: 'Description', span: 2 },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-erp-hr-positions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ErpHumanResourcesPositionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
