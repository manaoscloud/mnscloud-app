import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openInstallCommandDialog } from '../../../shared/install-command-dialog/open-install-command-dialog';
import {
  confirmInstallCommandGeneration,
  requestRuntimeInstallCommand,
} from '../../../shared/install-command-dialog/runtime-install-token';
import { optionColumn } from '../network-options';

/**
 * Rede › Gateways (master, `/system/network/access-gateways`): platform inventory of the
 * `mnscloud-access-gateway` runtime that opens Network device consoles from dedicated hosts
 * (`/system/access-gateways`, platform.access.gateways.manage). Platform rows only.
 */

const ENDPOINT = 'system/access-gateways';

function enumOptions(prefix: string, values: readonly string[]): readonly ConfigurableCrudOption[] {
  return values.map((value) => ({ value, label: `${prefix}.${value}` }));
}

export const GATEWAY_STATUS_OPTIONS = enumOptions('network.accessGateways.status', [
  'active',
  'draining',
  'disabled',
]);
export const GATEWAY_ENVIRONMENT_OPTIONS = enumOptions('network.accessGateways.environment', [
  'development',
  'production',
]);
export const GATEWAY_PROVISIONING_OPTIONS = enumOptions('network.accessGateways.provisioning', [
  'awaiting_installation',
  'installing',
  'operational',
  'failed',
]);

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function integer(value: unknown): number | null {
  const normalized = String(value ?? '').trim();
  return normalized ? Number(normalized) : null;
}

/** Create sends key and environment (immutable); update sends the revision and the rest. */
export function accessGatewayPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const common = {
    name: text(values['name']),
    egressIpv4: text(values['egressIpv4']),
    relayPort: integer(values['relayPort']),
    capacity: integer(values['capacity']),
    notes: text(values['notes']),
  };
  if (editing) return { revision: String(values['revision'] ?? ''), ...common };
  return { key: text(values['key']), environment: text(values['environment']), ...common };
}

function statusAction(
  key: string,
  status: 'active' | 'draining' | 'disabled',
  icon: string,
  visible: (row: ConfigurableCrudRecord) => boolean,
): ConfigurableCrudRowAction {
  return {
    key,
    label: `network.accessGateways.${key}`,
    icon,
    visible,
    request: {
      method: 'post',
      endpoint: (row) => `${ENDPOINT}/${String(row['AgwUUID'])}/status`,
      body: (row) => ({ status, revision: String(row['AgwRevision'] ?? '') }),
      successMessage: 'network.accessGateways.statusChanged',
      confirm: {
        title: `network.accessGateways.${key}`,
        message: `network.accessGateways.${key}Message`,
        confirmLabel: `network.accessGateways.${key}`,
      },
    },
  };
}

