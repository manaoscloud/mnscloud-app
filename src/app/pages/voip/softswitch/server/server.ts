import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipSoftswitchServerItem, VoipSoftswitchServerService } from './server.service';
import { ApiService } from '../../../../services/api.service';
import {
  InstallCommandDialogComponent,
  type InstallCommandDialogData,
} from '../../../../shared/install-command-dialog/install-command-dialog';
import {
  openCrudTemplateDialog,
  type CrudDialogBinding,
} from '../../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';

const ENGINE_OPTIONS = [
  { value: 'kamailio', label: 'Kamailio' },
  { value: 'opensips', label: 'OpenSIPS' },
];

const CODEC_MODE_OPTIONS = [
  { value: 'passthrough', label: 'Pass-through' },
  { value: 'filter', label: 'Filtrar' },
  { value: 'prefer', label: 'Preferir' },
  { value: 'transcode', label: 'Transcodificar' },
];

const CODEC_OPTIONS = [
  { value: 'PCMU', label: 'PCMU' },
  { value: 'PCMA', label: 'PCMA' },
  { value: 'G729', label: 'G729' },
  { value: 'G722', label: 'G722' },
  { value: 'OPUS', label: 'OPUS' },
  { value: 'GSM', label: 'GSM' },
  { value: 'AMR', label: 'AMR' },
  { value: 'AMR-WB', label: 'AMR-WB' },
  { value: 'ILBC', label: 'ILBC' },
  { value: 'SPEEX', label: 'SPEEX' },
  { value: 'TELEPHONE-EVENT', label: 'TELEPHONE-EVENT' },
];

