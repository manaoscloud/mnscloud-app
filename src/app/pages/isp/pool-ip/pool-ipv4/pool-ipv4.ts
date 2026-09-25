import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

// Pool networks are a full child CRUD (create, edit, delete) opened from each pool row.
function networks(pool: ConfigurableCrudRecord) {
  const poolUUID = String(pool['Ip4UUID']);
  return defineCrud({
    endpoint: `isp/ipv4-pools/${poolUUID}/networks`,
    uuidField: 'I4nUUID',
    pageTitle: 'Networks',
    pageDescription: 'Manage available IPv4 networks for this pool.',
    bulkDelete: false,
    initialValues: { status: 1, cidr: '', description: '' },
    columns: [
      { id: 'cidr', label: 'IP/Mask', field: 'I4nCidr', uuidField: 'I4nUUID', kind: 'identity' },
      { id: 'description', label: 'Description', field: 'I4nDescription' },
      { id: 'status', label: 'Status', field: 'I4nStatus', kind: 'status' },
    ],
    fields: [
      { key: 'status', source: 'I4nStatus', label: 'Status', type: 'status', span: 1 },
      { key: 'cidr', source: 'I4nCidr', label: 'IP/Mask', required: true, span: 1 },
      { key: 'description', source: 'I4nDescription', label: 'Description', span: 4 },
    ],
  });
}

const config = defineCrud({
  endpoint: 'isp/ipv4-pools',
  uuidField: 'Ip4UUID',
  pageTitle: 'Pool IPv4',
  pageDescription: 'Manage IPv4 pools and available networks.',
  bulkDelete: true,
  initialValues: { status: 1, name: '', description: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'Ip4Name', uuidField: 'Ip4UUID', kind: 'identity' },
    { id: 'description', label: 'Description', field: 'Ip4Description' },
    { id: 'status', label: 'Status', field: 'Ip4Status', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'Ip4Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Ip4Name', label: 'Name', required: true, span: 1 },
    { key: 'description', source: 'Ip4Description', label: 'Description', span: 4 },
  ],
  rowActions: [{ key: 'networks', label: 'Networks', icon: 'lan', collection: networks }],
});

@Component({
  selector: 'app-isp-pool-ipv4',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspPoolIpv4Page extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
