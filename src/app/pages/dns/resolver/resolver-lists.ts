import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { runtimeServerClusterField } from '../../../shared/runtime-server/runtime-server-crud';
import { DNS_BOOLEAN_OPTIONS, dnsPayload } from '../dns-input';

type CrudConfig = Parameters<typeof defineCrud>[0];

/** One list of cluster-scoped DNS resources: paginated, revision-checked deletion, no bulk delete. */
function clusterList(
  path: string,
  prefix: string,
  title: string,
  description: string,
  config: Omit<
    CrudConfig,
    'endpoint' | 'uuidField' | 'pageTitle' | 'pageDescription' | 'payload'
  > & {
    /** Resource-specific payload changes after the common ones (numbers, revision, immutable cluster). */
    adjust?: (
      payload: ConfigurableCrudRecord,
      values: ConfigurableCrudRecord,
      editing: boolean,
    ) => void;
  },
) {
  const { adjust, fields, columns, initialValues, ...rest } = config;
  return defineCrud({
    endpoint: `system/dns/${path}`,
    uuidField: `${prefix}UUID`,
    pageTitle: title,
    pageDescription: description,
    dialogDescription: description,
    serverSidePagination: true,
    initialPageSize: 50,
    bulkDelete: false,
    deletePayload: (row) => ({ revision: Number(row[`${prefix}Revision`]) }),
    initialValues: { ...initialValues, status: 1, revision: 1, DnsClusterDncUUID: '' },
    payload: (values, editing) => {
      const payload = dnsPayload(values, editing);
      if (editing) delete payload['DnsClusterDncUUID'];
      adjust?.(payload, values, editing);
      return payload;
    },
    fields: [
      { key: 'status', source: `${prefix}Status`, label: 'Status', type: 'status', span: 1 },
      runtimeServerClusterField('DnsClusterDncUUID', 'system/dns/clusters', 'Dnc', 'dns'),
      ...fields,
      {
        key: 'revision',
        source: `${prefix}Revision`,
        label: 'Revision',
        type: 'number',
        hidden: true,
      },
    ],
    columns: [
      ...columns,
      { id: 'cluster', field: 'ClusterName', label: 'dns.cluster', kind: 'text' },
      { id: 'status', field: `${prefix}Status`, label: 'Status', kind: 'status' },
    ],
    ...rest,
  });
}

// Resolver lists of a cluster (D2a) and filter rules (D5a) share one page; the route data chooses
// the list.
const clientNetworks = clusterList(
  'client-networks',
  'Dcn',
  'dns.clientNetworks',
  'dns.clientNetworksDescription',
  {
    initialValues: { name: '', cidr: '' },
    fields: [
      { key: 'name', source: 'DcnName', label: 'Name', required: true, span: 1 },
      {
        key: 'cidr',
        source: 'DcnCidr',
        label: 'dns.clientNetworkCidr',
        required: true,
        span: 1,
        help: 'dns.clientNetworkCidrHelp',
      },
    ],
    columns: [
      { id: 'name', field: 'DcnName', label: 'Name', kind: 'identity' },
      { id: 'cidr', field: 'DcnCidr', label: 'dns.clientNetworkCidr', kind: 'text' },
    ],
  },
);

const servers = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''));

const forwardZones = clusterList(
  'forward-zones',
  'Dfz',
  'dns.forwardZones',
  'dns.forwardZonesDescription',
  {
    initialValues: {
      zone: '',
      servers: '',
      recurse: 0,
    },
    adjust: (payload, values) => {
      payload['servers'] = servers(values['servers']);
      payload['recurse'] = Number(values['recurse'] ?? 0);
    },
    fields: [
      {
        key: 'zone',
        source: 'DfzZone',
        label: 'dns.forwardZone',
        required: true,
        span: 1,
        help: 'dns.forwardZoneHelp',
      },
      {
        key: 'servers',
        source: 'DfzServersJson',
        label: 'dns.forwardServers',
        required: true,
        help: 'dns.forwardServersHelp',
      },
      {
        key: 'recurse',
        source: 'DfzRecurse',
        label: 'dns.forwardRecurse',
        type: 'select',
        required: true,
        span: 1,
        translateOptions: true,
        options: DNS_BOOLEAN_OPTIONS,
        help: 'dns.forwardRecurseHelp',
      },
    ],
    columns: [
      { id: 'zone', field: 'DfzZone', label: 'dns.forwardZone', kind: 'identity' },
      {
        id: 'servers',
        field: 'DfzServersJson',
        label: 'dns.forwardServers',
        kind: 'text',
        value: (row) => servers(row['DfzServersJson']),
      },
    ],
  },
);

