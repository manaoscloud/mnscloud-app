import { Component, computed, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

type DomainProvisionStatus =
  'not_configured' | 'pending' | 'running' | 'active' | 'failed' | 'unsupported';

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

const PROVISION_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'not_configured', label: 'Not configured' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Provisioning' },
  { value: 'active', label: 'Provisioned' },
  { value: 'failed', label: 'Failed' },
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
  pageDescription: 'Register domains and registrar metadata.',
  createTitle: 'New domain',
  editTitle: 'Edit domain',
  dialogDescription: 'Store domain ownership, provider metadata and DNS defaults.',
  searchPlaceholder: 'Search by domain',
  emptyLabel: 'No domains found.',
  deleteTitle: 'Delete domain',
  deleteMessage: 'Are you sure you want to delete this domain?',
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
    name: '',
    customerUUID: '',
    providerUUID: '',
    status: 1,
    providerZoneID: '',
    zoneIP: '',
    defaultTtl: null,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Domain', kind: 'identity', field: 'HddName', uuidField: 'HddUUID' },
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
      id: 'provision',
      label: 'Provisioning',
      field: 'HddProvisionStatus',
      lookupKey: 'provisionStatus',
      className: 'status-col',
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
      key: 'name',
      source: 'HddName',
      payloadKey: 'name',
      label: 'Domain',
      placeholder: 'example.com',
      required: true,
      span: 1,
    },
    {
      key: 'providerZoneID',
      source: 'HddProviderZoneID',
      payloadKey: 'providerZoneID',
      label: 'Provider zone ID',
      placeholder: 'Z1234567890',
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
      key: 'zoneIP',
      source: 'HddZoneIP',
      payloadKey: 'zoneIP',
      label: 'Zone IP',
      placeholder: '203.0.113.10',
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
  private readonly customers = signal<CustomerOption[]>([]);
  private readonly providers = signal<DomainProviderOption[]>([]);
  private readonly provisioningDomainUUIDs = signal<Set<string>>(new Set());

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
  constructor() {
    super(HOSTING_DNS_DOMAIN_CONFIG);
    void Promise.all([this.fetchCustomers(), this.fetchDomainProviders()]);
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.customers().length ? Promise.resolve() : this.fetchCustomers(),
      this.providers().length ? Promise.resolve() : this.fetchDomainProviders(),
    ]);
    return super.fetchItems(filters);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'providerUUID') return this.providerOptions();
    if (key === 'provisionStatus') return PROVISION_STATUS_OPTIONS;
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      customerUUID: payload['customerUUID'],
      providerUUID: payload['providerUUID'],
      providerZoneID: payload['providerZoneID'],
      zoneIP: payload['zoneIP'],
      defaultTtl: payload['defaultTtl'],
      status: payload['status'],
      notes: payload['notes'],
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const status = String(row['HddProvisionStatus'] ?? '');
    return [
      {
        ...PROVISION_DOMAIN_ACTION,
        icon:
          this.provisioningDomainUUIDs().has(this.recordUUID(row)) || status === 'running'
            ? 'hourglass_top'
            : 'cloud_sync',
      },
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'provision') await this.provisionDomain(row);
  }

  private async fetchDomainProviders() {
    try {
      const response = await this.api.get<{ data?: { items?: DomainProviderOption[] } }>(
        'hosting/dns/providers?status=1&limit=500&offset=0',
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

  private async provisionDomain(domain: ConfigurableCrudRecord) {
    const domainUUID = this.recordUUID(domain);
    if (!domainUUID || this.provisioningDomainUUIDs().has(domainUUID)) return;

    this.provisioningDomainUUIDs.update((current) => new Set(current).add(domainUUID));
    this.mutating.set(true);
    try {
      const response = await this.api.post<{
        status?: string;
        message?: string;
        data?: { provision?: { message?: string; status?: string } };
      }>(`hosting/dns/domains/${domainUUID}/provision`, {});
      const message =
        response?.data?.provision?.message || response?.message || 'DNS domain provisioned.';
      if (response?.status === 'failed' || response?.data?.provision?.status === 'failed') {
        this.snack.error(this.t(message));
      } else {
        this.snack.success(this.t(message));
      }
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
