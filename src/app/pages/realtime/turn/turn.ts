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
import { RealtimeTurnService } from './turn.service';

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
] as const;

const CERTIFICATE_PROVIDER_OPTIONS = [
  { value: 'letsencrypt', label: 'Let’s Encrypt' },
  { value: 'manual', label: 'Manual' },
  { value: 'self_signed', label: 'Self-signed' },
  { value: 'none', label: 'None' },
] as const;

const TURN_SERVER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/turn/servers',
  uuidField: 'RtsUUID',
  pageTitle: 'TURN/STUN Servers',
  pageDescription: 'Register dedicated coturn relay servers for realtime media traversal.',
  createTitle: 'New TURN/STUN server',
  editTitle: 'Edit TURN/STUN server',
  dialogDescription: 'Runtime identity, network and certificate settings for coturn edges.',
  searchPlaceholder: 'Search TURN/STUN servers',
  emptyLabel: 'No TURN/STUN servers found.',
  deleteTitle: 'Delete TURN/STUN server',
  deleteMessage: 'Delete this TURN/STUN server?',
  deleteSelectedTitle: 'Delete selected TURN/STUN servers',
  deleteSelectedMessage: 'Delete {count} selected TURN/STUN servers?',
  savedMessage: 'TURN/STUN server saved.',
  deletedMessage: 'TURN/STUN server deleted.',
  deleteFailedMessage: 'Failed to delete TURN/STUN server.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  initialValues: {
    status: 1,
    realtimeDomainUUID: '',
    name: '',
    nodeUUID: '',
    hostname: '',
    publicIP: '',
    privateIP: '',
    listeningIP: '0.0.0.0',
    externalIP: '',
    listeningPort: 3478,
    tlsListeningPort: 5349,
    minRelayPort: 49152,
    maxRelayPort: 65535,
    totalQuota: 1000,
    bpsCapacity: 0,
    certificateProvider: 'letsencrypt',
    tlsCertPath: '',
    tlsKeyPath: '',
    configJson: '{}',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'RtsName', uuidField: 'RtsUUID' },
    { id: 'domain', label: 'Primary Realm Domain', field: 'RtdName' },
    { id: 'externalIP', label: 'External IP', field: 'RtsExternalIP', copyable: true },
    { id: 'listeningPort', label: 'Listening Port', field: 'RtsListeningPort' },
    { id: 'tlsListeningPort', label: 'TLS Port', field: 'RtsTlsListeningPort' },
    { id: 'certificateProvider', label: 'Certificate', field: 'RtsCertificateProvider' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RtsStatus', className: 'status-col' },
    { id: 'lastSeen', label: 'Last Seen', field: 'RtsLastSeenAt', kind: 'datetime' },
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
    { key: 'status', source: 'RtsStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'realtimeDomainUUID', source: 'RealtimeDomainRtdUUID', payloadKey: 'realtimeDomainUUID', label: 'Primary Realm Domain', type: 'search-select', span: 1 },
    { key: 'name', source: 'RtsName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'nodeUUID', source: 'RtsNodeUUID', payloadKey: 'nodeUUID', label: 'Node UUID', tab: 'network', span: 1 },
    { key: 'hostname', source: 'RtsHostname', payloadKey: 'hostname', label: 'Hostname', tab: 'network', span: 1 },
    { key: 'publicIP', source: 'RtsPublicIP', payloadKey: 'publicIP', label: 'Public IP', tab: 'network', span: 1 },
    { key: 'privateIP', source: 'RtsPrivateIP', payloadKey: 'privateIP', label: 'Private IP', tab: 'network', span: 1 },
    { key: 'listeningIP', source: 'RtsListeningIP', payloadKey: 'listeningIP', label: 'Listening IP', tab: 'network', span: 1 },
    { key: 'externalIP', source: 'RtsExternalIP', payloadKey: 'externalIP', label: 'External IP', tab: 'network', span: 1 },
    { key: 'listeningPort', source: 'RtsListeningPort', payloadKey: 'listeningPort', label: 'Listening Port', type: 'number', tab: 'network', span: 1 },
    { key: 'tlsListeningPort', source: 'RtsTlsListeningPort', payloadKey: 'tlsListeningPort', label: 'TLS Listening Port', type: 'number', tab: 'network', span: 1 },
    { key: 'minRelayPort', source: 'RtsMinRelayPort', payloadKey: 'minRelayPort', label: 'Min Relay Port', type: 'number', tab: 'network', span: 1 },
    { key: 'maxRelayPort', source: 'RtsMaxRelayPort', payloadKey: 'maxRelayPort', label: 'Max Relay Port', type: 'number', tab: 'network', span: 1 },
    { key: 'totalQuota', source: 'RtsTotalQuota', payloadKey: 'totalQuota', label: 'Total Quota', type: 'number', tab: 'network', span: 1 },
    { key: 'bpsCapacity', source: 'RtsBpsCapacity', payloadKey: 'bpsCapacity', label: 'BPS Capacity', type: 'number', tab: 'network', span: 1 },
    { key: 'certificateProvider', source: 'RtsCertificateProvider', payloadKey: 'certificateProvider', label: 'Certificate Provider', type: 'select', options: CERTIFICATE_PROVIDER_OPTIONS, tab: 'authentication', span: 1 },
    { key: 'tlsCertPath', source: 'RtsTlsCertPath', payloadKey: 'tlsCertPath', label: 'TLS Cert Path', tab: 'authentication', span: 1 },
    { key: 'tlsKeyPath', source: 'RtsTlsKeyPath', payloadKey: 'tlsKeyPath', label: 'TLS Key Path', tab: 'authentication', span: 1 },
    { key: 'configJson', source: 'RtsConfig', payloadKey: 'config', label: 'Config JSON', type: 'textarea', format: 'json', tab: 'notes', span: 4, rows: 8 },
    { key: 'notes', source: 'RtsNotes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ],
};

const TURN_DOMAIN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/turn/domains',
  uuidField: 'RtnUUID',
  pageTitle: 'TURN/STUN Domains',
  pageDescription: 'Assign realtime TURN/STUN domains to managed coturn edge nodes.',
  createTitle: 'New TURN/STUN domain',
  editTitle: 'Edit TURN/STUN domain',
  dialogDescription: 'Bind a realtime domain to a TURN/STUN relay server.',
  searchPlaceholder: 'Search TURN/STUN domains',
  emptyLabel: 'No TURN/STUN domains found.',
  deleteTitle: 'Delete TURN/STUN domain',
  deleteMessage: 'Delete this TURN/STUN domain?',
  deleteSelectedTitle: 'Delete selected TURN/STUN domains',
  deleteSelectedMessage: 'Delete {count} selected TURN/STUN domains?',
  savedMessage: 'TURN/STUN domain saved.',
  deletedMessage: 'TURN/STUN domain deleted.',
  deleteFailedMessage: 'Failed to delete TURN/STUN domain.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  initialValues: {
    status: 1,
    serverUUID: '',
    realtimeDomainUUID: '',
    certificateProvider: 'letsencrypt',
    autoProvision: 1,
    tlsCertPath: '',
    tlsKeyPath: '',
    notes: '',
  },
  columns: [
    { id: 'domain', label: 'Realtime Domain', kind: 'identity', field: 'RtdName', uuidField: 'RealtimeDomainRtdUUID' },
    { id: 'server', label: 'Server', field: 'RtsName' },
    { id: 'certificateProvider', label: 'Certificate', field: 'RtnCertificateProvider' },
    { id: 'provisionStatus', label: 'Provision', field: 'RtnProvisionStatus' },
    { id: 'certificateStatus', label: 'TLS', field: 'RtnCertificateStatus' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RtnStatus', className: 'status-col' },
  ],
  rowActions: [
    {
      key: 'provision-domain',
      label: 'Provision domain',
      icon: 'cloud_sync',
      tooltip: 'Provision domain',
    },
  ],
  fields: [
    { key: 'status', source: 'RtnStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'serverUUID', source: 'RealtimeTurnServerRtsUUID', payloadKey: 'serverUUID', label: 'Server', type: 'search-select', required: true, span: 1 },
    { key: 'realtimeDomainUUID', source: 'RealtimeDomainRtdUUID', payloadKey: 'realtimeDomainUUID', label: 'Realtime Domain', type: 'search-select', required: true, span: 1 },
    { key: 'certificateProvider', source: 'RtnCertificateProvider', payloadKey: 'certificateProvider', label: 'Certificate Provider', type: 'select', options: CERTIFICATE_PROVIDER_OPTIONS, span: 1 },
    { key: 'autoProvision', source: 'RtnAutoProvision', payloadKey: 'autoProvision', label: 'Auto Provision', type: 'select', options: STATUS_OPTIONS, span: 1 },
    { key: 'tlsCertPath', source: 'RtnTlsCertPath', payloadKey: 'tlsCertPath', label: 'TLS Cert Path', tab: 'authentication', span: 1 },
    { key: 'tlsKeyPath', source: 'RtnTlsKeyPath', payloadKey: 'tlsKeyPath', label: 'TLS Key Path', tab: 'authentication', span: 1 },
    { key: 'notes', source: 'RtnNotes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ],
};

abstract class RealtimeTurnCrudPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly turnApi = inject(RealtimeTurnService);
  protected serverOptions: ConfigurableCrudOption[] = [];
  protected realtimeDomainOptions: ConfigurableCrudOption[] = [];

  protected constructor(config: ConfigurableCrudConfig) {
    super(config);
    void this.fetchLookupOptions();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.serverOptions;
    if (key === 'realtimeDomainUUID') return this.realtimeDomainOptions;
    return [];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'generate-install') {
      await this.confirmAndOpenInstallCommand(row);
      return;
    }
    if (action.key === 'provision-domain') {
      await this.turnApi.provisionDomain(String(row['RtnUUID'] ?? ''), 'master');
      this.snack.success('TURN/STUN domain provisioning queued.');
      this.refreshList();
    }
  }

  protected override async afterSave(context: { mode: 'create'; response: unknown } | any) {
    const item = context?.response?.data?.item as ConfigurableCrudRecord | undefined;
    const uuid = String(item?.['RtsUUID'] ?? '');
    if (context?.mode === 'create' && uuid && this.config.uuidField === 'RtsUUID') {
      await this.openInstallCommand(item ?? {});
    }
  }

  private async fetchLookupOptions() {
    const [servers, domains] = await Promise.all([
      this.turnApi.list('servers', { status: 1, limit: 5000 }, 'master'),
      this.turnApi.listRealtimeDomains({ purpose: 'turn', status: 1, limit: 5000 }, 'master'),
    ]);
    this.serverOptions = this.toOptions(servers?.data?.items ?? [], 'RtsUUID', 'RtsName', 'RtsHostname');
    this.realtimeDomainOptions = this.toOptions(domains?.data?.items ?? [], 'RtdUUID', 'RtdName', 'RtdPurpose');
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

  private async confirmAndOpenInstallCommand(row: ConfigurableCrudRecord) {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Generate Install Command',
            message: `Generate a new install command for ${String(row['RtsName'] ?? '')}? The previous TURN/STUN runtime token will be replaced.`,
            confirmText: 'Generate command',
          },
        })
        .afterClosed(),
    );
    if (confirmed) await this.openInstallCommand(row);
  }

  private async openInstallCommand(row: ConfigurableCrudRecord) {
    try {
      const response = await this.turnApi.generateInstallCommand(String(row['RtsUUID'] ?? ''));
      const token = response?.data ?? {};
      const data: InstallCommandDialogData = {
        title: 'TURN/STUN install command',
        description: 'Run this command on the target TURN/STUN edge host.',
        warning: 'The runtime token is sensitive. Copy it only to the intended server.',
        command: this.installCommand(token, row),
        details: [
          { label: 'API base', value: window.location.origin, monospace: true },
          { label: 'Node UUID', value: token['nodeUUID'], monospace: true },
          { label: 'Realm', value: token['realm'] || row['RtdName'] || row['DomainName'], monospace: true },
          { label: 'Runtime', value: 'mnscloud-turn', monospace: true },
        ],
      };
      this.dialog.open(InstallCommandDialogComponent, {
        panelClass: 'install-command-dialog-panel',
        data,
      });
      this.snack.success('TURN/STUN install command generated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to generate TURN/STUN install command.');
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
      '--realm',
      this.shellQuote(String(token['realm'] || row['RtdName'] || row['DomainName'] || '')),
      '--listening-ip',
      this.shellQuote(String(row['RtsListeningIP'] || '0.0.0.0')),
      '--listening-port',
      this.shellQuote(String(row['RtsListeningPort'] || '3478')),
      '--tls-listening-port',
      this.shellQuote(String(row['RtsTlsListeningPort'] || '5349')),
      '--min-relay-port',
      this.shellQuote(String(row['RtsMinRelayPort'] || '49152')),
      '--max-relay-port',
      this.shellQuote(String(row['RtsMaxRelayPort'] || '65535')),
    ];
    const externalIP = String(token['externalIP'] || row['RtsExternalIP'] || '').trim();
    if (externalIP) args.push('--external-ip', this.shellQuote(externalIP));
    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-turn/.git ] && sudo git -C mnscloud-turn pull || gh repo clone manaoscloud/mnscloud-turn',
      `sudo bash /opt/mnscloud/mnscloud-turn/scripts/install-turn.sh ${args.join(' ')}`,
      'sudo bash /opt/mnscloud/mnscloud-turn/scripts/validate-turn.sh',
    ].join(' && ');
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}

@Component({
  selector: 'app-realtime-turn-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeTurnServersPage extends RealtimeTurnCrudPage {
  constructor() {
    super(TURN_SERVER_CONFIG);
  }
}

@Component({
  selector: 'app-realtime-turn-domains',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeTurnDomainsPage extends RealtimeTurnCrudPage {
  constructor() {
    super(TURN_DOMAIN_CONFIG);
  }
}
