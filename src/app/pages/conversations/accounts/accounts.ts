import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { conventionalResaleAccountRowActions } from '../../../shared/crud/configurable-crud/account-resale-actions';
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
    span: 1 as const,
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

export function conversationAccountActions(canManage: () => boolean) {
  return conventionalResaleAccountRowActions('conversations', 'Cva', 'Cam', canManage);
}

export function buildAccountColumns() {
  return [
    { id: 'name', field: 'CvaName', label: 'Name', kind: 'identity' as const },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'channels', field: 'TotalChannels', label: 'Channels', kind: 'number' as const },
    {
      id: 'conversations',
      field: 'TotalConversations',
      label: 'conversations.conversations',
      kind: 'number' as const,
    },
    {
      id: 'publication',
      field: 'CvaPortalEnabled',
      label: 'conversations.portalEnabled',
      kind: 'status' as const,
    },
    { id: 'status', field: 'CvaStatus', label: 'Status', kind: 'status' as const },
  ];
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
  initialValues: { name: '', notes: '', RegCustomerRcuUUID: null, status: 1 },
  fields: [
    { key: 'name', source: 'CvaName', label: 'Name', required: true, span: 1 },
    { key: 'status', source: 'CvaStatus', label: 'Status', type: 'status', span: 1 },
    customerSelector(),
    {
      key: 'notes',
      source: 'CvaNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
    },
    { key: 'revision', source: 'CvaRevision', label: 'documents.revision', hidden: true },
  ],
  columns: buildAccountColumns(),
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
    const auth = inject(AuthService);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.conversations.accounts.all');
    super({
      ...CONVERSATIONS_ACCOUNTS_CONFIG,
      rowActions: conversationAccountActions(canManage),
    });
  }
}
