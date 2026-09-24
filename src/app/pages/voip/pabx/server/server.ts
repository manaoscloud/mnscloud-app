import {
  requestRuntimeInstallCommand,
  runtimeInstallTokenWarning,
} from '../../../../shared/install-command-dialog/runtime-install-token';
import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudListParams,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';
import { InstallCommandDialogComponent } from '../../../../shared/install-command-dialog/install-command-dialog';

type ServerRecord = ConfigurableCrudRecord & {
  VpsUUID: string;
  VpsName?: string | null;
  VpsEngine?: string | null;
  VpsControlHost?: string | null;
  VpsControlPort?: number | null;
  VpsControlUsername?: string | null;
  VpsControlSecretSet?: number | boolean | null;
  VpsRemoteCommandExecutor?: string | null;
  VpsControlTarget?: string;
};

const statusOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const engineOptions: readonly ConfigurableCrudOption[] = [
  { value: 'freeswitch', label: 'FreeSWITCH' },
  { value: 'asterisk', label: 'Asterisk' },
];

const remoteCommandExecutorOptions: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Tenant default' },
  { value: 'agent', label: 'Agent' },
  { value: 'esl_ami', label: 'ESL/AMI' },
];

const codecOptions: readonly ConfigurableCrudOption[] = [
  'PCMU',
  'PCMA',
  'G729',
  'G722',
  'OPUS',
  'GSM',
  'AMR',
  'AMR-WB',
  'ILBC',
  'SPEEX',
  'TELEPHONE-EVENT',
].map((codec) => ({ value: codec, label: codec }));

const DEFAULT_ALLOWED_CODECS = ['PCMU', 'PCMA', 'G729', 'G722', 'OPUS'];

const validateControlAction: ConfigurableCrudRowAction = {
  key: 'validate-control',
  label: 'Validate remote control',
  tooltip: 'Validate remote control',
  icon: 'network_check',
};

const installCommandAction: ConfigurableCrudRowAction = {
  key: 'install-command',
  label: 'Generate install command',
  tooltip: 'Generate install command',
  icon: 'terminal',
};

