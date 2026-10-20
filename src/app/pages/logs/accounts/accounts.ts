import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { logsPayload, logsTenantColumns } from '../logs-input';

const config = defineCrud({
  endpoint: 'logs/accounts',
  uuidField: 'LgaUUID',
  pageTitle: 'logs.accounts',
  pageDescription: 'logs.accountsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision; an account with sources cannot be deleted.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['LgaRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    LogClusterLgcUUID: '',
    dailyCapMb: '',
    warnPercent: 80,
  },
  payload: (values, editing) => logsPayload(values, editing),
  fields: [
    { key: 'status', source: 'LgaStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'LogClusterLgcUUID',
      source: 'LogClusterLgcUUID',
      label: 'logs.cluster',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: { endpoint: 'logs/clusters', uuidField: 'LgcUUID', labelField: 'LgcName' },
      disabledWhen: ({ editing }) => editing,
      help: 'logs.accountClusterHelp',
    },
    { key: 'name', source: 'LgaName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'LgaRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'dailyCapMb',
      source: 'LgaDailyCapMb',
      label: 'logs.dailyCapMb',
      type: 'number',
      span: 1,
      tab: 'limits',
      help: 'logs.dailyCapHelp',
    },
    {
      key: 'warnPercent',
      source: 'LgaWarnPercent',
      label: 'logs.warnPercent',
      type: 'number',
      span: 1,
      required: true,
      tab: 'limits',
      help: 'logs.warnPercentHelp',
    },
    {
      key: 'notes',
      source: 'LgaNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  tabLabels: { limits: 'logs.limitsTab' },
  columns: logsTenantColumns(
    'Lga',
    { id: 'cluster', field: 'ClusterName', label: 'logs.cluster', uuidField: 'LogClusterLgcUUID' },
    [
      { id: 'sources', field: 'SourceCount', label: 'logs.sources', kind: 'text' },
      {
        id: 'usage',
        field: 'UsageTodayMb',
        label: 'logs.usageToday',
        kind: 'text',
        value: (row) =>
          row['LgaDailyCapMb'] == null
            ? `${row['UsageTodayMb'] ?? 0} MB`
            : `${row['UsageTodayMb'] ?? 0} / ${row['LgaDailyCapMb']} MB`,
      },
      {
        id: 'capState',
        field: 'CapState',
        label: 'logs.capState',
        kind: 'text',
        value: (row, translate) => translate('logs.capStates.' + String(row['CapState'] ?? 'ok')),
      },
    ],
  ),
});

@Component({
  selector: 'app-logs-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LogsAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
