import { Component, inject } from '@angular/core';

import { firstValueFrom } from 'rxjs';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  InstallCommandDialogComponent,
  InstallCommandDialogData,
} from '../../../shared/install-command-dialog/install-command-dialog';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { RealtimeWebRtcService, WebRtcResource, WebRtcScope } from './webrtc.service';

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
] as const;

const ACTIVE_INACTIVE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

const WEBRTC_SERVER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/webrtc/servers',
  uuidField: 'RwsUUID',
  pageTitle: 'WebRTC Servers',
  pageDescription: 'Register Kamailio WebRTC edge nodes authorized by node UUID.',
  createTitle: 'New WebRTC server',
  editTitle: 'Edit WebRTC server',
  dialogDescription: 'Runtime identity and network settings for the WebRTC edge.',
  searchPlaceholder: 'Search WebRTC servers',
  emptyLabel: 'No WebRTC servers found.',
  deleteTitle: 'Delete WebRTC server',
  deleteMessage: 'Delete this WebRTC server?',
  deleteSelectedTitle: 'Delete selected WebRTC servers',
  deleteSelectedMessage: 'Delete {count} selected WebRTC servers?',
  savedMessage: 'WebRTC server saved.',
  deletedMessage: 'WebRTC server deleted.',
  deleteFailedMessage: 'Failed to delete WebRTC server.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  initialValues: {
    status: 1,
    engine: 'kamailio',
    name: '',
    realtimeDomainUUID: '',
    mediaServerUUID: '',
    nodeUUID: '',
    hostname: '',
    publicIP: '',
    privateIP: '',
    baseUrl: '',
    version: '',
    configJson: '{}',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'RwsName', uuidField: 'RwsUUID' },
    { id: 'engine', label: 'Engine', field: 'RwsEngine' },
    { id: 'hostname', label: 'Hostname', field: 'RwsHostname' },
    { id: 'domain', label: 'Primary Domain', field: 'RtdName' },
    { id: 'mediaServer', label: 'Media Server', field: 'RmsName' },
    { id: 'publicIP', label: 'Public IP', field: 'RwsPublicIP', copyable: true },
    { id: 'status', label: 'Status', kind: 'status', field: 'RwsStatus', className: 'status-col' },
    { id: 'lastSeen', label: 'Last Seen', field: 'RwsLastSeenAt', kind: 'datetime' },
  ],
  rowActions: [{ key: 'generate-install', label: 'Generate install command', icon: 'terminal' }],
  fields: [
    { key: 'status', source: 'RwsStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'engine', source: 'RwsEngine', payloadKey: 'engine', label: 'Engine', type: 'select', options: [{ value: 'kamailio', label: 'Kamailio' }], span: 1 },
    { key: 'name', source: 'RwsName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'realtimeDomainUUID', source: 'RealtimeDomainRtdUUID', payloadKey: 'realtimeDomainUUID', label: 'Primary Domain', type: 'search-select', span: 1 },
    { key: 'mediaServerUUID', source: 'RealtimeMediaServerRmsUUID', payloadKey: 'mediaServerUUID', label: 'Media Server', type: 'search-select', span: 1 },
    { key: 'nodeUUID', source: 'RwsNodeUUID', payloadKey: 'nodeUUID', label: 'Node UUID', tab: 'network', span: 1 },
    { key: 'hostname', source: 'RwsHostname', payloadKey: 'hostname', label: 'Hostname', tab: 'network', span: 1 },
    { key: 'publicIP', source: 'RwsPublicIP', payloadKey: 'publicIP', label: 'Public IP', tab: 'network', span: 1 },
    { key: 'privateIP', source: 'RwsPrivateIP', payloadKey: 'privateIP', label: 'Private IP', tab: 'network', span: 1 },
    { key: 'baseUrl', source: 'RwsBaseUrl', payloadKey: 'baseUrl', label: 'Base URL', tab: 'network', span: 1 },
    { key: 'version', source: 'RwsVersion', payloadKey: 'version', label: 'Version', tab: 'network', span: 1 },
    { key: 'configJson', source: 'RwsConfig', payloadKey: 'config', label: 'Config JSON', type: 'textarea', format: 'json', tab: 'notes', span: 4, rows: 8 },
    { key: 'notes', source: 'RwsNotes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ],
};

function webRtcDomainConfig(endpoint: string, titlePrefix = 'WebRTC'): ConfigurableCrudConfig {
  return {
    endpoint,
    uuidField: 'RwdUUID',
    pageTitle: `${titlePrefix} Domains`,
    pageDescription: 'Publish partner and tenant WSS domains on authorized WebRTC edge nodes.',
    createTitle: 'New WebRTC domain',
    editTitle: 'Edit WebRTC domain',
    dialogDescription: 'Bind a realtime domain to a WebRTC signaling edge.',
    searchPlaceholder: 'Search WebRTC domains',
    emptyLabel: 'No WebRTC domains found.',
    deleteTitle: 'Delete WebRTC domain',
    deleteMessage: 'Delete this WebRTC domain?',
    deleteSelectedTitle: 'Delete selected WebRTC domains',
    deleteSelectedMessage: 'Delete {count} selected WebRTC domains?',
    savedMessage: 'WebRTC domain saved.',
    deletedMessage: 'WebRTC domain deleted.',
    deleteFailedMessage: 'Failed to delete WebRTC domain.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: STATUS_OPTIONS,
    initialValues: {
      status: 1,
      serverUUID: '',
      realtimeDomainUUID: '',
      certificateProvider: 'letsencrypt',
      notes: '',
    },
    columns: [
      { id: 'domain', label: 'Realtime Domain', kind: 'identity', field: 'RtdName', uuidField: 'RealtimeDomainRtdUUID' },
      { id: 'server', label: 'Server', field: 'RwsName' },
      { id: 'certificateProvider', label: 'Certificate', field: 'RwdCertificateProvider' },
      { id: 'nginxStatus', label: 'Nginx', field: 'RwdNginxStatus' },
      { id: 'certificateStatus', label: 'TLS', field: 'RwdCertificateStatus' },
      { id: 'autoProvision', label: 'Auto', kind: 'boolean', field: 'RwdAutoProvision' },
      { id: 'status', label: 'Status', kind: 'status', field: 'RwdStatus', className: 'status-col' },
    ],
    rowActions: [{ key: 'provision-domain', label: 'Provision domain', icon: 'cloud_sync' }],
    fields: [
      { key: 'status', source: 'RwdStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
      { key: 'serverUUID', source: 'RealtimeWebRtcServerRwsUUID', payloadKey: 'serverUUID', label: 'Server', type: 'search-select', required: true, span: 1 },
      { key: 'realtimeDomainUUID', source: 'RealtimeDomainRtdUUID', payloadKey: 'realtimeDomainUUID', label: 'Realtime Domain', type: 'search-select', required: true, span: 1 },
      { key: 'certificateProvider', source: 'RwdCertificateProvider', payloadKey: 'certificateProvider', label: 'Certificate Provider', type: 'select', options: [{ value: 'letsencrypt', label: 'Let’s Encrypt' }, { value: 'manual', label: 'Manual' }, { value: 'self_signed', label: 'Self-signed' }], span: 1 },
      { key: 'notes', source: 'RwdNotes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
    ],
  };
}

const WEBRTC_PARAMETER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/webrtc/parameters',
  uuidField: 'RwpUUID',
  pageTitle: 'WebRTC Parameters',
  pageDescription: 'Manage tenant and edge-specific WebRTC runtime parameters.',
  createTitle: 'New WebRTC parameter',
  editTitle: 'Edit WebRTC parameter',
  dialogDescription: 'Runtime parameter consumed by WebRTC edges.',
  searchPlaceholder: 'Search WebRTC parameters',
  emptyLabel: 'No WebRTC parameters found.',
  deleteTitle: 'Delete WebRTC parameter',
  deleteMessage: 'Delete this WebRTC parameter?',
  deleteSelectedTitle: 'Delete selected WebRTC parameters',
  deleteSelectedMessage: 'Delete {count} selected WebRTC parameters?',
  savedMessage: 'WebRTC parameter saved.',
  deletedMessage: 'WebRTC parameter deleted.',
  deleteFailedMessage: 'Failed to delete WebRTC parameter.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  initialValues: { status: 1, serverUUID: '', key: '', type: 'string', valueJson: '', description: '' },
  columns: [
    { id: 'key', label: 'Key', kind: 'identity', field: 'RwpKey', uuidField: 'RwpUUID' },
    { id: 'server', label: 'Server', field: 'RwsName' },
    { id: 'type', label: 'Type', field: 'RwpType' },
    { id: 'value', label: 'Value', field: 'RwpValue' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RwpStatus', className: 'status-col' },
  ],
  fields: [
    { key: 'serverUUID', source: 'RealtimeWebRtcServerRwsUUID', payloadKey: 'serverUUID', label: 'Server', type: 'search-select', span: 1 },
    { key: 'key', source: 'RwpKey', payloadKey: 'key', label: 'Key', required: true, span: 1 },
    { key: 'type', source: 'RwpType', payloadKey: 'type', label: 'Type', type: 'select', options: [{ value: 'string', label: 'String' }, { value: 'number', label: 'Number' }, { value: 'boolean', label: 'Boolean' }, { value: 'json', label: 'JSON' }], span: 1 },
    { key: 'status', source: 'RwpStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'valueJson', source: 'RwpValue', payloadKey: 'value', label: 'Value', type: 'textarea', format: 'json', tab: 'notes', span: 4, rows: 4 },
    { key: 'description', source: 'RwpDescription', payloadKey: 'description', label: 'Description', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ],
};

const WEBRTC_SIP_TARGET_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/webrtc/sip-targets',
  uuidField: 'RwtUUID',
  pageTitle: 'WebRTC SIP Targets',
  pageDescription: 'Bind each WebRTC domain to one explicit PABX or Softswitch SIP destination.',
  createTitle: 'New WebRTC SIP target',
  editTitle: 'Edit WebRTC SIP target',
  dialogDescription: 'Master-only mapping between WebRTC domains and SIP destinations.',
  searchPlaceholder: 'Search WebRTC SIP targets',
  emptyLabel: 'No WebRTC SIP targets found.',
  deleteTitle: 'Delete WebRTC SIP target',
  deleteMessage: 'Delete this WebRTC SIP target?',
  deleteSelectedTitle: 'Delete selected WebRTC SIP targets',
  deleteSelectedMessage: 'Delete {count} selected WebRTC SIP targets?',
  savedMessage: 'WebRTC SIP target saved.',
  deletedMessage: 'WebRTC SIP target deleted.',
  deleteFailedMessage: 'Failed to delete WebRTC SIP target.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  initialValues: {
    status: 1,
    webRtcDomainUUID: '',
    targetType: 'pabx',
    pabxAccountUUID: '',
    softswitchAccountUUID: '',
    host: '',
    port: 5060,
    transport: 'udp',
    priority: 100,
    notes: '',
  },
  columns: [
    { id: 'webRtcDomain', label: 'WebRTC Domain', kind: 'identity', field: 'WebRtcDomainName', uuidField: 'RealtimeWebRtcDomainRwdUUID' },
    { id: 'targetType', label: 'Target Type', field: 'RwtTargetType' },
    { id: 'pabxTarget', label: 'PABX Account', field: 'PabxAccountName' },
    { id: 'softswitchTarget', label: 'Softswitch Account', field: 'SoftswitchAccountName' },
    { id: 'sipDomain', label: 'SIP Domain', field: 'SipDomainName' },
    { id: 'host', label: 'Host', field: 'RwtHost' },
    { id: 'port', label: 'Port', field: 'RwtPort' },
    { id: 'transport', label: 'Transport', field: 'RwtTransport' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RwtStatus', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'RwtStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'webRtcDomainUUID', source: 'RealtimeWebRtcDomainRwdUUID', payloadKey: 'webRtcDomainUUID', label: 'WebRTC Domain', type: 'search-select', required: true, span: 1 },
    { key: 'targetType', source: 'RwtTargetType', payloadKey: 'targetType', label: 'Target Type', type: 'select', options: [{ value: 'pabx', label: 'PABX' }, { value: 'softswitch', label: 'Softswitch' }], required: true, span: 1 },
    { key: 'pabxAccountUUID', source: 'VoipPabxAccountVpaUUID', payloadKey: 'pabxAccountUUID', label: 'PABX Account', type: 'search-select', requiredWhen: ({ values }) => values['targetType'] === 'pabx', hiddenWhen: ({ values }) => values['targetType'] !== 'pabx', span: 1 },
    { key: 'softswitchAccountUUID', source: 'VoipSoftswitchAccountVssUUID', payloadKey: 'softswitchAccountUUID', label: 'Softswitch Account', type: 'search-select', requiredWhen: ({ values }) => values['targetType'] === 'softswitch', hiddenWhen: ({ values }) => values['targetType'] !== 'softswitch', span: 1 },
    { key: 'host', source: 'RwtHost', payloadKey: 'host', label: 'SIP Host Override', tab: 'network', span: 1 },
    { key: 'port', source: 'RwtPort', payloadKey: 'port', label: 'SIP Port', type: 'number', tab: 'network', span: 1 },
    { key: 'transport', source: 'RwtTransport', payloadKey: 'transport', label: 'Transport', type: 'select', options: [{ value: 'udp', label: 'UDP' }, { value: 'tcp', label: 'TCP' }, { value: 'tls', label: 'TLS' }], tab: 'network', span: 1 },
    { key: 'priority', source: 'RwtPriority', payloadKey: 'priority', label: 'Priority', type: 'number', tab: 'network', span: 1 },
    { key: 'notes', source: 'RwtNotes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ],
};

abstract class RealtimeWebRtcCrudPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly webRtcApi = inject(RealtimeWebRtcService);
  private readonly resourceName: WebRtcResource;
  private readonly resourceScope: WebRtcScope;
  protected servers: ConfigurableCrudOption[] = [];
  protected domains: ConfigurableCrudOption[] = [];
  protected mediaServers: ConfigurableCrudOption[] = [];
  protected pabxAccounts: ConfigurableCrudOption[] = [];
  protected softswitchAccounts: ConfigurableCrudOption[] = [];

  protected constructor(
    config: ConfigurableCrudConfig,
    resourceName: WebRtcResource,
    resourceScope: WebRtcScope,
  ) {
    super(config);
    this.resourceName = resourceName;
    this.resourceScope = resourceScope;
    void this.fetchLookupOptions();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.servers;
    if (key === 'realtimeDomainUUID') return this.domains;
    if (key === 'mediaServerUUID') return this.mediaServers;
    if (key === 'webRtcDomainUUID') return this.domains;
    if (key === 'pabxAccountUUID') return this.pabxAccounts;
    if (key === 'softswitchAccountUUID') return this.softswitchAccounts;
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    if (this.resourceName === 'servers') payload['engine'] = 'kamailio';
    if (this.resourceName === 'sip-targets') {
      payload['port'] = Number(payload['port'] || 5060);
      payload['priority'] = Number(payload['priority'] || 100);
      if (payload['targetType'] === 'pabx') payload['softswitchAccountUUID'] = null;
      if (payload['targetType'] === 'softswitch') payload['pabxAccountUUID'] = null;
    }
    if (this.resourceName === 'parameters' && typeof payload['value'] === 'string') {
      const raw = String(payload['value']).trim();
      if (raw) {
        try {
          payload['value'] = JSON.parse(raw);
        } catch {
          payload['value'] = raw;
        }
      }
    }
    return payload;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'generate-install') {
      await this.confirmAndOpenInstallCommand(row);
      return;
    }
    if (action.key === 'provision-domain') {
      await this.webRtcApi.provisionDomain(String(row['RwdUUID'] ?? ''), this.resourceScope);
      this.snack.success('WebRTC domain provisioning queued on edge agent.');
      this.refreshList();
    }
  }

  protected override async afterSave(context: { mode: 'create'; response: unknown } | any) {
    const item = context?.response?.data?.item as ConfigurableCrudRecord | undefined;
    const uuid = String(item?.['RwsUUID'] ?? '');
    if (context?.mode === 'create' && uuid && this.resourceName === 'servers') {
      await this.openInstallCommand(item ?? {});
    }
  }

  private async fetchLookupOptions() {
    const needsSipTargets = this.resourceName === 'sip-targets';
    const [servers, domains, mediaServers, pabxAccounts, softswitchAccounts] = await Promise.all([
      this.webRtcApi.list('servers', { status: 1, limit: 5000 }, this.resourceScope),
      this.resourceName === 'sip-targets'
        ? this.webRtcApi.list('domains', { status: 1, limit: 5000 }, 'master')
        : this.webRtcApi.listRealtimeDomains({ limit: 5000, purpose: 'webrtc' }),
      this.webRtcApi.listMediaServers({ status: 1, limit: 5000 }),
      needsSipTargets ? this.webRtcApi.listPabxAccounts({ status: 1, limit: 5000 }) : Promise.resolve({ data: { items: [] } }),
      needsSipTargets ? this.webRtcApi.listSoftswitchAccounts({ status: 1, limit: 5000 }) : Promise.resolve({ data: { items: [] } }),
    ]);
    this.servers = this.toOptions(servers?.data?.items ?? [], 'RwsUUID', 'RwsName', 'RwsHostname');
    this.domains =
      this.resourceName === 'sip-targets'
        ? this.toOptions(domains?.data?.items ?? [], 'RwdUUID', 'RtdName', 'RwdUUID')
        : this.toOptions(domains?.data?.items ?? [], 'RtdUUID', 'RtdName', 'RtdPurpose');
    this.mediaServers = this.toOptions(mediaServers?.data?.items ?? [], 'RmsUUID', 'RmsName', 'RmsControlIP');
    this.pabxAccounts = this.toOptions(pabxAccounts?.data?.items ?? [], 'VpaUUID', 'VpaName', 'VpaID');
    this.softswitchAccounts = this.toOptions(softswitchAccounts?.data?.items ?? [], 'VssUUID', 'VssName', 'VssID');
  }

  private toOptions(rows: ConfigurableCrudRecord[], valueKey: string, labelKey: string, descriptionKey: string): ConfigurableCrudOption[] {
    return rows
      .map((row) => ({
        value: String(row[valueKey] ?? row[`VoipPabxAccount${valueKey}`] ?? row[`VoipSoftswitchAccount${valueKey}`] ?? ''),
        label: String(row[labelKey] ?? row[valueKey] ?? ''),
        description: String(row[descriptionKey] ?? ''),
        searchText: `${row[labelKey] ?? ''} ${row[descriptionKey] ?? ''} ${row[valueKey] ?? ''}`,
      }))
      .filter((option) => option.value);
  }

  private async confirmAndOpenInstallCommand(row: ConfigurableCrudRecord) {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Generate Install Command',
            message: `Generate a new install command for ${String(row['RwsName'] ?? '')}? The previous WebRTC runtime token will be replaced.`,
            confirmText: 'Generate command',
          },
        })
        .afterClosed(),
    );
    if (confirmed) await this.openInstallCommand(row);
  }

  private async openInstallCommand(row: ConfigurableCrudRecord) {
    try {
      const response = await this.webRtcApi.generateInstallCommand(String(row['RwsUUID'] ?? ''));
      const token = response?.data ?? {};
      const data: InstallCommandDialogData = {
        title: 'WebRTC install command',
        description: 'Run this command on the target WebRTC edge host.',
        warning: 'The runtime token is sensitive. Copy it only to the intended server.',
        command: this.installCommand(token),
        details: [
          { label: 'API base', value: window.location.origin, monospace: true },
          { label: 'Node UUID', value: token['nodeUUID'], monospace: true },
          { label: 'Public domain', value: token['publicDomain'], monospace: true },
          { label: 'Runtime', value: 'mnscloud-kamailio-webrtc', monospace: true },
        ],
      };
      this.dialog.open(InstallCommandDialogComponent, {
        panelClass: 'install-command-dialog-panel',
        data,
      });
      this.snack.success('WebRTC install command generated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to generate WebRTC install command.');
    }
  }

  private installCommand(token: ConfigurableCrudRecord) {
    const args = [
      `--api-base ${this.shellQuote(window.location.origin)}`,
      `--node-uuid ${this.shellQuote(String(token['nodeUUID'] ?? ''))}`,
      `--runtime-token ${this.shellQuote(String(token['runtimeToken'] ?? ''))}`,
    ];
    if (token['publicDomain']) {
      args.push(`--public-domain ${this.shellQuote(String(token['publicDomain']))}`);
    }
    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-kamailio-webrtc/.git ] && sudo git -C mnscloud-kamailio-webrtc pull || gh repo clone manaoscloud/mnscloud-kamailio-webrtc',
      `sudo bash /opt/mnscloud/mnscloud-kamailio-webrtc/scripts/install-kamailio-webrtc.sh ${args.join(' ')}`,
      'sudo bash /opt/mnscloud/mnscloud-kamailio-webrtc/scripts/validate-kamailio-webrtc.sh',
    ].join(' && ');
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}

