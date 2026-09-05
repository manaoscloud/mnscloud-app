import { Component, computed, inject, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudPageBase,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AuthService } from '../../../services/auth.service';
import { TenantAccess, TenantService } from '../../../services/tenant.service';

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const EFFECT_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'allow', label: 'Allow access' },
  { value: 'deny', label: 'Block access' },
];

const PERMISSION_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'user/permissions/grants',
  createEndpoint: 'user/permissions/grants',
  deleteEndpoint: 'user/permissions/grants',
  uuidField: 'uuid',
  pageTitle: 'Special permissions',
  pageDescription: 'Create user-specific exceptions outside access profiles.',
  createTitle: 'New special permission',
  editTitle: 'Edit special permission',
  dialogDescription:
    'Choose a user, select the permission and define whether it allows or blocks access.',
  searchPlaceholder: 'User, e-mail or permission',
  emptyLabel: 'No permission grants found.',
  deleteTitle: 'Revoke permission grant',
  deleteMessage: 'Are you sure you want to revoke this permission grant?',
  deleteSelectedTitle: 'Revoke selected permission grants',
  deleteSelectedMessage: 'Revoke {count} selected permission grants?',
  savedMessage: 'Permission grant saved successfully.',
  deletedMessage: 'Permission grant revoked successfully.',
  deleteFailedMessage: 'Failed to revoke permission grant.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  serverSidePagination: true,
  canEdit: false,
  bulkDelete: false,
  tabLabels: {
    authentication: 'Access rule',
    notes: 'Notes',
  },
  initialValues: {
    userUUID: '',
    permissionCode: '',
    effect: 'allow',
    expiresAt: '',
    environmentUUID: '',
    reason: '',
  },
  columns: [
    { id: 'userName', label: 'User', kind: 'identity', field: 'userName', uuidField: 'userUUID' },
    { id: 'permissionCode', label: 'Permission', field: 'permissionCode' },
    { id: 'scope', label: 'Scope', field: 'scope', translateValue: true },
    { id: 'effect', label: 'Effect', field: 'effect', translateValue: true },
    { id: 'environmentName', label: 'Tenant', field: 'environmentName' },
    { id: 'expiresAt', label: 'Expires', kind: 'datetime', field: 'expiresAt' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'userUUID',
      source: 'userUUID',
      payloadKey: 'userUUID',
      label: 'User',
      type: 'search-select',
      required: true,
      span: 4,
      tab: 'authentication',
      placeholder: 'Search user',
    },
    {
      key: 'permissionCode',
      source: 'permissionCode',
      payloadKey: 'permissionCode',
      label: 'Permission',
      type: 'search-select',
      required: true,
      span: 4,
      tab: 'authentication',
      placeholder: 'Search permission',
    },
    {
      key: 'effect',
      source: 'effect',
      payloadKey: 'effect',
      label: 'Effect',
      type: 'select',
      options: EFFECT_OPTIONS,
      required: true,
      span: 2,
      tab: 'authentication',
    },
    {
      key: 'environmentUUID',
      source: 'environmentUUID',
      payloadKey: 'environmentUUID',
      label: 'Tenant',
      type: 'search-select',
      span: 2,
      tab: 'authentication',
      placeholder: 'Search tenant',
      hiddenWhen: ({ values }) => String(values['permissionCode'] ?? '').startsWith('platform.'),
    },
    {
      key: 'expiresAt',
      source: 'expiresAt',
      payloadKey: 'expiresAt',
      label: 'Expiration',
      type: 'date',
      span: 1,
      tab: 'authentication',
    },
    {
      key: 'reason',
      source: 'reason',
      payloadKey: 'reason',
      label: 'Reason',
      type: 'textarea',
      placeholder: 'Explain why this exception is needed.',
      rows: 4,
      span: 4,
      tab: 'notes',
    },
  ],
};

