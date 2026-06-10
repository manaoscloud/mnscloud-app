import { HttpErrorResponse } from '@angular/common/http';
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
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SystemParameterService } from '../../../../services/system-parameter.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  getVpsDialogViewportConfig,
  updateVpsDialogViewport,
} from '../vps-container-dialog-viewport';
import type {
  HostingVpsContainerProvider,
  HostingVpsContainerPlan,
  HostingVpsContainerPlanConfig,
  VpsContainerCatalogOption,
  VpsContainerProvider,
  VpsContainerProviderCatalog,
  VpsContainerProviderConfig,
} from '../vps-container.types';

type VpsContainerPlanFilters = {
  search: string;
  status: string;
};

@Component({
  selector: 'app-hosting-vps-container-plans',
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
  templateUrl: './plans.html',
  styleUrls: ['./plans.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class HostingVpsContainerPlansPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly parameters = inject(SystemParameterService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  readonly planFormDialog = viewChild<TemplateRef<unknown>>('planFormDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly providerEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps-container/providers' : 'hosting/vps-container/providers',
  );
  readonly planEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps-container/plans' : 'hosting/vps-container/plans',
  );

  readonly providers = signal<HostingVpsContainerProvider[]>([]);
  readonly plans = signal<HostingVpsContainerPlan[]>([]);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly appliedSearch = signal('');
  readonly appliedStatus = signal('');
  readonly providerFilter = signal('');
  readonly rows = computed(() => this.filterPlansByProvider(this.plans()));
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  private readonly plansResource = resource({
    defaultValue: [] as HostingVpsContainerPlan[],
    params: (): VpsContainerPlanFilters => ({
      search: this.appliedSearch().trim(),
      status: this.appliedStatus(),
    }),
    loader: ({ params }) => this.fetchPlans(params),
  });
  readonly loading = this.plansResource.isLoading;
  readonly saving = signal(false);
  readonly editing = signal<HostingVpsContainerPlan | null>(null);
  readonly defaultCurrency = signal('BRL');
  readonly providerFilterSearch = signal('');
  readonly providerSearch = signal('');
  readonly regionSearch = signal('');
  readonly sizeSearch = signal('');
  readonly catalogLoading = signal(false);
  readonly catalog = signal<VpsContainerProviderCatalog | null>(null);
  readonly catalogProviderUUID = signal<string | null>(null);
  readonly currentRegion = signal('');
  readonly currentSize = signal('');
  readonly selectedPlanUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedPlanUUIDs().size);

  readonly displayedColumns = [
    'select',
    'name',
    'provider',
    'region',
    'size',
    'price',
    'status',
    'actions',
  ];
  readonly providerOptions: { value: VpsContainerProvider; label: string }[] = [
    { value: 'incus', label: 'Incus' },
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    provider: [''],
    status: [''],
  });

  readonly planForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    provider: ['incus' as VpsContainerProvider, [Validators.required]],
    providerUUID: ['', [Validators.required]],
    region: [''],
    size: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    setupFee: [0, [Validators.min(0)]],
    cpu: [0, [Validators.min(0)]],
    memoryMb: [0, [Validators.min(0)]],
    diskGb: [0, [Validators.min(0)]],
    transferGb: [0, [Validators.min(0)]],
    notes: [''],
    isActive: [1, [Validators.required]],
  });

  readonly availableRegions = computed(() => this.catalog()?.regions ?? []);
  readonly availableSizes = computed(() => this.catalog()?.sizes ?? []);
  readonly regionOptions = computed(() =>
    this.withCurrentOption(this.availableRegions(), this.currentRegion()),
  );
  readonly sizeOptions = computed(() =>
    this.withCurrentOption(this.availableSizes(), this.currentSize()),
  );
  readonly filteredRegionOptions = computed(() =>
    this.filterCatalogOptions(this.regionOptions(), this.regionSearch()),
  );
  readonly filteredSizeOptions = computed(() =>
    this.sortSizeOptions(this.filterCatalogOptions(this.sizeOptions(), this.sizeSearch())),
  );
  readonly providerFilterOptions = computed(() =>
    [...this.providers()].sort((a, b) =>
      a.HcpName.localeCompare(b.HcpName, undefined, { numeric: true, sensitivity: 'base' }),
    ),
  );
  readonly filteredProviderFilterOptions = computed(() => {
    const value = this.providerFilterSearch().trim().toLowerCase();
    const providers = this.providerFilterOptions();
    if (!value) return providers;
    return providers.filter(
      (acc) =>
        acc.HcpName.toLowerCase().includes(value) || acc.HcpProvider.toLowerCase().includes(value),
    );
  });

  private readonly syncPlans = effect(() => {
    this.plans.set(this.plansResource.value());
    this.reconcilePlanSelection();
  });

  private readonly reportPlansError = effect(() => {
    const error = this.plansResource.error();
    if (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load VPS Container plans.'));
    }
  });

  constructor() {
    void this.loadDefaultCurrency();
    this.planForm.controls.providerUUID.valueChanges.subscribe((uuid) => {
      this.syncProviderFromProvider(uuid);
      void this.loadProviderCatalog();
    });
    this.planForm.controls.region.valueChanges.subscribe((value) =>
      this.currentRegion.set(value ?? ''),
    );
    this.planForm.controls.size.valueChanges.subscribe((value) => {
      this.currentSize.set(value ?? '');
      this.applySelectedSizeSpecs(value);
    });
    void this.loadProviders();
  }

  ngOnDestroy() {
    this.closeDialog();
    this.stopDialogViewportObserver();
  }

  refreshList() {
    void this.loadProviders();
    this.plansResource.reload();
  }

  get filteredProviders() {
    const value = this.providerSearch().trim().toLowerCase();
    const providers = this.providers().filter((acc) => acc.HcpIsActive === 1);
    if (!value) return providers;
    return providers.filter(
      (acc) =>
        acc.HcpName.toLowerCase().includes(value) || acc.HcpProvider.toLowerCase().includes(value),
    );
  }

  onProviderOpened(opened: boolean) {
    if (!opened) this.providerSearch.set('');
  }

  onProviderFilterOpened(opened: boolean) {
    if (!opened) this.providerFilterSearch.set('');
  }

  onRegionOpened(opened: boolean) {
    if (!opened) this.regionSearch.set('');
  }

  onSizeOpened(opened: boolean) {
    if (!opened) this.sizeSearch.set('');
  }

  selectedCatalogLabel(controlName: 'region' | 'size', options: VpsContainerCatalogOption[]) {
    const value = this.normalizeString(this.planForm.controls[controlName].value);
    if (!value) return '';
    return options.find((option) => option.id === value)?.label ?? value;
  }

  selectedSizeLabel() {
    const value = this.normalizeString(this.planForm.controls.size.value);
    if (!value) return '';
    const option = this.sizeOptions().find((item) => item.id === value);
    if (!option) return value;
    return [this.sizeOptionName(option), this.sizeOptionPrice(option)].filter(Boolean).join(' ');
  }

  sizeOptionName(option: VpsContainerCatalogOption) {
    return this.sizeOptionParts(option)[0] ?? option.label ?? option.id;
  }

  sizeOptionPrice(option: VpsContainerCatalogOption) {
    return this.sizeOptionParts(option).find((part) => /\/mo|\/month|\$\d/i.test(part)) ?? '';
  }

  sizeOptionMeta(option: VpsContainerCatalogOption) {
    const slug = this.sizeOptionSlug(option);
    return this.sizeOptionParts(option)
      .slice(1)
      .filter((part) => part !== this.sizeOptionPrice(option) && part !== slug)
      .join(' · ');
  }

  sizeOptionSlug(option: VpsContainerCatalogOption) {
    const parts = this.sizeOptionParts(option);
    return parts[parts.length - 1] !== this.sizeOptionPrice(option)
      ? (parts[parts.length - 1] ?? option.id)
      : option.id;
  }

  selectedSizeHasCatalogSpecs() {
    const option = this.selectedSizeOption();
    return (
      !!option &&
      ['cpu', 'memoryMb', 'diskGb'].some(
        (key) => this.catalogNumber(option[key as keyof VpsContainerCatalogOption]) !== null,
      )
    );
  }

  providerLabel(provider: VpsContainerProvider) {
    return this.providerOptions.find((opt) => opt.value === provider)?.label ?? provider;
  }

  providerNameForPlan(item: HostingVpsContainerPlan) {
    return (
      this.providerById(item.HostingVpsContainerProviderHcpUUID)?.HcpName ??
      this.providerById(this.resolveProviderUUIDForProvider(item.HcnProvider))?.HcpName ??
      this.providerLabel(item.HcnProvider)
    );
  }

  statusLabel(item: HostingVpsContainerPlan) {
    return item.HcnIsActive === 1 ? 'Active' : 'Inactive';
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

  moneyLabel(item: HostingVpsContainerPlan) {
    const currency = item.HcnCurrency || this.defaultCurrency();
    return `${currency} ${Number(item.HcnPrice ?? 0).toFixed(2)}`;
  }

  private async loadDefaultCurrency() {
    const currency = await this.parameters.resolveDefaultCurrency('BRL');
    this.defaultCurrency.set(currency);
  }

  async loadProviders() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsContainerProvider[] } }>(
        this.providerEndpoint(),
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.providers.set(
        list.map((item) => ({
          ...item,
          HcpConfig: this.parseConfig<VpsContainerProviderConfig>(item.HcpConfig),
        })),
      );
      void this.loadProviderCatalog();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load VPS Container providers.'));
    }
  }

  private async fetchPlans(filters: VpsContainerPlanFilters): Promise<HostingVpsContainerPlan[]> {
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filters.search) params.set('search', filters.search);
    if (filters.status === '0' || filters.status === '1') params.set('status', filters.status);

    const result = await this.api.get<{ data?: { items?: HostingVpsContainerPlan[] } }>(
      `${this.planEndpoint()}?${params.toString()}`,
    );
    const list = Array.isArray(result?.data?.items) ? result.data.items : [];
    return list.map((item) => ({
      ...item,
      HcnConfig: this.parseConfig<HostingVpsContainerPlanConfig>(item.HcnConfig),
    }));
  }

  applyFilters() {
    const values = this.filterForm.getRawValue();
    this.appliedSearch.set(values.search);
    this.appliedStatus.set(values.status);
    this.resetPagination();
    this.providerFilter.set(values.provider);
    this.plansResource.reload();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', provider: '', status: '' });
    this.appliedSearch.set('');
    this.appliedStatus.set('');
    this.providerFilter.set('');
    this.providerFilterSearch.set('');
    this.resetPagination();
    this.plansResource.reload();
  }

  async loadProviderCatalog() {
    const uuid = this.resolveCatalogProviderUUID();
    if (!uuid) {
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      return;
    }
    if (this.catalogProviderUUID() === uuid && this.catalog()) return;
    if (this.catalogLoading()) return;

    this.catalogLoading.set(true);
    this.catalogProviderUUID.set(uuid);

    try {
      const result = await this.api.get<{ data?: { catalog?: VpsContainerProviderCatalog } }>(
        `${this.providerEndpoint()}/${uuid}/catalog`,
      );
      this.catalog.set(result?.data?.catalog ?? null);
      this.applySelectedSizeSpecs(this.planForm.controls.size.value);
    } catch (error) {
      this.catalog.set(null);
      this.snack.error(this.friendlyError(error, 'Failed to load provider catalog.'));
    } finally {
      this.catalogLoading.set(false);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    void this.loadProviderCatalog();
    this.openDialog();
  }

  startEdit(item: HostingVpsContainerPlan) {
    const config = item.HcnConfig ?? {};
    this.editing.set(item);
    const providerUUID =
      this.providerById(item.HostingVpsContainerProviderHcpUUID)?.HcpUUID ??
      this.resolveProviderUUIDForProvider(item.HcnProvider);
    this.planForm.reset({
      name: item.HcnName,
      provider: item.HcnProvider,
      providerUUID,
      region: item.HcnRegion ?? '',
      size: item.HcnSize ?? '',
      price: Number(item.HcnPrice ?? 0),
      setupFee: Number(item.HcnSetupFee ?? 0),
      cpu: Number(config.cpu ?? 0),
      memoryMb: Number(config.memoryMb ?? 0),
      diskGb: Number(config.diskGb ?? 0),
      transferGb: Number(config.transferGb ?? 0),
      notes: config.notes ?? '',
      isActive: item.HcnIsActive === 1 ? 1 : 0,
    });
    this.currentRegion.set(item.HcnRegion ?? '');
    this.currentSize.set(item.HcnSize ?? '');
    void this.loadProviderCatalog();
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      this.snack.warning('Please fill all required fields.');
      return;
    }

    this.saving.set(true);
    const values = this.planForm.getRawValue();
    const providerRecord = this.providerById(values.providerUUID);
    if (!providerRecord) {
      this.saving.set(false);
      this.snack.warning('Select a valid VPS Container provider.');
      return;
    }

    const payload = {
      name: values.name.trim(),
      providerUUID: providerRecord.HcpUUID,
      region: this.normalizeString(values.region),
      size: this.normalizeString(values.size),
      price: Number(values.price ?? 0),
      setupFee: Number(values.setupFee ?? 0),
      config: this.buildConfigPayload(),
      isActive: values.isActive === 1,
    };

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.planEndpoint()}/${editing.HcnUUID}`, payload);
        this.snack.success('VPS Container plan updated.');
      } else {
        await this.api.post(this.planEndpoint(), payload);
        this.snack.success('VPS Container plan created.');
      }
      this.plansResource.reload();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save VPS Container plan.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async remove(item: HostingVpsContainerPlan) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete VPS Container plan',
        message: `Are you sure you want to delete "${item.HcnName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.planEndpoint()}/${item.HcnUUID}`);
      this.snack.success('VPS Container plan deleted.');
      this.plansResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete VPS Container plan.'));
    }
  }

  isSelected(item: HostingVpsContainerPlan) {
    return this.selectedPlanUUIDs().has(item.HcnUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  togglePlanSelection(item: HostingVpsContainerPlan, checked: boolean) {
    this.selectedPlanUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item.HcnUUID);
      } else {
        next.delete(item.HcnUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedPlanUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        if (checked) {
          next.add(row.HcnUUID);
        } else {
          next.delete(row.HcnUUID);
        }
      }
      return next;
    });
  }

  async removeSelectedPlans() {
    const ids = Array.from(this.selectedPlanUUIDs());
    if (!ids.length) return;
    const labels = this.plans()
      .filter((item) => ids.includes(item.HcnUUID))
      .slice(0, 3)
      .map((item) => item.HcnName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected VPS Container plans',
        message: `Are you sure you want to delete ${ids.length} selected VPS Container plan(s)?${suffix}`,
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
          failed?: { HostingVpsContainerPlanUUID: string; message: string }[];
        };
      }>(`${this.planEndpoint()}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingVpsContainerPlanUUID),
      );
      this.plans.update((rows) => rows.filter((row) => !deleted.has(row.HcnUUID)));
      this.selectedPlanUUIDs.set(failed);
      this.plansResource.reload();
      if (failed.size) {
        this.snack.error(`${failed.size} VPS Container plan(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} VPS Container plan(s) deleted.`);
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected VPS Container plans.'));
    }
  }

  private buildConfigPayload(): HostingVpsContainerPlanConfig {
    const values = this.planForm.getRawValue();
    return {
      cpu: Number(values.cpu ?? 0) || null,
      memoryMb: Number(values.memoryMb ?? 0) || null,
      diskGb: Number(values.diskGb ?? 0) || null,
      target: this.normalizeString(values.region),
      imageServer: null,
      notes: this.normalizeString(values.notes),
    };
  }

  private filterPlansByProvider(rows: HostingVpsContainerPlan[]) {
    const providerUUID = this.normalizeString(this.providerFilter());
    if (!providerUUID) return rows;
    return rows.filter(
      (item) =>
        item.HostingVpsContainerProviderHcpUUID === providerUUID ||
        this.resolveProviderUUIDForProvider(item.HcnProvider) === providerUUID,
    );
  }

  private normalizeString(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private selectedSizeOption() {
    const selected = this.normalizeString(this.planForm.controls.size.value);
    if (!selected) return null;
    return this.sizeOptions().find((option) => option.id === selected) ?? null;
  }

  private applySelectedSizeSpecs(value: string | null | undefined) {
    const selected = this.normalizeString(value);
    if (!selected) return;
    const option = this.sizeOptions().find((item) => item.id === selected);
    if (!option) return;

    const specs = {
      cpu: this.catalogNumber(option.cpu),
      memoryMb: this.catalogNumber(option.memoryMb),
      diskGb: this.catalogNumber(option.diskGb),
    };

    const patch: Partial<{ cpu: number; memoryMb: number; diskGb: number }> = {};
    if (specs.cpu !== null) patch.cpu = specs.cpu;
    if (specs.memoryMb !== null) patch.memoryMb = specs.memoryMb;
    if (specs.diskGb !== null) patch.diskGb = specs.diskGb;
    if (!Object.keys(patch).length) return;

    this.planForm.patchValue(patch, { emitEvent: false });
  }

  private catalogNumber(value: unknown): number | null {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

  private withCurrentOption(
    options: VpsContainerCatalogOption[],
    current: string,
  ): VpsContainerCatalogOption[] {
    const normalized = this.normalizeString(current);
    if (!normalized || options.some((opt) => opt.id === normalized)) return options;
    return [{ id: normalized, label: `Custom: ${normalized}` }, ...options];
  }

  private sizeOptionParts(option: VpsContainerCatalogOption) {
    return (option.label || option.id)
      .split(' • ')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private sortSizeOptions(options: VpsContainerCatalogOption[]) {
    return [...options].sort((a, b) => {
      const rankDiff = this.sizeOptionRank(a) - this.sizeOptionRank(b);
      if (rankDiff !== 0) return rankDiff;

      const priceDiff = this.sizeOptionMonthlyPrice(a) - this.sizeOptionMonthlyPrice(b);
      if (priceDiff !== 0) return priceDiff;

      const nameDiff = this.sizeOptionName(a).localeCompare(this.sizeOptionName(b), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (nameDiff !== 0) return nameDiff;

      return this.sizeOptionSlug(a).localeCompare(this.sizeOptionSlug(b), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }

  private sizeOptionRank(option: VpsContainerCatalogOption) {
    const name = this.sizeOptionName(option).toLowerCase();
    if (name.includes('basic') && !name.includes('premium')) return 10;
    if (name.includes('basic') && name.includes('premium')) return 15;
    if (name.includes('general purpose')) return 20;
    if (name.includes('cpu')) return 30;
    if (name.includes('memory')) return 40;
    if (name.includes('storage')) return 50;
    if (name.includes('custom')) return 90;
    return 80;
  }

  private sizeOptionMonthlyPrice(option: VpsContainerCatalogOption) {
    const price = this.sizeOptionPrice(option).match(/[\d,.]+/);
    if (!price) return Number.POSITIVE_INFINITY;
    return Number(price[0].replace(/,/g, ''));
  }

  private filterCatalogOptions(
    options: VpsContainerCatalogOption[],
    search: string,
  ): VpsContainerCatalogOption[] {
    const value = search.trim().toLowerCase();
    if (!value) return options;
    return options.filter(
      (option) =>
        option.id.toLowerCase().includes(value) || option.label.toLowerCase().includes(value),
    );
  }

  private resolveCatalogProviderUUID(): string | null {
    const selected = this.normalizeString(this.planForm.controls.providerUUID.value);
    if (selected) return selected;
    return null;
  }

  private providerById(uuid: string | null | undefined): HostingVpsContainerProvider | null {
    const normalized = this.normalizeString(uuid);
    if (!normalized) return null;
    return this.providers().find((acc) => acc.HcpUUID === normalized) ?? null;
  }

  private syncProviderFromProvider(uuid: string | null | undefined) {
    const providerRecord = this.providerById(uuid);
    if (!providerRecord) return;
    this.planForm.controls.provider.setValue(providerRecord.HcpProvider, { emitEvent: false });
  }

  private resolveProviderUUIDForProvider(provider: VpsContainerProvider): string {
    return (
      this.providers().find(
        (acc) => acc.HcpProvider === provider && acc.HcpIsActive === 1 && acc.HcpIsDefault === 1,
      )?.HcpUUID ??
      this.providers().find((acc) => acc.HcpProvider === provider && acc.HcpIsActive === 1)
        ?.HcpUUID ??
      ''
    );
  }

  private resetForm() {
    this.planForm.reset({
      name: '',
      provider: 'incus',
      providerUUID: '',
      region: '',
      size: '',
      price: 0,
      setupFee: 0,
      cpu: 0,
      memoryMb: 0,
      diskGb: 0,
      transferGb: 0,
      notes: '',
      isActive: 1,
    });
    this.currentRegion.set('');
    this.currentSize.set('');
    this.providerSearch.set('');
    this.regionSearch.set('');
    this.sizeSearch.set('');
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcilePlanSelection() {
    const available = new Set(this.plans().map((item) => item.HcnUUID));
    this.selectedPlanUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingVpsContainerPlan[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    return [...rows].sort((a, b) => {
      const compared = this.compareValues(
        this.planSortValue(a, active),
        this.planSortValue(b, active),
      );
      return direction === 'asc' ? compared : -compared;
    });
  }

  private planSortValue(item: HostingVpsContainerPlan, column: string) {
    switch (column) {
      case 'name':
        return item.HcnName;
      case 'provider':
        return this.providerNameForPlan(item);
      case 'region':
        return item.HcnRegion ?? '';
      case 'size':
        return item.HcnSize ?? '';
      case 'price':
        return Number(item.HcnPrice ?? 0);
      case 'status':
        return item.HcnIsActive;
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
      ...getVpsDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-vps-container-plan-dialog',
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
