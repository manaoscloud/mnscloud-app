import { crmPayload } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';
const config = defineCrud({
  endpoint: 'crm/industries',
  uuidField: 'CinUUID',
  pageTitle: 'crm.title.industries',
  initialValues: {
    CinName: '',
    CinStatus: 1,
  },
  fields: [
    {
      key: 'CinStatus',
      source: 'CinStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'CinName',
      source: 'CinName',
      label: 'crm.field.Name',
      span: 2,
      required: true,
      type: 'text',
    },
    { key: 'CinRevision', source: 'CinRevision', label: 'crm.field.Revision', hidden: true },
  ],
  columns: [
    {
      id: 'CinName',
      field: 'CinName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CinStatus',
      field: 'CinStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [],
  serverSidePagination: true,
  // CRM deletion is individually audited; see app.md, CRM form baseline.
  bulkDelete: false,
  quickCreateLabelField: 'CinName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CinRevision', ['CinStatus', 'CinRevision'], []),
  rowActions: crmActions('industries'),
});
@Component({
  selector: 'app-crm-industries',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmIndustryPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
