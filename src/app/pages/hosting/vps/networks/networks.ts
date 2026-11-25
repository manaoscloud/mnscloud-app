import { Component, computed, inject, signal } from '@angular/core';
import type { ConfigurableCrudRowAction } from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openTemplatePickerDialog } from '../../../../shared/template-picker-dialog/template-picker-dialog';
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
import { attachableInstances, isAccountDefaultNetwork, serverRowRight } from '../vps.types';

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
  // The server decides: owner only, never a default network, delete only when no instance uses it.
  canEditRow: (row) => serverRowRight(row, 'CanEdit', () => Number(row['HvnIsDefault'] ?? 0) !== 1),
  canDeleteRow: (row) =>
    serverRowRight(row, 'CanDelete', () => Number(row['HvnIsDefault'] ?? 0) !== 1),
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
    {
      id: 'name',
      label: 'Name',
      kind: 'identity',
      field: 'HvnName',
      uuidField: 'HvnUUID',
      // The account default network keeps its technical name; customers see "Default network".
      value: (row, translate) =>
        isAccountDefaultNetwork(row) ? translate('Default network') : String(row['HvnName'] ?? ''),
    },
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
    {
      id: 'routeTable',
      label: 'Route table',
      field: 'RouteTableName',
      value: (row, translate) =>
        row['RouteTableName']
          ? String(row['RouteTableName'])
          : row['HostingVpsTenantZoneHtzUUID']
            ? translate('Main table')
            : '',
    },
    {
      id: 'egress',
      label: 'Internet exit',
      field: 'EgressAddress',
      // Networks of the private network router leave through the shared exit or a public IP of it.
      value: (row, translate) =>
        row['EgressAddress']
          ? String(row['EgressAddress'])
          : row['HostingVpsTenantZoneHtzUUID']
            ? translate('Shared')
            : '',
    },
    { id: 'isDefault', label: 'Default', kind: 'boolean', field: 'HvnIsDefault' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HvnIsActive' },
  ],
});

const ROUTE_TABLE_ACTION: ConfigurableCrudRowAction = {
  key: 'routeTable',
  label: 'Route table',
  icon: 'route',
  tooltip: 'Choose the route table this network uses',
};

