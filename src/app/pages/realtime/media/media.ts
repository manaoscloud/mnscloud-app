import {
  SERVER_LOG_INITIAL_VALUES,
  serverLogFields,
  serverLogPayload,
} from '../../../shared/crud/server-log-fields';
import {
  confirmInstallCommandGeneration,
  requestRuntimeInstallCommand,
  runtimeInstallTokenWarning,
} from '../../../shared/install-command-dialog/runtime-install-token';
import { Component, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudOption,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { InstallCommandDialogData } from '../../../shared/install-command-dialog/install-command-dialog';
import { openInstallCommandDialog } from '../../../shared/install-command-dialog/open-install-command-dialog';
import { RealtimeMediaService } from './media.service';

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
] as const;

const ENGINE_OPTIONS = [
  { value: 'rtpengine', label: 'rtpengine' },
  { value: 'custom', label: 'Custom' },
] as const;

/** Media domain option that asks the API to generate a managed domain (RTP Media parameters). */
const AUTO_MEDIA_DOMAIN = '__auto__';

const RMS_LOG_MANAGED_ENGINES = ['rtpengine'];

const MEDIA_SERVER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/media/servers',
  uuidField: 'RmsUUID',
  pageTitle: 'Media Servers',
  pageDescription: 'Register dedicated RTP/media relay servers for realtime sessions.',
  createTitle: 'New media server',
  editTitle: 'Edit media server',
  dialogDescription: 'Runtime identity and network settings for the media relay edge.',
  searchPlaceholder: 'Search media servers',
  emptyLabel: 'No media servers found.',
  deleteTitle: 'Delete media server',
  deleteMessage: 'Delete this media server?',
  deleteSelectedTitle: 'Delete selected media servers',
  deleteSelectedMessage: 'Delete {count} selected media servers?',
  savedMessage: 'Media server saved.',
  deletedMessage: 'Media server deleted.',
  deleteFailedMessage: 'Failed to delete media server.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  tabLabels: { diagnostics: 'Logs' },
  initialValues: {
    ...SERVER_LOG_INITIAL_VALUES,
    status: 1,
    name: '',
    engine: 'rtpengine',
    mediaDomainUUID: '',
    nodeUUID: '',
    hostname: '',
    publicIP: '',
    publicIPv6: '',
    privateIP: '',
    controlIP: '',
    controlPort: 2223,
    minMediaPort: 30000,
    maxMediaPort: 40000,
    version: '',
    configJson: '{}',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'RmsName', uuidField: 'RmsUUID' },
    { id: 'engine', label: 'Engine', field: 'RmsEngine' },
    {
      id: 'domain',
      label: 'Media Domain',
      kind: 'related',
      field: 'DomainName',
      uuidField: 'RealtimeMediaDomainRmdUUID',
    },
    { id: 'advertisedIP', label: 'IP anunciado', field: 'RmsAdvertisedIP', copyable: true },
    { id: 'publicIPv6', label: 'Public IPv6', field: 'RmsPublicIPv6', copyable: true },
    { id: 'controlIP', label: 'Control IP', field: 'RmsControlIP', copyable: true },
    // NG socket handed to Softswitch/SBC (the private IPv4 when the control IP is automatic).
    {
      id: 'rtpengineSocket',
      label: 'Effective control',
      field: 'RtpengineSocket',
      copyable: true,
    },
    { id: 'controlPort', label: 'Control Port', field: 'RmsControlPort' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RmsStatus', className: 'status-col' },
    { id: 'lastSeen', label: 'Last Seen', field: 'RmsLastSeenAt', kind: 'datetime' },
  ],
  rowActions: [
    {
      key: 'generate-install',
      label: 'Generate install command',
      icon: 'terminal',
      tooltip: 'Generate install command',
    },
  ],
  fields: [
    { key: 'status', source: 'RmsStatus', payloadKey: 'status', label: 'Status', type: 'status' },
    {
      key: 'engine',
      source: 'RmsEngine',
      payloadKey: 'engine',
      label: 'Engine',
      type: 'select',
      options: ENGINE_OPTIONS,
      span: 1,
    },
    {
      key: 'mediaDomainUUID',
      source: 'RealtimeMediaDomainRmdUUID',
      payloadKey: 'mediaDomainUUID',
      label: 'Media Domain',
      type: 'search-select',
      span: 1,
    },
    { key: 'name', source: 'RmsName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'nodeUUID',
      source: 'RmsNodeUUID',
      payloadKey: 'nodeUUID',
      label: 'Node UUID',
      tab: 'network',
      span: 1,
    },
    {
      key: 'hostname',
      source: 'RmsHostname',
      payloadKey: 'hostname',
      label: 'Hostname',
      tab: 'network',
      span: 1,
    },
    {
      key: 'publicIP',
      source: 'RmsPublicIP',
      payloadKey: 'publicIP',
      label: 'Public IP',
      tab: 'network',
      span: 1,
    },
    {
      key: 'publicIPv6',
      source: 'RmsPublicIPv6',
      payloadKey: 'publicIPv6',
      label: 'Public IPv6',
      tab: 'network',
      span: 1,
    },
    {
      key: 'privateIP',
      source: 'RmsPrivateIP',
      payloadKey: 'privateIP',
      label: 'Private IP',
      tab: 'network',
      span: 1,
    },
    {
      key: 'controlIP',
      source: 'RmsControlIP',
      payloadKey: 'controlIP',
      label: 'Control IP',
      placeholder: 'Automatic (private IPv4)',
      tab: 'network',
      span: 1,
    },
    {
      key: 'controlPort',
      source: 'RmsControlPort',
      payloadKey: 'controlPort',
      label: 'Control Port',
      type: 'number',
      tab: 'network',
      span: 1,
    },
    {
      key: 'minMediaPort',
      source: 'RmsMinMediaPort',
      payloadKey: 'minMediaPort',
      label: 'Min Media Port',
      type: 'number',
      tab: 'network',
      span: 1,
    },
    {
      key: 'maxMediaPort',
      source: 'RmsMaxMediaPort',
      payloadKey: 'maxMediaPort',
      label: 'Max Media Port',
      type: 'number',
      tab: 'network',
      span: 1,
    },
    {
      key: 'version',
      source: 'RmsVersion',
      payloadKey: 'version',
      label: 'Version',
      tab: 'network',
      span: 1,
    },
    {
      key: 'configJson',
      source: 'RmsConfig',
      payloadKey: 'config',
      label: 'Config JSON',
      type: 'textarea',
      format: 'json',
      tab: 'notes',
      span: 4,
      rows: 8,
    },
    {
      key: 'notes',
      source: 'RmsNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
    ...serverLogFields('Rms', RMS_LOG_MANAGED_ENGINES),
  ],
};

