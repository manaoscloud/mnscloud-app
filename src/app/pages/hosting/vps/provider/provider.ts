import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

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
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import type {
  HostingVpsProvider,
  VpsProvider,
  VpsProviderConfig,
  VpsProviderCredentials,
} from '../vps.types';

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

// Private default network of each customer zone (the API re-validates it); not a host address.
const DEFAULT_TENANT_CIDR = ['10', '0', '0', '0'].join('.') + '/24';
const DEFAULT_TENANT_MTU = 1450;
const DEFAULT_TRANSIT_BRIDGE = 'vmbr0';

/** A Proxmox provider field shown only when isolated customer networks (EVPN) are on. */
// Master switch of every provider: closed providers hide their plans from customers (API filter).
const CUSTOMER_PROVISIONING_HELP =
  'When No, customers do not see the plans of this provider and cannot create servers on it; test tenants are not limited. On Proxmox, Yes requires the isolated network per customer (EVPN).';
const TENANT_ZONES_HELP =
  'Each customer gets its own EVPN zone and gateway. Turning it on fills empty fields with the recommended values of this environment; review them before saving.';
const SHARED_SDN_HELP =
  'Optional: one shared Proxmox zone for private networks. Not needed when the isolated network per customer is on.';
const PROXMOX_CUSTOMER_PROVISIONING_ERROR =
  'Turn on the isolated network per customer (EVPN) before allowing customers on Proxmox.';

type TenantZonesConfig = NonNullable<NonNullable<VpsProviderConfig['sdn']>['tenantZones']>;

// Placement policy of a Proxmox provider (API services/proxmoxPlacementService.ts). PL1 shadow mode:
// new servers still go to the plan node; the decision is only recorded for comparison.
const PLACEMENT_POLICY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'spread', label: 'Spread (most free memory)' },
  { value: 'pack', label: 'Pack (fill nodes first)' },
];
const PLACEMENT_POLICY_HELP =
  'Where new servers should go. Shadow mode: servers still go to the plan node; the decision is recorded to compare.';
// Gateways of customer networks (API PL4): spread over the nodes, or every new one on the gateway node.
const GATEWAY_PLACEMENT_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'spread', label: 'Spread across nodes' },
  { value: 'fixed', label: 'Always the gateway node' },
];
const GATEWAY_PLACEMENT_HELP =
  'Spread: each new gateway goes to the node with the fewest gateways, so a node failure affects fewer customers. Existing gateways only move with Customer gateways.';
const PLACEMENT_NODES_HELP = 'Comma separated node names. Empty: every node of the cluster.';
const PLACEMENT_DRAIN_HELP =
  'Nodes that stop receiving new servers (maintenance). Existing servers stay.';
const PLACEMENT_FALLBACK_HELP =
  'Yes: a node without the image can still be chosen (cloned on the image node, then migrated).';
const PLACEMENT_DEFAULT_VALUES: Record<string, string | number> = {
  placementPolicy: 'spread',
  placementNodes: '',
  placementDrainNodes: '',
  placementCpuRatio: 4,
  placementMemoryRatio: 1,
  placementHostReserveMb: 4096,
  placementDiskFullRatio: 0.8,
  placementImageFallback: 1,
};

function placementField(
  key: string,
  label: string,
  extra: Partial<ConfigurableCrudField> = {},
): ConfigurableCrudField {
  return {
    key,
    payloadKey: key,
    label,
    tab: 'limits',
    span: 1,
    hiddenWhen: ({ values }: { values: ConfigurableCrudRecord }) =>
      providerOf(values) !== 'proxmox',
    ...extra,
  };
}

function nodeNames(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Form values of the stored placement policy (defaults when absent). */
function placementFormValues(placement: VpsProviderConfig['placement']): ConfigurableCrudRecord {
  if (!placement) return { ...PLACEMENT_DEFAULT_VALUES };
  return {
    placementPolicy: placement.policy ?? 'spread',
    placementNodes: placement.nodes?.join(', ') ?? '',
    placementDrainNodes: placement.drainNodes?.join(', ') ?? '',
    placementCpuRatio: placement.cpuRatio ?? 4,
    placementMemoryRatio: placement.memoryRatio ?? 1,
    placementHostReserveMb: placement.hostReserveMb ?? 4096,
    placementDiskFullRatio: placement.diskFullRatio ?? 0.8,
    placementImageFallback: placement.imageFallback === false ? 0 : 1,
  };
}

/** Form defaults of the tenant zone fields (replaced by the recommendation when untouched). */
const BUILT_IN_TENANT_DEFAULTS: Record<string, string | number> = {
  sdnTenantTransitBridge: DEFAULT_TRANSIT_BRIDGE,
  sdnTenantMtu: DEFAULT_TENANT_MTU,
  sdnTenantDefaultCidr: DEFAULT_TENANT_CIDR,
};

/** Form values of a tenant zones configuration (stored or recommended). */
function tenantZoneFormValues(zones: TenantZonesConfig | null | undefined): ConfigurableCrudRecord {
  return {
    sdnTenantController: zones?.controller ?? '',
    sdnTenantVrfStart: zones?.vrfVniRange?.[0] ?? '',
    sdnTenantVrfEnd: zones?.vrfVniRange?.[1] ?? '',
    sdnTenantVniStart: zones?.vniRange?.[0] ?? '',
    sdnTenantVniEnd: zones?.vniRange?.[1] ?? '',
    sdnTenantGatewayTemplate: zones?.gateway?.templateVmid ?? '',
    sdnTenantGatewayNode: zones?.gateway?.node ?? '',
    sdnTenantGatewayPlacement: zones?.gateway?.placement === 'fixed' ? 'fixed' : 'spread',
    sdnTenantTransitBridge: zones?.gateway?.transitBridge ?? DEFAULT_TRANSIT_BRIDGE,
    sdnTenantTransitVlan: zones?.gateway?.transitVlan ?? '',
    sdnTenantTransitCidr: zones?.gateway?.transitCidr ?? '',
    sdnTenantTransitPool: zones?.gateway?.transitPool ?? '',
    sdnTenantNameservers: zones?.nameservers?.join(', ') ?? '',
    sdnTenantMtu: zones?.mtu ?? DEFAULT_TENANT_MTU,
    sdnTenantDefaultCidr: zones?.defaultCidr ?? DEFAULT_TENANT_CIDR,
  };
}

function tenantZoneField(
  key: string,
  label: string,
  options: { number?: boolean; required?: boolean } = {},
): ConfigurableCrudField {
  return {
    key,
    payloadKey: key,
    label,
    ...(options.number ? { type: 'number' as const } : {}),
    tab: 'routing',
    span: 1,
    hiddenWhen: ({ values }: { values: ConfigurableCrudRecord }) => !tenantZonesEnabled(values),
    ...(options.required
      ? {
          requiredWhen: ({ values }: { values: ConfigurableCrudRecord }) =>
            tenantZonesEnabled(values),
        }
      : {}),
  };
}

const PROVIDER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'digitalocean', label: 'DigitalOcean Droplets' },
  { value: 'lightsail', label: 'Amazon Lightsail' },
  { value: 'proxmox', label: 'Proxmox VE' },
  { value: 'vmware_vcenter', label: 'VMware vCenter' },
  { value: 'sangfor_scp', label: 'Sangfor Technologies SCP/HCI' },
];