@Component({
  selector: 'app-realtime-webrtc-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeWebRtcServersPage extends RealtimeWebRtcCrudPage {
  constructor() {
    super(WEBRTC_SERVER_CONFIG, 'servers', 'master');
  }
}

@Component({
  selector: 'app-realtime-webrtc-domains-master',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeWebRtcDomainsMasterPage extends RealtimeWebRtcCrudPage {
  constructor() {
    super(webRtcDomainConfig('system/realtime/webrtc/domains'), 'domains', 'master');
  }
}

@Component({
  selector: 'app-realtime-webrtc-domains-tenant',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeWebRtcDomainsTenantPage extends RealtimeWebRtcCrudPage {
  constructor() {
    super(webRtcDomainConfig('realtime/webrtc/domains'), 'domains', 'tenant');
  }
}

@Component({
  selector: 'app-realtime-webrtc-parameters',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeWebRtcParametersPage extends RealtimeWebRtcCrudPage {
  constructor() {
    super(WEBRTC_PARAMETER_CONFIG, 'parameters', 'master');
  }
}

@Component({
  selector: 'app-realtime-webrtc-sip-targets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeWebRtcSipTargetsPage extends RealtimeWebRtcCrudPage {
  constructor() {
    super(WEBRTC_SIP_TARGET_CONFIG, 'sip-targets', 'master');
  }
}
