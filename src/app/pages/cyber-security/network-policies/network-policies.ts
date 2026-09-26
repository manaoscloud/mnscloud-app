import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';

const actions = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
  { value: 'custom_rate_limit', label: 'Custom rate limit' },
  { value: 'bypass_rate_limit', label: 'Bypass rate limit' },
];
const scopes = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'environment', label: 'Environment' },
  { value: 'node', label: 'Node' },
  { value: 'global', label: 'Global' },
];
const modes = [
  { value: 'monitor', label: 'Monitor' },
  { value: 'enforce', label: 'Enforce' },
];
const nodeTypes = [
  'any',
  'freeswitch',
  'asterisk',
  'kamailio',
  'opensips',
  'nginx',
  'worker',
  'agent',
].map((value) => ({ value, label: value }));

const config = defineCrud({
  endpoint: 'cyber-security/network-policies',
  uuidField: 'uuid',
  pageTitle: 'Network Policies',
  pageDescription: 'Endpoint groups, node scopes, rate limits and enforcement mode.',
  dialogDescription: 'Define endpoint policy scope, target node and request limits.',
  bulkDelete: true,
  serverSidePagination: true,
  tabLabels: { network: 'Rules' },
  initialValues: {
    enabled: 1,
    name: '',
    endpointGroup: 'freeswitch_xml_curl',
    action: 'custom_rate_limit',
    scope: 'tenant',
    mode: 'monitor',
    priority: 100,
    nodeType: 'freeswitch',
    trustedNodeUUID: '',
    rateLimitPerMinute: 300,
    burst: 120,
    reason: '',
    networks: '[]',
    methods: '["GET","POST"]',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'name', uuidField: 'uuid', kind: 'identity' },
    { id: 'endpointGroup', label: 'Endpoint group', field: 'endpointGroup', translateValue: false },
    { id: 'action', label: 'Action', field: 'action', options: actions },
    { id: 'mode', label: 'Mode', field: 'mode', options: modes },
    { id: 'node', label: 'Trusted node', field: 'trustedNodeName' },
    { id: 'rateLimit', label: 'Rate limit', field: 'rateLimitPerMinute', kind: 'number' },
    { id: 'status', label: 'Status', field: 'enabled', kind: 'status' },
  ],
  fields: [
    { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'endpointGroup',
      source: 'endpointGroup',
      label: 'Endpoint group',
      required: true,
      span: 1,
    },
    {
      key: 'action',
      source: 'action',
      label: 'Action',
      type: 'select',
      options: actions,
      required: true,
      span: 1,
    },
    {
      key: 'scope',
      source: 'scope',
      label: 'Scope',
      type: 'select',
      options: scopes,
      required: true,
      span: 1,
    },
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
      key: 'nodeType',
      source: 'nodeType',
      label: 'Node type',
      type: 'select',
      options: nodeTypes,
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'priority',
      source: 'priority',
      label: 'Priority',
      type: 'number',
      required: true,
      span: 1,
    },
    {
      key: 'trustedNodeUUID',
      source: 'trustedNodeUUID',
      label: 'Trusted node',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'cyber-security/trusted-nodes',
        uuidField: 'uuid',
        labelField: 'name',
        selectedLabelField: 'trustedNodeName',
      },
      quickCreate: quickCreateFor('CyberSecurityTrustedNodeCtnUUID'),
      span: 1,
    },
    {
      key: 'rateLimitPerMinute',
      source: 'rateLimitPerMinute',
      label: 'Rate limit per minute',
      type: 'number',
      span: 1,
    },
    { key: 'burst', source: 'burst', label: 'Burst', type: 'number', span: 1 },
    { key: 'reason', source: 'reason', label: 'Reason', span: 1 },
    {
      key: 'networks',
      source: 'networks',
      label: 'Networks',
      type: 'textarea',
      format: 'json',
      rows: 4,
      required: true,
      tab: 'network',
      span: 4,
    },
    {
      key: 'methods',
      source: 'methods',
      label: 'Methods',
      type: 'textarea',
      format: 'json',
      rows: 3,
      required: true,
      tab: 'network',
      span: 4,
    },
  ],
});

@Component({
  selector: 'app-cyber-security-network-policies',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityNetworkPoliciesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const optionalNumber = (key: string) =>
      payload[key] === '' || payload[key] === null || payload[key] === undefined
        ? null
        : Number(payload[key]);
    return {
      ...payload,
      enabled: Number(payload['enabled']),
      priority: Number(payload['priority']),
      trustedNodeUUID: payload['trustedNodeUUID'] || null,
      rateLimitPerMinute: optionalNumber('rateLimitPerMinute'),
      burst: optionalNumber('burst'),
      reason: payload['reason'] || null,
    };
  }
}