const MEDIA_DOMAIN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/media/domains',
  uuidField: 'RmdUUID',
  pageTitle: 'Media/RTP Domains',
  pageDescription: 'Assign realtime media domains to RTP/media relay operations.',
  createTitle: 'New media domain',
  editTitle: 'Edit media domain',
  dialogDescription: 'Realtime domain ownership used by the media relay layer.',
  searchPlaceholder: 'Search media domains',
  emptyLabel: 'No media domains found.',
  deleteTitle: 'Delete media domain',
  deleteMessage: 'Delete this media domain?',
  deleteSelectedTitle: 'Delete selected media domains',
  deleteSelectedMessage: 'Delete {count} selected media domains?',
  savedMessage: 'Media domain saved.',
  deletedMessage: 'Media domain deleted.',
  deleteFailedMessage: 'Failed to delete media domain.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  initialValues: {
    status: 1,
    realtimeDomainUUID: '',
    notes: '',
  },
  columns: [
    {
      id: 'domain',
      label: 'Realtime Domain',
      kind: 'identity',
      field: 'RtdName',
      uuidField: 'RealtimeDomainRtdUUID',
    },
    { id: 'purpose', label: 'Purpose', field: 'RtdPurpose' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RmdStatus', className: 'status-col' },
    { id: 'updatedAt', label: 'Updated', field: 'RmdDateUpdated', kind: 'datetime' },
  ],
  fields: [
    {
      key: 'status',
      source: 'RmdStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'realtimeDomainUUID',
      source: 'RealtimeDomainRtdUUID',
      payloadKey: 'realtimeDomainUUID',
      label: 'Realtime Domain',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'notes',
      source: 'RmdNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 8,
    },
  ],
};

