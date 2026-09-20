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
  HostingDnsRegisterOption,
  HostingWebhostPlan,
} from '../webhost.types';
import {
  WEBHOST_HOST_STATUS_OPTIONS,
  WEBHOST_PROVISION_STATUS_OPTIONS,
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

const DEPROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'deprovision',
  label: 'Deprovision',
  icon: 'cloud_off',
  tooltip: 'Deprovision',
};

const HOST_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/hosts',
  uuidField: 'HwhUUID',
  pageTitle: 'Webhost Hosts',
  pageDescription: 'Provision and manage Webhost accounts linked to plans and domain registers.',
  createTitle: 'New webhost host',
  editTitle: 'Edit webhost host',
  dialogDescription: 'Configure host identity, customer, plan and domain. Provision starts automatically.',
  searchPlaceholder: 'Name, register, username or customer',
  emptyLabel: 'No webhost hosts found.',
  deleteTitle: 'Delete webhost host',
  deleteMessage:
    'Delete this webhost host from MNSCloud? Provisioned hosts must be deprovisioned first.',
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
    notes: 'Notes',
  },
  rowActions: [PROVISION_ACTION, DEPROVISION_ACTION, SYNC_ACTION, SUSPEND_ACTION, UNSUSPEND_ACTION],
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
      key: 'hostingDnsRegisterUUID',
      label: 'Register',
      paramKey: 'hostingDnsRegisterUUID',
      type: 'search-select',
      placeholder: 'Search registers',
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
    hostingDnsRegisterUUID: '',
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
    { id: 'domain', label: 'Domain', field: 'DomainLabel' },
    {
      id: 'plan',
      label: 'Plan',
      kind: 'related',
      field: 'PlanName',
      uuidField: 'HostingWebhostPlanHwlUUID',
    },
    { id: 'provider', label: 'Provider', field: 'ProviderName' },
    { id: 'user', label: 'Username', field: 'HwhUsername' },
    { id: 'ip', label: 'IP', field: 'HostIpLabel' },
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
      key: 'hostingDnsRegisterUUID',
      source: 'HostingDnsRegisterHrgUUID',
      payloadKey: 'hostingDnsRegisterUUID',
      label: 'Register',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'HwhName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
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
  private readonly registers = signal<HostingDnsRegisterOption[]>([]);
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
  private readonly registerOptions = computed<ConfigurableCrudOption[]>(() => {
    const customerUUID = String(
      this.formValues()['customerUUID'] || this.listFilterValues()['customerUUID'] || '',
    );
    return this.registers()
      .filter((register) => register.HrgStatus === undefined || register.HrgStatus === 1)
      .filter((register) => !customerUUID || register.CustomerCusUUID === customerUUID)
      .map((register) => ({
        value: register.HrgUUID,
        label: register.HrgName,
        description: register.CustomerName ?? undefined,
        searchText: `${register.HrgName} ${register.CustomerName ?? ''}`,
      }));
  });

  constructor() {
    super(HOST_CONFIG);
    void Promise.all([this.fetchCustomers(), this.fetchPlans(), this.fetchRegisters()]);
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
    if (key === 'hostingDnsRegisterUUID') return this.registerOptions();
    if (key === 'hostStatus') return WEBHOST_HOST_STATUS_OPTIONS;
    if (key === 'provisionStatus') return WEBHOST_PROVISION_STATUS_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.customers().length ? Promise.resolve() : this.fetchCustomers(),
      this.plans().length ? Promise.resolve() : this.fetchPlans(),
      this.registers().length ? Promise.resolve() : this.fetchRegisters(),
    ]);
    const params = new URLSearchParams();
    appendWebhostListParams(params, filters, this.listFilters());
    const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
      `${this.listEndpoint()}?${params.toString()}`,
    );
    return (response?.data?.items ?? []).map((item) => {
      const config = asRecord(item['HwhConfig']);
      const ip = normalizeString(config['ip'] ?? config['ipAddress'] ?? '');
      const registerName = normalizeString(item['RegisterName']);
      const domainName = normalizeString(item['DomainName']);
      return {
        ...item,
        HwhConfig: config,
        HostIpLabel: ip || '—',
        CustomerEmail: normalizeString(item['CustomerEmail']) || '—',
        DomainLabel: registerName || domainName || '—',
      };
    });
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'customerUUID') return;
    const registerUUID = String(this.formValues()['hostingDnsRegisterUUID'] ?? '');
    const register = this.registers().find((item) => item.HrgUUID === registerUUID);
    if (register && register.CustomerCusUUID !== String(value ?? '')) {
      this.patchFormValues({ hostingDnsRegisterUUID: '' });
    }
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    this.ensureRegisterOption(row);
    const config = asRecord(row['HwhConfig']);
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HwhIsActive']),
      notes: String(config['notes'] ?? ''),
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const registerUUID = String(payload['hostingDnsRegisterUUID'] ?? '');
    const customerUUID = String(payload['customerUUID'] ?? '');
    const register = this.registers().find((item) => item.HrgUUID === registerUUID);
    if (!register || register.CustomerCusUUID !== customerUUID) {
      this.snack.warning(this.t('Select a register linked to the selected customer.'));
      return false;
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      customerUUID: payload['customerUUID'],
      planUUID: payload['planUUID'],
      hostingDnsRegisterUUID: payload['hostingDnsRegisterUUID'],
      config: {
        notes: normalizeString(payload['notes']),
      },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const provisionStatus = String(row['HwhProvisionStatus'] ?? '');
    const provisioned = provisionStatus === 'provisioned';
    const pendingOrProvisioning =
      provisionStatus === 'pending' || provisionStatus === 'provisioning';
    const suspended = String(row['HwhStatus'] ?? '') === 'suspended';
    const actions: ConfigurableCrudRowAction[] = [];
    if (!provisioned && !pendingOrProvisioning) {
      actions.push(PROVISION_ACTION);
    }
    if (provisioned || pendingOrProvisioning) {
      actions.push(DEPROVISION_ACTION);
    }
    if (provisioned) {
      actions.push(SYNC_ACTION);
      actions.push(suspended ? UNSUSPEND_ACTION : SUSPEND_ACTION);
    }
    return actions;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HwhUUID'] ?? '');
    if (!uuid) return;
    if (!['provision', 'deprovision', 'sync', 'suspend', 'unsuspend'].includes(action.key)) {
      return;
    }
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

  private async fetchRegisters(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: HostingDnsRegisterOption[] } }>(
        'hosting/dns/registers?availableFor=host&status=1&limit=500&offset=0',
      );
      this.registers.set(response?.data?.items ?? []);
    } catch (error) {
      this.registers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load domain registers.'));
    }
  }

  private ensureRegisterOption(row: ConfigurableCrudRecord) {
    const registerUUID = String(row['HostingDnsRegisterHrgUUID'] ?? '');
    if (!registerUUID) return;
    if (this.registers().some((item) => item.HrgUUID === registerUUID)) return;
    const name =
      normalizeString(row['RegisterName']) || normalizeString(row['DomainName']);
    if (!name) return;
    this.registers.update((current) => [
      ...current,
      {
        HrgUUID: registerUUID,
        HrgName: name,
        CustomerCusUUID: row['CustomerCusUUID'] as string | null | undefined,
        CustomerName: row['CustomerName'] as string | null | undefined,
        HrgStatus: 1,
      },
    ]);
  }
}
