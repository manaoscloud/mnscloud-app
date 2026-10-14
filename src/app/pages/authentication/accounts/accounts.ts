import { authenticationPayload } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'authentication/accounts',
  uuidField: 'AacUUID',
  pageTitle: 'authentication.accounts',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AacRevision']) }),
  initialValues: { name: '', notes: '', status: 1, revision: 1, AuthenticationClusterAtcUUID: '' },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AacStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'AacName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'AacRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'AuthenticationClusterAtcUUID',
      source: 'AuthenticationClusterAtcUUID',
      label: 'authentication.clusters',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/clusters',
        uuidField: 'AtcUUID',
        labelField: 'AtcName',
      },
      disabledWhen: ({ editing }) => editing,
      help: 'authentication.scopeHelp',
    },
    {
      key: 'notes',
      source: 'AacNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'AacName', label: 'Name', kind: 'identity' },
    {
      id: 'cluster',
      field: 'ClusterName',
      label: 'authentication.clusters',
      kind: 'related',
      uuidField: 'AuthenticationClusterAtcUUID',
    },
    { id: 'status', field: 'AacStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