const FILTER_ACTIONS = [
  { value: 'block', label: 'dns.filterActionBlock' },
  { value: 'allow', label: 'dns.filterActionAllow' },
] as const;

const filterRules = clusterList(
  'filter-rules',
  'Dfr',
  'dns.filterRules',
  'dns.filterRulesDescription',
  {
    initialValues: {
      domain: '',
      action: 'block',
      note: '',
    },
    adjust: (payload, values) => {
      payload['note'] = String(values['note'] ?? '').trim() || null;
    },
    fields: [
      {
        key: 'domain',
        source: 'DfrDomain',
        label: 'dns.filterDomain',
        required: true,
        span: 1,
        help: 'dns.filterDomainHelp',
      },
      {
        key: 'action',
        source: 'DfrAction',
        label: 'dns.filterAction',
        type: 'select',
        required: true,
        span: 1,
        translateOptions: true,
        options: FILTER_ACTIONS,
      },
      { key: 'note', source: 'DfrNote', label: 'dns.filterNote', span: 1 },
    ],
    columns: [
      { id: 'domain', field: 'DfrDomain', label: 'dns.filterDomain', kind: 'identity' },
      {
        id: 'action',
        field: 'DfrAction',
        label: 'dns.filterAction',
        kind: 'text',
        value: (row) =>
          row['DfrAction'] === 'allow' ? 'dns.filterActionAllow' : 'dns.filterActionBlock',
        translateValue: true,
      },
    ],
  },
);

// Zone transfers (D7c): the TSIG key is generated by the platform and shown to hand it to the
// secondary's operator; "Rotate key" on edit replaces the secret (the key name stays).
const secondaries = clusterList(
  'secondaries',
  'Dsd',
  'dns.secondaries',
  'dns.secondariesDescription',
  {
    initialValues: {
      name: '',
      address: '',
      rotateKey: 0,
    },
    adjust: (payload, values, editing) => {
      if (editing) payload['rotateKey'] = Number(values['rotateKey'] ?? 0);
      else delete payload['rotateKey'];
    },
    fields: [
      { key: 'name', source: 'DsdName', label: 'Name', required: true, span: 1 },
      {
        key: 'address',
        source: 'DsdAddress',
        label: 'dns.secondaryAddress',
        required: true,
        span: 1,
        help: 'dns.secondaryAddressHelp',
      },
      {
        key: 'rotateKey',
        label: 'dns.secondaryRotateKey',
        type: 'select',
        translateOptions: true,
        options: DNS_BOOLEAN_OPTIONS,
        help: 'dns.secondaryRotateKeyHelp',
        hiddenWhen: ({ editing }) => !editing,
      },
    ],
    columns: [
      { id: 'name', field: 'DsdName', label: 'Name', kind: 'identity' },
      { id: 'address', field: 'DsdAddress', label: 'dns.secondaryAddress', kind: 'text' },
      {
        id: 'keyName',
        field: 'DsdKeyName',
        label: 'dns.secondaryKeyName',
        kind: 'text',
        copyable: true,
      },
      {
        id: 'secret',
        field: 'DsdSecret',
        label: 'dns.secondarySecret',
        kind: 'secret',
        copyable: true,
      },
    ],
  },
);

const CONFIGS = {
  'client-networks': clientNetworks,
  'forward-zones': forwardZones,
  'filter-rules': filterRules,
  secondaries,
};

@Component({
  selector: 'app-dns-resolver-lists',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsResolverListsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const list = inject(ActivatedRoute).snapshot.data['list'] as keyof typeof CONFIGS;
    super(CONFIGS[list] ?? clientNetworks);
  }
}
