import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';

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
import { openVpsInstanceConsole } from './instance-console';
import { MIGRATE_INSTANCE_ACTION } from './instance-migration';
import type {
  HostingVpsFirewall,
  HostingVpsInstance,
  HostingVpsInstanceConfig,
  HostingVpsNetwork,
  HostingVpsPlan,
  HostingVpsPlanConfig,
  HostingVpsProvider,
  VpsCatalogOption,
  VpsProviderCatalog,
  VpsProviderConfig,
} from '../vps.types';
import { isAccountDefaultNetwork } from '../vps.types';
import { planHardwareSummary, planNetworkSpecs } from '../../shared/plan-specs';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Status?: number | null;
};

/** Collection policy power states (non-payment) shown instead of the provider status. */
const BILLING_POWER_LABELS: Record<string, string> = {
  STOP_PENDING: 'Powering off: unpaid',
  STOPPED: 'Powered off: unpaid',
  START_PENDING: 'Powering on: payment received',
  DESTROY_PENDING: 'Releasing: unpaid',
};

/** Customer power actions in progress (the VPS worker records the final status). */
const POWER_STATUS_LABELS: Record<string, string> = {
  starting: 'Starting',
  stopping: 'Shutting down',
  rebooting: 'Rebooting',
};

const POWER_START_ACTION: ConfigurableCrudRowAction = {
  key: 'power-start',
  label: 'Power on',
  icon: 'play_arrow',
  tooltip: 'Power on the VPS',
};

const POWER_STOP_ACTION: ConfigurableCrudRowAction = {
  key: 'power-stop',
  label: 'Shut down',
  icon: 'power_settings_new',
  tooltip: 'Shut down the VPS',
};

const POWER_REBOOT_ACTION: ConfigurableCrudRowAction = {
  key: 'power-reboot',
  label: 'Reboot',
  icon: 'restart_alt',
  tooltip: 'Reboot the VPS',
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

const CONSOLE_ACTION: ConfigurableCrudRowAction = {
  key: 'console',
  label: 'Console',
  icon: 'terminal',
  tooltip: 'Open the VPS console',
};

const DETAILS_ACTION: ConfigurableCrudRowAction = {
  key: 'details',
  label: 'Details',
  icon: 'info',
  tooltip: 'Details',
};

/** A customer server the tenant may publish in (or hide from) the customer portal. */
function isCustomerServer(row: ConfigurableCrudRecord): boolean {
  return String(row['RegCustomerRcuUUID'] ?? '').trim().length > 0;
}

const PORTAL_PUBLISH_ACTION: ConfigurableCrudRowAction = {
  key: 'portal-publish',
  label: 'hostingVps.portalPublish',
  icon: 'public',
  tooltip: 'hostingVps.portalPublish',
  visible: (row) => isCustomerServer(row) && Number(row['HviPortalEnabled'] ?? 0) !== 1,
  request: {
    method: 'put',
    endpoint: (row) => `hosting/vps/instances/${row['HviUUID']}/portal`,
    body: () => ({ enabled: true }),
    successMessage: 'hostingVps.portalPublished',
    confirm: {
      title: 'hostingVps.portalPublish',
      message: 'hostingVps.portalPublishConfirm',
      confirmLabel: 'hostingVps.portalPublish',
    },
  },
};

const PORTAL_HIDE_ACTION: ConfigurableCrudRowAction = {
  key: 'portal-hide',
  label: 'hostingVps.portalHide',
  icon: 'public_off',
  tooltip: 'hostingVps.portalHide',
  visible: (row) => isCustomerServer(row) && Number(row['HviPortalEnabled'] ?? 0) === 1,
  request: {
    method: 'put',
    endpoint: (row) => `hosting/vps/instances/${row['HviUUID']}/portal`,
    body: () => ({ enabled: false }),
    successMessage: 'hostingVps.portalHidden',
    confirm: {
      title: 'hostingVps.portalHide',
      message: 'hostingVps.portalHideConfirm',
      confirmLabel: 'hostingVps.portalHide',
    },
  },
};

const PLACEMENT_GROUP_HELP =
  'Optional. Servers of the same customer with the same group run on different server nodes (one per node), so a node failure stops only one of them. Applies to plans with automatic node.';

/** PL7 placement group `spread`: shown for Proxmox plans only, sent lower case in the config. */
const PLACEMENT_GROUP_FIELD: ConfigurableCrudField = {
  key: 'placementGroup',
  source: 'HviConfig',
  payloadKey: 'placementGroup',
  label: 'Placement group',
  placeholder: 'db-cluster',
  help: PLACEMENT_GROUP_HELP,
  fromRecord: (value) => configString(value, 'placementGroup'),
  hiddenWhen: ({ values }) => !/^proxmox$/i.test(String(values['planProvider'] ?? '').trim()),
};

const AUTH_METHOD_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'ssh_key', label: 'SSH key' },
  { value: 'password', label: 'Username and password' },
];

