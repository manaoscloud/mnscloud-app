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
  WEBHOST_ZONE_TYPE_OPTIONS,
  hostOptionLabel,
  lifecycleChipClass,
  normalizeString,
  numberOrNull,
  webhostRootEndpoint,
} from '../webhost-shared';

const RETRY_ACTION: ConfigurableCrudRowAction = {
  key: 'provision', label: 'Retry', icon: 'refresh', tooltip: 'Retry failed DNS operation',
};
const RESULT_OPTIONS = [
  { value: 'pending', label: 'Queued' },
  { value: 'provisioning', label: 'Processing' },
  { value: 'provisioned', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'manual', label: 'Unmanaged' },
];

const ZONE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/zone-records',
  uuidField: 'HwzUUID',
  pageTitle: 'Webhost Zone Editor',
  pageDescription: 'Add and remove managed DNS records. Existing provider records are preserved.',
  createTitle: 'New zone record',
  editTitle: 'Edit zone record',
  dialogDescription: 'Configure DNS name, type, value and TTL.',
  searchPlaceholder: 'Name, value, type or host',
  emptyLabel: 'No zone records found.',
  deleteTitle: 'Delete zone record',
  deleteMessage: 'Remove this DNS record from the provider?',
  savedMessage: 'Zone record saved successfully.',
  deletedMessage: 'Zone record deleted successfully.',
  deleteFailedMessage: 'Failed to delete zone record.',
  statusMode: 'string',
  activeValue: 'provisioned',
  inactiveValue: 'failed',
  bulkDelete: false,
  canEdit: false,
  serverSidePagination: true,
  statusOptions: RESULT_OPTIONS,
  canDeleteRow: (row) => Number(row['HwzManaged']) === 1 && !['pending', 'provisioning'].includes(String(row['HwzProvisionStatus'])),
  statusFilter: true,
  tabLabels: { storage: 'Record', notes: 'Notes' },
  rowActions: [RETRY_ACTION],
  listFilters: [
    { key: 'hostUUID', label: 'Host', paramKey: 'hostUUID', type: 'search-select', placeholder: 'Search hosts', emptyLabel: 'No records found.' },
    { key: 'recordType', label: 'Type', paramKey: 'type', type: 'search-select', placeholder: 'Search', emptyLabel: 'No records found.' },
  ],
  initialValues: {
    hostUUID: '', name: '', recordType: 'A', value: '', ttl: 14400,
    priority: null, weight: null, port: null, notes: '',
  },
  columns: [
    { id: 'result', label: 'Status', kind: 'status', field: 'HwzProvisionStatus', options: RESULT_OPTIONS, chipClass: lifecycleChipClass },
    { id: 'name', label: 'Name', kind: 'identity', field: 'HwzName', uuidField: 'HwzUUID' },
    { id: 'type', label: 'Type', field: 'HwzType' },
    { id: 'value', label: 'Value', field: 'HwzValue' },
    { id: 'host', label: 'Host', kind: 'related', field: 'HostName', uuidField: 'HostingWebhostHostHwhUUID' },
  ],
  fields: [
    { key: 'hostUUID', source: 'HostingWebhostHostHwhUUID', payloadKey: 'hostUUID', label: 'Host', type: 'search-select', required: true, span: 1 },
    { key: 'name', source: 'HwzName', payloadKey: 'name', label: 'Record name', required: true, span: 1 },
    { key: 'recordType', source: 'HwzType', payloadKey: 'recordType', label: 'Type', type: 'search-select', options: WEBHOST_ZONE_TYPE_OPTIONS, required: true, span: 1 },
    { key: 'value', source: 'HwzValue', payloadKey: 'value', label: 'Value', required: true, span: 1 },
    { key: 'ttl', source: 'HwzTtl', payloadKey: 'ttl', label: 'TTL', type: 'number', span: 1 },
    { key: 'priority', source: 'HwzPriority', payloadKey: 'priority', label: 'Priority', type: 'number', span: 1, requiredWhen: ({ values }) => ['MX', 'SRV'].includes(String(values['recordType'])), hiddenWhen: ({ values }) => !['MX', 'SRV'].includes(String(values['recordType'])) },
    { key: 'weight', source: 'HwzWeight', payloadKey: 'weight', label: 'Weight', type: 'number', span: 1, requiredWhen: ({ values }) => values['recordType'] === 'SRV', hiddenWhen: ({ values }) => values['recordType'] !== 'SRV' },
    { key: 'port', source: 'HwzPort', payloadKey: 'port', label: 'Port', type: 'number', span: 1, requiredWhen: ({ values }) => values['recordType'] === 'SRV', hiddenWhen: ({ values }) => values['recordType'] !== 'SRV' },
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
    this.hosts().filter((h) => h.HwhIsActive === 1 && h.HwhProvisionStatus === 'provisioned').map((host) => ({
      value: host.HwhUUID,
      label: hostOptionLabel(host as unknown as ConfigurableCrudRecord),
      description: host.ProviderName,
      searchText: `${host.HwhName} ${host.DomainName} ${host.HwhUsername}`,
    })),
  );

  constructor() {
    super(ZONE_CONFIG);

  }

  protected override listEndpoint(): string { return this.endpoint(); }
  protected override createEndpoint(): string { return this.endpoint(); }
  protected override updateEndpoint(): string { return this.endpoint(); }
  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string { return this.endpoint(); }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'hostUUID') return this.hostOptions();
    if (key === 'recordType') return WEBHOST_ZONE_TYPE_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.hosts().length) await this.fetchHosts();
    return await super.fetchItems(filters);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return Number(row['HwzManaged']) === 1 && row['HwzProvisionStatus'] === 'failed' ? [RETRY_ACTION] : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      hostUUID: payload['hostUUID'],
      name: String(payload['name'] ?? '').trim(),
      type: payload['recordType'],
      value: String(payload['value'] ?? ''),
      ttl: numberOrNull(payload['ttl']) ?? 14400,
      priority: ['MX', 'SRV'].includes(String(payload['recordType'])) ? numberOrNull(payload['priority']) : null,
      weight: payload['recordType'] === 'SRV' ? numberOrNull(payload['weight']) : null,
      port: payload['recordType'] === 'SRV' ? numberOrNull(payload['port']) : null,
      config: { notes: normalizeString(payload['notes']) },
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HwzUUID'] ?? '');
    if (!uuid) return;
    if (action.key !== 'provision' || !this.rowActions(row).length) return;
    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.endpoint()}/${uuid}/${action.key}`, {});
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to retry DNS operation.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchHosts() {
    const hosts: HostingWebhostHost[] = [];
    for (let offset = 0; ; offset += 500) {
      const params = new URLSearchParams({ limit: '500', offset: String(offset), isActive: '1' });
      const response = await this.api.get<{ data: { items: HostingWebhostHost[] } }>(
        `${this.rootEndpoint()}/hosts?${params.toString()}`,
      );
      hosts.push(...response.data.items);
      if (response.data.items.length < 500) break;
    }
    this.hosts.set(hosts);
  }
}