const TEST_PROVIDER_ACTION: ConfigurableCrudRowAction = {
  key: 'test',
  label: 'Test',
  icon: 'science',
  tooltip: 'Test provider',
};

const IMAGE_COPY_STATES: readonly ConfigurableCrudOption[] = [
  { value: 'ready', label: 'Ready' },
  { value: 'copying', label: 'Copying' },
  { value: 'missing', label: 'Missing' },
  { value: 'outdated', label: 'Outdated' },
];

/**
 * Images of a Proxmox provider by identity, one row per image and node (API PL2): copy the current
 * revision to a node that lacks it. The copy runs in the background; Refresh shows its progress.
 */
function providerImages(providerUUID: string): ConfigurableCrudConfig {
  const base = `system/hosting/vps/providers/${providerUUID}/images`;
  return defineCrud({
    endpoint: base,
    uuidField: 'key',
    pageTitle: 'Images per node',
    pageDescription:
      'Each server image and whether its current version exists on every node. A server can only be created on a node that has the image; copy it to the nodes that lack it.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusMode: 'string',
    columns: [
      { id: 'image', label: 'Image', field: 'name' },
      { id: 'imageId', label: 'Image ID', field: 'imageId' },
      { id: 'node', label: 'Node', field: 'node' },
      {
        id: 'state',
        label: 'Status',
        field: 'state',
        kind: 'status',
        options: IMAGE_COPY_STATES,
        chipClass: (value) =>
          value === 'ready'
            ? 'chip-success'
            : value === 'copying'
              ? 'chip-running'
              : value === 'outdated'
                ? 'chip-warning'
                : 'chip-skipped',
      },
      { id: 'vmid', label: 'Template VMID', field: 'vmid' },
      { id: 'disk', label: 'Disk (GB)', field: 'diskGb', kind: 'number' },
      { id: 'visibility', label: 'Visibility', field: 'visibility', optional: true },
    ],
    fields: [],
    rowActions: [
      {
        key: 'copyImage',
        label: 'Copy to this node',
        icon: 'content_copy',
        visible: (row) => row['state'] === 'missing' || row['state'] === 'outdated',
        request: {
          method: 'post',
          endpoint: (row) => `${base}/${String(row['sourceVmid'] ?? '')}/replicas`,
          body: (row) => ({ node: row['node'] }),
          successMessage: 'Image copy started. Refresh to follow it.',
          confirm: {
            title: 'Copy image',
            message:
              'Copy this image to the node? The disk crosses the network and may take several minutes.',
            confirmLabel: 'Copy',
          },
        },
      },
    ],
  });
}

