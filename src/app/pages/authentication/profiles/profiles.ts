import { authenticationPayload } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'authentication/profiles',
  uuidField: 'AapUUID',
  pageTitle: 'authentication.profiles',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AapRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    AuthenticationAccountAacUUID: '',
    sessionTimeout: '',
    idleTimeout: '',
    interimInterval: 300,
    rateLimit: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AapStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'AapName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'AapRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'AuthenticationAccountAacUUID',
      source: 'AuthenticationAccountAacUUID',
      label: 'authentication.accounts',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/accounts',
        uuidField: 'AacUUID',
        labelField: 'AacName',
      },
      disabledWhen: ({ editing }) => editing,
      help: 'authentication.scopeHelp',
    },
    {
      key: 'sessionTimeout',
      source: 'AapSessionTimeout',
      help: 'authentication.sessionTimeoutHelp',
      label: 'authentication.sessionTimeout',
      span: 1,
      required: false,
      type: 'number',
    },
    {
      key: 'idleTimeout',
      source: 'AapIdleTimeout',
      label: 'authentication.idleTimeout',
      span: 1,
      required: false,
      type: 'number',
    },
    {
      key: 'interimInterval',
      source: 'AapInterimInterval',
      label: 'authentication.interimInterval',
      span: 1,
      required: true,
      type: 'number',
    },
    {
      key: 'rateLimit',
      source: 'AapRateLimit',
      label: 'authentication.rateLimit',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'notes',
      source: 'AapNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'AapName', label: 'Name', kind: 'identity' },
    {
      id: 'account',
      field: 'AccountName',
      label: 'authentication.accounts',
      kind: 'related',
      uuidField: 'AuthenticationAccountAacUUID',
    },
    {
      id: 'interim',
      field: 'AapInterimInterval',
      label: 'authentication.interimInterval',
      kind: 'number',
    },
    { id: 'rate', field: 'AapRateLimit', label: 'authentication.rateLimit', kind: 'text' },
    { id: 'status', field: 'AapStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationProfilePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
