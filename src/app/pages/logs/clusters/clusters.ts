import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { LOGS_BOOLEAN_OPTIONS, logsPayload } from '../logs-input';

const config = defineCrud({
  endpoint: 'system/logs/clusters',
  uuidField: 'LgcUUID',
  pageTitle: 'logs.clusters',
  pageDescription: 'logs.clustersDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency check; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['LgcRevision']) }),
  initialValues: { name: '', notes: '', status: 1, revision: 1, region: '', published: 0 },
  payload: (values, editing) => logsPayload(values, editing),
  fields: [
    {
      key: 'status',
      source: 'LgcStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      help: 'logs.clusterStatusHelp',
    },
    { key: 'name', source: 'LgcName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'LgcRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'region',
      source: 'LgcRegion',
      label: 'logs.region',
      help: 'logs.clusterRegionHelp',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'published',
      source: 'LgcPublished',
      label: 'logs.published',
      help: 'logs.clusterPublishedHelp',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: LOGS_BOOLEAN_OPTIONS,
    },
    {
      key: 'notes',
      source: 'LgcNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'LgcName', label: 'Name', kind: 'identity' },
    { id: 'region', field: 'LgcRegion', label: 'logs.region', kind: 'text' },
    { id: 'servers', field: 'ServerCount', label: 'logs.servers', kind: 'text' },
    { id: 'status', field: 'LgcStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-logs-clusters',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LogsClusterPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
