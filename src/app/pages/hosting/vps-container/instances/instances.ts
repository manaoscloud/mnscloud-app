import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  VpsContainerChangePlanDialogComponent,
  VpsContainerChangePlanDialogData,
  VpsContainerChangePlanDialogResult,
} from './change-plan-dialog';
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

const RETRY_PROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'retry-provision',
  label: 'Retry provisioning',
  icon: 'replay',
  tooltip: 'Retry provisioning',
};

const CHANGE_PLAN_ACTION: ConfigurableCrudRowAction = {
  key: 'change-plan',
  label: 'Change plan',
  icon: 'swap_vert',
  tooltip: 'Change plan',
};

const HOSTING_VPS_CONTAINER_INSTANCE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps-container/instances',
  uuidField: 'HciUUID',
  pageTitle: 'VPS Container Instances',
  pageDescription: 'Register and track VPS Container instances for your tenant.',
  createTitle: 'New VPS Container instance',
  editTitle: 'Edit VPS Container instance',
  dialogDescription: 'Register an instance from the platform VPS Container plan catalog.',
  searchPlaceholder: 'Name, plan, provider, region, image or status',
  emptyLabel: 'No VPS Container instances found.',
  deleteTitle: 'Delete VPS Container instance',
  deleteMessage:
    'Delete this VPS Container instance from MNSCloud and destroy the provider VPS Container when linked?',
  deleteSelectedTitle: 'Delete selected VPS Container instances',
  deleteSelectedMessage:
    'Delete {count} selected VPS Container instance(s) from MNSCloud and destroy linked provider VPS Container resources?',
  savedMessage: 'VPS Container instance saved successfully.',
  deletedMessage: 'VPS Container instance deleted.',
  deleteFailedMessage: 'Failed to delete VPS Container instance.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  pageSizeOptions: [5, 10, 25, 100],
  rowActions: [RETRY_PROVISION_ACTION, CHANGE_PLAN_ACTION],
  listFilters: [
    {
      key: 'customerUUID',
      label: 'Customer',
      paramKey: 'customerUUID',
      type: 'search-select',
      placeholder: 'Search customers',
      emptyLabel: 'No records found.',
    },
  ],
  tabLabels: { notes: 'Notes' },
  initialValues: {
    isActive: 1,
    planUUID: '',
    customerUUID: '',
    image: '',
    name: '',
    sshKey: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HciName', uuidField: 'HciUUID' },
    {
      id: 'customer',
      label: 'Customer',
      kind: 'related',
      field: 'CustomerName',
      uuidField: 'CustomerCusUUID',
    },
    {
      id: 'plan',
      label: 'Plan',
      kind: 'related',
      lookupKey: 'planUUID',
      uuidField: 'HostingVpsContainerPlanHcnUUID',
    },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      lookupKey: 'providerUUID',
      uuidField: 'HostingVpsContainerProviderHcpUUID',
    },
    { id: 'region', label: 'Region', kind: 'text', field: 'PlanRegion' },
    { id: 'size', label: 'Size', kind: 'text', field: 'PlanSize' },
    { id: 'image', label: 'Image', kind: 'text', field: 'InstanceImage' },
    {
      id: 'runtimeStatus',
      label: 'RTS',
      kind: 'text',
      field: 'HciStatus',
      className: 'runtime-status-col',
    },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HciIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'isActive',
      source: 'HciIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'customerUUID',
      source: 'CustomerCusUUID',
      payloadKey: 'customerUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'HciName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'WEB-APP-01',
      required: true,
      span: 1,
    },
    {
      key: 'planUUID',
      source: 'HostingVpsContainerPlanHcnUUID',
      payloadKey: 'planUUID',
      label: 'Plan',
      type: 'search-select',
      required: true,
      span: 2,
    },
    {
      key: 'image',
      source: 'InstanceImage',
      payloadKey: 'image',
      label: 'Image',
      type: 'search-select',
      placeholder: 'ubuntu-22-04',
      span: 2,
      fromRecord: (_value, row) => instanceImageFromRecord(row),
    },
    {
      key: 'sshKey',
      source: 'HciConfig',
      payloadKey: 'sshKey',
      label: 'SSH Key',
      placeholder: 'ssh-rsa AAAA... comment',
      span: 2,
      fromRecord: (value) => configString(value, 'sshKey'),
    },
    {
      key: 'notes',
      source: 'HciConfig',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
      placeholder: 'Provisioned for marketing site',
      fromRecord: (value) => configString(value, 'notes'),
    },
  ],
};

