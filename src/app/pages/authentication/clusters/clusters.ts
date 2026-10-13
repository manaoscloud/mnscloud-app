import { authenticationPayload, AUTHENTICATION_BOOLEAN_OPTIONS } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'system/authentication/clusters',
  uuidField: 'AtcUUID',
  pageTitle: 'authentication.clusters',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AtcRevision']) }),
  initialValues: { name: '', notes: '', status: 0, revision: 1, region: '', published: 0 },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AtcStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'AtcName', label: 'Name', required: true, span: 2 },
    { key: 'revision', source: 'AtcRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'region',
      source: 'AtcRegion',
      label: 'authentication.region',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'published',
      source: 'AtcPublished',
      label: 'authentication.published',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: AUTHENTICATION_BOOLEAN_OPTIONS,
    },
    {
      key: 'notes',
      source: 'AtcNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'AtcName', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'AtcStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-clusters',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationClusterPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
