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

type StorageProvider = 's3' | 'gcs' | 'azure' | 'spaces';

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

@Component({
  selector: 'app-hosting-storage-providers',
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
  templateUrl: './providers.html',
  styleUrls: ['./providers.scss'],
  animations: [fadeIn],
})
export class HostingStorageProvidersPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('providerDialog') providerDialog?: TemplateRef<unknown>;
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private dialogBinding: CrudDialogBinding | null = null;
  private loadingStarted = 0;
  readonly dataSource = new MatTableDataSource<HostingStorageProvider>([]);

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly endpoint = computed(() =>
    this.isMaster() ? 'system/hosting/storage/providers' : 'hosting/storage/providers',
  );

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly providers = signal<HostingStorageProvider[]>([]);
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
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    provider: [''],
    status: [''],
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    provider: ['s3' as StorageProvider, [Validators.required]],
    isActive: [1],
    isDefault: [0],
    region: [''],
    endpoint: [''],
    accessKeyId: [''],
    secretAccessKey: [''],
    projectId: [''],
    clientEmail: [''],
    privateKey: [''],
    accountName: [''],
    accountKey: [''],
    forcePathStyle: [false],
    configJson: [''],
    credentialsJson: [''],
  });

  readonly filteredProviders = computed(() => {
    const { search, provider, status } = this.filterForm.getRawValue();
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

  ngOnInit() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.form.controls.provider.valueChanges.subscribe((provider) => {
      this.selectedProvider.set(provider);
      this.applyProviderValidators(provider);
    });
    this.applyProviderValidators(this.form.controls.provider.value);
    void this.loadItems();
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  refreshList() {
    void this.loadItems();
  }

  async loadItems() {
    this.loadingStarted = performance.now();
    this.loading.set(true);
    try {
      const result = await this.api.get<ApiResponse<HostingStorageProvider[]>>(this.endpoint());
      this.providers.set(Array.isArray(result.data) ? result.data : []);
      this.dataSource.data = this.providers();
      this.pageIndex.set(0);
      this.reconcileSelection();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load storage providers.'));
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
    this.filterForm.reset({ search: '', provider: '', status: '' });
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
    this.form.reset({
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
      configJson: '',
      credentialsJson: '',
    });
    this.selectedProvider.set('s3');
    this.applyProviderValidators('s3');
    this.openDialog();
  }

  startEdit(item: HostingStorageProvider) {
    this.editing.set(item);
    const config = this.asRecord(item.HspConfig);
    this.form.reset({
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
      configJson: this.extraJson(config, [
        'region',
        'endpoint',
        'accessKeyId',
        'projectId',
        'clientEmail',
        'accountName',
        'forcePathStyle',
      ]),
      credentialsJson: '',
    });
    this.selectedProvider.set(item.HspProvider);
    this.applyProviderValidators(item.HspProvider);
    this.openDialog();
  }

  private openDialog() {
    if (!this.providerDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, this.providerDialog, 'crud-dialog-panel', {
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
      await this.loadItems();
      if (keepOpen && !editing) {
        this.editing.set(null);
        this.form.reset({
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
          configJson: '',
          credentialsJson: '',
        });
        this.selectedProvider.set('s3');
        this.applyProviderValidators('s3');
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
      await this.loadItems();
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
      await this.loadItems();
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

  private applyProviderValidators(provider: StorageProvider) {
    const requiredByProvider: Record<StorageProvider, string[]> = {
      s3: ['region', 'accessKeyId', 'secretAccessKey'],
      spaces: ['region', 'accessKeyId', 'secretAccessKey'],
      gcs: ['projectId', 'clientEmail', 'privateKey'],
      azure: ['accountName', 'accountKey'],
    };
    const optionalFields = [
      'region',
      'endpoint',
      'accessKeyId',
      'secretAccessKey',
      'projectId',
      'clientEmail',
      'privateKey',
      'accountName',
      'accountKey',
    ] as const;

    for (const field of optionalFields) {
      const control = this.form.controls[field];
      control.clearValidators();
      if (!this.editing() && requiredByProvider[provider].includes(field)) {
        control.setValidators([Validators.required]);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private providerConfigFromForm(
    provider: StorageProvider,
    raw: ReturnType<typeof this.form.getRawValue>,
  ) {
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
    return {
      accountName: raw.accountName,
    };
  }

  private providerCredentialsFromForm(
    provider: StorageProvider,
    raw: ReturnType<typeof this.form.getRawValue>,
  ) {
    if (provider === 's3' || provider === 'spaces') {
      return { secretAccessKey: raw.secretAccessKey };
    }
    if (provider === 'gcs') {
      return { privateKey: raw.privateKey };
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
    const valid = new Set(this.providers().map((row) => row.HspUUID));
    this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => valid.has(id))));
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
