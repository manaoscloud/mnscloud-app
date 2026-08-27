import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
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
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed, bindDialogEscape } from '../../../../shared/dialog/dialog-events.util';

type ProviderStatus = 0 | 1;

type DomainProviderCatalogItem = {
  value: string;
  label: string;
  supportsApi: boolean;
  supportsDns: boolean;
  supportsRegistration: boolean;
};

type HostingDnsProvider = {
  HdpUUID: string;
  HdpName: string;
  HdpProvider: string;
  HdpApiEndpoint?: string | null;
  HdpAccessKey?: string | null;
  HdpRegion?: string | null;
  HdpHostedZoneID?: string | null;
  HdpDefaultTtl?: number | null;
  HdpVerifyTls?: number | null;
  HdpHasSecret?: number | null;
  HdpIsDefault: number;
  HdpStatus: ProviderStatus;
  HdpNotes?: string | null;
};

@Component({
  selector: 'app-hosting-dns-providers',
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
  templateUrl: './providers.html',
  styleUrls: ['./providers.scss'],
})
export class HostingDnsProvidersPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly providerFormDialog = viewChild<TemplateRef<unknown>>('providerFormDialog');

  private providerDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  readonly appliedSearch = signal('');
  readonly appliedProvider = signal('');
  readonly appliedStatus = signal('');

  private readonly providersResource = resource({
    params: () => ({
      search: this.appliedSearch().trim(),
      provider: this.appliedProvider().trim(),
      status: this.appliedStatus(),
    }),
    defaultValue: [] as HostingDnsProvider[],
    loader: async ({ params }) => {
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.provider) query.set('provider', params.provider);
      if (params.status === '0' || params.status === '1') query.set('status', params.status);
      query.set('limit', '500');
      query.set('offset', '0');

      const response = await this.api.get<{ data?: { items?: HostingDnsProvider[] } }>(
        `hosting/dns/providers?${query.toString()}`,
      );
      return response?.data?.items ?? [];
    },
  });

  readonly loading = this.providersResource.isLoading;
  readonly saving = signal(false);
  readonly providers = signal<HostingDnsProvider[]>([]);
  readonly catalog = signal<DomainProviderCatalogItem[]>([]);
  readonly editing = signal<HostingDnsProvider | null>(null);
  readonly selectedProviderUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedProviderUUIDs().size);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly sortedProviders = computed(() => this.sortProviders(this.providers()));
  readonly pagedProviders = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedProviders().slice(start, start + this.pageSize());
  });

  readonly displayedColumns = ['select', 'name', 'provider', 'default', 'status', 'actions'];

  readonly filterFormModel = signal({
    search: '',
    provider: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly providerFormModel = signal({
    name: '',
    provider: 'manual',
    isDefault: false,
    status: 1 as ProviderStatus,
    apiEndpoint: '',
    accessKey: '',
    secret: '',
    region: '',
    hostedZoneID: '',
    defaultTtl: null as number | null,
    verifyTls: true,
    notes: '',
  });
  readonly providerForm = createForm(this.providerFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.provider);
    required(schema.status);
  });

  private readonly syncProviders = effect(() => {
    this.providers.set(this.providersResource.value());
    this.pageIndex.set(0);
    this.reconcileProviderSelection();
  });

  private readonly reportProvidersError = effect(() => {
    const error = this.providersResource.error();
    if (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to load domain providers.'));
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeProviderDialog();
      this.stopDialogViewportObserver();
    });
    void this.fetchCatalog();
  }

  refreshList() {
    this.providersResource.reload();
  }

  async fetchCatalog() {
    try {
      const response = await this.api.get<{ data?: { items?: DomainProviderCatalogItem[] } }>(
        'hosting/dns/providers/catalog',
      );
      this.catalog.set(response?.data?.items ?? []);
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load provider catalog.'));
    }
  }

  applyFilters() {
    const { search, provider, status } = this.filterFormModel();
    this.appliedSearch.set(search);
    this.appliedProvider.set(provider);
    this.appliedStatus.set(status);
    this.providersResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({ search: '', provider: '', status: '' });
    this.appliedSearch.set('');
    this.appliedProvider.set('');
    this.appliedStatus.set('');
    this.providersResource.reload();
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
    this.providerFormModel.set({
      name: '',
      provider: 'manual',
      isDefault: false,
      status: 1,
      apiEndpoint: '',
      accessKey: '',
      secret: '',
      region: '',
      hostedZoneID: '',
      defaultTtl: null,
      verifyTls: true,
      notes: '',
    });
    this.openProviderDialog();
  }

  startEdit(provider: HostingDnsProvider) {
    this.editing.set(provider);
    this.providerFormModel.set({
      name: provider.HdpName ?? '',
      provider: provider.HdpProvider ?? 'manual',
      isDefault: Boolean(provider.HdpIsDefault),
      status: (provider.HdpStatus ?? 1) as ProviderStatus,
      apiEndpoint: provider.HdpApiEndpoint ?? '',
      accessKey: provider.HdpAccessKey ?? '',
      secret: '',
      region: provider.HdpRegion ?? '',
      hostedZoneID: provider.HdpHostedZoneID ?? '',
      defaultTtl: provider.HdpDefaultTtl ?? null,
      verifyTls: provider.HdpVerifyTls !== 0,
      notes: provider.HdpNotes ?? '',
    });
    this.openProviderDialog();
  }

  cancelForm() {
    this.closeProviderDialog();
    this.resetForm();
  }

  async saveProvider(closeAfterSave = true) {
    if (!this.providerForm().valid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const values = this.providerFormModel();
    const name = values.name.trim();
    if (!name) {
      this.snack.warning('Domain provider name is required.');
      return;
    }

    this.saving.set(true);
    const payload = {
      name,
      provider: values.provider,
      apiEndpoint: values.apiEndpoint.trim() || null,
      accessKey: values.accessKey.trim() || null,
      secret: values.secret.trim() || null,
      region: values.region.trim() || null,
      hostedZoneID: values.hostedZoneID.trim() || null,
      defaultTtl: this.optionalNumber(values.defaultTtl),
      verifyTls: values.verifyTls,
      isDefault: values.isDefault,
      status: values.status,
      notes: values.notes.trim() || null,
    };

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`hosting/dns/providers/${editing.HdpUUID}`, payload);
        this.snack.success('Domain provider updated successfully.');
      } else {
        await this.api.post('hosting/dns/providers', payload);
        this.snack.success('Domain provider created successfully.');
      }

      this.providersResource.reload();
      if (closeAfterSave || editing) {
        this.closeProviderDialog();
        this.resetForm();
      } else {
        this.providerFormModel.set({
          name: '',
          provider: 'manual',
          isDefault: false,
          status: 1,
          apiEndpoint: '',
          accessKey: '',
          secret: '',
          region: '',
          hostedZoneID: '',
          defaultTtl: null,
          verifyTls: true,
          notes: '',
        });
      }
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save domain provider.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewProvider() {
    void this.saveProvider(false);
  }

  async deleteProvider(provider: HostingDnsProvider) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete domain provider',
        message: `Are you sure you want to delete "${provider.HdpName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`hosting/dns/providers/${provider.HdpUUID}`);
      this.snack.success('Domain provider deleted successfully.');
      this.providersResource.reload();
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete domain provider.'));
    }
  }

  isSelected(provider: HostingDnsProvider) {
    return this.selectedProviderUUIDs().has(provider.HdpUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedProviders();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedProviders();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleProviderSelection(provider: HostingDnsProvider, checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) next.add(provider.HdpUUID);
      else next.delete(provider.HdpUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedProviders()) {
        if (checked) next.add(row.HdpUUID);
        else next.delete(row.HdpUUID);
      }
      return next;
    });
  }

  async deleteSelectedProviders() {
    const ids = Array.from(this.selectedProviderUUIDs());
    if (!ids.length) return;

    const labels = this.providers()
      .filter((provider) => ids.includes(provider.HdpUUID))
      .slice(0, 3)
      .map((provider) => provider.HdpName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected domain providers',
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
          failed?: { HostingDnsProviderUUID?: string; HdpUUID?: string; message: string }[];
        };
      }>('hosting/dns/providers/bulk', { ids });
      const failed = new Set(
        (response?.data?.failed ?? []).map(
          (item) => item.HostingDnsProviderUUID ?? item.HdpUUID ?? '',
        ),
      );
      this.providersResource.reload();
      this.selectedProviderUUIDs.set(failed);
      if (failed.size) {
        this.snack.warning(`${failed.size} provider(s) could not be deleted.`);
      } else {
        this.snack.success(`${response?.data?.deleted?.length || ids.length} provider(s) deleted.`);
      }
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected providers.'));
    }
  }

  statusLabel(status: ProviderStatus) {
    return status === 1 ? 'Active' : 'Inactive';
  }

  providerLabel(value: string) {
    return this.catalog().find((item) => item.value === value)?.label ?? value;
  }

  private optionalNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private resetForm() {
    this.editing.set(null);
    this.providerFormModel.set({
      name: '',
      provider: 'manual',
      isDefault: false,
      status: 1,
      apiEndpoint: '',
      accessKey: '',
      secret: '',
      region: '',
      hostedZoneID: '',
      defaultTtl: null,
      verifyTls: true,
      notes: '',
    });
  }

  private reconcileProviderSelection() {
    const available = new Set(this.providers().map((provider) => provider.HdpUUID));
    this.selectedProviderUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortProviders(rows: HostingDnsProvider[]) {
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

  private providerSortValue(provider: HostingDnsProvider, column: string) {
    switch (column) {
      case 'name':
        return provider.HdpName;
      case 'provider':
        return this.providerLabel(provider.HdpProvider);
      case 'default':
        return provider.HdpIsDefault;
      case 'status':
        return provider.HdpStatus;
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

  private openProviderDialog() {
    const providerFormDialog = this.providerFormDialog();
    if (!providerFormDialog || this.providerDialogRef) return;
    this.providerDialogRef = this.dialog.open(providerFormDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-dns-provider-form-dialog',
    });
    bindDialogEscape(this.providerDialogRef, () => {
      this.cancelForm();
    });
    this.startDialogViewportObserver();
    bindDialogClosed(this.providerDialogRef, () => {
      this.stopDialogViewportObserver();
      this.providerDialogRef = null;
    });
  }

  private closeProviderDialog() {
    if (!this.providerDialogRef) return;
    this.stopDialogViewportObserver();
    this.providerDialogRef.close();
    this.providerDialogRef = null;
  }

  private getDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: 'calc(100vw - 24px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'calc(100dvh - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        position: { left: '12px', top: '12px' },
      };
    }

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) {
      return {
        width: 'min(1280px, calc(100vw - 1.5rem))',
        maxWidth: '99vw',
        maxHeight: '95vh',
      };
    }

    const rect = pageContent.getBoundingClientRect();
    const spacing = 8;
    const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
    const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));
    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${Math.max(0, Math.floor(rect.left + spacing))}px`,
        top: `${Math.max(0, Math.floor(rect.top + spacing))}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.providerDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => this.updateDialogViewport());
    this.dialogViewportObserver.observe(pageContent);
    this.updateDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateDialogViewport() {
    if (!this.providerDialogRef) return;
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    this.providerDialogRef.updateSize(width, height);
    if (config.position) this.providerDialogRef.updatePosition(config.position);
    else this.providerDialogRef.updatePosition();
  }

  private extractErrorMessage(err: unknown, fallback: string) {
    if (err && typeof err === 'object' && 'error' in err) {
      const payload = (err as { error?: { error?: string; message?: string } }).error;
      return payload?.error || payload?.message || fallback;
    }
    if (err instanceof Error) return err.message;
    return fallback;
  }
}
