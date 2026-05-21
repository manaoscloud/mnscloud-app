import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
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

type HostingStorageProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: StorageProvider;
  HspIsActive: number;
};

type StorageProvider = 's3' | 'gcs' | 'azure' | 'spaces';

type HostingStorageAccount = {
  HsaUUID: string;
  HsaName: string;
  HostingStorageProviderHspUUID: string;
  HsaConfig?: Record<string, unknown> | null;
  HsaIsActive: number;
  HsaIsDefault: number;
  HspName?: string;
  HspProvider?: string;
};

type ApiResponse<T> = {
  data: T;
};

@Component({
  selector: 'app-hosting-storage-accounts',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
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
export class HostingStorageAccountsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('accountDialog') accountDialog?: TemplateRef<unknown>;
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private dialogBinding: CrudDialogBinding | null = null;
  private loadingStarted = 0;
  readonly dataSource = new MatTableDataSource<HostingStorageAccount>([]);

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/storage' : 'hosting/storage',
  );
  readonly endpoint = computed(() => `${this.rootEndpoint()}/accounts`);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly accounts = signal<HostingStorageAccount[]>([]);
  readonly providers = signal<HostingStorageProvider[]>([]);
  readonly editing = signal<HostingStorageAccount | null>(null);
  readonly selectedProvider = signal<StorageProvider | null>(null);
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
    'bucket',
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
    bucket: [''],
    container: [''],
    publicBaseUrl: [''],
    pathPrefix: [''],
    configJson: [''],
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
      const config = item.HsaConfig ?? {};
      const matchesTerm =
        !term ||
        `${item.HsaName} ${item.HspName ?? ''} ${item.HspProvider ?? ''} ${config['bucket'] ?? ''} ${config['container'] ?? ''} ${config['pathPrefix'] ?? ''}`
          .toLowerCase()
          .includes(term);
      const matchesProvider = !providerUuid || item.HostingStorageProviderHspUUID === providerUuid;
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
    this.form.controls.providerUuid.valueChanges.subscribe((providerUuid) => {
      this.syncSelectedProvider(providerUuid);
    });
    void this.loadAll();
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  refreshList() {
    void this.loadAll();
  }

  async loadAll() {
    this.loadingStarted = performance.now();
    this.loading.set(true);
    try {
      const [providers, accounts] = await Promise.all([
        this.api.get<ApiResponse<HostingStorageProvider[]>>(`${this.rootEndpoint()}/providers`),
        this.api.get<ApiResponse<HostingStorageAccount[]>>(this.endpoint()),
      ]);
      this.providers.set(Array.isArray(providers.data) ? providers.data : []);
      this.accounts.set(Array.isArray(accounts.data) ? accounts.data : []);
      this.syncSelectedProvider(this.form.controls.providerUuid.value);
      this.dataSource.data = this.accounts();
      this.pageIndex.set(0);
      this.reconcileSelection();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load storage accounts.'));
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
      bucket: '',
      container: '',
      publicBaseUrl: '',
      pathPrefix: '',
      configJson: '',
    });
    this.selectedProvider.set(null);
    this.applyProviderValidators(null);
    this.openDialog();
  }

  startEdit(item: HostingStorageAccount) {
    this.editing.set(item);
    const config = this.asRecord(item.HsaConfig);
    this.form.reset({
      name: item.HsaName,
      providerUuid: item.HostingStorageProviderHspUUID,
      isActive: item.HsaIsActive ? 1 : 0,
      isDefault: item.HsaIsDefault ? 1 : 0,
      bucket: this.stringValue(config['bucket']),
      container: this.stringValue(config['container']),
      publicBaseUrl: this.stringValue(config['publicBaseUrl']),
      pathPrefix: this.stringValue(config['pathPrefix']),
      configJson: this.extraJson(config, ['bucket', 'container', 'publicBaseUrl', 'pathPrefix']),
    });
    this.syncSelectedProvider(item.HostingStorageProviderHspUUID);
    this.openDialog();
  }

  private openDialog() {
    if (!this.accountDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, this.accountDialog, 'crud-dialog-panel', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogBinding = binding;
    binding.ref.afterClosed().subscribe(() => {
      binding.stop();
      if (this.dialogBinding === binding) {
        this.dialogBinding = null;
      }
    });
  }

  openCrudTemplateDialog() {
    this.openDialog();
  }

  closeDialog() {
    const binding = this.dialogBinding;
    this.dialogBinding = null;
    binding?.ref.close();
    binding?.stop();
    this.editing.set(null);
  }

  async save(keepOpen = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    let extraConfig: Record<string, unknown> = {};
    try {
      extraConfig = raw.configJson.trim() ? JSON.parse(raw.configJson) : {};
    } catch {
      this.snack.error('Additional config must be valid JSON.');
      return;
    }

    const config = this.cleanRecord({
      ...extraConfig,
      ...this.accountConfigFromForm(this.selectedProvider(), raw),
    });

    const payload = {
      name: raw.name.trim(),
      providerUuid: raw.providerUuid,
      config,
      isActive: raw.isActive === 1,
      isDefault: Boolean(raw.isDefault),
    };

    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.endpoint()}/${editing.HsaUUID}`, payload);
        this.snack.success('Storage account updated.');
      } else {
        await this.api.post(this.endpoint(), payload);
        this.snack.success('Storage account created.');
      }
      await this.loadAll();
      if (keepOpen && !editing) {
        this.editing.set(null);
        this.form.reset({
          name: '',
          providerUuid: '',
          isActive: 1,
          isDefault: 0,
          bucket: '',
          container: '',
          publicBaseUrl: '',
          pathPrefix: '',
          configJson: '',
        });
        this.selectedProvider.set(null);
        this.applyProviderValidators(null);
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save storage account.'));
    } finally {
      this.saving.set(false);
    }
  }

  async validateAccount(item: HostingStorageAccount) {
    this.validatingId.set(item.HsaUUID);
    try {
      await this.api.post(`${this.endpoint()}/${item.HsaUUID}/validate`, {});
      this.snack.success('Storage account validated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to validate storage account.'));
    } finally {
      this.validatingId.set(null);
    }
  }

  async deleteAccount(item: HostingStorageAccount) {
    const ok = await this.confirm(`Delete storage account ${item.HsaName}?`);
    if (!ok) return;
    try {
      await this.api.delete(`${this.endpoint()}/${item.HsaUUID}`);
      this.snack.success('Storage account deleted.');
      await this.loadAll();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete storage account.'));
    }
  }

  async deleteSelectedAccounts() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const ok = await this.confirm(`Delete ${ids.length} selected storage account(s)?`);
    if (!ok) return;
    try {
      const response = await this.api.delete(`${this.endpoint()}/bulk`, { ids });
      const failedIds = this.extractBulkFailedIds(response);
      this.selectedIds.set(new Set(failedIds.filter((id) => ids.includes(id))));
      if (failedIds.length > 0) {
        const deletedCount = ids.length - failedIds.length;
        this.snack.warning(
          `${deletedCount} storage account(s) deleted; ${failedIds.length} failed.`,
        );
      } else {
        this.snack.success('Selected storage accounts deleted.');
      }
      await this.loadAll();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete selected storage accounts.'));
    }
  }

  isSelected(row: HostingStorageAccount) {
    return this.selectedIds().has(row.HsaUUID);
  }

  toggleSelection(row: HostingStorageAccount, checked: boolean) {
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

  providerLabel(item: HostingStorageAccount) {
    const name =
      item.HspName ||
      this.providers().find((provider) => provider.HspUUID === item.HostingStorageProviderHspUUID)
        ?.HspName;
    return name ?? '-';
  }

  bucketLabel(item: HostingStorageAccount) {
    const config = item.HsaConfig ?? {};
    return String(config['bucket'] || config['container'] || '-');
  }

  statusLabel(value: number) {
    return value === 1 ? 'Active' : 'Inactive';
  }

  canValidate(item: HostingStorageAccount) {
    return item.HspProvider === 's3' || item.HspProvider === 'spaces';
  }

  private syncSelectedProvider(providerUuid: string) {
    const provider =
      this.providers().find((item) => item.HspUUID === providerUuid)?.HspProvider ?? null;
    this.selectedProvider.set(provider);
    this.applyProviderValidators(provider);
  }

  private applyProviderValidators(provider: StorageProvider | null) {
    const bucketRequired = provider === 's3' || provider === 'spaces' || provider === 'gcs';
    const containerRequired = provider === 'azure';

    this.form.controls.bucket.clearValidators();
    this.form.controls.container.clearValidators();

    if (bucketRequired) this.form.controls.bucket.setValidators([Validators.required]);
    if (containerRequired) this.form.controls.container.setValidators([Validators.required]);

    this.form.controls.bucket.updateValueAndValidity({ emitEvent: false });
    this.form.controls.container.updateValueAndValidity({ emitEvent: false });
  }

  private accountConfigFromForm(
    provider: StorageProvider | null,
    raw: ReturnType<typeof this.form.getRawValue>,
  ) {
    if (provider === 'azure') {
      return {
        container: raw.container,
        publicBaseUrl: raw.publicBaseUrl,
        pathPrefix: raw.pathPrefix,
      };
    }
    return {
      bucket: raw.bucket,
      publicBaseUrl: raw.publicBaseUrl,
      pathPrefix: raw.pathPrefix,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private cleanRecord(value: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, item]) => item !== null && item !== undefined && item !== '',
      ),
    );
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  private extraJson(value: Record<string, unknown>, managedKeys: string[]) {
    const extra = Object.fromEntries(
      Object.entries(value).filter(([key]) => !managedKeys.includes(key)),
    );
    return Object.keys(extra).length > 0 ? JSON.stringify(extra, null, 2) : '';
  }

  private sortRows(rows: HostingStorageAccount[]) {
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

  private sortValue(row: HostingStorageAccount, column: string) {
    if (column === 'name') return row.HsaName ?? '';
    if (column === 'provider') return this.providerLabel(row);
    if (column === 'bucket') return this.bucketLabel(row);
    if (column === 'default') return String(row.HsaIsDefault ?? 0);
    if (column === 'status') return this.statusLabel(row.HsaIsActive);
    return '';
  }

  private reconcileSelection() {
    const valid = new Set(this.accounts().map((row) => row.HsaUUID));
    this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => valid.has(id))));
  }

  private extractBulkFailedIds(response: unknown) {
    const payload = this.asRecord(response);
    const data = this.asRecord(payload['data']);
    const failed = Array.isArray(data['failed']) ? data['failed'] : [];

    return failed
      .map((item) => {
        const row = this.asRecord(item);
        return this.stringValue(row['HsaUUID']);
      })
      .filter((id) => id.length > 0);
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
    const maybe = error as {
      error?: { error?: string; message?: string; code?: string };
      message?: string;
    };
    const message = maybe?.error?.message || maybe?.error?.error;
    const code = maybe?.error?.code;
    if (message && code) return `${message} (${code})`;
    return message || maybe?.message || fallback;
  }
}
