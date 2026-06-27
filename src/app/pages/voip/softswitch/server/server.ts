import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipSoftswitchServerItem, VoipSoftswitchServerService } from './server.service';
import { SoftswitchInstallCommandDialogComponent } from './install-command-text-dialog';
import { ApiService } from '../../../../services/api.service';

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
    mediaServerUUID: '',
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
    { id: 'media', label: 'Media', field: 'MediaServerName' },
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
    {
      key: 'mediaServerUUID',
      source: 'RealtimeMediaServerRmsUUID',
      payloadKey: 'mediaServerUUID',
      label: 'Media Server',
      type: 'search-select',
      span: 2,
    },
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
  private readonly rawApi = inject(ApiService);
  readonly mediaServerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(SERVER_CONFIG);
    void this.loadMediaServers();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'mediaServerUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'mediaServerUUID') return this.mediaServerOptions();
    return [];
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

  private async loadMediaServers(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const response = await this.rawApi.get<any>('system/realtime/media/server-options');
      const rows = extractItems(response);
      this.mediaServerOptions.set(
        rows
          .map((row) =>
            option(row.value ?? row.RmsUUID ?? row.uuid, row.label ?? row.RmsName ?? row.name, [
              row.hostname ?? row.RmsHostname,
              row.controlIP ?? row.RmsControlIP,
              row.RmsEngine ?? row.engine,
              row.RtpengineSocket ?? row.rtpengineSocket,
            ]),
          )
          .filter(Boolean) as ConfigurableCrudOption[],
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function option(
  value: unknown,
  label: unknown,
  descriptionParts: unknown[] = [],
): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' - ');
  return {
    value: normalizedValue,
    label: normalizedLabel,
    description,
    searchText: `${normalizedLabel} ${description} ${normalizedValue}`,
  };
}
