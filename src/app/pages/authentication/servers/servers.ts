import { resolveApiBaseUrl } from '../../../shared/runtime/app-runtime-config';
import { authenticationPayload, AUTHENTICATION_BOOLEAN_OPTIONS } from '../authentication-input';
import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
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

const config = defineCrud({
  endpoint: 'system/authentication/servers',
  uuidField: 'AtsUUID',
  pageTitle: 'authentication.servers',
  pageDescription: 'authentication.serverSetupDescription',
  dialogDescription: 'authentication.serverSetupDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AtsRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    authLog: 0,
    revision: 1,
    AuthenticationClusterAtcUUID: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  rowActions: [
    {
      key: 'rotate',
      label: 'authentication.rotateCredentials',
      icon: 'key',
      visible: (row) => row['AtsProvisioningState'] === 'operational',
      request: {
        method: 'post',
        endpoint: (row) => `system/authentication/servers/${row['AtsUUID']}/rotate`,
        body: () => ({ confirm: true }),
        successMessage: 'authentication.lifecycleAccepted',
        confirm: {
          title: 'authentication.rotateCredentials',
          message: 'authentication.rotateConfirmation',
        },
      },
    },
    {
      key: 'uninstall',
      label: 'authentication.uninstall',
      icon: 'power_settings_new',
      visible: (row) => ['operational', 'failed'].includes(String(row['AtsProvisioningState'])),
      request: {
        method: 'post',
        endpoint: (row) => `system/authentication/servers/${row['AtsUUID']}/uninstall`,
        body: () => ({ confirm: true }),
        successMessage: 'authentication.lifecycleAccepted',
        confirm: {
          title: 'authentication.uninstall',
          message: 'authentication.uninstallConfirmation',
        },
      },
    },

    {
      key: 'install',
      label: 'authentication.install',
      icon: 'terminal',
      visible: (row) =>
        ['awaiting_installation', 'uninstalled'].includes(String(row['AtsProvisioningState'])),
    },
    {
      // A running installation can always show its resume command again (it carries no secret).
      key: 'resume',
      label: 'authentication.resumeCommand',
      icon: 'terminal',
      visible: (row) =>
        ['provisioning', 'installing'].includes(String(row['AtsProvisioningState'])) &&
        Boolean(row['InstallationReleaseTag']),
    },
    {
      key: 'retry',
      label: 'authentication.retryInstallation',
      icon: 'refresh',
      visible: (row) => row['AtsProvisioningState'] === 'failed',
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'AtsStatus',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'AtsName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'AtsRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'authLog',
      source: 'AtsAuthLog',
      label: 'authentication.authLog',
      type: 'select',
      options: AUTHENTICATION_BOOLEAN_OPTIONS,
      span: 1,
      help: 'authentication.authLogHelp',
    },
    {
      key: 'AuthenticationClusterAtcUUID',
      source: 'AuthenticationClusterAtcUUID',
      label: 'authentication.clusters',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'system/authentication/clusters',
        uuidField: 'AtcUUID',
        labelField: 'AtcName',
      },
      disabledWhen: ({ editing }) => editing,
      help: 'authentication.scopeHelp',
    },
    {
      hiddenWhen: ({ editing }) => !editing,
      key: 'notes',
      source: 'AtsNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'AtsName', label: 'Name', kind: 'identity' },
    {
      id: 'provisioning',
      field: 'AtsProvisioningState',
      label: 'authentication.installationState',
      kind: 'text',
      value: (row, translate) =>
        translate(
          'authentication.states.' + String(row['AtsProvisioningState'] ?? 'awaiting_installation'),
        ),
    },

    {
      id: 'host',
      field: 'AtsHost',
      label: 'authentication.host',
      kind: 'identity',
      detail: (row) => {
        const raw = row['AtsObservedJson'];
        try {
          const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return o
            ? [o.operatingSystem, o.architecture, o.listenAddress, o.version]
                .filter(Boolean)
                .join(' · ')
            : '';
        } catch {
          return '';
        }
      },
    },
    { id: 'error', field: 'AtsLastErrorCode', label: 'authentication.lastError', kind: 'text' },
    {
      id: 'cluster',
      label: 'authentication.clusters',
      kind: 'related',
      field: 'ClusterName',
      uuidField: 'AuthenticationClusterAtcUUID',
    },
    { id: 'status', field: 'AtsStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationServerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
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
      return this.showResumeCommand(String(row['AtsUUID']), row['InstallationReleaseTag']);
    }
    if (action.key !== 'install') return super.handleRowAction(action, row);
    const confirmed = await confirmInstallCommandGeneration(
      this.installDialog,
      (key, params) => this.t(key, params),
      String(row['AtsName'] ?? ''),
      'authentication',
    );
    if (confirmed) await this.showInstaller(String(row['AtsUUID']));
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const response = context.response as { data?: ConfigurableCrudRecord };
    if (response.data?.['AtsUUID']) await this.showInstaller(String(response.data['AtsUUID']));
  }

  /** Resumes a failed installation on the latest approved release and shows the resume command. */
  private async retryInstallation(row: ConfigurableCrudRecord): Promise<void> {
    const confirmed = await this.confirmAction(
      'authentication.retryInstallation',
      'authentication.retryConfirmation',
      'authentication.retryInstallation',
    );
    if (!confirmed) return;
    const uuid = String(row['AtsUUID']);
    try {
      const response = await this.api.post<{ data: Record<string, unknown> }>(
        `${config.endpoint}/${uuid}/retry-installation`,
        {},
      );
      this.snack.success(this.t('authentication.retryAccepted'));
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
        title: 'authentication.resumeCommand',
        description: 'authentication.installDescription',
        warning: 'authentication.resumeWarning',
        details: [
          { label: 'API base', value: apiBase, monospace: true },
          { label: 'authentication.serverUuid', value: uuid, monospace: true },
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
          title: 'authentication.install',
          description: 'authentication.installDescription',
          warning: 'authentication.installWarning',
          details: [
            { label: 'API base', value: apiBase, monospace: true },
            { label: 'authentication.serverUuid', value: uuid, monospace: true },
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
function installCommand(apiBase: string, uuid: string, data: Record<string, unknown>): string {
  const quote = (value: unknown) => "'" + String(value).replaceAll("'", "'\\''") + "'";
  const repo = 'mnscloud-authentication';
  const root = `/opt/mnscloud/${repo}`;
  return [
    'sudo install -d -m 0755 /opt/mnscloud',
    'cd /opt/mnscloud',
    `([ -d ${repo}/.git ] || sudo git clone https://github.com/manaoscloud/${repo}.git)`,
    `sudo git -C ${repo} fetch --tags --force origin`,
    // The pinned release; the installer also verifies the commit approved by the API.
    `sudo git -C ${repo} checkout --detach ${quote(data['ref'])}`,
    `sudo bash ${root}/scripts/install-authentication.sh --api-base ${quote(apiBase)} --server-uuid ${quote(uuid)}` +
      (data['installationToken']
        ? ` --installation-token ${quote(data['installationToken'])}`
        : ''),
    `sudo bash ${root}/scripts/validate-authentication.sh`,
  ].join(' && ');
}
