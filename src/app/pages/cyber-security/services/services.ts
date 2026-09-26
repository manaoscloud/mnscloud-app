import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'cyber-security/services',
  uuidField: 'uuid',
  pageTitle: 'Protected Services',
  pageDescription: 'Service definitions, ports, logs and CrowdSec collections.',
  dialogDescription: 'Define service metadata used by profiles, agents and security automation.',
  bulkDelete: true,
  serverSidePagination: true,
  tabLabels: { network: 'Configuration' },
  initialValues: {
    enabled: 1,
    name: '',
    slug: '',
    description: '',
    defaultPorts: '[]',
    logPaths: '[]',
    crowdsecCollections: '[]',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'name', uuidField: 'uuid', kind: 'identity' },
    { id: 'slug', label: 'Slug', field: 'slug', translateValue: false },
    { id: 'status', label: 'Status', field: 'enabled', kind: 'status' },
  ],
  fields: [
    { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
    { key: 'slug', source: 'slug', label: 'Slug', required: true, span: 1 },
    {
      key: 'description',
      source: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 3,
      span: 4,
    },
    {
      key: 'defaultPorts',
      source: 'defaultPorts',
      label: 'Default ports',
      type: 'textarea',
      format: 'json',
      rows: 4,
      required: true,
      tab: 'network',
      span: 4,
    },
    {
      key: 'logPaths',
      source: 'logPaths',
      label: 'Log paths',
      type: 'textarea',
      format: 'json',
      rows: 4,
      required: true,
      tab: 'network',
      span: 4,
    },
    {
      key: 'crowdsecCollections',
      source: 'crowdsecCollections',
      label: 'CrowdSec collections',
      type: 'textarea',
      format: 'json',
      rows: 4,
      required: true,
      tab: 'network',
      span: 4,
    },
  ],
});

@Component({
  selector: 'app-cyber-security-services',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityServicesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, enabled: Number(payload['enabled']) };
  }
}
