import { Component } from '@angular/core';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { CONVERSATION_ACCOUNT_LOOKUP } from '../accounts/accounts';

/** Variables the inbox fills when a quick reply is inserted in the composer. */
export const QUICK_REPLY_VARIABLES = ['{{contato.nome}}', '{{atendente.nome}}', '{{empresa.nome}}'];

export interface QuickReply {
  CqrUUID: string;
  ConversationAccountCvaUUID?: string | null;
  AccountName?: string | null;
  CqrShortcut: string;
  CqrTitle: string;
  CqrBody: string;
  CqrSortOrder?: number;
  CqrStatus: number;
}

export const CONVERSATION_QUICK_REPLIES_CONFIG = defineCrud({
  endpoint: 'conversations/quick-replies',
  uuidField: 'CqrUUID',
  pageTitle: 'conversations.quickReplies',
  pageDescription: 'conversations.quickRepliesDescription',
  createTitle: 'conversations.newQuickReply',
  editTitle: 'conversations.editQuickReply',
  serverSidePagination: true,
  ...revisionDeletePayloads('CqrUUID', 'CqrRevision'),
  initialValues: {
    shortcut: '',
    title: '',
    body: '',
    account: null,
    sortOrder: 100,
    status: 1,
  },
  fields: [
    {
      key: 'shortcut',
      source: 'CqrShortcut',
      label: 'conversations.quickReplyShortcut',
      required: true,
      span: 1,
      help: 'conversations.quickReplyShortcutHelp',
    },
    { key: 'title', source: 'CqrTitle', label: 'Title', required: true, span: 1 },
    {
      key: 'account',
      source: 'ConversationAccountCvaUUID',
      label: 'conversations.account',
      type: 'search-select',
      span: 1,
      help: 'conversations.quickReplyAccountHelp',
      remoteLookup: CONVERSATION_ACCOUNT_LOOKUP,
    },
    { key: 'status', source: 'CqrStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'sortOrder',
      source: 'CqrSortOrder',
      label: 'conversations.quickReplyOrder',
      type: 'number',
      span: 1,
    },
    // business-description: the reply text itself, inserted in the conversation composer.
    {
      key: 'body',
      source: 'CqrBody',
      label: 'conversations.quickReplyText',
      type: 'textarea',
      required: true,
      span: 4,
      rows: 4,
      help: 'conversations.quickReplyTextHelp',
    },
    { key: 'revision', source: 'CqrRevision', label: 'documents.revision', hidden: true },
  ],
  columns: [
    {
      id: 'shortcut',
      field: 'CqrShortcut',
      label: 'conversations.quickReplyShortcut',
      kind: 'identity' as const,
    },
    { id: 'title', field: 'CqrTitle', label: 'Title' },
    { id: 'account', field: 'AccountName', label: 'conversations.account' },
    { id: 'body', field: 'CqrBody', label: 'conversations.quickReplyText' },
    { id: 'status', field: 'CqrStatus', label: 'Status', kind: 'status' as const },
  ],
});

@Component({
  selector: 'app-conversations-quick-replies',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ConversationsQuickRepliesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CONVERSATION_QUICK_REPLIES_CONFIG);
  }
}
