import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'isp/pops',
  uuidField: 'IppUUID',
  pageTitle: 'POP',
  pageDescription: 'Point of Presence catalog for your ISP network.',
  bulkDelete: true,
  initialValues: { status: 1, name: '', city: '', state: '', address: '', notes: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'IppName', uuidField: 'IppUUID', kind: 'identity' },
    { id: 'city', label: 'City', field: 'IppCity' },
    { id: 'state', label: 'State', field: 'IppState' },
    { id: 'status', label: 'Status', field: 'IppStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'IppStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'IppName', label: 'Name', required: true, span: 1 },
    { key: 'city', source: 'IppCity', label: 'City', required: true, span: 1 },
    { key: 'state', source: 'IppState', label: 'State', required: true, span: 1 },
    { key: 'address', source: 'IppAddress', label: 'Address', span: 4 },
    {
      key: 'notes',
      source: 'IppNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-isp-pop',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspPopPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
