import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type SupportTeam = {
  SupportTeamUUID: string;
  SupportTeamID: string;
  Name: string;
  Code?: string | null;
  Description?: string | null;
  Status: number;
  IsDefault?: number | null;
  QueuePriority?: number | null;
  MaxConcurrentTickets?: number | null;
  MembersCount?: number | null;
  DateCreated?: string | null;
  DateUpdated?: string | null;
};

type SupportTeamMember = {
  SupportTeamMemberUUID: string;
  SupportTeamUUID: string;
  MemberUserUUID: string;
  Role: string;
  IsPrimary?: number | null;
  CanAssign?: number | null;
  CanClose?: number | null;
  Status: number;
  MemberName?: string | null;
  MemberEmail?: string | null;
  DateCreated?: string | null;
  DateUpdated?: string | null;
};

type Option = { value: string | number; label: string };

type UserOption = { value: string; label: string; email?: string | null };

@Component({
  selector: 'app-support-teams',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './teams.html',
  styleUrls: ['./teams.scss'],
})
export class SupportTeamsPage {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  teams: SupportTeam[] = [];
  dataSource = new MatTableDataSource<SupportTeam>([]);
  displayedColumns: string[] = ['name', 'code', 'status', 'members', 'default', 'actions'];
  search = '';
  searchInput = '';
  error = '';
  private readonly saving = signal(false);
  private readonly teamsResource = resource({
    defaultValue: [] as SupportTeam[],
    loader: () => this.fetchTeams(),
  });
  readonly loading = computed(() => this.teamsResource.isLoading() || this.saving());
  private readonly teamsEffect = effect(() => {
    this.teams = this.teamsResource.value();
    this.dataSource.data = [...this.teams];
    this.applySearchFilters();
  });
  private readonly teamsErrorEffect = effect(() => {
    const error = this.teamsResource.error();
    if (!error) return;
    this.error = error instanceof Error ? error.message : 'Failed to load teams.';
    this.teams = [];
    this.dataSource.data = [];
  });

  editing: SupportTeam | null = null;

  members: SupportTeamMember[] = [];
  memberEditing: SupportTeamMember | null = null;
  loadingMembers = false;
  memberError = '';

  users: UserOption[] = [];
  userMap = new Map<string, UserOption>();
  userSearch = '';

  statusOptions: Option[] = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  roleOptions: Option[] = [
    { value: 'member', label: 'Member' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'manager', label: 'Manager' },
  ];

  form = {
    name: '',
    code: '',
    description: '',
    status: 1,
    isDefault: false,
    queuePriority: '',
    maxConcurrentTickets: '',
  };

