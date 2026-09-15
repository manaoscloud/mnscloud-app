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
  pageDescription: 'Register domains and registrar metadata.',
  createTitle: 'New domain',
  editTitle: 'Edit domain',
  dialogDescription: 'Store domain ownership, provider metadata and DNS defaults.',
  searchPlaceholder: 'Search by domain',
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
    name: '',
    customerUUID: '',
    providerUUID: '',
    status: 1,
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
      key: 'name',
      source: 'HddName',
      payloadKey: 'name',
      label: 'Domain',
      placeholder: 'example.com',
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
  constructor() {
    super(HOSTING_DNS_DOMAIN_CONFIG);
    void Promise.all([this.fetchCustomers(), this.fetchDomainProviders()]);
  }

  private domainsPath(): string {
    return this.router.url.split(/[?#]/)[0].replace(/\/domains(?:\/.*)?$/, '/domains');
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.customers().length ? Promise.resolve() : this.fetchCustomers(),
      this.providers().length ? Promise.resolve() : this.fetchDomainProviders(),
    ]);
    const rows = await super.fetchItems(filters);
    const environment = readStoredEnvironmentUUID();
    return rows.map((row) => {
      const enriched = {
        ...row,
        DomainSyncStatus: domainSyncStatus(row),
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
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
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
