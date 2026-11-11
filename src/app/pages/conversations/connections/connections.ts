import { CONVERSATION_ACCOUNT_LOOKUP } from '../accounts/accounts';
import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { CHANNEL_KINDS, CHANNEL_STATES } from '../conversation-options';

function parseObject(value: unknown): Record<string, unknown> | null | 'invalid' {
  const text = String(value ?? '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : 'invalid';
  } catch {
    return 'invalid';
  }
}

const config = defineCrud({
  endpoint: 'conversations/connections',
  uuidField: 'ChcUUID',
  pageTitle: 'Channel connections',
  pageDescription:
    'Manage the channels that send messages to the inbox, including internal conversations, website chat and provider integrations.',
  createTitle: 'New channel connection',
  editTitle: 'Edit channel connection',
  dialogDescription:
    'Website chat is ready when active and does not require provider credentials. Use the embed action to install the widget. Leave credentials empty to keep stored values for other channels.',
  emptyLabel:
    'No channel connections. Create an internal or website chat channel to start conversations.',
  deleteTitle: 'Remove channel connection',
  deleteMessage:
    'Remove this connection? It stops receiving and sending, its credentials are erased and its conversations keep their history.',
  savedMessage: 'Channel connection saved.',
  deletedMessage: 'Channel connection removed.',
  deleteFailedMessage: 'Failed to remove the channel connection.',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    kind: 'internal',
    name: '',
    ConversationAccountCvaUUID: null,
    externalId: '',
    config: '',
    secret: '',
    clearSecret: 0,
    revision: '',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'ChcName', uuidField: 'ChcUUID', kind: 'identity' },
    { id: 'kind', label: 'Channel', field: 'ChcKind', options: CHANNEL_KINDS },
    { id: 'account', label: 'Account', field: 'AccountName', optional: true },
    {
      id: 'state',
      label: 'Connection',
      field: 'ChcState',
      kind: 'status',
      options: CHANNEL_STATES,
      chipClass: (value) =>
        value === 'connected' ? 'chip-success' : value === 'error' ? 'chip-failed' : 'chip-warning',
      detail: (row) => String(row['ChcLastError'] ?? ''),
    },
    { id: 'open', label: 'Open conversations', field: 'OpenConversations', kind: 'number' },
    { id: 'secret', label: 'Credentials stored', field: 'HasSecret', kind: 'boolean' },
    { id: 'external', label: 'Channel ID', field: 'ChcExternalId', optional: true },
    { id: 'sync', label: 'Last sync', field: 'ChcLastSyncAt', kind: 'datetime', optional: true },
    { id: 'status', label: 'Status', field: 'ChcStatus', kind: 'status' },
  ],
  fields: [
    { key: 'revision', source: 'ChcRevision', label: 'Revision', hidden: true },
    { key: 'status', source: 'ChcStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'kind',
      source: 'ChcKind',
      label: 'Channel',
      type: 'search-select',
      required: true,
      options: CHANNEL_KINDS,
      translateOptions: true,
      disabledWhen: ({ editing }) => editing,
      span: 1,
    },
    {
      key: 'name',
      source: 'ChcName',
      label: 'Name',
      required: true,
      placeholder: 'Example: Sales WhatsApp',
    },
    {
      key: 'ConversationAccountCvaUUID',
      source: 'ConversationAccountCvaUUID',
      label: 'Account',
      type: 'search-select',
      help: 'conversations.channelAccountHelp',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: CONVERSATION_ACCOUNT_LOOKUP,
    },
    {
      key: 'externalId',
      source: 'ChcExternalId',
      label: 'Channel ID',
      help: 'Provider identifier that routes incoming messages here (for WhatsApp, the phone number ID).',
      hiddenWhen: ({ values }) => values['kind'] === 'internal',
    },
    {
      key: 'config',
      source: 'ChcConfig',
      label: 'Settings (JSON)',
      type: 'textarea',
      format: 'json',
      help: 'Optional non-secret settings as a JSON object.',
      hiddenWhen: ({ values }) => values['kind'] === 'internal',
      span: 4,
    },
    {
      key: 'secret',
      label: 'Credentials (JSON or token)',
      type: 'password',
      help: 'Sealed when saved and never shown again. Leave empty to keep the stored credentials.',
      hiddenWhen: ({ values }) => values['kind'] === 'internal',
    },
    {
      key: 'clearSecret',
      label: 'Erase stored credentials',
      type: 'search-select',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes' },
      ],
      translateOptions: true,
      hiddenWhen: ({ editing, values }) => !editing || values['kind'] === 'internal',
      span: 1,
    },
  ],
  payload: (values, editing) => {
    const secretText = String(values['secret'] ?? '').trim();
    const secretJson = parseObject(secretText);
    const configJson = parseObject(values['config']);
    return {
      ...(editing
        ? { ChcRevision: Number(values['revision']) }
        : {
            ChcKind: values['kind'],
            ...(values['ConversationAccountCvaUUID']
              ? { ConversationAccountCvaUUID: values['ConversationAccountCvaUUID'] }
              : {}),
          }),
      ChcName: values['name'],
      ChcExternalId: values['externalId'] || null,
      ...(configJson && configJson !== 'invalid' ? { ChcConfig: configJson } : {}),
      ...(secretText
        ? { ChcSecret: secretJson && secretJson !== 'invalid' ? secretJson : secretText }
        : {}),
      ...(editing && Number(values['clearSecret']) === 1 ? { ChcSecretClear: true } : {}),
      ChcStatus: Number(values['status']),
    };
  },
});

function webchatEmbedAction(dialog: () => MatDialog): ConfigurableCrudRowAction {
  return {
    key: 'webchat-embed',
    label: 'conversations.embedWidget',
    icon: 'code',
    visible: (row) => row['ChcKind'] === 'webchat',
    run: (row) => {
      const origin =
        typeof globalThis.location?.origin === 'string' && globalThis.location.origin
          ? globalThis.location.origin
          : 'https://portal.example.com';
      const channelUUID = String(row['ChcUUID'] ?? '');
      const snippet = `<script src="${origin}/api/v1/conversations/webchat/widget.js" data-channel="${channelUUID}" async></script>`;
      const originsExample = JSON.stringify({ allowedOrigins: [origin] }, null, 2);
      openDataViewerDialog(dialog(), {
        title: 'conversations.embedWidgetTitle',
        description: String(row['ChcName'] ?? ''),
        details: [
          { label: 'Channel ID', value: channelUUID, monospace: true },
          { label: 'Account', value: row['AccountName'] || '—' },
        ],
        sections: [
          {
            title: 'conversations.embedWidgetScriptTitle',
            code: {
              title: 'HTML',
              value: snippet,
              format: 'text',
              copy: true,
            },
          },
          {
            title: 'conversations.embedWidgetOriginsTitle',
            code: {
              title: 'Settings (JSON)',
              value: originsExample,
              format: 'json',
              copy: true,
            },
          },
        ],
      });
    },
  };
}

@Component({
  selector: 'app-conversation-connections',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ConversationConnectionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const dialog = inject(MatDialog);
    super({
      ...config,
      rowActions: [webchatEmbedAction(() => dialog)],
    });
  }
}
