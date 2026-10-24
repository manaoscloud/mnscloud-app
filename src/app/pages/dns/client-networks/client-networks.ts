import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { runtimeServerClusterField } from '../../../shared/runtime-server/runtime-server-crud';
import { dnsPayload } from '../dns-input';

const config = defineCrud({
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

@Component({
  selector: 'app-dns-client-networks',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsClientNetworksPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