const KEY_ONLY_AUTH_METHOD_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'ssh_key', label: 'SSH key' },
];

/** Providers whose images accept only SSH keys (Lightsail; Proxmox templates are key-only). */
const KEY_ONLY_PROVIDERS = new Set(['lightsail', 'proxmox']);

function isKeyOnlyProvider(provider: unknown): boolean {
  return KEY_ONLY_PROVIDERS.has(
    String(provider ?? '')
      .trim()
      .toLowerCase(),
  );
}

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
  pageSizeOptions: [5, 10, 25, 100],
  rowActions: [
    MONITOR_ACTION,
    CONSOLE_ACTION,
    POWER_START_ACTION,
    POWER_STOP_ACTION,
    POWER_REBOOT_ACTION,
    DETAILS_ACTION,
    RETRY_PROVISION_ACTION,
    UPGRADE_ACTION,
    MIGRATE_INSTANCE_ACTION,
    PORTAL_PUBLISH_ACTION,
    PORTAL_HIDE_ACTION,
  ],
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
    portalEnabled: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HviName', uuidField: 'HviUUID' },
    {
      id: 'customer',
      label: 'Customer',
      kind: 'related',
      field: 'CustomerName',
      uuidField: 'RegCustomerRcuUUID',
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
      label: 'Situation',
      kind: 'text',
      field: 'HviStatus',
      className: 'runtime-status-col',
      // The collection policy state wins over the provider status while billing controls power.
      value: (row, translate) => {
        const billing = BILLING_POWER_LABELS[String(row['HviBillingPowerState'] ?? '')];
        const power = POWER_STATUS_LABELS[String(row['HviStatus'] ?? '')];
        return billing
          ? translate(billing)
          : power
            ? translate(power)
            : String(row['HviStatus'] ?? '');
      },
    },
    {
      id: 'portal',
      label: 'hostingVps.portalColumn',
      kind: 'status',
      field: 'HviPortalEnabled',
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
      source: 'RegCustomerRcuUUID',
      payloadKey: 'customerUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'portalEnabled',
      payloadKey: 'portalEnabled',
      label: 'hostingVps.portalEnabled',
      help: 'hostingVps.portalEnabledHelp',
      type: 'select',
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      span: 1,
      // Create only: later changes use the row actions (Publish / Hide in the customer portal).
      hiddenWhen: ({ editing }) => editing,
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
    },
    {
      key: 'image',
      source: 'InstanceImage',
      payloadKey: 'image',
      label: 'Image',
      type: 'search-select',
      placeholder: 'ubuntu-22-04-x64',
      fromRecord: (_value, row) => instanceImageFromRecord(row),
    },
    PLACEMENT_GROUP_FIELD,
    {
      key: 'networkUUID',
      source: 'HostingVpsNetworkHvnUUID',
      payloadKey: 'networkUUID',
      label: 'Private network',
      type: 'search-select',
      tab: 'network',
      help: 'Optional. When empty, the VPS uses the default network of your account. Choose a network only to connect an additional private network.',
      hiddenWhen: ({ editing, values }) => editing || !values['planUUID'],
    },
    {
      key: 'firewallUUIDs',
      source: 'HostingVpsFirewallHvfUUID',
      payloadKey: 'firewallUUIDs',
      label: 'Firewall profiles',
      type: 'search-select',
      multiple: true,
      tab: 'network',
      help: 'Optional. When empty, inbound and outbound traffic are allowed. Choose a profile to restrict access.',
      hiddenWhen: ({ editing, values }) => editing || !values['planUUID'],
    },
    {
      key: 'authMethod',
      source: 'HviConfig',
      payloadKey: 'authMethod',
      label: 'Authentication method',
      labelWhen: ({ values }) =>
        isKeyOnlyProvider(values['planProvider'])
          ? 'Authentication method (this provider requires SSH key)'
          : 'Authentication method',
      type: 'select',
      options: AUTH_METHOD_OPTIONS,
      required: true,
      span: 1,
      tab: 'authentication',
      fromRecord: (value) => configString(value, 'authMethod') || 'ssh_key',
      disabledWhen: ({ values }) => isKeyOnlyProvider(values['planProvider']),
    },
    {
      key: 'username',
      source: 'HviConfig',
      payloadKey: 'username',
      label: 'Username',
      placeholder: 'root',
      span: 1,
      tab: 'authentication',
      fromRecord: (value) => configString(value, 'username'),
      // Key-only providers set the login user from the image (Proxmox: the template's cloud-init
      // user); it is shown read-only once the server exists.
      hiddenWhen: ({ editing, values }) =>
        !(editing && normalizeString(values['username'])) &&
        (isKeyOnlyProvider(values['planProvider']) ||
          String(values['authMethod'] ?? 'ssh_key') !== 'password'),
      requiredWhen: ({ editing, values }) =>
        !editing &&
        !isKeyOnlyProvider(values['planProvider']) &&
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
        isKeyOnlyProvider(values['planProvider']) ||
        String(values['authMethod'] ?? 'ssh_key') !== 'password',
      requiredWhen: ({ editing, values }) =>
        !editing &&
        !isKeyOnlyProvider(values['planProvider']) &&
        String(values['authMethod'] ?? 'ssh_key') === 'password',
    },
    {
      key: 'sshKey',
      source: 'HviConfig',
      payloadKey: 'sshKey',
      label: 'SSH Key',
      placeholder: 'ssh-rsa AAAA... comment (Lightsail: ssh-rsa OpenSSH only)',
      tab: 'authentication',
      fromRecord: (value) => configString(value, 'sshKey'),
      hiddenWhen: ({ values }) =>
        !isKeyOnlyProvider(values['planProvider']) &&
        String(values['authMethod'] ?? 'ssh_key') !== 'ssh_key',
      requiredWhen: ({ values }) =>
        isKeyOnlyProvider(values['planProvider']) ||
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
  private readonly vpsAuth = inject(AuthService);
  private readonly customers = signal<CustomerOption[]>([]);
  private readonly providers = signal<HostingVpsProvider[]>([]);
  private readonly plans = signal<HostingVpsPlan[]>([]);
  private readonly networks = signal<HostingVpsNetwork[]>([]);
  private readonly firewalls = signal<HostingVpsFirewall[]>([]);
  private readonly catalog = signal<VpsProviderCatalog | null>(null);
  private readonly catalogProviderUUID = signal<string | null>(null);
  private readonly catalogFetchKey = signal<string | null>(null);
  private readonly catalogLoading = signal(false);
  private catalogRequestId = 0;
  private readonly retryingInstanceUUIDs = signal<Set<string>>(new Set());
  private activePlanUUID = '';

  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly platformScope = computed(() => this.scope() === 'master');
  private readonly isPlatformMasterUser = computed(() =>
    (this.vpsAuth.user()?.permissions ?? []).includes('platform.master.access'),
  );
  private readonly providerEndpoint = computed(() =>
    this.platformScope() ? 'system/hosting/vps/providers' : 'hosting/vps/providers',
  );
  private readonly instanceEndpoint = computed(() =>
    this.platformScope() ? 'system/hosting/vps/instances' : 'hosting/vps/instances',
  );
  private readonly planEndpoint = computed(() =>
    this.platformScope() ? 'system/hosting/vps/plans' : 'hosting/vps/plans',
  );

  private readonly customerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.customers().map((customer) => ({
      value: customer.CustomerUUID,
      label: customer.Name,
      description: customer.Document ?? undefined,
      searchText: [customer.Name, customer.Document].filter(Boolean).join(' '),
    })),
  );
  /** Networks the selected plan can join: same provider, same region or provider-wide (*). */
  private readonly networkOptions = computed<ConfigurableCrudOption[]>(() => {
    const plan = this.planById(String(this.formValues()['planUUID'] ?? ''));
    if (!plan) return [];
    // A VPS created from /system for a customer belongs to that customer: of the platform networks
    // (the only ones /system lists) it may join only the platform default networks.
    const forCustomer =
      this.platformScope() && String(this.formValues()['customerUUID'] ?? '').trim().length > 0;
    return this.networks()
      .filter(
        (network) =>
          // The account default network is always attached; only additional networks are offered.
          !isAccountDefaultNetwork(network) &&
          (!forCustomer || Number(network.HvnIsDefault) === 1) &&
          network.HostingVpsProviderHvrUUID === plan.HostingVpsProviderHvrUUID &&
          (network.HvnRegion === '*' ||
            network.HvnRegion.toLowerCase() === String(plan.HvpRegion ?? '').toLowerCase()),
      )
      .map((network) => ({
        value: network.HvnUUID,
        label: network.HvnName,
        description: network.HvnCidr,
        searchText: `${network.HvnName} ${network.HvnCidr}`,
      }));
  });

  private readonly firewallOptions = computed<ConfigurableCrudOption[]>(() =>
    this.firewalls()
      .filter((firewall) => Number(firewall.HvfIsActive) === 1)
      .map((firewall) => ({
        value: firewall.HvfUUID,
        label: firewall.HvfName,
        searchText: firewall.HvfName,
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
          ...planNetworkSpecs(plan.HvpConfig, (key, params) => this.t(key, params)),
          this.providerNameById(plan.HostingVpsProviderHvrUUID, plan.HvpProvider),
          plan.HvpRegion,
          plan.HvpSize,
        ]
          .filter(Boolean)
          .join(' · '),
        searchText: [
          plan.HvpName,
          planHardwareSummary(plan.HvpConfig, (key, params) => this.t(key, params)),
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
    super({
      ...HOSTING_VPS_INSTANCE_CONFIG,
      fields: HOSTING_VPS_INSTANCE_CONFIG.fields.map((field) => ({ ...field })),
      listFilters: HOSTING_VPS_INSTANCE_CONFIG.listFilters?.map((filter) => ({ ...filter })),
    });

    const customerFilter = this.config.listFilters?.find((filter) => filter.key === 'customerUUID');
    if (this.platformScope()) {
      this.config.pageDescription = 'hostingVps.platformDescription';
      this.config.dialogDescription = 'hostingVps.platformCustomerHelp';
    }
    if (customerFilter) customerFilter.hiddenWhen = () => !this.hasCustomerScope();

    const portalField = this.config.fields.find((field) => field.key === 'portalEnabled');
    if (portalField) {
      portalField.hiddenWhen = ({ editing }) =>
        editing || this.platformScope() || !this.hasCustomerScope();
    }

    const customerField = this.config.fields.find((field) => field.key === 'customerUUID');
    if (customerField) {
      customerField.hiddenWhen = () => !this.hasCustomerScope();
      customerField.required = false;
      customerField.requiredWhen = () => !this.platformScope();
      customerField.disabledWhen = ({ editing }) => editing;
      customerField.helpWhen = () =>
        this.platformScope() ? 'hostingVps.platformCustomerHelp' : '';
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
      'placementGroup',
    ];
    for (const key of provisionedLockKeys) {
      const field = this.config.fields.find((item) => item.key === key);
      if (!field) continue;
      const previous = field.disabledWhen;
      field.disabledWhen = (context) => this.isProvisionedEdit() || Boolean(previous?.(context));
    }

    // Image providers need a chosen image when the plan has none (the API refuses it too).
    const imageField = this.config.fields.find((item) => item.key === 'image');
    if (imageField) {
      imageField.requiredWhen = ({ editing, values }) => {
        if (editing) return false;
        const plan = this.planById(String(values['planUUID'] ?? ''));
        if (!plan || normalizeString(plan.HvpImage)) return false;
        return IMAGE_PROVIDERS.has(String(plan.HvpProvider ?? '').toLowerCase());
      };
    }

    const planField = this.config.fields.find((item) => item.key === 'planUUID');
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
      this.networks().length ? Promise.resolve() : this.fetchNetworkCatalog(),
    ]);
    const rows = await super.fetchItems(filters);
    return rows.map((row) => this.enrichInstance(row));
  }

  override refreshList() {
    void this.fetchProviders();
    void this.fetchCustomers();
    void this.fetchPlans();
    void this.fetchNetworkCatalog();
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
      return this.isSelectedPlanKeyOnly() ? KEY_ONLY_AUTH_METHOD_OPTIONS : AUTH_METHOD_OPTIONS;
    }
    return super.fieldOptions(field);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'planUUID') return this.planOptions();
    if (key === 'providerUUID') return this.providerOptions();
    if (key === 'image') return this.imageOptions();
    if (key === 'networkUUID') return this.networkOptions();
    if (key === 'firewallUUIDs') return this.firewallOptions();
    return [];
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'image' ? this.catalogLoading() : super.fieldLoading(field);
  }

  private isSelectedPlanKeyOnly(): boolean {
    const fromForm = String(this.formValues()['planProvider'] ?? '')
      .trim()
      .toLowerCase();
    if (fromForm) return isKeyOnlyProvider(fromForm);
    const plan = this.planById(String(this.formValues()['planUUID'] ?? ''));
    return isKeyOnlyProvider(plan?.HvpProvider);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'planUUID') {
      void this.applySelectedPlan(String(value ?? ''), true);
      return;
    }
    if (key === 'authMethod') {
      if (this.isSelectedPlanKeyOnly()) {
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
    const keyOnly =
      isKeyOnlyProvider(plan?.HvpProvider) ||
      isKeyOnlyProvider(payload['planProvider'] ?? this.formValues()['planProvider']);
    const authMethod = keyOnly
      ? 'ssh_key'
      : String(payload['authMethod'] ?? 'ssh_key')
            .trim()
            .toLowerCase() === 'password'
        ? 'password'
        : 'ssh_key';
    const sshKey = normalizeString(payload['sshKey']);
    // Key-only providers take the login user from the image; the API records it.
    const username = keyOnly
      ? null
      : (normalizeString(payload['username']) ?? (authMethod === 'password' ? 'root' : null));
    const password = keyOnly ? null : normalizeString(payload['password']);
    const providerImageId = normalizeString(payload['image']);
    const notes = normalizeString(payload['notes']);
    const placementGroup = normalizeString(payload['placementGroup'])?.toLowerCase() ?? null;
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
    if (placementGroup) config.placementGroup = placementGroup;

    if (editing?.['HviExternalId']) {
      const current = parseConfig<HostingVpsInstanceConfig>(editing['HviConfig']) ?? {};
      return {
        name: String(payload['name'] ?? '').trim(),
        customerUUID: editing['RegCustomerRcuUUID'] ?? null,
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
      ...(editing
        ? {}
        : {
            portalEnabled: !this.platformScope() && Number(payload['portalEnabled']) === 1,
            networkUUID: normalizeString(payload['networkUUID']),
            firewallUUIDs: Array.isArray(payload['firewallUUIDs']) ? payload['firewallUUIDs'] : [],
          }),
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    if (this.isProvisionedEdit()) return true;

    const plan = this.planById(String(payload['planUUID'] ?? this.formValues()['planUUID'] ?? ''));
    const lightsail =
      plan?.HvpProvider === 'lightsail' ||
      String(payload['planProvider'] ?? this.formValues()['planProvider'] ?? '') === 'lightsail';
    const keyOnly =
      lightsail ||
      isKeyOnlyProvider(plan?.HvpProvider) ||
      isKeyOnlyProvider(payload['planProvider'] ?? this.formValues()['planProvider']);
    const authMethod = keyOnly
      ? 'ssh_key'
      : String(payload['authMethod'] ?? 'ssh_key')
            .trim()
            .toLowerCase() === 'password'
        ? 'password'
        : 'ssh_key';
    if (authMethod === 'ssh_key' && !normalizeString(payload['sshKey'])) {
      return this.rejectField(
        'sshKey',
        lightsail
          ? 'SSH key is required for Lightsail instances.'
          : 'SSH key is required for SSH key authentication.',
      );
    }
    if (authMethod === 'password' && !normalizeString(payload['password'])) {
      return this.rejectField('password', 'Password is required for password authentication.');
    }
    if (!normalizeString(payload['image'])) {
      return this.rejectField('image', 'Select an image compatible with the selected plan.');
    }

    const selectedImageId = normalizeString(payload['image']);
    const imageOption = (this.catalog()?.images ?? []).find((item) => item.id === selectedImageId);
    if (
      plan &&
      imageOption &&
      !isImageCompatibleWithPlan(imageOption, {
        region: normalizeString(plan.HvpRegion) ?? '',
        diskGb: Number(plan.HvpConfig?.diskGb ?? 0),
        cpu: Number(plan.HvpConfig?.cpu ?? 0),
        memoryMb: Number(plan.HvpConfig?.memoryMb ?? 0),
        platform: lightsailPlatformFromPlan(plan),
      })
    ) {
      return this.rejectField(
        'image',
        'Selected image exceeds plan CPU, memory, or disk minimums. Choose another image or raise the plan specs.',
      );
    }

    return true;
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions: ConfigurableCrudRowAction[] = [];
    if (row['HviExternalId']) {
      actions.push(MONITOR_ACTION);
      if (this.hasWebConsole(row)) actions.push(CONSOLE_ACTION);
      actions.push(...this.powerActions(row));
      actions.push(DETAILS_ACTION);
      // Node migration is the platform function vps.migration: the master offers it on /system and
      // on a tenant's servers with that tenant selected (tenant scope T6).
      if (this.isPlatformMasterUser() && this.providerOf(row) === 'proxmox')
        actions.push(MIGRATE_INSTANCE_ACTION);
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
    if (action.key === 'console') {
      await openVpsInstanceConsole(this.dialog, {
        uuid: this.recordUUID(row),
        name: String(row['HviName'] ?? ''),
        scope: this.platformScope() ? 'master' : 'tenant',
      });
      return;
    }
    if (action.key === 'retry-provision') {
      await this.retryProvision(row);
      return;
    }
    if (action.key === 'power-start') {
      await this.requestPower(row, 'start');
      return;
    }
    if (action.key === 'power-stop') {
      await this.requestPower(row, 'stop');
      return;
    }
    if (action.key === 'power-reboot') {
      await this.requestPower(row, 'reboot');
      return;
    }
    if (action.key === 'upgrade') {
      await this.openUpgradeDialog(row);
    }
  }

  /**
   * Power actions the current status allows. None while billing holds the power (overdue balance)
   * or while another power action runs.
   */
  private powerActions(row: ConfigurableCrudRecord): ConfigurableCrudRowAction[] {
    if (row['HviBillingPowerState'] || Number(row['HviIsActive'] ?? 0) !== 1) return [];
    const status = String(row['HviStatus'] ?? '')
      .trim()
      .toLowerCase();
    if (status === 'stopped') return [POWER_START_ACTION];
    if (status === 'running' || status === 'active')
      return [POWER_STOP_ACTION, POWER_REBOOT_ACTION];
    return [];
  }

  private async requestPower(row: ConfigurableCrudRecord, action: 'start' | 'stop' | 'reboot') {
    const uuid = this.recordUUID(row);
    const name = String(row['HviName'] ?? '');
    if (action !== 'start') {
      const confirmed = await this.confirmAction(
        action === 'stop' ? 'Shut down VPS' : 'Reboot VPS',
        (action === 'stop'
          ? this.t('Shut down {name}? Services on the VPS stop until it is started again.')
          : this.t('Reboot {name}? Services on the VPS are unavailable during the restart.')
        ).replace('{name}', name),
        action === 'stop' ? 'Shut down' : 'Reboot',
      );
      if (!confirmed) return;
    }
    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.instanceEndpoint()}/${uuid}/power`, { action });
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to change the VPS power state.'));
    } finally {
      this.mutating.set(false);
    }
  }

  /** The web console exists for Proxmox VPS only. */
  /** Proxmox (provider console) and DigitalOcean/Lightsail (SSH console with the platform key). */
  private hasWebConsole(row: ConfigurableCrudRecord) {
    return ['proxmox', 'digitalocean', 'lightsail'].includes(this.providerOf(row));
  }

  private providerOf(row: ConfigurableCrudRecord): string {
    const providerUUID = String(row['HostingVpsProviderHvrUUID'] ?? '');
    const provider = this.providers().find((item) => item.HvrUUID === providerUUID);
    const plan = this.planById(String(row['HostingVpsPlanHvpUUID'] ?? ''));
    return String(provider?.HvrProvider ?? plan?.HvpProvider ?? '');
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
    const provider = plan?.HvpProvider;
    return (
      Number(row['HviIsActive']) === 1 &&
      !!row['HviExternalId'] &&
      (provider === 'digitalocean' || provider === 'lightsail') &&
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
      target.HvpProvider === 'lightsail'
        ? `Queue Lightsail upgrade for "${instance.HviName}" to "${target.HvpName}"? The instance will be recreated from a snapshot (downtime). Dynamic public IP may change; an existing Static IP is preserved.`
        : `Queue upgrade for "${instance.HviName}" to "${target.HvpName}"? Provider billing and resize rules apply.`,
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
    const provider = String(plan.HvpProvider ?? '')
      .trim()
      .toLowerCase();

    if (planChangedByUser && planChanged) {
      this.patchFormValues({ image: '' });
    }

    if (isKeyOnlyProvider(provider)) {
      this.patchFormValues({
        planProvider: provider,
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
    const cpu = Number(plan.HvpConfig?.cpu ?? 0);
    const memoryMb = Number(plan.HvpConfig?.memoryMb ?? 0);
    const sizeId = normalizeString(plan.HvpSize) ?? '';
    const sizeOption = (this.catalog()?.sizes ?? []).find((item) => item.id === sizeId) ?? null;
    const platform =
      normalizeString(sizeOption?.platform) ?? lightsailPlatformFromPlan(plan) ?? null;
    const power = Number(sizeOption?.power ?? 0);
    return (this.catalog()?.images ?? []).filter((option) =>
      isImageCompatibleWithPlan(option, {
        region,
        diskGb,
        cpu,
        memoryMb,
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
    // Drop the previous node catalog immediately so region-scoped filters (Proxmox)
    // never briefly/persistently show another node's templates as an empty list.
    this.catalog.set(null);
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
      if (this.platformScope()) {
        this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS providers.'));
      }
    }
  }

  /**
   * Customers exist only inside a tenant (tenant scope T6, TS2): /system creates platform servers;
   * a customer's server is created with its tenant selected, acting as the tenant.
   */
  private hasCustomerScope(): boolean {
    return !this.platformScope();
  }

  private async fetchCustomers() {
    if (!this.hasCustomerScope()) {
      this.customers.set([]);
      return;
    }
    try {
      const result = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        'registry/customers?status=1&limit=500&offset=0',
      );
      this.customers.set(result?.data?.items ?? []);
    } catch (error) {
      this.customers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load customers.'));
    }
  }

  private async fetchNetworkCatalog() {
    const base = this.platformScope() ? 'system/hosting/vps' : 'hosting/vps';
    try {
      const [networks, firewalls] = await Promise.all([
        this.api.get<{ data?: { items?: HostingVpsNetwork[] } }>(
          `${base}/networks?status=available&limit=1000&offset=0`,
        ),
        this.api.get<{ data?: { items?: HostingVpsFirewall[] } }>(
          `${base}/firewalls?limit=1000&offset=0`,
        ),
      ]);
      this.networks.set(networks?.data?.items ?? []);
      this.firewalls.set(firewalls?.data?.items ?? []);
    } catch {
      // Tenants without the network/firewall entitlement simply get no options.
      this.networks.set([]);
      this.firewalls.set([]);
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
    const isProxmox = String(plan?.HvpProvider ?? '').toLowerCase() === 'proxmox';

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
        // Proxmox VPS have no public IPv6 and no provider size (the plan sets CPU, memory, disk).
        ...(isProxmox
          ? []
          : [
              {
                label: 'Public IPv6',
                value: runtime?.['publicIpv6'] ?? config.publicIpv6 ?? '-',
                monospace: true,
              },
            ]),
        {
          label: 'Region',
          value: runtime?.['region'] ?? config.runtime?.region ?? plan?.HvpRegion,
        },
        ...(isProxmox
          ? []
          : [{ label: 'Size', value: runtime?.['size'] ?? config.runtime?.size ?? plan?.HvpSize }]),
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
      scope: this.platformScope() ? 'master' : 'tenant',
    });
  }

  private toInstance(row: ConfigurableCrudRecord): HostingVpsInstance {
    return {
      HviUUID: String(row['HviUUID'] ?? ''),
      HviName: String(row['HviName'] ?? ''),
      HviConfig: parseConfig<HostingVpsInstanceConfig>(row['HviConfig']),
      RegCustomerRcuUUID: (row['RegCustomerRcuUUID'] as string | null | undefined) ?? null,
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
    const hardware = planHardwareSummary(plan.HvpConfig, (key, params) => this.t(key, params));
    return [plan.HvpName, hardware, price, `${this.t('Setup fee')} ${setupFee}`]
      .filter(Boolean)
      .join(' · ');
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

/** Providers whose servers are created from an image chosen per server (or the plan's). */
const IMAGE_PROVIDERS = new Set(['proxmox', 'digitalocean', 'lightsail']);

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

/**
 * An image option shows only the operating system. The server takes CPU, memory and disk from
 * the plan; image hardware is only the minimum used to hide images the plan cannot run
 * (`isImageCompatibleWithPlan`), so it is not shown as if it were the server size.
 */
function catalogOptionToCrud(option: VpsCatalogOption): ConfigurableCrudOption {
  const name = option.name || option.label || option.id;
  const versionArch = [option.version, option.architecture].filter(Boolean).join(' ');
  const label = [name, versionArch].filter(Boolean).join(' ');
  return {
    value: option.id,
    label,
    description: [option.source, option.slug || option.id].filter(Boolean).join(' · '),
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
  const value = String(regionOrAz ?? '')
    .trim()
    .toLowerCase();
  if (!value) return null;
  const match = value.match(/^([a-z0-9-]+?)([a-z])$/i);
  if (!match) return String(regionOrAz ?? '').trim() || null;
  const parent = match[1];
  if (/\d$/.test(parent)) return parent;
  return String(regionOrAz ?? '').trim() || null;
}

function lightsailPlatformFromPlan(plan: HostingVpsPlan): string | null {
  const family = String(plan.HvpConfig?.sizeFamily ?? '')
    .trim()
    .toLowerCase();
  if (family.includes('windows')) return 'WINDOWS';
  if (family.includes('linux') || family.includes('unix')) return 'LINUX_UNIX';
  const size = String(plan.HvpSize ?? '').toLowerCase();
  if (size.includes('_win') || size.includes('-win')) return 'WINDOWS';
  if (size) return 'LINUX_UNIX';
  return null;
}

const AUTO_PLACEMENT_REGION = 'auto';

export function isImageCompatibleWithPlan(
  option: VpsCatalogOption,
  context: {
    region: string;
    diskGb: number;
    cpu?: number;
    memoryMb?: number;
    platform?: string | null;
    power?: number | null;
  },
): boolean {
  const region = context.region;
  // Region `auto` (Proxmox automatic placement, PL3) is not a node: the placement picks the node
  // and the API clones the image replica there (PL2), so any node's template is offered.
  const automaticPlacement = region.trim().toLowerCase() === AUTO_PLACEMENT_REGION;
  if (region && !automaticPlacement && Array.isArray(option.regions) && option.regions.length > 0) {
    const regionLc = region.toLowerCase();
    const parent = lightsailParentRegion(region);
    const parentLc = parent?.toLowerCase() ?? null;
    const ok = option.regions.some((item) => {
      const itemLc = String(item ?? '').toLowerCase();
      if (!itemLc) return false;
      if (itemLc === regionLc) return true;
      if (parentLc && itemLc === parentLc) return true;
      return lightsailParentRegion(item)?.toLowerCase() === parentLc;
    });
    if (!ok) return false;
  }

  const platform = String(context.platform ?? '')
    .trim()
    .toUpperCase();
  const imagePlatform = String(option.platform ?? '')
    .trim()
    .toUpperCase();
  if (platform && imagePlatform && platform !== imagePlatform) {
    return false;
  }

  const minPower = Number(option.minPower ?? 0);
  const power = Number(context.power ?? 0);
  if (power > 0 && minPower > 0 && minPower > power) {
    return false;
  }

  const minDiskGb = Number(option.minDiskGb ?? option.diskGb ?? 0);
  if (context.diskGb > 0 && minDiskGb > 0 && minDiskGb > context.diskGb) {
    return false;
  }

  const minCpu = Number(option.cpu ?? 0);
  if ((context.cpu ?? 0) > 0 && minCpu > 0 && minCpu > (context.cpu ?? 0)) {
    return false;
  }

  const minMemoryMb = Number(option.memoryMb ?? 0);
  if ((context.memoryMb ?? 0) > 0 && minMemoryMb > 0 && minMemoryMb > (context.memoryMb ?? 0)) {
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
