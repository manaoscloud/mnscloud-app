import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  CONNECTION_LOOKUP,
  CONVERSATION_PRIORITIES,
  CONVERSATION_STATES,
  MEMBER_EXEMPT,
  MEMBER_LOOKUP,
  linkContactForm,
  linkedLabel,
  messagesCollection,
} from '../conversation-options';
import { watchConversationChanges } from '../conversation-events';

function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function inboxConfig(dialog: () => MatDialog): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'conversations',
    uuidField: 'CnvUUID',
    pageTitle: 'Inbox',
    pageDescription:
      'Conversations with customers and contacts from every connected channel, in one place: reply, add internal notes, assign and resolve.',
    createTitle: 'Start conversation',
    editTitle: 'Conversation settings',
    dialogDescription: 'The conversation is assigned to you when you start it.',
    emptyLabel:
      'No conversations here. New messages from the connected channels appear in this inbox.',
    savedMessage: 'Conversation saved.',
    bulkDelete: false,
    canDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    initialValues: {
      connection: '',
      name: '',
      phone: '',
      email: '',
      subject: '',
      state: 'open',
      priority: 'normal',
      assignee: '',
      snoozedUntil: '',
      revision: '',
    },
    listFilters: [
      {
        key: 'state',
        paramKey: 'state',
        label: 'State',
        type: 'select',
        span: 1,
        emptyLabel: 'Not resolved',
        options: CONVERSATION_STATES,
      },
      {
        key: 'assigned',
        paramKey: 'assigned',
        label: 'Assignee',
        type: 'select',
        span: 1,
        emptyLabel: 'Everyone',
        options: [
          { value: 'me', label: 'Assigned to me' },
          { value: 'unassigned', label: 'Unassigned' },
        ],
      },
      {
        key: 'connection',
        paramKey: 'connection',
        label: 'Channel',
        type: 'search-select',
        span: 1,
        emptyLabel: 'All channels',
        remoteLookup: CONNECTION_LOOKUP,
      },
    ],
    rowActions: [
      {
        key: 'messages',
        label: 'Messages',
        icon: 'forum',
        collection: (row) => messagesCollection(row, dialog),
      },
      {
        key: 'link',
        label: 'Link contact',
        icon: 'link',
        form: (row) => linkContactForm(row),
      },
      {
        key: 'read',
        label: 'Mark as read',
        icon: 'mark_chat_read',
        visible: (row) => Number(row['CnvUnreadCount'] ?? 0) > 0,
        request: {
          method: 'post',
          endpoint: (row) => `conversations/${row['CnvUUID']}/read`,
          successMessage: 'Conversation marked as read.',
        },
      },
    ],
    columns: [
      {
        id: 'contact',
        label: 'Contact',
        field: 'ContactName',
        uuidField: 'CnvUUID',
        kind: 'identity',
        value: (row) =>
          String(row['ContactName'] ?? row['ContactPhone'] ?? row['ContactExternalId'] ?? ''),
        detail: (row) => String(row['ContactPhone'] ?? row['ContactEmail'] ?? ''),
      },
      { id: 'channel', label: 'Channel', field: 'ChannelName' },
      { id: 'linked', label: 'Linked to', value: (row) => linkedLabel(row) },
      { id: 'last', label: 'Last message', field: 'LastMessage' },
      {
        id: 'unread',
        label: 'Unread',
        field: 'CnvUnreadCount',
        kind: 'number',
        width: 'xs',
      },
      {
        id: 'state',
        label: 'State',
        field: 'CnvState',
        kind: 'status',
        options: CONVERSATION_STATES,
        chipClass: (value) =>
          value === 'open'
            ? 'chip-running'
            : value === 'resolved'
              ? 'chip-success'
              : 'chip-warning',
      },
      {
        id: 'priority',
        label: 'Priority',
        field: 'CnvPriority',
        kind: 'status',
        options: CONVERSATION_PRIORITIES,
        chipClass: (value) =>
          value === 'urgent' ? 'chip-danger' : value === 'high' ? 'chip-warning' : 'chip-skipped',
      },
      { id: 'assignee', label: 'Assignee', field: 'AssignedName' },
      { id: 'activity', label: 'Last activity', field: 'CnvLastMessageAt', kind: 'datetime' },
      { id: 'subject', label: 'Subject', field: 'CnvSubject', optional: true },
      {
        id: 'window',
        label: 'Reply window until',
        field: 'CnvServiceWindowEndsAt',
        kind: 'datetime',
        optional: true,
      },
    ],
    fields: [
      { key: 'revision', source: 'CnvRevision', label: 'Revision', hidden: true },
      {
        key: 'connection',
        source: 'ChannelConnectionChcUUID',
        label: 'Channel',
        type: 'search-select',
        required: true,
        remoteLookup: CONNECTION_LOOKUP,
        hiddenWhen: ({ editing }) => editing,
        span: 2,
      },
      {
        key: 'name',
        source: 'ContactName',
        label: 'Contact name',
        hiddenWhen: ({ editing }) => editing,
        span: 2,
      },
      {
        key: 'phone',
        source: 'ContactPhone',
        label: 'Contact phone',
        placeholder: '+5592999990000',
        help: 'International format with the country code.',
        hiddenWhen: ({ editing }) => editing,
        span: 2,
      },
      {
        key: 'email',
        source: 'ContactEmail',
        label: 'Contact e-mail',
        type: 'email',
        hiddenWhen: ({ editing }) => editing,
        span: 2,
      },
      { key: 'subject', source: 'CnvSubject', label: 'Subject', span: 4 },
      {
        key: 'state',
        source: 'CnvState',
        label: 'State',
        type: 'search-select',
        options: CONVERSATION_STATES,
        translateOptions: true,
        hiddenWhen: ({ editing }) => !editing,
        span: 1,
      },
      {
        key: 'priority',
        source: 'CnvPriority',
        label: 'Priority',
        type: 'search-select',
        options: CONVERSATION_PRIORITIES,
        translateOptions: true,
        span: 1,
      },
      {
        key: 'assignee',
        source: 'AssignedUserUsrUUID',
        label: 'Assignee',
        type: 'search-select',
        remoteLookup: MEMBER_LOOKUP,
        quickCreate: false,
        quickCreateExemptReason: MEMBER_EXEMPT,
        hiddenWhen: ({ editing }) => !editing,
        span: 2,
      },
      {
        key: 'snoozedUntil',
        source: 'CnvSnoozedUntil',
        label: 'Snoozed until',
        type: 'datetime',
        help: 'Required when the state is Snoozed; the conversation returns to the inbox at this time.',
        hiddenWhen: ({ editing, values }) => !editing || values['state'] !== 'snoozed',
        span: 2,
      },
    ],
    payload: (values, editing) =>
      editing
        ? {
            CnvRevision: Number(values['revision']),
            CnvState: values['state'],
            CnvPriority: values['priority'],
            CnvSubject: values['subject'] || null,
            AssignedUserUsrUUID: values['assignee'] || null,
            CnvSnoozedUntil:
              values['state'] === 'snoozed' ? isoOrNull(values['snoozedUntil']) : null,
          }
        : {
            ChannelConnectionChcUUID: values['connection'],
            contact: {
              name: values['name'] || undefined,
              phone: values['phone'] || undefined,
              email: values['email'] || undefined,
            },
            CnvSubject: values['subject'] || undefined,
            CnvPriority: values['priority'] || 'normal',
          },
  });
}

@Component({
  selector: 'app-conversations-inbox',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ConversationsInboxPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const dialog = inject(MatDialog);
    super(inboxConfig(() => dialog));
    // Push gateway: new messages and changes made by colleagues show up without a manual refresh.
    watchConversationChanges(inject(ApiService), this.destroyRef, () => this.scheduleRefresh());
    this.destroyRef.onDestroy(() => this.refreshTimer && clearTimeout(this.refreshTimer));
  }

  private scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshList();
    }, 400);
  }
}
