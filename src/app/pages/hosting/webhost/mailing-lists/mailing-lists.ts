import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudListParams,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type { HostingWebhostHost } from '../webhost.types';
import {
  asRecord,
  hostOptionLabel,
  normalizeString,
  truthyNumber,
  WEBHOST_ACCESS_TYPE_OPTIONS,
  webhostRootEndpoint,
  YES_NO_OPTIONS,
} from '../webhost-shared';

const PROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'provision',
  label: 'Retry provisioning',
  icon: 'cloud_upload',
  tooltip: 'Retry provisioning',
};
const SYNC_ACTION: ConfigurableCrudRowAction = {
  key: 'sync',
  label: 'Sync',
  icon: 'sync',
  tooltip: 'Sync',
};
const MANAGE_ACTION: ConfigurableCrudRowAction = {
  key: 'access',
  label: 'Manage in Mailman',
  icon: 'open_in_new',
  tooltip: 'Manage in Mailman',
};
const ERROR_ACTION: ConfigurableCrudRowAction = {
  key: 'error',
  label: 'View failure',
  icon: 'error_outline',
  tooltip: 'View failure',
};

const MAILING_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/mailing-lists',
  uuidField: 'HwmUUID',
  pageTitle: 'Webhost Mailing Lists',
  pageDescription: 'Lists are provisioned automatically. Manage subscribers in Mailman.',
  createTitle: 'New mailing list',
  editTitle: 'Edit mailing list',
  dialogDescription:
    'Host and list name cannot be changed after creation. Admin contact is local metadata.',
  searchPlaceholder: 'Name, email or host',
  emptyLabel: 'No mailing lists found.',
  deleteTitle: 'Delete mailing list',
  deleteMessage:
    'Permanently remove this mailing list, its subscribers and archives from the provider?',
  deleteSelectedTitle: 'Delete selected mailing lists',
  deleteSelectedMessage:
    'Permanently remove {count} selected mailing lists, their subscribers and archives from the provider?',
  savedMessage: 'Mailing list saved successfully.',
  deletedMessage: 'Mailing list deleted successfully.',
  deleteFailedMessage: 'Failed to delete mailing list.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  serverSidePagination: true,
  canEditRow: (row) => row['canEdit'] === true,
  canDeleteRow: (row) => row['canDelete'] === true,
  statusFilter: true,
  tabLabels: { storage: 'List', notes: 'Notes' },
  rowActions: [MANAGE_ACTION, PROVISION_ACTION, SYNC_ACTION, ERROR_ACTION],
  listFilters: [
    {
      key: 'hostUUID',
      label: 'Host',
      paramKey: 'hostUUID',
      type: 'search-select',
      placeholder: 'Search hosts',
      emptyLabel: 'No records found.',
    },
  ],
  initialValues: {
    hostUUID: '',
    name: '',
    adminEmail: '',
    accessType: 'private',
    advertised: 0,
    notes: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'List', kind: 'identity', field: 'HwmName', uuidField: 'HwmUUID' },
    { id: 'email', label: 'Email', field: 'HwmEmail' },
    {
      id: 'host',
      label: 'Host',
      kind: 'related',
      field: 'HostName',
      uuidField: 'HostingWebhostHostHwhUUID',
    },
    { id: 'access', label: 'Access', field: 'accessLabel' },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HwmIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'HwmIsActive',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'hostUUID',
      source: 'HostingWebhostHostHwhUUID',
      payloadKey: 'hostUUID',
      label: 'Host',
      type: 'search-select',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'name',
      source: 'HwmName',
      payloadKey: 'name',
      label: 'List name',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'adminEmail',
      source: 'HwmAdminEmail',
      payloadKey: 'adminEmail',
      label: 'Admin contact',
      type: 'email',
      span: 1,
    },
    {
      key: 'accessType',
      source: 'HwmAccessType',
      payloadKey: 'accessType',
      label: 'Access',
      type: 'select',
      options: WEBHOST_ACCESS_TYPE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'advertised',
      source: 'HwmAdvertised',
      payloadKey: 'advertised',
      label: 'Advertised',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'notes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
  ],
};

