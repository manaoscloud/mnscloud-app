import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type {
  HostingDnsDomainOption,
  HostingWebhostPlan,
} from '../webhost.types';
import {
  WEBHOST_HOST_STATUS_OPTIONS,
  WEBHOST_PROVISION_STATUS_OPTIONS,
  YES_NO_OPTIONS,
  appendWebhostListParams,
  asRecord,
  lifecycleChipClass,
  normalizeString,
  truthyNumber,
  webhostRootEndpoint,
} from '../webhost-shared';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
};

const PROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'provision',
  label: 'Provision',
  icon: 'cloud_upload',
  tooltip: 'Provision',
};
const SYNC_ACTION: ConfigurableCrudRowAction = {
  key: 'sync',
  label: 'Sync',
  icon: 'sync',
  tooltip: 'Sync',
};
const SUSPEND_ACTION: ConfigurableCrudRowAction = {
  key: 'suspend',
  label: 'Suspend',
  icon: 'pause_circle',
  tooltip: 'Suspend',
};
const UNSUSPEND_ACTION: ConfigurableCrudRowAction = {
  key: 'unsuspend',
  label: 'Unsuspend',
  icon: 'play_circle',
  tooltip: 'Unsuspend',
};

const HOST_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/hosts',
  uuidField: 'HwhUUID',
  pageTitle: 'Webhost Hosts',
  pageDescription: 'Provision and manage Webhost accounts linked to plans and DNS domains.',
  createTitle: 'New webhost host',
  editTitle: 'Edit webhost host',
  dialogDescription: 'Configure host identity, customer, plan and domain settings.',
  searchPlaceholder: 'Name, domain, username or customer',
  emptyLabel: 'No webhost hosts found.',
  deleteTitle: 'Delete webhost host',
  deleteMessage: 'Are you sure you want to delete this webhost host?',
  deleteSelectedTitle: 'Delete selected webhost hosts',
  deleteSelectedMessage: 'Delete {count} selected webhost hosts?',
  savedMessage: 'Webhost host saved successfully.',
  deletedMessage: 'Webhost host deleted successfully.',
  deleteFailedMessage: 'Failed to delete webhost host.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  tabLabels: {
    storage: 'Hosting',
    notes: 'Notes',
  },
  rowActions: [PROVISION_ACTION, SYNC_ACTION, SUSPEND_ACTION, UNSUSPEND_ACTION],
  listFilters: [
    {
      key: 'customerUUID',
      label: 'Customer',
      paramKey: 'customerUUID',
      type: 'search-select',
      placeholder: 'Search customers',
      emptyLabel: 'No records found.',
    },
    {
      key: 'planUUID',
      label: 'Plan',
      paramKey: 'planUUID',
      type: 'search-select',
      placeholder: 'Search plans',
      emptyLabel: 'No records found.',
    },
    {
      key: 'hostingDnsDomainUUID',
      label: 'Domain',
      paramKey: 'hostingDnsDomainUUID',
      type: 'search-select',
      placeholder: 'Search domains',
      emptyLabel: 'No records found.',
    },
    {
      key: 'hostStatus',
      label: 'Lifecycle',
      paramKey: 'status',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
    {
      key: 'provisionStatus',
      label: 'Provision',
      paramKey: 'provisionStatus',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  initialValues: {
    name: '',
    customerUUID: '',
    planUUID: '',
    hostingDnsDomainUUID: '',
    username: '',
    hostStatus: 'pending',
    provisionStatus: 'manual',
    contactEmail: '',
    documentRoot: '',
    autoProvision: 0,
    notes: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HwhName', uuidField: 'HwhUUID' },
    {
      id: 'customer',
      label: 'Customer',
      kind: 'related',
      field: 'CustomerName',
      uuidField: 'CustomerCusUUID',
    },
    { id: 'domain', label: 'Domain', field: 'DomainName' },
    {
      id: 'plan',
      label: 'Plan',
      kind: 'related',
      field: 'PlanName',
      uuidField: 'HostingWebhostPlanHwlUUID',
    },
    { id: 'provider', label: 'Provider', field: 'ProviderName' },
    { id: 'user', label: 'Username', field: 'HwhUsername' },
    {
      id: 'lifecycle',
      label: 'Lifecycle',
      kind: 'status',
      field: 'HwhStatus',
      options: WEBHOST_HOST_STATUS_OPTIONS,
      className: 'status-col',
      chipClass: lifecycleChipClass,
    },
    {
      id: 'provision',
      label: 'Provision',
      kind: 'status',
      field: 'HwhProvisionStatus',
      options: WEBHOST_PROVISION_STATUS_OPTIONS,
      className: 'status-col',
      chipClass: lifecycleChipClass,
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HwhIsActive', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'HwhIsActive',
      payloadKey: 'status',
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
      key: 'planUUID',
      source: 'HostingWebhostPlanHwlUUID',
      payloadKey: 'planUUID',
      label: 'Plan',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'hostingDnsDomainUUID',
      source: 'HostingDnsDomainHddUUID',
      payloadKey: 'hostingDnsDomainUUID',
      label: 'Domain',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'HwhName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'username',
      source: 'HwhUsername',
      payloadKey: 'username',
      label: 'Username',
      required: true,
      span: 1,
    },
    {
      key: 'hostStatus',
      source: 'HwhStatus',
      payloadKey: 'hostStatus',
      label: 'Lifecycle',
      type: 'search-select',
      options: WEBHOST_HOST_STATUS_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'provisionStatus',
      source: 'HwhProvisionStatus',
      payloadKey: 'provisionStatus',
      label: 'Provision status',
      type: 'search-select',
      options: WEBHOST_PROVISION_STATUS_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'contactEmail',
      payloadKey: 'contactEmail',
      label: 'Contact email',
      type: 'email',
      tab: 'storage',
      span: 2,
    },
    {
      key: 'documentRoot',
      payloadKey: 'documentRoot',
      label: 'Document root',
      tab: 'storage',
      span: 2,
    },
    {
      key: 'autoProvision',
      payloadKey: 'autoProvision',
      label: 'Auto provision',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      tab: 'storage',
      span: 1,
    },
    {
      key: 'notes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
  ],
};

@Component({
  selector: 'app-hosting-webhost-hosts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostHostsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly customers = signal<CustomerOption[]>([]);
  private readonly plans = signal<HostingWebhostPlan[]>([]);
  private readonly domains = signal<HostingDnsDomainOption[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() => webhostRootEndpoint(this.isMaster()));
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/hosts`);

  private readonly customerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.customers().map((customer) => ({
      value: customer.CustomerUUID,
      label: customer.Name,
      description: customer.Document ?? undefined,
      searchText: [customer.Name, customer.Document].filter(Boolean).join(' '),
    })),
  );
  private readonly planOptions = computed<ConfigurableCrudOption[]>(() =>
    this.plans()
      .filter((plan) => plan.HwlIsActive === 1)
      .map((plan) => ({
        value: plan.HwlUUID,
        label: plan.HwlName,
        description: plan.ProviderName,
        searchText: `${plan.HwlName} ${plan.ProviderName}`,
      })),
  );
  private readonly domainOptions = computed<ConfigurableCrudOption[]>(() => {
    const customerUUID = String(
      this.formValues()['customerUUID'] || this.listFilterValues()['customerUUID'] || '',
    );
    return this.domains()
      .filter((domain) => domain.HddStatus === undefined || domain.HddStatus === 1)
      .filter((domain) => !customerUUID || domain.CustomerCusUUID === customerUUID)
      .map((domain) => ({
        value: domain.HddUUID,
        label: domain.HddName,
        description: domain.CustomerName ?? undefined,
        searchText: `${domain.HddName} ${domain.CustomerName ?? ''}`,
      }));
  });

  constructor() {
    super(HOST_CONFIG);
    void Promise.all([this.fetchCustomers(), this.fetchPlans(), this.fetchDomains()]);
  }

  protected override listEndpoint(): string {
    return this.endpoint();
  }

  protected override createEndpoint(): string {
    return this.endpoint();
  }

  protected override updateEndpoint(): string {
    return this.endpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.endpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.endpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'planUUID') return this.planOptions();
    if (key === 'hostingDnsDomainUUID') return this.domainOptions();
    if (key === 'hostStatus') return WEBHOST_HOST_STATUS_OPTIONS;
    if (key === 'provisionStatus') return WEBHOST_PROVISION_STATUS_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.customers().length ? Promise.resolve() : this.fetchCustomers(),
      this.plans().length ? Promise.resolve() : this.fetchPlans(),
      this.domains().length ? Promise.resolve() : this.fetchDomains(),
    ]);
    const params = new URLSearchParams();
    appendWebhostListParams(params, filters, this.listFilters());
    const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
      `${this.listEndpoint()}?${params.toString()}`,
    );
    return (response?.data?.items ?? []).map((item) => ({
      ...item,
      HwhConfig: asRecord(item['HwhConfig']),
    }));
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'customerUUID') return;
    const domainUUID = String(this.formValues()['hostingDnsDomainUUID'] ?? '');
    const domain = this.domains().find((item) => item.HddUUID === domainUUID);
    if (domain && domain.CustomerCusUUID !== String(value ?? '')) {
      this.patchFormValues({ hostingDnsDomainUUID: '' });
    }
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = asRecord(row['HwhConfig']);
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HwhIsActive']),
      hostStatus: String(row['HwhStatus'] ?? 'pending'),
      provisionStatus: String(row['HwhProvisionStatus'] ?? 'manual'),
      contactEmail: String(config['contactEmail'] ?? ''),
      documentRoot: String(config['documentRoot'] ?? ''),
      autoProvision: config['autoProvision'] ? 1 : 0,
      notes: String(config['notes'] ?? ''),
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const domainUUID = String(payload['hostingDnsDomainUUID'] ?? '');
    const customerUUID = String(payload['customerUUID'] ?? '');
    const domain = this.domains().find((item) => item.HddUUID === domainUUID);
    if (!domain || domain.CustomerCusUUID !== customerUUID) {
      this.snack.warning(this.t('Select a domain linked to the selected customer.'));
      return false;
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      customerUUID: payload['customerUUID'],
      planUUID: payload['planUUID'],
      hostingDnsDomainUUID: payload['hostingDnsDomainUUID'],
      username: String(payload['username'] ?? '').trim(),
      status: payload['hostStatus'],
      provisionStatus: payload['provisionStatus'],
      config: {
        contactEmail: normalizeString(payload['contactEmail']),
        documentRoot: normalizeString(payload['documentRoot']),
        autoProvision: truthyNumber(payload['autoProvision']) === 1,
        notes: normalizeString(payload['notes']),
      },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const provisioned = String(row['HwhProvisionStatus'] ?? '') === 'provisioned';
    const suspended = String(row['HwhStatus'] ?? '') === 'suspended';
    return [
      provisioned ? SYNC_ACTION : PROVISION_ACTION,
      suspended ? UNSUSPEND_ACTION : SUSPEND_ACTION,
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HwhUUID'] ?? '');
    if (!uuid) return;
    if (!['provision', 'sync', 'suspend', 'unsuspend'].includes(action.key)) return;
    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.endpoint()}/${uuid}/${action.key}`, {});
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(
        this.errorMessage(error) || this.t(`Failed to ${action.key} webhost host.`),
      );
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchPlans(): Promise<void> {
    try {
      const pickerRoot = this.isMaster()
        ? 'system/hosting/webhost'
        : 'hosting/webhost';
      const response = await this.api.get<{ data?: { items?: HostingWebhostPlan[] } }>(
        `${pickerRoot}/plans?limit=500&offset=0&status=1`,
      );
      this.plans.set(response?.data?.items ?? []);
    } catch (error) {
      this.plans.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load webhost plans.'));
    }
  }

  private async fetchCustomers(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        'erp/customers?status=1&limit=500&offset=0',
      );
      this.customers.set(response?.data?.items ?? []);
    } catch (error) {
      this.customers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load customers.'));
    }
  }

  private async fetchDomains(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: HostingDnsDomainOption[] } }>(
        'hosting/dns/domains?limit=500&offset=0&status=1',
      );
      this.domains.set(response?.data?.items ?? []);
    } catch (error) {
      this.domains.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load hosting domains.'));
    }
  }
}
