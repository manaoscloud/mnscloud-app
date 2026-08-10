import { Component, inject } from '@angular/core';

import { firstValueFrom } from 'rxjs';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudOption,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  InstallCommandDialogComponent,
  InstallCommandDialogData,
} from '../../../shared/install-command-dialog/install-command-dialog';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { RealtimeMediaService } from './media.service';

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
] as const;

const ENGINE_OPTIONS = [
  { value: 'rtpengine', label: 'rtpengine' },
  { value: 'custom', label: 'Custom' },
] as const;

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
  initialValues: {
    status: 1,
    name: '',
    engine: 'rtpengine',
    mediaDomainUUID: '',
    nodeUUID: '',
    hostname: '',
    publicIP: '',
    privateIP: '',
    controlIP: '0.0.0.0',
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
    { id: 'controlIP', label: 'Control IP', field: 'RmsControlIP', copyable: true },
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
    { key: 'mediaDomainUUID', source: 'RealtimeMediaDomainRmdUUID', payloadKey: 'mediaDomainUUID', label: 'Media Domain', type: 'search-select', span: 1 },
    { key: 'name', source: 'RmsName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'nodeUUID', source: 'RmsNodeUUID', payloadKey: 'nodeUUID', label: 'Node UUID', tab: 'network', span: 1 },
    { key: 'hostname', source: 'RmsHostname', payloadKey: 'hostname', label: 'Hostname', tab: 'network', span: 1 },
    { key: 'publicIP', source: 'RmsPublicIP', payloadKey: 'publicIP', label: 'Public IP', tab: 'network', span: 1 },
    { key: 'privateIP', source: 'RmsPrivateIP', payloadKey: 'privateIP', label: 'Private IP', tab: 'network', span: 1 },
    { key: 'controlIP', source: 'RmsControlIP', payloadKey: 'controlIP', label: 'Control IP', tab: 'network', span: 1 },
    { key: 'controlPort', source: 'RmsControlPort', payloadKey: 'controlPort', label: 'Control Port', type: 'number', tab: 'network', span: 1 },
    { key: 'minMediaPort', source: 'RmsMinMediaPort', payloadKey: 'minMediaPort', label: 'Min Media Port', type: 'number', tab: 'network', span: 1 },
    { key: 'maxMediaPort', source: 'RmsMaxMediaPort', payloadKey: 'maxMediaPort', label: 'Max Media Port', type: 'number', tab: 'network', span: 1 },
    { key: 'version', source: 'RmsVersion', payloadKey: 'version', label: 'Version', tab: 'network', span: 1 },
    { key: 'configJson', source: 'RmsConfig', payloadKey: 'config', label: 'Config JSON', type: 'textarea', format: 'json', tab: 'notes', span: 4, rows: 8 },
    { key: 'notes', source: 'RmsNotes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
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
    { id: 'domain', label: 'Realtime Domain', kind: 'identity', field: 'RtdName', uuidField: 'RealtimeDomainRtdUUID' },
    { id: 'purpose', label: 'Purpose', field: 'RtdPurpose' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RmdStatus', className: 'status-col' },
    { id: 'updatedAt', label: 'Updated', field: 'RmdDateUpdated', kind: 'datetime' },
  ],
  fields: [
    { key: 'status', source: 'RmdStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'realtimeDomainUUID', source: 'RealtimeDomainRtdUUID', payloadKey: 'realtimeDomainUUID', label: 'Realtime Domain', type: 'search-select', required: true, span: 1 },
    { key: 'notes', source: 'RmdNotes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 8 },
  ],
};

abstract class RealtimeMediaCrudPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly mediaApi = inject(RealtimeMediaService);
  protected mediaDomainOptions: ConfigurableCrudOption[] = [];
  protected realtimeDomainOptions: ConfigurableCrudOption[] = [];

  protected constructor(config: ConfigurableCrudConfig) {
    super(config);
    void this.fetchLookupOptions();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'mediaDomainUUID') return this.mediaDomainOptions;
    if (key === 'realtimeDomainUUID') return this.realtimeDomainOptions;
    return [];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'generate-install') return;
    const confirmed = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Generate Install Command',
            message: `Generate a new install command for ${String(row['RmsName'] ?? '')}? The previous media runtime token will be replaced.`,
            confirmText: 'Generate command',
          },
        })
        .afterClosed(),
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
    const [mediaDomains, realtimeDomains] = await Promise.all([
      this.mediaApi.list('domains', { status: 1, limit: 5000 }),
      this.mediaApi.listRealtimeDomains({ purpose: 'media', status: 1, limit: 5000 }),
    ]);
    this.mediaDomainOptions = this.toOptions(mediaDomains?.data?.items ?? [], 'RmdUUID', 'RtdName', 'RealtimeDomainRtdUUID');
    this.realtimeDomainOptions = this.toOptions(realtimeDomains?.data?.items ?? [], 'RtdUUID', 'RtdName', 'RtdPurpose');
  }

  private toOptions(rows: ConfigurableCrudRecord[], valueKey: string, labelKey: string, descriptionKey: string): ConfigurableCrudOption[] {
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
      const response = await this.mediaApi.generateInstallCommand(String(row['RmsUUID'] ?? ''));
      const token = response?.data ?? {};
      const command = this.installCommand(token, row);
      const data: InstallCommandDialogData = {
        title: 'Media install command',
        description: 'Run this command on the target media edge host.',
        warning: 'The runtime token is sensitive. Copy it only to the intended server.',
        command,
        details: [
          { label: 'API base', value: window.location.origin, monospace: true },
          { label: 'Node UUID', value: token['nodeUUID'], monospace: true },
          { label: 'Runtime', value: 'mnscloud-media', monospace: true },
        ],
      };
      this.dialog.open(InstallCommandDialogComponent, {
        panelClass: 'install-command-dialog-panel',
        data,
      });
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
      '--control-ip',
      this.shellQuote(String(row['RmsControlIP'] ?? '127.0.0.1')),
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
