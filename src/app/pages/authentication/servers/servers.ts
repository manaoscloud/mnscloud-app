import { authenticationPayload } from '../authentication-input';
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
    status: 0,
    revision: 1,
    AuthenticationClusterAtcUUID: '',
    host: '',
    databaseUser: '',
    authPort: 1812,
    acctPort: 1813,
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  rowActions: [{ key: 'install', label: 'authentication.install', icon: 'terminal' }],
  fields: [
    { key: 'status', source: 'AtsStatus', label: 'Status', type: 'status', span: 1 },
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
      key: 'host',
      source: 'AtsHost',
      label: 'authentication.host',
      span: 1,
      required: true,
      type: 'text',
      help: 'authentication.hostHelp',
    },
    {
      key: 'databaseUser',
      source: 'AtsDatabaseUser',
      label: 'authentication.databaseUser',
      type: 'text',
      span: 1,
      help: 'authentication.databaseUserHelp',
    },
    {
      key: 'authPort',
      source: 'AtsAuthPort',
      label: 'authentication.authPort',
      span: 1,
      required: true,
      type: 'number',
    },
    {
      key: 'acctPort',
      source: 'AtsAcctPort',
      label: 'authentication.acctPort',
      span: 1,
      required: true,
      type: 'number',
    },
    {
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
    { id: 'host', field: 'AtsHost', label: 'authentication.host', kind: 'text' },
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
    if (action.key !== 'install') return;
    if (
      await confirmInstallCommandGeneration(
        this.installDialog,
        (key, params) => this.t(key, params),
        String(row['AtsName']),
        this.t('nav.authentication'),
      )
    ) {
      await this.showInstaller(String(row['AtsUUID']));
    }
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
      const response = await requestRuntimeInstallCommand(this.installDialog, (body) =>
        this.api.post<{ data: Record<string, unknown> }>(
          `${config.endpoint}/${uuid}/install-command`,
          body,
        ),
      );
      if (!response) return;
      const data = response.data;
      const quote = (value: unknown) => "'" + String(value).replaceAll("'", "'\\''") + "'";
      const root = '/opt/mnscloud/mnscloud-authentication';
      const command = [
        'set -eu',
        'sudo install -d -m 0755 /opt/mnscloud',
        `if [ ! -d ${root}/.git ]; then sudo git clone https://github.com/manaoscloud/mnscloud-authentication.git ${root}; fi`,
        `sudo git -C ${root} fetch origin tag ${quote(data['ref'])}`,
        `sudo git -C ${root} checkout --detach ${quote(data['ref'])}`,
        `sudo bash ${root}/scripts/install-authentication.sh --env /etc/mnscloud/authentication.env --api-base ${quote(window.location.origin)} --server-uuid ${quote(uuid)} --enrollment-token ${quote(data['enrollmentToken'])}`,
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
