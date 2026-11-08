import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollectionColumn,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import type { HostingVpsInstance, HostingVpsNetwork } from '../vps.types';
import { attachableInstances, serverRowRight } from '../vps.types';

const OUTBOUND_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'accept', label: 'Allow all outbound' },
  { value: 'drop', label: 'Allow only listed outbound' },
];

const PROFILE_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'syncing', label: 'Syncing' },
  { value: 'failed', label: 'Failed' },
  { value: 'deleting', label: 'Deleting' },
];

const DIRECTION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'in', label: 'Inbound' },
  { value: 'out', label: 'Outbound' },
];

const ACTION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

const ATTACHMENT_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'applying', label: 'Applying' },
  { value: 'applied', label: 'Applied' },
  { value: 'detaching', label: 'Removing' },
  { value: 'failed', label: 'Failed' },
];

// Protocol names are protocol terms and stay literal in every language.
const PROTOCOL_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'icmpv6', label: 'ICMPv6' },
  { value: 'all', label: 'All protocols' },
];

/** Provider-side filtering only; guest nftables stay with Cyber Security + Agent. */
const config = defineCrud({
  endpoint: 'hosting/vps/firewalls',
  uuidField: 'HvfUUID',
  pageTitle: 'VPS firewall profiles',
  pageDescription:
    'Reusable inbound/outbound rule sets enforced by the VPS provider and applied to one or more instances.',
  createTitle: 'New firewall profile',
  editTitle: 'Edit firewall profile',
  dialogDescription:
    'Inbound traffic not matched by a rule is dropped. Add rules and instances after saving the profile.',
  searchPlaceholder: 'Name or description',
  emptyLabel: 'No firewall profiles found.',
  deleteTitle: 'Delete firewall profile',
  deleteMessage: 'Delete this firewall profile? Remove it from every instance first.',
  deleteSelectedTitle: 'Delete selected firewall profiles',
  deleteSelectedMessage: 'Delete {count} selected firewall profile(s)?',
  savedMessage: 'Firewall profile saved successfully.',
  deletedMessage: 'Firewall profile delete requested.',
  deleteFailedMessage: 'Failed to delete firewall profile.',
  bulkDelete: true,
  pageSizeOptions: [5, 10, 25, 100],
  listFilters: [
    {
      key: 'profileStatus',
      label: 'Profile status',
      paramKey: 'status',
      type: 'select',
      options: PROFILE_STATUS_OPTIONS,
      translateOptions: true,
      span: 1,
    },
  ],
  initialValues: { status: 1, name: '', outboundPolicy: 'accept', description: '' },
  fields: [],
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HvfName', uuidField: 'HvfUUID' },
    {
      id: 'outbound',
      label: 'Outbound',
      kind: 'status',
      field: 'HvfOutboundPolicy',
      options: OUTBOUND_OPTIONS,
      chipClass: () => 'chip-skipped',
    },
    { id: 'rules', label: 'Rules', kind: 'number', field: 'RuleCount' },
    { id: 'instances', label: 'Instances', kind: 'number', field: 'InstanceCount' },
    { id: 'revision', label: 'Revision', kind: 'number', field: 'HvfRevision' },
    {
      id: 'profileStatus',
      label: 'Situation',
      kind: 'status',
      field: 'HvfStatus',
      options: PROFILE_STATUS_OPTIONS,
      className: 'status-col',
      chipClass: (value) =>
        value === 'active' ? 'chip-success' : value === 'failed' ? 'chip-warning' : 'chip-skipped',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HvfIsActive' },
  ],
});

