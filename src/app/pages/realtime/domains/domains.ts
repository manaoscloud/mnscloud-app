import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

const PURPOSE_OPTIONS = [
  { value: 'turn', label: 'TURN/STUN' },
  { value: 'webrtc', label: 'WebRTC' },
  { value: 'media', label: 'Media/RTP' },
  { value: 'sfu', label: 'SFU' },
  { value: 'signaling', label: 'Signaling' },
  { value: 'chat', label: 'Chat' },
  { value: 'mixed', label: 'Mixed' },
] as const;

const DNS_MODE_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'external', label: 'External' },
  { value: 'managed', label: 'Managed' },
];

/** Managed DNS publication state; `external` is shown when the platform does not publish. */
const DNS_STATE_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'external', label: 'External' },
  { value: 'pending', label: 'Pending' },
  { value: 'queued', label: 'Queued' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Needs review' },
  { value: 'conflict', label: 'Conflict' },
  { value: 'deleted', label: 'Removed' },
];

function dnsState(row: ConfigurableCrudRecord): string {
  const state = String(row['DnsPublicationState'] ?? '');
  if (state) return state;
  return row['RtdDnsMode'] === 'managed' ? 'pending' : 'external';
}

/** Platform-only managed DNS fields: the policy is authorized on the DNS zone (Realtime DNS tab). */
const DNS_FIELDS: ConfigurableCrudField[] = [
  {
    key: 'dnsMode',
    source: 'RtdDnsMode',
    payloadKey: 'dnsMode',
    label: 'DNS mode',
    type: 'select',
    options: DNS_MODE_OPTIONS,
    required: true,
    span: 1,
    help: 'External: you maintain the DNS records. Managed: the platform publishes the A/AAAA records of the node bound to this domain.',
  },
  {
    key: 'dnsPolicyUUID',
    source: 'HostingDnsDomainServicePolicyHdsUUID',
    payloadKey: 'dnsPolicyUUID',
    label: 'DNS policy',
    type: 'search-select',
    remoteLookup: {
      endpoint: 'system/parameters/realtime-dns-policies',
      uuidField: 'policyUUID',
      labelField: 'base',
      selectedLabelField: 'DnsPolicyBase',
    },
    quickCreate: false,
    quickCreateExemptReason:
      'Realtime DNS policies are authorized per DNS zone in Hosting / DNS / Domains (Realtime DNS tab), not as standalone records.',
    hiddenWhen: ({ values }) => values['dnsMode'] !== 'managed',
    requiredWhen: ({ values }) => values['dnsMode'] === 'managed',
    span: 2,
    help: 'Platform DNS zone policy with the Realtime service enabled. The domain must be inside its base.',
  },
];

