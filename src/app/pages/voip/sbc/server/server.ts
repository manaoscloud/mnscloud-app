import { Component, inject } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  InstallCommandDialogComponent,
  type InstallCommandDialogData,
} from '../../../../shared/install-command-dialog/install-command-dialog';
import {
  openCrudTemplateDialog,
  type CrudDialogBinding,
} from '../../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import { VoipSbcServerItem, VoipSbcServerService } from './server.service';

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
  rowActions: [{ key: 'install-command', label: 'Install command', icon: 'terminal' }],
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
export class VoipSbcServerPage extends ConfigurableCrudPageBase<VoipSbcServerItem> {
  private readonly serverApi = inject(VoipSbcServerService);
  private installDialogBinding: CrudDialogBinding | null = null;

  constructor() {
    super(SERVER_CONFIG);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: VoipSbcServerItem) {
    if (action.key !== 'install-command') return;
    const confirmed = await this.confirmAction(
      'Generate install command',
      `Generate a new install command for "${row.VbsName}"? The previous SBC runtime token will be replaced.`,
      'Generate command',
    );
    if (!confirmed) return;
    await this.generateInstallCommand(row, true);
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<VoipSbcServerItem>,
  ): Promise<void> {
    if (context.mode !== 'create' || context.saveAndNew) return;
    const created = this.createdItemFromResponse(context.response);
    if (!created?.VbsUUID) {
      this.snack.warning('SBC server saved, but install command could not be generated.');
      return;
    }
    await this.generateInstallCommand(created, false);
  }

  private async generateInstallCommand(
    row: VoipSbcServerItem,
    showSuccess: boolean,
  ): Promise<void> {
    try {
      const response = await this.serverApi.generateInstallCommand(row.VbsUUID);
      const command = String(response?.data?.command ?? response?.data?.item?.command ?? '');
      if (!command) {
        this.snack.warning('Install command was not returned.');
        return;
      }
      this.installDialogBinding?.ref.close();
      this.installDialogBinding = openCrudTemplateDialog(
        this.dialog,
        InstallCommandDialogComponent,
        'crud-form-dialog',
        {
          data: this.installCommandData(row, response?.data ?? {}, command),
          onEscape: () => this.installDialogBinding?.ref.close(),
        },
      );
      bindDialogClosed(
        this.installDialogBinding.ref,
        () => {
          this.installDialogBinding?.stop();
          this.installDialogBinding = null;
        },
        this.destroyRef,
      );
      if (showSuccess) this.snack.success('SBC install command generated.');
    } catch (error) {
      this.snack.error((error as any)?.error?.error ?? 'Failed to generate install command.');
    }
  }

  private installCommandData(
    row: VoipSbcServerItem,
    data: Record<string, unknown>,
    command: string,
  ): InstallCommandDialogData {
    return {
      title: 'SBC install command',
      description: 'Run this command on the OpenSIPS SBC server.',
      warning:
        'This runtime token is shown only once. Generating a new command replaces the previous token for this SBC server.',
      command,
      details: [
        { label: 'Server', value: row.VbsName },
        { label: 'Engine', value: row.VbsEngine },
        { label: 'Node UUID', value: data['nodeUUID'] ?? row.VbsNodeUUID, monospace: true },
      ],
    };
  }

  private createdItemFromResponse(response: unknown): VoipSbcServerItem | null {
    if (!response || typeof response !== 'object') return null;
    const data = (response as { data?: { item?: unknown } }).data;
    const item = data?.item;
    return item && typeof item === 'object' ? (item as VoipSbcServerItem) : null;
  }
}
