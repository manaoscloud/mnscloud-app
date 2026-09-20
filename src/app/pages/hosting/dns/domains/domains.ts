import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { readStoredEnvironmentUUID } from '../../../../core/environment/environment-context';

type DomainProviderOption = {
  HdpUUID: string;
  HdpName: string;
  HdpProvider: string;
  HdpStatus: number;
  HdpIsDefault?: number | null;
};

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Status?: number | null;
};

type HostingDnsRegisterOption = {
  HrgUUID: string;
  HrgName: string;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  HrgStatus?: number | null;
};

const IN_FLIGHT_OPERATION_STATES = new Set([
  'queued',
  'running',
  'waiting_retry',
  'verifying',
]);

const DOMAIN_SYNC_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'not_configured', label: 'Not configured' },
  { value: 'queued', label: 'Queued' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Processing' },
  { value: 'waiting_retry', label: 'Retrying' },
  { value: 'verifying', label: 'Verifying' },
  { value: 'active', label: 'Provisioned' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Needs attention' },
  { value: 'unsupported', label: 'Unsupported' },
];

const PROVISION_DOMAIN_ACTION: ConfigurableCrudRowAction = {
  key: 'provision',
  label: 'Provision',
  icon: 'cloud_sync',
  tooltip: 'Provision DNS domain',
};

const HOSTING_DNS_DOMAIN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/dns/domains',
  uuidField: 'HddUUID',
  pageTitle: 'Domains',
  pageDescription: 'Manage DNS zones, provider linkage, and provisioning sync.',
  createTitle: 'New domain',
  editTitle: 'Edit domain',
  dialogDescription: 'Link a registered domain to a DNS provider and zone defaults.',
  searchPlaceholder: 'Search by domain or register',
  emptyLabel: 'No domains found.',
  deleteTitle: 'Delete domain',
  deleteMessage:
    'Delete this domain and ALL its DNS records from the provider? The application keeps its soft-deleted registration.',
  deleteSelectedTitle: 'Delete selected domains',
  deleteSelectedMessage: 'Delete {count} selected domains?',
  savedMessage: 'Domain saved successfully.',
  deletedMessage: 'Domain deleted successfully.',
  deleteFailedMessage: 'Failed to delete domain.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  rowActions: [PROVISION_DOMAIN_ACTION],
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
      key: 'providerUUID',
      label: 'Provider',
      paramKey: 'providerUUID',
      type: 'search-select',
      placeholder: 'Search providers',
      emptyLabel: 'No records found.',
    },
  ],
  tabLabels: { storage: 'DNS settings', notes: 'Notes' },
  initialValues: {
    registerUUID: '',
    customerUUID: '',
    providerUUID: '',
    status: 1,
    zoneIP: '',
    defaultTtl: null,
    notes: '',
  },
  columns: [
    {
      id: 'name',
      label: 'Domain',
      kind: 'identity',
      field: 'DomainIdentityLabel',
      uuidField: 'HddUUID',
    },
    {
      id: 'customer',
      label: 'Customer',
      kind: 'related',
      field: 'CustomerName',
      uuidField: 'CustomerCusUUID',
    },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'ProviderName',
      uuidField: 'HostingDnsProviderHdpUUID',
    },
    {
      id: 'sync',
      label: 'Sync',
      field: 'DomainSyncStatus',
      kind: 'status',
      options: DOMAIN_SYNC_OPTIONS,
      className: 'status-col',
      chipClass: (value) => domainSyncChipClass(value),
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HddStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'HddStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'providerUUID',
      source: 'HostingDnsProviderHdpUUID',
      payloadKey: 'providerUUID',
      label: 'Provider',
      type: 'search-select',
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
      key: 'registerUUID',
      source: 'HostingDnsRegisterHrgUUID',
      payloadKey: 'registerUUID',
      label: 'Register',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'zoneIP',
      source: 'HddZoneIP',
      payloadKey: 'zoneIP',
      label: 'Zone IP',
      placeholder: '203.0.113.10',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'defaultTtl',
      source: 'HddDefaultTtl',
      payloadKey: 'defaultTtl',
      label: 'Default TTL',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'notes',
      source: 'HddNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
      placeholder: 'Optional notes',
    },
  ],
};