@Component({
  selector: 'app-user-permissions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class UserPermissionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly permissionOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly userOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly tenantOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly tenantRecords = signal<TenantAccess[]>([]);
  private readonly loadingUsers = signal(false);
  private readonly loadingTenants = signal(false);
  private readonly isMaster = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('platform.master.access'),
  );

  constructor() {
    super(PERMISSION_CONFIG);
    void this.loadCatalog();
    void this.loadTenants();
    void this.loadUsers();
  }

  protected override listEndpoint(): string {
    return this.isMaster() ? 'user/permissions/platform/grants' : 'user/permissions/grants';
  }

  protected override createEndpoint(): string {
    return this.isMaster() ? 'user/permissions/platform/grants' : 'user/permissions/grants';
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.isMaster() ? 'user/permissions/platform/grants' : 'user/permissions/grants';
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'permissionCode') return this.permissionOptions();
    if (key === 'userUUID') return this.userOptions();
    if (key === 'environmentUUID') return this.tenantOptions();
    return [];
  }

  override fieldLoading(field: { key: string }): boolean {
    if (field.key === 'userUUID') return this.loadingUsers();
    if (field.key === 'environmentUUID') return this.loadingTenants();
    return super.fieldLoading(field as never);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'permissionCode' && String(value ?? '').startsWith('platform.')) {
      this.setFieldValue('environmentUUID', '');
      return;
    }

    if (key === 'environmentUUID') {
      const tenant = this.tenantRecords().find(
        (item) => item.EnvironmentUUID === String(value ?? ''),
      );
      if (tenant) this.selectTenantContext(tenant);
      void this.loadUsers();
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const permissionCode = String(payload['permissionCode'] ?? '');
    const environmentUUID = String(payload['environmentUUID'] ?? '').trim();
    return {
      ...payload,
      permissionCode,
      environmentUUID: permissionCode.startsWith('platform.')
        ? null
        : environmentUUID || this.tenantService.selectedTenant()?.EnvironmentUUID || null,
    };
  }

  private async loadCatalog(): Promise<void> {
    const response = await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
      'user/permissions/catalog',
    );
    const items = response?.data?.items ?? [];
    this.permissionOptions.set(
      items
        .filter((item) => this.isMaster() || String(item['scope'] ?? '') !== 'platform')
        .map((item) => this.permissionOption(item))
        .filter((item) => item.value),
    );
  }

  private async loadTenants(): Promise<void> {
    this.loadingTenants.set(true);
    try {
      if (this.tenantService.tenants().length === 0) await this.tenantService.loadTenants();
      let tenants = this.tenantService.tenants();
      if (this.isMaster()) {
        const masterLookup = await this.fetchMasterTenantLookup();
        if (masterLookup.length) tenants = masterLookup;
      }
      this.tenantRecords.set(tenants);
      this.tenantOptions.set(tenants.map((tenant) => this.tenantOption(tenant)));
      const selected = this.tenantService.selectedTenant()?.EnvironmentUUID;
      if (selected && !this.fieldValueString('environmentUUID')) {
        this.setFieldValue('environmentUUID', selected);
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load tenants.');
    } finally {
      this.loadingTenants.set(false);
    }
  }

  private async fetchMasterTenantLookup(): Promise<TenantAccess[]> {
    try {
      const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        'system/billing/tenants?search=&limit=500&offset=0',
      );
      return (response.data?.items ?? [])
        .map((row) => ({
          EnvironmentUUID: String(row['EnvironmentUUID'] ?? row['environmentUUID'] ?? ''),
          EnvironmentName: String(
            row['EnvironmentName'] ?? row['environmentName'] ?? row['TenantEmail'] ?? '',
          ),
          Status: Number(row['TenantStatus'] ?? row['status'] ?? 1),
        }))
        .filter((tenant) => tenant.EnvironmentUUID);
    } catch {
      return [];
    }
  }

  private async loadUsers(): Promise<void> {
    this.loadingUsers.set(true);
    try {
      const response = await this.api.get<{ data?: { members?: ConfigurableCrudRecord[] } }>(
        'user/access/members',
      );
      this.userOptions.set((response.data?.members ?? []).map((member) => this.userOption(member)));
    } catch (error) {
      this.userOptions.set([]);
      this.snack.error(this.errorMessage(error) || 'Failed to load users.');
    } finally {
      this.loadingUsers.set(false);
    }
  }

  private tenantOption(tenant: TenantAccess): ConfigurableCrudOption {
    return {
      value: tenant.EnvironmentUUID,
      label: tenant.EnvironmentName || tenant.EnvironmentUUID,
      description: tenant.EnvironmentUUID,
      searchText: `${tenant.EnvironmentName} ${tenant.EnvironmentUUID}`,
    };
  }

  private selectTenantContext(tenant: TenantAccess): void {
    this.tenantService.selectedTenant.set(tenant);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mc_current_env', tenant.EnvironmentUUID);
    }
  }

  private userOption(member: ConfigurableCrudRecord): ConfigurableCrudOption {
    const uuid = String(member['UserUUID'] ?? member['userUUID'] ?? '');
    const name = String(member['Name'] ?? member['name'] ?? '').trim();
    const email = String(member['Email'] ?? member['email'] ?? '').trim();
    return {
      value: uuid,
      label: name || email || uuid,
      description: email || uuid,
      searchText: `${name} ${email} ${uuid}`,
    };
  }

  private permissionOption(item: Record<string, unknown>): ConfigurableCrudOption {
    const code = String(item['code'] ?? '').trim();
    const scope = String(item['scope'] ?? '').trim();
    const action = code.split('.').at(-1) ?? '';
    const tag = String(item['tag'] ?? '').trim();
    const name = String(item['name'] ?? code).trim();
    const label = [
      this.transloco.translate(this.scopeLabel(scope)),
      tag || name,
      this.transloco.translate(this.actionLabel(action)),
    ]
      .filter(Boolean)
      .join(' / ');
    return {
      value: code,
      label,
      description: code,
      searchText: `${label} ${name} ${code} ${item['description'] ?? ''}`,
    };
  }

  private scopeLabel(scope: string): string {
    if (scope === 'platform') return 'Platform';
    return 'Tenant';
  }

  private actionLabel(action: string): string {
    const labels: Record<string, string> = {
      access: 'Access',
      create: 'Create',
      delete: 'Delete',
      manage: 'Manage',
      read: 'Read',
      update: 'Update',
    };
    return labels[action] ?? action.toUpperCase();
  }
}
