import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilters,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollectionColumn,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import type {
  HostingVpsInstance,
  HostingVpsNetworkCapabilities,
  HostingVpsPlan,
  HostingVpsProvider,
} from '../vps.types';

const NETWORK_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'creating', label: 'Creating' },
  { value: 'available', label: 'Available' },
  { value: 'deleting', label: 'Deleting' },
  { value: 'failed', label: 'Failed' },
];

const ATTACHMENT_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'attaching', label: 'Attaching' },
  { value: 'attached', label: 'Attached' },
  { value: 'detaching', label: 'Detaching' },
  { value: 'failed', label: 'Failed' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
];

/** Private networks only: public interfaces and reserved/static IPs stay with the instance. */
const config = defineCrud({
  endpoint: 'hosting/vps/networks',
  uuidField: 'HvnUUID',
  pageTitle: 'VPS private networks',
  pageDescription:
    'Private networks shared by one or more VPS instances of the same provider and region.',
  createTitle: 'New private network',
  editTitle: 'Edit private network',
  dialogDescription:
    'Choose the provider, region and a private RFC1918 range. The network is created at the provider by the VPS worker.',
  searchPlaceholder: 'Name, CIDR, region or provider',
  emptyLabel: 'No private networks found.',
  deleteTitle: 'Delete private network',
  deleteMessage: 'Delete this private network? Detach every instance first.',
  deleteSelectedTitle: 'Delete selected private networks',
  deleteSelectedMessage: 'Delete {count} selected private network(s)?',
  savedMessage: 'Private network saved successfully.',
  deletedMessage: 'Private network delete requested.',
  deleteFailedMessage: 'Failed to delete private network.',
  bulkDelete: true,
  pageSizeOptions: [5, 10, 25, 100],
  canEditRow: (row) => Number(row['HvnIsDefault'] ?? 0) !== 1,
  canDeleteRow: (row) => Number(row['HvnIsDefault'] ?? 0) !== 1,
  listFilters: [
    {
      key: 'providerUUID',
      label: 'Provider',
      paramKey: 'providerUUID',
      type: 'search-select',
      placeholder: 'Search providers',
      emptyLabel: 'No records found.',
      span: 1,
    },
    {
      key: 'networkStatus',
      label: 'Network status',
      paramKey: 'status',
      type: 'select',
      options: NETWORK_STATUS_OPTIONS,
      translateOptions: true,
      span: 1,
    },
  ],
  initialValues: {
    status: 1,
    name: '',
    providerUUID: '',
    region: '',
    cidr: '',
    gateway: '',
    description: '',
    externalId: '',
    isDefault: 0,
  },
  fields: [],
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HvnName', uuidField: 'HvnUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'ProviderLabel',
      uuidField: 'HostingVpsProviderHvrUUID',
    },
    { id: 'region', label: 'Region', field: 'RegionLabel' },
    { id: 'cidr', label: 'CIDR', field: 'HvnCidr', copyable: true },
    {
      id: 'networkStatus',
      label: 'Situation',
      kind: 'status',
      field: 'HvnStatus',
      options: NETWORK_STATUS_OPTIONS,
      className: 'status-col',
      chipClass: (value) => statusChipClass(value),
    },
    { id: 'instances', label: 'Instances', kind: 'number', field: 'InstanceCount' },
    { id: 'isDefault', label: 'Default', kind: 'boolean', field: 'HvnIsDefault' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HvnIsActive' },
  ],
});