@Component({
  selector: 'app-hosting-dns-domains',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingDnsDomainsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customers = signal<CustomerOption[]>([]);
  private readonly providers = signal<DomainProviderOption[]>([]);
  private readonly registers = signal<HostingDnsRegisterOption[]>([]);
  private readonly provisioningDomainUUIDs = signal<Set<string>>(new Set());
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly providerEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/dns/providers' : 'hosting/dns/providers',
  );

  private readonly customerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.customers().map((customer) => ({
      value: customer.CustomerUUID,
      label: customer.Name,
      description: customer.Document ?? undefined,
      searchText: [customer.Name, customer.Document].filter(Boolean).join(' '),
    })),
  );
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HdpUUID,
      label: provider.HdpName,
      description: provider.HdpProvider,
      searchText: `${provider.HdpName} ${provider.HdpProvider}`,
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
    super(HOSTING_DNS_DOMAIN_CONFIG);
    void Promise.all([this.fetchCustomers(), this.fetchDomainProviders(), this.fetchRegisters()]);
  }

  private domainsPath(): string {
    return this.router.url.split(/[?#]/)[0].replace(/\/domains(?:\/.*)?$/, '/domains');
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.customers().length ? Promise.resolve() : this.fetchCustomers(),
      this.providers().length ? Promise.resolve() : this.fetchDomainProviders(),
      this.registers().length ? Promise.resolve() : this.fetchRegisters(),
    ]);
    const rows = await super.fetchItems(filters);
    const environment = readStoredEnvironmentUUID();
    return rows.map((row) => {
      const enriched = {
        ...row,
        DomainSyncStatus: domainSyncStatus(row),
        DomainIdentityLabel:
          String(row['RegisterName'] ?? '').trim() ||
          String(row['HddName'] ?? '').trim() ||
          '—',
      };
      const operationUUID = String(row['MessagingOperationMopUUID'] ?? '');
      const mopState = String(row['MopState'] ?? '');
      if (
        operationUUID &&
        IN_FLIGHT_OPERATION_STATES.has(mopState) &&
        environment
      ) {
        this.operations.watch(
          {
            operationUUID,
            state: mopState,
            errorCode: (row['MopErrorCode'] as string | null | undefined) ?? null,
            environmentUUID: environment,
          },
          this.destroyRef,
          () => this.refreshList(),
        );
      }
      return enriched;
    });
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'providerUUID') return this.providerOptions();
    if (key === 'registerUUID') return this.registerOptions();
    return [];
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'customerUUID') return;
    const registerUUID = String(this.formValues()['registerUUID'] ?? '');
    const register = this.registers().find((item) => item.HrgUUID === registerUUID);
    if (register && register.CustomerCusUUID !== String(value ?? '')) {
      this.patchFormValues({ registerUUID: '' });
    }
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    this.ensureRegisterOption(row);
    return super.formValuesFromRecord(row);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const registerUUID = String(payload['registerUUID'] ?? '');
    const customerUUID = String(payload['customerUUID'] ?? '');
    const register = this.registers().find((item) => item.HrgUUID === registerUUID);
    if (!register || register.CustomerCusUUID !== customerUUID) {
      this.snack.warning('Select a register linked to the selected customer.');
      return false;
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      registerUUID: payload['registerUUID'],
      customerUUID: payload['customerUUID'],
      providerUUID: payload['providerUUID'],
      zoneIP: payload['zoneIP'],
      defaultTtl: payload['defaultTtl'],
      status: payload['status'],
      notes: payload['notes'],
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const status = String(row['DomainSyncStatus'] ?? row['HddProvisionStatus'] ?? '');
    return [
      ...(['cpanel_dnsonly', 'route53'].includes(
        String(row['ProviderPlatform'] ?? row['HddProvider']).toLowerCase(),
      ) && row['HddLastProvisionedAt']
        ? [{ key: 'records', label: 'DNS records', icon: 'dns', tooltip: 'Manage DNS records' }]
        : []),
      {
        ...PROVISION_DOMAIN_ACTION,
        icon:
          this.provisioningDomainUUIDs().has(this.recordUUID(row)) ||
          IN_FLIGHT_OPERATION_STATES.has(status) ||
          status === 'pending' ||
          status === 'running'
            ? 'hourglass_top'
            : 'cloud_sync',
      },
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'records')
      await this.router.navigateByUrl(`${this.domainsPath()}/${this.recordUUID(row)}/records`);
    if (action.key === 'provision') await this.provisionDomain(row);
  }

  private async fetchDomainProviders() {
    try {
      const response = await this.api.get<{ data?: { items?: DomainProviderOption[] } }>(
        `${this.providerEndpoint()}?status=1&limit=500&offset=0`,
      );
      this.providers.set(response?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load domain providers.');
    }
  }

  private async fetchCustomers() {
    try {
      const response = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        'erp/customers?status=1&limit=500&offset=0',
      );
      this.customers.set(response?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load customers.');
    }
  }

  private async fetchRegisters() {
    try {
      const response = await this.api.get<{ data?: { items?: HostingDnsRegisterOption[] } }>(
        'hosting/dns/registers?availableFor=domain&status=1&limit=500&offset=0',
      );
      this.registers.set(response?.data?.items ?? []);
    } catch (error) {
      this.registers.set([]);
      this.snack.error(this.errorMessage(error) || 'Failed to load domain registers.');
    }
  }

  private ensureRegisterOption(row: ConfigurableCrudRecord) {
    const registerUUID = String(row['HostingDnsRegisterHrgUUID'] ?? '');
    if (!registerUUID) return;
    if (this.registers().some((item) => item.HrgUUID === registerUUID)) return;
    const name = String(row['RegisterName'] ?? row['HddName'] ?? '').trim();
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

  private async provisionDomain(domain: ConfigurableCrudRecord) {
    const domainUUID = this.recordUUID(domain);
    if (!domainUUID || this.provisioningDomainUUIDs().has(domainUUID)) return;

    this.provisioningDomainUUIDs.update((current) => new Set(current).add(domainUUID));
    this.mutating.set(true);
    try {
      const response = await this.api.post(`hosting/dns/domains/${domainUUID}/provision`, {});
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to provision DNS domain.');
    } finally {
      this.provisioningDomainUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(domainUUID);
        return next;
      });
      this.mutating.set(false);
    }
  }
}

function domainSyncStatus(row: ConfigurableCrudRecord): string {
  const mopState = String(row['MopState'] ?? '').trim().toLowerCase();
  if (IN_FLIGHT_OPERATION_STATES.has(mopState) || mopState === 'failed' || mopState === 'blocked') {
    return mopState;
  }
  const provision = String(row['HddProvisionStatus'] ?? 'not_configured').trim().toLowerCase();
  return provision || 'not_configured';
}

function domainSyncChipClass(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'active') return 'chip-success';
  if (['failed', 'blocked', 'unsupported'].includes(normalized)) return 'chip-warning';
  if (
    ['queued', 'pending', 'running', 'waiting_retry', 'verifying', 'not_configured'].includes(
      normalized,
    )
  ) {
    return 'chip-skipped';
  }
  return 'chip-skipped';
}
