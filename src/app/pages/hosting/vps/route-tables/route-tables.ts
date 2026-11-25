import { Component, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const POLICY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'allow', label: 'Networks talk to each other' },
  { value: 'isolate', label: 'Isolated from the other tables' },
];

const TARGET_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'internet', label: 'Internet (shared exit)' },
  { value: 'nat', label: 'Internet through a public IP of the router' },
  { value: 'instance', label: 'VPS instance (appliance / firewall)' },
  { value: 'blackhole', label: 'Block (discard)' },
];

const ROUTER_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'pending', label: 'Pending' },
  { value: 'applying', label: 'Applying' },
  { value: 'applied', label: 'Applied' },
  { value: 'failed', label: 'Failed' },
];

/** Routes of one table (R1): destination and where it goes; the most specific destination wins. */
function routesOf(
  table: ConfigurableCrudRecord,
  routerIps: readonly ConfigurableCrudOption[],
  instanceOptions: readonly ConfigurableCrudOption[] = [],
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `hosting/vps/router/route-tables/${String(table['HrtUUID'] ?? '')}/routes`,
    uuidField: 'HroUUID',
    pageTitle: 'Routes',
    pageDescription:
      'Where each destination leaves to: the most specific destination wins. Private networks of the router always stay local.',
    createTitle: 'New route',
    editTitle: 'Edit route',
    dialogDescription:
      'Destination in CIDR (0.0.0.0/0 = all other destinations). The router applies the route at once.',
    emptyLabel: 'No routes: every destination leaves through the internet exit of the network.',
    deleteTitle: 'Delete route',
    deleteMessage: 'Delete this route?',
    deleteSelectedTitle: 'Delete selected routes',
    deleteSelectedMessage: 'Delete {count} selected route(s)?',
    savedMessage: 'Route saved.',
    deletedMessage: 'Route deleted.',
    deleteFailedMessage: 'Failed to delete route.',
    bulkDelete: false,
    statusFilter: false,
    initialValues: { destination: '', targetKind: 'internet', publicIpUUID: '', instanceUUID: '', description: '' },
    payload: (values) => ({
      destination: String(values['destination'] ?? '').trim(),
      targetKind: values['targetKind'],
      publicIpUUID: values['targetKind'] === 'nat' ? values['publicIpUUID'] || null : null,
      instanceUUID: values['targetKind'] === 'instance' ? values['instanceUUID'] || null : null,
      description: String(values['description'] ?? '').trim() || null,
    }),
    fields: [
      {
        key: 'destination',
        source: 'HroDestination',
        payloadKey: 'destination',
        label: 'Destination',
        placeholder: '203.0.113.0/24',
        required: true,
        span: 1,
        help: 'IPv4 network in CIDR. 0.0.0.0/0 = every destination without a more specific route.',
      },
      {
        key: 'targetKind',
        source: 'HroTargetKind',
        payloadKey: 'targetKind',
        label: 'Leave through',
        type: 'select',
        options: TARGET_OPTIONS,
        required: true,
        span: 1,
      },
      {
        key: 'publicIpUUID',
        source: 'HostingVpsPublicIpHpiUUID',
        payloadKey: 'publicIpUUID',
        label: 'Public IP',
        type: 'select',
        options: routerIps,
        span: 1,
        hiddenWhen: ({ values }) => values['targetKind'] !== 'nat',
        requiredWhen: ({ values }) => values['targetKind'] === 'nat',
        help: 'Public IP used by the router. Use one on the router in Public IPs first.',
      },
      {
        key: 'instanceUUID',
        source: 'HostingVpsInstanceHviUUID',
        payloadKey: 'instanceUUID',
        label: 'Target instance',
        type: 'select',
        options: instanceOptions,
        span: 1,
        hiddenWhen: ({ values }) => values['targetKind'] !== 'instance',
        requiredWhen: ({ values }) => values['targetKind'] === 'instance',
        help: 'Tenant VPS appliance instance in this router zone.',
      },
      {
        key: 'description',
        source: 'HroDescription',
        payloadKey: 'description',
        label: 'Description',
        span: 1,
      },
    ],
    columns: [
      {
        id: 'destination',
        label: 'Destination',
        kind: 'identity',
        field: 'HroDestination',
        uuidField: 'HroUUID',
        copyable: true,
      },
      {
        id: 'target',
        label: 'Leave through',
        kind: 'status',
        field: 'HroTargetKind',
        options: TARGET_OPTIONS,
      },
      {
        id: 'targetDetails',
        label: 'Target details',
        value: (row) =>
          row['HroTargetKind'] === 'instance'
            ? (row['InstanceName'] ? `${row['InstanceName']} (${row['InstancePrivateIp'] ?? ''})` : String(row['HostingVpsInstanceHviUUID'] ?? ''))
            : (row['HpiAddress'] ? String(row['HpiAddress']) : ''),
      },
      { id: 'description', label: 'Description', field: 'HroDescription' },
    ],
  });
}

