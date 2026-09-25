import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

// Pool networks are a full child CRUD (create, edit, delete) opened from each pool row.
function networks(pool: ConfigurableCrudRecord) {
  const poolUUID = String(pool['Ip6UUID']);
  return defineCrud({
    endpoint: `isp/ipv6-pools/${poolUUID}/networks`,
    uuidField: 'I6nUUID',
    pageTitle: 'Networks',
    pageDescription: 'Manage available IPv6 networks for this pool.',
    bulkDelete: false,
    initialValues: { status: 1, cidr: '', description: '' },
    columns: [
      { id: 'cidr', label: 'IP/Mask', field: 'I6nCidr', uuidField: 'I6nUUID', kind: 'identity' },
      { id: 'description', label: 'Description', field: 'I6nDescription' },
      { id: 'status', label: 'Status', field: 'I6nStatus', kind: 'status' },
    ],
    fields: [
      { key: 'status', source: 'I6nStatus', label: 'Status', type: 'status', span: 1 },
      { key: 'cidr', source: 'I6nCidr', label: 'IP/Mask', required: true, span: 1 },
      { key: 'description', source: 'I6nDescription', label: 'Description', span: 4 },
    ],
  });
}

const config = defineCrud({
  endpoint: 'isp/ipv6-pools',
  uuidField: 'Ip6UUID',
  pageTitle: 'Pool IPv6',
  pageDescription: 'Manage IPv6 pools and available networks.',
  bulkDelete: true,
  initialValues: { status: 1, name: '', description: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'Ip6Name', uuidField: 'Ip6UUID', kind: 'identity' },
    { id: 'description', label: 'Description', field: 'Ip6Description' },
    { id: 'status', label: 'Status', field: 'Ip6Status', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'Ip6Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Ip6Name', label: 'Name', required: true, span: 1 },
    { key: 'description', source: 'Ip6Description', label: 'Description', span: 4 },
  ],
  rowActions: [{ key: 'networks', label: 'Networks', icon: 'lan', collection: networks }],
});

@Component({
  selector: 'app-isp-pool-ipv6',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspPoolIpv6Page extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
