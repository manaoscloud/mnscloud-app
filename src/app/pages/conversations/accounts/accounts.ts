import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const CONVERSATION_ACCOUNT_LOOKUP = {
  endpoint: 'conversations/accounts?status=1',
  uuidField: 'CvaUUID',
  labelField: 'CvaName',
  selectedLabelField: 'AccountName',
};

export function customerSelector() {
  return {
    key: 'RegCustomerRcuUUID',
    source: 'RegCustomerRcuUUID',
    label: 'Customer',
    type: 'search-select' as const,
    span: 2 as const,
    help: 'conversations.accountCustomerHelp',
    disabledWhen: ({ editing }: { editing: boolean }) => editing,
    remoteLookup: {
      endpoint: 'registry/customers?status=1',
      uuidField: 'CustomerUUID',
      labelField: 'Name',
      selectedLabelField: 'CustomerName',
    },
  };
}

export function portalPublicationCrud(accountUUID: string, portalEnabled: unknown, rev: unknown) {
  return defineCrud({
    endpoint: `conversations/accounts/${accountUUID}/portal`,
    uuidField: 'CvaUUID',
    pageTitle: 'conversations.publication',
    pageDescription: 'conversations.publicationDescription',
    initialValues: { enabled: portalEnabled, revision: rev },
    fields: [
      {
        key: 'enabled',
        label: 'conversations.portalEnabled',
        type: 'select',
        span: 2,
        options: [
          { value: 1, label: 'Yes' },
          { value: 0, label: 'No' },
        ],
      },
      { key: 'revision', label: 'documents.revision', hidden: true },
    ],
    columns: [],
  });
}

export function operatorAssignmentCrud(accountUUID: string) {
  return defineCrud({
    endpoint: `conversations/accounts/${accountUUID}/members`,
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
        span: 2,
        remoteLookup: {
          endpoint: 'user/access/members',
          uuidField: 'UserUUID',
          labelField: 'Name',
        },
        quickCreate: false,
        quickCreateExemptReason: 'Tenant operators must be invited through tenant access management.',
      },
      { key: 'status', label: 'Status', type: 'status', span: 2 },
    ],
    columns: [],
  });
}

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
    { key: 'name', source: 'CvaName', label: 'Name', required: true, span: 2 },
    { key: 'status', source: 'CvaStatus', label: 'Status', type: 'status', span: 2 },
    customerSelector(),
    {
      key: 'description',
      source: 'CvaDescription',
      label: 'Description',
      type: 'textarea',
      span: 4,
    },
    { key: 'revision', source: 'CvaRevision', label: 'documents.revision', hidden: true },
  ],
  columns: [
    { id: 'name', field: 'CvaName', label: 'Name', kind: 'identity' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'channels', field: 'TotalChannels', label: 'Channels', kind: 'number' },
    { id: 'conversations', field: 'TotalConversations', label: 'conversations.conversations', kind: 'number' },
    { id: 'publication', field: 'CvaPortalEnabled', label: 'conversations.portalEnabled', kind: 'status' },
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
  protected readonly accountConfig = CONVERSATIONS_ACCOUNTS_CONFIG;

  constructor() {
    super({
      ...CONVERSATIONS_ACCOUNTS_CONFIG,
      rowActions: [
        {
          key: 'publication',
          label: 'conversations.publication',
          icon: 'public',
          visible: (row) => Boolean(row['RegCustomerRcuUUID']),
          form: (row) => portalPublicationCrud(String(row['CvaUUID']), row['CvaPortalEnabled'], row['CvaRevision']),
        },
        {
          key: 'assign',
          label: 'conversations.assignOperator',
          icon: 'person_add',
          form: (row) => operatorAssignmentCrud(String(row['CvaUUID'])),
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
