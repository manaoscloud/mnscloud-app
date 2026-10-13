import { authenticationPayload, AUTHENTICATION_BOOLEAN_OPTIONS } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'system/authentication/clusters',
  uuidField: 'AtcUUID',
  pageTitle: 'authentication.clusters',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AtcRevision']) }),
  initialValues: { name: '', notes: '', status: 1, revision: 1, region: '', published: 1 },
  payload: (values, editing) => authenticationPayload(values, editing),
  rowActions: [
    {
      key: 'provisioning',
      label: 'authentication.provisioning',
      icon: 'settings',
      form: (row) =>
        defineCrud({
          endpoint: `system/authentication/clusters/${row['AtcUUID']}/provisioning`,
          uuidField: 'AcpUUID',
          pageTitle: 'authentication.provisioning',
          createTitle: 'authentication.provisioning',
          dialogDescription: 'authentication.provisioningHelp',
          canEdit: false,
          canDelete: false,
          bulkDelete: false,
          columns: [],
          initialValues: {
            MonitoringAgentMagUUID: row['MonitoringAgentMagUUID'] ?? '',
            databaseHost: row['AcpDatabaseHost'] ?? '',
            databasePort: row['AcpDatabasePort'] ?? 3306,
            databaseName: row['AcpDatabaseName'] ?? '',
            networkCidr: row['AcpNetworkCidr'] ?? '',
            revision: row['AcpRevision'] ?? 0,
          },
          payload: (values) => ({
            ...values,
            databasePort: Number(values['databasePort']),
            revision: Number(values['revision']),
          }),
          fields: [
            {
              key: 'MonitoringAgentMagUUID',
              label: 'authentication.databaseAgent',
              type: 'search-select',
              span: 1,
              required: true,
              remoteLookup: {
                endpoint: 'system/authentication/database-agents',
                uuidField: 'uuid',
                labelField: 'name',
              },
              quickCreate: false,
              quickCreateExemptReason:
                'Agents must be installed and enrolled through the dedicated Agent installation ceremony.',
            },
            { key: 'databaseHost', label: 'authentication.databaseHost', span: 1, required: true },
            {
              key: 'databasePort',
              label: 'authentication.databasePort',
              type: 'number',
              span: 1,
              required: true,
            },
            { key: 'databaseName', label: 'authentication.databaseName', span: 1, required: true },
            {
              key: 'networkCidr',
              label: 'authentication.networkCidr',
              span: 1,
              required: true,
              help: 'authentication.networkCidrHelp',
            },
            { key: 'revision', label: 'Revision', type: 'number', hidden: true },
          ],
        }),
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'AtcStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      help: 'authentication.clusterStatusHelp',
    },
    { key: 'name', source: 'AtcName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'AtcRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'region',
      source: 'AtcRegion',
      label: 'authentication.region',
      help: 'authentication.clusterRegionHelp',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'published',
      source: 'AtcPublished',
      label: 'authentication.published',
      help: 'authentication.clusterPublishedHelp',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: AUTHENTICATION_BOOLEAN_OPTIONS,
    },
    {
      key: 'notes',
      source: 'AtcNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'AtcName', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'AtcStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-clusters',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationClusterPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
