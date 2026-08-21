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
import {
  InstallCommandDialogComponent,
  type InstallCommandDialogData,
} from '../../../../shared/install-command-dialog/install-command-dialog';
import {
  openCrudTemplateDialog,
  type CrudDialogBinding,
} from '../../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import { ApiService } from '../../../../services/api.service';
import { VoipSbcServerItem, VoipSbcServerService } from './server.service';

const ENGINE_OPTIONS = [
  { value: 'opensips', label: 'OpenSIPS' },
  { value: 'kamailio', label: 'Kamailio' },
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
    mediaServerUUID: '',
    name: '',
    nodeUUID: '',
    hostname: '',
    publicIP: '',
    privateIP: '',
    baseUrl: '',
    codecMode: 'passthrough',
    allowedCodecs: DEFAULT_ALLOWED_CODECS,
    preferredCodecs: DEFAULT_PREFERRED_CODECS,
    transcodeCodecs: [],
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VbsName', uuidField: 'VbsUUID' },
    { id: 'engine', label: 'Engine', field: 'VbsEngine' },
    { id: 'media', label: 'Media', field: 'MediaServerName' },
    { id: 'hostname', label: 'Hostname', field: 'VbsHostname' },
    { id: 'publicIP', label: 'SIP public IP (NAT/advertise)', field: 'VbsPublicIP' },
    { id: 'advertisedIP', label: 'SIP advertised IP', field: 'VbsAdvertisedIP', copyable: true },
    { id: 'privateIP', label: 'Private listen IP', field: 'VbsPrivateIP' },
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
    {
      key: 'mediaServerUUID',
      source: 'RealtimeMediaServerRmsUUID',
      payloadKey: 'mediaServerUUID',
      label: 'Servidor media',
      type: 'search-select',
      span: 1,
    },
    { key: 'name', source: 'VbsName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'nodeUUID',
      source: 'VbsNodeUUID',
      payloadKey: 'nodeUUID',
      label: 'Node UUID',
      tab: 'network',
      span: 1,
    },
    {
      key: 'hostname',
      source: 'VbsHostname',
      payloadKey: 'hostname',
      label: 'Hostname',
      tab: 'network',
      span: 1,
      breakBefore: true,
    },
    {
      key: 'publicIP',
      source: 'VbsPublicIP',
      payloadKey: 'publicIP',
      label: 'SIP public IP (NAT/advertise)',
      tab: 'network',
      span: 1,
    },
    {
      key: 'privateIP',
      source: 'VbsPrivateIP',
      payloadKey: 'privateIP',
      label: 'Private listen IP',
      tab: 'network',
      span: 1,
    },
    {
      key: 'baseUrl',
      source: 'VbsBaseUrl',
      payloadKey: 'baseUrl',
      label: 'Base URL',
      tab: 'network',
      span: 1,
    },
    {
      key: 'codecMode',
      source: 'VbsCodecMode',
      payloadKey: 'codecMode',
      label: 'Modo codec',
      type: 'select',
      tab: 'codecs',
      options: CODEC_MODE_OPTIONS,
      span: 1,
    },
    {
      key: 'allowedCodecs',
      source: 'VbsAllowedCodecs',
      payloadKey: 'allowedCodecs',
      label: 'Codecs permitidos',
      type: 'multi-select',
      tab: 'codecs',
      options: CODEC_OPTIONS,
      span: 1,
    },
    {
      key: 'preferredCodecs',
      source: 'VbsPreferredCodecs',
      payloadKey: 'preferredCodecs',
      label: 'Codecs preferenciais',
      type: 'multi-select',
      tab: 'codecs',
      options: CODEC_OPTIONS,
      span: 1,
    },
    {
      key: 'transcodeCodecs',
      source: 'VbsTranscodeCodecs',
      payloadKey: 'transcodeCodecs',
      label: 'Codecs transcode',
      type: 'multi-select',
      tab: 'codecs',
      options: CODEC_OPTIONS,
      span: 1,
    },
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

  override startEdit(row: VoipSbcServerItem): void {
    super.startEdit(row);
    this.patchFormValues({
      allowedCodecs: this.codecList(row.VbsAllowedCodecs, DEFAULT_ALLOWED_CODECS),
      preferredCodecs: this.codecList(row.VbsPreferredCodecs, DEFAULT_PREFERRED_CODECS),
      transcodeCodecs: this.codecList(row.VbsTranscodeCodecs, []),
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
        { label: 'Media Server', value: row.MediaServerName },
        {
          label: 'RTP engine',
          value: data['rtpengineSocket'] ?? row.RtpengineSocket,
          monospace: true,
        },
      ],
    };
  }

  private createdItemFromResponse(response: unknown): VoipSbcServerItem | null {
    if (!response || typeof response !== 'object') return null;
    const data = (response as { data?: { item?: unknown } }).data;
    const item = data?.item;
    return item && typeof item === 'object' ? (item as VoipSbcServerItem) : null;
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
              row.RmsHostname ?? row.hostname,
              row.RmsControlIP ?? row.controlIP,
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