/** Route tables of the routers of the VPS private networks (VPS router R1). */
const config = defineCrud({
  endpoint: 'hosting/vps/router/route-tables',
  uuidField: 'HrtUUID',
  pageTitle: 'Route tables',
  pageDescription:
    'Choose where each destination of your private networks leaves to: internet, a public IP of the router or blocked. Networks without a table use the main one.',
  createTitle: 'New route table',
  editTitle: 'Edit route table',
  dialogDescription:
    'Give the table a name and choose whether its networks may talk to the other networks.',
  searchPlaceholder: 'Name',
  emptyLabel: 'No route tables yet: create a private network first.',
  deleteTitle: 'Delete route table',
  deleteMessage:
    'Delete this route table and its routes? Move its networks to another table first.',
  deleteSelectedTitle: 'Delete selected route tables',
  deleteSelectedMessage: 'Delete {count} selected route table(s)?',
  savedMessage: 'Route table saved.',
  deletedMessage: 'Route table deleted.',
  deleteFailedMessage: 'Failed to delete route table.',
  bulkDelete: false,
  statusFilter: false,
  pageSizeOptions: [10, 25, 100],
  initialValues: { zoneUUID: '', name: '', networkPolicy: 'allow', description: '' },
  fields: [
    {
      key: 'name',
      source: 'HrtName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'DMZ',
      required: true,
      span: 1,
    },
    {
      key: 'networkPolicy',
      source: 'HrtNetworkPolicy',
      payloadKey: 'networkPolicy',
      label: 'Networks',
      type: 'select',
      options: POLICY_OPTIONS,
      required: true,
      span: 1,
      help: 'Isolated: the networks of this table do not reach the networks of the other tables, and the reverse.',
    },
    {
      key: 'description',
      source: 'HrtDescription',
      payloadKey: 'description',
      label: 'Description',
      span: 1,
    },
  ],
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HrtName', uuidField: 'HrtUUID' },
    { id: 'provider', label: 'Provider', field: 'ProviderName' },
    {
      id: 'policy',
      label: 'Networks',
      kind: 'status',
      field: 'HrtNetworkPolicy',
      options: POLICY_OPTIONS,
    },
    { id: 'networks', label: 'Private networks', kind: 'number', field: 'NetworkCount' },
    { id: 'routes', label: 'Routes', kind: 'number', field: 'RouteCount' },
    {
      id: 'router',
      label: 'Router',
      kind: 'status',
      field: 'RouterState',
      options: ROUTER_STATE_OPTIONS,
      className: 'status-col',
    },
    { id: 'description', label: 'Description', field: 'HrtDescription' },
  ],
});

@Component({
  selector: 'app-vps-route-tables',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsRouteTablesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly routerIps = signal<ConfigurableCrudRecord[]>([]);
  private readonly routers = signal<ConfigurableCrudRecord[]>([]);
  private readonly instances = signal<ConfigurableCrudRecord[]>([]);

  constructor() {
    super({
      ...config,
      fields: [
        {
          key: 'zoneUUID',
          source: 'HostingVpsTenantZoneHtzUUID',
          payloadKey: 'zoneUUID',
          label: 'Router',
          type: 'select',
          span: 1,
          // Only a tenant with routers on several providers chooses it, and only on create.
          hiddenWhen: ({ editing }) => editing || this.routers().length <= 1,
          requiredWhen: ({ editing }) => !editing && this.routers().length > 1,
        },
        ...(config.fields ?? []),
      ],
      canDeleteRow: (row) => Number(row['HrtIsMain']) !== 1,
      rowActions: [
        {
          key: 'routes',
          label: 'Routes',
          icon: 'alt_route',
          tooltip: 'Routes of this table',
          collection: (row) => routesOf(row, this.ipOptionsOf(row), this.instanceOptionsOf(row)),
        } satisfies ConfigurableCrudRowAction,
      ],
    });
    void this.fetchRouterIps();
  }

  private ipOptionsOf(table: ConfigurableCrudRecord): ConfigurableCrudOption[] {
    const zone = String(table['HostingVpsTenantZoneHtzUUID'] ?? '');
    return this.routerIps()
      .filter((ip) => String(ip['HostingVpsTenantZoneHtzUUID'] ?? '') === zone)
      .map((ip) => ({ value: String(ip['HpiUUID']), label: String(ip['HpiAddress']) }));
  }

  private instanceOptionsOf(table: ConfigurableCrudRecord): ConfigurableCrudOption[] {
    const zone = String(table['HostingVpsTenantZoneHtzUUID'] ?? '');
    return this.instances()
      .filter(
        (inst) =>
          !zone ||
          String(inst['HostingVpsTenantZoneHtzUUID'] ?? '') === zone ||
          String(inst['HtzUUID'] ?? '') === zone ||
          String(inst['ZoneUUID'] ?? '') === zone,
      )
      .map((inst) => ({
        value: String(inst['HviUUID']),
        label: `${inst['HviName']} (${inst['HinPrivateIp'] || inst['HviIp'] || 'Appliance'})`,
      }));
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'zoneUUID') {
      return this.routers().map((router) => ({
        value: String(router['zoneUUID']),
        label: String(router['providerName'] ?? router['zoneUUID']),
      }));
    }
    return [];
  }

  override refreshList() {
    void this.fetchRouterIps();
    super.refreshList();
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...(this.editingRecord() ? {} : { zoneUUID: payload['zoneUUID'] || null }),
      name: String(payload['name'] ?? '').trim(),
      networkPolicy: payload['networkPolicy'] || 'allow',
      description: String(payload['description'] ?? '').trim() || null,
    };
  }

  private async fetchRouterIps() {
    const [response, routers, instances] = await Promise.all([
      this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        'hosting/vps/public-ips?status=allocated&limit=500',
      ),
      this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>('hosting/vps/networks/routers'),
      this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>('hosting/vps/instances?limit=500'),
    ]);
    this.routers.set(routers?.data?.items ?? []);
    this.instances.set(instances?.data?.items ?? []);
    this.routerIps.set(
      (response?.data?.items ?? []).filter(
        (ip) => !!ip['HostingVpsTenantZoneHtzUUID'] && ip['HpiNetworkState'] !== 'removing',
      ),
    );
  }
}
