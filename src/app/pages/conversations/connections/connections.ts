import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
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
    'Channels that feed the inbox: the internal channel of the team now, and WhatsApp, website chat and other channels as they are connected. Credentials are stored sealed and never shown again.',
  createTitle: 'New channel connection',
  editTitle: 'Edit channel connection',
  dialogDescription:
    'Leave the credentials empty to keep the stored ones. Connecting WhatsApp and the website chat comes in the next releases.',
  emptyLabel: 'No channel connections. Create an internal channel to start conversations now.',
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
    externalId: '',
    config: '',
    secret: '',
    clearSecret: 0,
    revision: '',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'ChcName', uuidField: 'ChcUUID', kind: 'identity' },
    { id: 'kind', label: 'Channel', field: 'ChcKind', options: CHANNEL_KINDS },
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
      span: 2,
    },
    {
      key: 'externalId',
      source: 'ChcExternalId',
      label: 'Channel ID',
      help: 'Provider identifier that routes incoming messages here (for WhatsApp, the phone number ID).',
      hiddenWhen: ({ values }) => values['kind'] === 'internal',
      span: 2,
    },
    {
      key: 'config',
      source: 'ChcConfig',
      label: 'Settings (JSON)',
      type: 'textarea',
      format: 'json',
      rows: 3,
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
      span: 3,
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
      ...(editing ? { ChcRevision: Number(values['revision']) } : { ChcKind: values['kind'] }),
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

@Component({
  selector: 'app-conversation-connections',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ConversationConnectionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
