import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const nodeTypes = [
  'freeswitch',
  'asterisk',
  'kamailio',
  'opensips',
  'nginx',
  'worker',
  'agent',
  'api',
  'other',
].map((value) => ({ value, label: value }));
const statuses = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
];
const authModes = [
  { value: 'hmac', label: 'HMAC' },
  { value: 'api_key', label: 'API key' },
  { value: 'mtls', label: 'mTLS' },
  { value: 'none', label: 'None' },
];
const modes = [
  { value: 'monitor', label: 'Monitor' },
  { value: 'enforce', label: 'Enforce' },
];

const config = defineCrud({
  endpoint: 'cyber-security/trusted-nodes',
  uuidField: 'uuid',
  pageTitle: 'Trusted Nodes',
  pageDescription: 'Authenticated infrastructure nodes and agent-backed integrations.',
  bulkDelete: true,
  serverSidePagination: true,
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'suspended',
  statusOptions: statuses,
  tabLabels: { network: 'Access' },
  initialValues: {
    status: 'active',
    name: '',
    nodeUUID: '',
    nodeType: 'freeswitch',
    hostname: '',
    authMode: 'hmac',
    secret: '',
    mode: 'monitor',
    notes: '',
    allowedNetworks: '[]',
    endpointGroups: '[]',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'name', uuidField: 'uuid', kind: 'identity' },
    { id: 'nodeType', label: 'Node type', field: 'nodeType', translateValue: false },
    { id: 'networks', label: 'Allowed networks', field: 'allowedNetworks', translateValue: false },
    { id: 'groups', label: 'Endpoint groups', field: 'endpointGroups', translateValue: false },
    { id: 'lastSeen', label: 'Last seen', field: 'lastSeenAt', kind: 'datetime' },
    { id: 'status', label: 'Status', field: 'status', kind: 'status' },
  ],
  fields: [
    {
      key: 'status',
      source: 'status',
      label: 'Status',
      type: 'status',
      options: statuses,
      span: 1,
    },
    { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
    { key: 'nodeUUID', source: 'nodeUUID', label: 'Node UUID', required: true, span: 1 },
    {
      key: 'nodeType',
      source: 'nodeType',
      label: 'Node type',
      type: 'select',
      options: nodeTypes,
      translateOptions: false,
      required: true,
      span: 1,
    },
    { key: 'hostname', source: 'hostname', label: 'Hostname', span: 1 },
    {
      key: 'mode',
      source: 'mode',
      label: 'Mode',
      type: 'select',
      options: modes,
      required: true,
      span: 1,
    },
    {
      key: 'authMode',
      source: 'authMode',
      label: 'Auth mode',
      type: 'select',
      options: authModes,
      required: true,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'secret',
      label: 'New secret',
      type: 'password',
      tab: 'authentication',
      placeholder: 'Leave blank to keep the current secret',
      span: 2,
    },
    {
      key: 'allowedNetworks',
      source: 'allowedNetworks',
      label: 'Allowed networks',
      type: 'textarea',
      format: 'json',
      rows: 4,
      required: true,
      tab: 'network',
      span: 4,
    },
    {
      key: 'endpointGroups',
      source: 'endpointGroups',
      label: 'Endpoint groups',
      type: 'textarea',
      format: 'json',
      rows: 4,
      required: true,
      tab: 'network',
      span: 4,
    },
    {
      key: 'notes',
      source: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      rows: 4,
      span: 4,
    },
  ],
});

@Component({
  selector: 'app-cyber-security-trusted-nodes',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityTrustedNodesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const { secret, ...rest } = payload;
    const value = typeof secret === 'string' ? secret.trim() : '';
    return {
      ...rest,
      ...(value ? { secret: value } : {}),
      hostname: rest['hostname'] || null,
      notes: rest['notes'] || null,
    };
  }
}
