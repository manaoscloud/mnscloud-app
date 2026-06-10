import {
  AfterViewInit,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';

type AccountAction = 'suspend' | 'close' | 'anonymize' | 'legal-hold' | 'release-hold';

interface ApiListResponse<T> {
  data?: {
    items?: T[];
    item?: T;
  };
}

interface GovernanceUser {
  UserUUID: string;
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  Status?: number | null;
  EmailVerifiedAt?: string | null;
  DateDeleted?: string | null;
  DateCreated?: string | null;
  AccessCount?: number | null;
  MasterAccessCount?: number | null;
  ActiveLegalHoldCount?: number | null;
  LastAction?: string | null;
  LastActionAt?: string | null;
}

interface GovernanceAction {
  UaaID?: string | null;
  UaaAction?: string | null;
  UaaStatus?: string | null;
  UaaReason?: string | null;
  RequestedByEmail?: string | null;
  UaaDateCreated?: string | null;
}

interface LegalHold {
  UlhUUID: string;
  UlhID?: string | null;
  UlhStatus?: number | null;
  UlhReason?: string | null;
  UlhLegalBasis?: string | null;
  UlhReference?: string | null;
  UlhDateCreated?: string | null;
  UlhDateReleased?: string | null;
}

type GovernanceUserFilters = {
  search: string;
  status: number | null;
};

const EMPTY_GOVERNANCE_USER_FILTERS: GovernanceUserFilters = {
  search: '',
  status: null,
};

@Component({
  selector: 'app-system-governance-users',
  standalone: true,
  imports: [
    FormsModule,
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
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './users.html',
  styleUrls: ['./users.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemGovernanceUsersPage implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(SnackbarService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedUser = signal<GovernanceUser | null>(null);
  readonly selectedHold = signal<LegalHold | null>(null);
  readonly actions = signal<GovernanceAction[]>([]);
  readonly legalHolds = signal<LegalHold[]>([]);
  readonly dialogAction = signal<AccountAction>('suspend');

  readonly source = new MatTableDataSource<GovernanceUser>([]);
  readonly columns = [
    'status',
    'name',
    'email',
    'access',
    'emailVerified',
    'legalHolds',
    'lastAction',
    'created',
    'actions',
  ];

  searchInput = '';
  statusFilter: number | null = null;
  private readonly appliedFilters = signal<GovernanceUserFilters>({
    ...EMPTY_GOVERNANCE_USER_FILTERS,
  });
  private readonly usersResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as GovernanceUser[],
    loader: ({ params }) => this.fetchUsers(params),
  });

  readonly loading = this.usersResource.isLoading;
  readonly users = computed(() => this.usersResource.value());

  readonly actionForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(4)]],
    legalBasis: [''],
    reference: [''],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly actionDialog = viewChild<TemplateRef<unknown>>('actionDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private lastLoadError = '';

  private readonly syncUsers = effect(() => {
    this.source.data = this.users();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.usersResource.error();
    if (!error) {
      this.error.set(null);
      this.lastLoadError = '';
      return;
    }

    const message = error instanceof Error ? error.message : 'Failed to load users.';
    this.error.set(message);
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
    }
  });

  ngAfterViewInit() {
    this.source.paginator = this.paginator() ?? null;
    this.source.sort = this.sort() ?? null;
    this.source.sortingDataAccessor = (row, column) => this.sortValue(row, column);
  }

  refreshList() {
    this.usersResource.reload();
  }

  applyFilters() {
    const filters = this.normalizedFilters();
    const current = this.appliedFilters();
    if (filters.search === current.search && filters.status === current.status) {
      this.usersResource.reload();
    } else {
      this.appliedFilters.set(filters);
    }
  }

  clearFilters() {
    this.searchInput = '';
    this.statusFilter = null;
    const current = this.appliedFilters();
    if (!current.search && current.status === null) {
      this.usersResource.reload();
    } else {
      this.appliedFilters.set({ ...EMPTY_GOVERNANCE_USER_FILTERS });
    }
  }

  async selectUser(row: GovernanceUser) {
    this.selectedUser.set(row);
    await Promise.all([this.loadActions(row), this.loadLegalHolds(row)]);
  }

  openAction(row: GovernanceUser, action: AccountAction) {
    this.selectedUser.set(row);
    this.selectedHold.set(null);
    this.dialogAction.set(action);
    this.actionForm.reset({
      reason: '',
      legalBasis: '',
      reference: '',
    });
    const actionDialog = this.actionDialog();
    if (!actionDialog) return;
    this.dialogRef = this.dialog.open(actionDialog, {
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'crud-dialog-panel',
    });
  }

  async submitAction() {
    const user = this.selectedUser();
    const action = this.dialogAction();
    if (!user || this.actionForm.invalid || this.saving()) {
      this.actionForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const payload = this.actionForm.getRawValue();
    const hold = this.selectedHold();
    const endpoint =
      action === 'legal-hold'
        ? `system/governance/users/${user.UserUUID}/legal-holds`
        : action === 'release-hold' && hold
          ? `system/governance/users/${user.UserUUID}/legal-holds/${hold.UlhUUID}/release`
          : `system/governance/users/${user.UserUUID}/${action}`;
    const body =
      action === 'legal-hold'
        ? payload
        : { reason: payload.reason, legalBasis: payload.legalBasis };

    try {
      await this.api.post(endpoint, body);
      this.snack.success('User governance action completed.');
      this.dialogRef?.close();
      const users = await this.refreshUsersNow();
      const refreshed = users.find((item) => item.UserUUID === user.UserUUID) ?? user;
      await this.selectUser(refreshed);
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to execute action.');
    } finally {
      this.saving.set(false);
    }
  }

  async releaseHold(hold: LegalHold) {
    const user = this.selectedUser();
    if (!user || this.saving()) return;
    this.openAction(user, 'release-hold');
    this.selectedHold.set(hold);
  }

  fullName(row: GovernanceUser) {
    return [row.FirstName, row.LastName].filter(Boolean).join(' ') || '-';
  }

  statusLabel(row: GovernanceUser) {
    if (row.DateDeleted) return 'Closed';
    return Number(row.Status ?? 0) === 1 ? 'Active' : 'Inactive';
  }

  actionTitle() {
    const action = this.dialogAction();
    if (action === 'legal-hold') return 'Create legal hold';
    if (action === 'release-hold') return 'Release legal hold';
    return `${action.charAt(0).toUpperCase()}${action.slice(1)} account`;
  }

  actionHelp() {
    const action = this.dialogAction();
    if (action === 'anonymize') {
      return 'This removes personal identifiers while preserving relational history. Active legal holds block this action.';
    }
    if (action === 'close') {
      return 'This closes the account, revokes sessions and keeps relational history for audit and legal purposes.';
    }
    if (action === 'legal-hold') {
      return 'This prevents future anonymization until the legal hold is released.';
    }
    if (action === 'release-hold') {
      return 'This releases the selected legal hold and allows future anonymization if no other hold remains active.';
    }
    return 'This blocks sign-in and revokes active sessions without removing relational history.';
  }

  private async loadActions(user: GovernanceUser) {
    const response = await this.api.get<ApiListResponse<GovernanceAction>>(
      `system/governance/users/${user.UserUUID}/actions?limit=100`,
    );
    this.actions.set(response.data?.items ?? []);
  }

  private async loadLegalHolds(user: GovernanceUser) {
    const response = await this.api.get<ApiListResponse<LegalHold>>(
      `system/governance/users/${user.UserUUID}/legal-holds?limit=100`,
    );
    this.legalHolds.set(response.data?.items ?? []);
  }

  private normalizedFilters(): GovernanceUserFilters {
    return {
      search: this.searchInput.trim(),
      status: this.statusFilter,
    };
  }

  private async refreshUsersNow() {
    const users = await this.fetchUsers(this.appliedFilters());
    this.source.data = users;
    this.usersResource.reload();
    return users;
  }

  private async fetchUsers(filters: GovernanceUserFilters) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== null) params.set('status', String(filters.status));
    params.set('limit', '2000');
    const response = await this.api.get<ApiListResponse<GovernanceUser>>(
      `system/governance/users?${params.toString()}`,
    );
    return response.data?.items ?? [];
  }

  private sortValue(row: GovernanceUser, column: string): string | number {
    if (column === 'name') return this.fullName(row);
    if (column === 'email') return row.Email ?? '';
    if (column === 'status') return this.statusLabel(row);
    if (column === 'access') return Number(row.AccessCount ?? 0);
    if (column === 'legalHolds') return Number(row.ActiveLegalHoldCount ?? 0);
    if (column === 'created') return row.DateCreated ?? '';
    return String((row as any)[column] ?? '');
  }
}