const EGRESS_ACTION: ConfigurableCrudRowAction = {
  key: 'egress',
  label: 'Internet exit',
  icon: 'alt_route',
  tooltip: 'Choose the public IP this network uses to reach the internet',
};

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

  private readonly platformScope = computed(
    () => (this.route.snapshot.data?.['scope'] ?? 'tenant') === 'master',
  );
  private readonly base = computed(() =>
    this.platformScope() ? 'system/hosting/vps' : 'hosting/vps',
  );
  private readonly networkEndpoint = computed(() => `${this.base()}/networks`);

  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HvrUUID,
      label: provider.HvrName,
      description: provider.HvrProvider,
      searchText: `${provider.HvrName} ${provider.HvrProvider}`,
    })),
  );

  // Attach/apply only to an instance of the same owner: /system acts on platform instances only.
  private readonly instanceOptions = computed<ConfigurableCrudOption[]>(() =>
    attachableInstances(this.instances(), this.platformScope()).map((instance) => ({
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
          hiddenWhen: ({ editing }) => editing || !this.platformScope(),
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
            editing || !this.platformScope() || !String(values['externalId'] ?? '').trim(),
        },
        // business-description: description of the network kept with the cloud resource.
        {
          key: 'description',
          source: 'HvnDescription',
          payloadKey: 'description',
          label: 'Description',
          type: 'textarea',
          span: 4,
        },
      ],
      relatedCollections: [
        {
          key: 'instances',
          label: 'Instances',
          emptyLabel: 'No instances attached',
          addLabel: 'Attach',
          createTitle: 'Attach instance',
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
            {
              id: 'sourceDestCheck',
              label: 'Source/Dest Check',
              value: (row, translate) =>
                Number(row['HinSourceDestCheck'] ?? 1) === 1
                  ? translate('Active')
                  : translate('Appliance (Off)'),
            },
            { id: 'lastError', label: 'Last error', field: 'HinLastError' },
          ],
          rowActions: [
            {
              key: 'toggleSourceDestCheck',
              label: 'Source/Dest Check',
              icon: 'shield',
              request: {
                method: 'put',
                endpoint: (row) =>
                  `${this.networkEndpoint()}/${row['HostingVpsNetworkHvnUUID']}/instances/${row['HinUUID']}/source-dest-check`,
                body: (row) => ({
                  sourceDestCheck: Number(row['HinSourceDestCheck'] ?? 1) === 1 ? 0 : 1,
                }),
                successMessage: 'Source/destination check updated.',
                confirm: {
                  title: 'Source/destination check',
                  message:
                    'Toggle source/destination check on this NIC (Active = anti-spoofing; Appliance = routing enabled)?',
                },
              },
            },
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

  private async chooseRouteTable(row: ConfigurableCrudRecord) {
    const zone = String(row['HostingVpsTenantZoneHtzUUID'] ?? '');
    const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
      'hosting/vps/router/route-tables?limit=500',
    );
    const tables = (response?.data?.items ?? []).filter(
      (table) => String(table['HostingVpsTenantZoneHtzUUID'] ?? '') === zone,
    );
    const choice = await openTemplatePickerDialog(this.dialog, {
      title: 'Route table',
      description: 'Choose the route table of this network.',
      useLabel: 'Apply',
      items: tables.map((table) => ({
        id: String(table['HrtUUID']),
        name: String(table['HrtName']),
        description:
          Number(table['HrtIsMain']) === 1
            ? this.t('Main table')
            : table['HrtNetworkPolicy'] === 'isolate'
              ? this.t('Isolated from the other tables')
              : this.t('Networks talk to each other'),
      })),
    });
    if (!choice) return;
    const main = tables.find((table) => Number(table['HrtIsMain']) === 1);
    this.mutating.set(true);
    try {
      await this.api.put(`hosting/vps/networks/${String(row['HvnUUID'])}/route-table`, {
        routeTableUUID: main && String(main['HrtUUID']) === choice ? null : choice,
      });
      this.snack.success(this.t('Route table of the network saved.'));
    } catch {
      // The API error toast already explains the refusal.
    } finally {
      this.mutating.set(false);
      this.refreshList();
    }
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions = [...super.rowActions(row)];
    if (
      (this.route.snapshot.data?.['scope'] ?? 'tenant') !== 'master' &&
      row['HostingVpsTenantZoneHtzUUID'] &&
      row['HvnStatus'] === 'available'
    ) {
      actions.push(EGRESS_ACTION, ROUTE_TABLE_ACTION);
    }
    return actions;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === ROUTE_TABLE_ACTION.key) return this.chooseRouteTable(row);
    if (action.key !== EGRESS_ACTION.key) return super.handleRowAction(action, row);
    const zone = String(row['HostingVpsTenantZoneHtzUUID'] ?? '');
    const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
      'hosting/vps/public-ips?status=allocated&limit=500',
    );
    const routerIps = (response?.data?.items ?? []).filter(
      (ip) =>
        String(ip['HostingVpsTenantZoneHtzUUID'] ?? '') === zone &&
        ip['HpiNetworkState'] !== 'removing',
    );
    const shared = '__shared__';
    const choice = await openTemplatePickerDialog(this.dialog, {
      title: 'Internet exit',
      description: routerIps.length
        ? 'Choose how this network leaves to the internet.'
        : 'No public IP is used by the router yet: use one on the router in Public IPs to give this network its own exit.',
      useLabel: 'Apply',
      items: [
        {
          id: shared,
          name: this.t('Shared exit'),
          description: this.t('Address shared by the platform'),
        },
        ...routerIps.map((ip) => ({
          id: String(ip['HpiUUID']),
          name: String(ip['HpiAddress']),
          description: this.t('Public IP of the router'),
        })),
      ],
    });
    if (!choice) return;
    this.mutating.set(true);
    try {
      await this.api.put(`hosting/vps/networks/${String(row['HvnUUID'])}/egress`, {
        publicIpUUID: choice === shared ? null : choice,
      });
      this.snack.success(this.t('Internet exit of the network saved.'));
    } catch {
      // The API error toast already explains the refusal.
    } finally {
      this.mutating.set(false);
      this.refreshList();
    }
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
      ...(this.platformScope() && externalId
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
    return [...regions]
      .sort((a, b) => a.localeCompare(b))
      .map((region) => ({ value: region, label: region }));
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
