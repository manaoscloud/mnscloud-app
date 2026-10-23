import { Component, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudFieldContext,
  ConfigurableCrudFieldType,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/** Lookup types of the platform (`services/dataLookup/types.ts` in the API). */
export const LOOKUP_TYPE_OPTIONS = [
  { value: 'postal_code', label: 'Postal code (CEP)' },
  { value: 'company', label: 'Company (CNPJ)' },
  { value: 'company_realtime', label: 'Company in real time (CNPJ)' },
  { value: 'state_registration', label: 'State registration (IE)' },
  { value: 'person', label: 'Person (CPF)' },
];

export function lookupTypeLabel(type: unknown): string {
  return LOOKUP_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? String(type ?? '');
}

/** One integration field of a provider kind (`GET system/lookups/provider-kinds`). */
export type LookupProviderField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select';
  required: boolean;
  secret: boolean;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  help?: string;
};

export type LookupProviderKind = {
  kind: string;
  label: string;
  types: string[];
  paid: boolean;
  host: string;
  fields: LookupProviderField[];
};

/** Catalog of the API, shared by the field callbacks of the form (loaded by the page). */
const kindCatalog = signal<LookupProviderKind[]>([]);

export function setLookupKindCatalog(items: LookupProviderKind[]): void {
  kindCatalog.set(items);
}

export function lookupKind(kind: unknown): LookupProviderKind | undefined {
  return kindCatalog().find((item) => item.kind === kind);
}

/**
 * The form has a fixed number of integration slots; each one shows the field the selected kind
 * declares at that position, so a new provider needs no new form (only its adapter in the API).
 */
export const INTEGRATION_SLOTS = 8;

export function slotField(values: ConfigurableCrudRecord, index: number) {
  return lookupKind(values['kind'])?.fields[index];
}

function slotType(field: LookupProviderField | undefined): ConfigurableCrudFieldType {
  if (field?.type === 'password') return 'password';
  if (field?.type === 'select') return 'search-select';
  return 'text';
}

