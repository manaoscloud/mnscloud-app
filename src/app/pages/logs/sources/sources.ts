import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { LOGS_BOOLEAN_OPTIONS, LOGS_TIER_OPTIONS, logsPayload } from '../logs-input';

const config = defineCrud({
  endpoint: 'logs/sources',
  uuidField: 'LsrUUID',
  pageTitle: 'logs.sources',
  pageDescription: 'logs.sourcesDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['LsrRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    LogAccountLgaUUID: '',
    address: '',
    tier: '30d',
    syslogUdp: 1,
    syslogTcp: 1,
  },
  payload: (values, editing) => logsPayload(values, editing),
  fields: [
    { key: 'status', source: 'LsrStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'revision', source: 'LsrRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'LogAccountLgaUUID',
      source: 'LogAccountLgaUUID',
      label: 'logs.account',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: { endpoint: 'logs/accounts', uuidField: 'LgaUUID', labelField: 'LgaName' },
      disabledWhen: ({ editing }) => editing,
      help: 'logs.scopeHelp',
    },
    { key: 'name', source: 'LsrName', label: 'Name', required: true, span: 1 },
    {
      key: 'address',
      source: 'LsrAddress',
      label: 'logs.sourceAddress',
      span: 1,
      required: true,
      type: 'text',
      tab: 'network',
      help: 'logs.sourceAddressHelp',
    },
    {
      key: 'tier',
      source: 'LsrTier',
      label: 'logs.tier',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: LOGS_TIER_OPTIONS,
      tab: 'network',
      help: 'logs.tierHelp',
    },
    {
      key: 'syslogUdp',
      source: 'LsrSyslogUdp',
      label: 'logs.syslogUdp',
      span: 1,
      type: 'select',
      translateOptions: true,
      options: LOGS_BOOLEAN_OPTIONS,
      tab: 'network',
      help: 'logs.transportHelp',
    },
    {
      key: 'syslogTcp',
      source: 'LsrSyslogTcp',
      label: 'logs.syslogTcp',
      span: 1,
      type: 'select',
      translateOptions: true,
      options: LOGS_BOOLEAN_OPTIONS,
      tab: 'network',
      help: 'logs.transportHelp',
    },
    {
      key: 'notes',
      source: 'LsrNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  tabLabels: { network: 'logs.ingestTab' },
  columns: [
    { id: 'name', field: 'LsrName', label: 'Name', kind: 'identity' },
    { id: 'address', field: 'LsrAddress', label: 'logs.sourceAddress', kind: 'text' },
    {
      id: 'tier',
      field: 'LsrTier',
      label: 'logs.tier',
      kind: 'text',
      value: (row, translate) => translate('logs.tiers.' + String(row['LsrTier'] ?? '30d')),
    },
    {
      id: 'account',
      field: 'AccountName',
      label: 'logs.account',
      kind: 'related',
      uuidField: 'LogAccountLgaUUID',
    },
    { id: 'status', field: 'LsrStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-logs-sources',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LogsSourcePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