const GATEWAY_NODE_STATES: readonly ConfigurableCrudOption[] = [
  { value: 'current', label: 'Gateway here' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Offline' },
  { value: 'missing', label: 'Gateway not found' },
];

/**
 * Customer network gateways of a Proxmox provider, one row per customer zone and node (API PL4):
 * where each gateway runs and the nodes it can move to. Moving stops the customer's internet access
 * for about a minute; it runs in the background and Refresh shows the new node.
 */
function providerGateways(providerUUID: string): ConfigurableCrudConfig {
  const base = `system/hosting/vps/providers/${providerUUID}/gateways`;
  return defineCrud({
    endpoint: base,
    uuidField: 'key',
    pageTitle: 'Customer gateways',
    pageDescription:
      'Internet gateway of each customer network and the node it runs on. New gateways go to the node with the fewest gateways; move an existing one in a window agreed with the customer.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusMode: 'string',
    columns: [
      { id: 'zone', label: 'Customer zone', field: 'zone' },
      { id: 'node', label: 'Node', field: 'node' },
      {
        id: 'state',
        label: 'Status',
        field: 'state',
        kind: 'status',
        options: GATEWAY_NODE_STATES,
        chipClass: (value) =>
          value === 'current'
            ? 'chip-success'
            : value === 'available'
              ? 'chip-skipped'
              : 'chip-warning',
      },
      { id: 'gateways', label: 'Gateways on node', field: 'gatewaysOnNode', kind: 'number' },
      { id: 'freeMemory', label: 'Free memory (GB)', field: 'freeMemoryGb', kind: 'number' },
      { id: 'vmid', label: 'Gateway VMID', field: 'vmid', optional: true },
      { id: 'currentNode', label: 'Current node', field: 'currentNode', optional: true },
    ],
    fields: [],
    rowActions: [
      {
        key: 'moveGateway',
        label: 'Move gateway here',
        icon: 'swap_horiz',
        visible: (row) => row['state'] === 'available' && row['moving'] !== true,
        request: {
          method: 'post',
          endpoint: (row) => `${base}/${String(row['zoneUUID'] ?? '')}/move`,
          body: (row) => ({ node: row['node'] }),
          successMessage: 'Gateway move started. Refresh to follow it.',
          confirm: {
            title: 'Move gateway',
            message:
              "Move this customer's gateway to the node? The customer's servers lose internet access for about a minute while it moves.",
            confirmLabel: 'Move',
          },
        },
      },
    ],
  });
}

const PROVIDER_GATEWAYS_ACTION: ConfigurableCrudRowAction = {
  key: 'gateways',
  label: 'Customer gateways',
  icon: 'router',
  tooltip: 'Customer gateways',
  visible: (row) => String(row['HvrProvider'] ?? '') === 'proxmox',
  collection: (row) => providerGateways(String(row['HvrUUID'] ?? '')),
};

const PROVIDER_IMAGES_ACTION: ConfigurableCrudRowAction = {
  key: 'images',
  label: 'Images per node',
  icon: 'layers',
  tooltip: 'Images per node',
  visible: (row) => String(row['HvrProvider'] ?? '') === 'proxmox',
  collection: (row) => providerImages(String(row['HvrUUID'] ?? '')),
};

const CONFIG_FIELD_KEYS = [
  'region',
  'projectId',
  'accessKeyId',
  'apiUrl',
  'node',
  'storage',
  'bridge',
  'templateVmid',
  'vcenterUrl',
  'datacenter',
  'cluster',
  'resourcePool',
  'folder',
  'datastore',
  'network',
  'templateVm',
  'templateVmId',
  'customizationSpec',
  'apiVersion',
  'authPath',
  'validatePath',
  'resourcePoolId',
  'clusterId',
  'networkId',
  'datastoreId',
  'storagePoolId',
  'imageId',
  'timeoutSeconds',
] as const;

const CREDENTIAL_FIELD_KEYS = [
  'apiToken',
  'secretAccessKey',
  'tokenId',
  'tokenSecret',
  'username',
  'password',
] as const;

const HOSTING_VPS_PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps/providers',
  uuidField: 'HvrUUID',
  pageTitle: 'VPS Provider',
  pageDescription: 'Configure platform VPS providers. Provider administration is master-only.',
  createTitle: 'New provider',
  editTitle: 'Edit provider',
  dialogDescription: 'Configure platform credentials for VPS provisioning.',
  searchPlaceholder: 'Name, provider or region',
  emptyLabel: 'No providers found.',
  deleteTitle: 'Delete provider',
  deleteMessage: 'Are you sure you want to delete this provider?',
  deleteSelectedTitle: 'Delete selected providers',
  deleteSelectedMessage: 'Are you sure you want to delete {count} selected provider(s)?',
  savedMessage: 'Provider saved successfully.',
  deletedMessage: 'Provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete provider.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  authenticationTabAfterRecord: true,
  rowActions: [TEST_PROVIDER_ACTION],
  tabLabels: {
    authentication: 'API',
    network: 'Server network',
    routing: 'Customer network',
    limits: 'Placement',
  },
  initialValues: {
    name: '',
    provider: 'digitalocean',
    region: '',
    projectId: '',
    accessKeyId: '',
    apiUrl: '',
    node: '',
    storage: '',
    bridge: '',
    templateVmid: '',
    verifyTls: 1,
    sdnEnabled: 0,
    sdnZone: '',
    sdnCidrPool: '',
    sdnTagStart: '',
    sdnTagEnd: '',
    sdnSnat: 0,
    sdnTenantZones: 0,
    sdnTenantController: '',
    sdnTenantVrfStart: '',
    sdnTenantVrfEnd: '',
    sdnTenantVniStart: '',
    sdnTenantVniEnd: '',
    sdnTenantGatewayTemplate: '',
    sdnTenantGatewayNode: '',
    sdnTenantGatewayPlacement: 'spread',
    sdnTenantTransitBridge: DEFAULT_TRANSIT_BRIDGE,
    sdnTenantTransitVlan: '',
    sdnTenantTransitCidr: '',
    sdnTenantTransitPool: '',
    sdnTenantNameservers: '',
    sdnTenantMtu: DEFAULT_TENANT_MTU,
    sdnTenantDefaultCidr: DEFAULT_TENANT_CIDR,
    vlanTag: '',
    customerProvisioning: 0,
    ...PLACEMENT_DEFAULT_VALUES,
    vcenterUrl: '',
    datacenter: '',
    cluster: '',
    resourcePool: '',
    folder: '',
    datastore: '',
    network: '',
    templateVm: '',
    templateVmId: '',
    customizationSpec: '',
    apiVersion: '',
    authPath: '',
    validatePath: '',
    resourcePoolId: '',
    clusterId: '',
    networkId: '',
    datastoreId: '',
    storagePoolId: '',
    imageId: '',
    timeoutSeconds: '',
    catalogRegionsPath: '',
    catalogSizesPath: '',
    catalogImagesPath: '',
    apiToken: '',
    secretAccessKey: '',
    tokenId: '',
    tokenSecret: '',
    username: '',
    password: '',
    isActive: 1,
    isDefault: 0,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HvrName', uuidField: 'HvrUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HvrProvider',
      lookupKey: 'provider',
    },
    { id: 'region', label: 'Region / Project', field: 'RegionDisplay' },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'HvrIsDefault',
      className: 'status-col',
    },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HvrIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'isActive',
      source: 'HvrIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HvrIsDefault',
      payloadKey: 'isDefault',
      label: 'Default',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'customerProvisioning',
      payloadKey: 'customerProvisioning',
      label: 'Customers may create servers',
      type: 'select',
      options: [...YES_NO_OPTIONS],
      span: 1,
      help: CUSTOMER_PROVISIONING_HELP,
    },
    {
      key: 'provider',
      source: 'HvrProvider',
      payloadKey: 'provider',
      label: 'Provider',
      type: 'search-select',
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'HvrName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'Primary provider',
      required: true,
      span: 1,
    },
    {
      key: 'projectId',
      payloadKey: 'projectId',
      label: 'Project ID',
      placeholder: 'project-id',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'digitalocean',
    },
    {
      key: 'apiUrl',
      payloadKey: 'apiUrl',
      label: 'API URL',
      placeholder: 'https://proxmox.example.com:8006',
      tab: 'authentication',
      hiddenWhen: ({ values }) => !['proxmox', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ values }) =>
        providerOf(values) === 'proxmox' || providerOf(values) === 'sangfor_scp',
    },
    {
      key: 'node',
      payloadKey: 'node',
      label: 'Node',
      placeholder: 'pve1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'storage',
      payloadKey: 'storage',
      label: 'Storage',
      placeholder: 'local-lvm',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'templateVmid',
      payloadKey: 'templateVmid',
      label: 'Template VMID',
      placeholder: '9000',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'verifyTls',
      payloadKey: 'verifyTls',
      label: 'Verify TLS',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) =>
        !['proxmox', 'vmware_vcenter', 'sangfor_scp'].includes(providerOf(values)),
    },
    {
      key: 'bridge',
      payloadKey: 'bridge',
      label: 'Bridge',
      placeholder: 'vmbr0',
      tab: 'network',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'vlanTag',
      payloadKey: 'vlanTag',
      label: 'Server network VLAN tag',
      type: 'number',
      tab: 'network',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'sdnEnabled',
      payloadKey: 'sdnEnabled',
      label: 'Shared SDN zone for private networks',
      breakBefore: true,
      help: SHARED_SDN_HELP,
      type: 'select',
      options: [...YES_NO_OPTIONS],
      tab: 'network',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
    },
    {
      key: 'sdnZone',
      payloadKey: 'sdnZone',
      label: 'Approved SDN zone ID',
      tab: 'network',
      span: 1,
      hiddenWhen: ({ values }) => !sdnEnabled(values),
      requiredWhen: ({ values }) => sdnEnabled(values),
    },
    {
      key: 'sdnCidrPool',
      payloadKey: 'sdnCidrPool',
      label: 'Authorized private CIDRs (comma separated)',
      tab: 'network',
      hiddenWhen: ({ values }) => !sdnEnabled(values),
      requiredWhen: ({ values }) => sdnEnabled(values),
    },
    {
      key: 'sdnTagStart',
      payloadKey: 'sdnTagStart',
      label: 'Reserved VLAN/VNI range start',
      type: 'number',
      tab: 'network',
      span: 1,
      hiddenWhen: ({ values }) => !sdnEnabled(values),
    },
    {
      key: 'sdnTagEnd',
      payloadKey: 'sdnTagEnd',
      label: 'Reserved VLAN/VNI range end',
      type: 'number',
      tab: 'network',
      span: 1,
      hiddenWhen: ({ values }) => !sdnEnabled(values),
    },
    {
      key: 'sdnSnat',
      payloadKey: 'sdnSnat',
      label: 'Enable subnet SNAT',
      type: 'select',
      options: [...YES_NO_OPTIONS],
      tab: 'network',
      span: 1,
      hiddenWhen: ({ values }) => !sdnEnabled(values),
    },
    {
      key: 'sdnTenantZones',
      payloadKey: 'sdnTenantZones',
      label: 'Isolated network per customer (EVPN)',
      type: 'select',
      options: [...YES_NO_OPTIONS],
      tab: 'routing',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
      help: TENANT_ZONES_HELP,
    },
    tenantZoneField('sdnTenantController', 'EVPN controller ID', { required: true }),
    tenantZoneField('sdnTenantVrfStart', 'Customer VRF VNI range start', {
      number: true,
      required: true,
    }),
    tenantZoneField('sdnTenantVrfEnd', 'Customer VRF VNI range end', {
      number: true,
      required: true,
    }),
    tenantZoneField('sdnTenantVniStart', 'Customer network VNI range start', {
      number: true,
      required: true,
    }),
    tenantZoneField('sdnTenantVniEnd', 'Customer network VNI range end', {
      number: true,
      required: true,
    }),
    tenantZoneField('sdnTenantGatewayTemplate', 'Customer gateway template VMID', {
      number: true,
      required: true,
    }),
    tenantZoneField('sdnTenantGatewayNode', 'Customer gateway node', { required: true }),
    {
      ...tenantZoneField('sdnTenantGatewayPlacement', 'Customer gateway placement'),
      type: 'select',
      options: [...GATEWAY_PLACEMENT_OPTIONS],
      help: GATEWAY_PLACEMENT_HELP,
    },
    tenantZoneField('sdnTenantTransitBridge', 'Transit bridge'),
    tenantZoneField('sdnTenantTransitVlan', 'Transit VLAN', { number: true, required: true }),
    tenantZoneField('sdnTenantTransitCidr', 'Transit network CIDR', { required: true }),
    tenantZoneField('sdnTenantTransitPool', 'Transit pool of this provider (CIDR)'),
    tenantZoneField('sdnTenantNameservers', 'Customer DNS resolvers (comma separated)'),
    tenantZoneField('sdnTenantMtu', 'Customer network MTU', { number: true }),
    tenantZoneField('sdnTenantDefaultCidr', 'Default customer network CIDR'),
    placementField('placementPolicy', 'Placement policy', {
      type: 'select',
      options: [...PLACEMENT_POLICY_OPTIONS],
      help: PLACEMENT_POLICY_HELP,
    }),
    placementField('placementImageFallback', 'Allow nodes without the image', {
      type: 'select',
      options: [...YES_NO_OPTIONS],
      help: PLACEMENT_FALLBACK_HELP,
    }),
    placementField('placementNodes', 'Allowed nodes', {
      breakBefore: true,
      help: PLACEMENT_NODES_HELP,
    }),
    placementField('placementDrainNodes', 'Draining nodes', { help: PLACEMENT_DRAIN_HELP }),
    placementField('placementCpuRatio', 'vCPU per physical thread', {
      type: 'number',
      breakBefore: true,
    }),
    placementField('placementMemoryRatio', 'Memory per physical memory', { type: 'number' }),
    placementField('placementHostReserveMb', 'Host memory reserve (MiB)', { type: 'number' }),
    placementField('placementDiskFullRatio', 'Maximum storage use (0.1 to 1)', { type: 'number' }),
    {
      key: 'tokenId',
      payloadKey: 'tokenId',
      label: 'Token ID',
      placeholder: 'mnscloud@pve!provisioner',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'proxmox',
    },
    {
      key: 'tokenSecret',
      payloadKey: 'tokenSecret',
      label: 'Token Secret',
      type: 'password',
      placeholder: 'Leave blank to keep the current secret',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'proxmox',
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'proxmox',
    },
    {
      key: 'vcenterUrl',
      payloadKey: 'vcenterUrl',
      label: 'vCenter URL',
      placeholder: 'https://vcenter.example.com',
      tab: 'authentication',
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
      requiredWhen: ({ values }) => providerOf(values) === 'vmware_vcenter',
    },
    {
      key: 'datacenter',
      payloadKey: 'datacenter',
      label: 'Datacenter',
      placeholder: 'DC1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'cluster',
      payloadKey: 'cluster',
      label: 'Cluster',
      placeholder: 'Cluster01',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'resourcePool',
      payloadKey: 'resourcePool',
      label: 'Resource pool',
      placeholder: 'Resources',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'folder',
      payloadKey: 'folder',
      label: 'Folder',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'datastore',
      payloadKey: 'datastore',
      label: 'Datastore',
      placeholder: 'datastore1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'network',
      payloadKey: 'network',
      label: 'Network',
      placeholder: 'VM Network',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'templateVm',
      payloadKey: 'templateVm',
      label: 'Template VM',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'templateVmId',
      payloadKey: 'templateVmId',
      label: 'Template VM ID',
      placeholder: 'vm-123',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'customizationSpec',
      payloadKey: 'customizationSpec',
      label: 'Customization spec',
      placeholder: 'linux-cloud-init',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'vmware_vcenter',
    },
    {
      key: 'apiVersion',
      payloadKey: 'apiVersion',
      label: 'API version',
      placeholder: 'v1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'authPath',
      payloadKey: 'authPath',
      label: 'Auth path',
      placeholder: '/api/v1/auth/login',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'validatePath',
      payloadKey: 'validatePath',
      label: 'Validate path',
      placeholder: '/api/v1/system/version',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'region',
      payloadKey: 'region',
      label: 'API region',
      placeholder: 'us-east-1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['lightsail', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ values }) => providerOf(values) === 'lightsail',
    },
    {
      key: 'resourcePoolId',
      payloadKey: 'resourcePoolId',
      label: 'Resource pool ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'clusterId',
      payloadKey: 'clusterId',
      label: 'Cluster ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'networkId',
      payloadKey: 'networkId',
      label: 'Network ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'datastoreId',
      payloadKey: 'datastoreId',
      label: 'Datastore ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'storagePoolId',
      payloadKey: 'storagePoolId',
      label: 'Storage pool ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'imageId',
      payloadKey: 'imageId',
      label: 'Image ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'timeoutSeconds',
      payloadKey: 'timeoutSeconds',
      label: 'Timeout seconds',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'catalogRegionsPath',
      payloadKey: 'catalogRegionsPath',
      label: 'Catalog regions path',
      placeholder: '/api/v1/regions',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'catalogSizesPath',
      payloadKey: 'catalogSizesPath',
      label: 'Catalog sizes path',
      placeholder: '/api/v1/flavors',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'catalogImagesPath',
      payloadKey: 'catalogImagesPath',
      label: 'Catalog images path',
      placeholder: '/api/v1/images',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => providerOf(values) !== 'sangfor_scp',
    },
    {
      key: 'apiToken',
      payloadKey: 'apiToken',
      label: 'API Token',
      type: 'password',
      placeholder: 'Leave blank to keep the current token',
      autocomplete: 'new-password',
      tab: 'authentication',
      hiddenWhen: ({ values }) => !['digitalocean', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'digitalocean',
    },
    {
      key: 'accessKeyId',
      payloadKey: 'accessKeyId',
      label: 'Access Key ID',
      labelWhen: ({ values }) =>
        providerOf(values) === 'sangfor_scp' ? 'Access Key' : 'Access Key ID',
      placeholder: 'AKIA...',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['lightsail', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ values }) => providerOf(values) === 'lightsail',
    },
    {
      key: 'secretAccessKey',
      payloadKey: 'secretAccessKey',
      label: 'Secret Access Key',
      labelWhen: ({ values }) =>
        providerOf(values) === 'sangfor_scp' ? 'Secret Key' : 'Secret Access Key',
      type: 'password',
      placeholder: 'Leave blank to keep the current secret',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['lightsail', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'lightsail',
    },
    {
      key: 'username',
      payloadKey: 'username',
      label: 'Username',
      placeholder: 'mnscloud-provisioner@vsphere.local',
      autocomplete: 'off',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['vmware_vcenter', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'vmware_vcenter',
    },
    {
      key: 'password',
      payloadKey: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'Leave blank to keep the current password',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !['vmware_vcenter', 'sangfor_scp'].includes(providerOf(values)),
      requiredWhen: ({ editing, values }) => !editing && providerOf(values) === 'vmware_vcenter',
    },
  ],
};

