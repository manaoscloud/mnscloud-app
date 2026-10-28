import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const CONVERSATIONS_ACCOUNTS_CONFIG = defineCrud({
  endpoint: 'conversations/accounts',
  uuidField: 'CvaUUID',
  pageTitle: 'conversations.accounts',
  pageDescription: 'conversations.accountsDescription',
  createTitle: 'conversations.newAccount',
  editTitle: 'conversations.editAccount',
  serverSidePagination: true,
  bulkDelete: false,
  ...revisionDeletePayloads('CvaUUID', 'CvaRevision'),
  initialValues: { name: '', description: '', RegCustomerRcuUUID: null, status: 1 },
  fields: [
    { key: 'status', source: 'CvaStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'CvaName', label: 'Name', required: true, span: 1 },
    {
      key: 'RegCustomerRcuUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      span: 1,
      help: 'conversations.accountCustomerHelp',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'registry/customers?status=1',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
    },
    {
      key: 'description',
      source: 'CvaDescription',
      label: 'Description',
      type: 'textarea',
      span: 1,
    },
    { key: 'revision', source: 'CvaRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'CvaName', label: 'Name', kind: 'identity' },
    { id: 'publication', field: 'CvaPortalEnabled', label: 'conversations.portalEnabled', kind: 'status' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'status', field: 'CvaStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-conversations-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ConversationsAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super({
      ...CONVERSATIONS_ACCOUNTS_CONFIG,
      rowActions: [
        {
          key: 'publication',
          label: 'conversations.publication',
          icon: 'public',
          visible: (row) => Boolean(row['RegCustomerRcuUUID']),
          form: (row) =>
            defineCrud({
              endpoint: `conversations/accounts/${row['CvaUUID']}/portal`,
              uuidField: 'CvaUUID',
              pageTitle: 'conversations.publication',
              pageDescription: 'conversations.publicationDescription',
              initialValues: { enabled: row['CvaPortalEnabled'], revision: row['CvaRevision'] },
              fields: [
                {
                  key: 'enabled',
                  label: 'conversations.portalEnabled',
                  type: 'select',
                  span: 2,
                  options: [
                    { value: 0, label: 'No' },
                    { value: 1, label: 'Yes' },
                  ],
                },
                { key: 'revision', label: 'documents.revision', hiddenWhen: () => true },
              ],
              columns: [],
            }),
        },
        {
          key: 'assign',
          label: 'conversations.assignOperator',
          icon: 'person_add',
          form: (row) =>
            defineCrud({
              endpoint: `conversations/accounts/${row['CvaUUID']}/members`,
              uuidField: 'CvaUUID',
              pageTitle: 'conversations.assignOperator',
              pageDescription: 'conversations.operatorsDescription',
              initialValues: { UserUsrUUID: '', status: 1 },
              fields: [
                {
                  key: 'UserUsrUUID',
                  source: 'UserUsrUUID',
                  label: 'User',
                  type: 'search-select',
                  required: true,
                  span: 1,
                  remoteLookup: {
                    endpoint: 'user/access/members',
                    uuidField: 'UserUUID',
                    labelField: 'Name',
                  },
                  quickCreate: false,
                  quickCreateExemptReason:
                    'Tenant operators must be invited through tenant access management.',
                },
                { key: 'status', label: 'Status', type: 'status', span: 1 },
              ],
              columns: [],
            }),
        },
        {
          key: 'operators',
          label: 'conversations.operators',
          icon: 'group',
          collection: (row) =>
            defineCrud({
              endpoint: `conversations/accounts/${row['CvaUUID']}/members`,
              uuidField: 'CamUUID',
              pageTitle: 'conversations.operators',
              pageDescription: 'conversations.operatorsDescription',
              readOnly: true,
              fields: [],
              columns: [
                { id: 'user', field: 'UsrName', label: 'User', kind: 'identity' },
                { id: 'email', field: 'UsrEmail', label: 'Email' },
                { id: 'status', field: 'CamStatus', label: 'Status', kind: 'status' },
              ],
            }),
        },
      ],
    });
  }
}
