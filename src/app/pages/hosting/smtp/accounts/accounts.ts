import {
  Component,
  OnDestroy,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './accounts.html',
  styleUrls: ['./accounts.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class HostingSmtpAccountsPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly accountDialog = viewChild<TemplateRef<unknown>>('accountDialog');
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private dialogBinding: CrudDialogBinding | null = null;
  readonly dataSource = new MatTableDataSource<HostingSmtpAccount>([]);

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/smtp' : 'hosting/smtp',
  );
  readonly endpoint = computed(() => `${this.rootEndpoint()}/accounts`);

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

  readonly displayedColumns = [
    'select',
    'name',
    'provider',
    'from',
    'default',
    'status',
    'actions',
  ];

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

  private readonly accountsResource = resource({
    params: () => ({
      rootEndpoint: this.rootEndpoint(),
      endpoint: this.endpoint(),
    }),
    defaultValue: {
      providers: [] as HostingSmtpProvider[],
      accounts: [] as HostingSmtpAccount[],
    },
    loader: async ({ params }) => {
      const [providers, accounts] = await Promise.all([
        this.api.get<HostingSmtpProvider[]>(`${params.rootEndpoint}/providers`),
        this.api.get<HostingSmtpAccount[]>(params.endpoint),
      ]);
      return {
        providers: Array.isArray(providers) ? providers : [],
        accounts: Array.isArray(accounts) ? accounts : [],
      };
    },
  });
  readonly loading = this.accountsResource.isLoading;
  private readonly syncAccounts = effect(() => {
    const snapshot = this.accountsResource.value();
    this.providers.set(snapshot.providers);
    this.accounts.set(snapshot.accounts);
    this.dataSource.data = snapshot.accounts;
    this.pageIndex.set(0);
    this.reconcileSelection();
  });
  private readonly reportLoadError = effect(() => {
    const error = this.accountsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load SMTP accounts.'));
  });

  readonly filteredProviderOptions = computed(() => {
    const term = this.providerSearch().trim().toLowerCase();
    return this.providers().filter(
      (provider) =>
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
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  refreshList() {
    this.accountsResource.reload();
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
    const accountDialog = this.accountDialog();
    if (!accountDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, accountDialog, 'crud-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogBinding.ref.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  openCrudTemplateDialog() {
    this.openDialog();
  }

  closeDialog() {
    if (!this.dialogBinding) return;
    this.dialogBinding.ref.close();
    this.dialogBinding.stop();
    this.dialogBinding = null;
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
      isDefault: Boolean(raw.isDefault),
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
      this.accountsResource.reload();
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
      this.accountsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete SMTP account.'));
    }
  }

  async deleteSelectedAccounts() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const ok = await this.confirm(this.bulkDeleteMessage(ids));
    if (!ok) return;
    try {
      const response = await this.api.delete<any>(`${this.endpoint()}/bulk`, { ids });
      const result = this.parseBulkDeleteResult(response, ids);
      this.accounts.set(this.accounts().filter((row) => !result.deleted.has(row.HsaUUID)));
      this.dataSource.data = this.accounts();
      this.selectedIds.set(result.failed);
      if (result.failed.size) {
        this.snack.error(`${result.failed.size} selected SMTP account(s) could not be deleted.`);
      } else {
        this.snack.success(`${result.deleted.size} selected SMTP account(s) deleted.`);
      }
      this.accountsResource.reload();
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
    const name =
      item.HspName ||
      this.providers().find((provider) => provider.HspUUID === item.HostingSmtpProviderHspUUID)
        ?.HspName;
    return name ?? '-';
  }

  fromLabel(item: HostingSmtpAccount) {
    return item.HsaDefaultFromEmail || '-';
  }

  statusLabel(value: number) {
    return value === 1 ? 'Active' : 'Inactive';
  }

  statusChipClass(value: number) {
    return value === 1 ? 'chip-success' : 'chip-skipped';
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

  private bulkDeleteMessage(ids: string[]) {
    const labels = this.accounts()
      .filter((item) => ids.includes(item.HsaUUID))
      .slice(0, 3)
      .map((item) => item.HsaName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    return `Delete ${ids.length} selected SMTP account(s)?${suffix}`;
  }

  private parseBulkDeleteResult(response: any, requestedIds: string[]) {
    const payload = response?.data ?? response ?? {};
    const failedItems = Array.isArray(payload.failed) ? payload.failed : [];
    const failed = new Set<string>(
      failedItems
        .map((item: any) => this.extractBulkFailureUUID(item))
        .filter((uuid: string | null): uuid is string => !!uuid),
    );
    const deletedItems = Array.isArray(payload.deleted) ? payload.deleted : [];
    const deleted = new Set<string>(
      deletedItems.length
        ? deletedItems.filter((uuid: unknown): uuid is string => typeof uuid === 'string')
        : requestedIds.filter((uuid) => !failed.has(uuid)),
    );
    return { deleted, failed };
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.HsaUUID === 'string') return item.HsaUUID;
    if (typeof item.UUID === 'string') return item.UUID;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
