import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  TemplateRef,
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
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  getVpsDialogViewportConfig,
  updateVpsDialogViewport,
} from '../vps-container-dialog-viewport';
import type {
  HostingVpsContainerInstance,
  HostingVpsContainerInstanceConfig,
  HostingVpsContainerPlan,
  HostingVpsContainerPlanConfig,
  HostingVpsContainerProvider,
  VpsContainerCatalogOption,
  VpsContainerProviderCatalog,
  VpsContainerProviderConfig,
} from '../vps-container.types';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Status?: number | null;
};

type VpsContainerInstanceFilters = {
  search: string;
  customerUUID: string;
  status: string;
};

type VpsContainerInstanceFormModel = {
  name: string;
  customerUUID: string;
  planUUID: string;
  image: string;
  sshKey: string;
  notes: string;
  status: string;
  isActive: number;
};

@Component({
  selector: 'app-hosting-vps-container-instances',
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
  templateUrl: './instances.html',
  styleUrls: ['./instances.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingVpsContainerInstancesPage {
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
    this.isMaster() ? 'system/hosting/vps-container/providers' : 'hosting/vps-container/providers',
  );
  readonly instanceEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps-container/instances' : 'hosting/vps-container/instances',
  );
  readonly planEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps-container/plans' : 'hosting/vps-container/plans',
  );
  readonly customerEndpoint = 'erp/customers';

  readonly customers = signal<CustomerOption[]>([]);
  readonly providers = signal<HostingVpsContainerProvider[]>([]);
  readonly plans = signal<HostingVpsContainerPlan[]>([]);
  readonly vpsInstances = signal<HostingVpsContainerInstance[]>([]);
  readonly appliedSearch = signal('');
  readonly appliedCustomerUUID = signal('');
  readonly appliedStatus = signal('');
  private readonly instancesResource = resource({
    defaultValue: [] as HostingVpsContainerInstance[],
    params: (): VpsContainerInstanceFilters => ({
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
    if (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load VPS Container instances.'));
    }
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
      const plan = this.planById(item.HostingVpsContainerPlanHcnUUID);
      const matchesSearch =
        !search ||
        item.HciName.toLowerCase().includes(search) ||
        (item.CustomerName ?? '').toLowerCase().includes(search) ||
        (item.HciStatus ?? '').toLowerCase().includes(search) ||
        (plan?.HcnRegion ?? '').toLowerCase().includes(search) ||
        (plan?.HcnSize ?? '').toLowerCase().includes(search) ||
        (this.instanceImageValue(item) ?? '').toLowerCase().includes(search) ||
        this.providerNameById(item.HostingVpsContainerProviderHcpUUID)
          .toLowerCase()
          .includes(search) ||
        this.planNameById(item.HostingVpsContainerPlanHcnUUID).toLowerCase().includes(search);
      const matchesStatus =
        status === '' ||
        (status === '1' && item.HciIsActive === 1) ||
        (status === '0' && item.HciIsActive !== 1);
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
  readonly catalog = signal<VpsContainerProviderCatalog | null>(null);
  readonly catalogProviderUUID = signal<string | null>(null);
  readonly editing = signal<HostingVpsContainerInstance | null>(null);
  readonly changePlanInstance = signal<HostingVpsContainerInstance | null>(null);
  readonly targetPlanUUID = signal('');
  readonly planSearch = signal('');
  readonly customerSearch = signal('');
  readonly imageSearch = signal('');
  readonly currentRegion = signal('');
  readonly currentSize = signal('');
  readonly currentImage = signal('');
  readonly selectedInstanceUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedInstanceUUIDs().size);
  readonly isProvisionedEdit = signal(false);

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

  readonly filterFormModel = signal<VpsContainerInstanceFilters>({
    search: '',
    customerUUID: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly instanceFormModel = signal<VpsContainerInstanceFormModel>({
    name: '',
    customerUUID: '',
    planUUID: '',
    image: '',
    sshKey: '',
    notes: '',
    status: '',
    isActive: 1,
  });
  readonly instanceForm = createForm(this.instanceFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.customerUUID);
    required(schema.planUUID);
    required(schema.isActive);
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
    const current = this.planById(instance.HostingVpsContainerPlanHcnUUID);
    if (!current) return [];
    const currentDisk = this.planDiskGb(current);
    return this.plans()
      .filter(
        (plan) =>
          plan.HcnIsActive === 1 &&
          plan.HcnUUID !== current.HcnUUID &&
          plan.HostingVpsContainerProviderHcpUUID === current.HostingVpsContainerProviderHcpUUID &&
          plan.HcnProvider === current.HcnProvider &&
          (plan.HcnRegion ?? '') === (current.HcnRegion ?? '') &&
          !!plan.HcnSize,
      )
      .map((plan) => ({
        plan,
        diskChange: this.planDiskGb(plan) - currentDisk,
        blocked: this.planDiskGb(plan) < currentDisk,
      }));
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeDialog();
      this.closeChangePlanDialog();
      this.stopDialogViewportObserver();
    });
    void this.fetchProviders();
    void this.fetchCustomers();
    void this.fetchPlans();
  }

  private readonly syncSelectedPlan = effect(() => {
    this.applySelectedPlan(this.instanceFormModel().planUUID);
  });
  private readonly syncCurrentImage = effect(() => {
    this.currentImage.set(this.instanceFormModel().image ?? '');
  });

  refreshList() {
    void this.fetchProviders();
    void this.fetchCustomers();
    void this.fetchPlans();
    this.instancesResource.reload();
  }

  applyFilters() {
    const values = this.filterFormModel();
    this.appliedSearch.set(values.search);
    this.appliedCustomerUUID.set(values.customerUUID);
    this.appliedStatus.set(values.status);
    this.resetPagination();
    this.instancesResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({ search: '', customerUUID: '', status: '' });
    this.applyFilters();
  }

  get filteredPlans() {
    const value = this.planSearch().trim().toLowerCase();
    const activePlans = this.plans().filter((plan) => plan.HcnIsActive === 1);
    if (!value) return activePlans;
    return activePlans.filter(
      (plan) =>
        plan.HcnName.toLowerCase().includes(value) ||
        this.providerNameById(plan.HostingVpsContainerProviderHcpUUID)
          .toLowerCase()
          .includes(value) ||
        plan.HcnProvider.toLowerCase().includes(value) ||
        (plan.HcnRegion ?? '').toLowerCase().includes(value) ||
        (plan.HcnSize ?? '').toLowerCase().includes(value),
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
    const uuid = this.normalizeString(this.instanceFormModel().planUUID);
    if (!uuid) return null;
    return this.plans().find((plan) => plan.HcnUUID === uuid) ?? null;
  }

  selectedPlanProviderLabel() {
    const plan = this.selectedPlan();
    if (!plan) return '';
    return this.providerNameById(plan.HostingVpsContainerProviderHcpUUID);
  }

  selectedPlanCatalogLabel(controlName: 'region' | 'size') {
    const plan = this.selectedPlan();
    if (!plan) return '';
    const value = this.normalizeString(controlName === 'region' ? plan.HcnRegion : plan.HcnSize);
    if (!value) return '';
    const options = controlName === 'region' ? this.regionOptions() : this.sizeOptions();
    return options.find((option) => option.id === value)?.label ?? value;
  }

  selectedCatalogLabel(controlName: 'image', options: VpsContainerCatalogOption[]) {
    const value = this.normalizeString(this.instanceFormModel()[controlName]);
    if (!value) return '';
    return options.find((option) => option.id === value)?.label ?? value;
  }

  selectedImageLabel() {
    const value = this.normalizeString(this.instanceFormModel().image);
    if (!value) return '';
    const option = this.imageOptions().find((item) => item.id === value);
    if (!option) return value;
    return [this.imageOptionName(option), this.imageOptionVersionArch(option)]
      .filter(Boolean)
      .join(' ');
  }

  imageOptionName(option: VpsContainerCatalogOption) {
    return option.name || option.label || option.id;
  }

  imageOptionVersionArch(option: VpsContainerCatalogOption) {
    return [option.version, option.architecture].filter(Boolean).join(' ');
  }

  imageOptionMeta(option: VpsContainerCatalogOption) {
    return [option.source, option.type].filter(Boolean).join(' · ');
  }

  imageOptionSlug(option: VpsContainerCatalogOption) {
    return option.slug || option.id;
  }

  statusLabel(item: HostingVpsContainerInstance) {
    return item.HciIsActive === 1 ? 'Active' : 'Inactive';
  }

  canRetryProvision(item: HostingVpsContainerInstance) {
    const status = (item.HciStatus ?? '').trim().toLowerCase();
    return (
      item.HciIsActive === 1 &&
      !item.HciExternalId &&
      ['', 'failed', 'queue_failed'].includes(status)
    );
  }

  isRetrying(item: HostingVpsContainerInstance) {
    return this.retryingInstanceUUIDs().has(item.HciUUID);
  }

  canChangePlan(item: HostingVpsContainerInstance) {
    void item;
    return false;
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

  instanceConfigValue(
    item: HostingVpsContainerInstance,
    key: keyof HostingVpsContainerInstanceConfig,
  ) {
    const config = item.HciConfig ?? {};
    return config?.[key] ?? null;
  }

  instancePlanValue(item: HostingVpsContainerInstance, key: 'HcnRegion' | 'HcnSize' | 'HcnImage') {
    return this.planById(item.HostingVpsContainerPlanHcnUUID)?.[key] ?? null;
  }

  instanceImageValue(item: HostingVpsContainerInstance) {
    const image =
      this.instanceConfigValue(item, 'providerImageId') ?? this.instancePlanValue(item, 'HcnImage');
    return typeof image === 'string' ? image : null;
  }

  providerNameById(uuid: string | null | undefined) {
    if (!uuid) return 'Default provider';
    return this.providers().find((acc) => acc.HcpUUID === uuid)?.HcpName ?? 'Unknown provider';
  }

  planNameById(uuid: string | null | undefined) {
    if (!uuid) return 'No plan';
    return this.planById(uuid)?.HcnName ?? 'Unknown plan';
  }

  customerLabel(customer: CustomerOption) {
    return [customer.Name, customer.Document].filter(Boolean).join(' · ');
  }

  instanceCustomerLabel(item: HostingVpsContainerInstance) {
    return item.CustomerName || '-';
  }

  planById(uuid: string | null | undefined) {
    if (!uuid) return null;
    return this.plans().find((plan) => plan.HcnUUID === uuid) ?? null;
  }

  planDiskGb(plan: HostingVpsContainerPlan | null | undefined) {
    const value = Number(plan?.HcnConfig?.diskGb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  planSpecLabel(plan: HostingVpsContainerPlan | null | undefined) {
    if (!plan) return '';
    const config = plan.HcnConfig ?? {};
    return [
      config.cpu ? `${config.cpu} CPU` : null,
      config.memoryMb ? `${config.memoryMb} MB` : null,
      config.diskGb ? `${config.diskGb} GB` : null,
      plan.HcnSize,
    ]
      .filter(Boolean)
      .join(' / ');
  }

  async fetchProviders() {
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
      this.applySelectedPlan(this.instanceFormModel().planUUID);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load VPS Container providers.'));
    }
  }

  async fetchCustomers() {
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

  async fetchPlans() {
    try {
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      const result = await this.api.get<{ data?: { items?: HostingVpsContainerPlan[] } }>(
        `${this.planEndpoint()}?${params.toString()}`,
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.plans.set(
        list.map((item) => ({
          ...item,
          HcnConfig: this.parseConfig<HostingVpsContainerPlanConfig>(item.HcnConfig),
        })),
      );
      this.applySelectedPlan(this.instanceFormModel().planUUID);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load VPS Container plans.'));
    }
  }

  private async fetchInstances(
    filters: VpsContainerInstanceFilters,
  ): Promise<HostingVpsContainerInstance[]> {
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filters.search) params.set('search', filters.search);
    if (filters.customerUUID) params.set('customerUUID', filters.customerUUID);
    if (filters.status === '0' || filters.status === '1') params.set('status', filters.status);

    const result = await this.api.get<{ data?: { items?: HostingVpsContainerInstance[] } }>(
      `${this.instanceEndpoint()}?${params.toString()}`,
    );
    const list = Array.isArray(result?.data?.items) ? result.data.items : [];
    return list.map((item) => ({
      ...item,
      HciConfig: this.parseConfig<HostingVpsContainerInstanceConfig>(item.HciConfig),
    }));
  }

  async fetchProviderCatalog() {
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
    void this.fetchProviderCatalog();
    this.openDialog();
  }

  startEdit(item: HostingVpsContainerInstance) {
    const config = item.HciConfig ?? {};
    const legacyPlanImage = this.planById(item.HostingVpsContainerPlanHcnUUID)?.HcnImage ?? '';
    const image = config.providerImageId ?? legacyPlanImage;
    this.editing.set(item);
    this.activePlanUUID = item.HostingVpsContainerPlanHcnUUID ?? '';
    this.instanceFormModel.set({
      name: item.HciName,
      customerUUID: item.CustomerCusUUID ?? '',
      planUUID: item.HostingVpsContainerPlanHcnUUID ?? '',
      image: image ?? '',
      sshKey: config.sshKey ?? '',
      notes: config.notes ?? '',
      status: item.HciStatus ?? '',
      isActive: item.HciIsActive === 1 ? 1 : 0,
    });
    this.currentRegion.set('');
    this.currentSize.set('');
    this.currentImage.set(image ?? '');
    this.applySelectedPlan(item.HostingVpsContainerPlanHcnUUID ?? '');
    this.setProvisionedEditControls(!!item.HciExternalId);
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    if (!this.instanceForm().valid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    this.saving.set(true);
    const values = this.instanceFormModel();
    const plan = this.plans().find((item) => item.HcnUUID === values.planUUID);
    if (!plan) {
      this.saving.set(false);
      this.snack.warning('Select a valid VPS Container plan.');
      return;
    }
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      customerUUID: values.customerUUID,
      planUUID: plan.HcnUUID,
      config: this.buildConfigPayload(),
      status: this.normalizeString(values.status),
      isActive: values.isActive === 1,
    };

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.instanceEndpoint()}/${editing.HciUUID}`, payload);
        this.snack.success('VPS Container instance updated.');
      } else {
        await this.api.post(this.instanceEndpoint(), payload);
        this.snack.success('VPS Container instance queued for provisioning.');
      }
      this.instancesResource.reload();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save VPS Container instance.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async remove(item: HostingVpsContainerInstance) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete VPS Container instance',
        message: `Delete "${item.HciName}" from MNSCloud and destroy the provider VPS Container when linked?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.instanceEndpoint()}/${item.HciUUID}`);
      this.snack.success('VPS Container instance deleted.');
      this.instancesResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete VPS Container instance.'));
    }
  }

  async retryProvision(item: HostingVpsContainerInstance) {
    if (!this.canRetryProvision(item) || this.isRetrying(item)) return;

    const errorMessage = this.instanceConfigValue(item, 'provisionError');
    const details =
      typeof errorMessage === 'string' && errorMessage.trim()
        ? ` Last error: ${errorMessage.trim()}`
        : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Retry VPS Container provisioning',
        message: `Retry provider provisioning for "${item.HciName}"? This can create a VPS Container and may generate provider charges.${details}`,
        confirmLabel: 'Retry provisioning',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.retryingInstanceUUIDs.update((current) => new Set(current).add(item.HciUUID));
    try {
      const response = await this.api.post<{
        data?: { item?: HostingVpsContainerInstance };
      }>(`${this.instanceEndpoint()}/${item.HciUUID}/retry-provision`, {});
      const updated = response?.data?.item;
      if (updated) {
        this.vpsInstances.update((rows) =>
          rows.map((row) =>
            row.HciUUID === updated.HciUUID
              ? {
                  ...updated,
                  HciConfig: this.parseConfig<HostingVpsContainerInstanceConfig>(updated.HciConfig),
                }
              : row,
          ),
        );
      }
      this.instancesResource.reload();
      if ((updated?.HciStatus ?? '').toLowerCase() === 'queue_failed') {
        this.snack.error('VPS Container provisioning retry could not be queued.');
      } else {
        this.snack.success('VPS Container provisioning retry queued.');
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to retry VPS Container provisioning.'));
    } finally {
      this.retryingInstanceUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(item.HciUUID);
        return next;
      });
    }
  }

  startChangePlan(item: HostingVpsContainerInstance) {
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
      panelClass: 'hosting-vps-container-change-plan-dialog',
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
    return this.plans().find((plan) => plan.HcnUUID === uuid) ?? null;
  }

  async changePlan() {
    const instance = this.changePlanInstance();
    const targetPlanUUID = this.normalizeString(this.targetPlanUUID());
    if (!instance || !targetPlanUUID) {
      this.snack.warning('Select a target VPS Container plan.');
      return;
    }

    const target = this.selectedTargetPlan();
    if (!target) {
      this.snack.warning('Select a valid target VPS Container plan.');
      return;
    }

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Change VPS Container plan',
        message: `Queue plan change for "${instance.HciName}" to "${target.HcnName}"? Provider rules apply.`,
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
        data?: { item?: HostingVpsContainerInstance };
      }>(`${this.instanceEndpoint()}/${instance.HciUUID}/change-plan`, { targetPlanUUID });
      const updated = response?.data?.item;
      if (updated) {
        this.vpsInstances.update((rows) =>
          rows.map((row) =>
            row.HciUUID === updated.HciUUID
              ? {
                  ...updated,
                  HciConfig: this.parseConfig<HostingVpsContainerInstanceConfig>(updated.HciConfig),
                }
              : row,
          ),
        );
      }
      this.instancesResource.reload();
      this.closeChangePlanDialog();
      this.snack.success('VPS Container plan change queued.');
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to change VPS Container plan.'));
    } finally {
      this.changingPlan.set(false);
    }
  }

  isSelected(item: HostingVpsContainerInstance) {
    return this.selectedInstanceUUIDs().has(item.HciUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleInstanceSelection(item: HostingVpsContainerInstance, checked: boolean) {
    this.selectedInstanceUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item.HciUUID);
      } else {
        next.delete(item.HciUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedInstanceUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        if (checked) {
          next.add(row.HciUUID);
        } else {
          next.delete(row.HciUUID);
        }
      }
      return next;
    });
  }

  async removeSelectedInstances() {
    const ids = Array.from(this.selectedInstanceUUIDs());
    if (!ids.length) return;
    const labels = this.vpsInstances()
      .filter((item) => ids.includes(item.HciUUID))
      .slice(0, 3)
      .map((item) => item.HciName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected VPS Container instances',
        message: `Delete ${ids.length} selected VPS Container instance(s) from MNSCloud and destroy linked provider VPS Container resources?${suffix}`,
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
          failed?: { HostingVpsContainerInstanceUUID: string; message: string }[];
        };
      }>(`${this.instanceEndpoint()}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingVpsContainerInstanceUUID),
      );
      this.vpsInstances.update((rows) => rows.filter((row) => !deleted.has(row.HciUUID)));
      this.selectedInstanceUUIDs.set(failed);
      this.instancesResource.reload();
      if (failed.size) {
        this.snack.error(`${failed.size} VPS Container instance(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} VPS Container instance(s) deleted.`);
      }
    } catch (error) {
      this.snack.error(
        this.friendlyError(error, 'Failed to delete selected VPS Container instances.'),
      );
    }
  }

  private applySelectedPlan(uuid: string | null) {
    const normalized = this.normalizeString(uuid);
    if (!normalized) {
      this.activePlanUUID = '';
      this.instanceFormModel.update((current) => ({ ...current, image: '' }));
      this.currentImage.set('');
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      return;
    }
    const plan = this.plans().find((item) => item.HcnUUID === normalized);
    if (!plan) return;
    const planChanged = this.activePlanUUID !== normalized;
    this.activePlanUUID = normalized;
    this.currentRegion.set(plan.HcnRegion ?? '');
    this.currentSize.set(plan.HcnSize ?? '');
    let selectedImage = this.normalizeString(this.instanceFormModel().image);
    if (planChanged) {
      selectedImage = null;
      this.instanceFormModel.update((current) => ({ ...current, image: '' }));
    }
    if (selectedImage) {
      this.currentImage.set(selectedImage);
    } else if (plan.HcnImage) {
      this.instanceFormModel.update((current) => ({ ...current, image: plan.HcnImage ?? '' }));
      this.currentImage.set(plan.HcnImage);
    } else {
      this.currentImage.set('');
    }
    void this.fetchProviderCatalog();
  }

  private buildConfigPayload(): HostingVpsContainerInstanceConfig {
    const values = this.instanceFormModel();
    const config: HostingVpsContainerInstanceConfig = {};
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

  private withCurrentOption(
    options: VpsContainerCatalogOption[],
    current: string,
  ): VpsContainerCatalogOption[] {
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

  private filterCatalogOptions(
    options: VpsContainerCatalogOption[],
    search: string,
  ): VpsContainerCatalogOption[] {
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

  private resolveProviderUUIDForPlan(plan: HostingVpsContainerPlan): string {
    const directProvider = this.providers().find(
      (acc) => acc.HcpUUID === plan.HostingVpsContainerProviderHcpUUID && acc.HcpIsActive === 1,
    );
    if (directProvider) return directProvider.HcpUUID;

    return (
      this.providers().find(
        (acc) =>
          acc.HcpProvider === plan.HcnProvider && acc.HcpIsActive === 1 && acc.HcpIsDefault === 1,
      )?.HcpUUID ??
      this.providers().find((acc) => acc.HcpProvider === plan.HcnProvider && acc.HcpIsActive === 1)
        ?.HcpUUID ??
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
    this.instanceFormModel.set({
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
    this.isProvisionedEdit.set(isProvisioned);
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcileInstanceSelection() {
    const available = new Set(this.vpsInstances().map((item) => item.HciUUID));
    this.selectedInstanceUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingVpsContainerInstance[]) {
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

  private instanceSortValue(item: HostingVpsContainerInstance, column: string) {
    const plan = this.planById(item.HostingVpsContainerPlanHcnUUID);
    switch (column) {
      case 'name':
        return item.HciName;
      case 'customer':
        return this.instanceCustomerLabel(item);
      case 'plan':
        return this.planNameById(item.HostingVpsContainerPlanHcnUUID);
      case 'provider':
        return this.providerNameById(item.HostingVpsContainerProviderHcpUUID);
      case 'region':
        return plan?.HcnRegion ?? '';
      case 'size':
        return plan?.HcnSize ?? '';
      case 'image':
        return this.instanceImageValue(item) ?? '';
      case 'status':
        return item.HciIsActive;
      case 'runtimeStatus':
        return item.HciStatus ?? '';
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
      panelClass: 'hosting-vps-container-instance-dialog',
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
