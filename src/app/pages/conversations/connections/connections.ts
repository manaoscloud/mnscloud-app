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
export const CREATABLE_CHANNEL_KINDS = CHANNEL_KINDS.filter((kind) =>
  ['internal', 'webchat', 'telegram'].includes(String(kind.value)),
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

/** Pre-chat form and business hours keys stored in `ChcConfig` (also the form field keys). */
export const WEBCHAT_RULE_KEYS = [
  'preChatMode',
  'hoursEnabled',
  'hoursTimezone',
  'hoursDays',
  'hoursStart',
  'hoursEnd',
  'offlineMessage',
  'offlineBehavior',
] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_DAYS = [1, 2, 3, 4, 5];

const PRE_CHAT_MODES = [
  { value: 'optional', label: 'Optional' },
  { value: 'required', label: 'Required' },
  { value: 'hidden', label: 'Do not ask' },
] as const;

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const OFFLINE_BEHAVIORS = [
  { value: 'message', label: 'Show the message and accept messages' },
  { value: 'hide', label: 'Hide the chat' },
] as const;

/** IANA time zones of this browser, with the Brazilian ones first. */
function timezoneOptions(): { value: string; label: string }[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported('timeZone') : [DEFAULT_TIMEZONE, 'America/Manaus', 'UTC'];
  const brazil = [
    'America/Sao_Paulo',
    'America/Manaus',
    'America/Belem',
    'America/Fortaleza',
    'America/Recife',
    'America/Bahia',
    'America/Cuiaba',
    'America/Campo_Grande',
    'America/Porto_Velho',
    'America/Boa_Vista',
    'America/Rio_Branco',
    'America/Noronha',
  ].filter((zone) => zones.includes(zone));
  return [...brazil, ...zones.filter((zone) => !brazil.includes(zone))].map((zone) => ({
    value: zone,
    label: zone.replaceAll('_', ' '),
  }));
}

const isWebchatHours = (values: ConfigurableCrudRecord) =>
  isWebchat(values) && Number(values['hoursEnabled']) === 1;

function storedRule(value: unknown, key: string): unknown {
  const object = parseObject(value);
  return object && object !== 'invalid' ? object[key] : undefined;
}

function storedLook(value: unknown, key: string): string {
  const object = parseObject(value);
  const raw = object && object !== 'invalid' ? object[key] : '';
  return typeof raw === 'string' ? raw : '';
}

const isWebchat = (values: ConfigurableCrudRecord) => values['kind'] === 'webchat';
const isTelegram = (values: ConfigurableCrudRecord) => values['kind'] === 'telegram';
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
/** Text of a form value; objects never stringify to "[object Object]". */
function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return typeof value === 'number' ? String(value) : '';
}

function lookConfig(values: ConfigurableCrudRecord): Record<string, unknown> {
  const look: Record<string, unknown> = {};
  for (const key of WIDGET_LOOK_KEYS) {
    const value = text(values[key]);
    if (value) look[key] = key === 'widgetColor' ? value.toUpperCase() : value;
  }
  return look;
}

function rulesConfig(values: ConfigurableCrudRecord): Record<string, unknown> {
  const rules: Record<string, unknown> = {};
  const mode = text(values['preChatMode']);
  if (mode === 'required' || mode === 'hidden') rules['preChatMode'] = mode;
  if (Number(values['hoursEnabled']) !== 1) return rules;
  const days = Array.isArray(values['hoursDays']) ? values['hoursDays'] : [];
  const message = text(values['offlineMessage']);
  return {
    ...rules,
    hoursEnabled: true,
    hoursTimezone: text(values['hoursTimezone']) || DEFAULT_TIMEZONE,
    hoursDays: [...new Set(days.map(Number))].sort((a, b) => a - b),
    hoursStart: text(values['hoursStart']),
    hoursEnd: text(values['hoursEnd']),
    ...(message ? { offlineMessage: message } : {}),
    offlineBehavior: values['offlineBehavior'] === 'hide' ? 'hide' : 'message',
  };
}

/** Website chat config from the form fields, keeping stored keys the form does not edit. */
export function webchatConfig(values: ConfigurableCrudRecord): Record<string, unknown> {
  const stored = parseObject(values['storedConfig']);
  const rest: Record<string, unknown> = { ...(stored && stored !== 'invalid' ? stored : {}) };
  for (const key of ['origins', 'allowedOrigins', 'allowSubdomains', ...WIDGET_LOOK_KEYS, ...WEBCHAT_RULE_KEYS]) {
    delete rest[key];
  }
  const origins = [values['allowedOrigins'], ...originLines(values['otherOrigins'])]
    .map(websiteOrigin)
    .filter((origin) => origin && origin !== 'invalid');
  return {
    ...rest,
    ...lookConfig(values),
    ...rulesConfig(values),
    allowedOrigins: [...new Set(origins)],
    allowSubdomains: Number(values['allowSubdomains']) === 1,
  };
}