const DEFAULT_ALLOWED_CODECS = ['PCMU', 'PCMA', 'G729', 'G722', 'OPUS'];
const DEFAULT_PREFERRED_CODECS = ['PCMU', 'PCMA'];

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
    codecMode: 'passthrough',
    allowedCodecs: DEFAULT_ALLOWED_CODECS,
    preferredCodecs: DEFAULT_PREFERRED_CODECS,
    transcodeCodecs: [],
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
      label: 'Motor',
      type: 'select',
      options: ENGINE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'mediaServerUUID',
      source: 'RealtimeMediaServerRmsUUID',
      payloadKey: 'mediaServerUUID',
      label: 'Servidor media',
      type: 'search-select',
      span: 1,
    },
    { key: 'name', source: 'VsrName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'nodeUUID',
      source: 'VsrNodeUUID',
      payloadKey: 'nodeUUID',
      label: 'UUID do nó',
      span: 1,
    },
    { key: 'hostname', source: 'VsrHostname', payloadKey: 'hostname', label: 'Hostname', span: 1 },
    {
      key: 'publicIP',
      source: 'VsrPublicIP',
      payloadKey: 'publicIP',
      label: 'IP público',
      span: 1,
    },
    {
      key: 'privateIP',
      source: 'VsrPrivateIP',
      payloadKey: 'privateIP',
      label: 'IP privado',
      span: 1,
    },
    { key: 'baseUrl', source: 'VsrBaseUrl', payloadKey: 'baseUrl', label: 'URL base', span: 1 },
    {
      key: 'codecMode',
      source: 'VsrCodecMode',
      payloadKey: 'codecMode',
      label: 'Modo codec',
      type: 'select',
      options: CODEC_MODE_OPTIONS,
      span: 1,
    },
    {
      key: 'allowedCodecs',
      source: 'VsrAllowedCodecs',
      payloadKey: 'allowedCodecs',
      label: 'Codecs permitidos',
      type: 'multi-select',
      options: CODEC_OPTIONS,
      span: 1,
    },
    {
      key: 'preferredCodecs',
      source: 'VsrPreferredCodecs',
      payloadKey: 'preferredCodecs',
      label: 'Codecs preferenciais',
      type: 'multi-select',
      options: CODEC_OPTIONS,
      span: 1,
    },
    {
      key: 'transcodeCodecs',
      source: 'VsrTranscodeCodecs',
      payloadKey: 'transcodeCodecs',
      label: 'Codecs transcode',
      type: 'multi-select',
      options: CODEC_OPTIONS,
      span: 1,
    },
    {
      key: 'notes',
      source: 'VsrNotes',
      payloadKey: 'notes',
      label: 'Observações',
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
  private installDialogBinding: CrudDialogBinding | null = null;

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

  override startEdit(row: VoipSoftswitchServerItem): void {
    super.startEdit(row);
    this.patchFormValues({
      allowedCodecs: this.codecList(row.VsrAllowedCodecs, DEFAULT_ALLOWED_CODECS),
      preferredCodecs: this.codecList(row.VsrPreferredCodecs, DEFAULT_PREFERRED_CODECS),
      transcodeCodecs: this.codecList(row.VsrTranscodeCodecs, []),
    });
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      status: Number(payload['status']),
      allowedCodecs: this.codecCsv(payload['allowedCodecs']),
      preferredCodecs: this.codecCsv(payload['preferredCodecs']),
      transcodeCodecs: this.codecCsv(payload['transcodeCodecs']),
    };
  }

  private codecList(value: unknown, fallback: readonly string[]): string[] {
    const text = Array.isArray(value) ? value.join(',') : String(value ?? '');
    const items = text
      .split(/[,\s]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    return items.length ? [...new Set(items)] : [...fallback];
  }

  private codecCsv(value: unknown): string | null {
    const items = Array.isArray(value)
      ? value
      : String(value ?? '')
          .split(/[,\s]+/)
          .filter(Boolean);
    const codecs = [
      ...new Set(items.map((item) => String(item).trim().toUpperCase()).filter(Boolean)),
    ];
    return codecs.length ? codecs.join(',') : null;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: VoipSoftswitchServerItem) {
    if (action.key !== 'install-command') return;
    const confirmed = await this.confirmAction(
      'Generate install command',
      `Generate a new install command for "${row.VsrName}"? The previous Softswitch runtime token will be replaced.`,
      'Generate command',
    );
    if (!confirmed) return;
    await this.generateInstallCommand(row, true);
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<VoipSoftswitchServerItem>,
  ): Promise<void> {
    if (context.mode !== 'create' || context.saveAndNew) return;
    const created = this.createdItemFromResponse(context.response);
    if (!created?.VsrUUID) {
      this.snack.warning('Softswitch server saved, but install command could not be generated.');
      return;
    }
    await this.generateInstallCommand(created, false);
  }

  private async generateInstallCommand(
    row: VoipSoftswitchServerItem,
    showSuccess: boolean,
  ): Promise<void> {
    try {
      const response = await this.serverApi.generateInstallCommand(row.VsrUUID);
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
      if (showSuccess) this.snack.success('Softswitch install command generated.');
    } catch (error) {
      this.snack.error((error as any)?.error?.error ?? 'Failed to generate install command.');
    }
  }

  private installCommandData(
    row: VoipSoftswitchServerItem,
    data: Record<string, unknown>,
    command: string,
  ): InstallCommandDialogData {
    return {
      title: 'Softswitch install command',
      description: 'Run this command on the Kamailio or OpenSIPS Softswitch server.',
      warning:
        'This runtime token is shown only once. Generating a new command replaces the previous token for this Softswitch server.',
      command,
      details: [
        { label: 'Server', value: row.VsrName },
        { label: 'Engine', value: row.VsrEngine },
        { label: 'Node UUID', value: data['nodeUUID'] ?? row.VsrNodeUUID, monospace: true },
        { label: 'Media Server', value: row.MediaServerName },
      ],
    };
  }

  private createdItemFromResponse(response: unknown): VoipSoftswitchServerItem | null {
    if (!response || typeof response !== 'object') return null;
    const data = (response as { data?: { item?: unknown } }).data;
    const item = data?.item;
    return item && typeof item === 'object' ? (item as VoipSoftswitchServerItem) : null;
  }

  private async loadMediaServers(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const response = await this.rawApi.get<any>(
        'system/realtime/media/servers?status=1&limit=5000',
      );
      const rows = extractItems(response);
      this.mediaServerOptions.set(
        rows
          .map((row) =>
            option(row.RmsUUID ?? row.uuid, row.RmsName ?? row.name, [
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
