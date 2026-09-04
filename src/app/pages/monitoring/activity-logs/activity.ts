import { Component, computed, inject, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudListFilter,
  ConfigurableCrudListParams,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  DataViewerTone,
  openDataViewerDialog,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { AuthService } from '../../../services/auth.service';

const LEVEL_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'pending', label: 'Pending' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'running', label: 'Running' },
  { value: 'processing', label: 'Processing' },
  { value: 'success', label: 'Success' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

const CATEGORY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'api', label: 'API' },
  { value: 'crud', label: 'CRUD' },
  { value: 'pabx', label: 'PABX' },
  { value: 'security', label: 'Security' },
  { value: 'system', label: 'System' },
  { value: 'voip', label: 'VoIP' },
  { value: 'worker', label: 'Worker' },
];

const VIEW_DETAILS_ACTION: ConfigurableCrudRowAction = {
  key: 'view-details',
  label: 'View details',
  icon: 'visibility',
  tooltip: 'View details',
};

const ACTIVITY_LOGS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'monitoring/activity-logs',
  uuidField: 'uuid',
  pageTitle: 'Activity Logs',
  pageDescription: 'Operational events, process results, and system failures.',
  createTitle: 'New activity log',
  editTitle: 'Activity log',
  dialogDescription: 'Review activity log details.',
  searchPlaceholder: 'Message, action, resource, error',
  emptyLabel: 'No activity logs found.',
  deleteTitle: 'Delete activity log',
  deleteMessage: 'Delete this activity log?',
  deleteSelectedTitle: 'Delete activity logs',
  deleteSelectedMessage: 'Delete {count} activity logs?',
  savedMessage: 'Activity log saved successfully.',
  deletedMessage: 'Activity log deleted successfully.',
  deleteFailedMessage: 'Unable to delete activity log.',
  fields: [],
  columns: [
    { id: 'created', label: 'Created', field: 'dateCreated', kind: 'datetime' },
    {
      id: 'level',
      label: 'Level',
      field: 'level',
      kind: 'status',
      options: LEVEL_OPTIONS,
      chipClass: (value) => activityChipClass(value),
    },
    {
      id: 'status',
      label: 'Status',
      field: 'status',
      kind: 'status',
      options: STATUS_OPTIONS,
      chipClass: (value) => activityChipClass(value),
    },
    { id: 'action', label: 'Action', field: 'action' },
    { id: 'resource', label: 'Resource', field: 'resourceLabel' },
    { id: 'message', label: 'Message', field: 'message' },
    { id: 'duration', label: 'Duration', field: 'durationText' },
  ],
  initialValues: {},
  statusMode: 'string',
  activeValue: 'success',
  inactiveValue: 'failed',
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  rowActions: [VIEW_DETAILS_ACTION],
  listFilters: [
    {
      key: 'environmentUUID',
      label: 'Tenant',
      paramKey: 'environmentUUID',
      type: 'search-select',
      options: [],
      placeholder: 'Search tenant',
      emptyLabel: 'No tenants found.',
    },
    {
      key: 'level',
      label: 'Level',
      type: 'select',
      options: LEVEL_OPTIONS,
      translateOptions: true,
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: CATEGORY_OPTIONS,
      translateOptions: true,
    },
  ],
  serverSidePagination: true,
  initialPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
};

