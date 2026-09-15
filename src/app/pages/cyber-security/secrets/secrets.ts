import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import {
  DataViewerDialogComponent,
  DataViewerDialogData,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const SECRET_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'runtime_env', label: 'Runtime env' },
  { value: 'api_token', label: 'API token' },
  { value: 'password', label: 'Password' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'ssh_key', label: 'SSH key' },
  { value: 'database', label: 'Database' },
];

const OPERATION_STATES: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'retry', label: 'Waiting to retry' },
  { value: 'success', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const SECRET_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'cyber-security/secrets',
  uuidField: 'CstUUID',
  pageTitle: 'Secrets Manager',
  pageDescription: 'Manage tenant secrets backed by MNSCloud OpenVault.',
  createTitle: 'New secret',
  editTitle: 'Edit secret',
  dialogDescription:
    'Configure the secret and its content. Storage is confirmed by the queued operation.',
  searchPlaceholder: 'Name or identifier',
  emptyLabel: 'No secrets found.',
  deleteTitle: 'Delete secret',
  deleteMessage: 'Are you sure you want to delete this secret?',
  deleteSelectedTitle: 'Delete selected secrets',
  deleteSelectedMessage: 'Delete {count} selected secrets?',
  savedMessage: 'Secret saved successfully.',
  deletedMessage: 'Secret deleted successfully.',
  deleteFailedMessage: 'Failed to delete secret.',
  bulkDelete: false,
  rowActions: [{ key: 'value', label: 'Set secret value', icon: 'key' }],
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusFilter: true,
  tabLabels: {
    authentication: 'Content',
    notes: 'Notes',
  },
  listFilters: [
    {
      key: 'accountUUID',
      label: 'Account',
      paramKey: 'accountUUID',
      type: 'search-select',
      span: 1,
      placeholder: 'Search account',
      emptyLabel: 'No accounts found.',
    },
    {
      key: 'secretType',
      label: 'Type',
      paramKey: 'secretType',
      span: 1,
      type: 'select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
      options: SECRET_TYPE_OPTIONS,
    },
  ],
  initialValues: {
    status: 1,
    accountUUID: '',
    name: '',
    secretType: 'generic',
    validity: 'none',
    customDays: 30,
    expiryDate: '',
    contentMode: 'replace',
    content: null,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'CstName', uuidField: 'CstUUID' },
    {
      id: 'account',
      label: 'Account',
      kind: 'related',
      uuidField: 'CyberSecuritySecretAccountCxaUUID',
      lookupKey: 'accountUUID',
    },
    { id: 'version', label: 'Stored version', field: 'CstVaultVersion' },
    {
      id: 'operation',
      label: 'Operation status',
      field: 'ValueState',
      kind: 'status',
      options: OPERATION_STATES,
      chipClass: (value) =>
        value === 'success'
          ? 'chip-success'
          : value === 'failed'
            ? 'chip-failed'
            : value === 'running'
              ? 'chip-running'
              : value === 'queued' || value === 'retry'
                ? 'chip-queued'
                : 'chip-skipped',
    },
    {
      id: 'validity',
      label: 'Validity',
      field: 'ValidityState',
      kind: 'status',
      chipClass: (value) =>
        value === 'expired'
          ? 'chip-failed'
          : value === 'valid'
            ? 'chip-success'
            : value === 'expiring' || value === 'pending'
              ? 'chip-queued'
              : 'chip-skipped',
      options: [
        { value: 'none', label: 'No expiration' },
        { value: 'pending', label: 'Pending storage' },
        { value: 'valid', label: 'Valid' },
        { value: 'expiring', label: 'Expiring soon' },
        { value: 'expired', label: 'Expired' },
      ],
    },
    { id: 'expiry', label: 'Expires at', field: 'CstExpiresAt', kind: 'datetime' },
    { id: 'type', label: 'Type', field: 'CstSecretType', lookupKey: 'secretType' },
    { id: 'server', label: 'Server', field: 'ResolvedServerName' },
    { id: 'operationError', label: 'Error code', field: 'ValueErrorCode' },
    { id: 'status', label: 'Status', kind: 'status', field: 'CstStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'CstStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'accountUUID',
      source: 'CyberSecuritySecretAccountCxaUUID',
      payloadKey: 'accountUUID',
      label: 'Account',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'CstName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'validity',
      label: 'Validity',
      type: 'select',
      span: 1,
      options: [
        { value: 'keep', label: 'Keep current validity' },
        { value: 'none', label: 'No expiration' },
        ...[30, 60, 90, 180, 365].map((days) => ({ value: String(days), label: `${days} days` })),
        { value: 'custom', label: 'Custom days' },
        { value: 'date', label: 'Specific date and time' },
      ],
    },
    {
      key: 'customDays',
      label: 'Validity in days',
      type: 'number',
      span: 1,
      hiddenWhen: ({ values }) => values['validity'] !== 'custom',
    },
    {
      key: 'expiryDate',
      label: 'Expires at',
      type: 'datetime',
      span: 1,
      hiddenWhen: ({ values }) => values['validity'] !== 'date',
    },
    {
      key: 'contentMode',
      label: 'Content update',
      type: 'select',
      tab: 'authentication',
      span: 1,
      options: [
        { value: 'keep', label: 'Keep stored content' },
        { value: 'replace', label: 'Replace content' },
      ],
      hiddenWhen: ({ editing }) => !editing,
    },
    {
      key: 'secretType',
      source: 'CstSecretType',
      label: 'Type',
      type: 'select',
      required: true,
      tab: 'authentication',
      span: 1,
      options: SECRET_TYPE_OPTIONS,
      hiddenWhen: ({ editing, values }) => editing && values['contentMode'] === 'keep',
    },
    {
      key: 'content',
      label: 'Content',
      type: 'secret-content',
      tab: 'authentication',
      span: 4,
      hiddenWhen: ({ editing, values }) => editing && values['contentMode'] === 'keep',
    },
    {
      key: 'notes',
      source: 'CstNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
    },
  ],
};

