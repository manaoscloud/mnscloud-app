import { authenticationPayload } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'authentication/network-devices',
  uuidField: 'AanUUID',
  pageTitle: 'authentication.network-devices',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AanRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 0,
    revision: 1,
    AuthenticationAccountAacUUID: '',
    address: '',
    secret: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AanStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'AanName', label: 'Name', required: true, span: 2 },
    { key: 'revision', source: 'AanRevision', label: 'Revision', type: 'number', hidden: true },
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
      key: 'address',
      source: 'AanAddress',
      label: 'authentication.address',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'secret',
      source: 'AanSecretEncrypted',
      label: 'authentication.secret',
      span: 1,
      required: false,
      type: 'password',
      requiredWhen: ({ editing }) => !editing,
      help: 'authentication.credentialHelp',
      autocomplete: 'new-password',
    },
    {
      key: 'notes',
      source: 'AanNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'address', field: 'AanAddress', label: 'authentication.address', kind: 'text' },
    {
      id: 'account',
      field: 'AuthenticationAccountAacUUID',
      label: 'authentication.accounts',
      kind: 'related',
      lookupKey: 'AuthenticationAccountAacUUID',
    },
    { id: 'name', field: 'AanName', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'AanStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-network-devices',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationNasPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
