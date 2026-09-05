import { Component, computed, inject, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudPageBase,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AuthService } from '../../../services/auth.service';
import { TenantAccess, TenantService } from '../../../services/tenant.service';

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

function scopeFromPermissionValues(value: unknown): 'platform' | 'tenant' {
  const permissions = Array.isArray(value) ? value : [];
  return permissions.some((permission) => String(permission).startsWith('platform.'))
    ? 'platform'
    : 'tenant';
}

const ACCESS_PROFILE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'user/permissions/roles',
  createEndpoint: 'user/permissions/roles',
  updateEndpoint: 'user/permissions/roles',
  deleteEndpoint: 'user/permissions/roles',
  uuidField: 'uuid',
  pageTitle: 'Access profiles',
  pageDescription: 'Group permissions once and assign them to many users.',
  createTitle: 'New access profile',
  editTitle: 'Edit access profile',
  dialogDescription: 'Name the profile, choose permissions, then select who receives them.',
  searchPlaceholder: 'Profile name or description',
  emptyLabel: 'No access profiles found.',
  deleteTitle: 'Delete access profile',
  deleteMessage: 'Are you sure you want to delete this access profile?',
  deleteSelectedTitle: 'Delete selected access profiles',
  deleteSelectedMessage: 'Delete {count} selected access profiles?',
  savedMessage: 'Access profile saved successfully.',
  deletedMessage: 'Access profile deleted successfully.',
  deleteFailedMessage: 'Failed to delete access profile.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  serverSidePagination: true,
  canDeleteRow: (row) => Number(row['system'] ?? 0) !== 1,
  initialValues: {
    code: 'tenant.',
    name: '',
    description: '',
    scope: 'tenant',
    status: 1,
    permissions: [],
    users: [],
    environmentUUID: '',
  },
  tabLabels: {
    record: 'Record',
    authentication: 'Permissions',
    notes: 'Assigned users',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'permissionCount', label: 'Permissions', kind: 'number', field: 'permissionCount' },
    { id: 'assignmentCount', label: 'Users', kind: 'number', field: 'assignmentCount' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'name',
      source: 'name',
      payloadKey: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      span: 2,
      tab: 'record',
    },
    {
      key: 'status',
      source: 'status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'description',
      source: 'description',
      payloadKey: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Describe when this access profile should be used.',
      rows: 3,
      span: 4,
      tab: 'record',
    },
    {
      key: 'permissions',
      source: 'permissionCodes',
      payloadKey: 'permissions',
      label: 'Permissions',
      type: 'search-select',
      placeholder: 'Search permissions',
      multiple: true,
      span: 4,
      tab: 'authentication',
    },
    {
      key: 'environmentUUID',
      source: 'environmentUUID',
      payloadKey: 'environmentUUID',
      label: 'Tenant',
      type: 'search-select',
      required: true,
      span: 4,
      tab: 'notes',
      placeholder: 'Search tenant',
      hiddenWhen: ({ values }) => scopeFromPermissionValues(values['permissions']) === 'platform',
    },
    {
      key: 'users',
      source: 'users',
      payloadKey: 'users',
      label: 'Users',
      type: 'search-select',
      placeholder: 'Search users',
      multiple: true,
      span: 4,
      tab: 'notes',
    },
  ],
};

