import { Component, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudQuickCreateResult,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import {
  runRuntimeDiagnostic,
  RuntimeDiagnosticResult,
} from '../../../../shared/runtime-diagnostic/runtime-diagnostic.util';
import { VoipPabxAccountQuickCreateHostComponent } from '../account/account';
import { VoipPabxDialPlanPlanQuickCreateHostComponent } from '../dial-plan/plan/plan';

type PabxLookup = ConfigurableCrudOption & {
  requiresDomain: boolean;
  domainName: string;
  defaultCodecs: string[];
};

type ExtensionRecord = ConfigurableCrudRecord & {
  VpeUUID: string;
  VpeUsername?: string | null;
  VpeCodecs?: string | null;
  PabxName?: string | null;
  DialPlanName?: string | null;
};

const statusOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const yesNoOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const codecOptions: readonly ConfigurableCrudOption[] = [
  { value: 'OPUS', label: 'OPUS' },
  { value: 'PCMU', label: 'PCMU' },
  { value: 'PCMA', label: 'PCMA' },
  { value: 'G722', label: 'G722' },
  { value: 'G729', label: 'G729' },
  { value: 'H264', label: 'H264' },
];

const fields: readonly ConfigurableCrudField[] = [
  {
    key: 'enabled',
    label: 'Status',
    source: 'VpeEnabled',
    type: 'status',
    tab: 'record',
    span: 1,
    options: statusOptions,
  },
  {
    key: 'pabxUUID',
    label: 'PABX',
    payloadKey: 'pabxUUID',
    source: 'VoipPabxAccountVpaUUID',
    type: 'search-select',
    tab: 'record',
    span: 1,
    required: true,
    placeholder: 'Search PABX',
    autocomplete: 'off',
    quickCreate: {
      label: 'Create PABX',
      component: VoipPabxAccountQuickCreateHostComponent,
    },
  },
  {
    key: 'createMode',
    label: 'Creation mode',
    type: 'select',
    tab: 'record',
    span: 1,
    hiddenWhen: ({ editing }) => editing,
    options: [
      { value: 'single', label: 'Single' },
      { value: 'range', label: 'Range' },
    ],
  },
  {
    key: 'username',
    label: 'Extension',
    payloadKey: 'username',
    source: 'VpeUsername',
    type: 'text',
    tab: 'record',
    span: 1,
    requiredWhen: ({ editing, values }) => editing || values['createMode'] !== 'range',
    hiddenWhen: ({ editing, values }) => !editing && values['createMode'] === 'range',
    autocomplete: 'off',
    breakBefore: true,
  },
  {
    key: 'extensionRange',
    label: 'Extension range',
    type: 'text',
    tab: 'record',
    span: 1,
    requiredWhen: ({ editing, values }) => !editing && values['createMode'] === 'range',
    hiddenWhen: ({ editing, values }) => editing || values['createMode'] !== 'range',
    placeholder: 'Example: 1000-1010',
    autocomplete: 'off',
    breakBefore: true,
  },
  {
    key: 'password',
    label: 'Password',
    payloadKey: 'password',
    source: 'VpePassword',
    type: 'password',
    tab: 'record',
    span: 1,
    autocomplete: 'new-password',
  },
  {
    key: 'callerIdName',
    label: 'Caller ID name',
    payloadKey: 'callerIdName',
    source: 'VpeCallerIdName',
    type: 'text',
    tab: 'routing',
    span: 1,
    autocomplete: 'off',
    breakBefore: true,
  },
  {
    key: 'callerIdNumber',
    label: 'Caller ID number',
    payloadKey: 'callerIdNumber',
    source: 'VpeCallerIdNumber',
    type: 'text',
    tab: 'routing',
    span: 1,
    autocomplete: 'off',
  },
  {
    key: 'context',
    label: 'Context',
    payloadKey: 'context',
    source: 'VpeContext',
    type: 'text',
    tab: 'routing',
    span: 1,
    autocomplete: 'off',
  },
  {
    key: 'outboundCid',
    label: 'Outbound caller ID',
    payloadKey: 'outboundCid',
    source: 'VpeOutboundCid',
    type: 'text',
    tab: 'routing',
    span: 1,
    autocomplete: 'off',
  },
  {
    key: 'dialPlanUUID',
    label: 'Dial plan',
    payloadKey: 'dialPlanUUID',
    source: 'VoipPabxDialPlanVdpUUID',
    type: 'search-select',
    tab: 'routing',
    span: 1,
    placeholder: 'Search dial plan',
    autocomplete: 'off',
    quickCreate: {
      label: 'Create dial plan',
      component: VoipPabxDialPlanPlanQuickCreateHostComponent,
    },
  },
  {
    key: 'vmEnabled',
    label: 'Voicemail enabled',
    payloadKey: 'vmEnabled',
    source: 'VpeVmEnabled',
    type: 'select',
    tab: 'monitoring',
    span: 1,
    options: yesNoOptions,
  },
  {
    key: 'vmPassword',
    label: 'Voicemail password',
    payloadKey: 'vmPassword',
    source: 'VpeVmPassword',
    type: 'password',
    tab: 'monitoring',
    span: 1,
    hiddenWhen: ({ values }) => !toBoolean(values['vmEnabled']),
    autocomplete: 'new-password',
  },
  {
    key: 'recordCalls',
    label: 'Call recording',
    payloadKey: 'recordCalls',
    source: 'VpeRecordCalls',
    type: 'select',
    tab: 'monitoring',
    span: 1,
    options: yesNoOptions,
  },
  {
    key: 'codecs',
    label: 'Codecs',
    payloadKey: 'codecs',
    source: 'VpeCodecs',
    type: 'multi-select',
    tab: 'codecs',
    span: 1,
    options: codecOptions,
    fromRecord: (value) => splitCodecs(value),
  },
  {
    key: 'params',
    label: 'Engine configuration',
    payloadKey: 'params',
    source: 'VpeParamsJson',
    format: 'json',
    type: 'textarea',
    tab: 'notes',
    span: 4,
    rows: 4,
    placeholder: '{}',
  },
];

const config: ConfigurableCrudConfig = {
  endpoint: 'voip/pabx/extensions',
  bulkDeleteEndpoint: 'voip/pabx/extensions/bulk',
  uuidField: 'VpeUUID',
  pageTitle: 'PABX Extensions',
  pageDescription: 'Manage extensions linked to tenant PABX accounts.',
  createTitle: 'New PABX extension',
  editTitle: 'Edit PABX extension',
  dialogDescription:
    'Maintain extension identity, routing, voicemail, codecs, and engine settings.',
  searchPlaceholder: 'Extension, caller ID, PABX, domain...',
  emptyLabel: 'No PABX extensions found.',
  deleteTitle: 'Delete PABX extension',
  deleteMessage: 'Are you sure you want to delete this PABX extension?',
  deleteSelectedTitle: 'Delete selected PABX extensions',
  deleteSelectedMessage: 'Are you sure you want to delete {count} selected PABX extensions?',
  savedMessage: 'PABX extension saved successfully.',
  deletedMessage: 'PABX extension deleted successfully.',
  deleteFailedMessage: 'Failed to delete PABX extension.',
  fields,
  columns: [
    {
      id: 'username',
      label: 'Extension',
      field: 'VpeUsername',
      kind: 'identity',
      uuidField: 'VpeUUID',
      copyable: true,
    },
    { id: 'password', label: 'Password', field: 'VpePassword', kind: 'text', copyable: true },
    { id: 'pabx', label: 'PABX', field: 'PabxName', kind: 'text' },
    { id: 'domain', label: 'Domain', field: 'DomainName', kind: 'text', copyable: true },
    { id: 'engine', label: 'Engine', field: 'VpeEngine', kind: 'text' },
    { id: 'dialPlan', label: 'Dial plan', field: 'DialPlanName', kind: 'text' },
    { id: 'recordCalls', label: 'Call recording', field: 'VpeRecordCalls', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'VpeEnabled', kind: 'status' },
  ],
  initialValues: {
    enabled: 1,
    pabxUUID: '',
    createMode: 'single',
    extensionRange: '',
    username: '',
    password: '',
    callerIdName: '',
    callerIdNumber: '',
    context: 'public',
    outboundCid: '',
    dialPlanUUID: '',
    vmEnabled: 0,
    vmPassword: '',
    recordCalls: 0,
    codecs: [],
    params: '{}',
  },
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions,
  listFilters: [
    {
      key: 'pabxUUID',
      label: 'PABX',
      paramKey: 'pabxUUID',
      type: 'search-select',
      span: 1,
      placeholder: 'Search PABX',
      emptyLabel: 'No PABX accounts found.',
    },
  ],
  filterActionMenu: {
    label: 'Status',
    icon: 'monitor_heart',
    actions: [
      {
        key: 'runtime-status-all',
        label: 'Extensions',
        tooltip: 'Inspect all PABX extension statuses',
        icon: 'dialpad',
      },
    ],
  },
  rowActions: [
    {
      key: 'runtime-status',
      label: 'Runtime status',
      tooltip: 'Inspect extension runtime status',
      icon: 'terminal',
    },
  ],
  bulkDelete: true,
  statusFilter: true,
  tabLabels: {
    record: 'Registration',
    routing: 'Routing',
    monitoring: 'Voicemail',
    codecs: 'Codecs',
    notes: 'Advanced',
  },
};

@Component({
  selector: 'app-voip-pabx-extension',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.scss',
})
export class VoipPabxExtensionPage extends ConfigurableCrudPageBase<ExtensionRecord> {
  private readonly pabxOptionsState = signal<readonly PabxLookup[]>([]);
  private readonly dialPlanOptionsState = signal<readonly ConfigurableCrudOption[]>([]);
  private readonly lookupsLoading = signal(false);

  constructor() {
    super(config);
    void this.loadLookups();
  }

  override startEdit(row: ExtensionRecord): void {
    super.startEdit(row);
    this.patchFormValues({ createMode: 'single', codecs: splitCodecs(row['VpeCodecs']) });
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    if (this.editingRecord() || this.formValues()['createMode'] !== 'range') {
      await super.saveItem(saveAndNew);
      return;
    }

    const values = this.formValues();
    const pabx = this.validateSelectedPabx(values['pabxUUID']);
    if (!pabx) return;

    const range = parseRange(values['extensionRange']);
    if (!range) {
      this.snack.warning(this.t('Range must follow the format 1000-1010.'));
      return;
    }
    if (range.total > 100) {
      this.snack.warning(this.t('Range exceeds max size of 100 extensions per operation.'));
      return;
    }

    const params = parseParams(values['params']);
    if (params === undefined) {
      this.snack.warning(this.t('Engine configuration must be valid JSON.'));
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.api.post('voip/pabx/extensions/bulk', {
        pabxUUID: pabx.value,
        range: `${range.start}-${range.end}`,
        password: nullableString(values['password']),
        callerIdName: nullableString(values['callerIdName']),
        callerIdNumber: nullableString(values['callerIdNumber']),
        context: nullableString(values['context']),
        outboundCid: nullableString(values['outboundCid']),
        dialPlanUUID: nullableString(values['dialPlanUUID']),
        vmEnabled: toBoolean(values['vmEnabled']),
        vmPassword: nullableString(values['vmPassword']),
        recordCalls: toBoolean(values['recordCalls']),
        codecs: splitCodecs(values['codecs']).join(','),
        params,
        enabled: toBoolean(values['enabled']),
      });
      this.snack.success(this.t('PABX extensions created successfully.'));
      this.itemsResource.reload();
      if (saveAndNew) {
        this.patchFormValues({ extensionRange: '' });
      } else {
        this.closeDialog();
      }
      this.openGeneratedCredentials(response, pabx.label);
      const skipped = readArray(response, 'skippedExisting');
      if (skipped.length) {
        this.snack.warning(
          this.t('{count} extensions were skipped because they already exist.', {
            count: skipped.length,
          }),
        );
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.saving.set(false);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const normalized = { ...payload };
    delete normalized['createMode'];
    delete normalized['extensionRange'];
    normalized['enabled'] = toBoolean(normalized['enabled']);
    normalized['vmEnabled'] = toBoolean(normalized['vmEnabled']);
    normalized['recordCalls'] = toBoolean(normalized['recordCalls']);
    normalized['codecs'] = splitCodecs(normalized['codecs']).join(',');
    normalized['dialPlanUUID'] = nullableString(normalized['dialPlanUUID']);
    normalized['vmPassword'] = toBoolean(normalized['vmEnabled'])
      ? nullableString(normalized['vmPassword'])
      : null;
    return normalized;
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'pabxUUID' || this.editingRecord()) return;
    const pabx = this.pabxOptionsState().find((option) => String(option.value) === String(value));
    if (pabx) this.patchFormValues({ codecs: pabx.defaultCodecs });
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptionsState();
    if (key === 'dialPlanUUID') return this.dialPlanOptionsState();
    return [];
  }

  protected override afterQuickCreate(
    field: ConfigurableCrudField,
    option: ConfigurableCrudOption,
    _result: ConfigurableCrudQuickCreateResult,
  ): void {
    if (field.key === 'pabxUUID') {
      this.pabxOptionsState.update((items) => mergePabxOption(items, option));
      return;
    }
    if (field.key === 'dialPlanUUID') {
      this.dialPlanOptionsState.update((items) => mergeOption(items, option));
    }
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'pabxUUID' || field.key === 'dialPlanUUID'
      ? this.lookupsLoading()
      : super.fieldLoading(field);
  }

  override isFilterActionDisabled(action: ConfigurableCrudFilterAction): boolean {
    return action.key === 'runtime-status-all' && !String(this.listFilterValue({
      key: 'pabxUUID',
      label: 'PABX',
      type: 'search-select',
    })).trim();
  }

  override handleFilterAction(action: ConfigurableCrudFilterAction): void {
    if (action.key !== 'runtime-status-all') return;
    const pabxUUID = String(
      this.listFilterValue({ key: 'pabxUUID', label: 'PABX', type: 'search-select' }),
    ).trim();
    if (!pabxUUID) {
      this.snack.warning(this.t('Select a PABX account to inspect extension statuses.'));
      return;
    }

    void runRuntimeDiagnostic(this.dialog, this.api, this.snack, {
      title: 'PABX extension runtime status',
      description: 'Read-only registration and connectivity status of extensions assigned to the selected PABX.',
      startEndpoint: `voip/pabx/accounts/${pabxUUID}/extensions/runtime-status`,
      statusEndpoint: (jobUUID) =>
        `voip/pabx/accounts/${pabxUUID}/extensions/runtime-status/${jobUUID}`,
      sections: extensionStatusSections,
    });
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ExtensionRecord): void {
    if (action.key !== 'runtime-status') return;
    const extensionUUID = String(row['VpeUUID'] ?? '').trim();
    if (!extensionUUID) return;

    void runRuntimeDiagnostic(this.dialog, this.api, this.snack, {
      title: 'PABX extension runtime status',
      description: 'Read-only registration and connectivity status of the selected PABX extension.',
      startEndpoint: `voip/pabx/extensions/${extensionUUID}/runtime-status`,
      statusEndpoint: (jobUUID) =>
        `voip/pabx/extensions/${extensionUUID}/runtime-status/${jobUUID}`,
      sections: extensionStatusSections,
    });
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ExtensionRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const pabx = this.pabxOptionsState().find(
      (option) => String(option.value) === String(context.payload['pabxUUID']),
    );
    this.openGeneratedCredentials(context.response, pabx?.label ?? '-');
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [pabxRows, dialPlanRows] = await Promise.all([
        this.fetchRows('voip/pabx/accounts?status=1&limit=500&offset=0'),
        this.fetchRows('voip/pabx/dial-plans?status=1&limit=500&offset=0'),
      ]);
      this.pabxOptionsState.set(
        pabxRows
          .map((row) => {
            const domainName = String(row['DomainName'] ?? '').trim();
            const requiresDomain = toBoolean(row['RequiresDomain']);
            const name = String(row['VpaName'] ?? row['PabxName'] ?? row['name'] ?? '-');
            const engine = String(row['VpaEngine'] ?? row['ServerEngine'] ?? '').trim();
            return {
              value: String(row['VpaUUID'] ?? row['uuid'] ?? ''),
              label: name,
              description: [engine, domainName].filter(Boolean).join(' - ') || undefined,
              disabled: requiresDomain && !domainName,
              disabledReason:
                requiresDomain && !domainName
                  ? 'PABX account requires a domain before extensions can be provisioned.'
                  : undefined,
              requiresDomain,
              domainName,
              defaultCodecs: splitCodecs(row['ServerAllowedCodecs']),
            };
          })
          .filter((option) => option.value),
      );
      this.dialPlanOptionsState.set(
        dialPlanRows
          .map((row) => ({
            value: String(row['VdpUUID'] ?? row['uuid'] ?? ''),
            label: String(row['VdpName'] ?? row['name'] ?? '-'),
          }))
          .filter((option) => option.value),
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async fetchRows(endpoint: string): Promise<ConfigurableCrudRecord[]> {
    const response = await this.api.get<unknown>(endpoint);
    return readRows(response);
  }

  private validateSelectedPabx(value: unknown): PabxLookup | null {
    const pabx = this.pabxOptionsState().find(
      (option) => String(option.value) === String(value ?? ''),
    );
    if (!pabx) {
      this.snack.warning(this.t('Select a PABX account.'));
      return null;
    }
    if (pabx.disabled) {
      this.snack.warning(
        this.t('PABX account requires a domain before extensions can be provisioned.'),
      );
      return null;
    }
    return pabx;
  }

  private openGeneratedCredentials(response: unknown, pabxName: string): void {
    const credentials = readArray(response, 'credentials');
    if (!credentials.length) return;
    openDataViewerDialog(this.dialog, {
      title: 'Extension credentials',
      description: 'Save these credentials now. The password is only shown during provisioning.',
      status: { value: 'Success', tone: 'success' },
      details: [{ label: 'PABX', value: pabxName }],
      sections: [
        {
          title: 'Generated credentials',
          code: {
            title: 'Credentials',
            value: credentials,
            format: 'json',
            copy: true,
            download: { filename: 'pabx-extension-credentials.json', label: 'Download' },
          },
        },
      ],
      closeLabel: 'Close',
    });
  }
}

function extensionStatusSections(result: RuntimeDiagnosticResult) {
  const extensions = Array.isArray(result.result?.['extensions'])
    ? result.result['extensions'].filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      )
    : [];

  return [
    {
      title: 'Extension registrations',
      table: {
        columns: [
          { key: 'extension', label: 'Extension', monospace: true },
          { key: 'domain', label: 'Domain' },
          { key: 'registration', label: 'Registration', translate: true },
          { key: 'endpoint', label: 'Endpoint', monospace: true },
          { key: 'contact', label: 'Contact', monospace: true },
        ],
        rows: extensions.map((item) => ({
          extension: item['username'] ?? item['extension'] ?? '-',
          domain: item['domain'] ?? '-',
          registration: extensionRegistrationLabel(
            item['registrationStatus'] ?? item['status'] ?? 'unknown',
          ),
          endpoint: item['endpoint'] ?? '-',
          contact: item['contact'] ?? '-',
        })),
        emptyLabel: 'No extension statuses were returned.',
      },
    },
  ];
}

function extensionRegistrationLabel(value: unknown): string {
  switch (String(value ?? '').toLowerCase()) {
    case 'registered':
      return 'Registered';
    case 'not_registered':
      return 'Not registered';
    default:
      return 'Unknown';
  }
}

function toBoolean(value: unknown): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return (
    value === true ||
    value === 1 ||
    ['1', 'true', 'yes', 'y', 'active', 'enabled'].includes(normalized)
  );
}

function nullableString(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function splitCodecs(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRange(value: unknown): { start: number; end: number; total: number } | null {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) return null;
  return { start, end, total: end - start + 1 };
}

function parseParams(value: unknown): Record<string, unknown> | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readRows(response: unknown): ConfigurableCrudRecord[] {
  if (Array.isArray(response)) return response as ConfigurableCrudRecord[];
  const payload = response as { data?: unknown } | null;
  if (Array.isArray(payload?.data)) return payload.data as ConfigurableCrudRecord[];
  if (payload?.data && typeof payload.data === 'object') {
    const data = payload.data as { items?: unknown; rows?: unknown };
    if (Array.isArray(data.items)) return data.items as ConfigurableCrudRecord[];
    if (Array.isArray(data.rows)) return data.rows as ConfigurableCrudRecord[];
  }
  return [];
}

function readArray(response: unknown, key: string): ConfigurableCrudRecord[] {
  const payload = response as { data?: Record<string, unknown> } | null;
  const value = payload?.data?.[key];
  return Array.isArray(value) ? (value as ConfigurableCrudRecord[]) : [];
}

function mergeOption(
  items: readonly ConfigurableCrudOption[],
  option: ConfigurableCrudOption,
): ConfigurableCrudOption[] {
  const value = String(option.value);
  return [option, ...items.filter((item) => String(item.value) !== value)];
}

function mergePabxOption(
  items: readonly PabxLookup[],
  option: ConfigurableCrudOption,
): PabxLookup[] {
  const value = String(option.value);
  const enriched: PabxLookup = {
    ...option,
    requiresDomain: false,
    domainName: '',
    defaultCodecs: [],
  };
  return [enriched, ...items.filter((item) => String(item.value) !== value)];
}