@Component({
  selector: 'app-hosting-webhost-mailing-lists',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostMailingListsPage
  extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly hosts = signal<HostingWebhostHost[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() => webhostRootEndpoint(this.isMaster()));
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/mailing-lists`);
  private readonly hostOptions = computed<ConfigurableCrudOption[]>(() =>
    this.hosts().filter((h) =>
      h.HwhIsActive === 1 && h.HwhStatus === 'active' && h.HwhProvisionStatus === 'provisioned'
    ).map((host) => ({
      value: host.HwhUUID,
      label: hostOptionLabel(host as unknown as ConfigurableCrudRecord),
      description: host.ProviderName,
      searchText: `${host.HwhName} ${host.DomainName} ${host.HwhUsername}`,
    }))
  );

  constructor() {
    super(MAILING_CONFIG);
    void this.fetchHosts();
  }

  protected override listEndpoint(): string {
    return this.endpoint();
  }
  protected override createEndpoint(): string {
    return this.endpoint();
  }
  protected override updateEndpoint(): string {
    return this.endpoint();
  }
  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.endpoint();
  }
  protected override bulkDeleteEndpoint(): string {
    return `${this.endpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'hostUUID') return this.hostOptions();
    if (key === 'accessType') return WEBHOST_ACCESS_TYPE_OPTIONS;
    if (key === 'advertised') return YES_NO_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudListParams) {
    const params = new URLSearchParams({
      limit: String(filters.limit),
      offset: String(filters.offset),
    });
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== '') params.set('isActive', String(filters.status));
    const host = filters.extra['hostUUID'];
    if (host) params.set('hostUUID', String(host));
    const response = await this.api.get<
      { data?: { items?: ConfigurableCrudRecord[]; total?: number } }
    >(
      `${this.listEndpoint()}?${params.toString()}`,
    );
    this.serverTotal.set(Number(response?.data?.total ?? 0));
    return (response?.data?.items ?? []).map((row) => ({
      ...row,
      accessLabel: this.t(
        WEBHOST_ACCESS_TYPE_OPTIONS.find((option) => option.value === row['HwmAccessType'])
          ?.label ?? '-',
      ),
    }));
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return [
      ...(row['canManage'] ? [MANAGE_ACTION] : []),
      ...(row['canRetry'] ? [PROVISION_ACTION] : []),
      ...(row['canSync'] ? [SYNC_ACTION] : []),
      ...(row['hasFailure'] ? [ERROR_ACTION] : []),
    ];
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HwmIsActive']),
      advertised: truthyNumber(row['HwmAdvertised']),
      notes: String(asRecord(row['HwmConfig'])['notes'] ?? ''),
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      hostUUID: payload['hostUUID'],
      name: String(payload['name'] ?? '').trim(),
      adminEmail: normalizeString(payload['adminEmail']),
      accessType: payload['accessType'],
      advertised: truthyNumber(payload['advertised']) === 1,
      config: { notes: normalizeString(payload['notes']) },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HwmUUID'] ?? '');
    if (!uuid) return;
    if (action.key === 'error') {
      openDataViewerDialog(this.dialog, {
        title: 'Mailing list failure',
        details: [{ label: 'List', value: row['HwmEmail'] }, {
          label: 'Error',
          value: row['HwmProvisionError'],
          translate: true,
        }],
      });
      return;
    }
    if (!['provision', 'sync', 'access'].includes(action.key)) return;
    // Create the tab within the user gesture, before the authenticated request.
    const tab = action.key === 'access' ? window.open('about:blank', '_blank') : null;
    if (action.key === 'access' && !tab) {
      this.snack.warning(this.t('Allow pop-ups to open Mailman.'));
      return;
    }
    if (tab) tab.opener = null;
    this.mutating.set(true);
    try {
      const response = await this.api.post<{ data?: { url?: string; password?: string } }>(
        `${this.endpoint()}/${uuid}/${action.key}`,
        {},
      );
      if (action.key === 'access') {
        const data = response?.data;
        if (!data?.url || !data.password) throw new Error(this.t('Mailman access is unavailable.'));
        const target = new URL(data.url);
        if (target.protocol !== 'https:' || target.username || target.password) {
          throw new Error(this.t('Mailman access is unavailable.'));
        }
        if (tab) tab.location.replace(target.href);
        const details = [{ label: 'One-time password', value: data.password }, {
          label: 'Mailman URL',
          value: target.href,
        }];
        const binding = openDataViewerDialog(this.dialog, {
          title: 'Mailman access',
          description:
            'Mailman opened in another tab. Enter this one-time password to manage subscribers. This dialog closes in 60 seconds.',
          details,
        });
        data.password = '';
        const clear = () => {
          for (const detail of details) detail.value = '';
        };
        const timer = setTimeout(() => {
          clear();
          binding.ref.close();
        }, 60_000);
        const unregister = this.destroyRef.onDestroy(() => {
          clearTimeout(timer);
          clear();
          binding.ref.close();
        });
        binding.ref.afterClosed().subscribe(() => {
          clearTimeout(timer);
          clear();
          unregister();
        });
      } else {
        this.trackOperation(response);
        this.refreshList();
      }
    } catch (error) {
      tab?.close();
      this.snack.error(this.t(this.errorMessage(error) || 'Mailing list action failed.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchHosts() {
    try {
      const hosts: HostingWebhostHost[] = [];
      const limit = 500;
      let offset = 0;
      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          isActive: '1',
        });
        const response = await this.api.get<{ data?: { items?: HostingWebhostHost[] } }>(
          `${this.rootEndpoint()}/hosts?${params.toString()}`,
        );
        const page = response?.data?.items ?? [];
        const seen = new Set(hosts.map((host) => host.HwhUUID));
        const added = page.filter((host) => !seen.has(host.HwhUUID));
        hosts.push(...added);
        if (page.length < limit || added.length === 0) break;
        offset += page.length;
      }
      this.hosts.set(hosts);
    } catch {
      this.snack.error(this.t('Unable to load Webhost hosts.'));
      this.hosts.set([]);
    }
  }
}