function realtimeDomainConfig(
  endpoint: string,
  titlePrefix = 'Realtime',
  platform = true,
): ConfigurableCrudConfig {
  return {
    endpoint,
    uuidField: 'RtdUUID',
    pageTitle: `${titlePrefix} Domains`,
    pageDescription:
      'Manage public realtime domains used by TURN/STUN, WebRTC, SFU and signaling edges.',
    createTitle: 'New realtime domain',
    editTitle: 'Edit realtime domain',
    dialogDescription: 'Public realtime domain assigned to realtime edge services.',
    searchPlaceholder: 'Search realtime domains',
    emptyLabel: 'No realtime domains found.',
    deleteTitle: 'Delete realtime domain',
    deleteMessage: 'Delete this realtime domain?',
    deleteSelectedTitle: 'Delete selected realtime domains',
    deleteSelectedMessage: 'Delete {count} selected realtime domains?',
    savedMessage: 'Realtime domain saved.',
    deletedMessage: 'Realtime domain deleted.',
    deleteFailedMessage: 'Failed to delete realtime domain.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    initialValues: {
      status: 1,
      name: '',
      purpose: 'webrtc',
      dnsMode: 'external',
      dnsPolicyUUID: '',
      notes: '',
    },
    columns: [
      { id: 'name', label: 'Domain', kind: 'identity', field: 'RtdName', uuidField: 'RtdUUID' },
      { id: 'purpose', label: 'Purpose', field: 'RtdPurpose' },
      { id: 'scope', label: 'Scope', field: 'RtdScope' },
      ...(platform
        ? [
            {
              id: 'dns',
              label: 'DNS',
              kind: 'status' as const,
              field: 'DnsState',
              options: DNS_STATE_OPTIONS,
            },
          ]
        : []),
      {
        id: 'status',
        label: 'Status',
        kind: 'status',
        field: 'RtdStatus',
        className: 'status-col',
      },
      { id: 'updatedAt', label: 'Updated', field: 'RtdDateUpdated', kind: 'datetime' },
    ],
    fields: [
      {
        key: 'status',
        source: 'RtdStatus',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'name',
        source: 'RtdName',
        payloadKey: 'name',
        label: 'Domain',
        required: true,
        span: 1,
      },
      {
        key: 'purpose',
        source: 'RtdPurpose',
        payloadKey: 'purpose',
        label: 'Purpose',
        type: 'select',
        required: true,
        options: PURPOSE_OPTIONS,
        span: 1,
      },
      ...(platform ? DNS_FIELDS : []),
      {
        key: 'notes',
        source: 'RtdNotes',
        payloadKey: 'notes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

abstract class RealtimeDomainsBasePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected readonly tenantOnly: boolean;

  protected constructor(config: ConfigurableCrudConfig, tenantOnly = false) {
    super(config);
    this.tenantOnly = tenantOnly;
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const items: ConfigurableCrudRecord[] = (await super.fetchItems(filters)).map((item) => ({
      ...item,
      DnsState: dnsState(item),
    }));
    if (!this.tenantOnly) return items;
    return items.filter((item) => item['RtdScope'] === 'tenant');
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    if (this.tenantOnly || row['DnsState'] === 'external') return [];
    return [
      { key: 'dns-status', label: 'DNS publication', icon: 'dns' },
      ...(row['DnsState'] === 'failed'
        ? [{ key: 'dns-retry', label: 'Retry DNS publication', icon: 'refresh' }]
        : []),
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'dns-retry') {
      try {
        await this.api.post(
          `${this.config.endpoint}/${this.recordUUID(row)}/dns-publication/retry`,
          {},
        );
        this.refreshList();
      } catch (e) {
        this.snack.error(this.errorMessage(e));
      }
      return;
    }
    if (action.key !== 'dns-status') return;
    let records: { name: string; type: string; ttl: number; data: string[] }[] = [];
    try {
      records = JSON.parse(String(row['DnsPublishedRecords'] ?? '[]'));
    } catch {
      records = [];
    }
    openDataViewerDialog(this.dialog, {
      title: 'DNS publication',
      description:
        'Publication confirms provider readback of the records for the node bound to this domain, not DNS cache expiry.',
      details: [
        { label: 'Domain', value: row['RtdName'] },
        { label: 'DNS policy', value: row['DnsPolicyBase'] },
        {
          label: 'Status',
          value: this.t(
            DNS_STATE_OPTIONS.find((option) => option.value === row['DnsState'])?.label ??
              String(row['DnsState'] ?? ''),
          ),
        },
        { label: 'Error', value: row['DnsPublicationError'] },
      ],
      sections: [
        {
          title: 'DNS records',
          table: {
            columns: [
              { key: 'type', label: 'Type' },
              { key: 'name', label: 'Name' },
              { key: 'value', label: 'Value' },
              { key: 'ttl', label: 'TTL' },
            ],
            rows: records.map((r) => ({ ...r, value: (r.data ?? []).join(', ') })),
          },
        },
      ],
    });
  }
}

@Component({
  selector: 'app-realtime-domains',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeDomainsPage extends RealtimeDomainsBasePage {
  constructor() {
    super(realtimeDomainConfig('system/realtime/domains', 'Realtime'));
  }
}

@Component({
  selector: 'app-realtime-domains-tenant',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeDomainsTenantPage extends RealtimeDomainsBasePage {
  constructor() {
    super(realtimeDomainConfig('realtime/domains', 'My Realtime', false), true);
  }
}