@Component({
  selector: 'app-hosting-vps-provider',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsProviderPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/providers' : HOSTING_VPS_PROVIDER_CONFIG.endpoint,
  );

  constructor() {
    const masterScope = (inject(ActivatedRoute).snapshot.data?.['scope'] ?? 'tenant') === 'master';
    super({
      ...HOSTING_VPS_PROVIDER_CONFIG,
      canCreate: masterScope,
      canEdit: masterScope,
      canDelete: masterScope,
      rowActions: masterScope
        ? [TEST_PROVIDER_ACTION, PROVIDER_IMAGES_ACTION, PROVIDER_GATEWAYS_ACTION]
        : [TEST_PROVIDER_ACTION],
    });
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

  /** Turning on the isolated network per customer fills its empty fields with this environment's recommendation. */
  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'sdnTenantZones' || truthyNumber(value) !== 1 || !this.isMaster()) return;
    void this.prefillTenantZones();
  }

  private async prefillTenantZones(): Promise<void> {
    try {
      const result = await this.api.get<{ data?: { item?: { tenantZones?: TenantZonesConfig } } }>(
        `${this.endpoint()}/network-defaults`,
      );
      const recommended = result?.data?.item?.tenantZones;
      if (!recommended || truthyNumber(this.formValues()['sdnTenantZones']) !== 1) return;
      const suggested = tenantZoneFormValues(recommended);
      const current = this.formValues();
      const patch: ConfigurableCrudRecord = {};
      for (const [field, value] of Object.entries(suggested)) {
        const existing = String(current[field] ?? '').trim();
        // Only empty fields or untouched built-in defaults; what the master typed stays.
        if (!existing || existing === String(BUILT_IN_TENANT_DEFAULTS[field] ?? '')) {
          patch[field] = value;
        }
      }
      if (Object.keys(patch).length) this.patchFormValues(patch);
    } catch {
      // Suggestions are optional: the master can still fill the fields by hand.
    }
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'provider') return PROVIDER_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const items = await super.fetchItems(filters);
    return items.map((item) => {
      const config = parseConfig<VpsProviderConfig>(item['HvrConfig']);
      return {
        ...item,
        HvrConfig: config,
        RegionDisplay: regionDisplay(config),
      };
    });
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    void this.startEditWithCredentials(row);
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const base = super.formValuesFromRecord(row);
    const config = parseConfig<VpsProviderConfig>(row['HvrConfig']) ?? {};
    const credentials = (row['credentials'] as VpsProviderCredentials | null | undefined) ?? {};
    return {
      ...base,
      name: String(row['HvrName'] ?? base['name'] ?? ''),
      provider: providerOf(row['HvrProvider'] ?? base['provider']),
      sdnEnabled: config.sdn?.zone ? 1 : 0,
      sdnZone: config.sdn?.zone ?? '',
      sdnCidrPool: config.sdn?.cidrPool?.join(', ') ?? '',
      sdnTagStart: config.sdn?.tagRange?.[0] ?? '',
      sdnTagEnd: config.sdn?.tagRange?.[1] ?? '',
      sdnSnat: config.sdn?.snat ? 1 : 0,
      sdnTenantZones: config.sdn?.tenantZones ? 1 : 0,
      ...tenantZoneFormValues(config.sdn?.tenantZones),
      vlanTag: config.vlanTag ?? '',
      ...placementFormValues(config.placement),
      // Never set: Proxmox stays closed and the other providers open (the API rule).
      customerProvisioning:
        config.customerProvisioning === undefined || config.customerProvisioning === null
          ? providerOf(row['HvrProvider'] ?? base['provider']) === 'proxmox'
            ? 0
            : 1
          : config.customerProvisioning
            ? 1
            : 0,
      region: config.region ?? '',
      projectId: config.projectId ?? '',
      accessKeyId: config.accessKeyId ?? '',
      apiUrl: config.apiUrl ?? '',
      node: config.node ?? '',
      storage: config.storage ?? '',
      bridge: config.bridge ?? '',
      // Older saves stored an empty field as the text "null".
      templateVmid:
        config.templateVmid === undefined ||
        config.templateVmid === null ||
        ['null', 'undefined'].includes(String(config.templateVmid).trim().toLowerCase())
          ? ''
          : String(config.templateVmid),
      verifyTls: config.verifyTls === undefined ? 1 : truthyNumber(config.verifyTls),
      vcenterUrl: config.vcenterUrl ?? '',
      datacenter: config.datacenter ?? '',
      cluster: config.cluster ?? '',
      resourcePool: config.resourcePool ?? '',
      folder: config.folder ?? '',
      datastore: config.datastore ?? '',
      network: config.network ?? '',
      templateVm: config.templateVm ?? '',
      templateVmId: config.templateVmId ?? '',
      customizationSpec: config.customizationSpec ?? '',
      apiVersion: config.apiVersion ?? '',
      authPath: config.authPath ?? '',
      validatePath: config.validatePath ?? '',
      resourcePoolId: config.resourcePoolId ?? '',
      clusterId: config.clusterId ?? '',
      networkId: config.networkId ?? '',
      datastoreId: config.datastoreId ?? '',
      storagePoolId: config.storagePoolId ?? '',
      imageId: config.imageId ?? '',
      timeoutSeconds: config.timeoutSeconds === undefined ? '' : String(config.timeoutSeconds),
      catalogRegionsPath: config.catalogPaths?.regions ?? '',
      catalogSizesPath: config.catalogPaths?.sizes ?? '',
      catalogImagesPath: config.catalogPaths?.images ?? '',
      apiToken: credentials.apiToken ?? '',
      secretAccessKey: credentials.secretAccessKey ?? '',
      tokenId: credentials.tokenId ?? '',
      tokenSecret: credentials.tokenSecret ?? '',
      username: credentials.username ?? '',
      password: credentials.password ?? '',
      isActive: truthyNumber(row['HvrIsActive']),
      isDefault: truthyNumber(row['HvrIsDefault']),
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next: ConfigurableCrudRecord = {
      name: typeof payload['name'] === 'string' ? payload['name'].trim() : payload['name'],
      provider: providerOf(payload['provider']),
      config: buildConfigPayload(payload),
      isActive: truthyNumber(payload['isActive']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
    const credentials = buildCredentialsPayload(payload);
    if (credentials) next['credentials'] = credentials;
    return next;
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;

    const editing = !!this.editingRecord();
    const selected = providerOf(payload['provider']);
    const credentials = buildCredentialsPayload(payload);

    if (
      selected === 'proxmox' &&
      truthyNumber(payload['customerProvisioning']) === 1 &&
      !tenantZonesEnabled(payload)
    ) {
      return this.rejectField('customerProvisioning', PROXMOX_CUSTOMER_PROVISIONING_ERROR);
    }

    if (sdnEnabled(payload)) {
      const start = String(payload['sdnTagStart'] ?? '').trim();
      const end = String(payload['sdnTagEnd'] ?? '').trim();
      if (
        (start || end) &&
        (!start ||
          !end ||
          ![Number(start), Number(end)].every(
            (tag) => Number.isInteger(tag) && tag >= 1 && tag <= 16777215,
          ) ||
          Number(start) > Number(end))
      ) {
        return this.rejectField(
          'sdnTagStart',
          'Enter both ends of an ordered reserved VLAN/VNI range.',
        );
      }
    }

    if (tenantZonesEnabled(payload)) {
      for (const [startKey, endKey] of [
        ['sdnTenantVrfStart', 'sdnTenantVrfEnd'],
        ['sdnTenantVniStart', 'sdnTenantVniEnd'],
      ] as const) {
        const start = Number(payload[startKey]);
        const end = Number(payload[endKey]);
        if (
          ![start, end].every((vni) => Number.isInteger(vni) && vni >= 1 && vni <= 16777215) ||
          start > end
        ) {
          return this.rejectField(startKey, 'Enter both ends of an ordered VNI range.');
        }
      }
      const transitVlan = Number(payload['sdnTenantTransitVlan']);
      if (!Number.isInteger(transitVlan) || transitVlan < 1 || transitVlan > 4094) {
        return this.rejectField('sdnTenantTransitVlan', 'Enter a VLAN ID from 1 to 4094.');
      }
      const templateVmid = Number(payload['sdnTenantGatewayTemplate']);
      if (!Number.isInteger(templateVmid) || templateVmid < 100) {
        return this.rejectField(
          'sdnTenantGatewayTemplate',
          'Enter the template VMID (100 or more).',
        );
      }
    }

    if (providerOf(payload) === 'proxmox') {
      const ranges: Array<[string, number, number, boolean, string]> = [
        ['placementCpuRatio', 0.5, 32, false, 'Enter a number from 0.5 to 32.'],
        ['placementMemoryRatio', 0.5, 4, false, 'Enter a number from 0.5 to 4.'],
        ['placementHostReserveMb', 0, 262144, true, 'Enter whole MiB from 0 to 262144.'],
        ['placementDiskFullRatio', 0.1, 1, false, 'Enter a number from 0.1 to 1.'],
      ];
      for (const [key, min, max, integer, message] of ranges) {
        const value = Number(payload[key]);
        if (
          !Number.isFinite(value) ||
          value < min ||
          value > max ||
          (integer && !Number.isInteger(value))
        ) {
          return this.rejectField(key, message);
        }
      }
      for (const key of ['placementNodes', 'placementDrainNodes']) {
        if (
          nodeNames(payload[key]).some((name) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(name))
        ) {
          return this.rejectField(key, 'Enter node names separated by commas.');
        }
      }
    }

    const vlanTag = normalizeString(payload['vlanTag']);
    if (
      providerOf(payload) === 'proxmox' &&
      vlanTag &&
      !(Number.isInteger(Number(vlanTag)) && Number(vlanTag) >= 1 && Number(vlanTag) <= 4094)
    ) {
      return this.rejectField('vlanTag', 'Enter a VLAN tag between 1 and 4094.');
    }

    if (!editing && !credentials) {
      return this.rejectField(
        this.firstVisibleField(CREDENTIAL_FIELD_KEYS),
        selected === 'sangfor_scp'
          ? 'Sangfor requires an API token, Access Key/Secret Key, or username/password.'
          : 'Credentials are required for new providers.',
      );
    }

    if (selected === 'sangfor_scp' && !editing) {
      const hasToken = !!normalizeString(payload['apiToken']);
      const hasAccessKeyPair =
        !!normalizeString(payload['accessKeyId']) && !!normalizeString(payload['secretAccessKey']);
      const hasLogin =
        !!normalizeString(payload['username']) && !!normalizeString(payload['password']);
      if (!hasToken && !hasAccessKeyPair && !hasLogin) {
        return this.rejectField(
          'apiToken',
          'Sangfor requires an API token, Access Key/Secret Key, or username/password.',
        );
      }
    }

    return true;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'test') return;
    const uuid = String(row['HvrUUID'] ?? '');
    if (!uuid) return;

    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      const label =
        this.lookupLabel('provider', row['HvrProvider']) || String(row['HvrProvider'] ?? '');
      this.snack.success(this.t(`${label} provider tested successfully.`));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to test provider.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async startEditWithCredentials(row: ConfigurableCrudRecord): Promise<void> {
    let providerRecord = row;
    try {
      const result = await this.api.get<{ data?: { item?: HostingVpsProvider | null } }>(
        `${this.endpoint()}/${String(row['HvrUUID'] ?? '')}`,
      );
      const detail = result?.data?.item;
      if (detail) {
        const config = parseConfig<VpsProviderConfig>(detail.HvrConfig);
        providerRecord = {
          ...detail,
          HvrConfig: config,
          RegionDisplay: regionDisplay(config),
        } as ConfigurableCrudRecord;
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load provider credentials.'));
    }
    super.startEdit(providerRecord);
  }
}

function providerOf(value: unknown): VpsProvider {
  if (value && typeof value === 'object' && 'provider' in (value as Record<string, unknown>)) {
    return providerOf((value as ConfigurableCrudRecord)['provider']);
  }
  const normalized = String(value ?? 'digitalocean') as VpsProvider;
  return PROVIDER_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : 'digitalocean';
}

function truthyNumber(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
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

function regionDisplay(config: VpsProviderConfig | null | undefined): string {
  if (!config) return '';
  return String(
    config.region ??
      config.projectId ??
      config.apiUrl ??
      config.vcenterUrl ??
      config.resourcePoolId ??
      '',
  );
}

function buildConfigPayload(values: ConfigurableCrudRecord): VpsProviderConfig {
  const config: VpsProviderConfig = {};
  for (const key of CONFIG_FIELD_KEYS) {
    const normalized = normalizeString(values[key]);
    if (normalized) (config as Record<string, unknown>)[key] = normalized;
  }

  const provider = providerOf(values['provider']);
  if (provider === 'proxmox') {
    config.sdn = sdnEnabled(values)
      ? {
          zone: String(values['sdnZone'] ?? '').trim(),
          cidrPool: String(values['sdnCidrPool'] ?? '')
            .split(/[,\n]+/)
            .map((cidr) => cidr.trim())
            .filter(Boolean),
          tagRange:
            String(values['sdnTagStart'] ?? '').trim() || String(values['sdnTagEnd'] ?? '').trim()
              ? [Number(values['sdnTagStart']), Number(values['sdnTagEnd'])]
              : null,
          snat: truthyNumber(values['sdnSnat']) === 1,
          tenantZones: buildTenantZonesPayload(values),
        }
      : tenantZonesEnabled(values)
        ? // Only the per-customer zones: the API accepts sdn without the shared zone.
          {
            zone: '',
            cidrPool: [],
            tagRange: null,
            snat: false,
            tenantZones: buildTenantZonesPayload(values),
          }
        : null;
    const vlanTag = normalizeString(values['vlanTag']);
    config.vlanTag = vlanTag ? Number(vlanTag) : null;
    config.placement = {
      policy: values['placementPolicy'] === 'pack' ? 'pack' : 'spread',
      nodes: nodeNames(values['placementNodes']),
      drainNodes: nodeNames(values['placementDrainNodes']),
      cpuRatio: Number(values['placementCpuRatio'] ?? 4),
      memoryRatio: Number(values['placementMemoryRatio'] ?? 1),
      hostReserveMb: Number(values['placementHostReserveMb'] ?? 4096),
      diskFullRatio: Number(values['placementDiskFullRatio'] ?? 0.8),
      imageFallback: truthyNumber(values['placementImageFallback']) === 1,
    };
  }
  config.customerProvisioning = truthyNumber(values['customerProvisioning']) === 1;
  if (['proxmox', 'vmware_vcenter', 'sangfor_scp'].includes(provider)) {
    config.verifyTls = truthyNumber(values['verifyTls']) === 1;
  }

  const catalogPaths = {
    regions: normalizeString(values['catalogRegionsPath']),
    sizes: normalizeString(values['catalogSizesPath']),
    images: normalizeString(values['catalogImagesPath']),
  };
  if (Object.values(catalogPaths).some(Boolean)) config.catalogPaths = catalogPaths;
  return config;
}

function buildCredentialsPayload(values: ConfigurableCrudRecord): VpsProviderCredentials | null {
  const credentials: VpsProviderCredentials = {};
  for (const key of CREDENTIAL_FIELD_KEYS) {
    const normalized = normalizeString(values[key]);
    if (normalized) credentials[key] = normalized;
  }
  return Object.keys(credentials).length ? credentials : null;
}

function sdnEnabled(values: ConfigurableCrudRecord): boolean {
  return providerOf(values) === 'proxmox' && truthyNumber(values['sdnEnabled']) === 1;
}

function tenantZonesEnabled(values: ConfigurableCrudRecord): boolean {
  return providerOf(values) === 'proxmox' && truthyNumber(values['sdnTenantZones']) === 1;
}

function buildTenantZonesPayload(
  values: ConfigurableCrudRecord,
): NonNullable<NonNullable<VpsProviderConfig['sdn']>['tenantZones']> | null {
  if (!tenantZonesEnabled(values)) return null;
  const range = (start: string, end: string): [number, number] => [
    Number(values[start]),
    Number(values[end]),
  ];
  return {
    controller: normalizeString(values['sdnTenantController']) ?? '',
    vrfVniRange: range('sdnTenantVrfStart', 'sdnTenantVrfEnd'),
    vniRange: range('sdnTenantVniStart', 'sdnTenantVniEnd'),
    gateway: {
      templateVmid: Number(values['sdnTenantGatewayTemplate']),
      node: normalizeString(values['sdnTenantGatewayNode']) ?? '',
      placement: values['sdnTenantGatewayPlacement'] === 'fixed' ? 'fixed' : 'spread',
      transitBridge: normalizeString(values['sdnTenantTransitBridge']) ?? DEFAULT_TRANSIT_BRIDGE,
      transitVlan: Number(values['sdnTenantTransitVlan']),
      transitCidr: normalizeString(values['sdnTenantTransitCidr']) ?? '',
      // Disjoint pools when several providers share the transit VLAN (DEV and PROD).
      ...(normalizeString(values['sdnTenantTransitPool'])
        ? { transitPool: normalizeString(values['sdnTenantTransitPool'])! }
        : {}),
    },
    nameservers: (normalizeString(values['sdnTenantNameservers']) ?? '')
      .split(/[,\s]+/)
      .map((server) => server.trim())
      .filter(Boolean),
    mtu: Number(values['sdnTenantMtu']) || DEFAULT_TENANT_MTU,
    defaultCidr: normalizeString(values['sdnTenantDefaultCidr']) ?? DEFAULT_TENANT_CIDR,
  };
}
