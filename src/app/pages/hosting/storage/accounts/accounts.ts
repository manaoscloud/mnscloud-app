import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import type {
  ConfigurableCrudOption,
  ConfigurableCrudQuickCreateResult,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

type HostingStorageProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: StorageProvider;
  HspConfig?: Record<string, unknown> | null;
  HspIsActive: number;
};

type StorageProvider = 's3' | 'gcs' | 'azure' | 'spaces' | 'sangfor_scp';

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

type StorageAccountFormModel = {
  name: string;
  providerUuid: string;
  isActive: number;
  isDefault: number;
  bucket: string;
  container: string;
  publicBaseUrl: string;
  pathPrefix: string;
  configJson: string;
};

@Component({
  selector: 'app-hosting-storage-accounts',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './accounts.html',
  styleUrls: ['./accounts.scss'],
})
export class HostingStorageAccountsPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly accountDialog = viewChild<TemplateRef<unknown>>('accountDialog');
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private dialogBinding: CrudDialogBinding | null = null;
  readonly dataSource = new MatTableDataSource<HostingStorageAccount>([]);

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/storage' : 'hosting/storage',
  );
  readonly endpoint = computed(() => `${this.rootEndpoint()}/accounts`);

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

  readonly filterFormModel = signal({
    search: '',
    providerUuid: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly accountFormModel = signal<StorageAccountFormModel>({
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
  readonly form = createForm(this.accountFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.providerUuid);
  });

  private readonly accountsResource = resource({
    params: () => ({
      rootEndpoint: this.rootEndpoint(),
      endpoint: this.endpoint(),
    }),
    defaultValue: {
      providers: [] as HostingStorageProvider[],
      accounts: [] as HostingStorageAccount[],
    },
    loader: async ({ params }) => {
      const [providers, accounts] = await Promise.all([
        this.api.get<ApiResponse<HostingStorageProvider[]>>(`${params.rootEndpoint}/providers`),
        this.api.get<ApiResponse<HostingStorageAccount[]>>(params.endpoint),
      ]);
      return {
        providers: Array.isArray(providers.data) ? providers.data : [],
        accounts: Array.isArray(accounts.data) ? accounts.data : [],
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
  private readonly syncSelectedProvider = effect(() => {
    const providerUuid = this.accountFormModel().providerUuid;
    const provider =
      this.providers().find((item) => item.HspUUID === providerUuid)?.HspProvider ?? null;
    this.selectedProvider.set(provider);
  });
  private readonly reportLoadError = effect(() => {
    const error = this.accountsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load storage accounts.'));
  });

  readonly filteredProviderOptions = computed(() => {
    const term = this.providerSearch().trim().toLowerCase();
    return this.providers().filter(
      (provider) =>
        !term || `${provider.HspName} ${provider.HspProvider}`.toLowerCase().includes(term),
    );
  });

  readonly filteredAccounts = computed(() => {
    const { search, providerUuid, status } = this.filterFormModel();
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

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.destroyRef.onDestroy(() => this.closeDialog());
  }

  refreshList() {
    this.accountsResource.reload();
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.reconcileSelection();
  }

  clearFilters() {
    this.filterFormModel.set({ search: '', providerUuid: '', status: '' });
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
    this.accountFormModel.set({
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
    this.openDialog();
  }

  startEdit(item: HostingStorageAccount) {
    this.editing.set(item);
    const config = this.asRecord(item.HsaConfig);
    this.accountFormModel.set({
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
    this.openDialog();
  }

  private openDialog() {
    const accountDialog = this.accountDialog();
    if (!accountDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, accountDialog, 'crud-dialog-panel', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogBinding = binding;
    bindDialogClosed(binding.ref, () => {
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
    if (!this.accountFormIsValid()) {
      return;
    }

    const raw = this.accountFormModel();
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
      this.accountsResource.reload();
      if (keepOpen && !editing) {
        this.editing.set(null);
        this.accountFormModel.set({
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
      this.accountsResource.reload();
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
      this.accountsResource.reload();
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
    return (
      item.HspProvider === 's3' ||
      item.HspProvider === 'spaces' ||
      item.HspProvider === 'sangfor_scp'
    );
  }

  accountFormIsValid() {
    if (!this.form().valid()) return false;
    const provider = this.selectedProvider();
    const raw = this.accountFormModel();
    const bucketRequired =
      provider === 's3' ||
      provider === 'spaces' ||
      provider === 'gcs' ||
      provider === 'sangfor_scp';
    if (bucketRequired && !raw.bucket.trim()) return false;
    if (provider === 'azure' && !raw.container.trim()) return false;
    return true;
  }

  private accountConfigFromForm(provider: StorageProvider | null, raw: StorageAccountFormModel) {
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
    const valid = new Set(this.dataSource.data.map((row) => row.HsaUUID));
    const current = untracked(() => this.selectedIds());
    const next = new Set([...current].filter((id) => valid.has(id)));
    if (next.size === current.size && [...next].every((id) => current.has(id))) return;
    this.selectedIds.set(next);
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

@Component({
  selector: 'app-hosting-storage-accounts-quick-create-host',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './accounts.html',
  styleUrls: ['./accounts.scss', '../../../erp/customer/customer-quick-create-host.scss'],
})
export class HostingStorageAccountsQuickCreateHostComponent extends HostingStorageAccountsPage {
  private readonly quickDialogRef = inject(
    MatDialogRef<HostingStorageAccountsQuickCreateHostComponent, ConfigurableCrudQuickCreateResult>,
  );
  private readonly quickApi = inject(ApiService);
  private savingFromQuickCreate = false;

  constructor() {
    super();
    queueMicrotask(() => this.startCreate());
  }

  override async save(keepOpen = false): Promise<void> {
    const name = this.accountFormModel().name.trim();
    this.savingFromQuickCreate = true;
    try {
      await super.save(keepOpen);
      if (!this.editing() && name) {
        this.quickDialogRef.close({
          option: await this.findCreatedOption(name),
          payload: { name },
        });
      }
    } finally {
      this.savingFromQuickCreate = false;
    }
  }

  override closeDialog() {
    super.closeDialog();
    if (!this.savingFromQuickCreate) {
      this.quickDialogRef.close({ option: null });
    }
  }

  private async findCreatedOption(name: string): Promise<ConfigurableCrudOption | null> {
    const response = await this.quickApi.get<ApiResponse<HostingStorageAccount[]>>(
      `${this.endpoint()}?search=${encodeURIComponent(name)}&status=1&limit=20`,
    );
    const rows = Array.isArray(response.data) ? response.data : [];
    const exact = rows.find((row) => row.HsaName.toLowerCase() === name.toLowerCase()) ?? rows[0];
    if (!exact) return null;
    return {
      value: exact.HsaUUID,
      label: exact.HsaName,
      description: [exact.HspName, exact.HspProvider].filter(Boolean).join(' - '),
      searchText: `${exact.HsaName} ${exact.HspName ?? ''} ${exact.HspProvider ?? ''} ${exact.HsaUUID}`,
    };
  }
}
