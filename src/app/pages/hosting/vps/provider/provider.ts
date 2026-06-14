import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { getVpsDialogViewportConfig, updateVpsDialogViewport } from '../vps-dialog-viewport';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import type {
  HostingVpsProvider,
  VpsProvider,
  VpsProviderConfig,
  VpsProviderCredentials,
} from '../vps.types';

@Component({
  selector: 'app-hosting-vps-provider',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
  templateUrl: './provider.html',
  styleUrls: ['./provider.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingVpsProviderPage {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly providerFormDialog = viewChild<TemplateRef<unknown>>('providerFormDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly providerEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/providers' : 'hosting/vps/providers',
  );

  readonly providers = signal<HostingVpsProvider[]>([]);
  readonly appliedSearch = signal('');
  readonly appliedStatus = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly rows = computed(() => {
    const search = this.appliedSearch().trim().toLowerCase();
    const status = this.appliedStatus();
    return this.providers().filter((item) => {
      const searchableConfig = [
        this.providerConfigValue(item, 'region'),
        this.providerConfigValue(item, 'projectId'),
        this.providerConfigValue(item, 'apiUrl'),
        this.providerConfigValue(item, 'vcenterUrl'),
        this.providerConfigValue(item, 'resourcePoolId'),
      ].map((value) => String(value ?? '').toLowerCase());
      const matchesSearch =
        !search ||
        item.HvrName.toLowerCase().includes(search) ||
        this.providerLabel(item.HvrProvider).toLowerCase().includes(search) ||
        searchableConfig.some((value) => value.includes(search));
      const matchesStatus =
        status === '' ||
        (status === '1' && item.HvrIsActive === 1) ||
        (status === '0' && item.HvrIsActive !== 1);
      return matchesSearch && matchesStatus;
    });
  });
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  readonly saving = signal(false);
  readonly validatingProviderId = signal<string | null>(null);
  readonly editing = signal<HostingVpsProvider | null>(null);
  readonly providerSelection = signal<VpsProvider>('digitalocean');
  readonly hideApiToken = signal(true);
  readonly hideSecretAccessKey = signal(true);
  readonly hideTokenSecret = signal(true);
  readonly hidePassword = signal(true);
  readonly selectedProviderUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedProviderUUIDs().size);

  readonly displayedColumns = [
    'select',
    'name',
    'provider',
    'region',
    'default',
    'status',
    'actions',
  ];
  readonly providerOptions: { value: VpsProvider; label: string }[] = [
    { value: 'digitalocean', label: 'DigitalOcean Droplets' },
    { value: 'lightsail', label: 'Amazon Lightsail' },
    { value: 'proxmox', label: 'Proxmox VE' },
    { value: 'vmware_vcenter', label: 'VMware vCenter' },
    { value: 'sangfor_scp', label: 'Sangfor Technologies SCP/HCI' },
  ];

  readonly filterFormModel = signal({
    search: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly providerFormModel = signal({
    name: '',
    provider: 'digitalocean' as VpsProvider,
    region: '',
    projectId: '',
    accessKeyId: '',
    apiUrl: '',
    node: '',
    storage: '',
    bridge: '',
    templateVmid: '',
    vcenterUrl: '',
    datacenter: '',
    cluster: '',
    resourcePool: '',
    folder: '',
    datastore: '',
    network: '',
    templateVm: '',
    templateVmId: '',
    customizationSpec: '',
    apiVersion: '',
    authPath: '',
    validatePath: '',
    resourcePoolId: '',
    clusterId: '',
    networkId: '',
    datastoreId: '',
    storagePoolId: '',
    imageId: '',
    timeoutSeconds: '',
    catalogRegionsPath: '',
    catalogSizesPath: '',
    catalogImagesPath: '',
    apiToken: '',
    secretAccessKey: '',
    tokenId: '',
    tokenSecret: '',
    username: '',
    password: '',
    isActive: 1,
    isDefault: 0,
  });
  readonly providerForm = createForm(this.providerFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.provider);
    required(schema.isActive);
    required(schema.isDefault);
  });

  private readonly providersResource = resource({
    params: () => ({
      search: this.appliedSearch(),
      status: this.appliedStatus(),
      endpoint: this.providerEndpoint(),
    }),
    defaultValue: [] as HostingVpsProvider[],
    loader: async ({ params }) => {
      const search = params.search.trim();
      const query = new URLSearchParams({ limit: '500', offset: '0' });
      if (search) query.set('search', search);
      if (params.status === '0' || params.status === '1') query.set('status', params.status);
      const result = await this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        `${params.endpoint}?${query.toString()}`,
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      return list.map((item) => ({
        ...item,
        HvrConfig: this.parseConfig<VpsProviderConfig>(item.HvrConfig),
      })) as HostingVpsProvider[];
    },
  });
  readonly loading = this.providersResource.isLoading;
  private readonly syncProviders = effect(() => {
    this.providers.set(this.providersResource.value());
    this.reconcileProviderSelection();
  });
  private readonly reportLoadError = effect(() => {
    const error = this.providersResource.error();
    if (!error) return;
    this.snack.error(this.friendlyError(error, 'Failed to load VPS providers.'));
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeDialog();
      this.stopDialogViewportObserver();
    });
  }

  refreshList() {
    this.providersResource.reload();
  }

  applyFilters() {
    const values = this.filterFormModel();
    this.appliedSearch.set(values.search);
    this.appliedStatus.set(values.status);
    this.resetPagination();
  }

  clearFilters() {
    this.filterFormModel.set({ search: '', status: '' });
    this.applyFilters();
  }

  providerLabel(provider: VpsProvider) {
    return this.providerOptions.find((opt) => opt.value === provider)?.label ?? provider;
  }

  statusLabel(item: HostingVpsProvider) {
    return item.HvrIsActive === 1 ? 'Active' : 'Inactive';
  }

  providerIsDefault(item: HostingVpsProvider) {
    return item.HvrIsDefault === 1;
  }

  providerConfigValue(item: HostingVpsProvider, key: keyof VpsProviderConfig) {
    const config = item.HvrConfig ?? {};
    return config?.[key] ?? null;
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.resetPagination();
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  async startEdit(item: HostingVpsProvider) {
    let providerRecord = item;
    try {
      const result = await this.api.get<{ data?: { item?: HostingVpsProvider | null } }>(
        `${this.providerEndpoint()}/${item.HvrUUID}`,
      );
      const detail = result?.data?.item;
      if (detail) {
        providerRecord = {
          ...detail,
          HvrConfig: this.parseConfig<VpsProviderConfig>(detail.HvrConfig),
        };
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load provider credentials.'));
    }

    const config = providerRecord.HvrConfig ?? {};
    const credentials = providerRecord.credentials ?? {};
    this.editing.set(providerRecord);
    this.providerFormModel.set({
      name: providerRecord.HvrName,
      provider: providerRecord.HvrProvider,
      region: config.region ?? '',
      projectId: config.projectId ?? '',
      accessKeyId: config.accessKeyId ?? '',
      apiUrl: config.apiUrl ?? '',
      node: config.node ?? '',
      storage: config.storage ?? '',
      bridge: config.bridge ?? '',
      templateVmid: config.templateVmid === undefined ? '' : String(config.templateVmid),
      vcenterUrl: config.vcenterUrl ?? '',
      datacenter: config.datacenter ?? '',
      cluster: config.cluster ?? '',
      resourcePool: config.resourcePool ?? '',
      folder: config.folder ?? '',
      datastore: config.datastore ?? '',
      network: config.network ?? '',
      templateVm: config.templateVm ?? '',
      templateVmId: config.templateVmId ?? '',
      customizationSpec: config.customizationSpec ?? '',
      apiVersion: config.apiVersion ?? '',
      authPath: config.authPath ?? '',
      validatePath: config.validatePath ?? '',
      resourcePoolId: config.resourcePoolId ?? '',
      clusterId: config.clusterId ?? '',
      networkId: config.networkId ?? '',
      datastoreId: config.datastoreId ?? '',
      storagePoolId: config.storagePoolId ?? '',
      imageId: config.imageId ?? '',
      timeoutSeconds: config.timeoutSeconds === undefined ? '' : String(config.timeoutSeconds),
      catalogRegionsPath: config.catalogPaths?.regions ?? '',
      catalogSizesPath: config.catalogPaths?.sizes ?? '',
      catalogImagesPath: config.catalogPaths?.images ?? '',
      apiToken: credentials.apiToken ?? '',
      secretAccessKey: credentials.secretAccessKey ?? '',
      tokenId: credentials.tokenId ?? '',
      tokenSecret: credentials.tokenSecret ?? '',
      username: credentials.username ?? '',
      password: credentials.password ?? '',
      isActive: providerRecord.HvrIsActive === 1 ? 1 : 0,
      isDefault: providerRecord.HvrIsDefault === 1 ? 1 : 0,
    });
    this.providerSelection.set(providerRecord.HvrProvider);
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    if (!this.providerFormIsValid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const values = this.providerFormModel();
    const credentials = this.buildCredentialsPayload();
    if (!this.editing() && !credentials) {
      this.snack.warning('Credentials are required for new providers.');
      return;
    }
    if (values.provider === 'sangfor_scp') {
      const hasToken = !!this.normalizeString(values.apiToken);
      const hasAccessKeyPair =
        !!this.normalizeString(values.accessKeyId) &&
        !!this.normalizeString(values.secretAccessKey);
      const hasLogin =
        !!this.normalizeString(values.username) && !!this.normalizeString(values.password);
      if (!this.editing() && !hasToken && !hasAccessKeyPair && !hasLogin) {
        this.snack.warning(
          'Sangfor requires an API token, Access Key/Secret Key, or username/password.',
        );
        return;
      }
    }

    this.saving.set(true);
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      provider: values.provider,
      config: this.buildConfigPayload(),
      isActive: values.isActive === 1,
      isDefault: values.isDefault === 1,
    };
    if (credentials) payload['credentials'] = credentials;

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.providerEndpoint()}/${editing.HvrUUID}`, payload);
        this.snack.success('Provider providerRecord updated.');
      } else {
        await this.api.post(this.providerEndpoint(), payload);
        this.snack.success('Provider providerRecord created.');
      }
      this.providersResource.reload();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save provider.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async remove(item: HostingVpsProvider) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete provider',
        message: `Are you sure you want to delete "${item.HvrName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.providerEndpoint()}/${item.HvrUUID}`);
      this.snack.success('Provider providerRecord deleted.');
      this.providersResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete provider.'));
    }
  }

  isSelected(item: HostingVpsProvider) {
    return this.selectedProviderUUIDs().has(item.HvrUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleProviderSelection(item: HostingVpsProvider, checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item.HvrUUID);
      } else {
        next.delete(item.HvrUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        if (checked) {
          next.add(row.HvrUUID);
        } else {
          next.delete(row.HvrUUID);
        }
      }
      return next;
    });
  }

  async removeSelectedProviders() {
    const ids = Array.from(this.selectedProviderUUIDs());
    if (!ids.length) return;
    const labels = this.providers()
      .filter((item) => ids.includes(item.HvrUUID))
      .slice(0, 3)
      .map((item) => item.HvrName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected providers',
        message: `Are you sure you want to delete ${ids.length} selected provider(s)?${suffix}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const response = await this.api.delete<{
        data?: {
          deleted?: string[];
          failed?: { HostingVpsProviderUUID: string; message: string }[];
        };
      }>(`${this.providerEndpoint()}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingVpsProviderUUID),
      );
      this.providers.update((rows) => rows.filter((row) => !deleted.has(row.HvrUUID)));
      this.selectedProviderUUIDs.set(failed);
      this.providersResource.reload();
      if (failed.size) {
        this.snack.error(`${failed.size} provider(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} provider(s) deleted.`);
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected providers.'));
    }
  }

  async validateProvider(item: HostingVpsProvider) {
    this.validatingProviderId.set(item.HvrUUID);
    try {
      await this.api.post(`${this.providerEndpoint()}/${item.HvrUUID}/validate`, {});
      this.snack.success(`${this.providerLabel(item.HvrProvider)} provider tested successfully.`);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to test provider.'));
    } finally {
      this.validatingProviderId.set(null);
    }
  }

  toggleSecret(
    event: MouseEvent,
    target: 'apiToken' | 'secretAccessKey' | 'tokenSecret' | 'password',
  ) {
    event.stopPropagation();
    if (target === 'apiToken') {
      this.hideApiToken.set(!this.hideApiToken());
      return;
    }
    if (target === 'secretAccessKey') {
      this.hideSecretAccessKey.set(!this.hideSecretAccessKey());
      return;
    }
    if (target === 'tokenSecret') {
      this.hideTokenSecret.set(!this.hideTokenSecret());
      return;
    }
    this.hidePassword.set(!this.hidePassword());
  }

  private normalizeString(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private parseConfig<T>(value: unknown): T | null {
    if (!value) return null;
    if (typeof value === 'object') return value as T;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null;
    } catch {
      return null;
    }
  }

  private providerFormIsValid() {
    if (!this.providerForm().valid()) return false;
    const values = this.providerFormModel();
    const isEditing = !!this.editing();
    if (values.provider === 'digitalocean') {
      return isEditing || !!this.normalizeString(values.apiToken);
    }
    if (values.provider === 'lightsail') {
      return (
        !!this.normalizeString(values.region) &&
        !!this.normalizeString(values.accessKeyId) &&
        (isEditing || !!this.normalizeString(values.secretAccessKey))
      );
    }
    if (values.provider === 'proxmox') {
      return (
        !!this.normalizeString(values.apiUrl) &&
        (isEditing ||
          (!!this.normalizeString(values.tokenId) && !!this.normalizeString(values.tokenSecret)))
      );
    }
    if (values.provider === 'vmware_vcenter') {
      return (
        !!this.normalizeString(values.vcenterUrl) &&
        (isEditing ||
          (!!this.normalizeString(values.username) && !!this.normalizeString(values.password)))
      );
    }
    if (values.provider === 'sangfor_scp') {
      return !!this.normalizeString(values.apiUrl);
    }
    return true;
  }

  private resetForm() {
    this.providerFormModel.set({
      name: '',
      provider: 'digitalocean',
      region: '',
      projectId: '',
      accessKeyId: '',
      apiUrl: '',
      node: '',
      storage: '',
      bridge: '',
      templateVmid: '',
      vcenterUrl: '',
      datacenter: '',
      cluster: '',
      resourcePool: '',
      folder: '',
      datastore: '',
      network: '',
      templateVm: '',
      templateVmId: '',
      customizationSpec: '',
      apiVersion: '',
      authPath: '',
      validatePath: '',
      resourcePoolId: '',
      clusterId: '',
      networkId: '',
      datastoreId: '',
      storagePoolId: '',
      imageId: '',
      timeoutSeconds: '',
      catalogRegionsPath: '',
      catalogSizesPath: '',
      catalogImagesPath: '',
      apiToken: '',
      secretAccessKey: '',
      tokenId: '',
      tokenSecret: '',
      username: '',
      password: '',
      isActive: 1,
      isDefault: 0,
    });
    this.providerSelection.set('digitalocean');
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcileProviderSelection() {
    const available = new Set(this.providers().map((item) => item.HvrUUID));
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingVpsProvider[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    return [...rows].sort((a, b) => {
      const compared = this.compareValues(
        this.providerSortValue(a, active),
        this.providerSortValue(b, active),
      );
      return direction === 'asc' ? compared : -compared;
    });
  }

  private providerSortValue(item: HostingVpsProvider, column: string) {
    switch (column) {
      case 'name':
        return item.HvrName;
      case 'provider':
        return this.providerLabel(item.HvrProvider);
      case 'region':
        return String(
          this.providerConfigValue(item, 'region') ??
            this.providerConfigValue(item, 'apiUrl') ??
            this.providerConfigValue(item, 'vcenterUrl') ??
            this.providerConfigValue(item, 'resourcePoolId') ??
            this.providerConfigValue(item, 'projectId') ??
            '',
        );
      case 'default':
        return item.HvrIsDefault;
      case 'status':
        return item.HvrIsActive;
      default:
        return '';
    }
  }

  private compareValues(
    a: string | number | null | undefined,
    b: string | number | null | undefined,
  ) {
    const left = a ?? '';
    const right = b ?? '';
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private buildConfigPayload(): VpsProviderConfig {
    const values = this.providerFormModel();
    const config: VpsProviderConfig = {};
    const region = this.normalizeString(values.region);
    const projectId = this.normalizeString(values.projectId);
    const accessKeyId = this.normalizeString(values.accessKeyId);
    const apiUrl = this.normalizeString(values.apiUrl);
    const node = this.normalizeString(values.node);
    const storage = this.normalizeString(values.storage);
    const bridge = this.normalizeString(values.bridge);
    const templateVmid = this.normalizeString(values.templateVmid);
    const vcenterUrl = this.normalizeString(values.vcenterUrl);
    const datacenter = this.normalizeString(values.datacenter);
    const cluster = this.normalizeString(values.cluster);
    const resourcePool = this.normalizeString(values.resourcePool);
    const folder = this.normalizeString(values.folder);
    const datastore = this.normalizeString(values.datastore);
    const network = this.normalizeString(values.network);
    const templateVm = this.normalizeString(values.templateVm);
    const templateVmId = this.normalizeString(values.templateVmId);
    const customizationSpec = this.normalizeString(values.customizationSpec);
    const apiVersion = this.normalizeString(values.apiVersion);
    const authPath = this.normalizeString(values.authPath);
    const validatePath = this.normalizeString(values.validatePath);
    const resourcePoolId = this.normalizeString(values.resourcePoolId);
    const clusterId = this.normalizeString(values.clusterId);
    const networkId = this.normalizeString(values.networkId);
    const datastoreId = this.normalizeString(values.datastoreId);
    const storagePoolId = this.normalizeString(values.storagePoolId);
    const imageId = this.normalizeString(values.imageId);
    const timeoutSeconds = this.normalizeString(values.timeoutSeconds);
    const catalogRegionsPath = this.normalizeString(values.catalogRegionsPath);
    const catalogSizesPath = this.normalizeString(values.catalogSizesPath);
    const catalogImagesPath = this.normalizeString(values.catalogImagesPath);
    if (region) config.region = region;
    if (projectId) config.projectId = projectId;
    if (accessKeyId) config.accessKeyId = accessKeyId;
    if (apiUrl) config.apiUrl = apiUrl;
    if (node) config.node = node;
    if (storage) config.storage = storage;
    if (bridge) config.bridge = bridge;
    if (templateVmid) config.templateVmid = templateVmid;
    if (vcenterUrl) config.vcenterUrl = vcenterUrl;
    if (datacenter) config.datacenter = datacenter;
    if (cluster) config.cluster = cluster;
    if (resourcePool) config.resourcePool = resourcePool;
    if (folder) config.folder = folder;
    if (datastore) config.datastore = datastore;
    if (network) config.network = network;
    if (templateVm) config.templateVm = templateVm;
    if (templateVmId) config.templateVmId = templateVmId;
    if (customizationSpec) config.customizationSpec = customizationSpec;
    if (apiVersion) config.apiVersion = apiVersion;
    if (authPath) config.authPath = authPath;
    if (validatePath) config.validatePath = validatePath;
    if (resourcePoolId) config.resourcePoolId = resourcePoolId;
    if (clusterId) config.clusterId = clusterId;
    if (networkId) config.networkId = networkId;
    if (datastoreId) config.datastoreId = datastoreId;
    if (storagePoolId) config.storagePoolId = storagePoolId;
    if (imageId) config.imageId = imageId;
    if (timeoutSeconds) config.timeoutSeconds = timeoutSeconds;
    const catalogPaths = {
      regions: catalogRegionsPath,
      sizes: catalogSizesPath,
      images: catalogImagesPath,
    };
    if (Object.values(catalogPaths).some(Boolean)) config.catalogPaths = catalogPaths;
    return config;
  }

  private buildCredentialsPayload(): VpsProviderCredentials | null {
    const values = this.providerFormModel();
    const credentials: VpsProviderCredentials = {};
    const apiToken = this.normalizeString(values.apiToken);
    const secretAccessKey = this.normalizeString(values.secretAccessKey);
    const tokenId = this.normalizeString(values.tokenId);
    const tokenSecret = this.normalizeString(values.tokenSecret);
    const username = this.normalizeString(values.username);
    const password = this.normalizeString(values.password);
    if (apiToken) credentials.apiToken = apiToken;
    if (secretAccessKey) credentials.secretAccessKey = secretAccessKey;
    if (tokenId) credentials.tokenId = tokenId;
    if (tokenSecret) credentials.tokenSecret = tokenSecret;
    if (username) credentials.username = username;
    if (password) credentials.password = password;
    return Object.keys(credentials).length ? credentials : null;
  }

  private friendlyError(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.error || error.error?.message;
      return typeof serverMessage === 'string' && serverMessage.trim().length
        ? serverMessage
        : error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }

  private openDialog() {
    const providerFormDialog = this.providerFormDialog();
    if (!providerFormDialog || this.dialogRef) return;
    this.dialogRef = this.dialog.open(providerFormDialog, {
      ...getVpsDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-vps-provider-dialog',
    });
    this.dialogRef
      .keydownEvents()
      .pipe(takeUntil(this.dialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelForm();
      });
    this.startDialogViewportObserver();
    this.dialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.dialogRef = null;
    });
  }

  private closeDialog() {
    if (!this.dialogRef) return;
    this.stopDialogViewportObserver();
    this.dialogRef.close();
    this.dialogRef = null;
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.dialogRef) return;
    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;
    this.dialogViewportObserver = new ResizeObserver(() => {
      if (this.dialogRef) updateVpsDialogViewport(this.dialogRef);
    });
    this.dialogViewportObserver.observe(pageContent);
    updateVpsDialogViewport(this.dialogRef);
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }
}
