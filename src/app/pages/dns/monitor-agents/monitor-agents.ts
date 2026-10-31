import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { dnsMonitorAgentPayload } from '../dns-input';

const config = defineCrud({
  endpoint: 'system/dns/monitor/agents',
  uuidField: 'DmaUUID',
  pageTitle: 'dns.monitorAgents',
  pageDescription: 'dns.monitorAgentsDescription',
  dialogDescription: 'dns.monitorAgentsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DmaRevision']) }),
  initialValues: { MonitoringAgentMagUUID: '', status: 1, revision: 1 },
  payload: (values, editing) => dnsMonitorAgentPayload(values, editing),
  fields: [
    { key: 'status', source: 'DmaStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'MonitoringAgentMagUUID',
      source: 'MonitoringAgentMagUUID',
      label: 'Agent',
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'system/dns/monitor/candidates',
        uuidField: 'MagUUID',
        labelField: 'MagName',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Agents are enrolled on their hosts, never created from a form.',
      disabledWhen: ({ editing }) => editing,
      help: 'dns.monitorAgentHelp',
    },
    { key: 'revision', source: 'DmaRevision', label: 'Revision', type: 'number', hidden: true },
  ],
  columns: [
    {
      id: 'agent',
      field: 'AgentName',
      label: 'Agent',
      kind: 'identity',
      detail: (row) => String(row['AgentHostname'] ?? ''),
    },
    { id: 'lastSeen', field: 'AgentLastSeenAt', label: 'Last seen', kind: 'datetime' },
    {
      id: 'lastCycle',
      field: 'DmaLastCompletedAt',
      label: 'dns.monitorLastCycle',
      kind: 'datetime',
    },
    { id: 'status', field: 'DmaStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-dns-monitor-agents',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsMonitorAgentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
