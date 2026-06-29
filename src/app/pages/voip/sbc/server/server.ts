import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const ENGINE_OPTIONS = [
  { value: 'opensips', label: 'OpenSIPS' },
  { value: 'kamailio', label: 'Kamailio' },
];

const SERVER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/voip/sbc/servers',
  uuidField: 'VbsUUID',
  pageTitle: 'SBC servers',
  pageDescription: 'Manage authorized OpenSIPS and Kamailio SBC servers.',
  createTitle: 'New SBC server',
  editTitle: 'Edit SBC server',
  dialogDescription: 'Maintain runtime identity and connection metadata for the SBC server.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC servers found.',
  deleteTitle: 'Delete SBC server',
  deleteMessage: 'Are you sure you want to delete this SBC server?',
  deleteSelectedTitle: 'Delete selected SBC servers',
  deleteSelectedMessage: 'Delete {count} selected SBC servers?',
  savedMessage: 'SBC server saved successfully.',
  deletedMessage: 'SBC server deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC server.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    engine: 'opensips',
    name: '',
    nodeUUID: '',
    hostname: '',
    publicIP: '',
    privateIP: '',
    baseUrl: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VbsName', uuidField: 'VbsUUID' },
    { id: 'engine', label: 'Engine', field: 'VbsEngine' },
    { id: 'hostname', label: 'Hostname', field: 'VbsHostname' },
    { id: 'publicIP', label: 'Public IP', field: 'VbsPublicIP' },
    { id: 'privateIP', label: 'Private IP', field: 'VbsPrivateIP' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VbsStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VbsStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'engine',
      source: 'VbsEngine',
      payloadKey: 'engine',
      label: 'Engine',
      type: 'select',
      options: ENGINE_OPTIONS,
      required: true,
      span: 1,
    },
    { key: 'name', source: 'VbsName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'nodeUUID',
      source: 'VbsNodeUUID',
      payloadKey: 'nodeUUID',
      label: 'Node UUID',
      span: 1,
    },
    { key: 'hostname', source: 'VbsHostname', payloadKey: 'hostname', label: 'Hostname', span: 1 },
    {
      key: 'publicIP',
      source: 'VbsPublicIP',
      payloadKey: 'publicIP',
      label: 'Public IP',
      span: 1,
    },
    {
      key: 'privateIP',
      source: 'VbsPrivateIP',
      payloadKey: 'privateIP',
      label: 'Private IP',
      span: 1,
    },
    { key: 'baseUrl', source: 'VbsBaseUrl', payloadKey: 'baseUrl', label: 'Base URL', span: 1 },
    {
      key: 'notes',
      source: 'VbsNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-server',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcServerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(SERVER_CONFIG);
  }
}
