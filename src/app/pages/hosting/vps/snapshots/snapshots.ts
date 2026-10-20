import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type { HostingVpsInstance } from '../vps.types';

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
];

const SNAPSHOT_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'creating', label: 'Creating' },
  { value: 'available', label: 'Available' },
  { value: 'restoring', label: 'Restoring' },
  { value: 'deleting', label: 'Deleting' },
  { value: 'failed', label: 'Failed' },
];

const SYNC_ACTION: ConfigurableCrudRowAction = {
  key: 'sync',
  label: 'Sync',
  icon: 'sync',
  tooltip: 'Sync from provider',
};

const RESTORE_ACTION: ConfigurableCrudRowAction = {
  key: 'restore',
  label: 'Restore',
  icon: 'restore',
  tooltip: 'Restore snapshot',
};

type SnapshotProviderCapabilities = {
  create: boolean;
  delete: boolean;
  get: boolean;
  list: boolean;
  restore: boolean;
  poll: boolean;
  includeMemory: boolean;
  quiesce: boolean;
  restoreMode: 'in_place' | 'new_instance' | 'none';
};

const HOSTING_VPS_SNAPSHOT_CONFIG_BASE: Omit<ConfigurableCrudConfig, 'fields'> = {
  endpoint: 'hosting/vps/snapshots',
  uuidField: 'HvsUUID',
  pageTitle: 'VPS Snapshots',
  pageDescription: 'Create and manage durable VPS instance snapshots.',
  createTitle: 'New VPS snapshot',
  editTitle: 'Edit VPS snapshot',
  dialogDescription: 'Capture a provider snapshot from a provisioned VPS instance.',
  searchPlaceholder: 'Name, instance, provider, region or status',
  emptyLabel: 'No VPS snapshots found.',
  deleteTitle: 'Delete VPS snapshot',
  deleteMessage: 'Delete this VPS snapshot from MNSCloud and the provider when linked?',
  deleteSelectedTitle: 'Delete selected VPS snapshots',
  deleteSelectedMessage:
    'Delete {count} selected VPS snapshot(s) from MNSCloud and linked provider resources?',
  savedMessage: 'VPS snapshot saved successfully.',
  deletedMessage: 'VPS snapshot deleted.',
  deleteFailedMessage: 'Failed to delete VPS snapshot.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  pageSizeOptions: [5, 10, 25, 100],
  rowActions: [SYNC_ACTION, RESTORE_ACTION],
  listFilters: [
    {
      key: 'instanceUUID',
      label: 'Instance',
      paramKey: 'instanceUUID',
      type: 'search-select',
      placeholder: 'Search instances',
      emptyLabel: 'No records found.',
      span: 1,
    },
    {
      key: 'snapshotStatus',
      label: 'Snapshot status',
      paramKey: 'status',
      type: 'select',
      options: SNAPSHOT_STATUS_OPTIONS,
      translateOptions: false,
      span: 1,
    },
  ],
  initialValues: {
    name: '',
    instanceUUID: '',
    includeMemory: 0,
    quiesce: 0,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HvsName', uuidField: 'HvsUUID' },
    {
      id: 'instance',
      label: 'Instance',
      kind: 'related',
      field: 'HviName',
      uuidField: 'HostingVpsInstanceHviUUID',
    },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'ProviderLabel',
      uuidField: 'HostingVpsProviderHvrUUID',
    },
    {
      id: 'status',
      label: 'Situation',
      kind: 'status',
      field: 'HvsStatus',
      options: SNAPSHOT_STATUS_OPTIONS,
      className: 'status-col',
      chipClass: (value) => snapshotStatusChipClass(value),
    },
    {
      id: 'sizeGb',
      label: 'Size (GB)',
      kind: 'number',
      field: 'HvsSizeGb',
      maximumFractionDigits: 3,
    },
    { id: 'region', label: 'Region', field: 'HvsRegion' },
    {
      id: 'includeMemory',
      label: 'Memory',
      kind: 'boolean',
      field: 'HvsIncludeMemory',
      className: 'status-col',
    },
  ],
};

