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
  WEBHOST_ZONE_STATUS_OPTIONS,
  WEBHOST_ZONE_TYPE_OPTIONS,
  appendWebhostListParams,
  asRecord,
  hostOptionLabel,
  lifecycleChipClass,
  normalizeString,
  numberOrNull,
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

const ZONE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/zone-records',
  uuidField: 'HwzUUID',
  pageTitle: 'Webhost Zone Editor',
  pageDescription: 'Manage DNS zone records for Webhost hosts.',
  createTitle: 'New zone record',
  editTitle: 'Edit zone record',
  dialogDescription: 'Configure DNS name, type, value and TTL.',
  searchPlaceholder: 'Name, value, type or host',
  emptyLabel: 'No zone records found.',
  deleteTitle: 'Delete zone record',
  deleteMessage: 'Are you sure you want to delete this zone record locally?',
  deleteSelectedTitle: 'Delete selected zone records',
  deleteSelectedMessage: 'Delete {count} selected zone records locally?',
  savedMessage: 'Zone record saved successfully.',
  deletedMessage: 'Zone record deleted successfully.',
  deleteFailedMessage: 'Failed to delete zone record.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  tabLabels: { storage: 'Record', notes: 'Notes' },
  rowActions: [PROVISION_ACTION, SYNC_ACTION, DEPROVISION_ACTION],
  listFilters: [
    { key: 'hostUUID', label: 'Host', paramKey: 'hostUUID', type: 'search-select', placeholder: 'Search hosts', emptyLabel: 'No records found.' },
    { key: 'recordType', label: 'Type', paramKey: 'type', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
    { key: 'toolStatus', label: 'Lifecycle', paramKey: 'status', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
    { key: 'provisionStatus', label: 'Provision', paramKey: 'provisionStatus', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
  ],
  initialValues: {
    hostUUID: '', name: '', recordType: 'A', value: '', ttl: 14400,
    priority: null, weight: null, port: null,
    toolStatus: 'pending', provisionStatus: 'manual', notes: '', status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HwzName', uuidField: 'HwzUUID' },
    { id: 'type', label: 'Type', field: 'HwzType' },
    { id: 'value', label: 'Value', field: 'HwzValue' },
    { id: 'host', label: 'Host', kind: 'related', field: 'HostName', uuidField: 'HostingWebhostHostHwhUUID' },
    { id: 'lifecycle', label: 'Lifecycle', kind: 'status', field: 'HwzStatus', options: WEBHOST_ZONE_STATUS_OPTIONS, className: 'status-col', chipClass: lifecycleChipClass },
    { id: 'provision', label: 'Provision', kind: 'status', field: 'HwzProvisionStatus', options: WEBHOST_PROVISION_STATUS_OPTIONS, className: 'status-col', chipClass: lifecycleChipClass },
    { id: 'status', label: 'Status', kind: 'status', field: 'HwzIsActive', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'HwzIsActive', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'hostUUID', source: 'HostingWebhostHostHwhUUID', payloadKey: 'hostUUID', label: 'Host', type: 'search-select', required: true, span: 1 },
    { key: 'name', source: 'HwzName', payloadKey: 'name', label: 'Record name', required: true, span: 1 },
    { key: 'recordType', source: 'HwzType', payloadKey: 'recordType', label: 'Type', type: 'search-select', options: WEBHOST_ZONE_TYPE_OPTIONS, required: true, span: 1 },
    { key: 'value', source: 'HwzValue', payloadKey: 'value', label: 'Value', required: true, span: 1 },
    { key: 'ttl', source: 'HwzTtl', payloadKey: 'ttl', label: 'TTL', type: 'number', span: 1 },
    { key: 'priority', source: 'HwzPriority', payloadKey: 'priority', label: 'Priority', type: 'number', span: 1 },
    { key: 'weight', source: 'HwzWeight', payloadKey: 'weight', label: 'Weight', type: 'number', span: 1 },
    { key: 'port', source: 'HwzPort', payloadKey: 'port', label: 'Port', type: 'number', span: 1 },
    { key: 'toolStatus', source: 'HwzStatus', payloadKey: 'toolStatus', label: 'Lifecycle', type: 'search-select', options: WEBHOST_ZONE_STATUS_OPTIONS, required: true, span: 1 },
    { key: 'provisionStatus', source: 'HwzProvisionStatus', payloadKey: 'provisionStatus', label: 'Provision status', type: 'search-select', options: WEBHOST_PROVISION_STATUS_OPTIONS, required: true, span: 1 },
    { key: 'notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 3 },
  ],
};

@Component({
  selector: 'app-hosting-webhost-zone-editor',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostZoneEditorPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly hosts = signal<HostingWebhostHost[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() => webhostRootEndpoint(this.isMaster()));
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/zone-records`);
  private readonly hostOptions = computed<ConfigurableCrudOption[]>(() =>
    this.hosts().filter((h) => h.HwhIsActive === 1).map((host) => ({
      value: host.HwhUUID,
      label: hostOptionLabel(host as unknown as ConfigurableCrudRecord),
      description: host.ProviderName,
      searchText: `${host.HwhName} ${host.DomainName} ${host.HwhUsername}`,
    })),
  );

  constructor() {
    super(ZONE_CONFIG);
    void this.fetchHosts();
  }

  protected override listEndpoint(): string { return this.endpoint(); }
  protected override createEndpoint(): string { return this.endpoint(); }
  protected override updateEndpoint(): string { return this.endpoint(); }
  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string { return this.endpoint(); }
  protected override bulkDeleteEndpoint(): string { return `${this.endpoint()}/bulk`; }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'hostUUID') return this.hostOptions();
    if (key === 'toolStatus') return WEBHOST_ZONE_STATUS_OPTIONS;
    if (key === 'provisionStatus') return WEBHOST_PROVISION_STATUS_OPTIONS;
    if (key === 'recordType') return WEBHOST_ZONE_TYPE_OPTIONS;
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
      HwzConfig: asRecord(item['HwzConfig']),
    }));
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HwzIsActive']),
      recordType: String(row['HwzType'] ?? 'A'),
      toolStatus: String(row['HwzStatus'] ?? 'pending'),
      provisionStatus: String(row['HwzProvisionStatus'] ?? 'manual'),
      ttl: Number(row['HwzTtl'] ?? 14400),
      priority: row['HwzPriority'] == null ? null : Number(row['HwzPriority']),
      weight: row['HwzWeight'] == null ? null : Number(row['HwzWeight']),
      port: row['HwzPort'] == null ? null : Number(row['HwzPort']),
      notes: String(asRecord(row['HwzConfig'])['notes'] ?? ''),
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      hostUUID: payload['hostUUID'],
      name: String(payload['name'] ?? '').trim(),
      type: payload['recordType'],
      value: String(payload['value'] ?? '').trim(),
      ttl: numberOrNull(payload['ttl']) ?? 14400,
      priority: numberOrNull(payload['priority']),
      weight: numberOrNull(payload['weight']),
      port: numberOrNull(payload['port']),
      status: payload['toolStatus'],
      provisionStatus: payload['provisionStatus'],
      config: { notes: normalizeString(payload['notes']) },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HwzUUID'] ?? '');
    if (!uuid) return;
    if (action.key === 'deprovision') {
      const ok = await this.confirmAction(
        'Deprovision zone record',
        `Remove "${String(row['HwzName'] ?? '')}" from the provider? The local record will remain for history.`,
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
      this.snack.error(this.errorMessage(error) || this.t(`Failed to ${action.key} zone record.`));
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
