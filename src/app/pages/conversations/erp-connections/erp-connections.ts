import { Component, inject, signal } from '@angular/core';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { AuthService } from '../../../services/auth.service';
import { apiErrorFields } from '../../../services/api-error-fields';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudFieldContext,
  ConfigurableCrudFieldType,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { customFieldError } from '../../../shared/forms/field-validation';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { PROVIDER_HEALTH_OPTIONS } from '../../settings/platform-provider-crud';
import { CONVERSATION_ACCOUNT_LOOKUP } from '../accounts/accounts';

/** One adapter field of an ERP kind (`GET conversations/erp/kinds`). */
export type ErpKindField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number';
  required: boolean;
  secret: boolean;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  help?: string;
};

export type ErpToolInfo = {
  tool: string;
  label: string;
  class: string;
  minIdentity: number;
  consequential: boolean;
  highRisk: boolean;
  base: boolean;
};

export type ErpKind = {
  kind: string;
  label: string;
  homologated: boolean;
  help?: string;
  fields: ErpKindField[];
  capabilities: ErpToolInfo[];
};

/** Catalog of the API, shared by the field callbacks of the form (loaded by the page). */
const kindCatalog = signal<ErpKind[]>([]);
const toolCatalog = signal<ErpToolInfo[]>([]);

export function setErpCatalog(kinds: ErpKind[], tools: ErpToolInfo[]): void {
  kindCatalog.set(kinds);
  toolCatalog.set(tools);
}

export function erpKind(kind: unknown): ErpKind | undefined {
  return kindCatalog().find((item) => item.kind === kind);
}

/** The form has fixed slots; each shows the field the selected kind declares at its position. */
export const ERP_FIELD_SLOTS = 10;
/** One slot per tool of the catalog (enabled and, for writes, human approval). */
export const ERP_TOOL_SLOTS = 24;

const YES_NO = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
] as const;

export const ERP_STATES = [
  { value: 'draft', label: 'Draft' },
  { value: 'valid', label: 'Valid' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'disabled', label: 'Disabled' },
];

const REACH_MODES = [
  { value: 'public', label: 'Public internet' },
  { value: 'connector', label: 'Connector' },
] as const;

export function erpSlotField(values: ConfigurableCrudRecord, index: number) {
  return erpKind(values['kind'])?.fields[index];
}

function slotType(field: ErpKindField | undefined): ConfigurableCrudFieldType {
  if (field?.type === 'password') return 'password';
  if (field?.type === 'select') return 'search-select';
  if (field?.type === 'number') return 'number';
  return 'text';
}

export function erpFieldSlot(index: number): ConfigurableCrudField {
  const field = ({ values }: ConfigurableCrudFieldContext) => erpSlotField(values, index);
  return {
    key: `erpField${index}`,
    label: 'ERP field',
    labelWhen: (context) => field(context)?.label ?? 'ERP field',
    typeWhen: (context) => slotType(field(context)),
    optionsWhen: (context) => field(context)?.options ?? [],
    hiddenWhen: (context) => !field(context),
    // A stored secret is kept when left blank on edit.
    requiredWhen: (context) =>
      Boolean(field(context)?.required) && !(field(context)?.secret && context.editing),
    help: 'Field of the ERP integration.',
    helpWhen: (context) => {
      const current = field(context);
      if (current?.secret && context.editing) {
        return 'Stored encrypted and never shown again. Leave blank to keep the stored value.';
      }
      return current?.help || (current?.secret ? 'Stored encrypted and never shown again.' : '');
    },
    autocomplete: 'off',
    span: 1,
  };
}

const toolAt = (index: number) => toolCatalog()[index];

/**
 * A tool slot is shown only for tools the selected kind implements; write tools also need the
 * kind to be homologated. Hidden tools keep their stored policy untouched.
 */
