import type {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { YES_NO_OPTIONS, formFlag, formText, optionLabel } from './network-options';

/**
 * Device credentials of the Network module (ST-C). The value goes to the vault through a queued
 * operation and never comes back: the list shows only kind, username, state, stored version and
 * the SSH public key. Pure helpers here; the table flow lives in `devices/device-credentials.ts`.
 */
export const CREDENTIAL_KINDS = [
  'password',
  'ssh_key',
  'api_token',
  'enable_password',
  'snmp_v2c',
  'snmp_v3',
] as const;
export type NetworkCredentialKind = (typeof CREDENTIAL_KINDS)[number];

function keyOptions(prefix: string, values: readonly string[]): readonly ConfigurableCrudOption[] {
  return values.map((value) => ({ value, label: `${prefix}.${value}` }));
}

export const CREDENTIAL_KIND_OPTIONS = keyOptions('network.credentialKind', CREDENTIAL_KINDS);

/** Protocol names stay literal (`translateOptions: false`). */
const literalOptions = (values: readonly string[]): readonly ConfigurableCrudOption[] =>
  values.map((value) => ({ value, label: value.toUpperCase() }));

export const SNMP_AUTH_OPTIONS = literalOptions([
  'sha256',
  'sha384',
  'sha512',
  'sha224',
  'sha',
  'md5',
]);
export const SNMP_PRIV_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'network.snmpNoPrivacy' },
  ...literalOptions(['aes', 'aes192', 'aes256', 'des']),
];

const SSH_MODE_OPTIONS = keyOptions('network.sshKeyMode', ['generate', 'import']);
const VALUE_MODE_OPTIONS = keyOptions('network.credentialValueMode', ['keep', 'replace']);

/** Kinds that need a username, and kinds that have none (the API enforces both). */
const USERNAME_REQUIRED: readonly string[] = ['password', 'ssh_key', 'snmp_v3'];
const USERNAME_FORBIDDEN: readonly string[] = ['enable_password', 'snmp_v2c'];

/** Value fields of each kind (request keys; never read back, never prefilled). */
const VALUE_FIELDS: Readonly<Record<NetworkCredentialKind, readonly string[]>> = {
  password: ['password'],
  ssh_key: ['mode', 'privateKey'],
  api_token: ['token'],
  enable_password: ['password'],
  snmp_v2c: ['community'],
  snmp_v3: ['authProtocol', 'authPassword', 'privProtocol', 'privPassword'],
};
export const CREDENTIAL_VALUE_KEYS: readonly string[] = [
  ...new Set(Object.values(VALUE_FIELDS).flat()),
];

/** Operation states the worker still has to finish. */
const ACTIVE_OPERATION_STATES: readonly string[] = ['queued', 'running', 'retry'];

export function credentialKind(row: ConfigurableCrudRecord): string {
  return String(row['NwcKind'] ?? row['kind'] ?? '');
}

export function credentialOperationActive(row: ConfigurableCrudRecord): boolean {
  return ACTIVE_OPERATION_STATES.includes(String(row['OperationState'] ?? ''));
}

/**
 * State shown in the list. A stored credential stays `stored` while its replacement is in flight,
 * so the operation state completes it: `processing` while queued/running, `failed` when the last
 * operation failed.
 */
export function credentialDisplayState(row: ConfigurableCrudRecord): string {
  const state = String(row['NwcState'] ?? '');
  if (state === 'deleting') return 'deleting';
  if (credentialOperationActive(row)) return 'processing';
  if (String(row['OperationState'] ?? '') === 'failed') return 'failed';
  return state || 'pending';
}

export function credentialStateChip(row: ConfigurableCrudRecord): string {
  switch (credentialDisplayState(row)) {
    case 'stored':
      return 'chip-success';
    case 'processing':
      return 'chip-running';
    case 'failed':
      return 'chip-failed';
    case 'deleting':
      return 'chip-warning';
    default:
      return 'chip-queued';
  }
}

/** The vault value is being written or removed: editing and removing wait for the worker. */
export function credentialBusy(row: ConfigurableCrudRecord): boolean {
  return credentialDisplayState(row) === 'deleting' || credentialOperationActive(row);
}

function accessText(row: ConfigurableCrudRecord, translate: (key: string) => string): string {
  const method = formText(row['AccessMethod']);
  if (!method) return translate('network.credentialAnyAccess');
  const port = formText(row['AccessPort']);
  const label = translate(`network.method.${method}`);
  return port ? `${label} :${port}` : label;
}