@Component({
  selector: 'app-user-access-profiles',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class UserAccessProfilesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
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
    super(ACCESS_PROFILE_CONFIG);
    void this.loadCatalog();
    void this.loadTenants();
    void this.loadUsers();
  }

  protected override listEndpoint(): string {
    return this.isMaster() ? 'user/permissions/platform/roles' : 'user/permissions/roles';
  }

  protected override createEndpoint(): string {
    return this.isMaster() ? 'user/permissions/platform/roles' : 'user/permissions/roles';
  }

  protected override updateEndpoint(): string {
    return this.isMaster() ? 'user/permissions/platform/roles' : 'user/permissions/roles';
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.isMaster() ? 'user/permissions/platform/roles' : 'user/permissions/roles';
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'permissions') return this.permissionOptionsForScope();
    if (key === 'users') return this.userOptions();
    if (key === 'environmentUUID') return this.tenantOptions();
    return [];
  }

  override fieldLoading(field: { key: string }): boolean {
    if (field.key === 'users') return this.loadingUsers();
    if (field.key === 'environmentUUID') return this.loadingTenants();
    return super.fieldLoading(field as never);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'name' && !this.editingRecord()) {
      this.setFieldValue('code', this.generatedProfileCode(String(value ?? '')));
    }

    if (key === 'permissions') {
      const scope = this.scopeFromPermissions(value);
      this.setFieldValue('scope', scope);
      this.setFieldValue('code', this.generatedProfileCode(this.fieldValueString('name'), scope));
      if (scope === 'platform') {
        this.setFieldValue('environmentUUID', '');
      }
    }

    if (key === 'environmentUUID') {
      const tenant = this.tenantRecords().find(
        (item) => item.EnvironmentUUID === String(value ?? ''),
      );
      if (tenant) this.selectTenantContext(tenant);
      void this.loadUsers();
    }
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      permissions: this.permissionsFromRow(row),
      users: [],
      environmentUUID: this.tenantService.selectedTenant()?.EnvironmentUUID ?? '',
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const scope = this.scopeFromPermissions(payload['permissions']);
    return {
      code: this.generatedProfileCode(String(payload['name'] ?? ''), scope),
      name: payload['name'],
      description: payload['description'],
      scope,
      status: payload['status'] ?? 1,
    };
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    const roleUUID = this.savedRoleUUID(context.response, context.record);
    if (!roleUUID) return;

    const permissions = this.fieldValueArray('permissions').map((permissionCode) => ({
      permissionCode: String(permissionCode),
      effect: 'allow',
    }));
    const roleBase = this.isMaster() ? 'user/permissions/platform/roles' : 'user/permissions/roles';
    await this.api.put(`${roleBase}/${roleUUID}/permissions`, { permissions });

    const users = this.fieldValueArray('users').map(String).filter(Boolean);
    if (!users.length) {
      this.refreshList();
      return;
    }

    const assignmentEndpoint = this.isMaster()
      ? 'user/permissions/platform/role-assignments'
      : 'user/permissions/role-assignments';
    const environmentUUID = String(this.formValues()['environmentUUID'] ?? '').trim() || null;
    await Promise.all(
      users.map((userUUID) =>
        this.api.post(assignmentEndpoint, {
          roleUUID,
          userUUID,
          environmentUUID,
        }),
      ),
    );
    this.refreshList();
  }

  private async loadCatalog(): Promise<void> {
    const response = await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
      'user/permissions/catalog',
    );
    const items = response?.data?.items ?? [];
    this.permissionOptions.set(
      items.map((item) => this.permissionOption(item)).filter((item) => item.value),
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

  private permissionOptionsForScope(): readonly ConfigurableCrudOption[] {
    return this.permissionOptions().filter(
      (option) => this.isMaster() || !String(option.value).startsWith('platform.'),
    );
  }

  private permissionsFromRow(row: ConfigurableCrudRecord): string[] {
    return String(row['permissionCodes'] ?? '')
      .split(',')
      .map((item) => item.split(':')[0]?.trim())
      .filter((item): item is string => Boolean(item));
  }

  private savedRoleUUID(response: unknown, record: ConfigurableCrudRecord | null): string {
    const row = response as { data?: Record<string, unknown> };
    return String(row?.data?.['uuid'] ?? record?.['uuid'] ?? '');
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

  private generatedProfileCode(
    name: string,
    scope = this.scopeFromPermissions(this.formValues()['permissions']),
  ): string {
    const prefix = scope === 'platform' ? 'platform.profile.' : 'tenant.profile.';
    const slug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
    return `${prefix}${slug || 'novo'}`;
  }

  private scopeFromPermissions(value: unknown): 'platform' | 'tenant' {
    return scopeFromPermissionValues(value);
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
