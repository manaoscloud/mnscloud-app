import { MatDialog } from '@angular/material/dialog';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';

/** Channel types of a connection (API `ChcKind`). */
export const CHANNEL_KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'internal', label: 'Internal (team only)' },
  { value: 'webchat', label: 'Website chat' },
  { value: 'whatsapp-cloud', label: 'WhatsApp (Cloud API)' },
  { value: 'whatsapp-twilio', label: 'WhatsApp (Twilio)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'E-mail' },
];

export const CHANNEL_STATES: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Waiting for setup' },
  { value: 'connected', label: 'Connected' },
  { value: 'disconnected', label: 'Disconnected' },
  { value: 'error', label: 'Error' },
];

export const CONVERSATION_STATES: readonly ConfigurableCrudOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Waiting for the contact' },
  { value: 'snoozed', label: 'Snoozed' },
  { value: 'resolved', label: 'Resolved' },
];

export const CONVERSATION_PRIORITIES: readonly ConfigurableCrudOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const MESSAGE_AUTHORS: readonly ConfigurableCrudOption[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'agent', label: 'Team' },
  { value: 'bot', label: 'Bot' },
  { value: 'system', label: 'System' },
];

export const MESSAGE_DELIVERY: readonly ConfigurableCrudOption[] = [
  { value: 'received', label: 'Received' },
  { value: 'queued', label: 'Waiting to send' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'read', label: 'Read' },
  { value: 'failed', label: 'Failed' },
];

export const MESSAGE_KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'text', label: 'Reply to the contact' },
  { value: 'note', label: 'Internal note' },
];

export const CONNECTION_LOOKUP = {
  endpoint: 'conversations/connections',
  uuidField: 'ChcUUID',
  labelField: 'ChcName',
  selectedLabelField: 'ChannelName',
  searchParam: 'search',
} as const;

export const MEMBER_LOOKUP = {
  endpoint: 'conversations/members',
  uuidField: 'UsrUUID',
  labelField: 'UsrName',
  selectedLabelField: 'AssignedName',
  searchParam: 'search',
} as const;

export const MEMBER_EXEMPT =
  'Assignment selects existing tenant members; membership is managed through the canonical tenant invitation flow.';

function optionLabel(options: readonly ConfigurableCrudOption[], value: unknown): string {
  return String(options.find((option) => option.value === value)?.label ?? value ?? '');
}

/** Whole message with who wrote it and when (the list cell truncates long text). */
function viewMessageAction(
  dialog: () => MatDialog,
  conversation: ConfigurableCrudRecord,
): ConfigurableCrudRowAction {
  return {
    key: 'view-message',
    label: 'View message',
    icon: 'visibility',
    run: (row) => {
      openDataViewerDialog(dialog(), {
        title: 'Message',
        description: String(conversation['ContactName'] ?? conversation['ContactExternalId'] ?? ''),
        details: [
          { label: 'Date', value: row['CnmSentAt'], kind: 'datetime' },
          {
            label: 'Author',
            value: optionLabel(MESSAGE_AUTHORS, row['CnmAuthorType']),
            translate: true,
          },
          { label: 'Name', value: row['AuthorName'] ?? conversation['ContactName'] },
          {
            label: 'Delivery',
            value: optionLabel(MESSAGE_DELIVERY, row['CnmDelivery']),
            translate: true,
          },
          ...(row['CnmError'] ? [{ label: 'Error', value: row['CnmError'] }] : []),
        ],
        sections: [{ title: 'Message', message: row['CnmBody'] }],
      });
    },
  };
}

/** Messages of one conversation: replies to the contact and internal notes of the team. */
export function messagesCollection(
  conversation: ConfigurableCrudRecord,
  dialog: () => MatDialog,
): ConfigurableCrudConfig {
  const uuid = String(conversation['CnvUUID'] ?? '');
  const windowClosed = conversation['WindowOpen'] === false;
  return defineCrud({
    endpoint: `conversations/${uuid}/messages`,
    uuidField: 'CnmUUID',
    pageTitle: 'Conversation',
    pageDescription: [
      conversation['ContactName'],
      conversation['ContactPhone'],
      conversation['ChannelName'],
    ]
      .filter(Boolean)
      .join(' · '),
    createTitle: 'Reply or add a note',
    dialogDescription: windowClosed
      ? 'The reply window of this channel is closed: only internal notes can be added now.'
      : 'Replies go to the contact through the channel; internal notes stay with the team.',
    emptyLabel: 'No messages yet.',
    savedMessage: 'Message recorded.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialPageSize: 25,
    rowActions: [viewMessageAction(dialog, conversation)],
    initialValues: { body: '', kind: windowClosed ? 'note' : 'text' },
    fields: [
      { key: 'body', label: 'Message', type: 'textarea', rows: 5, span: 4, required: true },
      {
        key: 'kind',
        label: 'Message type',
        type: 'search-select',
        options: windowClosed
          ? MESSAGE_KINDS.filter((kind) => kind.value === 'note')
          : MESSAGE_KINDS,
        translateOptions: true,
        help: 'Internal notes are never sent to the contact.',
        span: 2,
      },
    ],
    payload: (values) => ({ kind: values['kind'] || 'text', body: values['body'] }),
    columns: [
      { id: 'date', field: 'CnmSentAt', label: 'Date', kind: 'datetime' },
      {
        id: 'author',
        field: 'CnmAuthorType',
        label: 'Author',
        kind: 'status',
        options: MESSAGE_AUTHORS,
        chipClass: (value) =>
          value === 'agent'
            ? 'chip-running'
            : value === 'contact'
              ? 'chip-success'
              : 'chip-skipped',
        detail: (row) =>
          String(
            row['AuthorName'] ??
              (row['CnmAuthorType'] === 'contact' ? (conversation['ContactName'] ?? '') : ''),
          ),
      },
      {
        id: 'message',
        field: 'CnmBody',
        label: 'Message',
        rowAction: 'view-message',
        value: (row, translate) =>
          (row['CnmDirection'] === 'internal' ? `[${translate('Internal note')}] ` : '') +
          String(row['CnmBody'] ?? ''),
      },
      {
        id: 'delivery',
        field: 'CnmDelivery',
        label: 'Delivery',
        kind: 'status',
        options: MESSAGE_DELIVERY,
        chipClass: (value) =>
          value === 'failed' ? 'chip-failed' : value === 'queued' ? 'chip-queued' : 'chip-success',
      },
    ],
  });
}
