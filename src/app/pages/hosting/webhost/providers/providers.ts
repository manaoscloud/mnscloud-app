import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import {
  getWebhostDialogViewportConfig,
  updateWebhostDialogViewport,
} from '../webhost-dialog-viewport';
import type {
  HostingWebhostProvider,
  WebhostProviderConfig,
  WebhostProviderCredentials,
  WebhostProviderType,
} from '../webhost.types';

@Component({
  selector: 'app-hosting-webhost-providers',
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
    TranslatePipe,
    MatTooltipModule,
  ],
  templateUrl: './providers.html',
  styleUrls: ['./providers.scss'],
  animations: [fadeIn],
})
export class HostingWebhostProvidersPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  @ViewChild('providerFormDialog') providerFormDialog?: TemplateRef<unknown>;

  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly providerEndpoint = 'hosting/webhost/providers';
  readonly providers = signal<HostingWebhostProvider[]>([]);
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
      const config = item.HwpConfig ?? {};
      const credentials = item.credentials ?? {};
      const matchesSearch =
        !search ||
        item.HwpName.toLowerCase().includes(search) ||
        this.providerLabel(item.HwpProvider).toLowerCase().includes(search) ||
        (config.hostname ?? '').toLowerCase().includes(search) ||
        (credentials.username ?? '').toLowerCase().includes(search);
      const matchesStatus =
        status === '' ||
        (status === '1' && item.HwpIsActive === 1) ||
        (status === '0' && item.HwpIsActive !== 1);
      return matchesSearch && matchesStatus;
    });
  });
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly validatingProviderId = signal<string | null>(null);
  readonly editing = signal<HostingWebhostProvider | null>(null);
  readonly hideApiToken = signal(true);
  readonly selectedProviderUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedProviderUUIDs().size);

  readonly displayedColumns = [
    'select',
    'name',
    'provider',
    'host',
    'username',
    'default',
    'status',
    'actions',
  ];
  readonly providerOptions: { value: WebhostProviderType; label: string }[] = [
    { value: 'cpanel_whm', label: 'cPanel/WHM' },
    { value: 'plesk', label: 'Plesk' },
    { value: 'directadmin', label: 'DirectAdmin' },
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
  });

  readonly providerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    provider: ['cpanel_whm' as WebhostProviderType, [Validators.required]],
    hostname: ['', [Validators.required]],
    port: [2087, [Validators.required, Validators.min(1), Validators.max(65535)]],
    username: ['', [Validators.required]],
    apiToken: [''],
    sslVerify: [1, [Validators.required]],
    notes: [''],
    isActive: [1, [Validators.required]],
    isDefault: [0, [Validators.required]],
  });

  constructor() {
    this.applyTokenValidators(false);
    this.refreshList();
  }

  ngOnDestroy() {
    this.closeDialog();
    this.stopDialogViewportObserver();
  }

  refreshList() {
    void this.loadProviders();
  }

  applyFilters() {
    const values = this.filterForm.getRawValue();
    this.appliedSearch.set(values.search);
    this.appliedStatus.set(values.status);
    this.resetPagination();
    void this.loadProviders();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', status: '' });
    this.applyFilters();
  }

  providerLabel(provider: WebhostProviderType) {
    return this.providerOptions.find((opt) => opt.value === provider)?.label ?? provider;
  }

  statusLabel(item: HostingWebhostProvider) {
    return item.HwpIsActive === 1 ? 'Active' : 'Inactive';
  }

  providerIsDefault(item: HostingWebhostProvider) {
    return item.HwpIsDefault === 1;
  }

  hostLabel(item: HostingWebhostProvider) {
    const config = item.HwpConfig ?? {};
    const hostname = config.hostname ?? '-';
    const port = config.port ?? 2087;
    return hostname === '-' ? '-' : `${hostname}:${port}`;
  }

  usernameLabel(item: HostingWebhostProvider) {
    return item.credentials?.username || '-';
  }

  apiTokenPlaceholder() {
    return this.editing()?.credentials?.apiTokenConfigured
      ? 'Token stored; leave blank to keep it'
      : 'API token';
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

  async loadProviders() {
    this.loading.set(true);
    const start = performance.now();
    const values = this.filterForm.getRawValue();
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (values.search.trim()) params.set('search', values.search.trim());
    if (values.status === '0' || values.status === '1') params.set('status', values.status);

    try {
      const result = await this.api.get<{ data?: { items?: HostingWebhostProvider[] } }>(
        `${this.providerEndpoint}?${params.toString()}`,
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.providers.set(
        list.map((item) => ({
          ...item,
          HwpConfig: this.parseConfig<WebhostProviderConfig>(item.HwpConfig),
        })),
      );
      this.reconcileProviderSelection();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost providers.'));
    } finally {
      this.finishLoading(start);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  async startEdit(item: HostingWebhostProvider) {
    let provider = item;
    try {
      const result = await this.api.get<{ data?: { item?: HostingWebhostProvider | null } }>(
        `${this.providerEndpoint}/${item.HwpUUID}`,
      );
      const detail = result?.data?.item;
      if (detail) {
        provider = {
          ...detail,
          HwpConfig: this.parseConfig<WebhostProviderConfig>(detail.HwpConfig),
        };
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load provider details.'));
    }

    const config = provider.HwpConfig ?? {};
    const credentials = provider.credentials ?? {};
    this.editing.set(provider);
    this.providerForm.reset({
      name: provider.HwpName,
      provider: provider.HwpProvider,
      hostname: config.hostname ?? '',
      port: Number(config.port ?? 2087),
      username: credentials.username ?? '',
      apiToken: credentials.apiToken ?? '',
      sslVerify: config.sslVerify === false ? 0 : 1,
      notes: config.notes ?? '',
      isActive: provider.HwpIsActive === 1 ? 1 : 0,
      isDefault: provider.HwpIsDefault === 1 ? 1 : 0,
    });
    this.applyTokenValidators(true);
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
    if (!this.editing() && !credentials?.apiToken) {
      this.snack.warning('API token is required for new providers.');
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
        await this.api.put(`${this.providerEndpoint}/${editing.HwpUUID}`, payload);
        this.snack.success('Webhost provider updated.');
      } else {
        await this.api.post(this.providerEndpoint, payload);
        this.snack.success('Webhost provider created.');
      }
      await this.loadProviders();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save Webhost provider.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async remove(item: HostingWebhostProvider) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Webhost provider',
        message: `Are you sure you want to delete "${item.HwpName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.providerEndpoint}/${item.HwpUUID}`);
      this.snack.success('Webhost provider deleted.');
      await this.loadProviders();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete Webhost provider.'));
    }
  }

  isSelected(item: HostingWebhostProvider) {
    return this.selectedProviderUUIDs().has(item.HwpUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleProviderSelection(item: HostingWebhostProvider, checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item.HwpUUID);
      } else {
        next.delete(item.HwpUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        if (checked) {
          next.add(row.HwpUUID);
        } else {
          next.delete(row.HwpUUID);
        }
      }
      return next;
    });
  }

  async removeSelectedProviders() {
    const ids = Array.from(this.selectedProviderUUIDs());
    if (!ids.length) return;
    const labels = this.providers()
      .filter((item) => ids.includes(item.HwpUUID))
      .slice(0, 3)
      .map((item) => item.HwpName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected Webhost providers',
        message: `Are you sure you want to delete ${ids.length} selected Webhost provider(s)?${suffix}`,
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
          failed?: { HostingWebhostProviderUUID: string; message: string }[];
        };
      }>(`${this.providerEndpoint}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingWebhostProviderUUID),
      );
      this.providers.update((rows) => rows.filter((row) => !deleted.has(row.HwpUUID)));
      this.selectedProviderUUIDs.set(failed);
      await this.loadProviders();
      if (failed.size) {
        this.snack.error(`${failed.size} Webhost provider(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} Webhost provider(s) deleted.`);
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected Webhost providers.'));
    }
  }

  async validateProvider(item: HostingWebhostProvider) {
    this.validatingProviderId.set(item.HwpUUID);
    try {
      await this.api.post(`${this.providerEndpoint}/${item.HwpUUID}/validate`, {});
      this.snack.success(`${this.providerLabel(item.HwpProvider)} provider tested successfully.`);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to test Webhost provider.'));
    } finally {
      this.validatingProviderId.set(null);
    }
  }

  toggleSecret(event: MouseEvent) {
    event.stopPropagation();
    this.hideApiToken.set(!this.hideApiToken());
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

  private applyTokenValidators(isEditing = false) {
    const control = this.providerForm.controls.apiToken;
    control.clearValidators();
    if (!isEditing) control.setValidators([Validators.required]);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private resetForm() {
    this.providerForm.reset({
      name: '',
      provider: 'cpanel_whm',
      hostname: '',
      port: 2087,
      username: '',
      apiToken: '',
      sslVerify: 1,
      notes: '',
      isActive: 1,
      isDefault: 0,
    });
    this.applyTokenValidators(false);
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcileProviderSelection() {
    const available = new Set(this.providers().map((item) => item.HwpUUID));
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingWebhostProvider[]) {
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

  private providerSortValue(item: HostingWebhostProvider, column: string) {
    switch (column) {
      case 'name':
        return item.HwpName;
      case 'provider':
        return this.providerLabel(item.HwpProvider);
      case 'host':
        return this.hostLabel(item);
      case 'username':
        return this.usernameLabel(item);
      case 'default':
        return item.HwpIsDefault;
      case 'status':
        return item.HwpIsActive;
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

  private buildConfigPayload(): WebhostProviderConfig {
    const values = this.providerForm.getRawValue();
    return {
      hostname: this.normalizeString(values.hostname),
      port: Number(values.port || 2087),
      sslVerify: values.sslVerify === 1,
      notes: this.normalizeString(values.notes),
    };
  }

  private buildCredentialsPayload(): WebhostProviderCredentials | null {
    const values = this.providerForm.getRawValue();
    const credentials: WebhostProviderCredentials = {};
    const username = this.normalizeString(values.username);
    const apiToken = this.normalizeString(values.apiToken);
    if (username) credentials.username = username;
    if (apiToken) credentials.apiToken = apiToken;
    return Object.keys(credentials).length ? credentials : null;
  }

  private finishLoading(start: number) {
    const elapsed = performance.now() - start;
    const waitMs = Math.max(0, 600 - elapsed);
    if (waitMs) {
      setTimeout(() => this.loading.set(false), waitMs);
      return;
    }
    this.loading.set(false);
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
    if (!this.providerFormDialog || this.dialogRef) return;
    this.dialogRef = this.dialog.open(this.providerFormDialog, {
      ...getWebhostDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-webhost-provider-dialog',
    });
    this.dialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
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
      if (this.dialogRef) updateWebhostDialogViewport(this.dialogRef);
    });
    this.dialogViewportObserver.observe(pageContent);
    updateWebhostDialogViewport(this.dialogRef);
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }
}