@Component({
  selector: 'app-hosting-vps-snapshots',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsSnapshotsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly instances = signal<HostingVpsInstance[]>([]);
  private readonly capabilitiesByProvider = signal<Record<string, SnapshotProviderCapabilities>>({});
  private readonly mutatingActionUUIDs = signal<Set<string>>(new Set());

  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly snapshotEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/snapshots' : 'hosting/vps/snapshots',
  );
  private readonly instanceEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/instances' : 'hosting/vps/instances',
  );

  private readonly instanceOptions = computed<ConfigurableCrudOption[]>(() =>
    this.instances()
      .filter((instance) => Number(instance.HviIsActive) === 1 || !!instance.HviExternalId)
      .map((instance) => ({
        value: instance.HviUUID,
        label: instance.HviName,
        description: [
          instance.ProviderName || instance.ProviderCode,
          instance.HviStatus,
          instance.HviExternalId,
        ]
          .filter(Boolean)
          .join(' · '),
        searchText: [
          instance.HviName,
          instance.ProviderName,
          instance.ProviderCode,
          instance.HviStatus,
          instance.HviExternalId,
        ]
          .filter(Boolean)
          .join(' '),
      })),
  );

  constructor() {
    super({
      ...HOSTING_VPS_SNAPSHOT_CONFIG_BASE,
      fields: [
        {
          key: 'name',
          source: 'HvsName',
          payloadKey: 'name',
          label: 'Name',
          placeholder: 'WEB-APP-01-SNAP',
          required: true,
          span: 1,
        },
        {
          key: 'instanceUUID',
          source: 'HostingVpsInstanceHviUUID',
          payloadKey: 'instanceUUID',
          label: 'Instance',
          type: 'search-select',
          required: true,
          span: 1,
          disabledWhen: ({ editing }) => editing,
        },
        {
          key: 'includeMemory',
          source: 'HvsIncludeMemory',
          payloadKey: 'includeMemory',
          label: 'Include memory',
          type: 'select',
          options: YES_NO_OPTIONS,
          span: 1,
          disabledWhen: ({ editing }) => editing,
          hiddenWhen: ({ editing, values }) =>
            editing || !this.supportsOption(values['instanceUUID'], 'includeMemory'),
        },
        {
          key: 'quiesce',
          source: 'HvsQuiesce',
          payloadKey: 'quiesce',
          label: 'Quiesce',
          type: 'select',
          options: YES_NO_OPTIONS,
          span: 1,
          disabledWhen: ({ editing }) => editing,
          hiddenWhen: ({ editing, values }) =>
            editing || !this.supportsOption(values['instanceUUID'], 'quiesce'),
        },
      ],
      columns: HOSTING_VPS_SNAPSHOT_CONFIG_BASE.columns.map((column) =>
        column.id === 'includeMemory'
          ? {
              ...column,
              hiddenWhen: () => !this.anyLoadedSnapshotUsesMemory(),
            }
          : column,
      ),
    });
    void this.fetchCatalog();
  }

  protected override listEndpoint(): string {
    return this.snapshotEndpoint();
  }

  protected override createEndpoint(): string {
    return this.snapshotEndpoint();
  }

  protected override updateEndpoint(): string {
    return this.snapshotEndpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.snapshotEndpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.snapshotEndpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'instanceUUID') return this.instanceOptions();
    return [];
  }

  override listFilterOptions(filter: ConfigurableCrudListFilter): readonly ConfigurableCrudOption[] {
    if (filter.key === 'instanceUUID') return this.instanceOptions();
    return super.listFilterOptions(filter);
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.instances().length || !Object.keys(this.capabilitiesByProvider()).length) {
      await this.fetchCatalog();
    }

    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    params.set('offset', '0');
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== '' && filters.status !== null && filters.status !== undefined) {
      params.set('isActive', String(filters.status));
    }
    for (const filter of this.listFilters()) {
      const value = filters.extra[filter.key];
      if (value === null || value === undefined || value === '') continue;
      params.set(filter.paramKey ?? filter.key, String(value));
    }

    const response = await this.api.get(`${this.listEndpoint()}?${params.toString()}`);
    const data = (response as { data?: { items?: ConfigurableCrudRecord[] } })?.data;
    return (data?.items ?? []).map((row) => this.enrichSnapshot(row));
  }

  override refreshList() {
    void this.fetchCatalog();
    super.refreshList();
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'instanceUUID') return;
    const caps = this.capabilitiesForInstance(value);
    const reset: ConfigurableCrudRecord = {};
    if (!caps?.includeMemory) reset['includeMemory'] = 0;
    if (!caps?.quiesce) reset['quiesce'] = 0;
    if (Object.keys(reset).length) this.patchFormValues(reset);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const instanceUUID = !this.editingRecord()
      ? payload['instanceUUID']
      : this.editingRecord()?.['HostingVpsInstanceHviUUID'];
    const caps = this.capabilitiesForInstance(instanceUUID);
    const next: ConfigurableCrudRecord = {
      name: payload['name'],
      includeMemory: caps?.includeMemory ? Number(payload['includeMemory']) === 1 : false,
      quiesce: caps?.quiesce ? Number(payload['quiesce']) === 1 : false,
    };
    if (!this.editingRecord()) {
      next['instanceUUID'] = payload['instanceUUID'];
    }
    return next;
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions: ConfigurableCrudRowAction[] = [];
    const uuid = this.recordUUID(row);
    const busy = this.mutatingActionUUIDs().has(uuid);
    if (row['HvsExternalId']) {
      actions.push({
        ...SYNC_ACTION,
        icon: busy ? 'hourglass_top' : 'sync',
      });
    }
    if (String(row['HvsStatus'] ?? '').toLowerCase() === 'available') {
      actions.push({
        ...RESTORE_ACTION,
        icon: busy ? 'hourglass_top' : 'restore',
      });
    }
    return actions;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'sync') {
      await this.syncSnapshot(row);
      return;
    }
    if (action.key === 'restore') {
      await this.restoreSnapshot(row);
    }
  }

  private supportsOption(
    instanceUUID: unknown,
    option: 'includeMemory' | 'quiesce',
  ): boolean {
    return Boolean(this.capabilitiesForInstance(instanceUUID)?.[option]);
  }

  private capabilitiesForInstance(
    instanceUUID: unknown,
  ): SnapshotProviderCapabilities | null {
    const uuid = String(instanceUUID ?? '').trim();
    if (!uuid) return null;
    const instance = this.instances().find((row) => row.HviUUID === uuid);
    const code = String(instance?.ProviderCode ?? '')
      .trim()
      .toLowerCase();
    if (!code) return null;
    return this.capabilitiesByProvider()[code] ?? null;
  }

  private anyLoadedSnapshotUsesMemory(): boolean {
    return this.rows().some((row) => Number(row['HvsIncludeMemory'] ?? 0) === 1);
  }

  private enrichSnapshot(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const providerName = String(row['ProviderName'] ?? '').trim();
    const providerCode = String(row['ProviderCode'] ?? '').trim();
    const providerLabel =
      providerName && providerCode && providerName.toLowerCase() !== providerCode.toLowerCase()
        ? `${providerName} (${providerCode})`
        : providerName || providerCode || '';
    return { ...row, ProviderLabel: providerLabel };
  }

  private async fetchCatalog() {
    await Promise.all([this.fetchInstances(), this.fetchCapabilities()]);
  }

  private async fetchInstances() {
    try {
      const response = await this.api.get<{ data?: { items?: HostingVpsInstance[] } }>(
        `${this.instanceEndpoint()}?status=1&limit=500&offset=0`,
      );
      this.instances.set(response?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load VPS instances.');
    }
  }

  private async fetchCapabilities() {
    try {
      const response = await this.api.get<{
        data?: { providers?: Record<string, SnapshotProviderCapabilities> };
      }>(`${this.snapshotEndpoint()}/capabilities`);
      this.capabilitiesByProvider.set(response?.data?.providers ?? {});
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load snapshot capabilities.');
    }
  }

  private async syncSnapshot(row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!uuid || this.mutatingActionUUIDs().has(uuid)) return;

    this.mutatingActionUUIDs.update((current) => new Set(current).add(uuid));
    this.mutating.set(true);
    try {
      await this.api.post(`${this.snapshotEndpoint()}/${uuid}/sync`, {});
      this.snack.success('VPS snapshot synced successfully.');
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to sync VPS snapshot.');
    } finally {
      this.mutatingActionUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(uuid);
        return next;
      });
      this.mutating.set(false);
    }
  }

  private async restoreSnapshot(row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!uuid || this.mutatingActionUUIDs().has(uuid)) return;

    const name = String(row['HvsName'] ?? '');
    const confirmed = await this.confirmAction(
      'Restore VPS snapshot',
      `Restore snapshot "${name}"? DigitalOcean restores in-place; Lightsail creates a new instance from the snapshot.`,
      'Restore',
    );
    if (!confirmed) return;

    this.mutatingActionUUIDs.update((current) => new Set(current).add(uuid));
    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.snapshotEndpoint()}/${uuid}/restore`, {});
      this.trackOperation(response);
      this.snack.success('VPS snapshot restore queued successfully.');
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to restore VPS snapshot.');
    } finally {
      this.mutatingActionUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(uuid);
        return next;
      });
      this.mutating.set(false);
    }
  }
}

function snapshotStatusChipClass(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'available') return 'chip-success';
  if (['failed', 'queue_failed', 'deleted'].includes(normalized)) return 'chip-warning';
  if (['queued', 'creating', 'restoring', 'deleting'].includes(normalized)) return 'chip-skipped';
  return 'chip-skipped';
}