export const CREDENTIAL_COLUMNS: ConfigurableCrudColumn[] = [
  {
    id: 'kind',
    label: 'network.credentialKindLabel',
    field: 'NwcKind',
    kind: 'identity',
    uuidField: 'NwcUUID',
    value: (row, translate) =>
      translate(optionLabel(CREDENTIAL_KIND_OPTIONS, row['NwcKind']) || credentialKind(row)),
    detail: (row, translate) =>
      Number(row['NwcIsPrimary']) === 1 ? translate('network.primary') : '',
  },
  { id: 'username', label: 'Username', field: 'NwcUsername' },
  {
    id: 'access',
    label: 'network.accessMethod',
    field: 'AccessMethod',
    value: (row, translate) => accessText(row, translate),
  },
  {
    id: 'state',
    label: 'network.credentialState',
    field: 'NwcState',
    kind: 'status',
    chipClass: (_value, row) => credentialStateChip(row),
    value: (row, translate) =>
      translate(`network.credentialStateValue.${credentialDisplayState(row)}`),
  },
  { id: 'version', label: 'network.credentialVersion', field: 'NwcVaultVersion', kind: 'number' },
  {
    id: 'fingerprint',
    label: 'network.hostKey',
    field: 'NwcPublicKeyFingerprint',
    width: 'md',
    optional: true,
  },
  {
    id: 'updated',
    label: 'network.credentialUpdatedAt',
    field: 'NwcDateUpdated',
    kind: 'datetime',
  },
];

const kindOf = (values: ConfigurableCrudRecord) => String(values['kind'] ?? '');
/** Value fields show on create and when the edit dialog replaces the value. */
const writesValue = ({ editing, values }: { editing: boolean; values: ConfigurableCrudRecord }) =>
  !editing || values['valueMode'] === 'replace';
const valueOf =
  (...kinds: NetworkCredentialKind[]) =>
  (context: { editing: boolean; values: ConfigurableCrudRecord }) =>
    !writesValue(context) || !kinds.includes(kindOf(context.values) as NetworkCredentialKind);

export function credentialFields(): ConfigurableCrudField[] {
  return [
    {
      key: 'kind',
      source: 'NwcKind',
      label: 'network.credentialKindLabel',
      type: 'select',
      options: CREDENTIAL_KIND_OPTIONS,
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
      help: 'network.credentialKindHelp',
    },
    {
      key: 'accessUUID',
      source: 'NetworkDeviceAccessNweUUID',
      label: 'network.accessMethod',
      type: 'select',
      span: 1,
      help: 'network.credentialAccessHelp',
    },
    {
      key: 'username',
      source: 'NwcUsername',
      label: 'Username',
      span: 1,
      autocomplete: 'off',
      reportMask: false,
      hiddenWhen: ({ values }) => USERNAME_FORBIDDEN.includes(kindOf(values)),
      requiredWhen: ({ values }) => USERNAME_REQUIRED.includes(kindOf(values)),
    },
    {
      key: 'isPrimary',
      source: 'NwcIsPrimary',
      label: 'network.primary',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
      help: 'network.credentialPrimaryHelp',
    },
    {
      key: 'valueMode',
      label: 'network.credentialValue',
      type: 'select',
      options: VALUE_MODE_OPTIONS,
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ editing }) => !editing,
      help: 'network.credentialValueModeHelp',
    },
    {
      key: 'mode',
      label: 'network.sshKeyModeLabel',
      type: 'select',
      options: SSH_MODE_OPTIONS,
      tab: 'authentication',
      span: 1,
      hiddenWhen: valueOf('ssh_key'),
      requiredWhen: (context) => !valueOf('ssh_key')(context),
      help: 'network.sshKeyModeHelp',
    },
    {
      key: 'privateKey',
      label: 'network.sshPrivateKey',
      type: 'textarea',
      tab: 'authentication',
      span: 4,
      rows: 4,
      autocomplete: 'off',
      hiddenWhen: (context) => valueOf('ssh_key')(context) || context.values['mode'] !== 'import',
      requiredWhen: (context) =>
        !valueOf('ssh_key')(context) && context.values['mode'] === 'import',
      help: 'network.sshPrivateKeyHelp',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'new-password',
      generatedPasswordLength: 20,
      hiddenWhen: valueOf('password', 'enable_password'),
      requiredWhen: (context) => !valueOf('password', 'enable_password')(context),
    },
    {
      key: 'token',
      label: 'network.apiToken',
      type: 'password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'off',
      hiddenWhen: valueOf('api_token'),
      requiredWhen: (context) => !valueOf('api_token')(context),
    },
    {
      key: 'community',
      label: 'network.snmpCommunity',
      type: 'password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'off',
      hiddenWhen: valueOf('snmp_v2c'),
      requiredWhen: (context) => !valueOf('snmp_v2c')(context),
    },
    {
      key: 'authProtocol',
      label: 'network.snmpAuthProtocol',
      type: 'select',
      options: SNMP_AUTH_OPTIONS,
      translateOptions: false,
      tab: 'authentication',
      span: 1,
      hiddenWhen: valueOf('snmp_v3'),
      requiredWhen: (context) => !valueOf('snmp_v3')(context),
    },
    {
      key: 'authPassword',
      label: 'network.snmpAuthPassword',
      type: 'password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'new-password',
      generatedPasswordLength: 20,
      hiddenWhen: valueOf('snmp_v3'),
      requiredWhen: (context) => !valueOf('snmp_v3')(context),
      help: 'network.snmpPasswordHelp',
    },
    {
      key: 'privProtocol',
      label: 'network.snmpPrivProtocol',
      type: 'select',
      options: SNMP_PRIV_OPTIONS,
      tab: 'authentication',
      span: 1,
      hiddenWhen: valueOf('snmp_v3'),
    },
    {
      key: 'privPassword',
      label: 'network.snmpPrivPassword',
      type: 'password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'new-password',
      generatedPasswordLength: 20,
      hiddenWhen: (context) => valueOf('snmp_v3')(context) || !context.values['privProtocol'],
      requiredWhen: (context) => !valueOf('snmp_v3')(context) && !!context.values['privProtocol'],
      help: 'network.snmpPasswordHelp',
    },
    { key: 'revision', source: 'NwcRevision', label: 'Revision', hidden: true },
    {
      key: 'vaultVersion',
      source: 'NwcVaultVersion',
      label: 'network.credentialVersion',
      hidden: true,
    },
    {
      key: 'notes',
      source: 'NwcNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ];
}