export function erpToolVisible(values: ConfigurableCrudRecord, index: number): boolean {
  const tool = toolAt(index);
  const kind = erpKind(values['kind']);
  if (!tool || !kind) return false;
  if (!kind.capabilities.some((item) => item.tool === tool.tool)) return false;
  return kind.homologated || tool.class !== 'write';
}
const isWrite = (tool: ErpToolInfo | undefined) => tool?.class === 'write';

function toolSlots(index: number): ConfigurableCrudField[] {
  return [
    {
      key: `erpTool${index}`,
      label: 'Tool',
      labelWhen: () => toolAt(index)?.label ?? 'Tool',
      type: 'search-select',
      tab: 'limits',
      options: YES_NO,
      translateOptions: true,
      hiddenWhen: ({ values }) => !erpToolVisible(values, index),
      help: 'The AI agent and the flows can only use the tools that are enabled here.',
      span: 1,
    },
    {
      key: `erpToolHuman${index}`,
      label: 'Requires human approval',
      type: 'search-select',
      tab: 'limits',
      options: YES_NO,
      translateOptions: true,
      hiddenWhen: ({ values }) => !erpToolVisible(values, index) || !isWrite(toolAt(index)),
      help: 'A person of the team must approve each use of this tool before it runs.',
      span: 1,
    },
  ];
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(String(value ?? ''));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

type StoredToolPolicy = {
  enabled?: boolean;
  minIdentity?: number;
  requireConfirmation?: boolean;
  requireHuman?: boolean;
};

function storedTools(policy: unknown): Record<string, StoredToolPolicy> {
  return parseObject(parseObject(policy)['tools']) as Record<string, StoredToolPolicy>;
}

/** Tool slot values of a stored policy; reads default to enabled, writes to disabled. */
export function erpToolSlotValues(policy: unknown): ConfigurableCrudRecord {
  const stored = storedTools(policy);
  const values: ConfigurableCrudRecord = {};
  for (let index = 0; index < ERP_TOOL_SLOTS; index++) {
    const tool = toolAt(index);
    if (!tool) continue;
    const entry = stored[tool.tool] ?? {};
    values[`erpTool${index}`] = (entry.enabled ?? !isWrite(tool)) ? 1 : 0;
    values[`erpToolHuman${index}`] = entry.requireHuman === true ? 1 : 0;
  }
  return values;
}

/**
 * Policy of the form: enabled and human approval per tool. The stored identity level and
 * confirmation are kept, never lowered below the catalog.
 */
export function erpPolicyPayload(values: ConfigurableCrudRecord): Record<string, unknown> {
  const stored = storedTools(values['storedPolicy']);
  const known = new Set(toolCatalog().map((item) => item.tool));
  // Tools the form does not show keep the stored policy as it is.
  const tools: Record<string, StoredToolPolicy> = Object.fromEntries(
    Object.entries(stored).filter(([name]) => known.has(name)),
  );
  for (let index = 0; index < ERP_TOOL_SLOTS; index++) {
    const tool = toolAt(index);
    if (!tool || !erpToolVisible(values, index)) continue;
    const entry = stored[tool.tool] ?? {};
    const minIdentity = Math.max(tool.minIdentity, Number(entry.minIdentity ?? tool.minIdentity));
    tools[tool.tool] = {
      enabled: Number(values[`erpTool${index}`] ?? (isWrite(tool) ? 0 : 1)) === 1,
      minIdentity,
      requireConfirmation: tool.consequential ? true : entry.requireConfirmation === true,
      requireHuman: isWrite(tool) && Number(values[`erpToolHuman${index}`]) === 1,
    };
  }
  return { tools };
}

/** Adapter fields from the slots: blank values are omitted (a blank secret keeps the stored one). */
export function erpFieldsPayload(values: ConfigurableCrudRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  (erpKind(values['kind'])?.fields ?? []).slice(0, ERP_FIELD_SLOTS).forEach((field, index) => {
    const raw = values[`erpField${index}`];
    const text = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim();
    if (!text) return;
    fields[field.key] = field.type === 'number' ? Number(text) : text;
  });
  return fields;
}

function optionalNumber(value: unknown): number | undefined {
  const text = String(value ?? '').trim();
  return text && Number.isFinite(Number(text)) ? Number(text) : undefined;
}

export function erpConnectionPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const fields = erpFieldsPayload(values);
  const account = String(values['ConversationAccountCvaUUID'] ?? '');
  const timeout = optionalNumber(values['timeoutMs']);
  const concurrency = optionalNumber(values['maxConcurrency']);
  const rate = optionalNumber(values['ratePerMinute']);
  return {
    ...(editing
      ? { CecRevision: Number(values['revision']) }
      : { CecKind: values['kind'], ...(account ? { ConversationAccountCvaUUID: account } : {}) }),
    CecName: values['name'],
    CecBaseUrl: String(values['baseUrl'] ?? '').trim(),
    ...(!editing || Object.keys(fields).length ? { Fields: fields } : {}),
    CecPolicy: erpPolicyPayload(values),
    CecTlsPinSha256: String(values['tlsPin'] ?? '').trim(),
    CecReachMode: values['reachMode'] === 'connector' ? 'connector' : 'public',
    ...(timeout === undefined ? {} : { CecTimeoutMs: timeout }),
    ...(concurrency === undefined ? {} : { CecMaxConcurrency: concurrency }),
    ...(rate === undefined ? {} : { CecRatePerMinute: rate }),
    CecStatus: Number(values['status']),
    ...(editing && account ? { ConversationAccountCvaUUID: account } : {}),
    // Cleared by the user: the API takes null to detach the stored account.
    ...(editing && !account && String(values['storedAccount'] ?? '')
      ? { ConversationAccountCvaUUID: null }
      : {}),
  };
}

