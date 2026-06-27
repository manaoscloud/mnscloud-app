import { Component, inject } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipSoftswitchServerItem, VoipSoftswitchServerService } from './server.service';
import { SoftswitchInstallCommandDialogComponent } from './install-command-text-dialog';

const ENGINE_OPTIONS = [
  { value: 'kamailio', label: 'Kamailio' },
  { value: 'opensips', label: 'OpenSIPS' },
];

const SERVER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/voip/softswitch/servers',
  uuidField: 'VsrUUID',
  pageTitle: 'Softswitch servers',
  pageDescription: 'Manage authorized Kamailio and OpenSIPS Softswitch servers.',
  createTitle: 'New Softswitch server',
  editTitle: 'Edit Softswitch server',
  dialogDescription: 'Maintain runtime identity and connection metadata for the server.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No Softswitch servers found.',
  deleteTitle: 'Delete Softswitch server',
  deleteMessage: 'Are you sure you want to delete this Softswitch server?',
  deleteSelectedTitle: 'Delete selected Softswitch servers',
  deleteSelectedMessage: 'Delete {count} selected Softswitch servers?',
  savedMessage: 'Softswitch server saved successfully.',
  deletedMessage: 'Softswitch server deleted successfully.',
  deleteFailedMessage: 'Failed to delete Softswitch server.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  rowActions: [{ key: 'install-command', label: 'Install command', icon: 'terminal' }],
  initialValues: {
    name: '',
    nodeUUID: '',
    engine: 'kamailio',
    hostname: '',
    publicIP: '',
    privateIP: '',
    baseUrl: '',
    notes: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VsrName', uuidField: 'VsrUUID' },
    { id: 'hostname', label: 'Hostname', field: 'VsrHostname' },
    { id: 'publicIP', label: 'Public IP', field: 'VsrPublicIP' },
    { id: 'privateIP', label: 'Private IP', field: 'VsrPrivateIP' },
    { id: 'engine', label: 'Engine', field: 'VsrEngine' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsrStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VsrStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'engine',
      source: 'VsrEngine',
      payloadKey: 'engine',
      label: 'Engine',
      type: 'select',
      options: ENGINE_OPTIONS,
      required: true,
      span: 1,
    },
    { key: 'name', source: 'VsrName', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'nodeUUID', source: 'VsrNodeUUID', payloadKey: 'nodeUUID', label: 'Node UUID', span: 2 },
    { key: 'hostname', source: 'VsrHostname', payloadKey: 'hostname', label: 'Hostname', span: 2 },
    { key: 'publicIP', source: 'VsrPublicIP', payloadKey: 'publicIP', label: 'Public IP', span: 1 },
    {
      key: 'privateIP',
      source: 'VsrPrivateIP',
      payloadKey: 'privateIP',
      label: 'Private IP',
      span: 1,
    },
    { key: 'baseUrl', source: 'VsrBaseUrl', payloadKey: 'baseUrl', label: 'Base URL', span: 2 },
    {
      key: 'notes',
      source: 'VsrNotes',
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
  selector: 'app-voip-softswitch-server',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchServerPage extends ConfigurableCrudPageBase<VoipSoftswitchServerItem> {
  private readonly serverApi = inject(VoipSoftswitchServerService);

  constructor() {
    super(SERVER_CONFIG);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: VoipSoftswitchServerItem) {
    if (action.key !== 'install-command') return;
    try {
      const response = await this.serverApi.generateInstallCommand(row.VsrUUID);
      const command = String(response?.data?.command ?? response?.data?.item?.command ?? '');
      if (!command) {
        this.snack.warning('Install command was not returned.');
        return;
      }
      this.dialog.open(SoftswitchInstallCommandDialogComponent, {
        width: '720px',
        maxWidth: 'calc(100vw - 24px)',
        data: { command },
      });
    } catch (error) {
      this.snack.error((error as any)?.error?.error ?? 'Failed to generate install command.');
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
