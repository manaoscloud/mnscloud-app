import {
  AfterViewInit,
  Component,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { TranslocoPipe } from '@jsverse/transloco';

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

@Component({
  selector: 'app-erp-hr-time-clock-accounts',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
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
  animations: [fadeIn],
})
export class ErpHumanResourcesTimeClockAccountsPage implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly statusFilter = signal<string | null>(null);
  readonly lastCredential = signal<CredentialResponse | null>(null);

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

  readonly form = this.fb.group({
    employeeUUID: ['', Validators.required],
    status: ['active', Validators.required],
    notes: [''],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly accountDialog = viewChild<TemplateRef<unknown>>('accountDialog');
  readonly credentialDialog = viewChild<TemplateRef<unknown>>('credentialDialog');

  ngAfterViewInit() {
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
    setTimeout(() => {
      void this.loadEmployees();
      void this.loadAccounts();
    }, 0);
  }

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

  async loadAccounts() {
    const startedAt = Date.now();
    this.loading.set(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(this.listLimit));
      if (this.search()) params.set('q', this.search());
      if (this.statusFilter()) params.set('status', this.statusFilter() ?? '');
      const response = await this.api.get<any>(
        `erp/human-resources/time-clock/accounts?${params.toString()}`,
      );
      this.dataSource.data = response?.data?.items ?? [];
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to load time clock accounts.'));
    } finally {
      const waitMs = Math.max(0, 600 - (Date.now() - startedAt));
      setTimeout(() => this.loading.set(false), waitMs);
    }
  }

  refreshList() {
    void this.loadAccounts();
  }

  applyFilters() {
    this.search.set(this.searchInput().trim());
    this.dataSource.paginator?.firstPage();
    void this.loadAccounts();
  }

  clearFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set(null);
    this.dataSource.paginator?.firstPage();
    void this.loadAccounts();
  }

  startCreate() {
    this.lastCredential.set(null);
    this.form.reset({ employeeUUID: '', status: 'active', notes: '' });
    this.dialog.open(this.accountDialog()!, {
      width: 'min(980px, 96vw)',
      maxHeight: '92vh',
      disableClose: true,
      autoFocus: false,
      restoreFocus: false,
    });
  }

  async saveAccount() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const response = await this.api.post<any>('erp/human-resources/time-clock/accounts', {
        employeeUUID: this.form.value.employeeUUID,
        status: this.form.value.status,
        notes: this.form.value.notes || null,
      });
      this.dialog.closeAll();
      this.lastCredential.set(response?.data ?? null);
      this.snack.success('Time clock account created successfully.');
      await this.loadAccounts();
      this.openCredentialDialog();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to create time clock account.'));
    } finally {
      this.saving.set(false);
    }
  }

  async resetPassword(row: TimeClockAccount) {
    this.saving.set(true);
    try {
      const response = await this.api.post<any>(
        `erp/human-resources/time-clock/accounts/${row.TimeClockAccountUUID}/reset-password`,
        {},
      );
      this.lastCredential.set({ ...response?.data, LoginCode: row.LoginCode });
      this.snack.success('Temporary password generated successfully.');
      await this.loadAccounts();
      this.openCredentialDialog();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to reset password.'));
    } finally {
      this.saving.set(false);
    }
  }

  async setStatus(row: TimeClockAccount, status: 'active' | 'inactive' | 'blocked') {
    this.saving.set(true);
    try {
      await this.api.put(`erp/human-resources/time-clock/accounts/${row.TimeClockAccountUUID}`, {
        status,
        notes: row.Notes ?? null,
      });
      this.snack.success('Time clock account updated successfully.');
      await this.loadAccounts();
    } catch (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to update account.'));
    } finally {
      this.saving.set(false);
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
