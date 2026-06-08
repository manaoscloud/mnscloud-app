import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy
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
import { fadeIn } from '../../shared/animations/fade.animation';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../shared/dialog/crud-dialog.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { SlowConfirmDialogComponent } from '../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TenantsService } from './tenants.service';

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

@Component({
  selector: 'settings-tenants',
  standalone: true,
  imports: [
    CommonModule,
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
  ],
  templateUrl: './tenants.html',
  styleUrl: './tenants.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class SettingsTenantsPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly service = inject(TenantsService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('inviteDialog') inviteDialog?: TemplateRef<unknown>;
  @ViewChild('myTenantsPaginator') myTenantsPaginator?: MatPaginator;
  @ViewChild('membersPaginator') membersPaginator?: MatPaginator;
  @ViewChild('invitesPaginator') invitesPaginator?: MatPaginator;
  @ViewChild('myTenantsSort') myTenantsSort?: MatSort;
  @ViewChild('membersSort') membersSort?: MatSort;
  @ViewChild('invitesSort') invitesSort?: MatSort;

  private inviteDialogBinding: CrudDialogBinding | null = null;
  private rawMyTenants: TenantAccess[] = [];
  private rawMembers: TenantAccess[] = [];
  private rawInvites: TenantInvite[] = [];

  readonly loading = signal(true);
  readonly invitesLoading = signal(true);
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

  ngOnInit() {
    this.configureTables();
    void this.load();
  }

  ngAfterViewInit() {
    this.myTenantsSource.paginator = this.myTenantsPaginator ?? null;
    this.membersSource.paginator = this.membersPaginator ?? null;
    this.invitesSource.paginator = this.invitesPaginator ?? null;
    this.myTenantsSource.sort = this.myTenantsSort ?? null;
    this.membersSource.sort = this.membersSort ?? null;
    this.invitesSource.sort = this.invitesSort ?? null;
  }

  ngOnDestroy() {
    this.closeInviteDialog();
  }

  refreshList() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.invitesLoading.set(true);
    this.error.set(null);
    this.invitesError.set(null);

    await Promise.all([this.loadAccessList(), this.loadInvites()]);

    this.loading.set(false);
    this.invitesLoading.set(false);
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
      await this.loadInvites();

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
      this.rawMembers = this.rawMembers.filter((item) => item.UscUUID !== uuid);
      this.applyDataSources();
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
      this.rawInvites = this.rawInvites.filter((item) => item.UsiUUID !== invite.UsiUUID);
      this.applyDataSources();
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

      this.applyDataSources();
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

  private async loadAccessList() {
    try {
      const response = await this.service.getMyAccessList();
      const myTenants = response?.data?.access ?? [];
      this.rawMyTenants = myTenants;

      const currentEnv =
        typeof localStorage !== 'undefined' ? localStorage.getItem('mc_current_env') : null;
      const currentRole =
        myTenants.find((item: TenantAccess) => item.EnvironmentUUID === currentEnv)?.Role ?? null;
      this.currentEnvRole.set(currentRole);

      if (currentEnv && ['OWNER', 'ADMIN'].includes(String(currentRole ?? '').toUpperCase())) {
        try {
          const envResponse = await this.service.getEnvironmentAccess();
          this.rawMembers = envResponse?.data?.members ?? [];
        } catch (error) {
          console.error('getEnvironmentAccess error:', error);
          this.rawMembers = myTenants;
        }
      } else {
        this.rawMembers = myTenants;
      }
    } catch (error) {
      console.error('getMyAccessList error:', error);
      this.error.set(this.errorMessage(error, 'Failed to load access list.'));
      this.rawMyTenants = [];
      this.rawMembers = [];
    } finally {
      this.applyDataSources();
    }
  }

  private async loadInvites() {
    try {
      const response = await this.service.listInvites();
      this.rawInvites = response?.data?.invites ?? [];
    } catch (error) {
      console.error('listInvites error:', error);
      const message = this.errorMessage(error, 'Failed to load invitations.');
      if (message.toLowerCase().includes('permission')) {
        this.rawInvites = [];
      } else {
        this.invitesError.set(message);
        this.rawInvites = [];
      }
    } finally {
      this.applyDataSources();
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
    this.myTenantsPaginator?.firstPage();
    this.membersPaginator?.firstPage();
    this.invitesPaginator?.firstPage();
  }

  private openInviteDialog() {
    if (!this.inviteDialog || this.inviteDialogBinding) return;
    this.inviteDialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.inviteDialog,
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
