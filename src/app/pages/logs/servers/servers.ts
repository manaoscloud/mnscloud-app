import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { resolveApiBaseUrl } from '../../../shared/runtime/app-runtime-config';
import { openInstallCommandDialog } from '../../../shared/install-command-dialog/open-install-command-dialog';
import {
  confirmInstallCommandGeneration,
  requestRuntimeInstallCommand,
} from '../../../shared/install-command-dialog/runtime-install-token';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { logsPayload } from '../logs-input';

const config = defineCrud({
  endpoint: 'system/logs/servers',
  uuidField: 'LgsUUID',
  pageTitle: 'logs.servers',
  pageDescription: 'logs.serverSetupDescription',
  dialogDescription: 'logs.serverSetupDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['LgsRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    // A server is activated by its verified installation, never by the form.
    status: 0,
    syslogUdpPort: 514,
    syslogTcpPort: 514,
    revision: 1,
    LogClusterLgcUUID: '',
  },
  payload: (values, editing) => logsPayload(values, editing),
  rowActions: [
    {
      key: 'install',
      label: 'logs.install',
      icon: 'terminal',
      visible: (row) =>
        ['awaiting_installation', 'uninstalled'].includes(String(row['LgsProvisioningState'])),
    },
    {
      // A running installation can show its resume command again (it carries no secret).
      key: 'resume',
      label: 'logs.resumeCommand',
      icon: 'terminal',
      visible: (row) =>
        row['LgsProvisioningState'] === 'installing' && Boolean(row['InstallationReleaseTag']),
    },
    {
      // Also for an installation stuck in installing (a host step was interrupted): it is re-pinned
      // to the latest approved release and the same host runs the resume command.
      key: 'retry',
      label: 'logs.retryInstallation',
      icon: 'refresh',
      visible: (row) => ['failed', 'installing'].includes(String(row['LgsProvisioningState'])),
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'LgsStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      help: 'logs.serverStatusHelp',
      hiddenWhen: ({ editing }) => !editing,
    },
    {
      key: 'LogClusterLgcUUID',
      source: 'LogClusterLgcUUID',
      label: 'logs.cluster',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'system/logs/clusters',
        uuidField: 'LgcUUID',
        labelField: 'LgcName',
      },
      disabledWhen: ({ editing }) => editing,
      help: 'logs.scopeHelp',
    },
    { key: 'name', source: 'LgsName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'LgsRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'syslogUdpPort',
      source: 'LgsSyslogUdpPort',
      label: 'logs.syslogUdpPort',
      type: 'number',
      span: 1,
      required: true,
      tab: 'network',
      help: 'logs.syslogPortHelp',
    },
    {
      key: 'syslogTcpPort',
      source: 'LgsSyslogTcpPort',
      label: 'logs.syslogTcpPort',
      type: 'number',
      span: 1,
      required: true,
      tab: 'network',
      help: 'logs.syslogPortHelp',
    },
    {
      hiddenWhen: ({ editing }) => !editing,
      key: 'notes',
      source: 'LgsNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  tabLabels: { network: 'logs.ingestTab' },
  columns: [
    { id: 'name', field: 'LgsName', label: 'Name', kind: 'identity' },
    {
      id: 'provisioning',
      field: 'LgsProvisioningState',
      label: 'logs.installationState',
      kind: 'text',
      value: (row, translate) =>
        translate('logs.states.' + String(row['LgsProvisioningState'] ?? 'awaiting_installation')),
    },
    {
      id: 'host',
      field: 'LgsHost',
      label: 'logs.host',
      kind: 'identity',
      detail: (row) => {
        const raw = row['LgsObservedJson'];
        try {
          const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return o
            ? [o.listenAddress, o.operatingSystem, o.architecture, o.version, o.storageVersion]
                .filter(Boolean)
                .join(' · ')
            : '';
        } catch {
          return '';
        }
      },
    },
    { id: 'error', field: 'LgsLastErrorCode', label: 'logs.lastError', kind: 'text' },
    {
      id: 'cluster',
      label: 'logs.cluster',
      kind: 'related',
      field: 'ClusterName',
      uuidField: 'LogClusterLgcUUID',
    },
    { id: 'status', field: 'LgsStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-logs-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LogsServerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly installDialog = inject(MatDialog);
  constructor() {
    super(config);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'retry') return this.retryInstallation(row);
    if (action.key === 'resume') {
      return this.showResumeCommand(String(row['LgsUUID']), row['InstallationReleaseTag']);
    }
    if (action.key !== 'install') return super.handleRowAction(action, row);
    const confirmed = await confirmInstallCommandGeneration(
      this.installDialog,
      (key, params) => this.t(key, params),
      String(row['LgsName'] ?? ''),
      'Logs',
    );
    if (confirmed) await this.showInstaller(String(row['LgsUUID']));
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const response = context.response as { data?: ConfigurableCrudRecord };
    if (response.data?.['LgsUUID']) await this.showInstaller(String(response.data['LgsUUID']));
  }

  /** Resumes a failed installation on the latest approved release and shows the resume command. */
  private async retryInstallation(row: ConfigurableCrudRecord): Promise<void> {
    const confirmed = await this.confirmAction(
      'logs.retryInstallation',
      'logs.retryConfirmation',
      'logs.retryInstallation',
    );
    if (!confirmed) return;
    const uuid = String(row['LgsUUID']);
    try {
      const response = await this.api.post<{ data: Record<string, unknown> }>(
        `${config.endpoint}/${uuid}/retry-installation`,
        {},
      );
      this.snack.success(this.t('logs.retryAccepted'));
      this.refreshList();
      this.showResumeCommand(uuid, response.data['ref']);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  private showResumeCommand(uuid: string, ref: unknown): void {
    const apiBase = resolveApiBaseUrl();
    openInstallCommandDialog(
      this.installDialog,
      {
        title: 'logs.resumeCommand',
        description: 'logs.installDescription',
        warning: 'logs.resumeWarning',
        details: [
          { label: 'API base', value: apiBase, monospace: true },
          { label: 'logs.serverUuid', value: uuid, monospace: true },
          { label: 'Version', value: ref, monospace: true },
        ],
        command: installCommand(apiBase, uuid, { ref }),
      },
      this.destroyRef,
    );
  }

  private async showInstaller(uuid: string): Promise<void> {
    try {
      const response = await requestRuntimeInstallCommand(this.installDialog, (body) =>
        this.api.post<{ data: Record<string, unknown> }>(
          `${config.endpoint}/${uuid}/install-command`,
          body,
        ),
      );
      if (!response) return;
      const data = response.data;
      const apiBase = resolveApiBaseUrl();
      openInstallCommandDialog(
        this.installDialog,
        {
          title: 'logs.install',
          description: 'logs.installDescription',
          warning: 'logs.installWarning',
          details: [
            { label: 'API base', value: apiBase, monospace: true },
            { label: 'logs.serverUuid', value: uuid, monospace: true },
            { label: 'Version', value: data['ref'], monospace: true },
            { label: 'Expires at', value: data['expiresAt'], monospace: true },
          ],
          command: installCommand(apiBase, uuid, data),
        },
        this.destroyRef,
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}

/**
 * Same one-line, `&&`-chained shape as the other runtime modules; ends with the module validator.
 * A resumed installation (after Retry) is already bound to the host, so it carries no token.
 */
export function installCommand(
  apiBase: string,
  uuid: string,
  data: Record<string, unknown>,
): string {
  const quote = (value: unknown) => "'" + String(value).replaceAll("'", "'\\''") + "'";
  const repo = 'mnscloud-logs';
  const root = `/opt/mnscloud/${repo}`;
  return [
    'sudo install -d -m 0755 /opt/mnscloud',
    'cd /opt/mnscloud',
    `([ -d ${repo}/.git ] || sudo git clone https://github.com/manaoscloud/${repo}.git)`,
    `sudo git -C ${repo} fetch --tags --force origin`,
    // The pinned release; the installer also verifies the commit approved by the API.
    `sudo git -C ${repo} checkout --detach ${quote(data['ref'])}`,
    `sudo bash ${root}/scripts/install-logs.sh --api-base ${quote(apiBase)} --server-uuid ${quote(uuid)}` +
      (data['installationToken']
        ? ` --installation-token ${quote(data['installationToken'])}`
        : ''),
    `sudo bash ${root}/scripts/validate-logs.sh`,
  ].join(' && ');
}
