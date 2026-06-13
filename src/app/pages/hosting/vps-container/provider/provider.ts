import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  getVpsDialogViewportConfig,
  updateVpsDialogViewport,
} from '../vps-container-dialog-viewport';
import type {
  HostingVpsContainerProvider,
  VpsContainerProvider,
  VpsContainerProviderConfig,
  VpsContainerProviderCredentials,
} from '../vps-container.types';

@Component({
  selector: 'app-hosting-vps-container-provider',
  standalone: true,
  imports: [
    RefreshButtonComponent,
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
  templateUrl: './provider.html',
  styleUrls: ['./provider.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingVpsContainerProviderPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
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
    this.isMaster() ? 'system/hosting/vps-container/providers' : 'hosting/vps-container/providers',
  );

  readonly providers = signal<HostingVpsContainerProvider[]>([]);
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
        this.providerConfigValue(item, 'apiUrl'),
        this.providerConfigValue(item, 'project'),
        this.providerConfigValue(item, 'target'),
        this.providerConfigValue(item, 'network'),
      ].map((value) => String(value ?? '').toLowerCase());
      const matchesSearch =
        !search ||
        item.HcpName.toLowerCase().includes(search) ||
        this.providerLabel(item.HcpProvider).toLowerCase().includes(search) ||
        searchableConfig.some((value) => value.includes(search));
      const matchesStatus =
        status === '' ||
        (status === '1' && item.HcpIsActive === 1) ||
        (status === '0' && item.HcpIsActive !== 1);
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
  readonly editing = signal<HostingVpsContainerProvider | null>(null);
  readonly providerSelection = signal<VpsContainerProvider>('incus');
  readonly hideBearerToken = signal(true);
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
  readonly providerOptions: { value: VpsContainerProvider; label: string }[] = [
    { value: 'incus', label: 'Incus' },
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
  });

  readonly providerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    provider: ['incus' as VpsContainerProvider, [Validators.required]],
    apiUrl: [''],
    project: ['default'],
    target: [''],
    storagePool: [''],
    network: [''],
    profile: ['default'],
    remote: ['https://images.linuxcontainers.org'],
    imageAlias: [''],
    bearerToken: [''],
    clientCertificate: [''],
    clientPrivateKey: [''],
    serverCertificate: [''],
    isActive: [1, [Validators.required]],
    isDefault: [0, [Validators.required]],
  });

  private readonly providersResource = resource({
    params: () => ({
      search: this.appliedSearch(),
      status: this.appliedStatus(),
      endpoint: this.providerEndpoint(),
    }),
    defaultValue: [] as HostingVpsContainerProvider[],
    loader: async ({ params }) => {
      const search = params.search.trim();
      const query = new URLSearchParams({ limit: '500', offset: '0' });
      if (search) query.set('search', search);
      if (params.status === '0' || params.status === '1') query.set('status', params.status);
      const result = await this.api.get<{
        data?: { items?: HostingVpsContainerProvider[] };
      }>(`${params.endpoint}?${query.toString()}`);
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      return list.map((item) => ({
        ...item,
        HcpConfig: this.parseConfig<VpsContainerProviderConfig>(item.HcpConfig),
      })) as HostingVpsContainerProvider[];
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
    this.snack.error(this.friendlyError(error, 'Failed to load VPS Container providers.'));
  });

  constructor() {
    this.applyProviderValidators(this.providerSelection(), false);
    this.providerForm.controls.provider.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value) return;
        this.providerSelection.set(value);
        this.applyProviderValidators(value, !!this.editing());
      });
  }

  ngOnDestroy() {
    this.closeDialog();
    this.stopDialogViewportObserver();
  }

  refreshList() {
    this.providersResource.reload();
  }

  applyFilters() {
    const values = this.filterForm.getRawValue();
    this.appliedSearch.set(values.search);
    this.appliedStatus.set(values.status);
    this.resetPagination();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', status: '' });
    this.applyFilters();
  }

  providerLabel(provider: VpsContainerProvider) {
    return this.providerOptions.find((opt) => opt.value === provider)?.label ?? provider;
  }

  statusLabel(item: HostingVpsContainerProvider) {
    return item.HcpIsActive === 1 ? 'Active' : 'Inactive';
  }

  providerIsDefault(item: HostingVpsContainerProvider) {
    return item.HcpIsDefault === 1;
  }

  providerConfigValue(item: HostingVpsContainerProvider, key: keyof VpsContainerProviderConfig) {
    const config = item.HcpConfig ?? {};
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

  async startEdit(item: HostingVpsContainerProvider) {
    let providerRecord = item;
    try {
      const result = await this.api.get<{ data?: { item?: HostingVpsContainerProvider | null } }>(
        `${this.providerEndpoint()}/${item.HcpUUID}`,
      );
      const detail = result?.data?.item;
      if (detail) {
        providerRecord = {
          ...detail,
          HcpConfig: this.parseConfig<VpsContainerProviderConfig>(detail.HcpConfig),
        };
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load provider credentials.'));
    }

    const config = providerRecord.HcpConfig ?? {};
    const credentials = providerRecord.credentials ?? {};
    this.editing.set(providerRecord);
    this.providerForm.reset({
      name: providerRecord.HcpName,
      provider: providerRecord.HcpProvider,
      apiUrl: config.apiUrl ?? '',
      project: config.project ?? 'default',
      target: config.target ?? '',
      storagePool: config.storagePool ?? '',
      network: config.network ?? '',
      profile: config.profile ?? 'default',
      remote: config.remote ?? 'https://images.linuxcontainers.org',
      imageAlias: config.imageAlias ?? '',
      bearerToken: credentials.bearerToken ?? '',
      clientCertificate: credentials.clientCertificate ?? '',
      clientPrivateKey: credentials.clientPrivateKey ?? '',
      serverCertificate: credentials.serverCertificate ?? '',
      isActive: providerRecord.HcpIsActive === 1 ? 1 : 0,
      isDefault: providerRecord.HcpIsDefault === 1 ? 1 : 0,
    });
    this.providerSelection.set(providerRecord.HcpProvider);
    this.applyProviderValidators(providerRecord.HcpProvider, true);
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    if (this.providerForm.invalid) {
      this.providerForm.markAllAsTouched();
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const values = this.providerForm.getRawValue();
    const credentials = this.buildCredentialsPayload();
    if (!this.editing() && !credentials) {
      this.snack.warning('Credentials are required for new providers.');
      return;
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
        await this.api.put(`${this.providerEndpoint()}/${editing.HcpUUID}`, payload);
        this.snack.success('Provider updated.');
      } else {
        await this.api.post(this.providerEndpoint(), payload);
        this.snack.success('Provider created.');
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

  async remove(item: HostingVpsContainerProvider) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete provider',
        message: `Are you sure you want to delete "${item.HcpName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.providerEndpoint()}/${item.HcpUUID}`);
      this.snack.success('Provider deleted.');
      this.providersResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete provider.'));
    }
  }

  isSelected(item: HostingVpsContainerProvider) {
    return this.selectedProviderUUIDs().has(item.HcpUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleProviderSelection(item: HostingVpsContainerProvider, checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item.HcpUUID);
      } else {
        next.delete(item.HcpUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        if (checked) {
          next.add(row.HcpUUID);
        } else {
          next.delete(row.HcpUUID);
        }
      }
      return next;
    });
  }

  async removeSelectedProviders() {
    const ids = Array.from(this.selectedProviderUUIDs());
    if (!ids.length) return;
    const labels = this.providers()
      .filter((item) => ids.includes(item.HcpUUID))
      .slice(0, 3)
      .map((item) => item.HcpName);
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
          failed?: { HostingVpsContainerProviderUUID: string; message: string }[];
        };
      }>(`${this.providerEndpoint()}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingVpsContainerProviderUUID),
      );
      this.providers.update((rows) => rows.filter((row) => !deleted.has(row.HcpUUID)));
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

  async validateProvider(item: HostingVpsContainerProvider) {
    this.validatingProviderId.set(item.HcpUUID);
    try {
      await this.api.post(`${this.providerEndpoint()}/${item.HcpUUID}/validate`, {});
      this.snack.success(`${this.providerLabel(item.HcpProvider)} provider tested successfully.`);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to test provider.'));
    } finally {
      this.validatingProviderId.set(null);
    }
  }

  toggleSecret(event: MouseEvent) {
    event.stopPropagation();
    this.hideBearerToken.set(!this.hideBearerToken());
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

  private applyProviderValidators(_provider: VpsContainerProvider, _isEditing = false) {
    const controls = this.providerForm.controls;
    controls.apiUrl.clearValidators();
    controls.bearerToken.clearValidators();
    controls.clientCertificate.clearValidators();
    controls.clientPrivateKey.clearValidators();
    controls.apiUrl.setValidators([Validators.required]);
    for (const control of Object.values(controls)) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private resetForm() {
    this.providerForm.reset({
      name: '',
      provider: 'incus',
      apiUrl: '',
      project: 'default',
      target: '',
      storagePool: '',
      network: '',
      profile: 'default',
      remote: 'https://images.linuxcontainers.org',
      imageAlias: '',
      bearerToken: '',
      clientCertificate: '',
      clientPrivateKey: '',
      serverCertificate: '',
      isActive: 1,
      isDefault: 0,
    });
    this.providerSelection.set('incus');
    this.applyProviderValidators('incus', false);
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcileProviderSelection() {
    const available = new Set(this.providers().map((item) => item.HcpUUID));
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingVpsContainerProvider[]) {
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

  private providerSortValue(item: HostingVpsContainerProvider, column: string) {
    switch (column) {
      case 'name':
        return item.HcpName;
      case 'provider':
        return this.providerLabel(item.HcpProvider);
      case 'region':
        return String(
          this.providerConfigValue(item, 'project') ??
            this.providerConfigValue(item, 'apiUrl') ??
            '',
        );
      case 'default':
        return item.HcpIsDefault;
      case 'status':
        return item.HcpIsActive;
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

  private buildConfigPayload(): VpsContainerProviderConfig {
    const values = this.providerForm.getRawValue();
    const config: VpsContainerProviderConfig = {};
    const apiUrl = this.normalizeString(values.apiUrl);
    const project = this.normalizeString(values.project);
    const target = this.normalizeString(values.target);
    const storagePool = this.normalizeString(values.storagePool);
    const network = this.normalizeString(values.network);
    const profile = this.normalizeString(values.profile);
    const remote = this.normalizeString(values.remote);
    const imageAlias = this.normalizeString(values.imageAlias);
    if (apiUrl) config.apiUrl = apiUrl;
    if (project) config.project = project;
    if (target) config.target = target;
    if (storagePool) config.storagePool = storagePool;
    if (network) config.network = network;
    if (profile) config.profile = profile;
    if (remote) config.remote = remote;
    if (imageAlias) config.imageAlias = imageAlias;
    return config;
  }

  private buildCredentialsPayload(): VpsContainerProviderCredentials | null {
    const values = this.providerForm.getRawValue();
    const credentials: VpsContainerProviderCredentials = {};
    const bearerToken = this.normalizeString(values.bearerToken);
    const clientCertificate = this.normalizeString(values.clientCertificate);
    const clientPrivateKey = this.normalizeString(values.clientPrivateKey);
    const serverCertificate = this.normalizeString(values.serverCertificate);
    if (bearerToken) credentials.bearerToken = bearerToken;
    if (clientCertificate) credentials.clientCertificate = clientCertificate;
    if (clientPrivateKey) credentials.clientPrivateKey = clientPrivateKey;
    if (serverCertificate) credentials.serverCertificate = serverCertificate;
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
      panelClass: 'hosting-vps-container-provider-dialog',
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