const config = defineCrud({
  endpoint: 'conversations/erp/connections',
  deleteEndpoint: (row) =>
    `conversations/erp/connections/${String(row['CecUUID'])}?revision=${Number(row['CecRevision'])}`,
  uuidField: 'CecUUID',
  pageTitle: 'ERP integrations',
  pageDescription:
    'Connect the ERP of your internet provider so flows and the AI agent can look up plans, invoices and contracts, and run the actions you allow.',
  createTitle: 'New ERP integration',
  editTitle: 'Edit ERP integration',
  dialogDescription:
    'Credentials are stored encrypted and never shown again. Test the connection after saving, then choose the tools the AI agent may use.',
  searchPlaceholder: 'Name, ERP or address',
  emptyLabel: 'No ERP integrations. Create one to let flows and the AI agent query your ERP.',
  deleteTitle: 'Remove ERP integration',
  deleteMessage:
    'Remove this ERP integration? Flows and the AI agent stop using it and its stored credentials are erased.',
  savedMessage: 'ERP integration saved.',
  deletedMessage: 'ERP integration removed.',
  deleteFailedMessage: 'Failed to remove the ERP integration.',
  bulkDelete: false,
  serverSidePagination: true,
  tabLabels: { limits: 'Tools' },
  initialValues: {
    status: 1,
    kind: '',
    name: '',
    baseUrl: '',
    ConversationAccountCvaUUID: null,
    tlsPin: '',
    reachMode: 'public',
    timeoutMs: 10000,
    maxConcurrency: 4,
    ratePerMinute: 120,
    storedPolicy: '{}',
    storedAccount: '',
    revision: '',
  },
  rowActions: [
    {
      key: 'test',
      label: 'Test connection',
      icon: 'network_check',
      tooltip: 'Calls the ERP with the stored settings and records the result.',
    },
  ],
  columns: [
    {
      id: 'name',
      label: 'Name',
      field: 'CecName',
      uuidField: 'CecUUID',
      kind: 'identity',
      detail: (row) => erpKind(row['CecKind'])?.label ?? String(row['CecKind'] ?? ''),
    },
    {
      id: 'homologated',
      label: 'Homologation',
      field: 'CecKind',
      value: (row, translate) =>
        erpKind(row['CecKind'])?.homologated
          ? translate('Homologated')
          : translate('Not homologated'),
      optional: true,
    },
    {
      id: 'state',
      label: 'State',
      field: 'CecState',
      kind: 'status',
      options: ERP_STATES,
      translateValue: true,
      chipClass: (value) =>
        value === 'valid' ? 'chip-success' : value === 'invalid' ? 'chip-failed' : 'chip-warning',
    },
    {
      id: 'health',
      label: 'Connection',
      field: 'CecLastHealthStatus',
      kind: 'status',
      options: PROVIDER_HEALTH_OPTIONS,
      translateValue: true,
      chipClass: (value) =>
        value === 'healthy' ? 'chip-success' : value === 'failed' ? 'chip-failed' : 'chip-skipped',
      detail: (row) => String(row['CecLastHealthError'] ?? ''),
    },
    {
      id: 'tested',
      label: 'Last test',
      field: 'CecLastHealthAt',
      kind: 'datetime',
      optional: true,
    },
    { id: 'version', label: 'ERP version', field: 'CecErpVersion', optional: true },
    { id: 'secret', label: 'Credentials stored', field: 'HasSecret', kind: 'boolean' },
    { id: 'account', label: 'Account', field: 'AccountName', optional: true },
    { id: 'status', label: 'Status', field: 'CecStatus', kind: 'status' },
  ],
  fields: [
    { key: 'revision', source: 'CecRevision', label: 'Revision', hidden: true },
    {
      key: 'storedAccount',
      source: 'ConversationAccountCvaUUID',
      label: 'Account',
      hidden: true,
    },
    {
      key: 'storedPolicy',
      source: 'CecPolicy',
      label: 'Policy',
      hidden: true,
      fromRecord: (value) => JSON.stringify(parseObject(value)),
    },
    { key: 'status', source: 'CecStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'kind',
      source: 'CecKind',
      label: 'ERP',
      type: 'search-select',
      optionsWhen: () =>
        kindCatalog().map((item) => ({
          value: item.kind,
          label: item.label,
          description: item.homologated ? undefined : 'Not homologated',
        })),
      required: true,
      disabledWhen: ({ editing }) => editing,
      help: 'ERP system of your provider. It cannot change later: create another integration instead.',
      helpWhen: ({ values }) => erpKind(values['kind'])?.help || '',
      span: 1,
    },
    {
      key: 'name',
      source: 'CecName',
      label: 'Name',
      required: true,
      placeholder: 'Example: ERP headquarters',
    },
    {
      key: 'baseUrl',
      source: 'CecBaseUrl',
      label: 'ERP address',
      required: true,
      placeholder: 'https://erp.example.com',
      help: 'HTTPS address of your ERP, without the path of the API.',
    },
    {
      key: 'ConversationAccountCvaUUID',
      source: 'ConversationAccountCvaUUID',
      label: 'Account',
      type: 'search-select',
      help: 'conversations.channelAccountHelp',
      remoteLookup: CONVERSATION_ACCOUNT_LOOKUP,
    },
    ...Array.from({ length: ERP_FIELD_SLOTS }, (_, index) => erpFieldSlot(index)),
    ...Array.from({ length: ERP_TOOL_SLOTS }, (_, index) => toolSlots(index)).flat(),
    {
      key: 'tlsPin',
      source: 'CecTlsPinSha256',
      label: 'Certificate fingerprint (SHA-256)',
      tab: 'advanced',
      placeholder: '64 hexadecimal characters',
      help: 'Optional. When set, only the ERP that presents this certificate is accepted.',
      span: 1,
    },
    {
      key: 'reachMode',
      source: 'CecReachMode',
      label: 'How the ERP is reached',
      type: 'search-select',
      tab: 'advanced',
      options: REACH_MODES,
      translateOptions: true,
      help: 'Use Connector for an ERP inside a private network, reached through a connector of your team.',
      span: 1,
    },
    {
      key: 'timeoutMs',
      source: 'CecTimeoutMs',
      label: 'Timeout (ms)',
      type: 'number',
      tab: 'advanced',
      help: 'A slower answer counts as a failure (1000 to 30000 ms).',
      span: 1,
    },
    {
      key: 'maxConcurrency',
      source: 'CecMaxConcurrency',
      label: 'Simultaneous calls',
      type: 'number',
      tab: 'advanced',
      help: 'Maximum calls to the ERP at the same time (1 to 32).',
      span: 1,
    },
    {
      key: 'ratePerMinute',
      source: 'CecRatePerMinute',
      label: 'Calls per minute',
      type: 'number',
      tab: 'advanced',
      help: 'Limit of calls per minute to the ERP (1 to 6000).',
      span: 1,
    },
  ],
  payload: erpConnectionPayload,
});

