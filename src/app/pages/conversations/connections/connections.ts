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
import { openWebchatPreviewDialog } from './webchat-preview-dialog';

function parseObject(value: unknown): Record<string, unknown> | null | 'invalid' {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : 'invalid';
  } catch {
    return 'invalid';
  }
}

/** Kinds offered when creating: only channels with a working driver (decision D2). */
export const CREATABLE_CHANNEL_KINDS = CHANNEL_KINDS.filter(
  (kind) => kind.value === 'internal' || kind.value === 'webchat',
);

/** Provider routing key (`ChcExternalId`) label per channel type. */
const EXTERNAL_ID_LABELS: Record<string, string> = {
  'whatsapp-cloud': 'Phone number ID',
  'whatsapp-twilio': 'Sender number',
  instagram: 'Instagram account ID',
  messenger: 'Facebook page ID',
  telegram: 'Bot username',
  email: 'Support e-mail address',
};

const MAX_ORIGINS = 20;

/** Website chat appearance keys stored in `ChcConfig` (also the form field keys). */
export const WIDGET_LOOK_KEYS = [
  'widgetTitle',
  'widgetSubtitle',
  'widgetGreeting',
  'widgetColor',
  'widgetPosition',
] as const;

const COLOR_RE = /^#[0-9a-f]{6}$/i;

const WIDGET_POSITIONS = [
  { value: 'right', label: 'Bottom right' },
  { value: 'left', label: 'Bottom left' },
] as const;

function storedLook(value: unknown, key: string): string {
  const object = parseObject(value);
  const raw = object && object !== 'invalid' ? object[key] : '';
  return typeof raw === 'string' ? raw : '';
}

const isWebchat = (values: ConfigurableCrudRecord) => values['kind'] === 'webchat';
const isProvider = (values: ConfigurableCrudRecord) =>
  values['kind'] !== 'internal' && values['kind'] !== 'webchat';

/**
 * Exact HTTPS origin of a website address typed by a person ("www.site.com",
 * "https://site.com/contact"); '' when empty, 'invalid' when it cannot be one.
 */
export function websiteOrigin(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !url.hostname || /[*\s]/.test(text)) return 'invalid';
    if (url.username || url.password || !url.hostname.includes('.')) return 'invalid';
    return url.origin;
  } catch {
    return 'invalid';
  }
}

/** Allowed origins stored in a connection config (array, legacy comma text or `origins`). */
export function storedOrigins(config: unknown): string[] {
  const object = parseObject(config);
  if (!object || object === 'invalid') return [];
  const raw = object['allowedOrigins'] ?? object['origins'];
  const entries = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  return entries.map((entry) => String(entry ?? '').trim()).filter(Boolean);
}

function originLines(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Website chat config from the form fields, keeping stored keys the form does not edit. */
export function webchatConfig(values: ConfigurableCrudRecord): Record<string, unknown> {
  const stored = parseObject(values['storedConfig']);
  const {
    origins: _legacy,
    allowedOrigins: _origins,
    allowSubdomains: _subdomains,
    ...kept
  } = stored && stored !== 'invalid' ? stored : {};
  const rest: Record<string, unknown> = { ...kept };
  for (const key of WIDGET_LOOK_KEYS) {
    delete rest[key];
    const value = String(values[key] ?? '').trim();
    if (value) rest[key] = key === 'widgetColor' ? value.toUpperCase() : value;
  }
  const origins = [values['allowedOrigins'], ...originLines(values['otherOrigins'])]
    .map(websiteOrigin)
    .filter((origin) => origin && origin !== 'invalid');
  return {
    ...rest,
    allowedOrigins: [...new Set(origins)],
    allowSubdomains: Number(values['allowSubdomains']) === 1,
  };
}

const YES_NO = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
] as const;

