import { Component, computed, inject } from '@angular/core';

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
import { TenantService } from '../../services/tenant.service';

type TenantAccessEntry = ConfigurableCrudRecord & {
  EntryUUID: string;
  EntryType: 'MEMBER' | 'INVITE';
  Name: string;
  Email: string;
  Role: 'ADMIN' | 'USER';
  Status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ACCEPTED' | 'CANCELED';
  DateCreated: string | null;
};

const ROLE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'USER', label: 'User' },
];

const TENANT_ACCESS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'user/access/members',
  createEndpoint: 'user/access/invites',
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
  initialValues: { email: '', role: 'USER' },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'EntryUUID' },
    { id: 'email', label: 'E-mail', field: 'Email', className: 'email-col' },
    { id: 'role', label: 'Access level', field: 'Role', lookupKey: 'role' },
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
    },
    {
      key: 'role',
      source: 'Role',
      payloadKey: 'role',
      label: 'Access level',
      type: 'select',
      options: ROLE_OPTIONS,
      required: true,
      span: 1,
    },
  ],
  canEdit: false,
  // Revocation and invitation cancellation use distinct, stateful API endpoints.
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
  private readonly tenantService = inject(TenantService);
  private readonly canManageTenant = computed(() => {
    const environmentRole = String(this.tenantService.selectedTenant()?.Role ?? '').toUpperCase();
    const accountRole = String(this.auth.user()?.role ?? '').toUpperCase();
    return (
      ['MASTER', 'OWNER', 'ADMIN'].includes(environmentRole) ||
      ['MASTER', 'OWNER', 'ADMIN'].includes(accountRole)
    );
  });

  override readonly canCreate = computed(() => this.canManageTenant());
  override readonly canDelete = computed(() => this.canManageTenant());

  constructor() {
    super(TENANT_ACCESS_CONFIG);
  }

  override rowActions(row: TenantAccessEntry) {
    return row.EntryType === 'INVITE' && row.Status === 'PENDING'
      ? (TENANT_ACCESS_CONFIG.rowActions ?? [])
      : [];
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

  protected override async fetchItems(
    filters: ConfigurableCrudFilters,
  ): Promise<TenantAccessEntry[]> {
    const [membersResponse, invitesResponse] = await Promise.all([
      this.tenantsService.getEnvironmentAccess(),
      this.tenantsService.listInvites(),
    ]);

    const members = (membersResponse?.data?.members ?? []).map((member: any) => ({
      EntryUUID: String(member.UscUUID ?? ''),
      EntryType: 'MEMBER' as const,
      Name: String(member.Name ?? member.Email ?? '-'),
      Email: String(member.Email ?? ''),
      Role: String(member.Role ?? 'USER').toUpperCase() as 'ADMIN' | 'USER',
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
        Role: String(invite.UsiRole ?? 'USER').toUpperCase() as 'ADMIN' | 'USER',
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
      const haystack = `${entry.Name} ${entry.Email} ${entry.Role} ${entry.Status}`.toLowerCase();
      return matchesStatus && (!search || haystack.includes(search));
    });
  }
}