export type WebchatFieldError = {
  key: string;
  message: string;
  params?: Record<string, string | number>;
};

function originError(payload: ConfigurableCrudRecord): WebchatFieldError | null {
  if (websiteOrigin(payload['allowedOrigins']) === 'invalid') {
    return { key: 'allowedOrigins', message: 'conversations.websiteInvalid' };
  }
  const lines = originLines(payload['otherOrigins']);
  const invalid = lines.find((line) => websiteOrigin(line) === 'invalid');
  if (invalid) {
    return { key: 'otherOrigins', message: 'conversations.websiteLineInvalid', params: { value: invalid } };
  }
  if (lines.length + 1 > MAX_ORIGINS) {
    return { key: 'otherOrigins', message: 'conversations.websiteTooMany', params: { max: MAX_ORIGINS } };
  }
  return null;
}

function lookError(payload: ConfigurableCrudRecord): WebchatFieldError | null {
  const color = text(payload['widgetColor']);
  if (color && !COLOR_RE.test(color)) {
    return { key: 'widgetColor', message: 'conversations.widgetColorInvalid' };
  }
  const limits: Record<string, number> = { widgetTitle: 60, widgetSubtitle: 120, widgetGreeting: 500 };
  const tooLong = Object.entries(limits).find(([key, max]) => text(payload[key]).length > max);
  return tooLong
    ? { key: tooLong[0], message: 'conversations.widgetTextTooLong', params: { max: tooLong[1] } }
    : null;
}

function hoursError(payload: ConfigurableCrudRecord): WebchatFieldError | null {
  if (Number(payload['hoursEnabled']) !== 1) return null;
  const badTime = ['hoursStart', 'hoursEnd'].find((key) => !TIME_RE.test(text(payload[key])));
  if (badTime) return { key: badTime, message: 'conversations.hoursTimeInvalid' };
  if (payload['hoursStart'] === payload['hoursEnd']) {
    return { key: 'hoursEnd', message: 'conversations.hoursSameTime' };
  }
  if (text(payload['offlineMessage']).length > 500) {
    return { key: 'offlineMessage', message: 'conversations.widgetTextTooLong', params: { max: 500 } };
  }
  return null;
}