  memberForm = {
    memberUserUUID: '',
    role: 'member',
    isPrimary: false,
    canAssign: false,
    canClose: false,
    status: 1,
  };

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly teamFormDialog = viewChild<TemplateRef<unknown>>('teamFormDialog');
  private teamFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  private readonly initializePage = (() => {
    this.resetTeamForm();
    void this.fetchUsers();

    return true;
  })();

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'code':
          return data.Code ?? '';
        case 'status':
          return data.Status ?? 0;
        case 'members':
          return data.MembersCount ?? 0;
        case 'default':
          return data.IsDefault ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.Code, data.Description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.stopDialogViewportObserver();
    this.teamFormDialogRef?.close();
  });

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.dataSource.filter = this.search.toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.dataSource.filter = '';
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  refreshList() {
    this.teamsResource.reload();
  }

  statusLabel(status: number) {
    return status === 1 ? 'Active' : 'Inactive';
  }

  userLabel(userUUID: string) {
    return this.userMap.get(userUUID)?.label ?? userUUID;
  }

  get filteredUsers() {
    const value = this.userSearch.trim().toLowerCase();
    if (!value) return this.users;
    return this.users.filter((user) => (user.label ?? '').toLowerCase().includes(value));
  }

  onUserOpened(opened: boolean) {
    if (opened) {
      this.userSearch = '';
    }
  }

  private async fetchTeams(): Promise<SupportTeam[]> {
    this.error = '';
    const res = await this.api.get<any>('support/teams');
    return res?.data?.items ?? [];
  }

  async fetchUsers() {
    try {
      const res = await this.api.get<any>('user/access/members');
      const access = res?.data?.members ?? [];
      const mapped: UserOption[] = access.map((item: any) => {
        const name = item.Name ?? item.FullName ?? item.Email ?? item.UserUUID ?? '';
        const email = item.Email ?? null;
        return {
          value: item.UserUUID ?? item.userUUID,
          label: email ? `${name} (${email})` : name,
          email,
        };
      });
      this.users = mapped;
      this.userMap = new Map(mapped.map((u) => [u.value, u]));
    } catch (err) {
      console.error('Failed to load users.', err);
    }
  }

  async fetchMembers(teamUUID: string) {
    this.loadingMembers = true;
    this.memberError = '';
    try {
      const res = await this.api.get<any>(`support/teams/${teamUUID}/members`);
      this.members = res?.data?.items ?? [];
    } catch (err: any) {
      this.memberError = this.resolveApiError(err, 'Failed to load team members.');
      this.members = [];
    } finally {
      this.loadingMembers = false;
    }
  }

  private resetTeamForm() {
    this.editing = null;
    this.form.name = '';
    this.form.code = '';
    this.form.description = '';
    this.form.status = 1;
    this.form.isDefault = false;
    this.form.queuePriority = '';
    this.form.maxConcurrentTickets = '';
    this.startCreateMember();
    this.members = [];
  }

  private openFormDialog() {
    const teamFormDialog = this.teamFormDialog();
    if (!teamFormDialog) return;
    if (this.teamFormDialogRef) return;
    this.teamFormDialogRef = this.dialog.open(teamFormDialog, {
      ...this.getDialogViewportConfig(),
      panelClass: 'support-team-form-dialog',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
    });
    this.teamFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.teamFormDialogRef.afterClosed()))
      .subscribe((event) => {
        if (event.key === 'Escape') this.teamFormDialogRef?.close();
      });
    this.startDialogViewportObserver();
    this.teamFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.teamFormDialogRef = null;
    });
  }

  closeFormDialog() {
    this.stopDialogViewportObserver();
    this.teamFormDialogRef?.close();
    this.teamFormDialogRef = null;
  }

  private getDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: '100vw',
        maxWidth: '100vw',
        maxHeight: '100dvh',
      };
    }

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) {
      return {
        width: 'min(1280px, calc(100vw - 1.5rem))',
        maxWidth: '99vw',
        maxHeight: '95vh',
      };
    }

    const rect = pageContent.getBoundingClientRect();
    const spacing = 8;
    const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
    const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));
    const leftPx = Math.max(0, Math.floor(rect.left + spacing));
    const topPx = Math.max(0, Math.floor(rect.top + spacing));

    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${leftPx}px`,
        top: `${topPx}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.teamFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateDialogViewport() {
    if (!this.teamFormDialogRef) return;
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.teamFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.teamFormDialogRef.updatePosition(config.position);
    } else {
      this.teamFormDialogRef.updatePosition();
    }
  }

  startCreate() {
    this.resetTeamForm();
    this.openFormDialog();
  }

  startEdit(item: SupportTeam) {
    this.editing = item;
    this.form.name = item.Name ?? '';
    this.form.code = item.Code ?? '';
    this.form.description = item.Description ?? '';
    this.form.status = item.Status ?? 1;
    this.form.isDefault = Number(item.IsDefault ?? 0) === 1;
    this.form.queuePriority =
      item.QueuePriority !== null && item.QueuePriority !== undefined
        ? String(item.QueuePriority)
        : '';
    this.form.maxConcurrentTickets =
      item.MaxConcurrentTickets !== null && item.MaxConcurrentTickets !== undefined
        ? String(item.MaxConcurrentTickets)
        : '';
    this.startCreateMember();
    void this.fetchMembers(item.SupportTeamUUID);
    this.openFormDialog();
  }

  private toOptionalNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return null;
    return parsed;
  }

  private resolveApiError(err: any, fallback: string) {
    return err?.error?.error ?? err?.message ?? fallback;
  }

  async saveTeam(createAndNew = false) {
    if (!this.form.name.trim()) {
      this.error = 'Name is required.';
      return;
    }

    this.saving.set(true);
    this.error = '';

    try {
      const payload = {
        name: this.form.name.trim(),
        code: this.form.code?.trim() || null,
        description: this.form.description?.trim() || null,
        status: this.form.status,
        isDefault: this.form.isDefault ? 1 : 0,
        queuePriority: this.toOptionalNumber(this.form.queuePriority),
        maxConcurrentTickets: this.toOptionalNumber(this.form.maxConcurrentTickets),
      };

      if (this.editing) {
        await this.api.put(`support/teams/${this.editing.SupportTeamUUID}`, payload);
      } else {
        await this.api.post('support/teams', payload);
      }

      this.teamsResource.reload();
      if (createAndNew && !this.editing) {
        this.resetTeamForm();
      } else {
        this.closeFormDialog();
        this.resetTeamForm();
      }
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to save team.';
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTeam(item: SupportTeam) {
    const dialogRef = this.dialog.open(SlowConfirmDialogComponent, {
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Delete support team',
        message: `Do you want to delete "${item.Name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        countdownSeconds: 3,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;
    this.saving.set(true);
    this.error = '';
    try {
      await this.api.delete(`support/teams/${item.SupportTeamUUID}`);
      this.teamsResource.reload();
      this.resetTeamForm();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete team.';
    } finally {
      this.saving.set(false);
    }
  }

  startCreateMember() {
    this.memberEditing = null;
    this.memberForm.memberUserUUID = '';
    this.memberForm.role = 'member';
    this.memberForm.isPrimary = false;
    this.memberForm.canAssign = false;
    this.memberForm.canClose = false;
    this.memberForm.status = 1;
  }

  startEditMember(member: SupportTeamMember) {
    this.memberEditing = member;
    this.memberForm.memberUserUUID = member.MemberUserUUID ?? '';
    this.memberForm.role = member.Role ?? 'member';
    this.memberForm.isPrimary = Number(member.IsPrimary ?? 0) === 1;
    this.memberForm.canAssign = Number(member.CanAssign ?? 0) === 1;
    this.memberForm.canClose = Number(member.CanClose ?? 0) === 1;
    this.memberForm.status = member.Status ?? 1;
  }

  async saveMember() {
    if (!this.editing) return;

    if (!this.memberEditing && !this.memberForm.memberUserUUID) {
      this.memberError = 'User is required.';
      return;
    }

    this.loadingMembers = true;
    this.memberError = '';

    try {
      const payload = {
        memberUserUUID: this.memberForm.memberUserUUID,
        role: this.memberForm.role,
        isPrimary: this.memberForm.isPrimary ? 1 : 0,
        canAssign: this.memberForm.canAssign ? 1 : 0,
        canClose: this.memberForm.canClose ? 1 : 0,
        status: this.memberForm.status,
      };

      if (this.memberEditing) {
        await this.api.put(
          `support/teams/${this.editing.SupportTeamUUID}/members/${this.memberEditing.SupportTeamMemberUUID}`,
          payload,
        );
      } else {
        await this.api.post(`support/teams/${this.editing.SupportTeamUUID}/members`, payload);
      }

      await this.fetchMembers(this.editing.SupportTeamUUID);
      this.startCreateMember();
    } catch (err: any) {
      this.memberError = this.resolveApiError(err, 'Failed to save member.');
    } finally {
      this.loadingMembers = false;
    }
  }

  async deleteMember(member: SupportTeamMember) {
    if (!this.editing) return;
    const dialogRef = this.dialog.open(SlowConfirmDialogComponent, {
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Delete team member',
        message: 'Do you want to remove this member from the team? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        countdownSeconds: 3,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    this.loadingMembers = true;
    this.memberError = '';
    try {
      await this.api.delete(
        `support/teams/${this.editing.SupportTeamUUID}/members/${member.SupportTeamMemberUUID}`,
      );
      await this.fetchMembers(this.editing.SupportTeamUUID);
      if (this.memberEditing?.SupportTeamMemberUUID === member.SupportTeamMemberUUID) {
        this.startCreateMember();
      }
    } catch (err: any) {
      this.memberError = this.resolveApiError(err, 'Failed to delete member.');
    } finally {
      this.loadingMembers = false;
    }
  }
}