const config: ConfigurableCrudConfig = {
  endpoint: 'system/voip/pabx/servers',
  uuidField: 'VpsUUID',
  pageTitle: 'PABX Servers',
  pageDescription: 'Register PABX platform servers used by tenant domains and routing.',
  createTitle: 'New PABX server',
  editTitle: 'Edit PABX server',
  dialogDescription: 'Configure the platform server identity used by PABX provisioning.',
  searchPlaceholder: 'Name, hostname, IP',
  emptyLabel: 'No PABX servers found.',
  deleteTitle: 'Delete PABX server',
  deleteMessage: 'Delete this server? This action will disable the server record.',
  deleteSelectedTitle: 'Delete selected PABX servers',
  deleteSelectedMessage: 'Delete {count} selected PABX servers?',
  savedMessage: 'PABX server saved successfully.',
  deletedMessage: 'PABX server deleted successfully.',
  deleteFailedMessage: 'Failed to delete PABX server.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions,
  bulkDelete: true,
  statusFilter: true,
  rowActions: [validateControlAction, installCommandAction],
  tabLabels: {
    network: 'Network',
    authentication: 'Control',
    codecs: 'Codecs',
    notes: 'Notes',
  },
  initialValues: {
    status: 1,
    engine: 'freeswitch',
    name: '',
    nodeUUID: '',
    hostname: '',
    publicIPv4: '',
    publicIPv6: '',
    privateIPv4: '',
    privateIPv6: '',
    baseUrl: '',
    remoteCommandExecutor: '',
    controlHost: '',
    controlPort: null,
    controlUsername: '',
    controlSecret: '',
    controlAllowedIps: '',
    allowedCodecs: [...DEFAULT_ALLOWED_CODECS],
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VpsName', uuidField: 'VpsUUID' },
    { id: 'hostname', label: 'Hostname', kind: 'text', field: 'VpsHostname' },
    {
      id: 'publicIPs',
      label: 'SIP public IPs',
      kind: 'identity',
      field: 'VpsPublicIPv4',
      uuidField: 'VpsPublicIPv6',
    },
    {
      id: 'advertisedIP',
      label: 'SIP advertised IP',
      kind: 'text',
      field: 'VpsAdvertisedIP',
    },
    {
      id: 'advertisedIPSource',
      label: 'Advertised IP source',
      kind: 'text',
      field: 'VpsAdvertisedIPSource',
      translateValue: true,
    },
    {
      id: 'privateIPs',
      label: 'Private listen IPs',
      kind: 'identity',
      field: 'VpsPrivateIPv4',
      uuidField: 'VpsPrivateIPv6',
    },
    { id: 'engine', label: 'Engine', kind: 'text', field: 'VpsEngine', translateValue: true },
    { id: 'control', label: 'Control', kind: 'text', field: 'VpsControlTarget' },
    {
      id: 'controlReady',
      label: 'Control secret',
      kind: 'boolean',
      field: 'VpsControlSecretSet',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'VpsStatus' },
    { id: 'lastSeen', label: 'Last Seen', kind: 'datetime', field: 'VpsLastSeenAt' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VpsStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'engine',
      source: 'VpsEngine',
      payloadKey: 'engine',
      label: 'Engine',
      type: 'select',
      options: engineOptions,
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'VpsName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 1,
    },
    {
      key: 'nodeUUID',
      source: 'VpsNodeUUID',
      payloadKey: 'nodeUUID',
      label: 'Node UUID',
      translateLabel: false,
      span: 1,
      hint: 'Used by Agent provisioning to bind this PABX server.',
    },
    {
      key: 'hostname',
      source: 'VpsHostname',
      payloadKey: 'hostname',
      label: 'Hostname',
      tab: 'network',
      span: 1,
    },
    {
      key: 'baseUrl',
      source: 'VpsBaseUrl',
      payloadKey: 'baseUrl',
      label: 'Base URL',
      tab: 'network',
      span: 1,
    },
    {
      key: 'publicIPv4',
      source: 'VpsPublicIPv4',
      payloadKey: 'publicIPv4',
      label: 'Public IPv4 (SIP/NAT)',
      tab: 'network',
      span: 1,
      breakBefore: true,
      hint: 'Used first for SIP advertise and NAT rewriting when present.',
    },
    {
      key: 'privateIPv4',
      source: 'VpsPrivateIPv4',
      payloadKey: 'privateIPv4',
      label: 'Private IPv4 (listen)',
      tab: 'network',
      span: 1,
    },
    {
      key: 'publicIPv6',
      source: 'VpsPublicIPv6',
      payloadKey: 'publicIPv6',
      label: 'Public IPv6 (SIP/NAT)',
      tab: 'network',
      span: 1,
    },
    {
      key: 'privateIPv6',
      source: 'VpsPrivateIPv6',
      payloadKey: 'privateIPv6',
      label: 'Private IPv6 (listen)',
      tab: 'network',
      span: 1,
    },
    {
      key: 'remoteCommandExecutor',
      source: 'VpsRemoteCommandExecutor',
      payloadKey: 'remoteCommandExecutor',
      label: 'Remote command executor',
      type: 'select',
      options: remoteCommandExecutorOptions,
      tab: 'authentication',
      span: 1,
      hint: 'Empty uses tenant, then master. Master fallback is Agent.',
    },
    {
      key: 'controlHost',
      source: 'VpsControlHost',
      payloadKey: 'controlHost',
      label: 'Control Host',
      tab: 'authentication',
      span: 1,
      breakBefore: true,
    },
    {
      key: 'controlPort',
      source: 'VpsControlPort',
      payloadKey: 'controlPort',
      label: 'Control Port',
      type: 'number',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'controlUsername',
      source: 'VpsControlUsername',
      payloadKey: 'controlUsername',
      label: 'Control Username',
      tab: 'authentication',
      span: 1,
      hint: 'Asterisk AMI uses a username. FreeSWITCH ESL can be left empty.',
    },
    {
      key: 'controlSecret',
      payloadKey: 'controlSecret',
      label: 'Control Secret',
      type: 'password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'new-password',
      hintWhen: ({ editing, values }) =>
        editing && values['VpsControlSecretSet']
          ? 'Password already saved. Fill in only to change it.'
          : 'No password saved yet.',
    },
    {
      key: 'controlAllowedIps',
      source: 'VpsControlAllowedIps',
      payloadKey: 'controlAllowedIps',
      label: 'Allowed IPs',
      tab: 'authentication',
      span: 4,
      hint: 'Comma-separated list. E.g.: 168.0.230.247/32',
    },
    {
      key: 'allowedCodecs',
      source: 'VpsAllowedCodecs',
      payloadKey: 'allowedCodecs',
      label: 'Allowed codecs',
      type: 'multi-select',
      options: codecOptions,
      translateOptions: false,
      tab: 'codecs',
      span: 1,
      fromRecord: (value) => codecList(value),
    },
    {
      key: 'notes',
      source: 'VpsNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
};

// This page does not extend the shared configurable CRUD base: PABX server management needs
// engine-specific tabs (Control/Codecs) plus resource-specific actions (install-command
// generation, remote-control validation, per-row control diagnostics) that fall outside the
// generic directory-resource contract in app.md.
@Component({
  selector: 'app-voip-pabx-server',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxServerPage extends ConfigurableCrudPageBase<ServerRecord> {
  private readonly installDialog = inject(MatDialog);

  constructor() {
    super(config);
  }

  override booleanLabel(value: unknown): string {
    return this.isTruthyValue(value) ? 'Configured' : 'Pending';
  }

  override rowActions(row: ServerRecord): readonly ConfigurableCrudRowAction[] {
    return canValidateControl(row)
      ? [validateControlAction, installCommandAction]
      : [installCommandAction];
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ServerRecord,
  ): Promise<void> {
    if (action.key === 'validate-control') {
      await this.validateControl(row);
    } else if (action.key === 'install-command') {
      await this.openGeneratedInstallCommand(row.VpsUUID, true);
    }
  }

  protected override async fetchItems(
    filters: ConfigurableCrudFilters | ConfigurableCrudListParams,
  ): Promise<ServerRecord[]> {
    const rows = (await super.fetchItems(filters)) as ServerRecord[];
    return rows.map((row) => ({ ...row, VpsControlTarget: controlTarget(row) }));
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      status: Number(payload['status']),
      controlPort: payload['controlPort'] ? Number(payload['controlPort']) : null,
      allowedCodecs: codecList(payload['allowedCodecs']),
    };
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ServerRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const created = extractRecord(context.response) as ServerRecord | null;
    if (created?.VpsUUID) await this.openGeneratedInstallCommand(created.VpsUUID, false);
  }

  private async validateControl(row: ServerRecord): Promise<void> {
    try {
      const response = await this.api.post<{ data?: { correlationID?: string } }>(
        `${config.endpoint}/${row.VpsUUID}/validate-control`,
        {},
      );
      const correlationID = response?.data?.correlationID;
      this.snack.success(
        correlationID
          ? this.t('Control validation queued. Correlation: {correlationID}', { correlationID })
          : this.t('Control validation queued. Check Activity Logs for the result.'),
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  private async openGeneratedInstallCommand(uuid: string, showSuccess: boolean): Promise<void> {
    try {
      const response = await requestRuntimeInstallCommand(this.installDialog, (body) =>
        this.api.post<{ data?: Record<string, unknown> }>(
          `${config.endpoint}/${uuid}/install-command`,
          body,
        ),
      );
      if (!response) return;
      const data = response?.data ?? {};
      if (showSuccess) this.snack.success(this.t('PABX install command generated.'));
      const engine = String(data['engine'] || '').toLowerCase();
      const repo = engine === 'asterisk' ? 'mnscloud-asterisk' : 'mnscloud-freeswitch';
      const script = engine === 'asterisk' ? 'install-asterisk.sh' : 'install-freeswitch.sh';
      const validateScript =
        engine === 'asterisk' ? 'validate-asterisk.sh' : 'validate-freeswitch.sh';
      const apiBase = window.location.origin;
      const installLine = `sudo bash /opt/mnscloud/${repo}/scripts/${script} --api-base ${shellQuote(
        apiBase,
      )} --node-uuid ${shellQuote(String(data['nodeUUID'] || ''))} --runtime-token ${shellQuote(
        String(data['runtimeToken'] || ''),
      )}`;
      const postValidate = `[ -f /opt/mnscloud/${repo}/scripts/${validateScript} ] && sudo bash /opt/mnscloud/${repo}/scripts/${validateScript} || true`;
      const command = [
        'sudo install -d -m 0755 /opt/mnscloud',
        'cd /opt/mnscloud',
        `[ -d ${repo}/.git ] && sudo git -C ${repo} pull || sudo gh repo clone manaoscloud/${repo} || sudo git clone https://github.com/manaoscloud/${repo}.git ${repo}`,
        installLine,
        postValidate,
      ].join(' && ');

      openCrudComponentDialog(
        this.installDialog,
        InstallCommandDialogComponent,
        'install-command-dialog-panel',
        {
          data: {
            title: 'PABX server install command',
            description: 'Run this command on the target PABX server.',
            warning: runtimeInstallTokenWarning(
              data,
              'This runtime token is shown only once. Copy it only to the intended server.',
            ),
            details: [
              { label: 'API base', value: apiBase, monospace: true },
              { label: 'Node UUID', value: data['nodeUUID'], monospace: true },
              { label: 'Engine', value: engine || null, monospace: true },
              {
                label: 'Runtime',
                value: engine === 'asterisk' ? 'mnscloud-asterisk' : 'mnscloud-freeswitch',
                monospace: true,
              },
            ],
            command,
          },
        },
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}

function canValidateControl(row: ServerRecord): boolean {
  if (row.VpsRemoteCommandExecutor !== 'esl_ami') return true;
  if (!row.VpsControlSecretSet) return false;
  if (!controlTarget(row) || controlTarget(row) === '-') return false;
  if (row.VpsEngine === 'asterisk' && !row.VpsControlUsername) return false;
  return true;
}

function controlTarget(row: ServerRecord): string {
  const host = row.VpsControlHost || '';
  const port = row.VpsControlPort ? String(row.VpsControlPort) : '';
  return host && port ? `${host}:${port}` : host || port || '-';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function codecList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const text = String(value ?? '');
  const items = text
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return items.length ? [...new Set(items)] : [...DEFAULT_ALLOWED_CODECS];
}

function extractRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as { data?: unknown; item?: unknown; record?: unknown } | null | undefined;
  const candidates = [
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).item,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).record,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).data,
    value?.data,
    value?.item,
    value?.record,
  ];
  return candidates.find(isRecord) ?? null;
}

function isRecord(value: unknown): value is ConfigurableCrudRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
