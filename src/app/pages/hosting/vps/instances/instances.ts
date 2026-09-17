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
  ChangePlanDialogComponent,
  ChangePlanDialogData,
  ChangePlanDialogResult,
} from './change-plan-dialog';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import { openVpsInstanceMonitor } from './instance-monitor';
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

const RETRY_PROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'retry-provision',
  label: 'Retry provisioning',
  icon: 'replay',
  tooltip: 'Retry provisioning',
};

const UPGRADE_ACTION: ConfigurableCrudRowAction = {
  key: 'upgrade',
  label: 'Upgrade',
  icon: 'upgrade',
  tooltip: 'Upgrade plan',
};

const MONITOR_ACTION: ConfigurableCrudRowAction = {
  key: 'monitor',
  label: 'Monitor',
  icon: 'show_chart',
  tooltip: 'Monitor',
};

const DETAILS_ACTION: ConfigurableCrudRowAction = {
  key: 'details',
  label: 'Details',
  icon: 'info',
  tooltip: 'Details',
};

const AUTH_METHOD_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'ssh_key', label: 'SSH key' },
  { value: 'password', label: 'Username and password' },
];

const LIGHTSAIL_AUTH_METHOD_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'ssh_key', label: 'SSH key' },
];

const HOSTING_VPS_INSTANCE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps/instances',
  uuidField: 'HviUUID',
  pageTitle: 'VPS Instances',
  pageDescription: 'Register and track VPS instances for your tenant.',
  createTitle: 'New VPS instance',
  editTitle: 'Edit VPS instance',
  dialogDescription: 'Register an instance from the platform VPS plan catalog.',
  searchPlaceholder: 'Name, plan, provider, region, image or status',
  emptyLabel: 'No VPS instances found.',
  deleteTitle: 'Delete VPS instance',
  deleteMessage: 'Delete this VPS instance from MNSCloud and destroy the provider VPS when linked?',
  deleteSelectedTitle: 'Delete selected VPS instances',
  deleteSelectedMessage:
    'Delete {count} selected VPS instance(s) from MNSCloud and destroy linked provider VPS resources?',
  savedMessage: 'VPS instance saved successfully.',
  deletedMessage: 'VPS instance deleted.',
  deleteFailedMessage: 'Failed to delete VPS instance.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  initialPageSize: 10,
  pageSizeOptions: [5, 10, 25, 100],
  rowActions: [MONITOR_ACTION, DETAILS_ACTION, RETRY_PROVISION_ACTION, UPGRADE_ACTION],
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
  tabLabels: { authentication: 'Authentication', notes: 'Notes' },
  initialValues: {
    isActive: 1,
    planUUID: '',
    customerUUID: '',
    image: '',
    name: '',
    authMethod: 'ssh_key',
    username: 'root',
    password: '',
    sshKey: '',
    planProvider: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HviName', uuidField: 'HviUUID' },
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
      uuidField: 'HostingVpsPlanHvpUUID',
    },
    {
      id: 'publicIp',
      label: 'Public IP',
      kind: 'text',
      field: 'PublicIpv4',
      copyable: true,
    },
    {
      id: 'runtimeStatus',
      label: 'Provisioning',
      kind: 'text',
      field: 'HviStatus',
      className: 'runtime-status-col',
    },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HviIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'isActive',
      source: 'HviIsActive',
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
      source: 'HviName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'WEB-APP-01',
      required: true,
      span: 1,
    },
    {
      key: 'planUUID',
      source: 'HostingVpsPlanHvpUUID',
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
      placeholder: 'ubuntu-22-04-x64',
      span: 2,
      fromRecord: (_value, row) => instanceImageFromRecord(row),
    },
    {
      key: 'authMethod',
      source: 'HviConfig',
      payloadKey: 'authMethod',
      label: 'Authentication method',
      labelWhen: ({ values }) =>
        String(values['planProvider'] ?? '') === 'lightsail'
          ? 'Authentication method (Lightsail requires SSH key)'
          : 'Authentication method',
      type: 'select',
      options: AUTH_METHOD_OPTIONS,
      required: true,
      span: 1,
      tab: 'authentication',
      fromRecord: (value) => configString(value, 'authMethod') || 'ssh_key',
      disabledWhen: ({ values }) => String(values['planProvider'] ?? '') === 'lightsail',
    },
    {
      key: 'username',
      source: 'HviConfig',
      payloadKey: 'username',
      label: 'Username',
      placeholder: 'root',
      span: 1,
      tab: 'authentication',
      fromRecord: (value) => configString(value, 'username') || 'root',
      hiddenWhen: ({ values }) =>
        String(values['planProvider'] ?? '') === 'lightsail' ||
        String(values['authMethod'] ?? 'ssh_key') !== 'password',
      requiredWhen: ({ values }) =>
        String(values['planProvider'] ?? '') !== 'lightsail' &&
        String(values['authMethod'] ?? 'ssh_key') === 'password',
    },
    {
      key: 'password',
      source: 'HviConfig',
      payloadKey: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'new-password',
      span: 1,
      tab: 'authentication',
      fromRecord: () => '',
      hiddenWhen: ({ values }) =>
        String(values['planProvider'] ?? '') === 'lightsail' ||
        String(values['authMethod'] ?? 'ssh_key') !== 'password',
      requiredWhen: ({ editing, values }) =>
        !editing &&
        String(values['planProvider'] ?? '') !== 'lightsail' &&
        String(values['authMethod'] ?? 'ssh_key') === 'password',
    },
    {
      key: 'sshKey',
      source: 'HviConfig',
      payloadKey: 'sshKey',
      label: 'SSH Key',
      placeholder: 'ssh-rsa AAAA... or ssh-ed25519 AAAA...',
      span: 2,
      tab: 'authentication',
      fromRecord: (value) => configString(value, 'sshKey'),
      hiddenWhen: ({ values }) =>
        String(values['planProvider'] ?? '') !== 'lightsail' &&
        String(values['authMethod'] ?? 'ssh_key') !== 'ssh_key',
      requiredWhen: ({ values }) =>
        String(values['planProvider'] ?? '') === 'lightsail' ||
        String(values['authMethod'] ?? 'ssh_key') === 'ssh_key',
    },
    {
      key: 'notes',
      source: 'HviConfig',
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
  selector: 'app-hosting-vps-instances',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsInstancesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly customers = signal<CustomerOption[]>([]);
  private readonly providers = signal<HostingVpsProvider[]>([]);
  private readonly plans = signal<HostingVpsPlan[]>([]);
  private readonly catalog = signal<VpsProviderCatalog | null>(null);
  private readonly catalogProviderUUID = signal<string | null>(null);
  private readonly catalogFetchKey = signal<string | null>(null);
  private readonly catalogLoading = signal(false);
  private catalogRequestId = 0;
  private readonly retryingInstanceUUIDs = signal<Set<string>>(new Set());
  private activePlanUUID = '';

  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly providerEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/providers' : 'hosting/vps/providers',
  );
  private readonly instanceEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/instances' : 'hosting/vps/instances',
  );
  private readonly planEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/plans' : 'hosting/vps/plans',
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
      .filter((plan) => plan.HvpIsActive === 1 || plan.HvpUUID === selectedPlanUUID)
      .map((plan) => ({
        value: plan.HvpUUID,
        label: this.planOptionLabel(plan),
        description: [
          this.providerNameById(plan.HostingVpsProviderHvrUUID, plan.HvpProvider),
          plan.HvpRegion,
          plan.HvpSize,
        ]
          .filter(Boolean)
          .join(' · '),
        searchText: [
          plan.HvpName,
          this.providerNameById(plan.HostingVpsProviderHvrUUID, plan.HvpProvider),
          plan.HvpProvider,
          plan.HvpRegion,
          plan.HvpSize,
          String(plan.HvpPrice ?? ''),
          String(plan.HvpSetupFee ?? ''),
        ]
          .filter(Boolean)
          .join(' '),
      }));
  });
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HvrUUID,
      label: provider.HvrName,
      description: provider.HvrProvider,
      searchText: `${provider.HvrName} ${provider.HvrProvider}`,
    })),
  );
  private readonly imageOptions = computed<ConfigurableCrudOption[]>(() => {
    const plan = this.planById(String(this.formValues()['planUUID'] ?? ''));
    const images = this.compatibleImagesForPlan(plan);
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
    super(HOSTING_VPS_INSTANCE_CONFIG);

    const customerFilter = HOSTING_VPS_INSTANCE_CONFIG.listFilters?.find(
      (filter) => filter.key === 'customerUUID',
    );
    if (customerFilter) customerFilter.hiddenWhen = undefined;

    const customerField = HOSTING_VPS_INSTANCE_CONFIG.fields.find(
      (field) => field.key === 'customerUUID',
    );
    if (customerField) {
      customerField.hiddenWhen = undefined;
      customerField.required = true;
      customerField.requiredWhen = undefined;
    }

    const provisionedLockKeys = [
      'isActive',
      'customerUUID',
      'image',
      'authMethod',
      'username',
      'password',
      'sshKey',
      'notes',
    ];
    for (const key of provisionedLockKeys) {
      const field = HOSTING_VPS_INSTANCE_CONFIG.fields.find((item) => item.key === key);
      if (!field) continue;
      const previous = field.disabledWhen;
      field.disabledWhen = (context) => this.isProvisionedEdit() || Boolean(previous?.(context));
    }

    const planField = HOSTING_VPS_INSTANCE_CONFIG.fields.find((item) => item.key === 'planUUID');
    if (planField) {
      const previous = planField.disabledWhen;
      planField.disabledWhen = (context) => context.editing || Boolean(previous?.(context));
    }

    void Promise.all([this.fetchProviders(), this.fetchCustomers(), this.fetchPlans()]);
  }

  private isProvisionedEdit(): boolean {
    return Boolean(this.editingRecord()?.['HviExternalId']);
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
    this.catalogFetchKey.set(null);
    super.startCreate();
    this.patchFormValues({
      planProvider: '',
      authMethod: 'ssh_key',
      password: '',
    });
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    const planUUID = String(this.formValues()['planUUID'] ?? '');
    this.activePlanUUID = planUUID;
    void this.applySelectedPlan(planUUID, false);
  }

  override fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    if (field.key === 'authMethod') {
      return this.isSelectedPlanLightsail() ? LIGHTSAIL_AUTH_METHOD_OPTIONS : AUTH_METHOD_OPTIONS;
    }
    return super.fieldOptions(field);
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

  private isSelectedPlanLightsail(): boolean {
    const fromForm = String(this.formValues()['planProvider'] ?? '')
      .trim()
      .toLowerCase();
    if (fromForm) return fromForm === 'lightsail';
    const plan = this.planById(String(this.formValues()['planUUID'] ?? ''));
    return plan?.HvpProvider === 'lightsail';
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'planUUID') {
      void this.applySelectedPlan(String(value ?? ''), true);
      return;
    }
    if (key === 'authMethod') {
      if (this.isSelectedPlanLightsail()) {
        this.patchFormValues({
          authMethod: 'ssh_key',
          password: '',
          username: '',
        });
        return;
      }
      const method = String(value ?? 'ssh_key');
      if (method === 'password') {
        this.patchFormValues({
          sshKey: '',
          username: String(this.formValues()['username'] ?? '').trim() || 'root',
        });
      } else {
        this.patchFormValues({ password: '' });
      }
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const editing = this.editingRecord();
    const plan = this.planById(String(payload['planUUID'] ?? this.formValues()['planUUID'] ?? ''));
    const lightsail = plan?.HvpProvider === 'lightsail' ||
      String(payload['planProvider'] ?? this.formValues()['planProvider'] ?? '') === 'lightsail';
    const authMethod = lightsail
      ? 'ssh_key'
      : String(payload['authMethod'] ?? 'ssh_key')
          .trim()
          .toLowerCase() === 'password'
      ? 'password'
      : 'ssh_key';
    const sshKey = normalizeString(payload['sshKey']);
    const username = lightsail
      ? null
      : (normalizeString(payload['username']) ?? (authMethod === 'password' ? 'root' : null));
    const password = lightsail ? null : normalizeString(payload['password']);
    const providerImageId = normalizeString(payload['image']);
    const notes = normalizeString(payload['notes']);
    const config: HostingVpsInstanceConfig = {
      authMethod,
      username,
    };
    if (authMethod === 'ssh_key') {
      if (sshKey) config.sshKey = sshKey;
      config.password = null;
    } else if (password) {
      config.password = password;
      config.sshKey = undefined;
    }
    if (providerImageId) config.providerImageId = providerImageId;
    if (notes) config.notes = notes;

    if (editing?.['HviExternalId']) {
      const current = parseConfig<HostingVpsInstanceConfig>(editing['HviConfig']) ?? {};
      return {
        name: String(payload['name'] ?? '').trim(),
        customerUUID: editing['CustomerCusUUID'] ?? null,
        planUUID: editing['HostingVpsPlanHvpUUID'],
        config: {
          ...current,
          notes: current.notes ?? null,
          password: null,
          publicIpv4: current.publicIpv4 ?? null,
          privateIpv4: current.privateIpv4 ?? null,
          publicIpv6: current.publicIpv6 ?? null,
          runtimeSyncedAt: current.runtimeSyncedAt ?? null,
          runtime: current.runtime ?? null,
        },
        status: normalizeString(editing['HviStatus']),
        isActive: Number(editing['HviIsActive']) === 1,
      };
    }

    return {
      name: String(payload['name'] ?? '').trim(),
      customerUUID: payload['customerUUID'],
      planUUID: payload['planUUID'],
      config,
      status: editing ? normalizeString(editing['HviStatus']) : null,
      isActive: Number(payload['isActive']) === 1,
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (this.isProvisionedEdit()) {
      return super.validatePayload(payload);
    }

    const plan = this.planById(String(payload['planUUID'] ?? this.formValues()['planUUID'] ?? ''));
    const lightsail = plan?.HvpProvider === 'lightsail' ||
      String(payload['planProvider'] ?? this.formValues()['planProvider'] ?? '') === 'lightsail';
    const authMethod = lightsail
      ? 'ssh_key'
      : String(payload['authMethod'] ?? 'ssh_key')
          .trim()
          .toLowerCase() === 'password'
      ? 'password'
      : 'ssh_key';
    if (authMethod === 'ssh_key' && !normalizeString(payload['sshKey'])) {
      this.snack.warning(
        this.t(
          lightsail
            ? 'SSH key is required for Lightsail instances.'
            : 'SSH key is required for SSH key authentication.',
        ),
      );
      return false;
    }
    if (authMethod === 'password' && !normalizeString(payload['password'])) {
      this.snack.warning(this.t('Password is required for password authentication.'));
      return false;
    }
    if (!normalizeString(payload['image'])) {
      this.snack.warning(this.t('Select an image compatible with the selected plan.'));
      return false;
    }
    return super.validatePayload(payload);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions: ConfigurableCrudRowAction[] = [];
    if (row['HviExternalId']) {
      actions.push(MONITOR_ACTION, DETAILS_ACTION);
    }
    if (this.canRetryProvision(row)) {
      actions.push({
        ...RETRY_PROVISION_ACTION,
        icon: this.retryingInstanceUUIDs().has(this.recordUUID(row)) ? 'hourglass_top' : 'replay',
      });
    }
    if (this.canUpgrade(row)) actions.push(UPGRADE_ACTION);
    return actions;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'monitor') {
      await this.openInstanceMonitor(row);
      return;
    }
    if (action.key === 'details') {
      await this.openInstanceDetails(row);
      return;
    }
    if (action.key === 'retry-provision') {
      await this.retryProvision(row);
      return;
    }
    if (action.key === 'upgrade') {
      await this.openUpgradeDialog(row);
    }
  }

  private canRetryProvision(row: ConfigurableCrudRecord) {
    const status = String(row['HviStatus'] ?? '')
      .trim()
      .toLowerCase();
    return (
      Number(row['HviIsActive']) === 1 &&
      !row['HviExternalId'] &&
      ['', 'failed', 'queue_failed'].includes(status)
    );
  }

  private canUpgrade(row: ConfigurableCrudRecord) {
    const plan = this.planById(String(row['HostingVpsPlanHvpUUID'] ?? ''));
    const config = parseConfig<HostingVpsInstanceConfig>(row['HviConfig']);
    const resizeStatus = config?.resize?.status ?? '';
    const grouping = planSizeGrouping(plan);
    return (
      Number(row['HviIsActive']) === 1 &&
      !!row['HviExternalId'] &&
      plan?.HvpProvider === 'digitalocean' &&
      !isGpuSizeGrouping(grouping) &&
      !['resize_queued', 'resizing', 'powering_on'].includes(String(row['HviStatus'] ?? '')) &&
      !['queued', 'resizing', 'powering_on'].includes(resizeStatus)
    );
  }

  private async retryProvision(row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!this.canRetryProvision(row) || this.retryingInstanceUUIDs().has(uuid)) return;

    const errorMessage = parseConfig<HostingVpsInstanceConfig>(row['HviConfig'])?.provisionError;
    const details =
      typeof errorMessage === 'string' && errorMessage.trim()
        ? ` Last error: ${errorMessage.trim()}`
        : '';
    const confirmed = await this.confirmAction(
      'Retry VPS provisioning',
      `Retry provider provisioning for "${String(row['HviName'] ?? '')}"? This can create a VPS and may generate provider charges.${details}`,
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
      const updated = (response as { data?: { item?: HostingVpsInstance } } | null | undefined)
        ?.data?.item;
      if ((updated?.HviStatus ?? '').toLowerCase() === 'queue_failed') {
        this.snack.error(this.t('VPS provisioning retry could not be queued.'));
      } else {
        this.trackOperation(response);
      }
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to retry VPS provisioning.'));
    } finally {
      this.retryingInstanceUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(uuid);
        return next;
      });
      this.mutating.set(false);
    }
  }

  private async openUpgradeDialog(row: ConfigurableCrudRecord) {
    if (!this.canUpgrade(row)) return;
    if (!this.plans().length) await this.fetchPlans();

    const instance = this.toInstance(row);
    const ref = this.dialog.open<
      ChangePlanDialogComponent,
      ChangePlanDialogData,
      ChangePlanDialogResult
    >(ChangePlanDialogComponent, {
      width: 'min(720px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-vps-change-plan-dialog',
      data: {
        instance,
        plans: this.plans(),
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (!result?.targetPlanUUID) return;

    const target = this.planById(result.targetPlanUUID);
    if (!target) {
      this.snack.warning(this.t('Select a valid target VPS plan.'));
      return;
    }

    const confirmed = await this.confirmAction(
      'Upgrade VPS plan',
      `Queue upgrade for "${instance.HviName}" to "${target.HvpName}"? Provider billing and resize rules apply.`,
      'Upgrade',
    );
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const response = await this.api.post(
        `${this.instanceEndpoint()}/${instance.HviUUID}/change-plan`,
        { targetPlanUUID: result.targetPlanUUID },
      );
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to upgrade VPS plan.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async applySelectedPlan(uuid: string, planChangedByUser: boolean) {
    const normalized = normalizeString(uuid);
    if (!normalized) {
      this.activePlanUUID = '';
      this.patchFormValues({ image: '', planProvider: '' });
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      return;
    }

    const plan = this.planById(normalized);
    if (!plan) return;

    const planChanged = this.activePlanUUID !== normalized;
    this.activePlanUUID = normalized;
    const provider = String(plan.HvpProvider ?? '').trim().toLowerCase();

    if (planChangedByUser && planChanged) {
      this.patchFormValues({ image: '' });
    }

    if (provider === 'lightsail') {
      this.patchFormValues({
        planProvider: 'lightsail',
        authMethod: 'ssh_key',
        password: '',
        username: '',
      });
    } else {
      this.patchFormValues({ planProvider: provider || '' });
    }

    await this.fetchProviderCatalog(plan);

    const selectedImage = normalizeString(this.formValues()['image']);
    const compatibleImages = this.compatibleImagesForPlan(plan);

    if (selectedImage) {
      const stillCompatible = compatibleImages.some((option) => option.id === selectedImage);
      if (!stillCompatible && !this.isProvisionedEdit()) {
        this.patchFormValues({ image: '' });
      }
    }

    const currentImage = normalizeString(this.formValues()['image']);
    if (!currentImage && plan.HvpImage) {
      const planImageCompatible = compatibleImages.some((option) => option.id === plan.HvpImage);
      if (planImageCompatible || !compatibleImages.length) {
        this.patchFormValues({ image: plan.HvpImage });
      }
    }
  }

  private compatibleImagesForPlan(plan: HostingVpsPlan | null | undefined): VpsCatalogOption[] {
    if (!plan) return [];
    const region = normalizeString(plan.HvpRegion) ?? '';
    const diskGb = Number(plan.HvpConfig?.diskGb ?? 0);
    const sizeId = normalizeString(plan.HvpSize) ?? '';
    const sizeOption = (this.catalog()?.sizes ?? []).find((item) => item.id === sizeId) ?? null;
    const platform =
      normalizeString(sizeOption?.platform) ??
      lightsailPlatformFromPlan(plan) ??
      null;
    const power = Number(sizeOption?.power ?? 0);
    return (this.catalog()?.images ?? []).filter((option) =>
      isImageCompatibleWithPlan(option, {
        region,
        diskGb,
        platform,
        power: power > 0 ? power : null,
      }),
    );
  }

  private async fetchProviderCatalog(plan: HostingVpsPlan) {
    const uuid = this.resolveProviderUUIDForPlan(plan);
    if (!uuid) {
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      this.catalogFetchKey.set(null);
      return;
    }

    const region = normalizeString(plan.HvpRegion);
    const fetchKey = `${uuid}:${region ?? ''}`;
    if (this.catalogFetchKey() === fetchKey && this.catalog()) return;

    const requestId = ++this.catalogRequestId;
    this.catalogLoading.set(true);
    this.catalogProviderUUID.set(uuid);
    this.catalogFetchKey.set(fetchKey);
    try {
      const query = region ? `?region=${encodeURIComponent(region)}` : '';
      const result = await this.api.get<{ data?: { catalog?: VpsProviderCatalog } }>(
        `${this.providerEndpoint()}/${uuid}/catalog${query}`,
      );
      if (requestId !== this.catalogRequestId) return;
      this.catalog.set(result?.data?.catalog ?? null);
    } catch (error) {
      if (requestId !== this.catalogRequestId) return;
      this.catalog.set(null);
      this.catalogFetchKey.set(null);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load provider catalog.'));
    } finally {
      if (requestId === this.catalogRequestId) this.catalogLoading.set(false);
    }
  }

  private resolveProviderUUIDForPlan(plan: HostingVpsPlan): string {
    const linked = normalizeString(plan.HostingVpsProviderHvrUUID);
    if (linked) {
      const directProvider = this.providers().find(
        (acc) => acc.HvrUUID === linked && acc.HvrIsActive === 1,
      );
      // Platform catalog plans may reference providers tenants do not own.
      return directProvider?.HvrUUID ?? linked;
    }

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

  private async fetchProviders() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        this.providerEndpoint(),
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.providers.set(
        list.map((item) => ({
          ...item,
          HvrConfig: parseConfig<VpsProviderConfig>(item.HvrConfig),
        })),
      );
    } catch (error) {
      this.providers.set([]);
      // Plans come from the platform catalog; providers are optional for the picker.
      if (this.isMaster()) {
        this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS providers.'));
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
      const result = await this.api.get<{ data?: { items?: HostingVpsPlan[] } }>(
        `${this.planEndpoint()}?limit=500&offset=0`,
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.plans.set(
        list.map((item) => ({
          ...item,
          HvpConfig: parseConfig<HostingVpsPlanConfig>(item.HvpConfig),
        })),
      );
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS plans.'));
    }
  }

  private enrichInstance(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = parseConfig<HostingVpsInstanceConfig>(row['HviConfig']);
    const plan = this.planById(String(row['HostingVpsPlanHvpUUID'] ?? ''));
    const image =
      (typeof config?.providerImageId === 'string' ? config.providerImageId : null) ??
      plan?.HvpImage ??
      null;
    return {
      ...row,
      HviConfig: config,
      PlanRegion: plan?.HvpRegion ?? null,
      PlanSize: plan?.HvpSize ?? null,
      InstanceImage: image,
      PublicIpv4: config?.publicIpv4 ?? null,
    };
  }

  private async openInstanceDetails(row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!row['HviExternalId']) {
      this.snack.warning(this.t('Provision the VPS before viewing runtime details.'));
      return;
    }

    let item = this.toInstance(row);
    let runtime: Record<string, unknown> | null = null;

    this.mutating.set(true);
    try {
      const response = await this.api.post<{
        data?: { item?: HostingVpsInstance; runtime?: Record<string, unknown> };
      }>(`${this.instanceEndpoint()}/${uuid}/runtime`, {});
      if (response?.data?.item) {
        item = {
          ...response.data.item,
          HviConfig: parseConfig<HostingVpsInstanceConfig>(response.data.item.HviConfig),
        };
      }
      runtime = response?.data?.runtime ?? null;
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to refresh VPS runtime.'));
      return;
    } finally {
      this.mutating.set(false);
    }

    const config = parseConfig<HostingVpsInstanceConfig>(item.HviConfig) ?? {};
    const plan = this.planById(item.HostingVpsPlanHvpUUID);
    const providerName = this.providerNameById(
      item.HostingVpsProviderHvrUUID || plan?.HostingVpsProviderHvrUUID,
      plan?.HvpProvider,
    );
    const statusValue = String(
      runtime?.['status'] ?? config.runtime?.providerStatus ?? item.HviStatus ?? '-',
    );

    openDataViewerDialog(this.dialog, {
      title: this.t('VPS instance details'),
      description: this.t('Provider runtime, networking and capacity for this instance.'),
      status: {
        label: 'Status',
        value: statusValue,
        tone: statusValue.toLowerCase() === 'active' ? 'success' : 'neutral',
      },
      details: [
        { label: 'Name', value: item.HviName },
        { label: 'Customer', value: item.CustomerName ?? row['CustomerName'] },
        { label: 'Provider', value: providerName },
        { label: 'Plan', value: plan?.HvpName ?? item.HostingVpsPlanHvpUUID },
        { label: 'External ID', value: item.HviExternalId, monospace: true },
        {
          label: 'Public IPv4',
          value: runtime?.['publicIpv4'] ?? config.publicIpv4 ?? '-',
          monospace: true,
        },
        {
          label: 'Private IPv4',
          value: runtime?.['privateIpv4'] ?? config.privateIpv4 ?? '-',
          monospace: true,
        },
        {
          label: 'Public IPv6',
          value: runtime?.['publicIpv6'] ?? config.publicIpv6 ?? '-',
          monospace: true,
        },
        {
          label: 'Region',
          value: runtime?.['region'] ?? config.runtime?.region ?? plan?.HvpRegion,
        },
        { label: 'Size', value: runtime?.['size'] ?? config.runtime?.size ?? plan?.HvpSize },
        {
          label: 'Image',
          value: runtime?.['image'] ?? config.runtime?.image ?? config.providerImageId,
        },
        { label: 'vCPUs', value: runtime?.['vcpus'] ?? config.runtime?.vcpus },
        { label: 'Memory (MB)', value: runtime?.['memoryMb'] ?? config.runtime?.memoryMb },
        { label: 'Disk (GB)', value: runtime?.['diskGb'] ?? config.runtime?.diskGb },
        {
          label: 'Synced at',
          value: runtime?.['syncedAt'] ?? config.runtimeSyncedAt,
          kind: 'datetime',
        },
      ],
      sections: [
        {
          title: this.t('Tags'),
          table: {
            columns: [{ key: 'tag', label: 'Tag' }],
            rows: ((runtime?.['tags'] as string[] | undefined) ?? config.runtime?.tags ?? []).map(
              (tag) => ({ tag }),
            ),
          },
        },
      ],
    });
  }

  private async openInstanceMonitor(row: ConfigurableCrudRecord) {
    if (!row['HviExternalId']) {
      this.snack.warning(this.t('Provision the VPS before viewing monitoring metrics.'));
      return;
    }
    await openVpsInstanceMonitor(this.dialog, {
      uuid: this.recordUUID(row),
      name: String(row['HviName'] ?? ''),
      scope: this.isMaster() ? 'master' : 'tenant',
    });
  }

  private toInstance(row: ConfigurableCrudRecord): HostingVpsInstance {
    return {
      HviUUID: String(row['HviUUID'] ?? ''),
      HviName: String(row['HviName'] ?? ''),
      HviConfig: parseConfig<HostingVpsInstanceConfig>(row['HviConfig']),
      CustomerCusUUID: (row['CustomerCusUUID'] as string | null | undefined) ?? null,
      CustomerName: (row['CustomerName'] as string | null | undefined) ?? null,
      HviExternalId: (row['HviExternalId'] as string | null | undefined) ?? null,
      HviStatus: (row['HviStatus'] as string | null | undefined) ?? null,
      HviIsActive: Number(row['HviIsActive']) === 1 ? 1 : 0,
      HostingVpsProviderHvrUUID: String(row['HostingVpsProviderHvrUUID'] ?? ''),
      HostingVpsPlanHvpUUID: String(row['HostingVpsPlanHvpUUID'] ?? ''),
    };
  }

  private planById(uuid: string | null | undefined) {
    if (!uuid) return null;
    return this.plans().find((plan) => plan.HvpUUID === uuid) ?? null;
  }

  private planOptionLabel(plan: HostingVpsPlan): string {
    const price = formatMoney(plan.HvpPrice, plan.HvpCurrency);
    const setupFee = formatMoney(plan.HvpSetupFee ?? 0, plan.HvpCurrency);
    return `${plan.HvpName} · ${price} · ${this.t('Setup fee')} ${setupFee}`;
  }

  private providerNameById(
    uuid: string | null | undefined,
    providerType?: HostingVpsPlan['HvpProvider'] | null,
  ) {
    if (!uuid) return this.t('Default provider');
    const named = this.providers().find((acc) => acc.HvrUUID === uuid)?.HvrName;
    if (named) return named;
    if (providerType) return providerTypeLabel(providerType);
    const linkedPlan = this.plans().find((plan) => plan.HostingVpsProviderHvrUUID === uuid);
    if (linkedPlan?.HvpProvider) return providerTypeLabel(linkedPlan.HvpProvider);
    return this.t('Platform provider');
  }
}

function instanceImageFromRecord(row: ConfigurableCrudRecord): string {
  const config = parseConfig<HostingVpsInstanceConfig>(row['HviConfig']);
  if (typeof config?.providerImageId === 'string' && config.providerImageId.trim()) {
    return config.providerImageId;
  }
  return String(row['InstanceImage'] ?? '');
}

function configString(value: unknown, key: keyof HostingVpsInstanceConfig): string {
  const config = parseConfig<HostingVpsInstanceConfig>(value);
  const field = config?.[key];
  return typeof field === 'string' ? field : '';
}

function catalogOptionToCrud(option: VpsCatalogOption): ConfigurableCrudOption {
  const name = option.name || option.label || option.id;
  const versionArch = [option.version, option.architecture].filter(Boolean).join(' ');
  const meta = [option.source, option.type].filter(Boolean).join(' · ');
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
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function lightsailParentRegion(regionOrAz: string | null | undefined): string | null {
  const value = String(regionOrAz ?? '').trim().toLowerCase();
  if (!value) return null;
  const match = value.match(/^([a-z0-9-]+?)([a-z])$/i);
  if (!match) return String(regionOrAz ?? '').trim() || null;
  const parent = match[1];
  if (/\d$/.test(parent)) return parent;
  return String(regionOrAz ?? '').trim() || null;
}

function lightsailPlatformFromPlan(plan: HostingVpsPlan): string | null {
  const family = String(plan.HvpConfig?.sizeFamily ?? '').trim().toLowerCase();
  if (family.includes('windows')) return 'WINDOWS';
  if (family.includes('linux') || family.includes('unix')) return 'LINUX_UNIX';
  const size = String(plan.HvpSize ?? '').toLowerCase();
  if (size.includes('_win') || size.includes('-win')) return 'WINDOWS';
  if (size) return 'LINUX_UNIX';
  return null;
}

function isImageCompatibleWithPlan(
  option: VpsCatalogOption,
  context: {
    region: string;
    diskGb: number;
    platform?: string | null;
    power?: number | null;
  },
): boolean {
  const region = context.region;
  if (region && Array.isArray(option.regions) && option.regions.length > 0) {
    const parent = lightsailParentRegion(region);
    const ok =
      option.regions.includes(region) ||
      Boolean(parent && option.regions.includes(parent)) ||
      option.regions.some((item) => lightsailParentRegion(item) === parent);
    if (!ok) return false;
  }

  const platform = String(context.platform ?? '').trim().toUpperCase();
  const imagePlatform = String(option.platform ?? '').trim().toUpperCase();
  if (platform && imagePlatform && platform !== imagePlatform) {
    return false;
  }

  const minPower = Number(option.minPower ?? 0);
  const power = Number(context.power ?? 0);
  if (power > 0 && minPower > 0 && minPower > power) {
    return false;
  }

  const minDiskGb = Number(option.minDiskGb ?? 0);
  if (context.diskGb > 0 && minDiskGb > 0 && minDiskGb > context.diskGb) {
    return false;
  }
  return true;
}

function digitalOceanSizeGrouping(slug: string): { family: string; category: string } {
  const normalized = String(slug ?? '')
    .trim()
    .toLowerCase();
  if (
    normalized.startsWith('gpu-') ||
    normalized.includes('-gpu') ||
    normalized.includes('-nvidia') ||
    normalized.includes('-mi300')
  ) {
    return { family: 'GPU', category: 'GPU' };
  }
  if (normalized.startsWith('s-')) {
    if (normalized.includes('-amd')) return { family: 'Basic', category: 'Premium AMD' };
    if (normalized.includes('-intel')) return { family: 'Basic', category: 'Premium Intel' };
    return { family: 'Basic', category: 'Regular' };
  }
  if (normalized.startsWith('g-') || normalized.startsWith('gd-')) {
    return { family: 'General Purpose', category: 'Dedicated CPU' };
  }
  if (
    normalized.startsWith('c-') ||
    normalized.startsWith('c2-') ||
    normalized.startsWith('c-48')
  ) {
    return { family: 'CPU-Optimized', category: 'Dedicated CPU' };
  }
  if (normalized.startsWith('m-') || normalized.startsWith('m3-') || normalized.startsWith('m6-')) {
    return { family: 'Memory-Optimized', category: 'Dedicated CPU' };
  }
  if (normalized.startsWith('so-') || normalized.startsWith('so1_5-')) {
    return { family: 'Storage-Optimized', category: 'Dedicated CPU' };
  }
  return { family: 'Droplet', category: 'Other' };
}

function planSizeGrouping(plan: HostingVpsPlan | null | undefined): {
  family: string;
  category: string;
} {
  if (!plan) return { family: 'Droplet', category: 'Other' };
  const family = normalizeString(plan.HvpConfig?.sizeFamily);
  const category = normalizeString(plan.HvpConfig?.sizeCategory);
  if (family && category) return { family, category };
  const size = normalizeString(plan.HvpSize) ?? '';
  if (plan.HvpProvider === 'digitalocean') return digitalOceanSizeGrouping(size);
  if (plan.HvpProvider === 'lightsail') {
    const head = size.split('_')[0] || size || 'bundle';
    return { family: 'Lightsail', category: head };
  }
  return { family: plan.HvpProvider || 'VPS', category: size || 'Other' };
}

function isGpuSizeGrouping(grouping: { family: string; category: string }) {
  return (
    grouping.family.toLowerCase().includes('gpu') || grouping.category.toLowerCase().includes('gpu')
  );
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

function providerTypeLabel(provider: HostingVpsPlan['HvpProvider'] | string): string {
  switch (provider) {
    case 'digitalocean':
      return 'DigitalOcean';
    case 'lightsail':
      return 'Amazon Lightsail';
    case 'proxmox':
      return 'Proxmox VE';
    case 'vmware_vcenter':
      return 'VMware vCenter';
    case 'sangfor_scp':
      return 'Sangfor SCP';
    default:
      return String(provider);
  }
}
