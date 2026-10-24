import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { runtimeServerClusterField } from '../../../shared/runtime-server/runtime-server-crud';
import { DNS_BOOLEAN_OPTIONS, dnsPayload } from '../dns-input';

const servers = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''));

const config = defineCrud({
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

@Component({
  selector: 'app-dns-forward-zones',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsForwardZonesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