const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'AgwUUID',
  pageTitle: 'network.accessGateways.title',
  pageDescription: 'network.accessGateways.description',
  dialogDescription: 'network.accessGateways.dialogDescription',
  createTitle: 'network.accessGateways.new',
  editTitle: 'network.accessGateways.edit',
  searchPlaceholder: 'network.accessGateways.search',
  emptyLabel: 'network.accessGateways.empty',
  savedMessage: 'network.accessGateways.saved',
  deletedMessage: 'network.accessGateways.deleted',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and is refused while connections are open.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: String(row['AgwRevision'] ?? '') }),
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'disabled',
  statusOptions: GATEWAY_STATUS_OPTIONS,
  activeStatusValues: ['active', 'draining'],
  initialStatus: '',
  initialValues: {
    name: '',
    key: '',
    environment: 'development',
    egressIpv4: '',
    relayPort: 7443,
    capacity: 50,
    notes: '',
    revision: '',
  },
  payload: (values, editing) => accessGatewayPayload(values, editing),
  fields: [
    {
      key: 'name',
      source: 'AgwName',
      label: 'Name',
      required: true,
      span: 1,
      placeholder: 'network.accessGateways.namePlaceholder',
    },
    {
      key: 'key',
      source: 'AgwKey',
      label: 'network.accessGateways.key',
      required: true,
      span: 1,
      placeholder: 'network.accessGateways.keyPlaceholder',
      help: 'network.accessGateways.keyHelp',
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'environment',
      source: 'AgwEnvironment',
      label: 'network.accessGateways.environmentLabel',
      type: 'select',
      options: GATEWAY_ENVIRONMENT_OPTIONS,
      translateOptions: true,
      required: true,
      span: 1,
      help: 'network.accessGateways.environmentHelp',
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'egressIpv4',
      source: 'AgwEgressIpv4',
      label: 'network.accessGateways.egressIpv4',
      span: 1,
      placeholder: 'network.accessGateways.egressPlaceholder',
      help: 'network.accessGateways.egressHelp',
    },
    {
      key: 'relayPort',
      source: 'AgwRelayPort',
      label: 'network.accessGateways.relayPort',
      type: 'number',
      span: 1,
      help: 'network.accessGateways.relayPortHelp',
    },
    {
      key: 'capacity',
      source: 'AgwCapacity',
      label: 'network.accessGateways.capacity',
      type: 'number',
      span: 1,
      help: 'network.accessGateways.capacityHelp',
    },
    { key: 'revision', source: 'AgwRevision', label: 'Revision', hidden: true },
    {
      key: 'notes',
      source: 'AgwNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    {
      id: 'name',
      label: 'Name',
      field: 'AgwName',
      kind: 'identity',
      uuidField: 'AgwUUID',
      detail: (row) => String(row['AgwKey'] ?? ''),
    },
    optionColumn(
      {
        id: 'environment',
        label: 'network.accessGateways.environmentLabel',
        field: 'AgwEnvironment',
      },
      GATEWAY_ENVIRONMENT_OPTIONS,
    ),
    optionColumn(
      {
        id: 'provisioning',
        label: 'network.accessGateways.provisioningLabel',
        field: 'AgwProvisioningState',
      },
      GATEWAY_PROVISIONING_OPTIONS,
    ),
    {
      id: 'agent',
      label: 'Agent',
      field: 'MonitoringAgentName',
      kind: 'identity',
      detail: (row) => String(row['AgwHost'] ?? ''),
    },
    { id: 'egress', label: 'network.accessGateways.egressIpv4', field: 'AgwEgressIpv4' },
    {
      id: 'relay',
      label: 'network.accessGateways.relay',
      field: 'AgwRelayAddress',
      optional: true,
      value: (row) =>
        row['AgwRelayAddress']
          ? `${String(row['AgwRelayAddress'])}:${String(row['AgwRelayPort'] ?? '')}`
          : '',
    },
    {
      id: 'online',
      label: 'network.accessGateways.online',
      field: 'Online',
      kind: 'status',
      options: [
        { value: 1, label: 'network.accessGateways.onlineYes' },
        { value: 0, label: 'network.accessGateways.onlineNo' },
      ],
      chipClass: (value) => (Number(value) === 1 ? 'chip-success' : 'chip-failed'),
    },
    {
      id: 'connections',
      label: 'network.accessGateways.connections',
      field: 'OpenConnections',
      value: (row) => `${Number(row['OpenConnections'] ?? 0)} / ${Number(row['AgwCapacity'] ?? 0)}`,
    },
    {
      id: 'connectors',
      label: 'network.accessGateways.connectors',
      field: 'AttachedConnectors',
      kind: 'number',
    },
    { id: 'version', label: 'Version', field: 'AgwRuntimeVersion', optional: true },
    {
      id: 'heartbeat',
      label: 'network.accessGateways.heartbeat',
      field: 'AgwHeartbeatAt',
      kind: 'datetime',
      optional: true,
    },
    {
      id: 'error',
      label: 'network.accessGateways.lastError',
      field: 'AgwLastErrorCode',
      optional: true,
    },
    {
      id: 'status',
      label: 'Status',
      field: 'AgwStatus',
      kind: 'status',
      options: GATEWAY_STATUS_OPTIONS,
      chipClass: (value) =>
        value === 'active'
          ? 'chip-success'
          : value === 'draining'
            ? 'chip-warning'
            : 'chip-skipped',
    },
  ],
  rowActions: [
    {
      key: 'install',
      label: 'network.accessGateways.install',
      icon: 'terminal',
      visible: (row) => row['AgwProvisioningState'] === 'awaiting_installation',
    },
    {
      key: 'retry',
      label: 'network.accessGateways.retry',
      icon: 'refresh',
      visible: (row) => row['AgwProvisioningState'] === 'failed',
    },
    statusAction('activate', 'active', 'play_arrow', (row) => row['AgwStatus'] !== 'active'),
    statusAction('drain', 'draining', 'pause', (row) => row['AgwStatus'] === 'active'),
    statusAction('disable', 'disabled', 'block', (row) => row['AgwStatus'] !== 'disabled'),
  ],
});

@Component({
  selector: 'app-network-access-gateways',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class NetworkAccessGatewaysPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'retry') return this.retryInstallation(row);
    if (action.key !== 'install') return super.handleRowAction(action, row);
    const confirmed = await confirmInstallCommandGeneration(
      this.dialog,
      (key, params) => this.t(key, params),
      String(row['AgwName'] ?? ''),
      'access gateway',
    );
    if (confirmed) await this.showInstaller(row);
  }

  /** The first command is shown right after create (app.md Install Command Dialog Baseline). */
  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const created = (context.response as { data?: ConfigurableCrudRecord })?.data;
    if (created?.['AgwUUID']) await this.showInstaller(created);
  }

  private async showInstaller(row: ConfigurableCrudRecord): Promise<void> {
    const uuid = String(row['AgwUUID']);
    try {
      const response = await requestRuntimeInstallCommand(this.dialog, (body) =>
        this.api.post<{ data: Record<string, unknown> }>(`${ENDPOINT}/${uuid}/installation`, body),
      );
      if (!response) return;
      const data = response.data;
      openInstallCommandDialog(
        this.dialog,
        {
          title: 'network.accessGateways.install',
          description: 'network.accessGateways.installDescription',
          warning: 'network.accessGateways.installWarning',
          details: [
            { label: 'network.accessGateways.key', value: row['AgwKey'], monospace: true },
            { label: 'Version', value: data['ref'], monospace: true },
            { label: 'Expires at', value: data['expiresAt'], monospace: true },
          ],
          command: String(data['command'] ?? ''),
        },
        this.destroyRef,
      );
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  /** Resumes a failed installation on the latest approved release (no new token). */
  private async retryInstallation(row: ConfigurableCrudRecord): Promise<void> {
    const confirmed = await this.confirmAction(
      'network.accessGateways.retry',
      'network.accessGateways.retryMessage',
      'network.accessGateways.retry',
    );
    if (!confirmed) return;
    const uuid = String(row['AgwUUID']);
    try {
      const response = await this.api.post<{ data: Record<string, unknown> }>(
        `${ENDPOINT}/${uuid}/installation/retry`,
        {},
      );
      const data = response.data;
      this.refreshList();
      openInstallCommandDialog(
        this.dialog,
        {
          title: 'network.accessGateways.resumeCommand',
          description: 'network.accessGateways.installDescription',
          warning: 'network.accessGateways.resumeWarning',
          details: [
            { label: 'network.accessGateways.key', value: row['AgwKey'], monospace: true },
            { label: 'Version', value: data['ref'], monospace: true },
          ],
          command: String(data['resumeCommand'] ?? ''),
        },
        this.destroyRef,
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
