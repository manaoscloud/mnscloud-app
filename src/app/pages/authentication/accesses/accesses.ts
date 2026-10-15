import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { authenticationPayload, utcToLocalInput } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'authentication/accesses',
  uuidField: 'AaxUUID',
  pageTitle: 'authentication.accesses',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AaxRevision']) }),
  initialValues: {
    notes: '',
    status: 1,
    revision: 1,
    AuthenticationAccountAacUUID: '',
    CustomerCusUUID: '',
    username: '',
    password: '',
    AuthenticationProfileAapUUID: '',
    AuthenticationGroupAagUUID: '',
    expiresAt: '',
    framedIp: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'AaxStatus', label: 'Status', type: 'status', span: 1 },
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
      key: 'CustomerCusUUID',
      source: 'CustomerCusUUID',
      label: 'Customer',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'erp/customers?status=1',
        searchParam: 'q',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
      quickCreate: quickCreateFor('CustomerCusUUID'),
    },
    {
      key: 'AuthenticationGroupAagUUID',
      source: 'AuthenticationGroupAagUUID',
      quickCreate: quickCreateFor('AuthenticationGroupAagUUID', {
        initialValues: ({ values }) => ({
          AuthenticationAccountAacUUID: values['AuthenticationAccountAacUUID'],
        }),
      }),
      label: 'authentication.groups',
      span: 1,
      required: false,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/groups',
        uuidField: 'AagUUID',
        labelField: 'AagName',
        parameters: { accountUUID: 'AuthenticationAccountAacUUID' },
      },
    },
    {
      key: 'AuthenticationProfileAapUUID',
      source: 'AuthenticationProfileAapUUID',
      help: 'authentication.accessProfileHelp',
      quickCreate: quickCreateFor('AuthenticationProfileAapUUID', {
        initialValues: ({ values }) => ({
          AuthenticationAccountAacUUID: values['AuthenticationAccountAacUUID'],
        }),
      }),
      label: 'authentication.profiles',
      span: 1,
      required: false,
      // The group profile is inherited (and prevails) when the selected group has one.
      requiredWhen: ({ values }) => !values['AuthenticationGroupAagUUID'],
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/profiles',
        uuidField: 'AapUUID',
        labelField: 'AapName',
        parameters: { accountUUID: 'AuthenticationAccountAacUUID' },
      },
    },
    {
      key: 'username',
      source: 'AaxUsername',
      label: 'authentication.username',
      tab: 'authentication',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'password',
      source: 'AaxPasswordHash',
      label: 'authentication.password',
      tab: 'authentication',
      span: 1,
      required: false,
      type: 'password',
      requiredWhen: ({ editing }) => !editing,
      help: 'authentication.credentialHelp',
      autocomplete: 'new-password',
      generatedPasswordLength: 20,
    },
    {
      key: 'framedIp',
      source: 'AaxFramedIp',
      label: 'authentication.framedIp',
      tab: 'authentication',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'expiresAt',
      source: 'AaxExpiresAt',
      label: 'authentication.expiresAt',
      tab: 'authentication',
      span: 1,
      required: false,
      type: 'datetime',
      fromRecord: (value) => utcToLocalInput(value),
      help: 'authentication.expiryHelp',
    },
    { key: 'revision', source: 'AaxRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'notes',
      source: 'AaxNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'customer', field: 'CustomerName', label: 'Customer', kind: 'identity' },
    { id: 'username', field: 'AaxUsername', label: 'authentication.username', kind: 'text' },
    {
      id: 'account',
      field: 'AccountName',
      label: 'authentication.accounts',
      kind: 'related',
      uuidField: 'AuthenticationAccountAacUUID',
    },
    // Effective profile: the group profile when the group has one, else the access profile.
    {
      id: 'profile',
      field: 'EffectiveProfileName',
      label: 'authentication.profiles',
      kind: 'text',
    },
    { id: 'expires', field: 'AaxExpiresAt', label: 'authentication.expiresAt', kind: 'datetime' },
    { id: 'status', field: 'AaxStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-accesses',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationAccessPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
