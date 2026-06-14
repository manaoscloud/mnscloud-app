import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { FormField, form as createForm, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
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
import { MatTooltipModule } from '@angular/material/tooltip';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type EmployeeOption = {
  EmployeeUUID: string;
  Name: string;
  Email?: string | null;
};

type TimeClockAccount = {
  TimeClockAccountUUID: string;
  EmployeeUUID: string;
  EmployeeName?: string | null;
  EmployeeEmail?: string | null;
  LoginCode: string;
  MustChangePassword: number;
  TemporaryPasswordExpiresAt?: string | null;
  FailedLoginCount: number;
  LockedUntil?: string | null;
  LastLoginAt?: string | null;
  Status: 'active' | 'inactive' | 'blocked';
  Notes?: string | null;
  DateCreated?: string | null;
  DateUpdated?: string | null;
};

type CredentialResponse = {
  TimeClockAccountUUID: string;
  LoginCode?: string | null;
  TemporaryPassword: string;
  TemporaryPasswordExpiresAt: string;
};

type TimeClockAccountListParams = {
  search: string;
  status: string | null;
};

@Component({
  selector: 'app-erp-hr-time-clock-accounts',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
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
  templateUrl: './time-clock-accounts.html',
  styleUrls: ['../shared/human-resources-crud.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpHumanResourcesTimeClockAccountsPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly saving = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly statusFilter = signal<string | null>(null);
  readonly lastCredential = signal<CredentialResponse | null>(null);
  private readonly mutating = signal(false);
  private readonly accountListParams = signal<TimeClockAccountListParams>({
    search: '',
    status: null,
  });
  private readonly accountsResource = resource({
    params: () => this.accountListParams(),
    defaultValue: [] as TimeClockAccount[],
    loader: ({ params }) => this.fetchAccounts(params),
  });
  readonly loading = computed(() => this.accountsResource.isLoading() || this.mutating());

  readonly employees = signal<EmployeeOption[]>([]);
  readonly dataSource = new MatTableDataSource<TimeClockAccount>([]);
  readonly displayedColumns = [
    'EmployeeName',
    'LoginCode',
    'Status',
    'MustChangePassword',
    'LastLoginAt',
    'actions',
  ];

  readonly formModel = signal({
    employeeUUID: '',
    status: 'active' as 'active' | 'inactive' | 'blocked',
    notes: '',
  });
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.employeeUUID);
    required(schema.status);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly accountDialog = viewChild<TemplateRef<unknown>>('accountDialog');
  readonly credentialDialog = viewChild<TemplateRef<unknown>>('credentialDialog');
  private lastLoadError = '';
  private readonly syncAccounts = effect(() => {
    this.dataSource.data = this.accountsResource.value();
  });
  private readonly reportAccountsError = effect(() => {
    const error = this.accountsResource.error();
    if (!error) {
      this.lastLoadError = '';
      return;
    }
    const message = this.extractErrorMessage(error, 'Failed to load time clock accounts.');
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
      this.snack.error(message);
    }
    this.dataSource.data = [];
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'EmployeeName':
          return row.EmployeeName ?? '';
        case 'MustChangePassword':
          return row.MustChangePassword;
        case 'LastLoginAt':
          return row.LastLoginAt ?? '';
        default:
          return String((row as any)[column] ?? '');
      }
    };
    void this.loadEmployees();
  });

  async loadEmployees() {
    try {
      const response = await this.api.get<any>(
        `erp/human-resources/employees?status=1&limit=${this.listLimit}`,
      );
      this.employees.set(response?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to load employees.'));
    }
  }

  private async fetchAccounts(paramsValue: TimeClockAccountListParams) {
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (paramsValue.search) params.set('q', paramsValue.search);
    if (paramsValue.status) params.set('status', paramsValue.status);
    const response = await this.api.get<any>(
      `erp/human-resources/time-clock/accounts?${params.toString()}`,
    );
    return response?.data?.items ?? [];
  }

  refreshList() {
    this.accountsResource.reload();
  }

  applyFilters() {
    this.search.set(this.searchInput().trim());
    this.dataSource.paginator?.firstPage();
    this.accountListParams.set({
      search: this.search(),
      status: this.statusFilter(),
    });
  }

  clearFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set(null);
    this.dataSource.paginator?.firstPage();
    this.accountListParams.set({
      search: '',
      status: null,
    });
  }

  startCreate() {
    this.lastCredential.set(null);
    this.formModel.set({ employeeUUID: '', status: 'active', notes: '' });
    this.dialog.open(this.accountDialog()!, {
      width: 'min(980px, 96vw)',
      maxHeight: '92vh',
      disableClose: true,
      autoFocus: false,
      restoreFocus: false,
    });
  }

  async saveAccount() {
    if (!this.form().valid() || this.saving()) {
      return;
    }
    this.saving.set(true);
    const values = this.formModel();
    try {
      const response = await this.api.post<any>('erp/human-resources/time-clock/accounts', {
        employeeUUID: values.employeeUUID,
        status: values.status,
        notes: values.notes || null,
      });
      this.dialog.closeAll();
      this.lastCredential.set(response?.data ?? null);
      this.snack.success('Time clock account created successfully.');
      this.accountsResource.reload();
      this.openCredentialDialog();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to create time clock account.'));
    } finally {
      this.saving.set(false);
    }
  }

  async resetPassword(row: TimeClockAccount) {
    this.mutating.set(true);
    try {
      const response = await this.api.post<any>(
        `erp/human-resources/time-clock/accounts/${row.TimeClockAccountUUID}/reset-password`,
        {},
      );
      this.lastCredential.set({ ...response?.data, LoginCode: row.LoginCode });
      this.snack.success('Temporary password generated successfully.');
      this.accountsResource.reload();
      this.openCredentialDialog();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to reset password.'));
    } finally {
      this.mutating.set(false);
    }
  }

  async setStatus(row: TimeClockAccount, status: 'active' | 'inactive' | 'blocked') {
    this.mutating.set(true);
    try {
      await this.api.put(`erp/human-resources/time-clock/accounts/${row.TimeClockAccountUUID}`, {
        status,
        notes: row.Notes ?? null,
      });
      this.snack.success('Time clock account updated successfully.');
      this.accountsResource.reload();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to update account.'));
    } finally {
      this.mutating.set(false);
    }
  }

  closeDialogs() {
    this.dialog.closeAll();
  }

  statusLabel(status: string) {
    if (status === 'blocked') return 'Blocked';
    if (status === 'inactive') return 'Inactive';
    return 'Active';
  }

  formatDate(value?: string | null) {
    if (!value) return '-';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private openCredentialDialog() {
    this.dialog.open(this.credentialDialog()!, {
      width: 'min(720px, 96vw)',
      maxHeight: '92vh',
      disableClose: true,
      autoFocus: false,
      restoreFocus: false,
    });
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'error' in error) {
      const value = (error as { error?: unknown }).error;
      if (typeof value === 'string' && value.trim()) return value;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
