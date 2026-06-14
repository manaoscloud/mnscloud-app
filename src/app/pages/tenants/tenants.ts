import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { SnackbarService } from '../../services/snackbar.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../shared/dialog/crud-dialog.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { SlowConfirmDialogComponent } from '../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TenantsService } from './tenants.service';
import { RefreshButtonComponent } from '../../shared/refresh-button/refresh-button';

type TenantAccess = {
  UscUUID?: string | null;
  EnvironmentUUID?: string | null;
  EnvironmentName?: string | null;
  Role?: string | null;
  Status?: number | null;
  IsDefault?: number | null;
  UscIsDefault?: number | null;
};

type TenantInvite = {
  UsiUUID: string;
  UsiEmail?: string | null;
  UsiRole?: string | null;
  UsiStatus?: number | null;
  UsiDateCreated?: string | null;
  UsiDateAccepted?: string | null;
};

type TenantsSnapshot = {
  myTenants: TenantAccess[];
  members: TenantAccess[];
  invites: TenantInvite[];
  currentEnvRole: string | null;
  error: string | null;
  invitesError: string | null;
};

@Component({
  selector: 'settings-tenants',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    TranslocoPipe,
    DatePipe,
  ],
  templateUrl: './tenants.html',
  styleUrl: './tenants.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsTenantsPage {
  private readonly service = inject(TenantsService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly inviteDialog = viewChild<TemplateRef<unknown>>('inviteDialog');
  readonly myTenantsPaginator = viewChild<MatPaginator>('myTenantsPaginator');
  readonly membersPaginator = viewChild<MatPaginator>('membersPaginator');
  readonly invitesPaginator = viewChild<MatPaginator>('invitesPaginator');
  readonly myTenantsSort = viewChild<MatSort>('myTenantsSort');
  readonly membersSort = viewChild<MatSort>('membersSort');
  readonly invitesSort = viewChild<MatSort>('invitesSort');

  private inviteDialogBinding: CrudDialogBinding | null = null;
  private rawMyTenants: TenantAccess[] = [];
  private rawMembers: TenantAccess[] = [];
  private rawInvites: TenantInvite[] = [];

  private readonly tenantsResource = resource({
    defaultValue: {
      myTenants: [],
      members: [],
      invites: [],
      currentEnvRole: null,
      error: null,
      invitesError: null,
    } as TenantsSnapshot,
    loader: () => this.fetchTenantsSnapshot(),
  });

  readonly loading = computed(() => this.tenantsResource.isLoading());
  readonly invitesLoading = computed(() => this.tenantsResource.isLoading());
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly invitesError = signal<string | null>(null);
  readonly currentEnvRole = signal<string | null>(null);

  readonly canManageTenant = computed(() =>
    ['OWNER', 'ADMIN'].includes(String(this.currentEnvRole() ?? '').toUpperCase()),
  );

  readonly roles = ['ADMIN', 'USER'];
  readonly statusOptions = ['', 'active', 'inactive', 'pending', 'accepted', 'canceled'];
  readonly myTenantColumns = ['tenant', 'role', 'default', 'actions'];
  readonly memberColumns = ['tenant', 'role', 'status', 'actions'];
  readonly inviteColumns = ['email', 'role', 'status', 'createdAt', 'acceptedAt', 'actions'];

  readonly myTenantsSource = new MatTableDataSource<TenantAccess>([]);
  readonly membersSource = new MatTableDataSource<TenantAccess>([]);
  readonly invitesSource = new MatTableDataSource<TenantInvite>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
  });

  readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['USER', [Validators.required]],
  });

  private readonly setupTables = afterNextRender(() => {
    this.myTenantsSource.paginator = this.myTenantsPaginator() ?? null;
    this.membersSource.paginator = this.membersPaginator() ?? null;
    this.invitesSource.paginator = this.invitesPaginator() ?? null;
    this.myTenantsSource.sort = this.myTenantsSort() ?? null;
    this.membersSource.sort = this.membersSort() ?? null;
    this.invitesSource.sort = this.invitesSort() ?? null;
  });

  constructor() {
    this.configureTables();
    this.destroyRef.onDestroy(() => this.closeInviteDialog());
    effect(() => {
      const snapshot = this.tenantsResource.value();
      if (!snapshot) return;
      this.rawMyTenants = snapshot.myTenants;
      this.rawMembers = snapshot.members;
      this.rawInvites = snapshot.invites;
      this.currentEnvRole.set(snapshot.currentEnvRole);
      this.error.set(snapshot.error);
      this.invitesError.set(snapshot.invitesError);
      this.applyDataSources();
    });
  }

  refreshList() {
    this.error.set(null);
    this.invitesError.set(null);
    this.tenantsResource.reload();
  }

  applyFilters() {
    this.applyDataSources();
    this.firstPage();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', status: '' });
    this.applyFilters();
  }

  startCreate() {
    if (!this.canManageTenant()) {
      this.snack.warning('Only tenant owners and administrators can invite members.');
      return;
    }
    this.inviteForm.reset({ email: '', role: 'USER' });
    this.openInviteDialog();
  }

  closeInviteDialog() {
    if (!this.inviteDialogBinding) return;
    this.inviteDialogBinding.ref.close();
    this.inviteDialogBinding.stop();
    this.inviteDialogBinding = null;
  }

  async sendInvite(keepOpen = false) {
    if (this.inviteForm.invalid || this.saving()) return;

    this.saving.set(true);
    const { email, role } = this.inviteForm.getRawValue();

    try {
      await this.service.inviteUser({ email: email.trim().toLowerCase(), role });
      this.snack.success('Invitation sent successfully.');
      this.tenantsResource.reload();

      if (keepOpen) {
        this.inviteForm.reset({ email: '', role: 'USER' });
      } else {
        this.closeInviteDialog();
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to send invitation.'));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(access: TenantAccess) {
    const uuid = access.UscUUID;
    if (!uuid) return;

    const confirmed = await this.confirm({
      title: 'Remove member access',
      message: `Remove access for ${access.EnvironmentName || 'this tenant member'}?`,
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;

    try {
      await this.service.deleteAccess(uuid);
      this.tenantsResource.reload();
      this.snack.success('Tenant member removed successfully.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to remove access.'));
    }
  }

  async cancelInvite(invite: TenantInvite) {
    const confirmed = await this.confirm({
      title: 'Cancel invitation',
      message: `Cancel invitation for ${invite.UsiEmail || 'this email'}?`,
      confirmLabel: 'Cancel invitation',
    });
    if (!confirmed) return;

    try {
      await this.service.cancelInvite(invite.UsiUUID);
      this.tenantsResource.reload();
      this.snack.success('Invitation canceled successfully.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to cancel invitation.'));
    }
  }

  async resendInvite(invite: TenantInvite) {
    try {
      await this.service.resendInvite(invite.UsiUUID);
      this.snack.success('Invitation resent successfully.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to resend invitation.'));
    }
  }

  isDefaultAccess(item: TenantAccess): boolean {
    return Number(item?.IsDefault ?? item?.UscIsDefault ?? 0) === 1;
  }

  async setDefaultAccess(item: TenantAccess) {
    const environmentUUID = item.EnvironmentUUID;
    if (!environmentUUID || this.isDefaultAccess(item)) return;

    try {
      await this.service.setDefaultAccess(environmentUUID);
      this.rawMyTenants = this.rawMyTenants.map((tenant) => ({
        ...tenant,
        IsDefault: tenant.EnvironmentUUID === environmentUUID ? 1 : 0,
      }));

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mc_current_env', environmentUUID);
      }

      this.tenantsResource.reload();
      this.snack.success('Default tenant updated successfully.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to set default tenant.'));
    }
  }

  memberStatusLabel(item: TenantAccess) {
    return Number(item.Status ?? 0) === 1 ? 'Active' : 'Inactive';
  }

  inviteStatusLabel(invite: TenantInvite) {
    const status = Number(invite.UsiStatus ?? 0);
    if (status === 1) return 'Accepted';
    if (status === 2) return 'Canceled';
    return 'Pending';
  }

  private async fetchTenantsSnapshot(): Promise<TenantsSnapshot> {
    const [accessSnapshot, invitesSnapshot] = await Promise.all([
      this.fetchAccessSnapshot(),
      this.fetchInvitesSnapshot(),
    ]);

    return {
      myTenants: accessSnapshot.myTenants,
      members: accessSnapshot.members,
      invites: invitesSnapshot.invites,
      currentEnvRole: accessSnapshot.currentEnvRole,
      error: accessSnapshot.error,
      invitesError: invitesSnapshot.invitesError,
    };
  }

  private async fetchAccessSnapshot(): Promise<{
    myTenants: TenantAccess[];
    members: TenantAccess[];
    currentEnvRole: string | null;
    error: string | null;
  }> {
    try {
      const response = await this.service.getMyAccessList();
      const myTenants = response?.data?.access ?? [];

      const currentEnv =
        typeof localStorage !== 'undefined' ? localStorage.getItem('mc_current_env') : null;
      const currentRole =
        myTenants.find((item: TenantAccess) => item.EnvironmentUUID === currentEnv)?.Role ?? null;

      if (currentEnv && ['OWNER', 'ADMIN'].includes(String(currentRole ?? '').toUpperCase())) {
        try {
          const envResponse = await this.service.getEnvironmentAccess();
          return {
            myTenants,
            members: envResponse?.data?.members ?? [],
            currentEnvRole: currentRole,
            error: null,
          };
        } catch (error) {
          return {
            myTenants,
            members: myTenants,
            currentEnvRole: currentRole,
            error: this.errorMessage(error, 'Failed to load access list.'),
          };
        }
      }

      return {
        myTenants,
        members: myTenants,
        currentEnvRole: currentRole,
        error: null,
      };
    } catch (error) {
      return {
        myTenants: [],
        members: [],
        currentEnvRole: null,
        error: this.errorMessage(error, 'Failed to load access list.'),
      };
    }
  }

  private async fetchInvitesSnapshot(): Promise<{
    invites: TenantInvite[];
    invitesError: string | null;
  }> {
    try {
      const response = await this.service.listInvites();
      return { invites: response?.data?.invites ?? [], invitesError: null };
    } catch (error) {
      const message = this.errorMessage(error, 'Failed to load invitations.');
      if (message.toLowerCase().includes('permission')) {
        return { invites: [], invitesError: null };
      }
      return { invites: [], invitesError: message };
    }
  }

  private configureTables() {
    this.myTenantsSource.sortingDataAccessor = (row, column) => this.accessSortValue(row, column);
    this.membersSource.sortingDataAccessor = (row, column) => this.accessSortValue(row, column);
    this.invitesSource.sortingDataAccessor = (row, column) => this.inviteSortValue(row, column);
  }

  private applyDataSources() {
    const search = this.filterForm.controls.search.value.trim().toLowerCase();
    const status = this.filterForm.controls.status.value;

    this.myTenantsSource.data = this.rawMyTenants.filter((item) =>
      this.matchesAccessFilter(item, search, status),
    );
    this.membersSource.data = this.rawMembers.filter((item) =>
      this.matchesAccessFilter(item, search, status),
    );
    this.invitesSource.data = this.rawInvites.filter((item) =>
      this.matchesInviteFilter(item, search, status),
    );
  }

  private matchesAccessFilter(item: TenantAccess, search: string, status: string) {
    const haystack =
      `${item.EnvironmentName ?? ''} ${item.Role ?? ''} ${this.memberStatusLabel(item)}`
        .toLowerCase()
        .trim();
    const matchesSearch = !search || haystack.includes(search);
    const normalizedStatus = this.memberStatusLabel(item).toLowerCase();
    const matchesStatus =
      !status ||
      (status === 'active' && normalizedStatus === 'active') ||
      (status === 'inactive' && normalizedStatus === 'inactive');
    return matchesSearch && matchesStatus;
  }

  private matchesInviteFilter(item: TenantInvite, search: string, status: string) {
    const label = this.inviteStatusLabel(item);
    const haystack = `${item.UsiEmail ?? ''} ${item.UsiRole ?? ''} ${label}`.toLowerCase().trim();
    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = !status || label.toLowerCase() === status;
    return matchesSearch && matchesStatus;
  }

  private accessSortValue(row: TenantAccess, column: string) {
    if (column === 'tenant') return row.EnvironmentName ?? '';
    if (column === 'role') return row.Role ?? '';
    if (column === 'default') return this.isDefaultAccess(row) ? 1 : 0;
    if (column === 'status') return this.memberStatusLabel(row);
    return '';
  }

  private inviteSortValue(row: TenantInvite, column: string) {
    if (column === 'email') return row.UsiEmail ?? '';
    if (column === 'role') return row.UsiRole ?? '';
    if (column === 'status') return this.inviteStatusLabel(row);
    if (column === 'createdAt') return row.UsiDateCreated ?? '';
    if (column === 'acceptedAt') return row.UsiDateAccepted ?? '';
    return '';
  }

  private firstPage() {
    this.myTenantsPaginator()?.firstPage();
    this.membersPaginator()?.firstPage();
    this.invitesPaginator()?.firstPage();
  }

  private openInviteDialog() {
    const inviteDialog = this.inviteDialog();
    if (!inviteDialog || this.inviteDialogBinding) return;
    this.inviteDialogBinding = openCrudTemplateDialog(
      this.dialog,
      inviteDialog,
      'crud-dialog-panel tenant-invite-dialog-panel',
      { onEscape: () => this.closeInviteDialog() },
    );
    this.inviteDialogBinding.ref.afterClosed().subscribe(() => {
      this.inviteDialogBinding?.stop();
      this.inviteDialogBinding = null;
    });
  }

  private async confirm(data: { title: string; message: string; confirmLabel: string }) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '420px',
      disableClose: true,
      panelClass: 'slow-confirm-dialog',
      data,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private errorMessage(error: any, fallback: string) {
    return error?.error?.message ?? error?.error?.error ?? error?.message ?? fallback;
  }
}
