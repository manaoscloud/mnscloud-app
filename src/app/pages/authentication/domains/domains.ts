import { authenticationPayload, authenticationRecordFields } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/** Optional login realms (user@realm): unique on the platform and immutable after creation. */
const config = defineCrud({
  endpoint: 'authentication/domains',
  uuidField: 'AadUUID',
  pageTitle: 'authentication.domains',
  pageDescription: 'authentication.domainsDescription',
  dialogDescription: 'authentication.domainHelp',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AadRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    AuthenticationAccountAacUUID: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AadStatus', label: 'Status', type: 'status', span: 1 },
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
      key: 'name',
      source: 'AadName',
      label: 'authentication.domain',
      required: true,
      span: 1,
      // The realm is part of every login configured in the equipment: it never changes.
      disabledWhen: ({ editing }) => editing,
      help: 'authentication.domainNameHelp',
    },
    ...authenticationRecordFields('Aad'),
  ],
  columns: [
    { id: 'name', field: 'AadName', label: 'authentication.domain', kind: 'identity' },
    {
      id: 'account',
      field: 'AccountName',
      label: 'authentication.accounts',
      kind: 'related',
      uuidField: 'AuthenticationAccountAacUUID',
    },
    { id: 'accesses', field: 'AccessCount', label: 'authentication.accesses', kind: 'number' },
    { id: 'status', field: 'AadStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-authentication-domains',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationDomainPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
