import { Component, computed, inject, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudPageBase,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AuthService } from '../../../services/auth.service';

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const EFFECT_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

const PERMISSION_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'user/permissions/grants',
  createEndpoint: 'user/permissions/grants',
  deleteEndpoint: 'user/permissions/grants',
  uuidField: 'uuid',
  pageTitle: 'Permissions',
  pageDescription: 'Manage user access grants with RBAC/ABAC controls.',
  createTitle: 'New permission grant',
  editTitle: 'Edit permission grant',
  dialogDescription: 'Configure target user, permission, effect and scope.',
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
    authentication: 'Permission',
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
    { id: 'scope', label: 'Scope', field: 'scope' },
    { id: 'effect', label: 'Effect', field: 'effect' },
    { id: 'environmentName', label: 'Tenant', field: 'environmentName' },
    { id: 'expiresAt', label: 'Expires', kind: 'datetime', field: 'expiresAt' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  fields: [
    { key: 'userUUID', source: 'userUUID', payloadKey: 'userUUID', label: 'User UUID', required: true, span: 2 },
    {
      key: 'permissionCode',
      source: 'permissionCode',
      payloadKey: 'permissionCode',
      label: 'Permission',
      type: 'search-select',
      required: true,
      span: 2,
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
      span: 1,
      tab: 'authentication',
    },
    {
      key: 'environmentUUID',
      source: 'environmentUUID',
      payloadKey: 'environmentUUID',
      label: 'Tenant UUID',
      span: 3,
      tab: 'authentication',
      placeholder: 'Blank for current tenant or platform permissions',
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
  private readonly permissionOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly isMaster = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('platform.master.access')
  );

  constructor() {
    super(PERMISSION_CONFIG);
    void this.loadCatalog();
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
    return key === 'permissionCode' ? this.permissionOptions() : [];
  }

  private async loadCatalog(): Promise<void> {
    const response = await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
      'user/permissions/catalog',
    );
    const items = response?.data?.items ?? [];
    this.permissionOptions.set(
      items.map((item) => ({
        value: String(item['code'] ?? ''),
        label: `${item['name'] ?? item['code']} (${item['code']})`,
      })).filter((item) => item.value),
    );
  }
}
