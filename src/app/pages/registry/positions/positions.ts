import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  NAMED_RECORD_INITIAL_VALUES,
  namedRecordColumns,
  namedRecordFields,
  namedRecordPayload,
} from '../named-record-crud';

const config = defineCrud({
  endpoint: 'registry/positions',
  uuidField: 'PositionUUID',
  pageTitle: 'Positions',
  pageDescription:
    'Manage the job positions of your organization, shared by employees and the other modules.',
  bulkDelete: true,
  initialValues: NAMED_RECORD_INITIAL_VALUES,
  columns: namedRecordColumns('PositionUUID'),
  fields: namedRecordFields(),
});

@Component({
  selector: 'app-registry-positions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegPositionPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return namedRecordPayload(payload);
  }
}
