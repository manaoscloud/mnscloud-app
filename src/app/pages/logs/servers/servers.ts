import { Component } from '@angular/core';
import { CONFIGURABLE_CRUD_IMPORTS } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  RuntimeServerCrudPage,
  runtimeServerClusterField,
  runtimeServerColumns,
  runtimeServerRowActions,
} from '../../../shared/runtime-server/runtime-server-crud';
import { logsPayload } from '../logs-input';

const config = defineCrud({
  endpoint: 'system/logs/servers',
  uuidField: 'LgsUUID',
  pageTitle: 'logs.servers',
  pageDescription: 'logs.serverSetupDescription',
  dialogDescription: 'logs.serverSetupDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['LgsRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    // A server is activated by its verified installation, never by the form.
    status: 0,
    syslogUdpPort: 514,
    syslogTcpPort: 514,
    ingestAddress6: '',
    revision: 1,
    LogClusterLgcUUID: '',
  },
  payload: (values, editing) => logsPayload(values, editing),
  rowActions: runtimeServerRowActions('Lgs', 'logs'),
  fields: [
    {
      key: 'status',
      source: 'LgsStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      help: 'logs.serverStatusHelp',
      hiddenWhen: ({ editing }) => !editing,
    },
    runtimeServerClusterField('LogClusterLgcUUID', 'system/logs/clusters', 'Lgc', 'logs'),
    { key: 'name', source: 'LgsName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'LgsRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'syslogUdpPort',
      source: 'LgsSyslogUdpPort',
      label: 'logs.syslogUdpPort',
      type: 'number',
      span: 1,
      required: true,
      tab: 'network',
      help: 'logs.syslogPortHelp',
    },
    {
      key: 'syslogTcpPort',
      source: 'LgsSyslogTcpPort',
      label: 'logs.syslogTcpPort',
      type: 'number',
      span: 1,
      required: true,
      tab: 'network',
      help: 'logs.syslogPortHelp',
    },
    {
      // An installed server only: the address must be one the host Agent reports.
      hiddenWhen: ({ editing }) => !editing,
      key: 'ingestAddress6',
      source: 'LgsIngestAddress6',
      label: 'logs.ingestAddress6',
      type: 'text',
      tab: 'network',
      help: 'logs.ingestAddress6Help',
    },
    {
      hiddenWhen: ({ editing }) => !editing,
      key: 'notes',
      source: 'LgsNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  tabLabels: { network: 'logs.ingestTab' },
  columns: [
    { id: 'name', field: 'LgsName', label: 'Name', kind: 'identity' },
    ...runtimeServerColumns('Lgs', 'logs', 'LogClusterLgcUUID', (o) => [
      o['listenAddress'],
      o['operatingSystem'],
      o['architecture'],
      o['version'],
      o['storageVersion'],
    ]),
  ],
});

@Component({
  selector: 'app-logs-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LogsServerPage extends RuntimeServerCrudPage {
  protected readonly installation = {
    endpoint: config.endpoint,
    prefix: 'Lgs',
    i18n: 'logs',
    module: 'Logs',
    runtime: 'logs',
  };
  constructor() {
    super(config);
  }
}