@Component({
  selector: 'app-hosting-vps-container-instances',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsContainerInstancesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly customers = signal<CustomerOption[]>([]);
  private readonly providers = signal<HostingVpsContainerProvider[]>([]);
  private readonly plans = signal<HostingVpsContainerPlan[]>([]);
  private readonly catalog = signal<VpsContainerProviderCatalog | null>(null);
  private readonly catalogProviderUUID = signal<string | null>(null);
  private readonly catalogLoading = signal(false);
  private catalogRequestId = 0;
  private readonly retryingInstanceUUIDs = signal<Set<string>>(new Set());
  private activePlanUUID = '';

  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly providerEndpoint = computed(() =>
    this.isMaster()
      ? 'system/hosting/vps-container/providers'
      : 'hosting/vps-container/providers',
  );
  private readonly instanceEndpoint = computed(() =>
    this.isMaster()
      ? 'system/hosting/vps-container/instances'
      : 'hosting/vps-container/instances',
  );
  private readonly planEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps-container/plans' : 'hosting/vps-container/plans',
  );

  private readonly customerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.customers().map((customer) => ({
      value: customer.CustomerUUID,
      label: customer.Name,
      description: customer.Document ?? undefined,
      searchText: [customer.Name, customer.Document].filter(Boolean).join(' '),
    })),
  );
  private readonly planOptions = computed<ConfigurableCrudOption[]>(() => {
    const selectedPlanUUID = String(this.formValues()['planUUID'] ?? '');
    return this.plans()
      .filter((plan) => plan.HcnIsActive === 1 || plan.HcnUUID === selectedPlanUUID)
      .map((plan) => ({
        value: plan.HcnUUID,
        label: this.planOptionLabel(plan),
        description: [
          this.providerNameById(plan.HostingVpsContainerProviderHcpUUID),
          plan.HcnRegion,
          plan.HcnSize,
        ]
          .filter(Boolean)
          .join(' · '),
        searchText: [
          plan.HcnName,
          this.providerNameById(plan.HostingVpsContainerProviderHcpUUID),
          plan.HcnProvider,
          plan.HcnRegion,
          plan.HcnSize,
          String(plan.HcnPrice ?? ''),
          String(plan.HcnSetupFee ?? ''),
        ]
          .filter(Boolean)
          .join(' '),
      }));
  });
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HcpUUID,
      label: provider.HcpName,
      description: provider.HcpProvider,
      searchText: `${provider.HcpName} ${provider.HcpProvider}`,
    })),
  );
  private readonly imageOptions = computed<ConfigurableCrudOption[]>(() => {
    const images = this.catalog()?.images ?? [];
    const current = String(this.formValues()['image'] ?? '').trim();
    const options = images.map((option) => catalogOptionToCrud(option));
    if (current && !options.some((option) => String(option.value) === current)) {
      options.unshift({
        value: current,
        label: `Custom: ${current}`,
        description: this.isProvisionedEdit() ? 'Current image' : 'Custom',
        searchText: current,
      });
    }
    return options;
  });

  constructor() {
    super(HOSTING_VPS_CONTAINER_INSTANCE_CONFIG);

    const customerFilter = HOSTING_VPS_CONTAINER_INSTANCE_CONFIG.listFilters?.find(
      (filter) => filter.key === 'customerUUID',
    );
    if (customerFilter) customerFilter.hiddenWhen = undefined;

    const customerField = HOSTING_VPS_CONTAINER_INSTANCE_CONFIG.fields.find(
      (field) => field.key === 'customerUUID',
    );
    if (customerField) {
      customerField.hiddenWhen = undefined;
      customerField.required = true;
      customerField.requiredWhen = undefined;
    }

    const provisionedLockKeys = ['isActive', 'customerUUID', 'image', 'sshKey', 'notes'];
    for (const key of provisionedLockKeys) {
      const field = HOSTING_VPS_CONTAINER_INSTANCE_CONFIG.fields.find((item) => item.key === key);
      if (!field) continue;
      const previous = field.disabledWhen;
      field.disabledWhen = (context) => this.isProvisionedEdit() || Boolean(previous?.(context));
    }

    const planField = HOSTING_VPS_CONTAINER_INSTANCE_CONFIG.fields.find(
      (item) => item.key === 'planUUID',
    );
    if (planField) {
      const previous = planField.disabledWhen;
      planField.disabledWhen = (context) => context.editing || Boolean(previous?.(context));
    }

    void Promise.all([this.fetchProviders(), this.fetchCustomers(), this.fetchPlans()]);
  }

  private isProvisionedEdit(): boolean {
    return Boolean(this.editingRecord()?.['HciExternalId']);
  }

  protected override listEndpoint(): string {
    return this.instanceEndpoint();
  }

  protected override createEndpoint(): string {
    return this.instanceEndpoint();
  }

  protected override updateEndpoint(): string {
    return this.instanceEndpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.instanceEndpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.instanceEndpoint()}/bulk`;
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.providers().length ? Promise.resolve() : this.fetchProviders(),
      this.plans().length ? Promise.resolve() : this.fetchPlans(),
      this.customers().length ? Promise.resolve() : this.fetchCustomers(),
    ]);
    const rows = await super.fetchItems(filters);
    return rows.map((row) => this.enrichInstance(row));
  }

  override refreshList() {
    void this.fetchProviders();
    void this.fetchCustomers();
    void this.fetchPlans();
    super.refreshList();
  }

  override startCreate(): void {
    this.activePlanUUID = '';
    this.catalog.set(null);
    this.catalogProviderUUID.set(null);
    super.startCreate();
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    const planUUID = String(this.formValues()['planUUID'] ?? '');
    this.activePlanUUID = planUUID;
    void this.applySelectedPlan(planUUID, false);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'planUUID') return this.planOptions();
    if (key === 'providerUUID') return this.providerOptions();
    if (key === 'image') return this.imageOptions();
    return [];
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'image' ? this.catalogLoading() : super.fieldLoading(field);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'planUUID') {
      void this.applySelectedPlan(String(value ?? ''), true);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const editing = this.editingRecord();
    const sshKey = normalizeString(payload['sshKey']);
    const providerImageId = normalizeString(payload['image']);
    const notes = normalizeString(payload['notes']);
    const config: HostingVpsContainerInstanceConfig = {};
    if (sshKey) config.sshKey = sshKey;
    if (providerImageId) config.providerImageId = providerImageId;
    if (notes) config.notes = notes;

    if (editing?.['HciExternalId']) {
      const current = parseConfig<HostingVpsContainerInstanceConfig>(editing['HciConfig']) ?? {};
      return {
        name: String(payload['name'] ?? '').trim(),
        customerUUID: editing['CustomerCusUUID'] ?? null,
        planUUID: editing['HostingVpsContainerPlanHcnUUID'],
        config: {
          ...current,
          notes: current.notes ?? null,
          providerImageId: current.providerImageId ?? null,
          sshKey: current.sshKey ?? null,
          ipv4: current.ipv4 ?? null,
          ipv6: current.ipv6 ?? null,
        },
        status: normalizeString(editing['HciStatus']),
        isActive: Number(editing['HciIsActive']) === 1,
      };
    }

    return {
      name: String(payload['name'] ?? '').trim(),
      customerUUID: payload['customerUUID'],
      planUUID: payload['planUUID'],
      config,
      status: editing ? normalizeString(editing['HciStatus']) : null,
      isActive: Number(payload['isActive']) === 1,
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (this.isProvisionedEdit()) {
      return super.validatePayload(payload);
    }
    if (!normalizeString(payload['sshKey'])) {
      this.snack.warning(this.t('SSH key is required.'));
      return false;
    }
    if (!normalizeString(payload['image'])) {
      this.snack.warning(this.t('Select an image from the provider catalog.'));
      return false;
    }
    return super.validatePayload(payload);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions: ConfigurableCrudRowAction[] = [];
    if (this.canRetryProvision(row)) {
      actions.push({
        ...RETRY_PROVISION_ACTION,
        icon: this.retryingInstanceUUIDs().has(this.recordUUID(row)) ? 'hourglass_top' : 'replay',
      });
    }
    if (this.canChangePlan(row)) actions.push(CHANGE_PLAN_ACTION);
    return actions;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'retry-provision') {
      await this.retryProvision(row);
      return;
    }
    if (action.key === 'change-plan') {
      await this.openChangePlanDialog(row);
    }
  }

  private canRetryProvision(row: ConfigurableCrudRecord) {
    const status = String(row['HciStatus'] ?? '')
      .trim()
      .toLowerCase();
    return (
      Number(row['HciIsActive']) === 1 &&
      !row['HciExternalId'] &&
      ['', 'failed', 'queue_failed'].includes(status)
    );
  }

  private canChangePlan(row: ConfigurableCrudRecord) {
    if (Number(row['HciIsActive']) !== 1 || !row['HciExternalId']) return false;
    const status = String(row['HciStatus'] ?? '')
      .trim()
      .toLowerCase();
    if (['queued', 'provisioning', 'starting'].includes(status)) return false;
    return this.changePlanCandidates(row).length > 0;
  }

  private changePlanCandidates(row: ConfigurableCrudRecord) {
    const current = this.planById(String(row['HostingVpsContainerPlanHcnUUID'] ?? ''));
    if (!current) return [];
    const currentDisk = this.planDiskGb(current);
    return this.plans().filter(
      (plan) =>
        plan.HcnIsActive === 1 &&
        plan.HcnUUID !== current.HcnUUID &&
        plan.HostingVpsContainerProviderHcpUUID === current.HostingVpsContainerProviderHcpUUID &&
        plan.HcnProvider === current.HcnProvider &&
        (plan.HcnRegion ?? '') === (current.HcnRegion ?? '') &&
        !!plan.HcnSize &&
        this.planDiskGb(plan) >= currentDisk,
    );
  }

  private async retryProvision(row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!this.canRetryProvision(row) || this.retryingInstanceUUIDs().has(uuid)) return;

    const errorMessage = parseConfig<HostingVpsContainerInstanceConfig>(row['HciConfig'])
      ?.provisionError;
    const details =
      typeof errorMessage === 'string' && errorMessage.trim()
        ? ` Last error: ${errorMessage.trim()}`
        : '';
    const confirmed = await this.confirmAction(
      'Retry VPS Container provisioning',
      `Retry provider provisioning for "${String(row['HciName'] ?? '')}"? This can create a VPS Container and may generate provider charges.${details}`,
      'Retry provisioning',
    );
    if (!confirmed) return;

    this.retryingInstanceUUIDs.update((current) => new Set(current).add(uuid));
    this.mutating.set(true);
    try {
      const response = await this.api.post(
        `${this.instanceEndpoint()}/${uuid}/retry-provision`,
        {},
      );
      const updated = (response as { data?: { item?: HostingVpsContainerInstance } } | null | undefined)
        ?.data?.item;
      if ((updated?.HciStatus ?? '').toLowerCase() === 'queue_failed') {
        this.snack.error(this.t('VPS Container provisioning retry could not be queued.'));
      } else {
        this.trackOperation(response);
      }
      this.refreshList();
    } catch (error) {
      this.snack.error(
        this.errorMessage(error) || this.t('Failed to retry VPS Container provisioning.'),
      );
    } finally {
      this.retryingInstanceUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(uuid);
        return next;
      });
      this.mutating.set(false);
    }
  }

  private async openChangePlanDialog(row: ConfigurableCrudRecord) {
    if (!this.canChangePlan(row)) return;
    if (!this.plans().length) await this.fetchPlans();

    const instance = this.toInstance(row);
    const ref = this.dialog.open<
      VpsContainerChangePlanDialogComponent,
      VpsContainerChangePlanDialogData,
      VpsContainerChangePlanDialogResult
    >(VpsContainerChangePlanDialogComponent, {
      width: 'min(720px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-vps-container-change-plan-dialog',
      data: {
        instance,
        plans: this.plans(),
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (!result?.targetPlanUUID) return;

    const target = this.planById(result.targetPlanUUID);
    if (!target) {
      this.snack.warning(this.t('Select a valid target VPS Container plan.'));
      return;
    }

    const confirmed = await this.confirmAction(
      'Change VPS Container plan',
      `Queue plan change for "${instance.HciName}" to "${target.HcnName}"? Provider rules apply.`,
      'Change plan',
    );
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const response = await this.api.post(
        `${this.instanceEndpoint()}/${instance.HciUUID}/change-plan`,
        { targetPlanUUID: result.targetPlanUUID },
      );
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to change VPS Container plan.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async applySelectedPlan(uuid: string, planChangedByUser: boolean) {
    const normalized = normalizeString(uuid);
    if (!normalized) {
      this.activePlanUUID = '';
      this.patchFormValues({ image: '' });
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      return;
    }

    const plan = this.planById(normalized);
    if (!plan) return;

    const planChanged = this.activePlanUUID !== normalized;
    this.activePlanUUID = normalized;

    if (planChangedByUser && planChanged) {
      this.patchFormValues({ image: '' });
    }

    await this.fetchProviderCatalog(plan);

    const currentImage = normalizeString(this.formValues()['image']);
    if (!currentImage && plan.HcnImage) {
      this.patchFormValues({ image: plan.HcnImage });
    }
  }

  private async fetchProviderCatalog(plan: HostingVpsContainerPlan) {
    const uuid = this.resolveProviderUUIDForPlan(plan);
    if (!uuid) {
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      return;
    }

    if (this.catalogProviderUUID() === uuid && this.catalog()) return;

    const requestId = ++this.catalogRequestId;
    this.catalogLoading.set(true);
    this.catalogProviderUUID.set(uuid);
    this.catalog.set(null);
    try {
      const result = await this.api.get<{ data?: { catalog?: VpsContainerProviderCatalog } }>(
        `${this.providerEndpoint()}/${uuid}/catalog`,
      );
      if (requestId !== this.catalogRequestId) return;
      this.catalog.set(result?.data?.catalog ?? null);
    } catch (error) {
      if (requestId !== this.catalogRequestId) return;
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load provider catalog.'));
    } finally {
      if (requestId === this.catalogRequestId) this.catalogLoading.set(false);
    }
  }

  private resolveProviderUUIDForPlan(plan: HostingVpsContainerPlan): string {
    const linked = normalizeString(plan.HostingVpsContainerProviderHcpUUID);
    if (linked) {
      const directProvider = this.providers().find(
        (acc) => acc.HcpUUID === linked && acc.HcpIsActive === 1,
      );
      return directProvider?.HcpUUID ?? linked;
    }

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

  private async fetchProviders() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsContainerProvider[] } }>(
        this.providerEndpoint(),
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.providers.set(
        list.map((item) => ({
          ...item,
          HcpConfig: parseConfig<VpsContainerProviderConfig>(item.HcpConfig),
        })),
      );
    } catch (error) {
      this.providers.set([]);
      if (this.isMaster()) {
        this.snack.error(
          this.errorMessage(error) || this.t('Failed to load VPS Container providers.'),
        );
      }
    }
  }

  private async fetchCustomers() {
    try {
      const result = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        'erp/customers?status=1&limit=500&offset=0',
      );
      this.customers.set(result?.data?.items ?? []);
    } catch (error) {
      this.customers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load customers.'));
    }
  }

  private async fetchPlans() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsContainerPlan[] } }>(
        `${this.planEndpoint()}?limit=500&offset=0`,
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.plans.set(
        list.map((item) => ({
          ...item,
          HcnConfig: parseConfig<HostingVpsContainerPlanConfig>(item.HcnConfig),
        })),
      );
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS Container plans.'));
    }
  }

  private enrichInstance(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = parseConfig<HostingVpsContainerInstanceConfig>(row['HciConfig']);
    const plan = this.planById(String(row['HostingVpsContainerPlanHcnUUID'] ?? ''));
    const image =
      (typeof config?.providerImageId === 'string' ? config.providerImageId : null) ??
      plan?.HcnImage ??
      null;
    return {
      ...row,
      HciConfig: config,
      PlanRegion: plan?.HcnRegion ?? null,
      PlanSize: plan?.HcnSize ?? null,
      InstanceImage: image,
    };
  }

  private toInstance(row: ConfigurableCrudRecord): HostingVpsContainerInstance {
    return {
      HciUUID: String(row['HciUUID'] ?? ''),
      HciName: String(row['HciName'] ?? ''),
      HciConfig: parseConfig<HostingVpsContainerInstanceConfig>(row['HciConfig']),
      CustomerCusUUID: (row['CustomerCusUUID'] as string | null | undefined) ?? null,
      CustomerName: (row['CustomerName'] as string | null | undefined) ?? null,
      HciExternalId: (row['HciExternalId'] as string | null | undefined) ?? null,
      HciStatus: (row['HciStatus'] as string | null | undefined) ?? null,
      HciIsActive: Number(row['HciIsActive']) === 1 ? 1 : 0,
      HostingVpsContainerProviderHcpUUID: String(row['HostingVpsContainerProviderHcpUUID'] ?? ''),
      HostingVpsContainerPlanHcnUUID: String(row['HostingVpsContainerPlanHcnUUID'] ?? ''),
    };
  }

  private planById(uuid: string | null | undefined) {
    if (!uuid) return null;
    return this.plans().find((plan) => plan.HcnUUID === uuid) ?? null;
  }

  private planDiskGb(plan: HostingVpsContainerPlan | null | undefined) {
    const value = Number(plan?.HcnConfig?.diskGb ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  private planOptionLabel(plan: HostingVpsContainerPlan): string {
    const price = formatMoney(plan.HcnPrice, plan.HcnCurrency);
    const setupFee = formatMoney(plan.HcnSetupFee ?? 0, plan.HcnCurrency);
    return `${plan.HcnName} · ${price} · ${this.t('Setup fee')} ${setupFee}`;
  }

  private providerNameById(uuid: string | null | undefined) {
    if (!uuid) return this.t('Default provider');
    const named = this.providers().find((acc) => acc.HcpUUID === uuid)?.HcpName;
    if (named) return named;
    const linkedPlan = this.plans().find((plan) => plan.HostingVpsContainerProviderHcpUUID === uuid);
    if (linkedPlan?.HcnProvider) return linkedPlan.HcnProvider;
    return this.t('Unknown provider');
  }
}

function instanceImageFromRecord(row: ConfigurableCrudRecord): string {
  const config = parseConfig<HostingVpsContainerInstanceConfig>(row['HciConfig']);
  if (typeof config?.providerImageId === 'string' && config.providerImageId.trim()) {
    return config.providerImageId;
  }
  return String(row['InstanceImage'] ?? '');
}

function configString(value: unknown, key: keyof HostingVpsContainerInstanceConfig): string {
  const config = parseConfig<HostingVpsContainerInstanceConfig>(value);
  const field = config?.[key];
  return typeof field === 'string' ? field : '';
}

function catalogOptionToCrud(option: VpsContainerCatalogOption): ConfigurableCrudOption {
  const name = option.name || option.label || option.id;
  const versionArch = [option.version, option.architecture].filter(Boolean).join(' ');
  const specs = [
    option.cpu ? `${option.cpu} vCPU` : null,
    option.memoryMb ? `${option.memoryMb} MB` : null,
    option.diskGb ? `${option.diskGb} GB` : null,
  ].filter(Boolean);
  const meta = [option.source, option.type, ...specs].filter(Boolean).join(' · ');
  return {
    value: option.id,
    label: [name, versionArch].filter(Boolean).join(' '),
    description: [meta, option.slug || option.id].filter(Boolean).join(' · '),
    searchText: [
      option.id,
      option.label,
      option.source,
      option.name,
      option.version,
      option.architecture,
      option.type,
      option.slug,
      ...specs,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function parseConfig<T>(value: unknown): T | null {
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

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function formatMoney(
  value: number | string | null | undefined,
  currency: string | null | undefined,
) {
  const amount = Number(value ?? 0);
  const code = (currency || 'BRL').toUpperCase();
  if (!Number.isFinite(amount)) return `${code} -`;
  return `${code} ${amount.toFixed(2)}`;
}
