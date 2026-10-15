import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { authenticationPayload } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'authentication/groups',
  uuidField: 'AagUUID',
  pageTitle: 'authentication.groups',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AagRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    AuthenticationAccountAacUUID: '',
    AuthenticationProfileAapUUID: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AagStatus', label: 'Status', type: 'status', span: 1 },
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
      key: 'AuthenticationProfileAapUUID',
      source: 'AuthenticationProfileAapUUID',
      help: 'authentication.profileHelp',
      quickCreate: quickCreateFor('AuthenticationProfileAapUUID', {
        initialValues: ({ values }) => ({
          AuthenticationAccountAacUUID: values['AuthenticationAccountAacUUID'],
        }),
      }),
      label: 'authentication.profiles',
      span: 1,
      required: false,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/profiles',
        uuidField: 'AapUUID',
        labelField: 'AapName',
        parameters: { accountUUID: 'AuthenticationAccountAacUUID' },
      },
    },
    { key: 'name', source: 'AagName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'AagRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'notes',
      source: 'AagNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'AagName', label: 'Name', kind: 'identity' },
    {
      id: 'account',
      field: 'AccountName',
      label: 'authentication.accounts',
      kind: 'related',
      uuidField: 'AuthenticationAccountAacUUID',
    },
    {
      id: 'profile',
      field: 'ProfileName',
      label: 'authentication.profiles',
      kind: 'related',
      uuidField: 'AuthenticationProfileAapUUID',
    },
    { id: 'status', field: 'AagStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationGroupPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
