import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../../services/api.service';
import { AppI18nService } from '../../../../services/app-i18n.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { UserGovernanceDetailComponent } from './components/user-governance-detail/user-governance-detail';
import { UserGovernanceTableComponent } from './components/user-governance-table/user-governance-table';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  AccountAction,
  ApiListResponse,
  EMPTY_GOVERNANCE_USER_FILTERS,
  GovernanceAction,
  GovernanceUser,
  GovernanceUserFilters,
  GovernanceUserStatusFilter,
  LegalHold,
} from './user-governance.models';

type GovernanceFilterFormModel = {
  search: string;
  status: GovernanceUserStatusFilter;
};

type GovernanceActionFormModel = {
  reason: string;
  legalBasis: string;
  reference: string;
};

@Component({
  selector: 'app-system-governance-users',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslocoPipe,
    UserGovernanceDetailComponent,
    UserGovernanceTableComponent,
  ],
  templateUrl: './users.html',
  styleUrls: ['./users.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemGovernanceUsersPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedUser = signal<GovernanceUser | null>(null);
  readonly selectedHold = signal<LegalHold | null>(null);
  readonly actions = signal<GovernanceAction[]>([]);
  readonly legalHolds = signal<LegalHold[]>([]);
  readonly dialogAction = signal<AccountAction>('suspend');

  readonly filterFormModel = signal<GovernanceFilterFormModel>({
    search: '',
    status: '',
  });

  readonly actionFormModel = signal<GovernanceActionFormModel>({
    reason: '',
    legalBasis: '',
    reference: '',
  });

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

  readonly filterForm = createForm(this.filterFormModel);

  readonly actionForm = createForm(this.actionFormModel, (schema) => {
    required(schema.reason);
    minLength(schema.reason, 4);
  });

  readonly actionDialog = viewChild<TemplateRef<unknown>>('actionDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private lastLoadError = '';

  private readonly reportLoadError = effect(() => {
    const error = this.usersResource.error();
    if (!error) {
      this.error.set(null);
      this.lastLoadError = '';
      return;
    }

    const message = error instanceof Error ? error.message : this.i18n.t('Failed to load users.');
    this.error.set(message);
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
    }
  });

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
    this.filterFormModel.set({ search: '', status: '' });
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

  handleGovernanceAction(event: { user: GovernanceUser; action: AccountAction }) {
    this.openAction(event.user, event.action);
  }

  openAction(row: GovernanceUser, action: AccountAction) {
    this.selectedUser.set(row);
    this.selectedHold.set(null);
    this.dialogAction.set(action);
    this.actionFormModel.set({
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
    if (!user || !this.actionForm().valid() || this.saving()) return;

    this.saving.set(true);
    const payload = this.actionFormModel();
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
      this.snack.success(this.i18n.t('User governance action completed.'));
      this.dialogRef?.close();
      const users = await this.refreshUsersNow();
      const refreshed = users.find((item) => item.UserUUID === user.UserUUID) ?? user;
      await this.selectUser(refreshed);
    } catch (error) {
      this.snack.error(
        error instanceof Error ? error.message : this.i18n.t('Failed to execute action.'),
      );
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

  actionTitleKey() {
    const action = this.dialogAction();
    if (action === 'legal-hold') return 'Create legal hold';
    if (action === 'release-hold') return 'Release legal hold';
    if (action === 'close') return 'Close account';
    if (action === 'anonymize') return 'Anonymize account';
    return 'Suspend account';
  }

  actionHelpKey() {
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
    const { search, status } = this.filterFormModel();
    return {
      search: search.trim(),
      status: status === '' ? null : status,
    };
  }

  private async refreshUsersNow() {
    const users = await this.fetchUsers(this.appliedFilters());
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
}
