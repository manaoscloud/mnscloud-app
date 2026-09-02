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
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';

type StorageProvider = 's3' | 'gcs' | 'azure' | 'spaces' | 'sangfor_scp';

type HostingStorageProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: StorageProvider;
  HspConfig?: Record<string, unknown> | null;
  HspIsActive: number;
  HspIsDefault: number;
};

type ApiResponse<T> = {
  data: T;
};

type StorageProviderFormValue = {
  name: string;
  provider: StorageProvider;
  isActive: number;
  isDefault: number;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  projectId: string;
  clientEmail: string;
  privateKey: string;
  accountName: string;
  accountKey: string;
  forcePathStyle: boolean;
  mode: string;
  apiUrl: string;
  apiVersion: string;
  authPath: string;
  validatePath: string;
  resourcePoolId: string;
  storagePoolId: string;
  datastoreId: string;
  verifyTls: boolean;
  timeoutSeconds: string;
  username: string;
  password: string;
  apiToken: string;
  configJson: string;
  credentialsJson: string;
};

@Component({
  selector: 'app-hosting-storage-providers',
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
  templateUrl: './providers.html',
  styleUrls: ['./providers.scss'],
})
export class HostingStorageProvidersPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly providerDialog = viewChild<TemplateRef<unknown>>('providerDialog');
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private dialogBinding: CrudDialogBinding | null = null;
  readonly dataSource = new MatTableDataSource<HostingStorageProvider>([]);

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly endpoint = computed(() =>
    this.isMaster() ? 'system/hosting/storage/providers' : 'hosting/storage/providers',
  );

  readonly saving = signal(false);
  readonly editing = signal<HostingStorageProvider | null>(null);
  readonly selectedProvider = signal<StorageProvider>('s3');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly validatingId = signal<string | null>(null);

  readonly displayedColumns = ['select', 'name', 'provider', 'default', 'status', 'actions'];

  readonly providerOptions: { value: StorageProvider; label: string }[] = [
    { value: 's3', label: 'Amazon S3' },
    { value: 'spaces', label: 'DigitalOcean Spaces' },
    { value: 'gcs', label: 'Google Cloud Storage' },
    { value: 'azure', label: 'Azure Blob Storage' },
    { value: 'sangfor_scp', label: 'Sangfor Technologies SCP/HCI' },
  ];

  readonly filterFormModel = signal({
    search: '',
    provider: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  private readonly providersResource = resource({
    params: () => ({ endpoint: this.endpoint() }),
    defaultValue: [] as HostingStorageProvider[],
    loader: async ({ params }) => {
      const result = await this.api.get<ApiResponse<{ items?: HostingStorageProvider[] }>>(
        params.endpoint,
      );
      return result.data?.items ?? [];
    },
  });

  readonly loading = this.providersResource.isLoading;
  readonly providers = this.providersResource.value;

  private readonly syncTableData = effect(() => {
    this.dataSource.data = this.providers();
    this.pageIndex.set(0);
    this.reconcileSelection();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.providersResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load storage providers.'));
  });

  readonly formModel = signal<StorageProviderFormValue>({
    name: '',
    provider: 's3',
    isActive: 1,
    isDefault: 0,
    region: '',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    projectId: '',
    clientEmail: '',
    privateKey: '',
    accountName: '',
    accountKey: '',
    forcePathStyle: false,
    mode: 'scp_storage',
    apiUrl: '',
    apiVersion: '',
    authPath: '',
    validatePath: '',
    resourcePoolId: '',
    storagePoolId: '',
    datastoreId: '',
    verifyTls: true,
    timeoutSeconds: '',
    username: '',
    password: '',
    apiToken: '',
    configJson: '',
    credentialsJson: '',
  });
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.provider);
  });

  readonly filteredProviders = computed(() => {
    const { search, provider, status } = this.filterFormModel();
    const term = search.trim().toLowerCase();
    const rows = this.providers().filter((item) => {
      const matchesTerm =
        !term || `${item.HspName} ${item.HspProvider}`.toLowerCase().includes(term);
      const matchesProvider = !provider || item.HspProvider === provider;
      const matchesStatus = status === '' || String(item.HspIsActive) === status;
      return matchesTerm && matchesProvider && matchesStatus;
    });
    return this.sortRows(rows);
  });

  readonly pagedProviders = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredProviders().slice(start, start + this.pageSize());
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.destroyRef.onDestroy(() => this.closeDialog());
  }

  refreshList() {
    this.providersResource.reload();
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.reconcileSelection();
  }

  clearFilters() {
    this.filterFormModel.set({ search: '', provider: '', status: '' });
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

  startCreate() {
    this.editing.set(null);
    this.formModel.set({
      name: '',
      provider: 's3',
      isActive: 1,
      isDefault: 0,
      region: '',
      endpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
      projectId: '',
      clientEmail: '',
      privateKey: '',
      accountName: '',
      accountKey: '',
      forcePathStyle: false,
      mode: 'scp_storage',
      apiUrl: '',
      apiVersion: '',
      authPath: '',
      validatePath: '',
      resourcePoolId: '',
      storagePoolId: '',
      datastoreId: '',
      verifyTls: true,
      timeoutSeconds: '',
      username: '',
      password: '',
      apiToken: '',
      configJson: '',
      credentialsJson: '',
    });
    this.selectedProvider.set('s3');
    this.openDialog();
  }

  startEdit(item: HostingStorageProvider) {
    this.editing.set(item);
    const config = this.asRecord(item.HspConfig);
    this.formModel.set({
      name: item.HspName,
      provider: item.HspProvider,
      isActive: item.HspIsActive ? 1 : 0,
      isDefault: item.HspIsDefault ? 1 : 0,
      region: this.stringValue(config['region']),
      endpoint: this.stringValue(config['endpoint']),
      accessKeyId: this.stringValue(config['accessKeyId']),
      secretAccessKey: '',
      projectId: this.stringValue(config['projectId']),
      clientEmail: this.stringValue(config['clientEmail']),
      privateKey: '',
      accountName: this.stringValue(config['accountName']),
      accountKey: '',
      forcePathStyle: this.boolValue(config['forcePathStyle']),
      mode: this.stringValue(config['mode']) || 'scp_storage',
      apiUrl: this.stringValue(config['apiUrl']),
      apiVersion: this.stringValue(config['apiVersion']),
      authPath: this.stringValue(config['authPath']),
      validatePath: this.stringValue(config['validatePath']),
      resourcePoolId: this.stringValue(config['resourcePoolId']),
      storagePoolId: this.stringValue(config['storagePoolId']),
      datastoreId: this.stringValue(config['datastoreId']),
      verifyTls: config['verifyTls'] === undefined ? true : this.boolValue(config['verifyTls']),
      timeoutSeconds: this.stringValue(config['timeoutSeconds']),
      username: '',
      password: '',
      apiToken: '',
      configJson: this.extraJson(config, [
        'region',
        'endpoint',
        'accessKeyId',
        'projectId',
        'clientEmail',
        'accountName',
        'forcePathStyle',
        'mode',
        'apiUrl',
        'apiVersion',
        'authPath',
        'validatePath',
        'resourcePoolId',
        'storagePoolId',
        'datastoreId',
        'verifyTls',
        'timeoutSeconds',
      ]),
      credentialsJson: '',
    });
    this.selectedProvider.set(item.HspProvider);
    this.openDialog();
  }

  private openDialog() {
    const providerDialog = this.providerDialog();
    if (!providerDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, providerDialog, 'crud-dialog-panel', {
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
    if (!this.form().valid()) {
      return;
    }

    const raw = this.formModel();
    let extraConfig: Record<string, unknown> = {};
    let extraCredentials: Record<string, unknown> = {};
    try {
      extraConfig = raw.configJson.trim() ? JSON.parse(raw.configJson) : {};
      extraCredentials = raw.credentialsJson.trim() ? JSON.parse(raw.credentialsJson) : {};
    } catch {
      this.snack.error('Additional config and credentials must be valid JSON.');
      return;
    }

    const config = this.cleanRecord({
      ...extraConfig,
      ...this.providerConfigFromForm(raw.provider, raw),
    });
    const credentials = this.cleanRecord({
      ...extraCredentials,
      ...this.providerCredentialsFromForm(raw.provider, raw),
    });
    if (raw.provider === 'sangfor_scp' && raw.mode === 'scp_storage') {
      const hasToken = !!this.stringValue(credentials['apiToken']);
      const hasAccessKeyPair =
        !!this.stringValue(config['accessKeyId']) &&
        !!this.stringValue(credentials['secretAccessKey']);
      const hasLogin =
        !!this.stringValue(credentials['username']) && !!this.stringValue(credentials['password']);
      if (!this.editing() && !hasToken && !hasAccessKeyPair && !hasLogin) {
        this.snack.warning(
          'Sangfor requires an API token, Access Key/Secret Key, or username/password.',
        );
        return;
      }
    }

    const payload = {
      name: raw.name.trim(),
      provider: raw.provider,
      config,
      credentials,
      isActive: raw.isActive === 1,
      isDefault: Boolean(raw.isDefault),
    };

    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.endpoint()}/${editing.HspUUID}`, payload);
        this.snack.success('Storage provider updated.');
      } else {
        await this.api.post(this.endpoint(), payload);
        this.snack.success('Storage provider created.');
      }
      this.providersResource.reload();
      if (keepOpen && !editing) {
        this.editing.set(null);
        this.formModel.set({
          name: '',
          provider: 's3',
          isActive: 1,
          isDefault: 0,
          region: '',
          endpoint: '',
          accessKeyId: '',
          secretAccessKey: '',
          projectId: '',
          clientEmail: '',
          privateKey: '',
          accountName: '',
          accountKey: '',
          forcePathStyle: false,
          mode: 'scp_storage',
          apiUrl: '',
          apiVersion: '',
          authPath: '',
          validatePath: '',
          resourcePoolId: '',
          storagePoolId: '',
          datastoreId: '',
          verifyTls: true,
          timeoutSeconds: '',
          username: '',
          password: '',
          apiToken: '',
          configJson: '',
          credentialsJson: '',
        });
        this.selectedProvider.set('s3');
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save storage provider.'));
    } finally {
      this.saving.set(false);
    }
  }

  async validateProvider(item: HostingStorageProvider) {
    this.validatingId.set(item.HspUUID);
    try {
      await this.api.post(`${this.endpoint()}/${item.HspUUID}/validate`, {});
      this.snack.success('Storage provider validated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to validate storage provider.'));
    } finally {
      this.validatingId.set(null);
    }
  }

  async deleteProvider(item: HostingStorageProvider) {
    const ok = await this.confirm(`Delete storage provider ${item.HspName}?`);
    if (!ok) return;
    try {
      await this.api.delete(`${this.endpoint()}/${item.HspUUID}`);
      this.snack.success('Storage provider deleted.');
      this.providersResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete storage provider.'));
    }
  }

  async deleteSelectedProviders() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const ok = await this.confirm(`Delete ${ids.length} selected storage provider(s)?`);
    if (!ok) return;
    try {
      const response = await this.api.delete(`${this.endpoint()}/bulk`, { ids });
      const failedIds = this.extractBulkFailedIds(response);
      this.selectedIds.set(new Set(failedIds.filter((id) => ids.includes(id))));
      if (failedIds.length > 0) {
        const deletedCount = ids.length - failedIds.length;
        this.snack.warning(
          `${deletedCount} storage provider(s) deleted; ${failedIds.length} failed.`,
        );
      } else {
        this.snack.success('Selected storage providers deleted.');
      }
      this.providersResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete selected storage providers.'));
    }
  }

  isSelected(row: HostingStorageProvider) {
    return this.selectedIds().has(row.HspUUID);
  }

  toggleSelection(row: HostingStorageProvider, checked: boolean) {
    const next = new Set(this.selectedIds());
    checked ? next.add(row.HspUUID) : next.delete(row.HspUUID);
    this.selectedIds.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.pagedProviders()) {
      checked ? next.add(row.HspUUID) : next.delete(row.HspUUID);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.pagedProviders();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.HspUUID));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedProviders();
    return rows.some((row) => this.selectedIds().has(row.HspUUID)) && !this.isAllVisibleSelected();
  }

  providerLabel(value: string) {
    return this.providerOptions.find((item) => item.value === value)?.label ?? value;
  }

  statusLabel(value: number) {
    return value === 1 ? 'Active' : 'Inactive';
  }

  onProviderChange(provider: StorageProvider) {
    this.selectedProvider.set(provider);
    this.formModel.update((current) => ({ ...current, provider }));
  }

  private providerConfigFromForm(provider: StorageProvider, raw: StorageProviderFormValue) {
    if (provider === 's3' || provider === 'spaces') {
      return {
        region: raw.region,
        endpoint: raw.endpoint,
        accessKeyId: raw.accessKeyId,
        forcePathStyle: raw.forcePathStyle,
      };
    }
    if (provider === 'gcs') {
      return {
        projectId: raw.projectId,
        clientEmail: raw.clientEmail,
      };
    }
    if (provider === 'sangfor_scp') {
      const config: Record<string, unknown> = {
        mode: raw.mode,
        apiUrl: raw.apiUrl,
        apiVersion: raw.apiVersion,
        authPath: raw.authPath,
        validatePath: raw.validatePath,
        resourcePoolId: raw.resourcePoolId,
        storagePoolId: raw.storagePoolId,
        datastoreId: raw.datastoreId,
        accessKeyId: raw.accessKeyId,
        verifyTls: raw.verifyTls,
        timeoutSeconds: raw.timeoutSeconds,
      };
      if (raw.mode === 's3_compatible') {
        config['region'] = raw.region;
        config['endpoint'] = raw.endpoint;
        config['accessKeyId'] = raw.accessKeyId;
        config['forcePathStyle'] = raw.forcePathStyle;
      }
      return config;
    }
    return {
      accountName: raw.accountName,
    };
  }

  private providerCredentialsFromForm(provider: StorageProvider, raw: StorageProviderFormValue) {
    if (provider === 's3' || provider === 'spaces') {
      return { secretAccessKey: raw.secretAccessKey };
    }
    if (provider === 'gcs') {
      return { privateKey: raw.privateKey };
    }
    if (provider === 'sangfor_scp') {
      if (raw.mode === 's3_compatible') {
        return {
          secretAccessKey: raw.secretAccessKey,
          apiToken: raw.apiToken,
          username: raw.username,
          password: raw.password,
        };
      }
      return {
        apiToken: raw.apiToken,
        secretAccessKey: raw.secretAccessKey,
        username: raw.username,
        password: raw.password,
      };
    }
    return { accountKey: raw.accountKey };
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

  private boolValue(value: unknown) {
    return value === true || value === 1 || value === 'true';
  }

  private extraJson(value: Record<string, unknown>, managedKeys: string[]) {
    const extra = Object.fromEntries(
      Object.entries(value).filter(([key]) => !managedKeys.includes(key)),
    );
    return Object.keys(extra).length > 0 ? JSON.stringify(extra, null, 2) : '';
  }

  private sortRows(rows: HostingStorageProvider[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    return [...rows].sort((a, b) => {
      const av = this.sortValue(a, active);
      const bv = this.sortValue(b, active);
      const result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: HostingStorageProvider, column: string) {
    if (column === 'name') return row.HspName ?? '';
    if (column === 'provider') return this.providerLabel(row.HspProvider);
    if (column === 'default') return String(row.HspIsDefault ?? 0);
    if (column === 'status') return this.statusLabel(row.HspIsActive);
    return '';
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.HspUUID));
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
        return this.stringValue(row['HspUUID']);
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
