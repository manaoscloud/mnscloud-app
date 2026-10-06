import { Component, computed, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { TenantsService } from './tenants.service';
import { AuthService } from '../../services/auth.service';

type TenantAccessEntry = ConfigurableCrudRecord & {
  EntryUUID: string;
  UserUUID?: string;
  EntryType: 'MEMBER' | 'INVITE';
  Name: string;
  Email: string;
  RoleCode: string;
  RoleName: string;
  Protected: number;
  Status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ACCEPTED' | 'CANCELED';
  DateCreated: string | null;
};

const DEFAULT_ROLE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'tenant.admin', label: 'Administrator' },
  { value: 'tenant.user', label: 'User' },
];

const TENANT_ACCESS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'user/access/members',
  createEndpoint: 'user/access/invites',
  updateEndpoint: 'user/access/members',
  deleteEndpoint: (row) => (row['EntryType'] === 'INVITE' ? 'user/access/invites' : 'user/access'),
  uuidField: 'EntryUUID',
  pageTitle: 'Tenants',
  pageDescription: 'Manage tenant members and invitations for this environment.',
  createTitle: 'Invite a Member',
  editTitle: 'Edit tenant access',
  dialogDescription: 'Send a tenant access invitation by email.',
  searchPlaceholder: 'Tenant member or email',
  emptyLabel: 'No tenant members or invitations found.',
  deleteTitle: 'Remove tenant access',
  deleteMessage: 'Are you sure you want to remove this tenant access or cancel its invitation?',
  deleteSelectedTitle: 'Remove selected tenant access entries',
  deleteSelectedMessage: 'Remove {count} selected tenant access entries?',
  savedMessage: 'Tenant invitation sent successfully.',
  deletedMessage: 'Tenant access removed successfully.',
  deleteFailedMessage: 'Failed to remove tenant access.',
  statusMode: 'string',
  activeValue: 'ACTIVE',
  inactiveValue: 'INACTIVE',
  activeStatusValues: ['ACTIVE'],
  statusOptions: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'ACCEPTED', label: 'Accepted' },
    { value: 'CANCELED', label: 'Canceled' },
  ],
  initialValues: { email: '', roleCode: 'tenant.user' },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'EntryUUID' },
    { id: 'email', label: 'E-mail', field: 'Email', className: 'email-col' },
    { id: 'role', label: 'Profile', field: 'RoleName', lookupKey: 'roleCode' },
    { id: 'createdAt', label: 'Created at', kind: 'datetime', field: 'DateCreated' },
    { id: 'status', label: 'Status', kind: 'status', field: 'Status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'email',
      source: 'Email',
      payloadKey: 'email',
      label: 'E-mail',
      type: 'email',
      required: true,
      span: 3,
      autocomplete: 'email',
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'roleCode',
      source: 'RoleCode',
      payloadKey: 'roleCode',
      label: 'Profile',
      type: 'search-select',
      quickCreate: false,
      quickCreateExemptReason: 'Access profiles are managed under User / Access Profiles.',
      options: DEFAULT_ROLE_OPTIONS,
      required: true,
      span: 1,
      placeholder: 'Search profile',
    },
  ],
  canEdit: true,
  canEditRow: (row) =>
    String(row['EntryType'] ?? '').toUpperCase() === 'MEMBER' &&
    Number(row['Protected'] ?? 0) !== 1,
  canDeleteRow: (row) => {
    const entryType = String(row['EntryType'] ?? '').toUpperCase();
    if (entryType === 'INVITE') return String(row['Status'] ?? '').toUpperCase() === 'PENDING';
    return Number(row['Protected'] ?? 0) !== 1;
  },
  bulkDelete: false,
  rowActions: [{ key: 'resend', label: 'Resend invitation', icon: 'send' }],
};