/** Empty value fields: every dialog starts with them blank, and closing clears them again. */
export function blankCredentialValues(): ConfigurableCrudRecord {
  return {
    mode: 'generate',
    privateKey: '',
    password: '',
    token: '',
    community: '',
    authProtocol: 'sha256',
    authPassword: '',
    privProtocol: 'aes',
    privPassword: '',
  };
}

export function credentialInitialValues(): ConfigurableCrudRecord {
  return {
    kind: 'password',
    accessUUID: '',
    username: '',
    isPrimary: 0,
    valueMode: 'replace',
    revision: null,
    vaultVersion: 0,
    notes: '',
    ...blankCredentialValues(),
  };
}

/** Value fields of the kind, as the API expects them (secrets untrimmed). */
function valueBody(kind: string, values: ConfigurableCrudRecord): ConfigurableCrudRecord {
  const secret = (key: string) => String(values[key] ?? '');
  switch (kind) {
    case 'password':
    case 'enable_password':
      return { password: secret('password') };
    case 'api_token':
      return { token: secret('token') };
    case 'snmp_v2c':
      return { community: secret('community') };
    case 'snmp_v3': {
      const privProtocol = formText(values['privProtocol']);
      return {
        authProtocol: values['authProtocol'],
        authPassword: secret('authPassword'),
        ...(privProtocol ? { privProtocol, privPassword: secret('privPassword') } : {}),
      };
    }
    case 'ssh_key':
      return values['mode'] === 'import'
        ? { mode: 'import', privateKey: secret('privateKey') }
        : { mode: 'generate' };
    default:
      return {};
  }
}

/**
 * Request body of a credential dialog. Create: kind, metadata and the value (`expectedVersion` 0).
 * Edit: metadata with the revision; with `valueMode = replace` also the new value and the stored
 * version it replaces. The kind never changes and a username is never sent for kinds without one.
 */
export function credentialPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const kind = kindOf(values);
  const metadata: ConfigurableCrudRecord = {
    accessUUID: formText(values['accessUUID']),
    isPrimary: formFlag(values['isPrimary'], 0),
    notes: formText(values['notes']),
    ...(USERNAME_FORBIDDEN.includes(kind) ? {} : { username: formText(values['username']) }),
  };
  if (!editing) return { kind, expectedVersion: 0, ...metadata, ...valueBody(kind, values) };
  const replace = values['valueMode'] === 'replace';
  return {
    revision: String(values['revision'] ?? ''),
    ...metadata,
    ...(replace
      ? { expectedVersion: Number(values['vaultVersion'] ?? 0), ...valueBody(kind, values) }
      : {}),
  };
}