@Component({
  selector: 'app-cyber-security-secrets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecuritySecretsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly auth = inject(AuthService);
  private readonly deleteIntents = new Map<string, string>();
  private readonly rawApi = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster() ? 'system/cyber-security/secrets' : SECRET_CONFIG.endpoint,
  );
  private readonly accountEndpoint = computed(() =>
    this.isMaster() ? 'system/cyber-security/secret-accounts' : 'cyber-security/secret-accounts',
  );
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(SECRET_CONFIG);
    this.destroyRef.onDestroy(() => this.formValues.set({}));
    void this.loadAccounts();
  }

  private allowed(action: string): boolean {
    if (this.isMaster() && (this.auth.user()?.permissions ?? []).includes('platform.master.access'))
      return true;
    const required = `${this.isMaster() ? 'platform' : 'tenant'}.cyber-security.secrets.${action}`;
    return (this.auth.user()?.permissions ?? []).some((permission) => {
      const parts = permission
        .toLowerCase()
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return new RegExp(`^${parts.join('.*')}$`).test(required);
    });
  }

  override canEditRow(row: ConfigurableCrudRecord): boolean {
    return !row['CstDateDeleted'] && this.allowed('write') && super.canEditRow(row);
  }
  override canDeleteRow(row: ConfigurableCrudRecord): boolean {
    return (
      !row['CstDateDeleted'] &&
      !this.pending(row) &&
      this.allowed('delete') &&
      super.canDeleteRow(row)
    );
  }
  private pending(row: ConfigurableCrudRecord): boolean {
    return ['queued', 'running', 'retry', 'failed'].includes(String(row['ValueState']));
  }
  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions: ConfigurableCrudRowAction[] = [];
    if (!row['CstDateDeleted'] && !this.pending(row) && this.allowed('write'))
      actions.push({ key: 'value', label: 'Set secret value', icon: 'key' });
    if (!row['CstDateDeleted'] && Number(row['CstVaultVersion']) > 0 && this.allowed('reveal'))
      actions.push({ key: 'reveal', label: 'Reveal secret', icon: 'visibility' });
    if (row['ValueState'] === 'failed' && this.allowed(row['CstDateDeleted'] ? 'delete' : 'write'))
      actions.push({ key: 'retry', label: 'Retry operation', icon: 'refresh' });
    return actions;
  }
  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    const path = `${this.endpoint()}/${this.recordUUID(row)}`;
    if (!this.rowActions(row).some((item) => item.key === action.key)) return;
    if (action.key === 'value') {
      this.startEdit(row);
      this.setFieldValue('contentMode', 'replace');
      return;
    }
    if (action.key === 'retry') {
      if (!(await this.confirmAction('Retry operation', 'Retry this failed secret operation?')))
        return;
      await this.rawApi.post(`${path}/operations/${row['OperationUUID']}/retry`, {});
      this.itemsResource.reload();
      this.snack.success('Secret operation queued.');
      return;
    }
    if (
      !(await this.confirmAction(
        'Reveal secret',
        'The secret will be visible for 30 seconds. This access is audited.',
      ))
    )
      return;
    const response = await this.rawApi.post<{
      data: { secretValue: string; contentSchemaVersion: number };
    }>(`${path}/reveal`, {});
    const data: DataViewerDialogData = {
      title: 'Reveal secret',
      description: 'The secret will be visible for 30 seconds. This access is audited.',
      sections: [
        {
          title: 'Secret value',
          code: {
            value:
              response.data.contentSchemaVersion === 1
                ? JSON.stringify(JSON.parse(response.data.secretValue), null, 2)
                : response.data.secretValue,
            format: 'text',
            copy: false,
          },
        },
      ],
    };
    response.data.secretValue = '';
    const binding = openCrudComponentDialog(
      this.dialog,
      DataViewerDialogComponent,
      'crud-form-dialog',
      { data },
    );
    const timer = setTimeout(() => binding.ref.close(), 30_000);
    const unregister = this.destroyRef.onDestroy(() => binding.ref.close());
    try {
      await firstValueFrom(binding.ref.afterClosed());
    } finally {
      clearTimeout(timer);
      data.sections![0].code!.value = '';
      data.sections = [];
      binding.stop();
      unregister();
    }
  }
  override async deleteItem(row: ConfigurableCrudRecord): Promise<void> {
    if (
      !this.canDeleteRow(row) ||
      !(await this.confirmAction(
        'Delete secret',
        'Remove this secret and queue removal of its stored value?',
        'Delete',
      ))
    )
      return;
    const uuid = this.recordUUID(row);
    const intentKey = `${uuid}:${row['CstVaultVersion']}`;
    const idempotencyKey = this.deleteIntents.get(intentKey) ?? crypto.randomUUID();
    this.deleteIntents.set(intentKey, idempotencyKey);
    this.mutating.set(true);
    try {
      await this.rawApi.delete(
        `${this.endpoint()}/${uuid}`,
        { expectedVersion: Number(row['CstVaultVersion']) },
        { idempotencyKey },
      );
      this.deleteIntents.delete(intentKey);
      this.itemsResource.reload();
      this.snack.success('Secret operation queued.');
    } finally {
      this.mutating.set(false);
    }
  }

  override fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    const options = super.fieldOptions(field);
    return field.key === 'validity' && !this.editingRecord()
      ? options.filter((option) => option.value !== 'keep')
      : options;
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'accountUUID' && this.lookupsLoading();
  }

  protected override listEndpoint(): string {
    return this.endpoint();
  }

  protected override createEndpoint(): string {
    return this.endpoint();
  }

  protected override updateEndpoint(): string {
    return this.endpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.endpoint();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'operationState') return OPERATION_STATES;
    if (key === 'accountUUID') return this.accountOptions();
    if (key === 'secretType')
      return SECRET_TYPE_OPTIONS.map((item) => ({ ...item, label: this.t(item.label) }));
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.accountOptions().length) await this.loadAccounts();
    return super.fetchItems(filters);
  }

  // Queue acceptance is not storage confirmation. Reload only server metadata;
  // never reflect submitted content into the list resource cache.
  protected override reflectSavedRecord(
    _current: ConfigurableCrudRecord,
    _payload: ConfigurableCrudRecord,
  ): void {}

  private submissionUUID = crypto.randomUUID();

  override startCreate(): void {
    this.submissionUUID = crypto.randomUUID();
    super.startCreate();
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    this.submissionUUID = crypto.randomUUID();
    this.formValues.update((values) => ({
      ...values,
      validity: 'keep',
      contentMode: 'keep',
      content: null,
    }));
  }

  override closeDialog(): void {
    this.formValues.update((values) => ({ ...values, content: null }));
    super.closeDialog();
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    this.submissionUUID = crypto.randomUUID();
    if (key === 'secretType' || key === 'contentMode')
      this.formValues.update((values) => ({ ...values, content: null }));
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    const values = this.formValues();
    if ((!this.editingRecord() || values['contentMode'] === 'replace') && !values['content']) {
      this.snack.error(this.t('Enter the secret content.'));
      return;
    }
    if (
      values['validity'] === 'date' &&
      !Number.isFinite(new Date(String(values['expiryDate'])).getTime())
    ) {
      this.snack.error(this.t('Enter a valid expiration date and time.'));
      return;
    }
    if (
      values['validity'] === 'custom' &&
      (!Number.isInteger(Number(values['customDays'])) ||
        Number(values['customDays']) < 1 ||
        Number(values['customDays']) > 3650)
    ) {
      this.snack.error(this.t('Enter a validity between 1 and 3650 days.'));
      return;
    }
    await super.saveItem(saveAndNew);
    if (saveAndNew && !this.formValues()['content']) this.submissionUUID = crypto.randomUUID();
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const values = this.formValues();
    const mode = String(values['validity'] ?? 'keep');
    const validity =
      mode === 'date'
        ? { mode: 'date', expiresAt: new Date(String(values['expiryDate'])).toISOString() }
        : mode === 'none' || mode === 'keep'
          ? { mode }
          : { mode: 'days', days: Number(mode === 'custom' ? values['customDays'] : mode) };
    const replace = !this.editingRecord() || values['contentMode'] === 'replace';
    return {
      name: payload['name'],
      accountUUID: payload['accountUUID'],
      secretType: replace ? values['secretType'] : this.editingRecord()?.['CstSecretType'],
      validity,
      status: payload['status'],
      notes: payload['notes'],
      expectedVersion: Number(this.editingRecord()?.['CstVaultVersion'] ?? 0),
      ...(replace
        ? {
            submissionUUID: this.submissionUUID,
            content: { schemaVersion: 1, type: values['secretType'], fields: values['content'] },
          }
        : {}),
    };
  }

  private async loadAccounts(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const options = await this.fetchPaged(`${this.accountEndpoint()}?status=1`, (row) =>
        option(row.CxaUUID, row.CxaName, [row.CustomerName, row.SecretServerName]),
      );
      this.accountOptions.set(options);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: any) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const options: ConfigurableCrudOption[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<any>(
        `${endpoint}${separator}limit=500&offset=${offset}`,
      );
      const rows = extractItems(response);
      options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < 500) break;
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}

function option(
  value: unknown,
  label: unknown,
  descriptionParts: unknown[] = [],
): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' - ');
  return {
    value: normalizedValue,
    label: normalizedLabel,
    description,
    searchText: `${normalizedLabel} ${description} ${normalizedValue}`,
  };
}
