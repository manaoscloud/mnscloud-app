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

// Resolver lists of a cluster (D2a): client networks and conditional forwarding share one page, the
// route data chooses the list.
const clientNetworks = defineCrud({
  endpoint: 'system/dns/client-networks',
  uuidField: 'DcnUUID',
  pageTitle: 'dns.clientNetworks',
  pageDescription: 'dns.clientNetworksDescription',
  dialogDescription: 'dns.clientNetworksDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DcnRevision']) }),
  initialValues: { name: '', cidr: '', status: 1, revision: 1, DnsClusterDncUUID: '' },
  payload: (values, editing) => {
    const payload = dnsPayload(values, editing);
    if (editing) delete payload['DnsClusterDncUUID'];
    return payload;
  },
  fields: [
    { key: 'status', source: 'DcnStatus', label: 'Status', type: 'status', span: 1 },
    runtimeServerClusterField('DnsClusterDncUUID', 'system/dns/clusters', 'Dnc', 'dns'),
    { key: 'name', source: 'DcnName', label: 'Name', required: true, span: 1 },
    {
      key: 'cidr',
      source: 'DcnCidr',
      label: 'dns.clientNetworkCidr',
      required: true,
      span: 1,
      help: 'dns.clientNetworkCidrHelp',
    },
    { key: 'revision', source: 'DcnRevision', label: 'Revision', type: 'number', hidden: true },
  ],
  columns: [
    { id: 'name', field: 'DcnName', label: 'Name', kind: 'identity' },
    { id: 'cidr', field: 'DcnCidr', label: 'dns.clientNetworkCidr', kind: 'text' },
    { id: 'cluster', field: 'ClusterName', label: 'dns.cluster', kind: 'text' },
    { id: 'status', field: 'DcnStatus', label: 'Status', kind: 'status' },
  ],
});

const servers = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''));

const forwardZones = defineCrud({
  endpoint: 'system/dns/forward-zones',
  uuidField: 'DfzUUID',
  pageTitle: 'dns.forwardZones',
  pageDescription: 'dns.forwardZonesDescription',
  dialogDescription: 'dns.forwardZonesDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DfzRevision']) }),
  initialValues: {
    zone: '',
    servers: '',
    recurse: 0,
    status: 1,
    revision: 1,
    DnsClusterDncUUID: '',
  },
  payload: (values, editing) => {
    const payload = dnsPayload(values, editing);
    if (editing) delete payload['DnsClusterDncUUID'];
    payload['servers'] = servers(values['servers']);
    payload['recurse'] = Number(values['recurse'] ?? 0);
    return payload;
  },
  fields: [
    { key: 'status', source: 'DfzStatus', label: 'Status', type: 'status', span: 1 },
    runtimeServerClusterField('DnsClusterDncUUID', 'system/dns/clusters', 'Dnc', 'dns'),
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
      span: 2,
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
    { key: 'revision', source: 'DfzRevision', label: 'Revision', type: 'number', hidden: true },
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
    { id: 'cluster', field: 'ClusterName', label: 'dns.cluster', kind: 'text' },
    { id: 'status', field: 'DfzStatus', label: 'Status', kind: 'status' },
  ],
});

const CONFIGS = { 'client-networks': clientNetworks, 'forward-zones': forwardZones };

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
