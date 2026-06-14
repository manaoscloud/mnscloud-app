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
import { SystemParameterService } from '../../../../services/system-parameter.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed, bindDialogEscape } from '../../../../shared/dialog/dialog-events.util';
import {
  getWebhostDialogViewportConfig,
  updateWebhostDialogViewport,
} from '../webhost-dialog-viewport';
import type {
  HostingWebhostPlan,
  HostingWebhostProvider,
  WebhostPlanConfig,
  WebhostProviderType,
} from '../webhost.types';

type WebhostPlanFilters = {
  search: string;
  providerUUID: string;
  status: string;
};

@Component({
  selector: 'app-hosting-webhost-plans',
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
  templateUrl: './plans.html',
  styleUrls: ['./plans.scss'],
})
export class HostingWebhostPlansPage {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly parameters = inject(SystemParameterService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly planFormDialog = viewChild<TemplateRef<unknown>>('planFormDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly providerEndpoint = 'hosting/webhost/providers';
  readonly planEndpoint = 'hosting/webhost/plans';
  readonly providers = signal<HostingWebhostProvider[]>([]);
  readonly plans = signal<HostingWebhostPlan[]>([]);
  readonly appliedSearch = signal('');
  readonly appliedProvider = signal('');
  readonly appliedStatus = signal('');
  readonly providerSearch = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  private readonly plansResource = resource({
    defaultValue: [] as HostingWebhostPlan[],
    params: (): WebhostPlanFilters => ({
      search: this.appliedSearch().trim(),
      providerUUID: this.appliedProvider(),
      status: this.appliedStatus(),
    }),
    loader: ({ params }) => this.fetchPlans(params),
  });
  readonly loading = this.plansResource.isLoading;
  readonly saving = signal(false);
  readonly editing = signal<HostingWebhostPlan | null>(null);
  readonly defaultCurrency = signal('BRL');
  readonly selectedPlanUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedPlanUUIDs().size);

  readonly providerOptions: { value: WebhostProviderType; label: string }[] = [
    { value: 'cpanel_whm', label: 'cPanel/WHM' },
    { value: 'plesk', label: 'Plesk' },
    { value: 'directadmin', label: 'DirectAdmin' },
  ];
  readonly displayedColumns = [
    'select',
    'name',
    'provider',
    'package',
    'resources',
    'price',
    'status',
    'actions',
  ];

  readonly filterFormModel = signal({
    search: '',
    provider: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly planFormModel = signal({
    name: '',
    providerUUID: '',
    packageName: '',
    diskMb: 0,
    bandwidthMb: 0,
    domains: 0,
    subdomains: 0,
    emailAccounts: 0,
    databases: 0,
    ftpAccounts: 0,
    price: 0,
    setupFee: 0,
    notes: '',
    isActive: 1,
  });
  readonly planForm = createForm(this.planFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.providerUUID);
    required(schema.price);
    required(schema.isActive);
  });

  readonly rows = computed(() => {
    const search = this.appliedSearch().trim().toLowerCase();
    const provider = this.appliedProvider();
    const status = this.appliedStatus();
    return this.plans().filter((item) => {
      const matchesSearch =
        !search ||
        item.HwlName.toLowerCase().includes(search) ||
        (item.ProviderName ?? '').toLowerCase().includes(search) ||
        item.HwlProvider.toLowerCase().includes(search) ||
        (item.HwlPackage ?? '').toLowerCase().includes(search);
      const matchesProvider = !provider || item.HostingWebhostProviderHwpUUID === provider;
      const matchesStatus =
        status === '' ||
        (status === '1' && item.HwlIsActive === 1) ||
        (status === '0' && item.HwlIsActive !== 1);
      return matchesSearch && matchesProvider && matchesStatus;
    });
  });
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly filteredProviders = computed(() => {
    const search = this.providerSearch().trim().toLowerCase();
    const items = this.providers().filter((provider) => provider.HwpIsActive === 1);
    if (!search) return items;
    return items.filter(
      (provider) =>
        provider.HwpName.toLowerCase().includes(search) ||
        this.providerLabel(provider.HwpProvider).toLowerCase().includes(search),
    );
  });
  readonly providerFilterOptions = computed(() =>
    this.providers()
      .filter((provider) => provider.HwpIsActive === 1)
      .map((provider) => ({
        uuid: provider.HwpUUID,
        name: provider.HwpName,
        platform: provider.HwpProvider,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  );

  private readonly syncPlans = effect(() => {
    this.plans.set(this.plansResource.value());
    this.reconcilePlanSelection();
  });

  private readonly reportPlansError = effect(() => {
    const error = this.plansResource.error();
    if (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost plans.'));
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeDialog();
      this.stopDialogViewportObserver();
    });
    void this.fetchDefaultCurrency();
    void this.fetchProviders();
  }

  refreshList() {
    void this.fetchProviders();
    this.plansResource.reload();
  }

  applyFilters() {
    const values = this.filterFormModel();
    this.appliedSearch.set(values.search);
    this.appliedProvider.set(values.provider);
    this.appliedStatus.set(values.status);
    this.resetPagination();
    this.plansResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({ search: '', provider: '', status: '' });
    this.applyFilters();
  }

  onProviderOpened(opened: boolean) {
    if (!opened) this.providerSearch.set('');
  }

  providerLabel(provider: WebhostProviderType | string) {
    return this.providerOptions.find((option) => option.value === provider)?.label ?? provider;
  }

  providerName(uuid: string) {
    return this.providers().find((provider) => provider.HwpUUID === uuid)?.HwpName ?? '-';
  }

  providerLabelForPlan(item: HostingWebhostPlan) {
    return `${item.ProviderName || this.providerName(item.HostingWebhostProviderHwpUUID)} · ${this.providerLabel(item.HwlProvider)}`;
  }

  resourcesLabel(item: HostingWebhostPlan) {
    const disk = item.HwlDiskMb ? `${this.formatMb(item.HwlDiskMb)} disk` : '';
    const bandwidth = item.HwlBandwidthMb ? `${this.formatMb(item.HwlBandwidthMb)} traffic` : '';
    const domains = item.HwlDomains ? `${item.HwlDomains} domains` : '';
    return [disk, bandwidth, domains].filter(Boolean).join(' · ') || '-';
  }

  moneyLabel(item: HostingWebhostPlan) {
    const currency = item.HwlCurrency || this.defaultCurrency();
    return `${currency} ${Number(item.HwlPrice ?? 0).toFixed(2)}`;
  }

  private async fetchDefaultCurrency() {
    const currency = await this.parameters.resolveDefaultCurrency('BRL');
    this.defaultCurrency.set(currency);
  }

  statusLabel(item: HostingWebhostPlan) {
    return item.HwlIsActive === 1 ? 'Active' : 'Inactive';
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

  async fetchProviders() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingWebhostProvider[] } }>(
        `${this.providerEndpoint}?limit=500&offset=0&status=1`,
      );
      this.providers.set(result?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost providers.'));
    }
  }

  private async fetchPlans(filters: WebhostPlanFilters): Promise<HostingWebhostPlan[]> {
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filters.search) params.set('search', filters.search);
    if (filters.providerUUID) {
      const selectedProvider = this.providers().find(
        (provider) => provider.HwpUUID === filters.providerUUID,
      );
      if (selectedProvider?.HwpProvider) params.set('provider', selectedProvider.HwpProvider);
    }
    if (filters.status === '0' || filters.status === '1') params.set('status', filters.status);

    const result = await this.api.get<{ data?: { items?: HostingWebhostPlan[] } }>(
      `${this.planEndpoint}?${params.toString()}`,
    );
    const items = result?.data?.items ?? [];
    return items.map((item) => ({ ...item, HwlConfig: this.parseConfig(item.HwlConfig) }));
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  async startEdit(item: HostingWebhostPlan) {
    let plan = item;
    try {
      const result = await this.api.get<{ data?: { item?: HostingWebhostPlan | null } }>(
        `${this.planEndpoint}/${item.HwlUUID}`,
      );
      if (result?.data?.item) {
        plan = { ...result.data.item, HwlConfig: this.parseConfig(result.data.item.HwlConfig) };
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost plan.'));
    }

    const config = plan.HwlConfig ?? {};
    this.editing.set(plan);
    this.planFormModel.set({
      name: plan.HwlName,
      providerUUID: plan.HostingWebhostProviderHwpUUID,
      packageName: plan.HwlPackage ?? '',
      diskMb: plan.HwlDiskMb ?? 0,
      bandwidthMb: plan.HwlBandwidthMb ?? 0,
      domains: plan.HwlDomains ?? 0,
      subdomains: plan.HwlSubdomains ?? 0,
      emailAccounts: plan.HwlEmailAccounts ?? 0,
      databases: plan.HwlDatabases ?? 0,
      ftpAccounts: plan.HwlFtpAccounts ?? 0,
      price: Number(plan.HwlPrice ?? 0),
      setupFee: Number(plan.HwlSetupFee ?? 0),
      notes: config.notes ?? '',
      isActive: plan.HwlIsActive === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    if (!this.planForm().valid() || !this.planNumbersAreValid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const values = this.planFormModel();
    const provider = this.providers().find((item) => item.HwpUUID === values.providerUUID);
    if (!provider || provider.HwpIsActive !== 1) {
      this.snack.warning('Select an active Webhost provider account.');
      return;
    }

    this.saving.set(true);
    const payload = {
      name: values.name.trim(),
      providerUUID: provider.HwpUUID,
      packageName: this.normalizeString(values.packageName),
      diskMb: this.numberOrNull(values.diskMb),
      bandwidthMb: this.numberOrNull(values.bandwidthMb),
      domains: this.numberOrNull(values.domains),
      subdomains: this.numberOrNull(values.subdomains),
      emailAccounts: this.numberOrNull(values.emailAccounts),
      databases: this.numberOrNull(values.databases),
      ftpAccounts: this.numberOrNull(values.ftpAccounts),
      price: Number(values.price ?? 0),
      setupFee: this.numberOrNull(values.setupFee),
      config: this.buildConfigPayload(),
      isActive: values.isActive === 1,
    };

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.planEndpoint}/${editing.HwlUUID}`, payload);
        this.snack.success('Webhost plan updated.');
      } else {
        await this.api.post(this.planEndpoint, payload);
        this.snack.success('Webhost plan created.');
      }
      this.plansResource.reload();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save Webhost plan.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async remove(item: HostingWebhostPlan) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Webhost plan',
        message: `Are you sure you want to delete "${item.HwlName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.planEndpoint}/${item.HwlUUID}`);
      this.snack.success('Webhost plan deleted.');
      this.plansResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete Webhost plan.'));
    }
  }

  isSelected(item: HostingWebhostPlan) {
    return this.selectedPlanUUIDs().has(item.HwlUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  togglePlanSelection(item: HostingWebhostPlan, checked: boolean) {
    this.selectedPlanUUIDs.update((current) => {
      const next = new Set(current);
      checked ? next.add(item.HwlUUID) : next.delete(item.HwlUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedPlanUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        checked ? next.add(row.HwlUUID) : next.delete(row.HwlUUID);
      }
      return next;
    });
  }

  async removeSelectedPlans() {
    const ids = Array.from(this.selectedPlanUUIDs());
    if (!ids.length) return;
    const labels = this.plans()
      .filter((item) => ids.includes(item.HwlUUID))
      .slice(0, 3)
      .map((item) => item.HwlName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected Webhost plans',
        message: `Are you sure you want to delete ${ids.length} selected Webhost plan(s)?${suffix}`,
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
          failed?: { HostingWebhostPlanUUID: string; message: string }[];
        };
      }>(`${this.planEndpoint}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingWebhostPlanUUID),
      );
      this.plans.update((rows) => rows.filter((row) => !deleted.has(row.HwlUUID)));
      this.selectedPlanUUIDs.set(failed);
      this.plansResource.reload();
      failed.size
        ? this.snack.error(`${failed.size} Webhost plan(s) could not be deleted.`)
        : this.snack.success(`${deleted.size || ids.length} Webhost plan(s) deleted.`);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected Webhost plans.'));
    }
  }

  private resetForm() {
    this.planFormModel.set({
      name: '',
      providerUUID: '',
      packageName: '',
      diskMb: 0,
      bandwidthMb: 0,
      domains: 0,
      subdomains: 0,
      emailAccounts: 0,
      databases: 0,
      ftpAccounts: 0,
      price: 0,
      setupFee: 0,
      notes: '',
      isActive: 1,
    });
  }

  private planNumbersAreValid() {
    const values = this.planFormModel();
    return [
      values.diskMb,
      values.bandwidthMb,
      values.domains,
      values.subdomains,
      values.emailAccounts,
      values.databases,
      values.ftpAccounts,
      values.price,
      values.setupFee,
    ].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0);
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcilePlanSelection() {
    const available = new Set(this.plans().map((item) => item.HwlUUID));
    this.selectedPlanUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingWebhostPlan[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const compared = this.compareValues(this.sortValue(a, active), this.sortValue(b, active));
      return direction === 'asc' ? compared : -compared;
    });
  }

  private sortValue(item: HostingWebhostPlan, column: string) {
    switch (column) {
      case 'name':
        return item.HwlName;
      case 'provider':
        return this.providerLabelForPlan(item);
      case 'package':
        return item.HwlPackage ?? '';
      case 'resources':
        return `${item.HwlDiskMb ?? 0}-${item.HwlBandwidthMb ?? 0}`;
      case 'price':
        return Number(item.HwlPrice ?? 0);
      case 'status':
        return item.HwlIsActive;
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

  private normalizeString(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private numberOrNull(value: number | null | undefined): number | null {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
  }

  private parseConfig(value: unknown): WebhostPlanConfig | null {
    if (!value) return null;
    if (typeof value === 'object') return value as WebhostPlanConfig;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as WebhostPlanConfig) : null;
    } catch {
      return null;
    }
  }

  private buildConfigPayload(): WebhostPlanConfig {
    return { notes: this.normalizeString(this.planFormModel().notes) };
  }

  private formatMb(value: number) {
    if (value >= 1024 && value % 1024 === 0) return `${value / 1024} GB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
    return `${value} MB`;
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
    const planFormDialog = this.planFormDialog();
    if (!planFormDialog || this.dialogRef) return;
    this.dialogRef = this.dialog.open(planFormDialog, {
      ...getWebhostDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-webhost-plan-dialog',
    });
    bindDialogEscape(this.dialogRef, () => {
      this.cancelForm();
    });
    this.startDialogViewportObserver();
    bindDialogClosed(this.dialogRef, () => {
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
