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
import { confirmInstallCommandGeneration } from '../../../shared/install-command-dialog/runtime-install-token';
import { injectNetworkPermission, optionColumn } from '../network-options';

/**
 * Rede › Conectores (tenant, `/network/connectors`): runtimes the tenant installs inside its own
 * network. They open an outbound tunnel to an MNSCloud access gateway so consoles and access
 * tests reach private (LAN / CGNAT) devices. The install command is single use and never stored.
 */

const ENDPOINT = 'network/connectors';

function enumOptions(prefix: string, values: readonly string[]): readonly ConfigurableCrudOption[] {
  return values.map((value) => ({ value, label: `${prefix}.${value}` }));
}

export const CONNECTOR_STATUS_OPTIONS = enumOptions('network.connectors.status', [
  'active',
  'disabled',
]);
export const CONNECTOR_PROVISIONING_OPTIONS = enumOptions('network.connectors.provisioning', [
  'awaiting_installation',
  'operational',
  'failed',
]);

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

/** Allowed networks: one CIDR per entry, separated by comma, space or line break. */
export function parseAllowedCidrs(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** PUT replaces the fields: the whole form is sent with the revision. */
export function connectorPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const common = {
    name: text(values['name']),
    allowedCidrs: parseAllowedCidrs(values['allowedCidrs']),
    notes: text(values['notes']),
  };
  if (!editing) return common;
  return {
    ...common,
    status: values['status'] === 'disabled' ? 'disabled' : 'active',
    revision: String(values['revision'] ?? ''),
  };
}

const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'AcnUUID',
  pageTitle: 'network.connectors.title',
  pageDescription: 'network.connectors.description',
  dialogDescription: 'network.connectors.dialogDescription',
  createTitle: 'network.connectors.new',
  editTitle: 'network.connectors.edit',
  searchPlaceholder: 'network.connectors.search',
  emptyLabel: 'network.connectors.empty',
  savedMessage: 'network.connectors.saved',
  deletedMessage: 'network.connectors.deleted',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision; a connector used by devices is refused.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: String(row['AcnRevision'] ?? '') }),
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'disabled',
  statusOptions: CONNECTOR_STATUS_OPTIONS,
  initialStatus: '',
  initialValues: {
    status: 'active',
    name: '',
    allowedCidrs: '',
    notes: '',
    revision: '',
  },
  payload: (values, editing) => connectorPayload(values, editing),
  fields: [
    {
      key: 'name',
      source: 'AcnName',
      label: 'Name',
      required: true,
      span: 1,
      placeholder: 'network.connectors.namePlaceholder',
    },
    {
      key: 'allowedCidrs',
      source: 'AcnAllowedCidrs',
      label: 'network.connectors.allowedCidrs',
      type: 'textarea',
      span: 4,
      placeholder: 'network.connectors.allowedCidrsPlaceholder',
      help: 'network.connectors.allowedCidrsHelp',
      // The API returns a comma separated text or a list; the form edits one text.
      fromRecord: (value) =>
        Array.isArray(value)
          ? value.join(', ')
          : String(value ?? '')
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean)
              .join(', '),
    },
    { key: 'revision', source: 'AcnRevision', label: 'Revision', hidden: true },
    {
      key: 'notes',
      source: 'AcnNotes',
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
      field: 'AcnName',
      kind: 'identity',
      uuidField: 'AcnUUID',
      detail: (row) => String(row['AcnHost'] ?? ''),
    },
    optionColumn(
      {
        id: 'provisioning',
        label: 'network.connectors.provisioningLabel',
        field: 'AcnProvisioningState',
      },
      CONNECTOR_PROVISIONING_OPTIONS,
    ),
    {
      id: 'online',
      label: 'network.connectors.online',
      field: 'Online',
      kind: 'status',
      options: [
        { value: 1, label: 'network.connectors.onlineYes' },
        { value: 0, label: 'network.connectors.onlineNo' },
      ],
      chipClass: (value) => (Number(value) === 1 ? 'chip-success' : 'chip-failed'),
    },
    {
      id: 'gateway',
      label: 'network.connectors.gateway',
      field: 'AccessGatewayName',
      value: (row) => String(row['AccessGatewayName'] ?? row['AccessGatewayAgwUUID'] ?? ''),
    },
    {
      id: 'allowedCidrs',
      label: 'network.connectors.allowedCidrs',
      field: 'AcnAllowedCidrs',
      optional: true,
    },
    { id: 'version', label: 'Version', field: 'AcnRuntimeVersion', optional: true },
    {
      id: 'heartbeat',
      label: 'network.connectors.heartbeat',
      field: 'AcnHeartbeatAt',
      kind: 'datetime',
      optional: true,
    },
    {
      id: 'fingerprint',
      label: 'network.connectors.fingerprint',
      field: 'AcnPublicKeyFingerprint',
      optional: true,
    },
    { id: 'devices', label: 'network.devices', field: 'DeviceCount', kind: 'number' },
    {
      id: 'error',
      label: 'network.connectors.lastError',
      field: 'AcnLastErrorCode',
      optional: true,
    },
    {
      id: 'status',
      label: 'Status',
      field: 'AcnStatus',
      kind: 'status',
      options: CONNECTOR_STATUS_OPTIONS,
      chipClass: (value) => (value === 'active' ? 'chip-success' : 'chip-skipped'),
    },
  ],
  rowActions: [
    {
      key: 'install',
      label: 'network.connectors.install',
      icon: 'terminal',
      visible: (row) => row['AcnProvisioningState'] === 'awaiting_installation',
    },
    {
      key: 'reinstall',
      label: 'network.connectors.reinstall',
      icon: 'refresh',
      visible: (row) => row['AcnProvisioningState'] !== 'awaiting_installation',
    },
  ],
});

@Component({
  selector: 'app-network-connectors',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class NetworkConnectorsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const can = injectNetworkPermission(false);
    super({
      ...config,
      canCreate: can('tenant.network.connectors.create'),
      canEdit: can('tenant.network.connectors.update'),
      canDelete: can('tenant.network.connectors.delete'),
      rowActions: can('tenant.network.connectors.update') ? config.rowActions : [],
    });
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'install' && action.key !== 'reinstall') {
      return super.handleRowAction(action, row);
    }
    if (action.key === 'reinstall') {
      const confirmed = await confirmInstallCommandGeneration(
        this.dialog,
        (key, params) => this.t(key, params),
        String(row['AcnName'] ?? ''),
        'connector',
      );
      if (!confirmed) return;
    }
    await this.showInstaller(row);
  }

  /** The first command is shown right after create (app.md Install Command Dialog Baseline). */
  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const created = (context.response as { data?: ConfigurableCrudRecord })?.data;
    if (created?.['AcnUUID']) await this.showInstaller(created);
  }

  /** The command is shown once in the dialog and dropped with it: it is never stored. */
  private async showInstaller(row: ConfigurableCrudRecord): Promise<void> {
    const uuid = String(row['AcnUUID']);
    try {
      const response = await this.api.post<{ data: Record<string, unknown> }>(
        `${ENDPOINT}/${uuid}/installation`,
        {},
      );
      const data = response.data;
      openInstallCommandDialog(
        this.dialog,
        {
          title: 'network.connectors.install',
          description: 'network.connectors.installDescription',
          warning: 'network.connectors.installWarning',
          details: [
            { label: 'Name', value: row['AcnName'] ?? data['name'], monospace: true },
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
}
