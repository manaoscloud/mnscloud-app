import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudColumn,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { SoftswitchCrudPageBase } from './shared/softswitch-crud-base';
import { VoipSoftswitchAccount } from './softswitch.service';

const ACCOUNT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/accounts',
  uuidField: 'VssUUID',
  pageTitle: 'Softswitch',
  pageDescription: 'Manage the Softswitch selected for this tenant environment.',
  createTitle: 'New Softswitch',
  editTitle: 'Edit Softswitch',
  dialogDescription: 'Bind the tenant environment to an active Softswitch server and domain.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No Softswitch accounts found.',
  deleteTitle: 'Delete Softswitch',
  deleteMessage: 'Are you sure you want to delete this Softswitch?',
  deleteSelectedTitle: 'Delete selected Softswitch accounts',
  deleteSelectedMessage: 'Delete {count} selected Softswitch accounts?',
  savedMessage: 'Softswitch saved successfully.',
  deletedMessage: 'Softswitch deleted successfully.',
  deleteFailedMessage: 'Failed to delete Softswitch.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    name: '',
    serverUUID: '',
    customerUUID: '',
    domainUUID: '',
    isActive: 1,
    isDefault: 0,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VssName', uuidField: 'VssUUID' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'domain', label: 'Domain', field: 'DomainName' },
    { id: 'server', label: 'Server', field: 'ServerName' },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'VssIsActive',
      className: 'status-col',
    },
    { id: 'default', label: 'Default', field: 'VssIsDefault' },
  ],
  fields: [
    {
      key: 'serverUUID',
      source: 'VoipSoftswitchServerVsrUUID',
      payloadKey: 'serverUUID',
      label: 'Server',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'customerUUID',
      source: 'CustomerCusUUID',
      payloadKey: 'customerUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'domainUUID',
      source: 'VoipDomainVdmUUID',
      payloadKey: 'domainUUID',
      label: 'Domain',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'VssName', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    {
      key: 'isActive',
      source: 'VssIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'VssIsDefault',
      payloadKey: 'isDefault',
      label: 'Default',
      type: 'select',
      span: 1,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
    },
    {
      key: 'notes',
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
  selector: 'app-voip-softswitch',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchPage extends SoftswitchCrudPageBase<VoipSoftswitchAccount> {
  constructor() {
    super(ACCOUNT_CONFIG);
  }

  override columnText(row: VoipSoftswitchAccount, column: ConfigurableCrudColumn): string {
    if (column.id === 'default') return row.VssIsDefault === 1 ? 'Yes' : 'No';
    return super.columnText(row, column);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      isActive: Number(payload['isActive']) === 1,
      isDefault: Number(payload['isDefault']) === 1,
      config: {},
      credentials: {},
    };
  }
}
