import { Component, computed, inject, signal } from '@angular/core';

/** Access profiles CRUD — uses shared ConfigurableCrudPageBase (app.md ERP generic CRUD). */
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudPageBase,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AuthService } from '../../../services/auth.service';

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
  searchPlaceholder: 'Profile name or notes',
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
  canEditRow: (row) => Number(row['system'] ?? 0) !== 1,
  canDeleteRow: (row) => Number(row['system'] ?? 0) !== 1,
  initialValues: {
    code: 'tenant.',
    name: '',
    notes: '',
    scope: 'tenant',
    status: 1,
    permissions: [],
  },
  tabLabels: {
    record: 'Record',
    authentication: 'Permissions',
    notes: 'Notes',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'permissionCount', label: 'Permissions', kind: 'number', field: 'permissionCount' },
    { id: 'assignmentCount', label: 'Users', kind: 'number', field: 'assignmentCount' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  fields: [
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
      key: 'name',
      source: 'name',
      payloadKey: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'notes',
      source: 'notes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Optional notes about this access profile.',
      rows: 4,
      span: 4,
      tab: 'notes',
    },
    {
      key: 'permissions',
      source: 'permissionCodes',
      payloadKey: 'permissions',
      label: 'Permissions',
      type: 'permission-tree',
      placeholder: 'Search permissions',
      multiple: true,
      rows: 6,
      span: 4,
      tab: 'authentication',
    },
  ],
  rowActions: [
    {
      key: 'clone',
      label: 'Duplicate',
      icon: 'content_copy',
      tooltip: 'Duplicate',
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
  private readonly permissionOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly loadingPermissions = signal(false);
  private readonly isMaster = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('platform.master.access'),
  );

  constructor() {
    super(ACCESS_PROFILE_CONFIG);
    void this.loadCatalog();
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
    return [];
  }

  override fieldLoading(field: { key: string }): boolean {
    if (field.key === 'permissions') return this.loadingPermissions();
    return super.fieldLoading(field as never);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'clone') {
      this.startCreate();
      this.setFieldValue('name', `${String(row['name'] ?? '')} (Copy)`);
      this.setFieldValue('notes', String(row['notes'] ?? ''));
      this.setFieldValue('permissions', this.permissionsFromRow(row));
      this.setFieldValue('status', 1);
      return;
    }
    await super.handleRowAction(action, row);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'name' && !this.editingRecord()) {
      this.setFieldValue('code', this.generatedProfileCode(String(value ?? '')));
    }

    if (key === 'permissions') {
      const scope = this.scopeFromPermissions(value);
      this.setFieldValue('scope', scope);
      this.setFieldValue('code', this.generatedProfileCode(this.fieldValueString('name'), scope));
    }
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      permissions: this.permissionsFromRow(row),
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const scope = this.scopeFromPermissions(payload['permissions']);
    return {
      code: this.generatedProfileCode(String(payload['name'] ?? ''), scope),
      name: payload['name'],
      notes: payload['notes'],
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
    this.refreshList();
  }

  private async loadCatalog(): Promise<void> {
    this.loadingPermissions.set(true);
    try {
      const response = await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
        'user/permissions/catalog',
      );
      const items = response?.data?.items ?? [];
      this.permissionOptions.set(
        items.map((item) => this.permissionOption(item)).filter((item) => item.value),
      );
    } catch (error) {
      this.permissionOptions.set([]);
      this.snack.error(this.errorMessage(error) || 'Failed to load permissions.');
    } finally {
      this.loadingPermissions.set(false);
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
