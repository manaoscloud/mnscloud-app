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
  WEBHOST_ACCESS_TYPE_OPTIONS,
  WEBHOST_PROVISION_STATUS_OPTIONS,
  WEBHOST_TOOL_STATUS_OPTIONS,
  YES_NO_OPTIONS,
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

const MAILING_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/mailing-lists',
  uuidField: 'HwmUUID',
  pageTitle: 'Webhost Mailing Lists',
  pageDescription: 'Manage mailing lists provisioned on Webhost hosts.',
  createTitle: 'New mailing list',
  editTitle: 'Edit mailing list',
  dialogDescription: 'Configure list name, access and admin contact.',
  searchPlaceholder: 'Name, email or host',
  emptyLabel: 'No mailing lists found.',
  deleteTitle: 'Delete mailing list',
  deleteMessage: 'Are you sure you want to delete this mailing list locally?',
  deleteSelectedTitle: 'Delete selected mailing lists',
  deleteSelectedMessage: 'Delete {count} selected mailing lists locally?',
  savedMessage: 'Mailing list saved successfully.',
  deletedMessage: 'Mailing list deleted successfully.',
  deleteFailedMessage: 'Failed to delete mailing list.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  tabLabels: { storage: 'List', notes: 'Notes' },
  rowActions: [PROVISION_ACTION, SYNC_ACTION, DEPROVISION_ACTION],
  listFilters: [
    { key: 'hostUUID', label: 'Host', paramKey: 'hostUUID', type: 'search-select', placeholder: 'Search hosts', emptyLabel: 'No records found.' },
    { key: 'toolStatus', label: 'Lifecycle', paramKey: 'status', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
    { key: 'provisionStatus', label: 'Provision', paramKey: 'provisionStatus', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
  ],
  initialValues: {
    hostUUID: '', name: '', adminEmail: '', accessType: 'private', advertised: 0,
    toolStatus: 'pending', provisionStatus: 'manual', notes: '', status: 1,
  },
  columns: [
    { id: 'name', label: 'List', kind: 'identity', field: 'HwmName', uuidField: 'HwmUUID' },
    { id: 'email', label: 'Email', field: 'HwmEmail' },
    { id: 'host', label: 'Host', kind: 'related', field: 'HostName', uuidField: 'HostingWebhostHostHwhUUID' },
    { id: 'access', label: 'Access', field: 'HwmAccessType' },
    { id: 'lifecycle', label: 'Lifecycle', kind: 'status', field: 'HwmStatus', options: WEBHOST_TOOL_STATUS_OPTIONS, className: 'status-col', chipClass: lifecycleChipClass },
    { id: 'provision', label: 'Provision', kind: 'status', field: 'HwmProvisionStatus', options: WEBHOST_PROVISION_STATUS_OPTIONS, className: 'status-col', chipClass: lifecycleChipClass },
    { id: 'status', label: 'Status', kind: 'status', field: 'HwmIsActive', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'HwmIsActive', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'hostUUID', source: 'HostingWebhostHostHwhUUID', payloadKey: 'hostUUID', label: 'Host', type: 'search-select', required: true, span: 1 },
    { key: 'name', source: 'HwmName', payloadKey: 'name', label: 'List name', required: true, span: 1 },
    { key: 'adminEmail', source: 'HwmAdminEmail', payloadKey: 'adminEmail', label: 'Admin email', span: 1 },
    { key: 'accessType', source: 'HwmAccessType', payloadKey: 'accessType', label: 'Access', type: 'search-select', options: WEBHOST_ACCESS_TYPE_OPTIONS, required: true, span: 1 },
    { key: 'advertised', source: 'HwmAdvertised', payloadKey: 'advertised', label: 'Advertised', type: 'search-select', options: YES_NO_OPTIONS, span: 1 },
    { key: 'toolStatus', source: 'HwmStatus', payloadKey: 'toolStatus', label: 'Lifecycle', type: 'search-select', options: WEBHOST_TOOL_STATUS_OPTIONS, required: true, span: 1 },
    { key: 'provisionStatus', source: 'HwmProvisionStatus', payloadKey: 'provisionStatus', label: 'Provision status', type: 'search-select', options: WEBHOST_PROVISION_STATUS_OPTIONS, required: true, span: 1 },
    { key: 'notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 3 },
  ],
};

@Component({
  selector: 'app-hosting-webhost-mailing-lists',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostMailingListsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly hosts = signal<HostingWebhostHost[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() => webhostRootEndpoint(this.isMaster()));
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/mailing-lists`);
  private readonly hostOptions = computed<ConfigurableCrudOption[]>(() =>
    this.hosts().filter((h) => h.HwhIsActive === 1).map((host) => ({
      value: host.HwhUUID,
      label: hostOptionLabel(host as unknown as ConfigurableCrudRecord),
      description: host.ProviderName,
      searchText: `${host.HwhName} ${host.DomainName} ${host.HwhUsername}`,
    })),
  );

  constructor() {
    super(MAILING_CONFIG);
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
    if (key === 'accessType') return WEBHOST_ACCESS_TYPE_OPTIONS;
    if (key === 'advertised') return YES_NO_OPTIONS;
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
      HwmConfig: asRecord(item['HwmConfig']),
    }));
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HwmIsActive']),
      toolStatus: String(row['HwmStatus'] ?? 'pending'),
      provisionStatus: String(row['HwmProvisionStatus'] ?? 'manual'),
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
      status: payload['toolStatus'],
      provisionStatus: payload['provisionStatus'],
      config: { notes: normalizeString(payload['notes']) },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HwmUUID'] ?? '');
    if (!uuid) return;
    if (action.key === 'deprovision') {
      const ok = await this.confirmAction(
        'Deprovision mailing list',
        `Remove "${String(row['HwmName'] ?? '')}" from the provider? The local record will remain for history.`,
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
      this.snack.error(this.errorMessage(error) || this.t(`Failed to ${action.key} mailing list.`));
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
