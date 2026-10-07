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
  endpoint: 'crm/loss-reasons',
  uuidField: 'ClrUUID',
  pageTitle: 'crm.title.loss-reasons',
  initialValues: {
    ClrName: '',
    ClrStatus: 1,
  },
  fields: [
    {
      key: 'ClrStatus',
      source: 'ClrStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'ClrName',
      source: 'ClrName',
      label: 'crm.field.Name',
      span: 2,
      required: true,
      type: 'text',
    },
    { key: 'ClrRevision', source: 'ClrRevision', label: 'crm.field.Revision', hidden: true },
  ],
  columns: [
    {
      id: 'ClrName',
      field: 'ClrName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'ClrStatus',
      field: 'ClrStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [],
  serverSidePagination: true,
  // CRM deletion is individually audited; see app.md, CRM form baseline.
  bulkDelete: false,
  quickCreateLabelField: 'ClrName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'ClrRevision', ['ClrStatus', 'ClrRevision'], []),
  rowActions: crmActions('loss-reasons'),
});
@Component({
  selector: 'app-crm-loss-reasons',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmLossReasonPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
