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
  endpoint: 'authentication/profiles',
  uuidField: 'AapUUID',
  pageTitle: 'authentication.profiles',
  pageDescription: 'authentication.profilesDescription',
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
    AuthenticationRateLimitArlUUID: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AapStatus', label: 'Status', type: 'status', span: 1 },
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
    { key: 'name', source: 'AapName', label: 'Name', required: true, span: 1 },
    {
      key: 'AuthenticationRateLimitArlUUID',
      source: 'AuthenticationRateLimitArlUUID',
      label: 'authentication.rateLimit',
      help: 'authentication.rateLimitHelp',
      quickCreate: quickCreateFor('AuthenticationRateLimitArlUUID', {
        initialValues: ({ values }) => ({
          AuthenticationAccountAacUUID: values['AuthenticationAccountAacUUID'],
        }),
      }),
      span: 1,
      required: false,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/rate-limits',
        uuidField: 'ArlUUID',
        labelField: 'ArlName',
        descriptionField: 'ArlRateLimit',
        parameters: { accountUUID: 'AuthenticationAccountAacUUID' },
      },
    },
    {
      key: 'sessionTimeout',
      source: 'AapSessionTimeout',
      help: 'authentication.sessionTimeoutHelp',
      label: 'authentication.sessionTimeout',
      tab: 'limits',
      span: 1,
      required: false,
      type: 'number',
    },
    {
      key: 'idleTimeout',
      source: 'AapIdleTimeout',
      label: 'authentication.idleTimeout',
      tab: 'limits',
      help: 'authentication.idleTimeoutHelp',
      span: 1,
      required: false,
      type: 'number',
    },
    {
      key: 'interimInterval',
      source: 'AapInterimInterval',
      label: 'authentication.interimInterval',
      tab: 'limits',
      help: 'authentication.interimIntervalHelp',
      span: 1,
      required: true,
      type: 'number',
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
    {
      id: 'rate',
      field: 'RateLimitName',
      label: 'authentication.rateLimit',
      kind: 'related',
      uuidField: 'AuthenticationRateLimitArlUUID',
    },
    {
      id: 'rateValue',
      field: 'RateLimitValue',
      label: 'authentication.rateLimitValue',
      kind: 'text',
    },
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