const config = defineCrud({
  endpoint: 'conversations/connections',
  uuidField: 'ChcUUID',
  pageTitle: 'Channel connections',
  pageDescription:
    'Manage the channels that send messages to the inbox, including internal conversations, website chat and provider integrations.',
  createTitle: 'New channel connection',
  editTitle: 'Edit channel connection',
  dialogDescription:
    'For website chat, enter the website address, save, add the widget code to the website and reload it: the connection is verified automatically.',
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
    storedConfig: '{}',
    allowedOrigins: '',
    otherOrigins: '',
    allowSubdomains: 0,
    widgetTitle: '',
    widgetSubtitle: '',
    widgetGreeting: '',
    widgetColor: '',
    widgetPosition: 'right',
    ChcExternalId: '',
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
    { id: 'external', label: 'Provider identifier', field: 'ChcExternalId', optional: true },
    { id: 'verifiedOrigin', label: 'Verified origin', field: 'ChcVerifiedOrigin', optional: true },
    {
      id: 'sync',
      label: 'Last verification or sync',
      field: 'ChcLastSyncAt',
      kind: 'datetime',
      optional: true,
    },
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
      optionsWhen: ({ editing }) => (editing ? CHANNEL_KINDS : CREATABLE_CHANNEL_KINDS),
      translateOptions: true,
      disabledWhen: ({ editing }) => editing,
      span: 1,
    },
    {
      key: 'name',
      source: 'ChcName',
      label: 'Name',
      required: true,
      placeholder: 'Example: Website chat',
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
      key: 'storedConfig',
      source: 'ChcConfig',
      label: 'Settings',
      hidden: true,
      fromRecord: (value) => {
        const object = parseObject(value);
        return JSON.stringify(object && object !== 'invalid' ? object : {});
      },
    },
    {
      key: 'allowedOrigins',
      source: 'ChcConfig',
      label: 'Website address',
      placeholder: 'https://www.example.com',
      help: 'Address of the website where the chat appears. Only this website and the other allowed websites can open the chat.',
      requiredWhen: ({ values }) => isWebchat(values),
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => storedOrigins(value)[0] ?? '',
    },
    {
      key: 'otherOrigins',
      source: 'ChcConfig',
      label: 'Other allowed websites',
      type: 'textarea',
      placeholder: 'https://shop.example.com',
      help: 'Optional. One website address per line.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => storedOrigins(value).slice(1).join('\n'),
      span: 4,
    },
    {
      key: 'widgetTitle',
      source: 'ChcConfig',
      label: 'Chat title',
      placeholder: 'Atendimento',
      help: 'Shown at the top of the chat window. Empty uses the default title, Atendimento.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => storedLook(value, 'widgetTitle'),
    },
    {
      key: 'widgetColor',
      source: 'ChcConfig',
      label: 'Chat color',
      placeholder: '#2563EB',
      help: 'Color of the chat button and header (#RRGGBB). Empty uses blue.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => storedLook(value, 'widgetColor'),
    },
    {
      key: 'widgetPosition',
      source: 'ChcConfig',
      label: 'Chat position',
      type: 'search-select',
      options: WIDGET_POSITIONS,
      translateOptions: true,
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => storedLook(value, 'widgetPosition') || 'right',
      span: 1,
    },
    {
      key: 'widgetGreeting',
      source: 'ChcConfig',
      label: 'Welcome message',
      type: 'textarea',
      placeholder: 'Olá! Como podemos ajudar?',
      help: 'Shown to the visitor before the first message. Empty shows the subtitle.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => storedLook(value, 'widgetGreeting'),
      span: 4,
    },
    {
      key: 'ChcExternalId',
      source: 'ChcExternalId',
      label: 'Provider identifier',
      labelWhen: ({ values }) => EXTERNAL_ID_LABELS[String(values['kind'])] ?? 'Provider identifier',
      help: 'Identifier of this number, page or account at the provider. Incoming messages are routed by it.',
      hiddenWhen: ({ values }) => !isProvider(values),
    },
    {
      key: 'secret',
      label: 'Credentials (JSON or token)',
      type: 'password',
      help: 'Sealed when saved and never shown again. Leave empty to keep the stored credentials.',
      hiddenWhen: ({ values }) => !isProvider(values),
    },
    {
      key: 'clearSecret',
      label: 'Erase stored credentials',
      type: 'search-select',
      tab: 'advanced',
      options: YES_NO,
      translateOptions: true,
      hiddenWhen: ({ editing, values }) => !editing || !isProvider(values),
      span: 1,
    },
    {
      key: 'widgetSubtitle',
      source: 'ChcConfig',
      label: 'Chat subtitle',
      tab: 'advanced',
      placeholder: 'Envie sua mensagem para nossa equipe',
      help: 'Shown under the chat title. Empty uses the default subtitle.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => storedLook(value, 'widgetSubtitle'),
    },
    {
      key: 'allowSubdomains',
      source: 'ChcConfig',
      label: 'Allow subdomains',
      type: 'search-select',
      tab: 'advanced',
      options: YES_NO,
      translateOptions: true,
      help: 'Also open the chat on subdomains of each allowed website: with https://example.com allowed, shop.example.com works too. Subdomains are not verified as installed.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => {
        const object = parseObject(value);
        return object && object !== 'invalid' && object['allowSubdomains'] === true ? 1 : 0;
      },
      span: 1,
    },
  ],
  payload: (values, editing) => {
    const secretText = String(values['secret'] ?? '').trim();
    const secretJson = parseObject(secretText);
    const provider = isProvider(values);
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
      ChcExternalId: provider ? String(values['ChcExternalId'] ?? '').trim() || null : null,
      ...(isWebchat(values) ? { ChcConfig: webchatConfig(values) } : {}),
      ...(provider && secretText
        ? { ChcSecret: secretJson && secretJson !== 'invalid' ? secretJson : secretText }
        : {}),
      ...(editing && provider && Number(values['clearSecret']) === 1
        ? { ChcSecretClear: true }
        : {}),
      ChcStatus: Number(values['status']),
    };
  },
});

