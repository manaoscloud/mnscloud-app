import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'isp/fixed-ipv6-addresses',
  uuidField: 'If6UUID',
  pageTitle: 'Fixed IPv6',
  pageDescription: 'Manage fixed IPv6 CIDR assignments for your ISP environment.',
  bulkDelete: true,
  initialValues: { status: 1, name: '', description: '', cidr: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'If6Name', uuidField: 'If6UUID', kind: 'identity' },
    { id: 'cidr', label: 'IP/Mask', field: 'If6Cidr', translateValue: false },
    { id: 'status', label: 'Status', field: 'If6Status', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'If6Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'If6Name', label: 'Name', required: true, span: 1 },
    { key: 'cidr', source: 'If6Cidr', label: 'IP/Mask', required: true, span: 1 },
    { key: 'description', source: 'If6Description', label: 'Description', span: 4 },
  ],
});

@Component({
  selector: 'app-isp-fixed-ipv6',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspFixedIpv6Page extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
