import { CommonModule } from '@angular/common';
import { Component, OnDestroy, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type HostingSmtpProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: string;
  HspIsActive: number;
};

type HostingSmtpAccount = {
  HsaUUID: string;
  HsaName: string;
  HostingSmtpProviderHspUUID: string;
  HsaDefaultFromName?: string | null;
  HsaDefaultFromEmail?: string | null;
  HsaIsActive: number;
  HsaIsDefault: number;
  HspName?: string;
  HspProvider?: string;
};

@Component({
  selector: 'app-hosting-smtp-accounts',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './accounts.html',
  styleUrls: ['./accounts.scss'],
  animations: [fadeIn],
})
export class HostingSmtpAccountsPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('accountDialog') accountDialog?: TemplateRef<unknown>;
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private dialogRef: MatDialogRef<unknown> | null = null;
  private loadingStarted = 0;
  readonly dataSource = new MatTableDataSource<HostingSmtpAccount>([]);

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/smtp' : 'hosting/smtp',
  );
  readonly endpoint = computed(() => `${this.rootEndpoint()}/accounts`);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly accounts = signal<HostingSmtpAccount[]>([]);
  readonly providers = signal<HostingSmtpProvider[]>([]);
  readonly editing = signal<HostingSmtpAccount | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly providerSearch = signal('');
  readonly validatingId = signal<string | null>(null);

  readonly displayedColumns = ['select', 'name', 'provider', 'from', 'default', 'status', 'actions'];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    providerUuid: [''],
    status: [''],
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    providerUuid: ['', [Validators.required]],
    isActive: [1],
    isDefault: [0],
    defaultFromName: [''],
    defaultFromEmail: ['', [Validators.email]],
  });

  readonly filteredProviderOptions = computed(() => {
    const term = this.providerSearch().trim().toLowerCase();
    return this.providers().filter((provider) =>
      !term || `${provider.HspName} ${provider.HspProvider}`.toLowerCase().includes(term),
    );
  });

  readonly filteredAccounts = computed(() => {
    const { search, providerUuid, status } = this.filterForm.getRawValue();
    const term = search.trim().toLowerCase();
    const rows = this.accounts().filter((item) => {
      const matchesTerm =
        !term ||
        `${item.HsaName} ${item.HspName ?? ''} ${item.HspProvider ?? ''} ${item.HsaDefaultFromName ?? ''} ${item.HsaDefaultFromEmail ?? ''}`
          .toLowerCase()
          .includes(term);
      const matchesProvider = !providerUuid || item.HostingSmtpProviderHspUUID === providerUuid;
      const matchesStatus = status === '' || String(item.HsaIsActive) === status;
      return matchesTerm && matchesProvider && matchesStatus;
    });
    return this.sortRows(rows);
  });

  readonly pagedAccounts = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredAccounts().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.loadAll();
  }

  ngOnDestroy() {
    this.dialogRef?.close();
  }

  refreshList() {
    void this.loadAll();
  }

  async loadAll() {
    this.loadingStarted = performance.now();
    this.loading.set(true);
    try {
      const [providers, accounts] = await Promise.all([
        this.api.get<HostingSmtpProvider[]>(`${this.rootEndpoint()}/providers`),
        this.api.get<HostingSmtpAccount[]>(this.endpoint()),
      ]);
      this.providers.set(Array.isArray(providers) ? providers : []);
      this.accounts.set(Array.isArray(accounts) ? accounts : []);
      this.dataSource.data = this.accounts();
      this.pageIndex.set(0);
      this.reconcileSelection();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load SMTP accounts.'));
    } finally {
      const elapsed = performance.now() - this.loadingStarted;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.reconcileSelection();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', providerUuid: '', status: '' });
    this.pageIndex.set(0);
    this.reconcileSelection();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.pageIndex.set(0);
  }

  resetProviderSearch(opened: boolean) {
    if (!opened) this.providerSearch.set('');
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      name: '',
      providerUuid: '',
      isActive: 1,
      isDefault: 0,
      defaultFromName: '',
      defaultFromEmail: '',
    });
    this.openDialog();
  }

  startEdit(item: HostingSmtpAccount) {
    this.editing.set(item);
    this.form.reset({
      name: item.HsaName,
      providerUuid: item.HostingSmtpProviderHspUUID,
      isActive: item.HsaIsActive ? 1 : 0,
      isDefault: item.HsaIsDefault ? 1 : 0,
      defaultFromName: item.HsaDefaultFromName ?? '',
      defaultFromEmail: item.HsaDefaultFromEmail ?? '',
    });
    this.openDialog();
  }

  private openDialog() {
    if (!this.accountDialog) return;
    this.dialogRef = this.dialog.open(this.accountDialog, {
      width: 'min(960px, calc(100vw - 32px))',
      maxWidth: '960px',
      height: 'min(92vh, 720px)',
      maxHeight: '92vh',
      disableClose: true,
      panelClass: 'crud-dialog-panel',
    });
    this.dialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.closeDialog();
    });
  }

  openCrudTemplateDialog() {
    this.openDialog();
  }

  closeDialog() {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.editing.set(null);
  }

  async save(keepOpen = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      providerUuid: raw.providerUuid,
      defaultFromName: raw.defaultFromName,
      defaultFromEmail: raw.defaultFromEmail,
      isActive: raw.isActive === 1,
      isDefault: raw.isDefault === 1,
    };

    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.endpoint()}/${editing.HsaUUID}`, payload);
        this.snack.success('SMTP account updated.');
      } else {
        await this.api.post(this.endpoint(), payload);
        this.snack.success('SMTP account created.');
      }
      await this.loadAll();
      if (keepOpen && !editing) this.startCreate();
      else this.closeDialog();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save SMTP account.'));
    } finally {
      this.saving.set(false);
    }
  }

  async validateAccount(item: HostingSmtpAccount) {
    this.validatingId.set(item.HsaUUID);
    try {
      await this.api.post(`${this.endpoint()}/${item.HsaUUID}/validate`, {});
      this.snack.success('SMTP account validated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to validate SMTP account.'));
    } finally {
      this.validatingId.set(null);
    }
  }

  async deleteAccount(item: HostingSmtpAccount) {
    const ok = await this.confirm(`Delete SMTP account ${item.HsaName}?`);
    if (!ok) return;
    try {
      await this.api.delete(`${this.endpoint()}/${item.HsaUUID}`);
      this.snack.success('SMTP account deleted.');
      await this.loadAll();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete SMTP account.'));
    }
  }

  async deleteSelectedAccounts() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const ok = await this.confirm(`Delete ${ids.length} selected SMTP account(s)?`);
    if (!ok) return;
    try {
      await this.api.delete(`${this.endpoint()}/bulk`, { ids });
      this.selectedIds.set(new Set());
      this.snack.success('Selected SMTP accounts deleted.');
      await this.loadAll();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete selected SMTP accounts.'));
    }
  }

  isSelected(row: HostingSmtpAccount) {
    return this.selectedIds().has(row.HsaUUID);
  }

  toggleSelection(row: HostingSmtpAccount, checked: boolean) {
    const next = new Set(this.selectedIds());
    checked ? next.add(row.HsaUUID) : next.delete(row.HsaUUID);
    this.selectedIds.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.pagedAccounts()) {
      checked ? next.add(row.HsaUUID) : next.delete(row.HsaUUID);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.pagedAccounts();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.HsaUUID));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedAccounts();
    return rows.some((row) => this.selectedIds().has(row.HsaUUID)) && !this.isAllVisibleSelected();
  }

  providerLabel(item: HostingSmtpAccount) {
    const name = item.HspName || this.providers().find((provider) => provider.HspUUID === item.HostingSmtpProviderHspUUID)?.HspName;
    return name ?? '-';
  }

  fromLabel(item: HostingSmtpAccount) {
    return item.HsaDefaultFromEmail || '-';
  }

  statusLabel(value: number) {
    return value === 1 ? 'Active' : 'Inactive';
  }

  canValidate(item: HostingSmtpAccount) {
    return item.HspProvider === 's3' || item.HspProvider === 'spaces';
  }

  private sortRows(rows: HostingSmtpAccount[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const result = this.sortValue(a, active).localeCompare(this.sortValue(b, active), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: HostingSmtpAccount, column: string) {
    if (column === 'name') return row.HsaName ?? '';
    if (column === 'provider') return this.providerLabel(row);
    if (column === 'from') return this.fromLabel(row);
    if (column === 'default') return String(row.HsaIsDefault ?? 0);
    if (column === 'status') return this.statusLabel(row.HsaIsActive);
    return '';
  }

  private reconcileSelection() {
    const valid = new Set(this.accounts().map((row) => row.HsaUUID));
    this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => valid.has(id))));
  }

  private async confirm(message: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title: 'Confirm delete', message, confirmText: 'Delete', color: 'warn' },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
