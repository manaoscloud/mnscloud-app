import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'isp/fixed-ipv4-addresses',
  uuidField: 'If4UUID',
  pageTitle: 'Fixed IPv4',
  pageDescription: 'Manage fixed IPv4 CIDR assignments for your ISP environment.',
  bulkDelete: true,
  initialValues: { status: 1, name: '', description: '', cidr: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'If4Name', uuidField: 'If4UUID', kind: 'identity' },
    { id: 'cidr', label: 'IP/Mask', field: 'If4Cidr', translateValue: false },
    { id: 'status', label: 'Status', field: 'If4Status', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'If4Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'If4Name', label: 'Name', required: true, span: 1 },
    { key: 'cidr', source: 'If4Cidr', label: 'IP/Mask', required: true, span: 1 },
    { key: 'description', source: 'If4Description', label: 'Description', span: 4 },
  ],
});

@Component({
  selector: 'app-isp-fixed-ipv4',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspFixedIpv4Page extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