/** First invalid website chat field of the flat form payload, in form order. */
export function webchatFieldError(payload: ConfigurableCrudRecord): WebchatFieldError | null {
  if (payload['kind'] !== 'webchat') return null;
  return originError(payload) ?? lookError(payload) ?? hoursError(payload);
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
    preChatMode: 'optional',
    hoursEnabled: 0,
    hoursTimezone: DEFAULT_TIMEZONE,
    hoursDays: DEFAULT_DAYS,
    hoursStart: '08:00',
    hoursEnd: '18:00',
    offlineBehavior: 'message',
    offlineMessage: '',
    ChcExternalId: '',
    ChcSecret: '',
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
      helpWhen: ({ values }) =>
        isTelegram(values)
          ? 'Read from Telegram when the bot token is saved.'
          : 'Identifier of this number, page or account at the provider. Incoming messages are routed by it.',
      // Telegram: read from the bot token by the API, shown only after saving.
      disabledWhen: ({ values }) => isTelegram(values),
      hiddenWhen: ({ editing, values }) => !isProvider(values) || (isTelegram(values) && !editing),
    },
    {
      key: 'ChcSecret',
      label: 'Credentials (JSON or token)',
      labelWhen: ({ values }) => (isTelegram(values) ? 'Bot token' : 'Credentials (JSON or token)'),
      type: 'password',
      help: 'Sealed when saved and never shown again. Leave empty to keep the stored credentials.',
      helpWhen: ({ editing, values }) =>
        isTelegram(values)
          ? editing
            ? 'Leave empty to keep the current bot. A new token connects another bot.'
            : 'In Telegram, open @BotFather, send /newbot and paste the token here. The bot name, the webhook and the status are set automatically.'
          : 'Sealed when saved and never shown again. Leave empty to keep the stored credentials.',
      requiredWhen: ({ editing, values }) => isTelegram(values) && !editing,
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
      key: 'preChatMode',
      source: 'ChcConfig',
      label: 'Ask name and e-mail before the chat',
      type: 'search-select',
      tab: 'advanced',
      options: PRE_CHAT_MODES,
      translateOptions: true,
      help: 'Required: the visitor must enter a name and a valid e-mail before the first message.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => {
        const mode = storedRule(value, 'preChatMode');
        return mode === 'required' || mode === 'hidden' ? mode : 'optional';
      },
      span: 1,
    },
    {
      key: 'hoursEnabled',
      source: 'ChcConfig',
      label: 'Business hours',
      type: 'search-select',
      tab: 'advanced',
      options: YES_NO,
      translateOptions: true,
      help: 'Outside these hours the chat shows the offline message or is hidden.',
      hiddenWhen: ({ values }) => !isWebchat(values),
      fromRecord: (value) => (storedRule(value, 'hoursEnabled') === true ? 1 : 0),
      span: 1,
    },
    {
      key: 'hoursTimezone',
      source: 'ChcConfig',
      label: 'Time zone',
      type: 'search-select',
      tab: 'advanced',
      options: timezoneOptions(),
      translateOptions: false,
      requiredWhen: ({ values }) => isWebchatHours(values),
      hiddenWhen: ({ values }) => !isWebchatHours(values),
      fromRecord: (value) => {
        const zone = storedRule(value, 'hoursTimezone');
        return typeof zone === 'string' && zone ? zone : DEFAULT_TIMEZONE;
      },
      span: 1,
    },
    {
      key: 'hoursDays',
      source: 'ChcConfig',
      label: 'Days',
      type: 'search-select',
      multiple: true,
      tab: 'advanced',
      options: WEEKDAY_OPTIONS,
      translateOptions: true,
      requiredWhen: ({ values }) => isWebchatHours(values),
      hiddenWhen: ({ values }) => !isWebchatHours(values),
      fromRecord: (value) => {
        const days = storedRule(value, 'hoursDays');
        return Array.isArray(days) && days.length ? days.map(Number) : DEFAULT_DAYS;
      },
      span: 1,
    },
    {
      key: 'hoursStart',
      source: 'ChcConfig',
      label: 'Opens at',
      type: 'time',
      tab: 'advanced',
      requiredWhen: ({ values }) => isWebchatHours(values),
      hiddenWhen: ({ values }) => !isWebchatHours(values),
      fromRecord: (value) => {
        const time = storedRule(value, 'hoursStart');
        return typeof time === 'string' && time ? time : '08:00';
      },
    },
    {
      key: 'hoursEnd',
      source: 'ChcConfig',
      label: 'Closes at',
      type: 'time',
      tab: 'advanced',
      help: 'A closing time before the opening time ends after midnight.',
      requiredWhen: ({ values }) => isWebchatHours(values),
      hiddenWhen: ({ values }) => !isWebchatHours(values),
      fromRecord: (value) => {
        const time = storedRule(value, 'hoursEnd');
        return typeof time === 'string' && time ? time : '18:00';
      },
    },
    {
      key: 'offlineBehavior',
      source: 'ChcConfig',
      label: 'Outside business hours',
      type: 'search-select',
      tab: 'advanced',
      options: OFFLINE_BEHAVIORS,
      translateOptions: true,
      hiddenWhen: ({ values }) => !isWebchatHours(values),
      fromRecord: (value) => (storedRule(value, 'offlineBehavior') === 'hide' ? 'hide' : 'message'),
      span: 1,
    },
    {
      key: 'offlineMessage',
      source: 'ChcConfig',
      label: 'Offline message',
      type: 'textarea',
      tab: 'advanced',
      placeholder:
        'Estamos fora do horário de atendimento. Deixe sua mensagem e responderemos assim que possível.',
      help: 'Shown in the chat outside business hours. Empty uses the default text.',
      hiddenWhen: ({ values }) => !isWebchatHours(values),
      fromRecord: (value) => {
        const message = storedRule(value, 'offlineMessage');
        return typeof message === 'string' ? message : '';
      },
      span: 4,
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
    const secretText = String(values['ChcSecret'] ?? '').trim();
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
      // Telegram's bot username comes from the API; other providers keep their routing key.
      ...(isTelegram(values)
        ? {}
        : { ChcExternalId: provider ? String(values['ChcExternalId'] ?? '').trim() || null : null }),
      ...(isWebchat(values) ? { ChcConfig: webchatConfig(values) } : {}),
      ...(provider && secretText
        ? {
            ChcSecret:
              !isTelegram(values) && secretJson && secretJson !== 'invalid' ? secretJson : secretText,
          }
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
        // Same rules as the public appearance: an invalid stored value never shows here.
        look: {
          title: look('widgetTitle').slice(0, 60),
          subtitle: look('widgetSubtitle').slice(0, 120),
          greeting: look('widgetGreeting').slice(0, 500),
          color: COLOR_RE.test(look('widgetColor')) ? look('widgetColor') : '',
          position: look('widgetPosition') === 'left' ? 'left' : '',
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
    const error = webchatFieldError(payload);
    return error ? this.rejectField(error.key, error.message, error.params) : true;
  }
}