@Component({
  selector: 'app-conversations-erp-connections',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ConversationsErpConnectionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const permissions = inject(AuthService).user()?.permissions ?? [];
    const canWrite = hasEffectivePermission(permissions, 'tenant.conversations.erp.write');
    const canDelete = hasEffectivePermission(permissions, 'tenant.conversations.erp.delete');
    super({
      ...config,
      canCreate: canWrite,
      canEdit: canWrite,
      canDelete,
      rowActions: canWrite ? config.rowActions : [],
    });
    void this.loadKinds();
  }

  async loadKinds(): Promise<void> {
    try {
      const response = await this.api.get<{
        data?: { items?: ErpKind[]; tools?: ErpToolInfo[] };
      }>('conversations/erp/kinds', { silent: true });
      setErpCatalog(response.data?.items ?? [], response.data?.tools ?? []);
    } catch {
      setErpCatalog([], []);
    }
  }

  /** Tools start with the API defaults: reads enabled, writes disabled. */
  override startCreate(): void {
    super.startCreate();
    this.patchFormValues(erpToolSlotValues(null));
  }

  /** Stored configuration and policy go back to their slots; secrets stay blank. */
  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    const stored = parseObject(row['CecConfig']);
    const patch: ConfigurableCrudRecord = erpToolSlotValues(row['CecPolicy']);
    (erpKind(row['CecKind'])?.fields ?? []).forEach((field, index) => {
      patch[`erpField${index}`] = field.secret ? '' : String(stored[field.key] ?? '');
    });
    this.patchFormValues(patch);
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    if (key !== 'kind') return;
    const patch: ConfigurableCrudRecord = {};
    for (let index = 0; index < ERP_FIELD_SLOTS; index++) patch[`erpField${index}`] = '';
    if (!String(this.formValues()['name'] ?? '').trim()) {
      patch['name'] = erpKind(this.formValues()['kind'])?.label ?? '';
    }
    this.patchFormValues(patch);
  }

  /** `Fields.<key>` errors of the API mark the slot that shows that adapter field. */
  protected override errorMessage(error: unknown): string {
    const kind = erpKind(this.formValues()['kind']);
    const errors = new Map<string, ReturnType<typeof customFieldError>>();
    for (const name of apiErrorFields(error)) {
      const index = kind?.fields.findIndex((field) => `Fields.${field.key}` === name) ?? -1;
      if (index >= 0)
        errors.set(`erpField${index}`, customFieldError('form.validation.serverRejected'));
    }
    if (errors.size) this.reportFieldErrors(errors);
    return super.errorMessage(error);
  }

  /** Test connection: result right away, then the list refreshes with the recorded status. */
  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'test') return;
    try {
      const response = await this.api.post<{
        data?: { healthy?: boolean; version?: string; code?: string; error?: string };
      }>(`conversations/erp/connections/${String(row['CecUUID'])}/test`, {});
      const result = response.data;
      if (result?.healthy) {
        this.snack.success(
          this.t('ERP connection OK (version {{ version }}).', {
            version: result.version || '-',
          }),
        );
      } else {
        const detail = [result?.code, result?.error].filter(Boolean).join(': ');
        this.snack.error(`${this.t('Connection failed')}: ${detail}`, 15000);
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.refreshList();
    }
  }
}