function appOrigin(): string {
  return typeof globalThis.location?.origin === 'string' && globalThis.location.origin
    ? globalThis.location.origin
    : 'https://portal.example.com';
}

function webchatPreviewAction(dialog: () => MatDialog): ConfigurableCrudRowAction {
  return {
    key: 'webchat-preview',
    label: 'conversations.widgetPreview',
    icon: 'visibility',
    visible: (row) => row['ChcKind'] === 'webchat',
    run: (row) => {
      const look = (key: string) => storedLook(row['ChcConfig'], key);
      openWebchatPreviewDialog(dialog(), {
        name: String(row['ChcName'] ?? ''),
        scriptUrl: `${appOrigin()}/api/v1/conversations/webchat/widget.js`,
        channelUUID: String(row['ChcUUID'] ?? ''),
        look: {
          title: look('widgetTitle'),
          subtitle: look('widgetSubtitle'),
          greeting: look('widgetGreeting'),
          color: look('widgetColor'),
          position: look('widgetPosition'),
        },
      });
    },
  };
}

function webchatEmbedAction(dialog: () => MatDialog): ConfigurableCrudRowAction {
  return {
    key: 'webchat-embed',
    label: 'conversations.embedWidget',
    icon: 'code',
    visible: (row) => row['ChcKind'] === 'webchat',
    run: (row) => {
      const origin = appOrigin();
      const channelUUID = String(row['ChcUUID'] ?? '');
      const snippet = `<script src="${origin}/api/v1/conversations/webchat/widget.js" data-channel="${channelUUID}" async></script>`;
      const websites = storedOrigins(row['ChcConfig']);
      openDataViewerDialog(dialog(), {
        title: 'conversations.embedWidgetTitle',
        description: String(row['ChcName'] ?? ''),
        details: [
          { label: 'Connection identifier', value: channelUUID, monospace: true },
          { label: 'Account', value: row['AccountName'] || '—' },
          { label: 'Allowed websites', value: websites.join(', ') || '—' },
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
      rowActions: [webchatEmbedAction(() => dialog), webchatPreviewAction(() => dialog)],
    });
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    if (payload['kind'] !== 'webchat') return true;
    if (websiteOrigin(payload['allowedOrigins']) === 'invalid') {
      return this.rejectField('allowedOrigins', 'conversations.websiteInvalid');
    }
    const lines = originLines(payload['otherOrigins']);
    const invalid = lines.find((line) => websiteOrigin(line) === 'invalid');
    if (invalid) {
      return this.rejectField('otherOrigins', 'conversations.websiteLineInvalid', {
        value: invalid,
      });
    }
    const color = String(payload['widgetColor'] ?? '').trim();
    if (color && !COLOR_RE.test(color)) {
      return this.rejectField('widgetColor', 'conversations.widgetColorInvalid');
    }
    const limits: Record<string, number> = { widgetTitle: 60, widgetSubtitle: 120, widgetGreeting: 500 };
    for (const [key, max] of Object.entries(limits)) {
      if (String(payload[key] ?? '').trim().length > max) {
        return this.rejectField(key, 'conversations.widgetTextTooLong', { max });
      }
    }
    if (lines.length + 1 > MAX_ORIGINS) {
      return this.rejectField('otherOrigins', 'conversations.websiteTooMany', {
        max: MAX_ORIGINS,
      });
    }
    return true;
  }
}
