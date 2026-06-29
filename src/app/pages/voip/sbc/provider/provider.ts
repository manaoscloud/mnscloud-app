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

const PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/providers',
  uuidField: 'VbpUUID',
  pageTitle: 'SBC providers',
  pageDescription: 'Manage SBC provider profiles for this tenant environment.',
  createTitle: 'New SBC provider',
  editTitle: 'Edit SBC provider',
  dialogDescription: 'Maintain SBC provider identity and engine settings.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC providers found.',
  deleteTitle: 'Delete SBC provider',
  deleteMessage: 'Are you sure you want to delete this SBC provider?',
  deleteSelectedTitle: 'Delete selected SBC providers',
  deleteSelectedMessage: 'Delete {count} selected SBC providers?',
  savedMessage: 'SBC provider saved successfully.',
  deletedMessage: 'SBC provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC provider.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    engine: 'opensips',
    name: '',
    config: '',
    credentials: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VbpName', uuidField: 'VbpUUID' },
    { id: 'engine', label: 'Engine', field: 'VbpEngine' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VbpStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VbpStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'engine',
      source: 'VbpEngine',
      payloadKey: 'engine',
      label: 'Engine',
      type: 'select',
      options: ENGINE_OPTIONS,
      required: true,
      span: 1,
    },
    { key: 'name', source: 'VbpName', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    {
      key: 'config',
      source: 'VbpConfig',
      payloadKey: 'config',
      label: 'Config JSON',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
      format: 'json',
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-provider',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcProviderPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(PROVIDER_CONFIG);
  }
}
