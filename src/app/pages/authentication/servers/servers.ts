import { resolveApiBaseUrl } from '../../../shared/runtime/app-runtime-config';
import { authenticationPayload } from '../authentication-input';
import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { openInstallCommandDialog } from '../../../shared/install-command-dialog/open-install-command-dialog';
import { firstValueFrom } from 'rxjs';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { isRuntimeTokenReplaceConfirmationRequired } from '../../../shared/install-command-dialog/runtime-install-token';
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
    status: 0,
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
      key: 'retry',
      label: 'authentication.retryInstallation',
      icon: 'refresh',
      visible: (row) => row['AtsProvisioningState'] === 'failed',
      request: {
        method: 'post',
        endpoint: (row) => `system/authentication/servers/${row['AtsUUID']}/retry-installation`,
        body: () => ({}),
        successMessage: 'authentication.retryAccepted',
        confirm: {
          title: 'authentication.retryInstallation',
          message: 'authentication.retryConfirmation',
        },
      },
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'AtsStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      hiddenWhen: ({ editing }) => !editing,
    },
    { key: 'name', source: 'AtsName', label: 'Name', required: true, span: 2 },
    { key: 'revision', source: 'AtsRevision', label: 'Revision', type: 'number', hidden: true },
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
      field: 'AuthenticationClusterAtcUUID',
      label: 'authentication.clusters',
      kind: 'related',
      lookupKey: 'AuthenticationClusterAtcUUID',
    },
    { id: 'name', field: 'AtsName', label: 'Name', kind: 'identity' },
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
    if (action.key !== 'install') return super.handleRowAction(action, row);
    if (await this.confirmInstallation('authentication.generateConfirmation')) {
      await this.showInstaller(String(row['AtsUUID']));
    }
  }

  private async confirmInstallation(message: string): Promise<boolean> {
    const ref = this.installDialog.open(SlowConfirmDialogComponent, {
      data: {
        translate: true,
        title: 'authentication.install',
        message,
        confirmLabel: 'Generate command',
      },
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const response = context.response as { data?: ConfigurableCrudRecord };
    if (response.data?.['AtsUUID']) await this.showInstaller(String(response.data['AtsUUID']));
  }

  private async showInstaller(uuid: string): Promise<void> {
    try {
      const request = (body: { confirmReplace?: boolean }) =>
        this.api.post<{ data: Record<string, unknown> }>(
          `${config.endpoint}/${uuid}/install-command`,
          body,
        );
      let response;
      try {
        response = await request({});
      } catch (error) {
        if (!isRuntimeTokenReplaceConfirmationRequired(error)) throw error;
        if (!(await this.confirmInstallation('authentication.replaceConfirmation'))) return;
        response = await request({ confirmReplace: true });
      }
      const data = response.data;
      const quote = (value: unknown) => "'" + String(value).replaceAll("'", "'\\''") + "'";
      const root = '/opt/mnscloud/mnscloud-authentication';
      // A subshell keeps `set -eu` from closing the operator's interactive root shell on failure.
      const command = [
        '(',
        'set -eu',
        'sudo bash /opt/mnscloud/mnscloud-agent/scripts/validate-agent.sh --require-active --require-enrolled',
        'sudo install -d -m 0755 /opt/mnscloud',
        `if [ ! -d ${root}/.git ]; then sudo git clone https://github.com/manaoscloud/mnscloud-authentication.git ${root}; fi`,
        `sudo git -C ${root} fetch origin tag ${quote(data['ref'])}`,
        `test "$(sudo git -C ${root} rev-parse ${quote(String(data['ref']) + '^{commit}')})" = ${quote(data['commitSha'])}`,
        `sudo git -C ${root} checkout --detach ${quote(data['commitSha'])}`,
        `sudo bash ${root}/scripts/install-authentication.sh --env /etc/mnscloud/authentication.env --api-base ${quote(resolveApiBaseUrl())} --server-uuid ${quote(uuid)} <<'MNSCLOUD_INSTALL_AUTHORIZATION'\n${String(data['installationToken'])}\nMNSCLOUD_INSTALL_AUTHORIZATION`,
        ')',
      ].join('\n');
      openInstallCommandDialog(
        this.installDialog,
        {
          title: 'authentication.install',
          description: 'authentication.installDescription',
          warning: 'authentication.installWarning',
          details: [
            { label: 'authentication.serverUuid', value: uuid, monospace: true },
            { label: 'Expires at', value: data['expiresAt'], monospace: true },
          ],
          command,
        },
        this.destroyRef,
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