/** Row actions of the credentials table; values are never read back, only replaced. */
export function credentialRowActions(canWrite: boolean): ConfigurableCrudRowAction[] {
  const operation = (row: ConfigurableCrudRecord) => Boolean(formText(row['OperationUUID']));
  return [
    {
      key: 'replace',
      label: 'network.replaceCredentialValue',
      icon: 'key',
      visible: (row) => canWrite && !credentialBusy(row),
    },
    {
      key: 'retry',
      label: 'network.retryCredentialOperation',
      icon: 'refresh',
      visible: (row) =>
        canWrite && operation(row) && String(row['OperationState'] ?? '') === 'failed',
    },
    {
      key: 'check',
      label: 'network.checkCredentialOperation',
      icon: 'sync',
      visible: (row) => operation(row) && credentialOperationActive(row),
    },
    {
      key: 'publicKey',
      label: 'network.copyPublicKey',
      icon: 'content_copy',
      visible: (row) => credentialKind(row) === 'ssh_key' && Boolean(formText(row['NwcPublicKey'])),
    },
  ];
}

/** Translation key of a credential API error code, or null for the generic message. */
const ERROR_KEYS: Readonly<Record<string, string>> = {
  REMOTE_ACCESS_VAULT_NOT_ENROLLED: 'network.credentialError.vaultNotEnrolled',
  REMOTE_ACCESS_VAULT_AMBIGUOUS: 'network.credentialError.vaultUnavailable',
  OPERATION_ENCRYPTION_UNAVAILABLE: 'network.credentialError.vaultUnavailable',
  HUMAN_SESSION_REQUIRED: 'network.credentialError.humanSession',
  NETWORK_CREDENTIAL_NOT_FOUND: 'network.credentialError.notFound',
  NETWORK_REVISION_CONFLICT: 'network.credentialError.revisionConflict',
  NETWORK_CREDENTIAL_VERSION_CONFLICT: 'network.credentialError.revisionConflict',
  NETWORK_CREDENTIAL_OPERATION_IN_PROGRESS: 'network.credentialError.inProgress',
  NETWORK_CREDENTIAL_DELETING: 'network.credentialError.deleting',
  NETWORK_IDEMPOTENCY_CONFLICT: 'network.credentialError.idempotency',
};

export function credentialErrorKey(error: unknown): string | null {
  const code = String(
    (error as { error?: { code?: unknown } } | null)?.error?.code ?? '',
  ).toUpperCase();
  if (!code) return null;
  if (ERROR_KEYS[code]) return ERROR_KEYS[code];
  return code.startsWith('VAULT_') ? 'network.credentialError.vaultUnavailable' : null;
}

/** Credentials tab of a device form: `<base>/devices/<device>/credentials`. */
export function credentialCollectionConfig(
  endpoint: string,
  canWrite: boolean,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint,
    updateEndpoint: endpoint,
    uuidField: 'NwcUUID',
    pageTitle: 'network.credentials',
    pageDescription: 'network.credentialDialogDescription',
    createTitle: 'network.newCredential',
    editTitle: 'network.editCredential',
    createLabel: 'network.newCredential',
    dialogDescription: 'network.credentialDialogDescription',
    emptyLabel: 'network.noCredentials',
    deleteTitle: 'network.deleteCredential',
    deleteMessage: 'network.deleteCredentialMessage',
    savedMessage: 'network.credentialSaved',
    deletedMessage: 'network.credentialDeleted',
    deleteFailedMessage: 'network.credentialDeleteFailed',
    tabLabels: { authentication: 'network.credentialValue' },
    // Each deletion carries its own revision and operation; there is no bulk endpoint.
    bulkDelete: false,
    statusFilter: false,
    canCreate: canWrite,
    canEdit: canWrite,
    canDelete: canWrite,
    canEditRow: (row) => !credentialBusy(row),
    canDeleteRow: (row) => !credentialBusy(row),
    // Run by the credentials table component (`handleRowAction`).
    rowActions: credentialRowActions(canWrite),
    initialValues: credentialInitialValues(),
    fields: credentialFields(),
    columns: CREDENTIAL_COLUMNS,
    payload: (values, editing) => credentialPayload(values, editing),
  });
}