abstract class RealtimeMediaCrudPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly mediaApi = inject(RealtimeMediaService);
  private readonly parametersApi = inject(ApiService);
  protected mediaDomainOptions: ConfigurableCrudOption[] = [];
  protected realtimeDomainOptions: ConfigurableCrudOption[] = [];
  /** Base of the RTP DNS policy when automatic media domains are enabled; null otherwise. */
  private autoDomainBase: string | null = null;

  protected constructor(config: ConfigurableCrudConfig) {
    super(config);
    void this.fetchLookupOptions();
  }

  private get isServerPage(): boolean {
    return this.config.uuidField === 'RmsUUID';
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'mediaDomainUUID') {
      if (!this.isServerPage || this.editingRecord() || this.autoDomainBase === null) {
        return this.mediaDomainOptions;
      }
      return [
        {
          value: AUTO_MEDIA_DOMAIN,
          label: this.t('Generate automatically'),
          description: `<uuid>.${this.autoDomainBase}`,
          searchText: `${this.t('Generate automatically')} ${this.autoDomainBase}`,
        },
        ...this.mediaDomainOptions,
      ];
    }
    if (key === 'realtimeDomainUUID') return this.realtimeDomainOptions;
    return [];
  }

  override startCreate(): void {
    super.startCreate();
    if (this.isServerPage && this.autoDomainBase !== null) {
      this.patchFormValues({ mediaDomainUUID: AUTO_MEDIA_DOMAIN });
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const values = this.isServerPage ? serverLogPayload(payload, RMS_LOG_MANAGED_ENGINES) : payload;
    if (values['mediaDomainUUID'] !== AUTO_MEDIA_DOMAIN) return super.augmentPayload(values);
    return super.augmentPayload({ ...values, mediaDomainUUID: null, autoDomain: true });
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'generate-install') return;
    const confirmed = await confirmInstallCommandGeneration(
      this.dialog,
      (key, params) => this.t(key, params),
      String(row['RmsName'] ?? ''),
      'media',
    );
    if (!confirmed) return;
    await this.openInstallCommand(row);
  }

  protected override async afterSave(context: { mode: 'create'; response: unknown } | any) {
    const item = context?.response?.data?.item as ConfigurableCrudRecord | undefined;
    const uuid = String(item?.['RmsUUID'] ?? '');
    if (context?.mode === 'create' && uuid && this.config.uuidField === 'RmsUUID') {
      await this.openInstallCommand(item ?? {});
    }
  }

  private async fetchLookupOptions() {
    const [mediaDomains, realtimeDomains, parameters] = await Promise.all([
      this.mediaApi.list('domains', { status: 1, limit: 5000 }),
      this.mediaApi.listRealtimeDomains({ purpose: 'media', status: 1, limit: 5000 }),
      this.isServerPage
        ? this.parametersApi.get<any>('system/parameters').catch(() => null)
        : Promise.resolve(null),
    ]);
    const rtpMedia = parameters?.data?.item;
    this.autoDomainBase =
      rtpMedia?.realtimeMediaAutoDomainEnabled === true && rtpMedia?.realtimeMediaDnsPolicyBase
        ? String(rtpMedia.realtimeMediaDnsPolicyBase)
        : null;
    this.mediaDomainOptions = this.toOptions(
      mediaDomains?.data?.items ?? [],
      'RmdUUID',
      'RtdName',
      'RealtimeDomainRtdUUID',
    );
    this.realtimeDomainOptions = this.toOptions(
      realtimeDomains?.data?.items ?? [],
      'RtdUUID',
      'RtdName',
      'RtdPurpose',
    );
  }

  private toOptions(
    rows: ConfigurableCrudRecord[],
    valueKey: string,
    labelKey: string,
    descriptionKey: string,
  ): ConfigurableCrudOption[] {
    return rows
      .map((row) => ({
        value: String(row[valueKey] ?? ''),
        label: String(row[labelKey] ?? row[valueKey] ?? ''),
        description: String(row[descriptionKey] ?? ''),
        searchText: `${row[labelKey] ?? ''} ${row[descriptionKey] ?? ''} ${row[valueKey] ?? ''}`,
      }))
      .filter((option) => option.value);
  }

  private async openInstallCommand(row: ConfigurableCrudRecord) {
    try {
      const response = await requestRuntimeInstallCommand(this.dialog, (body) =>
        this.mediaApi.generateInstallCommand(String(row['RmsUUID'] ?? ''), body),
      );
      if (!response) return;
      const token = response?.data ?? {};
      const command = this.installCommand(token, row);
      const data: InstallCommandDialogData = {
        title: 'Media install command',
        description: 'Run this command on the target media edge host.',
        warning: runtimeInstallTokenWarning(
          token,
          'This runtime token is shown only once. Copy it only to the intended server.',
        ),
        command,
        details: [
          { label: 'API base', value: window.location.origin, monospace: true },
          { label: 'Node UUID', value: token['nodeUUID'], monospace: true },
          { label: 'Runtime', value: 'mnscloud-media', monospace: true },
        ],
      };
      openInstallCommandDialog(this.dialog, data, this.destroyRef);
      this.snack.success('Media install command generated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to generate media install command.');
    }
  }

  private installCommand(token: ConfigurableCrudRecord, row: ConfigurableCrudRecord): string {
    const args = [
      '--non-interactive',
      '--api-base',
      this.shellQuote(window.location.origin),
      '--node-uuid',
      this.shellQuote(String(token['nodeUUID'] ?? '')),
      '--runtime-token',
      this.shellQuote(String(token['runtimeToken'] ?? '')),
      // Without an explicit control IP the node listens for NG on its private IPv4 only.
      ...(row['RmsControlIP']
        ? ['--control-ip', this.shellQuote(String(row['RmsControlIP']))]
        : []),
      '--control-port',
      this.shellQuote(String(row['RmsControlPort'] ?? '2223')),
    ];
    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-media/.git ] && sudo git -C mnscloud-media pull || gh repo clone manaoscloud/mnscloud-media',
      `sudo bash /opt/mnscloud/mnscloud-media/scripts/install-media.sh ${args.join(' ')}`,
      'sudo bash /opt/mnscloud/mnscloud-media/scripts/validate-media.sh',
    ].join(' && ');
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}

@Component({
  selector: 'app-realtime-media-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeMediaServersPage extends RealtimeMediaCrudPage {
  constructor() {
    super(MEDIA_SERVER_CONFIG);
  }
}

@Component({
  selector: 'app-realtime-media-domains',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeMediaDomainsPage extends RealtimeMediaCrudPage {
  constructor() {
    super(MEDIA_DOMAIN_CONFIG);
  }
}