@Component({
  selector: 'app-networks',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsNetworksPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly providers = signal<HostingVpsProvider[]>([]);
  private readonly plans = signal<HostingVpsPlan[]>([]);
  private readonly instances = signal<HostingVpsInstance[]>([]);
  private readonly capabilities = signal<Record<string, HostingVpsNetworkCapabilities>>({});

  private readonly isMaster = computed(
    () => (this.route.snapshot.data?.['scope'] ?? 'tenant') === 'master',
  );
  private readonly base = computed(() => (this.isMaster() ? 'system/hosting/vps' : 'hosting/vps'));
  private readonly networkEndpoint = computed(() => `${this.base()}/networks`);

  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HvrUUID,
      label: provider.HvrName,
      description: provider.HvrProvider,
      searchText: `${provider.HvrName} ${provider.HvrProvider}`,
    })),
  );

  private readonly instanceOptions = computed<ConfigurableCrudOption[]>(() =>
    this.instances().map((instance) => ({
      value: instance.HviUUID,
      label: instance.HviName,
      description: [instance.ProviderName || instance.ProviderCode, instance.HviStatus]
        .filter(Boolean)
        .join(' · '),
      searchText: [instance.HviName, instance.ProviderName, instance.HviExternalId]
        .filter(Boolean)
        .join(' '),
    })),
  );

  constructor() {
    super({
      ...config,
      fields: [
        { key: 'status', source: 'HvnIsActive', label: 'Status', type: 'status', span: 1 },
        {
          key: 'name',
          source: 'HvnName',
          payloadKey: 'name',
          label: 'Name',
          placeholder: 'APP-LAN',
          required: true,
          span: 1,
        },
        {
          key: 'providerUUID',
          source: 'HostingVpsProviderHvrUUID',
          payloadKey: 'providerUUID',
          label: 'Provider',
          type: 'search-select',
          required: true,
          span: 1,
          disabledWhen: ({ editing }) => editing,
          helpWhen: ({ values }) => this.providerHelp(values['providerUUID']),
        },
        {
          key: 'region',
          source: 'HvnRegion',
          payloadKey: 'region',
          label: 'Region',
          type: 'search-select',
          span: 1,
          quickCreate: false,
          quickCreateExemptReason: 'Regions come from the provider catalog, not a CRUD resource.',
          requiredWhen: ({ values }) =>
            this.capabilitiesFor(values['providerUUID'])?.regionScoped !== false,
          hiddenWhen: ({ values }) =>
            this.capabilitiesFor(values['providerUUID'])?.regionScoped === false,
          disabledWhen: ({ editing }) => editing,
        },
        {
          key: 'cidr',
          source: 'HvnCidr',
          payloadKey: 'cidr',
          label: 'CIDR',
          placeholder: '10.10.0.0/24',
          required: true,
          span: 1,
          disabledWhen: ({ editing }) => editing,
          helpWhen: ({ values }) => this.prefixHelp(values['providerUUID']),
        },
        {
          key: 'gateway',
          source: 'HvnGateway',
          payloadKey: 'gateway',
          label: 'Gateway',
          placeholder: '10.10.0.1',
          span: 1,
          hiddenWhen: ({ values }) => !this.capabilitiesFor(values['providerUUID'])?.gateway,
          disabledWhen: ({ editing }) => editing,
        },
        {
          key: 'externalId',
          source: 'HvnExternalId',
          payloadKey: 'externalId',
          label: 'Existing provider network ID',
          span: 1,
          help: 'Registers an existing provider network without creating it.',
          hiddenWhen: ({ editing }) => editing || !this.isMaster(),
        },
        {
          key: 'isDefault',
          source: 'HvnIsDefault',
          payloadKey: 'isDefault',
          label: 'Provider default network',
          type: 'select',
          options: YES_NO_OPTIONS,
          span: 1,
          hiddenWhen: ({ editing, values }) =>
            editing || !this.isMaster() || !String(values['externalId'] ?? '').trim(),
        },
        {
          key: 'description',
          source: 'HvnDescription',
          payloadKey: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 2,
          span: 4,
        },
      ],
      relatedCollections: [
        {
          key: 'instances',
          label: 'Instances',
          emptyLabel: 'No instances attached',
          addLabel: 'Attach',
          savedMessage: 'Instance attach requested.',
          deletedMessage: 'Instance detach requested.',
          endpoint: (uuid) => `${this.networkEndpoint()}/${uuid}/instances`,
          deleteEndpoint: (uuid, row) =>
            `${this.networkEndpoint()}/${uuid}/instances/${row['HinUUID']}`,
          uuidField: 'HinUUID',
          initialValues: { instanceUUID: '' },
          fields: [
            {
              key: 'instanceUUID',
              source: 'HostingVpsInstanceHviUUID',
              payloadKey: 'instanceUUID',
              label: 'Instance',
              type: 'search-select',
              required: true,
              span: 2,
            },
          ],
          columns: [
            {
              id: 'instance',
              label: 'Instance',
              field: 'HostingVpsInstanceHviUUID',
              kind: 'related',
              lookupKey: 'instanceUUID',
            },
            { id: 'nic', label: 'NIC', field: 'HinNicIndex', kind: 'number' },
            { id: 'privateIp', label: 'Private IP', field: 'HinPrivateIp' },
            { id: 'attachment', label: 'Situation', field: 'HinStatus' },
            { id: 'lastError', label: 'Last error', field: 'HinLastError' },
          ],
        },
      ],
    });
    void this.fetchCatalog();
  }

  protected override listEndpoint(): string {
    return this.networkEndpoint();
  }

  protected override createEndpoint(): string {
    return this.networkEndpoint();
  }

  protected override updateEndpoint(): string {
    return this.networkEndpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.networkEndpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.networkEndpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'providerUUID') return this.providerOptions();
    if (key === 'instanceUUID') return this.instanceOptions();
    if (key === 'region') return this.regionOptions(this.formValues()['providerUUID']);
    return [];
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    if (filter.key === 'providerUUID') return this.providerOptions();
    return super.listFilterOptions(filter);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'providerUUID') return;
    const regions = this.regionOptions(value);
    // A single catalog region is chosen automatically; otherwise clear an incompatible one.
    const current = String(this.formValues()['region'] ?? '');
    if (regions.length === 1) this.patchFormValues({ region: regions[0].value });
    else if (!regions.some((option) => option.value === current))
      this.patchFormValues({ region: '' });
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.providers().length) await this.fetchCatalog();
    const params = new URLSearchParams({ limit: String(this.listLimit), offset: '0' });
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== '' && filters.status !== null && filters.status !== undefined) {
      params.set('isActive', String(filters.status));
    }
    for (const filter of this.listFilters()) {
      const value = filters.extra[filter.key];
      if (value === null || value === undefined || value === '') continue;
      params.set(filter.paramKey ?? filter.key, String(value));
    }
    const response = await this.api.get(`${this.listEndpoint()}?${params.toString()}`);
    const data = (response as { data?: { items?: ConfigurableCrudRecord[] } })?.data;
    return (data?.items ?? []).map((row) => this.enrich(row));
  }

  override refreshList() {
    void this.fetchCatalog();
    super.refreshList();
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const isActive = Number(payload['status'] ?? 1) === 1;
    if (this.editingRecord()) {
      return { name: payload['name'], description: payload['description'] ?? '', isActive };
    }
    const caps = this.capabilitiesFor(payload['providerUUID']);
    const externalId = String(payload['externalId'] ?? '').trim();
    return {
      name: payload['name'],
      providerUUID: payload['providerUUID'],
      region: caps?.regionScoped === false ? null : payload['region'],
      cidr: String(payload['cidr'] ?? '').trim(),
      gateway: caps?.gateway ? String(payload['gateway'] ?? '').trim() || null : null,
      description: payload['description'] || null,
      isActive,
      ...(this.isMaster() && externalId
        ? { externalId, isDefault: Number(payload['isDefault']) === 1 }
        : {}),
    };
  }

  override relatedCollectionColumnValue(
    row: ConfigurableCrudRecord,
    column: ConfigurableCrudRelatedCollectionColumn,
  ): string {
    if (column.id === 'attachment') {
      const option = ATTACHMENT_STATUS_OPTIONS.find((item) => item.value === row['HinStatus']);
      if (option) return this.t(option.label);
    }
    return super.relatedCollectionColumnValue(row, column);
  }

  private capabilitiesFor(providerUUID: unknown): HostingVpsNetworkCapabilities | null {
    const provider = this.providers().find((row) => row.HvrUUID === providerUUID);
    return provider ? (this.capabilities()[provider.HvrProvider] ?? null) : null;
  }

  private providerHelp(providerUUID: unknown): string {
    const caps = this.capabilitiesFor(providerUUID);
    if (!providerUUID || !caps) return '';
    if (!caps.create) return 'This provider does not support private networks.';
    return caps.attach
      ? 'Instances can join or leave this network at any time.'
      : 'Instances join this network only when they are created.';
  }

  private prefixHelp(providerUUID: unknown): string {
    const caps = this.capabilitiesFor(providerUUID);
    return caps?.create
      ? `${this.t('Private RFC1918 range')} /${caps.minPrefix}-/${caps.maxPrefix}`
      : this.t('Private RFC1918 range');
  }

  private regionOptions(providerUUID: unknown): ConfigurableCrudOption[] {
    const regions = new Set(
      this.plans()
        .filter((plan) => plan.HostingVpsProviderHvrUUID === providerUUID && plan.HvpRegion)
        .map((plan) => String(plan.HvpRegion)),
    );
    return [...regions].sort().map((region) => ({ value: region, label: region }));
  }

  private enrich(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const name = String(row['ProviderName'] ?? '').trim();
    const code = String(row['ProviderCode'] ?? '').trim();
    const region = String(row['HvnRegion'] ?? '');
    return {
      ...row,
      ProviderLabel:
        name && code && name.toLowerCase() !== code ? `${name} (${code})` : name || code,
      RegionLabel: region === '*' ? this.t('All regions') : region,
    };
  }

  private async fetchCatalog() {
    const base = this.base();
    const [providers, plans, instances, capabilities] = await Promise.all([
      this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(`${base}/providers?limit=500`),
      this.api.get<{ data?: { items?: HostingVpsPlan[] } }>(`${base}/plans?limit=1000`),
      this.api.get<{ data?: { items?: HostingVpsInstance[] } }>(`${base}/instances?limit=1000`),
      this.api.get<{ data?: { providers?: Record<string, HostingVpsNetworkCapabilities> } }>(
        `${base}/networks/capabilities`,
      ),
    ]).catch((error) => {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS catalog.'));
      return [null, null, null, null] as const;
    });
    if (providers) this.providers.set(providers.data?.items ?? []);
    if (plans) this.plans.set(plans.data?.items ?? []);
    if (instances) this.instances.set(instances.data?.items ?? []);
    if (capabilities) this.capabilities.set(capabilities.data?.providers ?? {});
  }
}

function statusChipClass(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'available') return 'chip-success';
  if (normalized === 'failed') return 'chip-warning';
  return 'chip-skipped';
}
