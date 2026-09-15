import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { SecretValueDialogComponent } from '../../../shared/secret-value-dialog/secret-value-dialog';
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
  dialogDescription: 'Configure secret identity and account. Set its value separately.',
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
    authentication: 'Vault',
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
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
      options: SECRET_TYPE_OPTIONS,
    },
  ],
  initialValues: {
    status: 1,
    accountUUID: '',
    name: '',
    key: '',
    secretType: 'generic',
    expiresAt: '',
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
    { id: 'key', label: 'Key', field: 'CstKey' },
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
    {
      key: 'secretType',
      source: 'CstSecretType',
      payloadKey: 'secretType',
      label: 'Type',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'CstName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'key',
      source: 'CstKey',
      payloadKey: 'key',
      label: 'Key',
      required: true,
      tab: 'authentication',
      span: 2,
    },
    {
      key: 'expiresAt',
      source: 'CstExpiresAt',
      payloadKey: 'expiresAt',
      label: 'Expires at',
      type: 'date',
      tab: 'authentication',
      span: 1,
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
      const binding = openCrudComponentDialog(
        this.dialog,
        SecretValueDialogComponent,
        'crud-form-dialog',
        {
          data: {
            save: async (secretValue: string, idempotencyKey: string) => {
              await this.rawApi.post(
                `${path}/value`,
                { secretValue, expectedVersion: Number(row['CstVaultVersion']) },
                { idempotencyKey },
              );
              this.snack.success('Secret operation queued.');
              this.itemsResource.reload();
            },
          },
          onEscape: () => (binding.ref.componentInstance as SecretValueDialogComponent).close(),
        },
      );
      const unregister = this.destroyRef.onDestroy(() => binding.ref.close());
      try {
        await firstValueFrom(binding.ref.afterClosed());
      } finally {
        binding.stop();
        unregister();
      }
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
    const response = await this.rawApi.post<{ data: { secretValue: string } }>(
      `${path}/reveal`,
      {},
    );
    const data: DataViewerDialogData = {
      title: 'Reveal secret',
      description: 'The secret will be visible for 30 seconds. This access is audited.',
      sections: [
        {
          title: 'Secret value',
          code: { value: response.data.secretValue, format: 'text', copy: false },
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
    if (key === 'secretType') return SECRET_TYPE_OPTIONS.map((item) => ({ ...item, label: this.t(item.label) }));
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.accountOptions().length) await this.loadAccounts();
    return super.fetchItems(filters);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      key: payload['key'],
      accountUUID: payload['accountUUID'],
      description: payload['description'],
      secretType: payload['secretType'],
      expiresAt: payload['expiresAt'],
      status: payload['status'],
      notes: payload['notes'],
    };
  }

  private async loadAccounts(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const options = await this.fetchPaged(`${this.accountEndpoint()}?status=1`, (row) =>
        option(row.CxaUUID, row.CxaName, [row.CustomerName, row.SecretServerName, row.CxaKey]),
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
