import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type { HostingWebhostHost } from '../webhost.types';
import {
  WEBHOST_PROVISION_STATUS_OPTIONS,
  WEBHOST_TOOL_STATUS_OPTIONS,
  appendWebhostListParams,
  asRecord,
  hostOptionLabel,
  lifecycleChipClass,
  normalizeString,
  truthyNumber,
  webhostRootEndpoint,
} from '../webhost-shared';

const PROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'provision', label: 'Provision', icon: 'cloud_upload', tooltip: 'Provision',
};
const SYNC_ACTION: ConfigurableCrudRowAction = {
  key: 'sync', label: 'Sync', icon: 'sync', tooltip: 'Sync',
};
const DEPROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'deprovision', label: 'Deprovision', icon: 'cloud_off', tooltip: 'Deprovision',
};

const DATABASE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/databases',
  uuidField: 'HwdUUID',
  pageTitle: 'Webhost Databases',
  pageDescription: 'Manage MySQL databases provisioned on Webhost hosts.',
  createTitle: 'New webhost database',
  editTitle: 'Edit webhost database',
  dialogDescription: 'Configure database name, user and privileges.',
  searchPlaceholder: 'Name, host or username',
  emptyLabel: 'No webhost databases found.',
  deleteTitle: 'Delete webhost database',
  deleteMessage: 'Are you sure you want to delete this webhost database locally?',
  deleteSelectedTitle: 'Delete selected webhost databases',
  deleteSelectedMessage: 'Delete {count} selected webhost databases locally?',
  savedMessage: 'Webhost database saved successfully.',
  deletedMessage: 'Webhost database deleted successfully.',
  deleteFailedMessage: 'Failed to delete webhost database.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  tabLabels: { storage: 'Database', notes: 'Notes' },
  rowActions: [PROVISION_ACTION, SYNC_ACTION, DEPROVISION_ACTION],
  listFilters: [
    { key: 'hostUUID', label: 'Host', paramKey: 'hostUUID', type: 'search-select', placeholder: 'Search hosts', emptyLabel: 'No records found.' },
    { key: 'toolStatus', label: 'Lifecycle', paramKey: 'status', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
    { key: 'provisionStatus', label: 'Provision', paramKey: 'provisionStatus', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
  ],
  initialValues: {
    hostUUID: '', name: '', username: '', privileges: 'ALL PRIVILEGES',
    toolStatus: 'pending', provisionStatus: 'manual', notes: '', status: 1,
  },
  columns: [
    { id: 'name', label: 'Database', kind: 'identity', field: 'HwdName', uuidField: 'HwdUUID' },
    { id: 'host', label: 'Host', kind: 'related', field: 'HostName', uuidField: 'HostingWebhostHostHwhUUID' },
    { id: 'username', label: 'DB user', field: 'HwdUsername' },
    { id: 'provider', label: 'Provider', field: 'ProviderName' },
    { id: 'lifecycle', label: 'Lifecycle', kind: 'status', field: 'HwdStatus', options: WEBHOST_TOOL_STATUS_OPTIONS, className: 'status-col', chipClass: lifecycleChipClass },
    { id: 'provision', label: 'Provision', kind: 'status', field: 'HwdProvisionStatus', options: WEBHOST_PROVISION_STATUS_OPTIONS, className: 'status-col', chipClass: lifecycleChipClass },
    { id: 'status', label: 'Status', kind: 'status', field: 'HwdIsActive', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'HwdIsActive', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'hostUUID', source: 'HostingWebhostHostHwhUUID', payloadKey: 'hostUUID', label: 'Host', type: 'search-select', required: true, span: 1 },
    { key: 'name', source: 'HwdName', payloadKey: 'name', label: 'Database name', required: true, span: 1 },
    { key: 'username', source: 'HwdUsername', payloadKey: 'username', label: 'DB username', span: 1 },
    { key: 'privileges', source: 'HwdPrivileges', payloadKey: 'privileges', label: 'Privileges', span: 1 },
    { key: 'toolStatus', source: 'HwdStatus', payloadKey: 'toolStatus', label: 'Lifecycle', type: 'search-select', options: WEBHOST_TOOL_STATUS_OPTIONS, required: true, span: 1 },
    { key: 'provisionStatus', source: 'HwdProvisionStatus', payloadKey: 'provisionStatus', label: 'Provision status', type: 'search-select', options: WEBHOST_PROVISION_STATUS_OPTIONS, required: true, span: 1 },
    { key: 'notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 3 },
  ],
};

@Component({
  selector: 'app-hosting-webhost-databases',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostDatabasesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly hosts = signal<HostingWebhostHost[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() => webhostRootEndpoint(this.isMaster()));
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/databases`);
  private readonly hostOptions = computed<ConfigurableCrudOption[]>(() =>
    this.hosts().filter((h) => h.HwhIsActive === 1).map((host) => ({
      value: host.HwhUUID,
      label: hostOptionLabel(host as unknown as ConfigurableCrudRecord),
      description: host.ProviderName,
      searchText: `${host.HwhName} ${host.DomainName} ${host.HwhUsername}`,
    })),
  );

  constructor() {
    super(DATABASE_CONFIG);
    void this.fetchHosts();
  }

  protected override listEndpoint(): string { return this.endpoint(); }
  protected override createEndpoint(): string { return this.endpoint(); }
  protected override updateEndpoint(): string { return this.endpoint(); }
  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string { return this.endpoint(); }
  protected override bulkDeleteEndpoint(): string { return `${this.endpoint()}/bulk`; }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'hostUUID') return this.hostOptions();
    if (key === 'toolStatus') return WEBHOST_TOOL_STATUS_OPTIONS;
    if (key === 'provisionStatus') return WEBHOST_PROVISION_STATUS_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.hosts().length) await this.fetchHosts();
    const params = new URLSearchParams();
    appendWebhostListParams(params, filters, this.listFilters());
    const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
      `${this.listEndpoint()}?${params.toString()}`,
    );
    return (response?.data?.items ?? []).map((item) => ({
      ...item,
      HwdConfig: asRecord(item['HwdConfig']),
    }));
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HwdIsActive']),
      toolStatus: String(row['HwdStatus'] ?? 'pending'),
      provisionStatus: String(row['HwdProvisionStatus'] ?? 'manual'),
      notes: String(asRecord(row['HwdConfig'])['notes'] ?? ''),
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      hostUUID: payload['hostUUID'],
      name: String(payload['name'] ?? '').trim(),
      username: normalizeString(payload['username']),
      privileges: normalizeString(payload['privileges']),
      status: payload['toolStatus'],
      provisionStatus: payload['provisionStatus'],
      config: { notes: normalizeString(payload['notes']) },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HwdUUID'] ?? '');
    if (!uuid) return;
    if (action.key === 'deprovision') {
      const ok = await this.confirmAction(
        'Deprovision webhost database',
        `Remove "${String(row['HwdName'] ?? '')}" from the provider? The local record will remain for history.`,
        'Deprovision',
      );
      if (!ok) return;
    }
    if (!['provision', 'sync', 'deprovision'].includes(action.key)) return;
    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.endpoint()}/${uuid}/${action.key}`, {});
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t(`Failed to ${action.key} webhost database.`));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchHosts() {
    try {
      const params = new URLSearchParams({ limit: '500', offset: '0', isActive: '1' });
      const response = await this.api.get<{ data?: { items?: HostingWebhostHost[] } }>(
        `${this.rootEndpoint()}/hosts?${params.toString()}`,
      );
      this.hosts.set(response?.data?.items ?? []);
    } catch {
      this.hosts.set([]);
    }
  }
}