@Component({
  selector: 'app-firewalls',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsFirewallsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly instances = signal<HostingVpsInstance[]>([]);
  private readonly networks = signal<HostingVpsNetwork[]>([]);

  private readonly isMaster = computed(
    () => (this.route.snapshot.data?.['scope'] ?? 'tenant') === 'master',
  );
  private readonly base = computed(() => (this.isMaster() ? 'system/hosting/vps' : 'hosting/vps'));
  private readonly firewallEndpoint = computed(() => `${this.base()}/firewalls`);

  // Attach/apply only to an instance of the same owner: /system acts on platform instances only.
  private readonly instanceOptions = computed<ConfigurableCrudOption[]>(() =>
    attachableInstances(this.instances(), this.isMaster()).map((instance) => ({
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

  private readonly networkOptions = computed<ConfigurableCrudOption[]>(() =>
    this.networks().map((network) => ({
      value: network.HvnUUID,
      label: network.HvnName,
      description: `${network.HvnCidr} · ${network.ProviderName ?? network.ProviderCode ?? ''}`,
      searchText: `${network.HvnName} ${network.HvnCidr}`,
    })),
  );

  constructor() {
    super({
      ...config,
      // Platform profiles are templates for tenants: applied from the instance form, edited by master.
      // The server decides (owner only; delete only when no instance uses the profile).
      canEditRow: (row) =>
        serverRowRight(row, 'CanEdit', () => this.isMaster() || !!row['UserUsrUUID']),
      canDeleteRow: (row) =>
        serverRowRight(row, 'CanDelete', () => this.isMaster() || !!row['UserUsrUUID']),
      fields: [
        { key: 'status', source: 'HvfIsActive', label: 'Status', type: 'status', span: 1 },
        {
          key: 'name',
          source: 'HvfName',
          payloadKey: 'name',
          label: 'Name',
          placeholder: 'WEB',
          required: true,
          span: 1,
          help: 'Name of the profile, shown when attaching it to a VPS.',
        },
        {
          key: 'outboundPolicy',
          source: 'HvfOutboundPolicy',
          payloadKey: 'outboundPolicy',
          label: 'Outbound traffic',
          type: 'select',
          options: OUTBOUND_OPTIONS,
          required: true,
          help: 'Allow all outbound: the VPS may open any outbound connection. Allow only listed outbound: only the outbound rules of this profile are allowed. Lightsail cannot restrict outbound traffic.',
        },
        // business-description: description of the firewall kept with the cloud resource.
        {
          key: 'description',
          source: 'HvfDescription',
          payloadKey: 'description',
          label: 'Description',
          type: 'textarea',
          span: 4,
          help: 'Free text to remember what this profile is for.',
        },
      ],
      relatedCollections: [
        {
          key: 'rules',
          label: 'Rules',
          emptyLabel: 'No rules: every inbound connection is dropped',
          addLabel: 'Add rule',
          createTitle: 'New firewall rule',
          savedMessage: 'Firewall rule added.',
          deletedMessage: 'Firewall rule removed.',
          endpoint: (uuid) => `${this.firewallEndpoint()}/${uuid}/rules`,
          deleteEndpoint: (uuid, row) =>
            `${this.firewallEndpoint()}/${uuid}/rules/${row['HfrUUID']}`,
          uuidField: 'HfrUUID',
          initialValues: {
            direction: 'in',
            action: 'allow',
            protocol: 'tcp',
            portFrom: '',
            portTo: '',
            remoteCidrs: '',
            remoteNetworks: [],
            comment: '',
          },
          fields: [
            {
              key: 'direction',
              label: 'Direction',
              type: 'select',
              options: DIRECTION_OPTIONS,
              required: true,
              span: 1,
              help: 'Inbound: traffic that reaches the VPS. Outbound: traffic the VPS sends. With a profile attached, every inbound connection not allowed by a rule is blocked, ping (ICMP) included.',
            },
            {
              key: 'action',
              label: 'Action',
              type: 'select',
              options: ACTION_OPTIONS,
              required: true,
              span: 1,
              help: 'Allow opens the traffic of the rule. Deny blocks it even when another rule allows it. Inbound traffic without an Allow rule is already blocked, so a profile with only Deny rules blocks all inbound traffic, ping included: add Allow rules for what must stay open.',
            },
            {
              key: 'protocol',
              label: 'Protocol',
              type: 'select',
              options: PROTOCOL_OPTIONS,
              translateOptions: false,
              required: true,
              span: 1,
              help: 'TCP and UDP use the ports below. ICMP is ping. All protocols ignores the ports.',
            },
            {
              key: 'portFrom',
              label: 'Port from',
              type: 'number',
              span: 1,
              help: 'First port of the range (TCP/UDP). Empty = every port.',
            },
            {
              key: 'portTo',
              label: 'Port to',
              type: 'number',
              span: 1,
              help: 'Last port of the range. Empty = only the port in Port from.',
            },
            {
              key: 'remoteCidrs',
              label: 'Addresses (CIDR)',
              placeholder: '203.0.113.0/24, 2001:db8::/32',
              help: 'Separate with commas. Empty with no networks = any address.',
            },
            {
              key: 'remoteNetworks',
              label: 'Private networks',
              type: 'search-select',
              multiple: true,
              quickCreate: false,
              quickCreateExemptReason:
                'Rule sources reference existing networks; networks have their own page.',
              help: 'Private networks of this account used as source (inbound) or destination (outbound) of the rule.',
            },
            { key: 'comment', label: 'Comment', span: 1, help: 'Note shown in the rule list.' },
          ],
          columns: [
            { id: 'direction', label: 'Direction', field: 'HfrDirection' },
            { id: 'action', label: 'Action', field: 'HfrAction' },
            { id: 'protocol', label: 'Protocol', field: 'HfrProtocol' },
            { id: 'portFrom', label: 'Port from', field: 'HfrPortFrom', kind: 'number' },
            { id: 'portTo', label: 'Port to', field: 'HfrPortTo', kind: 'number' },
            { id: 'addresses', label: 'Addresses (CIDR)', field: 'HfrRemoteCidrs' },
            { id: 'comment', label: 'Comment', field: 'HfrComment' },
          ],
          payload: (values) => ({
            direction: values['direction'],
            action: values['action'],
            protocol: values['protocol'],
            portFrom: numberOrNull(values['portFrom']),
            portTo: numberOrNull(values['portTo']),
            remoteCidrs: String(values['remoteCidrs'] ?? '')
              .split(/[\s,;]+/)
              .map((cidr) => cidr.trim())
              .filter(Boolean),
            remoteNetworks: Array.isArray(values['remoteNetworks']) ? values['remoteNetworks'] : [],
            comment: String(values['comment'] ?? '').trim() || null,
          }),
        },
        {
          key: 'instances',
          label: 'Instances',
          emptyLabel: 'Profile not applied to any instance',
          addLabel: 'Apply',
          createTitle: 'Apply firewall profile',
          savedMessage: 'Firewall apply requested.',
          deletedMessage: 'Firewall removal requested.',
          endpoint: (uuid) => `${this.firewallEndpoint()}/${uuid}/instances`,
          deleteEndpoint: (uuid, row) =>
            `${this.firewallEndpoint()}/${uuid}/instances/${row['HifUUID']}`,
          uuidField: 'HifUUID',
          initialValues: { instanceUUID: '' },
          fields: [
            {
              key: 'instanceUUID',
              label: 'Instance',
              type: 'search-select',
              required: true,
              quickCreate: false,
              quickCreateExemptReason:
                'Profiles apply to existing instances; instance creation has its own flow.',
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
            { id: 'provider', label: 'Provider', field: 'ProviderCode' },
            {
              id: 'appliedRevision',
              label: 'Applied revision',
              field: 'HifAppliedRevision',
              kind: 'number',
            },
            { id: 'attachment', label: 'Situation', field: 'HifStatus' },
            { id: 'lastError', label: 'Last error', field: 'HifLastError' },
          ],
        },
      ],
    });
    void this.fetchCatalog();
  }

  protected override listEndpoint(): string {
    return this.firewallEndpoint();
  }

  protected override createEndpoint(): string {
    return this.firewallEndpoint();
  }

  protected override updateEndpoint(): string {
    return this.firewallEndpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.firewallEndpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.firewallEndpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'instanceUUID') return this.instanceOptions();
    if (key === 'remoteNetworks') return this.networkOptions();
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
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
    return data?.items ?? [];
  }

  override refreshList() {
    void this.fetchCatalog();
    super.refreshList();
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      description: payload['description'] ?? '',
      outboundPolicy: payload['outboundPolicy'] || 'accept',
      isActive: Number(payload['status'] ?? 1) === 1,
    };
  }

  /** Child rows show translated enum labels and readable address lists. */
  override relatedCollectionColumnValue(
    row: ConfigurableCrudRecord,
    column: ConfigurableCrudRelatedCollectionColumn,
  ): string {
    const value = row[column.field ?? column.id];
    const enumOptions: Record<string, readonly ConfigurableCrudOption[]> = {
      direction: DIRECTION_OPTIONS,
      action: ACTION_OPTIONS,
      attachment: ATTACHMENT_STATUS_OPTIONS,
    };
    const options = enumOptions[column.id];
    if (options) {
      const option = options.find((candidate) => candidate.value === value);
      return option ? this.t(option.label) : super.relatedCollectionColumnValue(row, column);
    }
    if (column.id === 'protocol') {
      if (value === 'all') return this.t('All protocols');
      return PROTOCOL_OPTIONS.find((candidate) => candidate.value === value)?.label ?? '-';
    }
    if (Array.isArray(value)) return value.length ? value.join(', ') : this.t('Any address');
    return super.relatedCollectionColumnValue(row, column);
  }

  private async fetchCatalog() {
    const base = this.base();
    const [instances, networks] = await Promise.all([
      this.api.get<{ data?: { items?: HostingVpsInstance[] } }>(`${base}/instances?limit=1000`),
      this.api.get<{ data?: { items?: HostingVpsNetwork[] } }>(
        `${base}/networks?status=available&limit=1000`,
      ),
    ]).catch((error) => {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS catalog.'));
      return [null, null] as const;
    });
    if (instances) this.instances.set(instances.data?.items ?? []);
    if (networks) this.networks.set(networks.data?.items ?? []);
  }
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