@Component({
  selector: 'app-monitoring-activity-logs',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class MonitoringActivityLogsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly auth = inject(AuthService);
  private readonly tenantLookup = signal<readonly ConfigurableCrudOption[]>([
    { value: '', label: 'All' },
    { value: 'global', label: 'Global/System', searchText: 'global system' },
  ]);
  private readonly loadingTenants = signal(false);

  private readonly isMaster = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('platform.master.access'),
  );

  constructor() {
    super(ACTIVITY_LOGS_CONFIG);
    const tenantFilter = ACTIVITY_LOGS_CONFIG.listFilters?.find(
      (filter) => filter.key === 'environmentUUID',
    );
    if (tenantFilter) tenantFilter.hiddenWhen = () => !this.isMaster();
    if (this.isMaster()) void this.fetchTenantOptions();
  }

  override rowActions(_row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return [VIEW_DETAILS_ACTION];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'view-details') return;
    this.openDetails(row);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'environmentUUID') return this.isMaster() ? this.tenantLookup() : [];
    return [];
  }

  override listFilterLoading(filter: ConfigurableCrudListFilter): boolean {
    return filter.key === 'environmentUUID' ? this.loadingTenants() : false;
  }

  protected override async fetchItems(
    filters: ConfigurableCrudFilters | ConfigurableCrudListParams,
  ): Promise<ConfigurableCrudRecord[]> {
    const params = new URLSearchParams();
    params.set('limit', String((filters as ConfigurableCrudListParams).limit ?? 25));
    params.set('offset', String((filters as ConfigurableCrudListParams).offset ?? 0));
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', String(filters.status));
    for (const [key, value] of Object.entries(filters.extra ?? {})) {
      if (value === null || value === undefined || value === '') continue;
      if (key === 'environmentUUID' && !this.isMaster()) continue;
      params.set(key, String(value));
    }

    const response = await this.api.get<{
      data?: { items?: ConfigurableCrudRecord[]; total?: number };
    }>(`${this.listEndpoint()}?${params.toString()}`);
    const data = response.data ?? {};
    this.serverTotal.set(Number(data.total ?? 0));
    return (data.items ?? []).map((row) => this.decorateRow(row));
  }

  private async fetchTenantOptions() {
    this.loadingTenants.set(true);
    try {
      const response = await this.fetchTenantLookup();
      const tenants: ConfigurableCrudOption[] = [];
      for (const row of response) {
        const value = String(row['EnvironmentUUID'] ?? row['environmentUUID'] ?? '').trim();
        if (!value) continue;
        const name = String(
          row['EnvironmentName'] ?? row['environmentName'] ?? row['TenantEmail'] ?? value,
        ).trim();
        const email = String(row['TenantEmail'] ?? row['tenantEmail'] ?? '').trim();
        tenants.push({
          value,
          label: name || value,
          description: email || value,
          searchText: `${name} ${email} ${value}`,
        });
      }
      this.tenantLookup.set([
        { value: '', label: 'All' },
        { value: 'global', label: 'Global/System', searchText: 'global system' },
        ...tenants,
      ]);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load tenants.');
    } finally {
      this.loadingTenants.set(false);
    }
  }

  private async fetchTenantLookup(): Promise<ConfigurableCrudRecord[]> {
    try {
      const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        'system/billing/tenants?search=&limit=50&offset=0',
      );
      const items = response.data?.items ?? [];
      if (items.length) return items;
    } catch {
      // The billing lookup is master-only; fall back to the environment access contract below.
    }

    const accessResponse = await this.api.get<{ data?: { access?: ConfigurableCrudRecord[] } }>(
      'user/access',
    );
    return accessResponse.data?.access ?? [];
  }

  private decorateRow(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...row,
      environmentName: this.environmentLabel(row),
      resourceLabel: row['resourceLabel'] || row['resourceUUID'] || row['resourceType'] || '-',
      durationText: this.formatDuration(row['durationMs']),
    };
  }

  private openDetails(row: ConfigurableCrudRecord) {
    openDataViewerDialog(this.dialog, {
      title: String(row['action'] || 'Activity log'),
      description: String(row['message'] || 'No message available.'),
      status: {
        label: 'Status',
        value: String(row['status'] || '-'),
        tone: this.viewerTone(row['status'] || row['level']),
      },
      details: [
        { label: 'Created', value: row['dateCreated'], kind: 'datetime' },
        { label: 'Tenant', value: this.environmentLabel(row), wide: true },
        { label: 'Environment UUID', value: row['environmentUUID'], monospace: true, wide: true },
        { label: 'Correlation ID', value: row['correlationID'], monospace: true, wide: true },
        { label: 'Job UUID', value: row['jobUUID'], monospace: true, wide: true },
        { label: 'Actor', value: this.actorLabel(row) },
        { label: 'Source', value: row['source'] },
        { label: 'Category', value: row['category'] },
        {
          label: 'Resource',
          value: `${row['resourceType'] || '-'} / ${row['resourceLabel'] || '-'}`,
        },
        { label: 'Host', value: row['hostname'] },
        { label: 'Duration', value: this.formatDuration(row['durationMs']) },
        { label: 'Error', value: this.errorDetail(row) },
        { label: 'Suggestion', value: row['suggestion'], wide: true },
      ],
      sections: [
        {
          title: 'Record',
          code: {
            title: 'Record',
            value: row['details'] ?? row,
            format: 'json',
            copy: true,
          },
        },
      ],
    });
  }

  private environmentLabel(row: ConfigurableCrudRecord): string {
    const name = String(row['environmentName'] ?? row['EnvironmentName'] ?? '').trim();
    if (name) return name;
    return row['environmentUUID'] ? String(row['environmentUUID']) : 'Global/System';
  }

  private actorLabel(row: ConfigurableCrudRecord): string {
    return [row['actorType'], row['actorName']].filter(Boolean).join(' / ') || '-';
  }

  private formatDuration(value: unknown): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
    const ms = Number(value);
    return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;
  }

  private errorDetail(row: ConfigurableCrudRecord): string {
    return [row['errorCode'], row['errorMessage']].filter(Boolean).join(' ') || '-';
  }

  private viewerTone(value: unknown): DataViewerTone {
    const normalized = String(value ?? '').toLowerCase();
    if (['success', 'completed'].includes(normalized)) return 'success';
    if (['failed', 'error', 'critical'].includes(normalized)) return 'danger';
    if (['warn', 'warning', 'skipped'].includes(normalized)) return 'warning';
    if (['running', 'processing', 'queued', 'pending', 'waiting', 'info'].includes(normalized)) {
      return 'info';
    }
    return 'neutral';
  }
}

function activityChipClass(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase();
  if (['success', 'completed'].includes(normalized)) return 'chip-success';
  if (['failed', 'error', 'critical'].includes(normalized)) return 'chip-danger';
  if (['warn', 'warning', 'skipped'].includes(normalized)) return 'chip-warning';
  if (['running', 'processing', 'queued', 'pending', 'waiting', 'info'].includes(normalized)) {
    return 'chip-running';
  }
  return 'chip-skipped';
}