@Component({
  selector: 'settings-tenants',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SettingsTenantsPage extends ConfigurableCrudPageBase<TenantAccessEntry> {
  private readonly tenantsService = inject(TenantsService);
  private readonly auth = inject(AuthService);
  private readonly roleOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly loadingRoles = signal(false);

  private readonly canManageTenant = computed(() => {
    const permissions = this.auth.user()?.permissions ?? [];
    return permissions.some((permission) => {
      const normalized = String(permission ?? '').toLowerCase();
      return (
        normalized === 'tenant.access.manage' ||
        normalized === 'tenant.permissions.manage' ||
        normalized === 'tenant.*' ||
        normalized === 'platform.master.access'
      );
    });
  });

  override readonly canCreate = computed(() => this.canManageTenant());
  override readonly canEdit = computed(() => this.canManageTenant());
  override readonly canDelete = computed(() => this.canManageTenant());

  constructor() {
    super(TENANT_ACCESS_CONFIG);
    void this.loadRoles();
  }

  override rowActions(row: TenantAccessEntry) {
    return row.EntryType === 'INVITE' && row.Status === 'PENDING'
      ? (TENANT_ACCESS_CONFIG.rowActions ?? [])
      : [];
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'roleCode') return this.roleOptions();
    return [];
  }

  override fieldLoading(field: { key: string }): boolean {
    if (field.key === 'roleCode') return this.loadingRoles();
    return super.fieldLoading(field as never);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: TenantAccessEntry,
  ): Promise<void> {
    if (action.key !== 'resend' || row.EntryType !== 'INVITE' || row.Status !== 'PENDING') return;

    try {
      await this.tenantsService.resendInvite(row.EntryUUID);
      this.snack.success(this.t('Tenant invitation resent successfully.'));
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  protected override formValuesFromRecord(row: TenantAccessEntry): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      email: row.Email,
      roleCode: row.RoleCode,
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    if (this.editingRecord()) {
      return {
        roleCode: payload['roleCode'],
      };
    }
    return {
      email: payload['email'],
      roleCode: payload['roleCode'],
    };
  }

  private async loadRoles(): Promise<void> {
    this.loadingRoles.set(true);
    try {
      const response = await this.api.get<{ data?: { items?: Array<Record<string, unknown>> } }>(
        'user/permissions/roles',
      );
      const items = response?.data?.items ?? [];
      const options = items
        .filter((r) => String(r['code'] ?? '') !== 'tenant.owner' && Number(r['status'] ?? 1) === 1)
        .map((r) => ({
          value: String(r['code'] ?? ''),
          label: String(r['name'] ?? r['code'] ?? ''),
          description: String(r['notes'] ?? r['code'] ?? ''),
          searchText: `${r['name']} ${r['code']}`,
        }));
      this.roleOptions.set(options.length ? options : [...DEFAULT_ROLE_OPTIONS]);
    } catch {
      this.roleOptions.set([...DEFAULT_ROLE_OPTIONS]);
    } finally {
      this.loadingRoles.set(false);
    }
  }

  protected override async fetchItems(
    filters: ConfigurableCrudFilters,
  ): Promise<TenantAccessEntry[]> {
    const [membersResponse, invitesResponse] = await Promise.all([
      this.tenantsService.getEnvironmentAccess(),
      this.tenantsService.listInvites(),
    ]);

    const members = (membersResponse?.data?.members ?? []).map((member: any) => ({
      EntryUUID: String(member.UscUUID ?? ''),
      UserUUID: String(member.UserUUID ?? ''),
      EntryType: 'MEMBER' as const,
      Name: String(member.Name ?? member.Email ?? '-'),
      Email: String(member.Email ?? ''),
      RoleCode: String(member.RoleCode ?? ''),
      RoleName: String(member.RoleName ?? member.RoleCode ?? '-'),
      Protected: Number(member.Protected ?? 0),
      Status: Number(member.Status ?? 0) === 1 ? ('ACTIVE' as const) : ('INACTIVE' as const),
      DateCreated: member.DateCreated ?? null,
    }));
    const invites = (invitesResponse?.data?.invites ?? []).map((invite: any) => {
      const inviteStatus = Number(invite.UsiStatus ?? 0);
      return {
        EntryUUID: String(invite.UsiUUID ?? ''),
        EntryType: 'INVITE' as const,
        Name: String(invite.UsiEmail ?? '-'),
        Email: String(invite.UsiEmail ?? ''),
        RoleCode: String(invite.RoleCode ?? ''),
        RoleName: String(invite.RoleName ?? invite.RoleCode ?? '-'),
        Protected: 0,
        Status:
          inviteStatus === 0
            ? ('PENDING' as const)
            : inviteStatus === 1
              ? ('ACCEPTED' as const)
              : ('CANCELED' as const),
        DateCreated: invite.UsiDateCreated ?? null,
      };
    });

    const search = filters.search.trim().toLocaleLowerCase();
    return [...members, ...invites].filter((entry) => {
      const matchesStatus = !filters.status || entry.Status === filters.status;
      const haystack =
        `${entry.Name} ${entry.Email} ${entry.RoleCode} ${entry.RoleName} ${entry.Status}`.toLowerCase();
      return matchesStatus && (!search || haystack.includes(search));
    });
  }
}
