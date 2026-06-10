import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  OnDestroy,
  resource,
  signal,
  TemplateRef,
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
import { getVpsDialogViewportConfig, updateVpsDialogViewport } from '../vps-dialog-viewport';
import { TranslocoPipe } from '@jsverse/transloco';
import type {
  HostingVpsInstance,
  HostingVpsInstanceConfig,
  HostingVpsPlan,
  HostingVpsPlanConfig,
  HostingVpsProvider,
  VpsCatalogOption,
  VpsProviderCatalog,
  VpsProviderConfig,
} from '../vps.types';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Status?: number | null;
};

type VpsInstanceFilters = {
  search: string;
  customerUUID: string;
  status: string;
};

@Component({
  selector: 'app-hosting-vps-instances',
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
  templateUrl: './instances.html',
  styleUrls: ['./instances.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingVpsInstancesPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly instanceFormDialog = viewChild<TemplateRef<unknown>>('instanceFormDialog');
  readonly changePlanDialog = viewChild<TemplateRef<unknown>>('changePlanDialog');

  private activePlanUUID = '';
  private dialogRef: MatDialogRef<unknown> | null = null;
  private changePlanDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly providerEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/providers' : 'hosting/vps/providers',
  );
  readonly instanceEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/instances' : 'hosting/vps/instances',
  );
  readonly planEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/plans' : 'hosting/vps/plans',
  );
  readonly customerEndpoint = 'erp/customers';

  readonly customers = signal<CustomerOption[]>([]);
  readonly providers = signal<HostingVpsProvider[]>([]);
  readonly plans = signal<HostingVpsPlan[]>([]);
  readonly vpsInstances = signal<HostingVpsInstance[]>([]);
  readonly appliedSearch = signal('');
  readonly appliedCustomerUUID = signal('');
  readonly appliedStatus = signal('');
  private readonly instancesResource = resource({
    defaultValue: [] as HostingVpsInstance[],
    params: (): VpsInstanceFilters => ({
      search: this.appliedSearch().trim(),
      customerUUID: this.appliedCustomerUUID(),
      status: this.appliedStatus(),
    }),
    loader: ({ params }) => this.fetchInstances(params),
  });
  private readonly syncInstances = effect(() => {
    this.vpsInstances.set(this.instancesResource.value());
    this.reconcileInstanceSelection();
  });
  private readonly reportInstancesError = effect(() => {
    const error = this.instancesResource.error();
    if (error) this.snack.error(this.friendlyError(error, 'Failed to load VPS instances.'));
  });
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly rows = computed(() => {
    const search = this.appliedSearch().trim().toLowerCase();
    const customerUUID = this.appliedCustomerUUID();
    const status = this.appliedStatus();
    return this.vpsInstances().filter((item) => {
      const plan = this.planById(item.HostingVpsPlanHvpUUID);
      const matchesSearch =
        !search ||
        item.HviName.toLowerCase().includes(search) ||
        (item.CustomerName ?? '').toLowerCase().includes(search) ||
        (item.HviStatus ?? '').toLowerCase().includes(search) ||
        (plan?.HvpRegion ?? '').toLowerCase().includes(search) ||
        (plan?.HvpSize ?? '').toLowerCase().includes(search) ||
        (this.instanceImageValue(item) ?? '').toLowerCase().includes(search) ||
        this.providerNameById(item.HostingVpsProviderHvrUUID).toLowerCase().includes(search) ||
        this.planNameById(item.HostingVpsPlanHvpUUID).toLowerCase().includes(search);
      const matchesStatus =
        status === '' ||
        (status === '1' && item.HviIsActive === 1) ||
        (status === '0' && item.HviIsActive !== 1);
      const matchesCustomer = !customerUUID || item.CustomerCusUUID === customerUUID;
      return matchesSearch && matchesCustomer && matchesStatus;
    });
  });
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  readonly loading = this.instancesResource.isLoading;
  readonly saving = signal(false);
  readonly retryingInstanceUUIDs = signal<Set<string>>(new Set());
  readonly changingPlan = signal(false);
  readonly catalogLoading = signal(false);
  readonly catalog = signal<VpsProviderCatalog | null>(null);
  readonly catalogProviderUUID = signal<string | null>(null);
  readonly editing = signal<HostingVpsInstance | null>(null);
  readonly changePlanInstance = signal<HostingVpsInstance | null>(null);
  readonly targetPlanUUID = signal('');
  readonly planSearch = signal('');
  readonly customerSearch = signal('');
  readonly imageSearch = signal('');
  readonly currentRegion = signal('');
  readonly currentSize = signal('');
  readonly currentImage = signal('');
  readonly selectedInstanceUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedInstanceUUIDs().size);

  readonly displayedColumns = [
    'select',
    'name',
    'customer',
    'plan',
    'provider',
    'region',
    'size',
    'image',
    'status',
    'runtimeStatus',
    'actions',
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    customerUUID: [''],
    status: [''],
  });

  readonly instanceForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    customerUUID: ['', [Validators.required]],
    planUUID: ['', [Validators.required]],
    image: [''],
    sshKey: [''],
    notes: [''],
    status: [''],
    isActive: [1, [Validators.required]],
  });

  readonly availableRegions = computed(() => this.catalog()?.regions ?? []);
  readonly availableSizes = computed(() => this.catalog()?.sizes ?? []);
  readonly availableImages = computed(() => this.catalog()?.images ?? []);
  readonly regionOptions = computed(() =>
    this.withCurrentOption(this.availableRegions(), this.currentRegion()),
  );
  readonly sizeOptions = computed(() =>
    this.withCurrentOption(this.availableSizes(), this.currentSize()),
  );
  readonly imageOptions = computed(() =>
    this.withCurrentOption(this.availableImages(), this.currentImage()),
  );
  readonly filteredImageOptions = computed(() =>
    this.filterCatalogOptions(this.imageOptions(), this.imageSearch()),
  );
  readonly filteredCustomers = computed(() => {
    const search = this.customerSearch().trim().toLowerCase();
    const items = this.customers();
    if (!search) return items;
    return items.filter((customer) =>
      [customer.Name, customer.Document]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  });
  readonly changePlanOptions = computed(() => {
    const instance = this.changePlanInstance();
    if (!instance) return [];
    const current = this.planById(instance.HostingVpsPlanHvpUUID);
    if (!current) return [];
    const currentDisk = this.planDiskGb(current);
    return this.plans()
      .filter(
        (plan) =>
          plan.HvpIsActive === 1 &&
          plan.HvpUUID !== current.HvpUUID &&
          plan.HostingVpsProviderHvrUUID === current.HostingVpsProviderHvrUUID &&
          plan.HvpProvider === current.HvpProvider &&
          (plan.HvpRegion ?? '') === (current.HvpRegion ?? '') &&
          !!plan.HvpSize,
      )
      .map((plan) => ({
        plan,
        diskChange: this.planDiskGb(plan) - currentDisk,
        blocked: this.planDiskGb(plan) < currentDisk,
      }));
  });

  constructor() {
    this.instanceForm.controls.planUUID.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.applySelectedPlan(value));
    this.instanceForm.controls.image.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.currentImage.set(value ?? ''));
    void this.loadProviders();
    void this.loadCustomers();
    void this.loadPlans();
  }

  ngOnDestroy() {
    this.closeDialog();
    this.closeChangePlanDialog();
    this.stopDialogViewportObserver();
  }

  refreshList() {
    void this.loadProviders();
    void this.loadCustomers();
    void this.loadPlans();
    this.instancesResource.reload();
  }

  applyFilters() {
    const values = this.filterForm.getRawValue();
    this.appliedSearch.set(values.search);
    this.appliedCustomerUUID.set(values.customerUUID);
    this.appliedStatus.set(values.status);
    this.resetPagination();
    this.instancesResource.reload();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', customerUUID: '', status: '' });
    this.applyFilters();
  }

  get filteredPlans() {
    const value = this.planSearch().trim().toLowerCase();
    const activePlans = this.plans().filter((plan) => plan.HvpIsActive === 1);
    if (!value) return activePlans;
    return activePlans.filter(
      (plan) =>
        plan.HvpName.toLowerCase().includes(value) ||
        this.providerNameById(plan.HostingVpsProviderHvrUUID).toLowerCase().includes(value) ||
        plan.HvpProvider.toLowerCase().includes(value) ||
        (plan.HvpRegion ?? '').toLowerCase().includes(value) ||
        (plan.HvpSize ?? '').toLowerCase().includes(value),
    );
  }

  onPlanOpened(opened: boolean) {
    if (!opened) this.planSearch.set('');
  }

  onCustomerOpened(opened: boolean) {
    if (!opened) this.customerSearch.set('');
  }

  onImageOpened(opened: boolean) {
    if (!opened) this.imageSearch.set('');
  }

  selectedPlan() {
    const uuid = this.normalizeString(this.instanceForm.controls.planUUID.value);
    if (!uuid) return null;
    return this.plans().find((plan) => plan.HvpUUID === uuid) ?? null;
  }

  selectedPlanProviderLabel() {
    const plan = this.selectedPlan();
    if (!plan) return '';
    return this.providerNameById(plan.HostingVpsProviderHvrUUID);
  }

  selectedPlanCatalogLabel(controlName: 'region' | 'size') {
    const plan = this.selectedPlan();
    if (!plan) return '';
    const value = this.normalizeString(controlName === 'region' ? plan.HvpRegion : plan.HvpSize);
    if (!value) return '';
    const options = controlName === 'region' ? this.regionOptions() : this.sizeOptions();
    return options.find((option) => option.id === value)?.label ?? value;
  }

  selectedCatalogLabel(controlName: 'image', options: VpsCatalogOption[]) {
    const value = this.normalizeString(this.instanceForm.controls[controlName].value);
    if (!value) return '';
    return options.find((option) => option.id === value)?.label ?? value;
  }

  selectedImageLabel() {
    const value = this.normalizeString(this.instanceForm.controls.image.value);
    if (!value) return '';
    const option = this.imageOptions().find((item) => item.id === value);
    if (!option) return value;
    return [this.imageOptionName(option), this.imageOptionVersionArch(option)]
      .filter(Boolean)
      .join(' ');
  }

  imageOptionName(option: VpsCatalogOption) {
    return option.name || option.label || option.id;
  }

  imageOptionVersionArch(option: VpsCatalogOption) {
    return [option.version, option.architecture].filter(Boolean).join(' ');
  }

  imageOptionMeta(option: VpsCatalogOption) {
    return [option.source, option.type].filter(Boolean).join(' · ');
  }

  imageOptionSlug(option: VpsCatalogOption) {
    return option.slug || option.id;
  }

  statusLabel(item: HostingVpsInstance) {
    return item.HviIsActive === 1 ? 'Active' : 'Inactive';
  }

  canRetryProvision(item: HostingVpsInstance) {
    const status = (item.HviStatus ?? '').trim().toLowerCase();
    return (
      item.HviIsActive === 1 &&
      !item.HviExternalId &&
      ['', 'failed', 'queue_failed'].includes(status)
    );
  }

  isRetrying(item: HostingVpsInstance) {
    return this.retryingInstanceUUIDs().has(item.HviUUID);
  }

  canChangePlan(item: HostingVpsInstance) {
    const plan = this.planById(item.HostingVpsPlanHvpUUID);
    const resizeStatus = item.HviConfig?.resize?.status ?? '';
    return (
      item.HviIsActive === 1 &&
      !!item.HviExternalId &&
      plan?.HvpProvider === 'digitalocean' &&
      !['resize_queued', 'resizing', 'powering_on'].includes(item.HviStatus ?? '') &&
      !['queued', 'resizing', 'powering_on'].includes(resizeStatus)
    );
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

  instanceConfigValue(item: HostingVpsInstance, key: keyof HostingVpsInstanceConfig) {
    const config = item.HviConfig ?? {};
    return config?.[key] ?? null;
  }

  instancePlanValue(item: HostingVpsInstance, key: 'HvpRegion' | 'HvpSize' | 'HvpImage') {
    return this.planById(item.HostingVpsPlanHvpUUID)?.[key] ?? null;
  }

  instanceImageValue(item: HostingVpsInstance) {
    const image =
      this.instanceConfigValue(item, 'providerImageId') ?? this.instancePlanValue(item, 'HvpImage');
    return typeof image === 'string' ? image : null;
  }

  providerNameById(uuid: string | null | undefined) {
    if (!uuid) return 'Default provider';
    return this.providers().find((acc) => acc.HvrUUID === uuid)?.HvrName ?? 'Unknown provider';
  }

  planNameById(uuid: string | null | undefined) {
    if (!uuid) return 'No plan';
    return this.planById(uuid)?.HvpName ?? 'Unknown plan';
  }

  customerLabel(customer: CustomerOption) {
    return [customer.Name, customer.Document].filter(Boolean).join(' · ');
  }

  instanceCustomerLabel(item: HostingVpsInstance) {
    return item.CustomerName || '-';
  }

  planById(uuid: string | null | undefined) {
    if (!uuid) return null;
    return this.plans().find((plan) => plan.HvpUUID === uuid) ?? null;
  }

  planDiskGb(plan: HostingVpsPlan | null | undefined) {
    const value = Number(plan?.HvpConfig?.diskGb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  planSpecLabel(plan: HostingVpsPlan | null | undefined) {
    if (!plan) return '';
    const config = plan.HvpConfig ?? {};
    return [
      config.cpu ? `${config.cpu} CPU` : null,
      config.memoryMb ? `${config.memoryMb} MB` : null,
      config.diskGb ? `${config.diskGb} GB` : null,
      plan.HvpSize,
    ]
      .filter(Boolean)
      .join(' / ');
  }

  async loadProviders() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        this.providerEndpoint(),
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.providers.set(
        list.map((item) => ({
          ...item,
          HvrConfig: this.parseConfig<VpsProviderConfig>(item.HvrConfig),
        })),
      );
      this.applySelectedPlan(this.instanceForm.controls.planUUID.value);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load VPS providers.'));
    }
  }

  async loadCustomers() {
    if (this.isMaster()) {
      this.customers.set([]);
      return;
    }
    try {
      const result = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        `${this.customerEndpoint}?status=1&limit=500&offset=0`,
      );
      this.customers.set(result?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load customers.'));
    }
  }

  async loadPlans() {
    try {
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      const result = await this.api.get<{ data?: { items?: HostingVpsPlan[] } }>(
        `${this.planEndpoint()}?${params.toString()}`,
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.plans.set(
        list.map((item) => ({
          ...item,
          HvpConfig: this.parseConfig<HostingVpsPlanConfig>(item.HvpConfig),
        })),
      );
      this.applySelectedPlan(this.instanceForm.controls.planUUID.value);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load VPS plans.'));
    }
  }

  private async fetchInstances(filters: VpsInstanceFilters): Promise<HostingVpsInstance[]> {
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filters.search) params.set('search', filters.search);
    if (filters.customerUUID) params.set('customerUUID', filters.customerUUID);
    if (filters.status === '0' || filters.status === '1') params.set('status', filters.status);

    const result = await this.api.get<{ data?: { items?: HostingVpsInstance[] } }>(
      `${this.instanceEndpoint()}?${params.toString()}`,
    );
    const list = Array.isArray(result?.data?.items) ? result.data.items : [];
    return list.map((item) => ({
      ...item,
      HviConfig: this.parseConfig<HostingVpsInstanceConfig>(item.HviConfig),
    }));
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
      const result = await this.api.get<{ data?: { catalog?: VpsProviderCatalog } }>(
        `${this.providerEndpoint()}/${uuid}/catalog`,
      );
      this.catalog.set(result?.data?.catalog ?? null);
    } catch (error) {
      this.catalog.set(null);
      this.snack.error(this.friendlyError(error, 'Failed to load provider catalog.'));
    } finally {
      this.catalogLoading.set(false);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.setProvisionedEditControls(false);
    this.resetForm();
    void this.loadProviderCatalog();
    this.openDialog();
  }

  startEdit(item: HostingVpsInstance) {
    const config = item.HviConfig ?? {};
    const legacyPlanImage = this.planById(item.HostingVpsPlanHvpUUID)?.HvpImage ?? '';
    const image = config.providerImageId ?? legacyPlanImage;
    this.editing.set(item);
    this.activePlanUUID = item.HostingVpsPlanHvpUUID ?? '';
    this.instanceForm.reset({
      name: item.HviName,
      customerUUID: item.CustomerCusUUID ?? '',
      planUUID: item.HostingVpsPlanHvpUUID ?? '',
      image: image ?? '',
      sshKey: config.sshKey ?? '',
      notes: config.notes ?? '',
      status: item.HviStatus ?? '',
      isActive: item.HviIsActive === 1 ? 1 : 0,
    });
    this.currentRegion.set('');
    this.currentSize.set('');
    this.currentImage.set(image ?? '');
    this.applySelectedPlan(item.HostingVpsPlanHvpUUID ?? '');
    this.setProvisionedEditControls(!!item.HviExternalId);
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    if (this.instanceForm.invalid) {
      this.instanceForm.markAllAsTouched();
      this.snack.warning('Please fill all required fields.');
      return;
    }

    this.saving.set(true);
    const values = this.instanceForm.getRawValue();
    const plan = this.plans().find((item) => item.HvpUUID === values.planUUID);
    if (!plan) {
      this.saving.set(false);
      this.snack.warning('Select a valid VPS plan.');
      return;
    }
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      customerUUID: values.customerUUID,
      planUUID: plan.HvpUUID,
      config: this.buildConfigPayload(),
      status: this.normalizeString(values.status),
      isActive: values.isActive === 1,
    };

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.instanceEndpoint()}/${editing.HviUUID}`, payload);
        this.snack.success('VPS instance updated.');
      } else {
        await this.api.post(this.instanceEndpoint(), payload);
        this.snack.success('VPS instance queued for provisioning.');
      }
      this.instancesResource.reload();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save VPS instance.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async remove(item: HostingVpsInstance) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete VPS instance',
        message: `Delete "${item.HviName}" from MNSCloud and destroy the provider VPS when linked?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.instanceEndpoint()}/${item.HviUUID}`);
      this.snack.success('VPS instance deleted.');
      this.instancesResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete VPS instance.'));
    }
  }

  async retryProvision(item: HostingVpsInstance) {
    if (!this.canRetryProvision(item) || this.isRetrying(item)) return;

    const errorMessage = this.instanceConfigValue(item, 'provisionError');
    const details =
      typeof errorMessage === 'string' && errorMessage.trim()
        ? ` Last error: ${errorMessage.trim()}`
        : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Retry VPS provisioning',
        message: `Retry provider provisioning for "${item.HviName}"? This can create a VPS and may generate provider charges.${details}`,
        confirmLabel: 'Retry provisioning',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.retryingInstanceUUIDs.update((current) => new Set(current).add(item.HviUUID));
    try {
      const response = await this.api.post<{
        data?: { item?: HostingVpsInstance };
      }>(`${this.instanceEndpoint()}/${item.HviUUID}/retry-provision`, {});
      const updated = response?.data?.item;
      if (updated) {
        this.vpsInstances.update((rows) =>
          rows.map((row) =>
            row.HviUUID === updated.HviUUID
              ? {
                  ...updated,
                  HviConfig: this.parseConfig<HostingVpsInstanceConfig>(updated.HviConfig),
                }
              : row,
          ),
        );
      }
      this.instancesResource.reload();
      if ((updated?.HviStatus ?? '').toLowerCase() === 'queue_failed') {
        this.snack.error('VPS provisioning retry could not be queued.');
      } else {
        this.snack.success('VPS provisioning retry queued.');
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to retry VPS provisioning.'));
    } finally {
      this.retryingInstanceUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(item.HviUUID);
        return next;
      });
    }
  }

  startChangePlan(item: HostingVpsInstance) {
    const changePlanDialog = this.changePlanDialog();
    if (!this.canChangePlan(item) || !changePlanDialog) return;
    this.changePlanInstance.set(item);
    this.targetPlanUUID.set('');
    this.changePlanDialogRef = this.dialog.open(changePlanDialog, {
      width: 'min(720px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-vps-change-plan-dialog',
    });
    this.changePlanDialogRef.afterClosed().subscribe(() => {
      this.changePlanDialogRef = null;
      this.changePlanInstance.set(null);
      this.targetPlanUUID.set('');
    });
  }

  closeChangePlanDialog() {
    if (!this.changePlanDialogRef) return;
    this.changePlanDialogRef.close();
    this.changePlanDialogRef = null;
  }

  selectedTargetPlan() {
    const uuid = this.normalizeString(this.targetPlanUUID());
    if (!uuid) return null;
    return this.plans().find((plan) => plan.HvpUUID === uuid) ?? null;
  }

  async changePlan() {
    const instance = this.changePlanInstance();
    const targetPlanUUID = this.normalizeString(this.targetPlanUUID());
    if (!instance || !targetPlanUUID) {
      this.snack.warning('Select a target VPS plan.');
      return;
    }

    const target = this.selectedTargetPlan();
    if (!target) {
      this.snack.warning('Select a valid target VPS plan.');
      return;
    }

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Change VPS plan',
        message: `Queue plan change for "${instance.HviName}" to "${target.HvpName}"? Provider billing and resize rules apply.`,
        confirmLabel: 'Change plan',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.changingPlan.set(true);
    try {
      const response = await this.api.post<{
        data?: { item?: HostingVpsInstance };
      }>(`${this.instanceEndpoint()}/${instance.HviUUID}/change-plan`, { targetPlanUUID });
      const updated = response?.data?.item;
      if (updated) {
        this.vpsInstances.update((rows) =>
          rows.map((row) =>
            row.HviUUID === updated.HviUUID
              ? {
                  ...updated,
                  HviConfig: this.parseConfig<HostingVpsInstanceConfig>(updated.HviConfig),
                }
              : row,
          ),
        );
      }
      this.instancesResource.reload();
      this.closeChangePlanDialog();
      this.snack.success('VPS plan change queued.');
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to change VPS plan.'));
    } finally {
      this.changingPlan.set(false);
    }
  }

  isSelected(item: HostingVpsInstance) {
    return this.selectedInstanceUUIDs().has(item.HviUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleInstanceSelection(item: HostingVpsInstance, checked: boolean) {
    this.selectedInstanceUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item.HviUUID);
      } else {
        next.delete(item.HviUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedInstanceUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        if (checked) {
          next.add(row.HviUUID);
        } else {
          next.delete(row.HviUUID);
        }
      }
      return next;
    });
  }

  async removeSelectedInstances() {
    const ids = Array.from(this.selectedInstanceUUIDs());
    if (!ids.length) return;
    const labels = this.vpsInstances()
      .filter((item) => ids.includes(item.HviUUID))
      .slice(0, 3)
      .map((item) => item.HviName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected VPS instances',
        message: `Delete ${ids.length} selected VPS instance(s) from MNSCloud and destroy linked provider VPS resources?${suffix}`,
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
          failed?: { HostingVpsInstanceUUID: string; message: string }[];
        };
      }>(`${this.instanceEndpoint()}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingVpsInstanceUUID),
      );
      this.vpsInstances.update((rows) => rows.filter((row) => !deleted.has(row.HviUUID)));
      this.selectedInstanceUUIDs.set(failed);
      this.instancesResource.reload();
      if (failed.size) {
        this.snack.error(`${failed.size} VPS instance(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} VPS instance(s) deleted.`);
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected VPS instances.'));
    }
  }

  private applySelectedPlan(uuid: string | null) {
    const normalized = this.normalizeString(uuid);
    if (!normalized) {
      this.activePlanUUID = '';
      this.instanceForm.controls.image.setValue('', { emitEvent: false });
      this.currentImage.set('');
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      return;
    }
    const plan = this.plans().find((item) => item.HvpUUID === normalized);
    if (!plan) return;
    const planChanged = this.activePlanUUID !== normalized;
    this.activePlanUUID = normalized;
    this.currentRegion.set(plan.HvpRegion ?? '');
    this.currentSize.set(plan.HvpSize ?? '');
    let selectedImage = this.normalizeString(this.instanceForm.controls.image.value);
    if (planChanged) {
      selectedImage = null;
      this.instanceForm.controls.image.setValue('', { emitEvent: false });
    }
    if (selectedImage) {
      this.currentImage.set(selectedImage);
    } else if (plan.HvpImage) {
      this.instanceForm.controls.image.setValue(plan.HvpImage, { emitEvent: false });
      this.currentImage.set(plan.HvpImage);
    } else {
      this.currentImage.set('');
    }
    void this.loadProviderCatalog();
  }

  private buildConfigPayload(): HostingVpsInstanceConfig {
    const values = this.instanceForm.getRawValue();
    const config: HostingVpsInstanceConfig = {};
    const sshKey = this.normalizeString(values.sshKey);
    const providerImageId = this.normalizeString(values.image);
    const notes = this.normalizeString(values.notes);
    if (sshKey) config.sshKey = sshKey;
    if (providerImageId) config.providerImageId = providerImageId;
    if (notes) config.notes = notes;
    return config;
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

  private withCurrentOption(options: VpsCatalogOption[], current: string): VpsCatalogOption[] {
    const normalized = this.normalizeString(current);
    if (!normalized || options.some((opt) => opt.id === normalized)) return options;
    return [
      {
        id: normalized,
        label: `Custom: ${normalized}`,
        source: 'Custom',
        name: normalized,
        slug: normalized,
      },
      ...options,
    ];
  }

  private filterCatalogOptions(options: VpsCatalogOption[], search: string): VpsCatalogOption[] {
    const value = search.trim().toLowerCase();
    if (!value) return options;
    return options.filter((option) =>
      [
        option.id,
        option.label,
        option.source,
        option.name,
        option.version,
        option.architecture,
        option.type,
        option.slug,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value)),
    );
  }

  private resolveCatalogProviderUUID(): string | null {
    const plan = this.selectedPlan();
    if (!plan) return null;
    return this.resolveProviderUUIDForPlan(plan);
  }

  private resolveProviderUUIDForPlan(plan: HostingVpsPlan): string {
    const directProvider = this.providers().find(
      (acc) => acc.HvrUUID === plan.HostingVpsProviderHvrUUID && acc.HvrIsActive === 1,
    );
    if (directProvider) return directProvider.HvrUUID;

    return (
      this.providers().find(
        (acc) =>
          acc.HvrProvider === plan.HvpProvider && acc.HvrIsActive === 1 && acc.HvrIsDefault === 1,
      )?.HvrUUID ??
      this.providers().find((acc) => acc.HvrProvider === plan.HvpProvider && acc.HvrIsActive === 1)
        ?.HvrUUID ??
      ''
    );
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

  private resetForm() {
    this.activePlanUUID = '';
    this.setProvisionedEditControls(false);
    this.instanceForm.reset({
      name: '',
      customerUUID: '',
      planUUID: '',
      image: '',
      sshKey: '',
      notes: '',
      status: '',
      isActive: 1,
    });
    this.currentRegion.set('');
    this.currentSize.set('');
    this.currentImage.set('');
    this.planSearch.set('');
    this.customerSearch.set('');
    this.imageSearch.set('');
  }

  private setProvisionedEditControls(isProvisioned: boolean) {
    const controls = [
      this.instanceForm.controls.planUUID,
      this.instanceForm.controls.image,
      this.instanceForm.controls.sshKey,
      this.instanceForm.controls.status,
    ];
    for (const control of controls) {
      if (isProvisioned) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcileInstanceSelection() {
    const available = new Set(this.vpsInstances().map((item) => item.HviUUID));
    this.selectedInstanceUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingVpsInstance[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    return [...rows].sort((a, b) => {
      const compared = this.compareValues(
        this.instanceSortValue(a, active),
        this.instanceSortValue(b, active),
      );
      return direction === 'asc' ? compared : -compared;
    });
  }

  private instanceSortValue(item: HostingVpsInstance, column: string) {
    const plan = this.planById(item.HostingVpsPlanHvpUUID);
    switch (column) {
      case 'name':
        return item.HviName;
      case 'customer':
        return this.instanceCustomerLabel(item);
      case 'plan':
        return this.planNameById(item.HostingVpsPlanHvpUUID);
      case 'provider':
        return this.providerNameById(item.HostingVpsProviderHvrUUID);
      case 'region':
        return plan?.HvpRegion ?? '';
      case 'size':
        return plan?.HvpSize ?? '';
      case 'image':
        return this.instanceImageValue(item) ?? '';
      case 'status':
        return item.HviIsActive;
      case 'runtimeStatus':
        return item.HviStatus ?? '';
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

  private openDialog() {
    const instanceFormDialog = this.instanceFormDialog();
    if (!instanceFormDialog || this.dialogRef) return;
    this.dialogRef = this.dialog.open(instanceFormDialog, {
      ...getVpsDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-vps-instance-dialog',
    });
    this.dialogRef.keydownEvents().pipe(takeUntil(this.dialogRef.afterClosed())).subscribe((event: KeyboardEvent) => {
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