function integrationSlot(index: number): ConfigurableCrudField {
  const field = ({ values }: ConfigurableCrudFieldContext) => slotField(values, index);
  return {
    key: `integration${index}`,
    label: 'Integration field',
    labelWhen: (context) => field(context)?.label ?? 'Integration field',
    typeWhen: (context) => slotType(field(context)),
    optionsWhen: (context) => field(context)?.options ?? [],
    hiddenWhen: (context) => !field(context),
    // A stored secret is kept when left blank on edit.
    requiredWhen: (context) =>
      Boolean(field(context)?.required) && !(field(context)?.secret && context.editing),
    help: 'Field of the provider integration.',
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

const HEALTH_OPTIONS = [
  { value: 'unknown', label: 'Not tested' },
  { value: 'healthy', label: 'Connected' },
  { value: 'failed', label: 'Connection failed' },
];

type ConnectionTestResult = { Healthy?: number; LatencyMs?: number | null; Error?: string | null };

/** Integration slots back to the `config` and `secrets` of the kind (secrets only when typed). */
export function lookupProviderPayload(values: ConfigurableCrudRecord): ConfigurableCrudRecord {
  const kind = lookupKind(values['kind']);
  const configValues: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  (kind?.fields ?? []).slice(0, INTEGRATION_SLOTS).forEach((field, index) => {
    const value = String(values[`integration${index}`] ?? '').trim();
    if (!value) return;
    (field.secret ? secrets : configValues)[field.key] = value;
  });
  return {
    status: Number(values['status'] ?? 1),
    name: values['name'],
    kind: values['kind'],
    timeoutMs: Number(values['timeoutMs'] || 4000),
    config: configValues,
    ...(Object.keys(secrets).length ? { secrets } : {}),
  };
}

const config = defineCrud({
  endpoint: 'system/lookups/providers',
  uuidField: 'DataLookupProviderUUID',
  pageTitle: 'Lookup providers',
  pageDescription:
    'Services that answer the CEP, CNPJ, state registration and CPF searches of every form. Only one provider is active per lookup type.',
  createTitle: 'New lookup provider',
  editTitle: 'Edit lookup provider',
  dialogDescription:
    'Credentials are encrypted by the platform and never shown again. Choose the active provider of each lookup in Lookup types.',
  searchPlaceholder: 'Name or provider',
  emptyLabel: 'No lookup providers found.',
  deleteTitle: 'Delete lookup provider',
  deleteMessage: 'Delete this lookup provider? Its stored credentials are erased.',
  savedMessage: 'Lookup provider saved successfully.',
  deletedMessage: 'Lookup provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete lookup provider.',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: { status: 1, name: '', kind: '', timeoutMs: 4000 },
  rowActions: [
    {
      key: 'test',
      label: 'Test connection',
      icon: 'network_check',
      tooltip: 'Looks up a known test value with the stored settings and records the result.',
    },
  ],
  columns: [
    {
      id: 'name',
      field: 'Name',
      label: 'Name',
      kind: 'identity',
      detail: (row) => String(row['KindLabel'] ?? row['Kind'] ?? ''),
    },
    {
      id: 'answers',
      field: 'Types',
      label: 'Answers',
      value: (row, translate) =>
        ((row['Types'] as string[] | undefined) ?? [])
          .map((type) => translate(lookupTypeLabel(type)))
          .join(', '),
    },
    {
      id: 'usage',
      field: 'ActiveTypes',
      label: 'In use',
      value: (row, translate) => {
        const active = ((row['ActiveTypes'] as string[] | undefined) ?? []).map((type) =>
          translate(lookupTypeLabel(type)),
        );
        const failover = ((row['FailoverTypes'] as string[] | undefined) ?? []).map(
          (type) => `${translate(lookupTypeLabel(type))} (${translate('failover')})`,
        );
        return [...active, ...failover].join(', ') || '-';
      },
    },
    { id: 'credentials', field: 'SecretConfigured', label: 'Credentials', kind: 'boolean' },
    {
      id: 'health',
      field: 'LastHealthStatus',
      label: 'Connection',
      kind: 'status',
      options: HEALTH_OPTIONS,
      translateValue: true,
      chipClass: (value) =>
        value === 'healthy' ? 'chip-success' : value === 'failed' ? 'chip-failed' : 'chip-skipped',
    },
    {
      id: 'reason',
      field: 'LastHealthError',
      label: 'Failure reason',
      width: 'xl',
      value: (row) => String(row['LastHealthError'] ?? '') || '-',
    },
    { id: 'tested', field: 'LastHealthAt', label: 'Last test', kind: 'datetime', optional: true },
    { id: 'status', field: 'Status', label: 'Status', kind: 'status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'kind',
      source: 'Kind',
      payloadKey: 'kind',
      label: 'Provider',
      type: 'search-select',
      optionsWhen: () =>
        kindCatalog().map((item) => ({
          value: item.kind,
          label: item.label,
          description: item.host,
        })),
      required: true,
      disabledWhen: ({ editing }) => editing,
      help: 'Service called by the platform. It cannot change later: create another provider instead.',
      span: 1,
    },
    {
      key: 'timeoutMs',
      source: 'TimeoutMs',
      payloadKey: 'timeoutMs',
      label: 'Timeout (ms)',
      type: 'number',
      help: 'A slower answer counts as a failure and the failover provider is tried (500 to 30000 ms).',
      span: 1,
    },
    ...Array.from({ length: INTEGRATION_SLOTS }, (_, index) => integrationSlot(index)),
  ],
  payload: lookupProviderPayload,
});

@Component({
  selector: 'app-lookup-providers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LookupProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
    void this.loadKinds();
  }

  async loadKinds(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: LookupProviderKind[] } }>(
        'system/lookups/provider-kinds',
        { silent: true },
      );
      setLookupKindCatalog(response.data?.items ?? []);
    } catch {
      setLookupKindCatalog([]);
    }
  }

  /** Stored configuration goes back to its slots; secrets stay blank (never returned). */
  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    const stored = (row['Config'] as Record<string, unknown> | undefined) ?? {};
    const patch: ConfigurableCrudRecord = {};
    (lookupKind(row['Kind'])?.fields ?? []).forEach((field, index) => {
      patch[`integration${index}`] = field.secret ? '' : String(stored[field.key] ?? '');
    });
    this.patchFormValues(patch);
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    if (key !== 'kind') return;
    const patch: ConfigurableCrudRecord = {};
    for (let index = 0; index < INTEGRATION_SLOTS; index++) patch[`integration${index}`] = '';
    if (!String(this.formValues()['name'] ?? '').trim()) {
      patch['name'] = lookupKind(this.formValues()['kind'])?.label ?? '';
    }
    this.patchFormValues(patch);
  }

  /** Test connection: result right away, then the list refreshes with the recorded status. */
  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'test') return;
    try {
      const response = await this.api.post<{ data?: ConnectionTestResult }>(
        `system/lookups/providers/${String(row['DataLookupProviderUUID'])}/test`,
        {},
      );
      const result = response.data;
      if (Number(result?.Healthy) === 1) {
        this.snack.success(this.t('Connection OK ({{ ms }} ms).', { ms: result?.LatencyMs ?? 0 }));
      } else {
        this.snack.error(`${this.t('Connection failed')}: ${result?.Error ?? ''}`, 15000);
      }
    } finally {
      this.refreshList();
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      ...(this.editingRecord() ? { expectedRevision: this.editingRecord()?.['Revision'] } : {}),
    };
  }
}
