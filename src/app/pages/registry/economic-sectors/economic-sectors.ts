import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'registry/economic-sectors',
  uuidField: 'RecUUID',
  pageTitle: 'registry.economy.economic-sectors',
  pageDescription: 'registry.economy.economic-sectors.description',
  serverSidePagination: true,
  initialValues: { RecName: '', RecDescription: '', RecStatus: 1 },
  fields: [
    { key: 'RecStatus', source: 'RecStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'RecName', source: 'RecName', label: 'Name', required: true, span: 2 },

    {
      key: 'RecDescription',
      source: 'RecDescription',
      label: 'Description',
      type: 'textarea',
      span: 4,
    },
    { key: 'RecRevision', source: 'RecRevision', label: 'Revision', hidden: true },
  ],
  columns: [
    { id: 'name', field: 'RecName', label: 'Name', kind: 'identity' },

    { id: 'description', field: 'RecDescription', label: 'Description', kind: 'text' },
    { id: 'status', field: 'RecStatus', label: 'Status', kind: 'status' },
  ],

  quickCreateLabelField: 'RecName',
});

@Component({
  selector: 'app-economic-sectors',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegEconomicSectorPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
