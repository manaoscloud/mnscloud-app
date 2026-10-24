import { Component, effect, signal, untracked } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudColumn,
  ConfigurableCrudFilterAction,
  ConfigurableCrudListSummaryItem,
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

type PabxLookup = ConfigurableCrudOption & {
  requiresDomain: boolean;
  domainName: string;
  defaultCodecs: string[];
};

type PresenceState = 'online' | 'offline' | 'never' | 'unknown' | 'disabled';

type ExtensionPresence = {
  PresenceState?: PresenceState | null;
  PresenceSince?: string | null;
  PresenceLastRegisteredAt?: string | null;
  PresenceContactCount?: number | null;
  PresenceUserAgent?: string | null;
  PresenceNetworkIP?: string | null;
};

type ExtensionRecord = ConfigurableCrudRecord &
  ExtensionPresence & {
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

// Registration presence: green connected, red dropped after registering, orange never used,
// grey when the extension is off or its PABX server has not reported recently.
const presenceOptions: readonly ConfigurableCrudOption[] = [
  { value: 'online', label: 'Connected' },
  { value: 'offline', label: 'Offline' },
  { value: 'never', label: 'Never used' },
  { value: 'unknown', label: 'No telemetry' },
  { value: 'disabled', label: 'Disabled' },
];

const presenceChipClasses: Record<PresenceState, string> = {
  online: 'chip-success',
  offline: 'chip-failed',
  never: 'chip-warning',
  unknown: 'chip-skipped',
  disabled: 'chip-skipped',
};

/** Presence refresh while the page is visible; it reads stored state, never the PABX engine. */
const PRESENCE_REFRESH_MS = 30_000;
const PRESENCE_MAX_IDS = 200;

const yesNoOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const contextOptions: readonly ConfigurableCrudOption[] = [
  { value: 'default', label: 'Default (internal)' },
  { value: 'public', label: 'Public (inbound)' },
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
    type: 'select',
    tab: 'routing',
    span: 1,
    options: contextOptions,
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
    key: 'techPrefix',
    source: 'VpeTechPrefix',
    payloadKey: 'techPrefix',
    label: 'Tech prefix',
    type: 'text',
    tab: 'routing',
    span: 1,
    autocomplete: 'off',
    help: 'Outbound tech prefix sent to the carrier before the dialed number. It has priority over the trunk and the PABX account; empty inherits them.',
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
    help: 'Optional. Empty uses the dial plan of the PABX account.',
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
];

const config: ConfigurableCrudConfig = {
  endpoint: 'voip/pabx/extensions',
  bulkDeleteEndpoint: 'voip/pabx/extensions/bulk',
  uuidField: 'VpeUUID',
  pageTitle: 'PABX Extensions',
  pageDescription: 'Manage extensions linked to tenant PABX accounts.',
  createTitle: 'New PABX extension',
  editTitle: 'Edit PABX extension',
  dialogDescription: 'Maintain extension identity, routing, voicemail, and codecs.',
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
    { id: 'status', label: 'Status', field: 'VpeEnabled', kind: 'status' },
    {
      id: 'presence',
      label: 'Online',
      field: 'PresenceState',
      kind: 'status',
      options: presenceOptions,
      chipClass: (value) => presenceChipClasses[presenceState(value)],
    },
    {
      id: 'username',
      label: 'Extension',
      field: 'VpeUsername',
      kind: 'identity',
      uuidField: 'VpeUUID',
      copyable: true,
    },
    { id: 'password', label: 'Password', field: 'VpePassword', kind: 'secret', copyable: true },
    { id: 'pabx', label: 'PABX', field: 'PabxName', kind: 'text' },
    { id: 'domain', label: 'Domain', field: 'DomainName', kind: 'text', copyable: true },
    { id: 'engine', label: 'Engine', field: 'VpeEngine', kind: 'text' },
    { id: 'dialPlan', label: 'Dial plan', field: 'DialPlanName', kind: 'text' },
    { id: 'recordCalls', label: 'Call recording', field: 'VpeRecordCalls', kind: 'boolean' },
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
    context: 'default',
    outboundCid: '',
    techPrefix: '',
    dialPlanUUID: '',
    vmEnabled: 0,
    vmPassword: '',
    recordCalls: 0,
    codecs: [],
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
    {
      key: 'PresenceState',
      label: 'Online',
      paramKey: 'presence',
      type: 'select',
      span: 1,
      options: presenceOptions,
      translateOptions: true,
    },
  ],
  filterActionMenu: {
    label: 'Live diagnostic',
    icon: 'monitor_heart',
    actions: [
      {
        key: 'runtime-status-all',
        label: 'Extensions',
        tooltip: 'Query the PABX now for every extension of the selected PABX',
        icon: 'dialpad',
      },
    ],
  },
  rowActions: [
    {
      key: 'presence-history',
      label: 'Presence history',
      tooltip: 'Online and offline changes of this extension in the last 30 days',
      icon: 'history',
    },
    {
      key: 'runtime-status',
      label: 'Live diagnostic',
      tooltip: 'Query the PABX now for this extension registration',
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
  },
};

@Component({
  selector: 'app-voip-pabx-extension',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxExtensionPage extends ConfigurableCrudPageBase<ExtensionRecord> {
  private readonly pabxOptionsState = signal<readonly PabxLookup[]>([]);
  private readonly dialPlanOptionsState = signal<readonly ConfigurableCrudOption[]>([]);
  private readonly lookupsLoading = signal(false);
  private readonly presenceSummary = signal<Record<PresenceState, number> | null>(null);
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private presenceInFlight = false;
  private schedulePresence: ((delay: number) => void) | null = null;

  constructor() {
    super(config);
    void this.loadLookups();
    this.startPresenceRefresh();
    // A new PABX filter changes the counters: refresh them right away.
    effect(() => {
      this.appliedFilters();
      untracked(() => this.schedulePresence?.(0));
    });
  }

  override listSummary(): readonly ConfigurableCrudListSummaryItem[] {
    const summary = this.presenceSummary();
    if (!summary) return [];
    return (['online', 'offline', 'never', 'unknown'] as const)
      .filter((state) => state !== 'unknown' || summary.unknown > 0)
      .map((state) => ({
        key: state,
        label: presenceOptions.find((option) => option.value === state)?.label ?? state,
        value: summary[state],
        chipClass: presenceChipClasses[state],
        tooltip: presenceSummaryTooltips[state],
      }));
  }

  override statusChipTooltip(row: ExtensionRecord, column: ConfigurableCrudColumn): string {
    if (column.id !== 'presence') return super.statusChipTooltip(row, column);
    const state = presenceState(row.PresenceState);
    const when = (value: unknown) =>
      this.dateTime.formatDateTime(value as string | null | undefined, 'short', 'short') || '-';
    const lines: string[] = [];
    if (state === 'online') {
      lines.push(this.t('Online since {date}', { date: when(row.PresenceSince) }));
      const devices = Number(row.PresenceContactCount ?? 0);
      if (devices > 1) lines.push(this.t('{count} devices registered', { count: devices }));
    } else if (state === 'offline') {
      lines.push(this.t('Offline since {date}', { date: when(row.PresenceSince) }));
      lines.push(this.t('Last registration: {date}', { date: when(row.PresenceLastRegisteredAt) }));
    } else if (state === 'never') {
      lines.push(this.t('This extension has never registered.'));
    } else if (state === 'unknown') {
      lines.push(this.t('The PABX server has not reported recently, so the status is unknown.'));
    } else {
      lines.push(this.t('The extension is disabled.'));
    }
    if (state === 'online' || state === 'offline') {
      if (row.PresenceUserAgent) lines.push(String(row.PresenceUserAgent));
      if (row.PresenceNetworkIP) lines.push(String(row.PresenceNetworkIP));
    }
    return lines.join(' · ');
  }

  /**
   * Refreshes the presence of the rows on screen and the counters every 30 s, only while the
   * browser tab is visible. One light database read; the PABX engine is never queried here.
   */
  private startPresenceRefresh(): void {
    if (typeof document === 'undefined') return;
    const schedule = (delay: number) => {
      if (this.destroyRef.destroyed) return;
      if (this.presenceTimer) clearTimeout(this.presenceTimer);
      // Jitter keeps many open tabs from refreshing in lockstep.
      this.presenceTimer = setTimeout(tick, delay + Math.floor(Math.random() * 3_000));
    };
    this.schedulePresence = schedule;
    const tick = async () => {
      if (this.destroyRef.destroyed) return;
      if (document.visibilityState === 'visible') await this.refreshPresence();
      schedule(PRESENCE_REFRESH_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule(0);
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      if (this.presenceTimer) clearTimeout(this.presenceTimer);
    });
    schedule(0);
  }

  private async refreshPresence(): Promise<void> {
    if (this.presenceInFlight) return;
    this.presenceInFlight = true;
    try {
      const ids = this.visibleRows()
        .map((row) => String(row.VpeUUID ?? '').trim())
        .filter(Boolean)
        .slice(0, PRESENCE_MAX_IDS);
      const params = new URLSearchParams();
      if (ids.length) params.set('ids', ids.join(','));
      const pabxUUID = this.selectedPabxUUID();
      if (pabxUUID) params.set('pabxUUID', pabxUUID);
      const response = await this.api.get<{
        data?: {
          items?: Array<ExtensionPresence & { VpeUUID: string }>;
          summary?: Record<PresenceState, number>;
        };
      }>(`voip/pabx/extensions/presence?${params.toString()}`);
      const data = response?.data;
      if (data?.summary) this.presenceSummary.set(data.summary);
      const items = new Map((data?.items ?? []).map((item) => [String(item.VpeUUID), item]));
      if (!items.size || !this.itemsResource.hasValue()) return;
      this.itemsResource.update((rows) =>
        rows.map((row) => {
          const next = items.get(String(row.VpeUUID));
          return next && presenceChanged(row, next) ? { ...row, ...next } : row;
        }),
      );
    } catch {
      // Best effort: the next tick retries; the list keeps the last known values.
    } finally {
      this.presenceInFlight = false;
    }
  }

  /** Stored transitions only (30 days); never reaches the PABX engine. */
  private async openPresenceHistory(extensionUUID: string, row: ExtensionRecord): Promise<void> {
    try {
      const response = await this.api.get<{
        data?: { items?: PresenceHistoryItem[]; total?: number };
      }>(`voip/pabx/extensions/${extensionUUID}/presence/history?limit=${PRESENCE_HISTORY_LIMIT}`);
      const items = response?.data?.items ?? [];
      const total = Number(response?.data?.total ?? items.length);
      openDataViewerDialog(this.dialog, {
        title: 'Presence history',
        description: 'Online and offline changes reported by the PABX in the last 30 days.',
        details: [
          { label: 'Extension', value: String(row['VpeUsername'] ?? '-') },
          { label: 'Changes', value: String(total) },
        ],
        sections: [
          {
            title: 'Changes',
            table: {
              columns: [
                { key: 'occurredAt', label: 'Date', kind: 'datetime' },
                { key: 'change', label: 'Change', translate: true },
                { key: 'networkIP', label: 'Network', monospace: true },
                { key: 'userAgent', label: 'Device' },
              ],
              rows: items.map((item) => ({
                occurredAt: item.occurredAt,
                change: presenceChangeLabel(item),
                networkIP: item.networkIP ?? '-',
                userAgent: item.userAgent ?? '-',
              })),
              emptyLabel: 'No changes in the last 30 days.',
            },
          },
        ],
        closeLabel: 'Close',
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  private selectedPabxUUID(): string {
    return String(
      this.listFilterValue({ key: 'pabxUUID', label: 'PABX', type: 'search-select' }) ?? '',
    ).trim();
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
    this.clearFieldErrors(null);
    const pabx = this.validateSelectedPabx(values['pabxUUID']);
    if (!pabx) return;

    const range = parseRange(values['extensionRange']);
    if (!range) {
      this.rejectField('extensionRange', 'Range must follow the format 1000-1010.');
      return;
    }
    if (range.total > 100) {
      this.rejectField('extensionRange', 'Range exceeds max size of 100 extensions per operation.');
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
    return (
      action.key === 'runtime-status-all' &&
      !String(
        this.listFilterValue({
          key: 'pabxUUID',
          label: 'PABX',
          type: 'search-select',
        }),
      ).trim()
    );
  }

  override filterActionDisabledReason(action: ConfigurableCrudFilterAction): string | null {
    return this.isFilterActionDisabled(action) ? 'Select a PABX in the filter first' : null;
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
      description:
        'Read-only registration and connectivity status of extensions assigned to the selected PABX.',
      startEndpoint: `voip/pabx/accounts/${pabxUUID}/extensions/runtime-status`,
      statusEndpoint: (jobUUID) =>
        `voip/pabx/accounts/${pabxUUID}/extensions/runtime-status/${jobUUID}`,
      sections: extensionStatusSections,
    });
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ExtensionRecord): void {
    const extensionUUID = String(row['VpeUUID'] ?? '').trim();
    if (!extensionUUID) return;
    if (action.key === 'presence-history') {
      void this.openPresenceHistory(extensionUUID, row);
      return;
    }
    if (action.key !== 'runtime-status') return;

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
      this.rejectField('pabxUUID', 'Select a PABX account.');
      return null;
    }
    if (pabx.disabled) {
      this.rejectField(
        'pabxUUID',
        'PABX account requires a domain before extensions can be provisioned.',
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

const PRESENCE_HISTORY_LIMIT = 200;

type PresenceHistoryItem = {
  fromState: 'online' | 'offline' | null;
  toState: 'online' | 'offline';
  networkIP: string | null;
  userAgent: string | null;
  occurredAt: string;
};

function presenceChangeLabel(item: PresenceHistoryItem): string {
  if (item.toState === 'offline') return 'Went offline';
  return item.fromState === null ? 'First registration' : 'Came online';
}

const presenceSummaryTooltips: Record<PresenceState, string> = {
  online: 'Extensions registered now',
  offline: 'Extensions that registered before and are not registered now',
  never: 'Extensions that never registered',
  unknown: 'Extensions whose PABX server has not reported recently',
  disabled: 'Disabled extensions',
};

function presenceState(value: unknown): PresenceState {
  const state = String(value ?? '').toLowerCase();
  return state in presenceChipClasses ? (state as PresenceState) : 'unknown';
}

function presenceChanged(row: ExtensionRecord, next: ExtensionPresence): boolean {
  return (
    row.PresenceState !== next.PresenceState ||
    row.PresenceSince !== next.PresenceSince ||
    row.PresenceContactCount !== next.PresenceContactCount ||
    row.PresenceUserAgent !== next.PresenceUserAgent ||
    row.PresenceNetworkIP !== next.PresenceNetworkIP
  );
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

function readRows(response: unknown): ConfigurableCrudRecord[] {
  const payload = response as { data?: unknown } | null;
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
