import { Directive, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { resolveApiBaseUrl } from '../runtime/app-runtime-config';
import { openInstallCommandDialog } from '../install-command-dialog/open-install-command-dialog';
import {
  confirmInstallCommandGeneration,
  requestRuntimeInstallCommand,
} from '../install-command-dialog/runtime-install-token';
import {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../crud/configurable-crud/configurable-crud-page-base';

/**
 * Shared shape of the platform runtime modules installed through an existing Agent (Logs, DNS):
 * region clusters, servers bound by a one-use installation command, resume and retry. Each module
 * names its record prefixes, translation prefix and runtime repository; nothing else differs.
 */

/** Status, name, revision and region fields of a region cluster, plus the module's own fields. */
export function runtimeClusterFields(
  prefix: string,
  i18n: string,
  extra: ConfigurableCrudField[] = [],
): ConfigurableCrudField[] {
  return [
    {
      key: 'status',
      source: `${prefix}Status`,
      label: 'Status',
      type: 'status',
      span: 1,
      help: `${i18n}.clusterStatusHelp`,
    },
    { key: 'name', source: `${prefix}Name`, label: 'Name', required: true, span: 1 },
    {
      key: 'revision',
      source: `${prefix}Revision`,
      label: 'Revision',
      type: 'number',
      hidden: true,
    },
    {
      key: 'region',
      source: `${prefix}Region`,
      label: `${i18n}.region`,
      help: `${i18n}.clusterRegionHelp`,
      span: 1,
      required: true,
      type: 'text',
    },
    ...extra,
    {
      key: 'notes',
      source: `${prefix}Notes`,
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ];
}

export function runtimeClusterColumns(prefix: string, i18n: string): ConfigurableCrudColumn[] {
  return [
    { id: 'name', field: `${prefix}Name`, label: 'Name', kind: 'identity' },
    { id: 'region', field: `${prefix}Region`, label: `${i18n}.region`, kind: 'text' },
    { id: 'servers', field: 'ServerCount', label: `${i18n}.servers`, kind: 'text' },
    { id: 'status', field: `${prefix}Status`, label: 'Status', kind: 'status' },
  ];
}

/** Cluster selector of a server form: chosen once, never changed afterwards. */
export function runtimeServerClusterField(
  key: string,
  endpoint: string,
  clusterPrefix: string,
  i18n: string,
): ConfigurableCrudField {
  return {
    key,
    source: key,
    label: `${i18n}.cluster`,
    span: 1,
    required: true,
    type: 'search-select',
    remoteLookup: {
      endpoint,
      uuidField: `${clusterPrefix}UUID`,
      labelField: `${clusterPrefix}Name`,
    },
    disabledWhen: ({ editing }) => editing,
    help: `${i18n}.scopeHelp`,
  };
}

/** Install (new or uninstalled), resume (installing) and retry (failed or interrupted) actions. */
export function runtimeServerRowActions(prefix: string, i18n: string): ConfigurableCrudRowAction[] {
  const state = (row: ConfigurableCrudRecord) => String(row[`${prefix}ProvisioningState`]);
  return [
    {
      key: 'install',
      label: `${i18n}.install`,
      icon: 'terminal',
      visible: (row) => ['awaiting_installation', 'uninstalled'].includes(state(row)),
    },
    {
      // A running installation can show its resume command again (it carries no secret).
      key: 'resume',
      label: `${i18n}.resumeCommand`,
      icon: 'terminal',
      visible: (row) => state(row) === 'installing' && Boolean(row['InstallationReleaseTag']),
    },
    {
      // Also for an installation stuck in installing (a host step was interrupted): it is re-pinned
      // to the latest approved release and the same host runs the resume command.
      key: 'retry',
      label: `${i18n}.retryInstallation`,
      icon: 'refresh',
      visible: (row) => ['failed', 'installing'].includes(state(row)),
    },
  ];
}

/** Installation state, host evidence, diagnostic code, cluster and status columns of a server. */
export function runtimeServerColumns(
  prefix: string,
  i18n: string,
  clusterUuidField: string,
  evidence: (observed: Record<string, unknown>) => unknown[],
): ConfigurableCrudColumn[] {
  return [
    {
      id: 'provisioning',
      field: `${prefix}ProvisioningState`,
      label: `${i18n}.installationState`,
      kind: 'text',
      value: (row, translate) =>
        translate(
          `${i18n}.states.` + String(row[`${prefix}ProvisioningState`] ?? 'awaiting_installation'),
        ),
    },
    {
      id: 'host',
      field: `${prefix}Host`,
      label: `${i18n}.host`,
      kind: 'identity',
      detail: (row) => {
        const raw = row[`${prefix}ObservedJson`];
        try {
          const observed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return observed ? evidence(observed).filter(Boolean).join(' · ') : '';
        } catch {
          return '';
        }
      },
    },
    { id: 'error', field: `${prefix}LastErrorCode`, label: `${i18n}.lastError`, kind: 'text' },
    {
      id: 'cluster',
      label: `${i18n}.cluster`,
      kind: 'related',
      field: 'ClusterName',
      uuidField: clusterUuidField,
    },
    { id: 'status', field: `${prefix}Status`, label: 'Status', kind: 'status' },
  ];
}

export interface RuntimeServerInstallation {
  /** API collection of the servers, for example `system/dns/servers`. */
  endpoint: string;
  /** Record prefix of the server, for example `Dsv`. */
  prefix: string;
  /** Translation prefix of the module, for example `dns`. */
  i18n: string;
  /** Module name shown when confirming a new command. */
  module: string;
  /** Runtime name: repository `mnscloud-<runtime>`, scripts `install-<runtime>.sh`/`validate-<runtime>.sh`. */
  runtime: string;
}

/**
 * Same one-line, `&&`-chained shape as the other runtime modules; ends with the module validator.
 * A resumed installation (after Retry) is already bound to the host, so it carries no token.
 */
export function runtimeInstallCommand(
  runtime: string,
  apiBase: string,
  uuid: string,
  data: Record<string, unknown>,
): string {
  const quote = (value: unknown) => "'" + String(value).replaceAll("'", "'\\''") + "'";
  const repo = `mnscloud-${runtime}`;
  const root = `/opt/mnscloud/${repo}`;
  return [
    'sudo install -d -m 0755 /opt/mnscloud',
    'cd /opt/mnscloud',
    `([ -d ${repo}/.git ] || sudo git clone https://github.com/manaoscloud/${repo}.git)`,
    `sudo git -C ${repo} fetch --tags --force origin`,
    // The pinned release; the installer also verifies the commit approved by the API.
    `sudo git -C ${repo} checkout --detach ${quote(data['ref'])}`,
    `sudo bash ${root}/scripts/install-${runtime}.sh --api-base ${quote(apiBase)} --server-uuid ${quote(uuid)}` +
      (data['installationToken']
        ? ` --installation-token ${quote(data['installationToken'])}`
        : ''),
    `sudo bash ${root}/scripts/validate-${runtime}.sh`,
  ].join(' && ');
}

/** Server page of a runtime module: installation command, resume command and retry. */
@Directive()
export abstract class RuntimeServerCrudPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected abstract readonly installation: RuntimeServerInstallation;
  private readonly installDialog = inject(MatDialog);

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    const { prefix, module } = this.installation;
    const uuid = String(row[`${prefix}UUID`]);
    if (action.key === 'retry') return this.retryInstallation(uuid);
    if (action.key === 'resume') return this.showResumeCommand(uuid, row['InstallationReleaseTag']);
    if (action.key !== 'install') return super.handleRowAction(action, row);
    const confirmed = await confirmInstallCommandGeneration(
      this.installDialog,
      (key, params) => this.t(key, params),
      String(row[`${prefix}Name`] ?? ''),
      module,
    );
    if (confirmed) await this.showInstaller(uuid);
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const response = context.response as { data?: ConfigurableCrudRecord };
    const uuid = response.data?.[`${this.installation.prefix}UUID`];
    if (uuid) await this.showInstaller(String(uuid));
  }

  /** Resumes a failed installation on the latest approved release and shows the resume command. */
  private async retryInstallation(uuid: string): Promise<void> {
    const { i18n, endpoint } = this.installation;
    const confirmed = await this.confirmAction(
      `${i18n}.retryInstallation`,
      `${i18n}.retryConfirmation`,
      `${i18n}.retryInstallation`,
    );
    if (!confirmed) return;
    try {
      const response = await this.api.post<{ data: Record<string, unknown> }>(
        `${endpoint}/${uuid}/retry-installation`,
        {},
      );
      this.snack.success(this.t(`${i18n}.retryAccepted`));
      this.refreshList();
      this.showResumeCommand(uuid, response.data['ref']);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  private showResumeCommand(uuid: string, ref: unknown): void {
    const { i18n, runtime } = this.installation;
    const apiBase = resolveApiBaseUrl();
    openInstallCommandDialog(
      this.installDialog,
      {
        title: `${i18n}.resumeCommand`,
        description: `${i18n}.installDescription`,
        warning: `${i18n}.resumeWarning`,
        details: [
          { label: 'API base', value: apiBase, monospace: true },
          { label: `${i18n}.serverUuid`, value: uuid, monospace: true },
          { label: 'Version', value: ref, monospace: true },
        ],
        command: runtimeInstallCommand(runtime, apiBase, uuid, { ref }),
      },
      this.destroyRef,
    );
  }

  private async showInstaller(uuid: string): Promise<void> {
    const { i18n, runtime, endpoint } = this.installation;
    try {
      const response = await requestRuntimeInstallCommand(this.installDialog, (body) =>
        this.api.post<{ data: Record<string, unknown> }>(
          `${endpoint}/${uuid}/install-command`,
          body,
        ),
      );
      if (!response) return;
      const data = response.data;
      const apiBase = resolveApiBaseUrl();
      openInstallCommandDialog(
        this.installDialog,
        {
          title: `${i18n}.install`,
          description: `${i18n}.installDescription`,
          warning: `${i18n}.installWarning`,
          details: [
            { label: 'API base', value: apiBase, monospace: true },
            { label: `${i18n}.serverUuid`, value: uuid, monospace: true },
            { label: 'Version', value: data['ref'], monospace: true },
            { label: 'Expires at', value: data['expiresAt'], monospace: true },
          ],
          command: runtimeInstallCommand(runtime, apiBase, uuid, data),
        },
        this.destroyRef,
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
