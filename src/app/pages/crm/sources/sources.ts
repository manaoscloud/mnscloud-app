import { crmPayload, crmLocalDateTime } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';
const config = defineCrud({
  endpoint: 'crm/sources',
  uuidField: 'CsoUUID',
  pageTitle: 'crm.title.sources',
  initialValues: {
    CsoName: '',
    CsoStatus: 1,
  },
  fields: [
    {
      key: 'CsoName',
      source: 'CsoName',
      label: 'crm.field.Name',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'CsoStatus',
      source: 'CsoStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'CsoRevision',
      source: 'CsoRevision',
      label: 'crm.field.Revision',
      hidden: true,
    },
  ],
  columns: [
    {
      id: 'CsoName',
      field: 'CsoName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CsoStatus',
      field: 'CsoStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [],
  serverSidePagination: true,
  bulkDelete: false,
  quickCreateLabelField: 'CsoName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CsoRevision', ['CsoStatus', 'CsoRevision'], []),
  rowActions: crmActions('sources'),
});
@Component({
  selector: 'app-crm-sources',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmSourcePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
