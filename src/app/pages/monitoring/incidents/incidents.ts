import { Component, inject } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  DataViewerTone,
  openDataViewerDialog,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { ApiService } from '../../../services/api.service';

const SEVERITY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];

const CATEGORY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'api', label: 'API' },
  { value: 'queue', label: 'Queue' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'agent', label: 'Agent' },
  { value: 'worker', label: 'Worker' },
  { value: 'database', label: 'Database' },
  { value: 'application', label: 'Application' },
  { value: 'platform', label: 'Platform' },
];

function statusChipClass(value: unknown): string {
  switch (String(value || '').toLowerCase()) {
    case 'open':
      return 'badge-critical';
    case 'acknowledged':
      return 'badge-warning';
    case 'resolved':
      return 'badge-success';
    default:
      return 'badge-neutral';
  }
}

function severityChipClass(value: unknown): string {
  switch (String(value || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'badge-critical';
    case 'medium':
      return 'badge-warning';
    case 'low':
      return 'badge-info';
    default:
      return 'badge-neutral';
  }
}

const VIEW_ACTION: ConfigurableCrudRowAction = {
  key: 'view-details',
  label: 'View details',
  icon: 'visibility',
  tooltip: 'View details',
};

const ACKNOWLEDGE_ACTION: ConfigurableCrudRowAction = {
  key: 'acknowledge',
  label: 'Acknowledge',
  icon: 'check_circle',
  tooltip: 'Acknowledge incident',
};

const RESOLVE_ACTION: ConfigurableCrudRowAction = {
  key: 'resolve',
  label: 'Resolve',
  icon: 'done_all',
  tooltip: 'Resolve incident',
};

const INCIDENTS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'monitoring/incidents',
  uuidField: 'IncidentUUID',
  pageTitle: 'Incidents',
  pageDescription: 'Operational incidents, service alerts, and incident response workflow.',
  createTitle: 'New incident',
  editTitle: 'Incident details',
  dialogDescription: 'Operational incident details and timeline.',
  searchPlaceholder: 'Search incidents',
  emptyLabel: 'No incidents found.',
  deleteTitle: 'Delete incident',
  deleteMessage: 'Delete this incident?',
  deleteSelectedTitle: 'Delete incidents',
  deleteSelectedMessage: 'Delete {count} incidents?',
  savedMessage: 'Incident saved successfully.',
  deletedMessage: 'Incident deleted successfully.',
  deleteFailedMessage: 'Unable to delete incident.',
  fields: [],
  columns: [
    { id: 'opened', label: 'Opened', field: 'openedAt', kind: 'datetime' },
    {
      id: 'severity',
      label: 'Severity',
      field: 'severity',
      kind: 'status',
      options: SEVERITY_OPTIONS,
      chipClass: (value) => severityChipClass(value),
    },
    {
      id: 'status',
      label: 'Status',
      field: 'status',
      kind: 'status',
      options: STATUS_OPTIONS,
      chipClass: (value) => statusChipClass(value),
    },
    { id: 'category', label: 'Category', field: 'category' },
    { id: 'title', label: 'Title', field: 'title' },
    { id: 'source', label: 'Source', field: 'source' },
    { id: 'occurrences', label: 'Occurrences', field: 'occurrencesCount' },
    { id: 'lastSeen', label: 'Last seen', field: 'lastSeenAt', kind: 'datetime' },
  ],
  initialValues: {},
  statusMode: 'string',
  activeValue: 'open',
  inactiveValue: 'resolved',
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  serverSidePagination: true,
  initialPageSize: 20,
  rowActions: [VIEW_ACTION, ACKNOWLEDGE_ACTION, RESOLVE_ACTION],
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: STATUS_OPTIONS,
      translateOptions: true,
    },
    {
      key: 'severity',
      label: 'Severity',
      type: 'select',
      options: SEVERITY_OPTIONS,
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
};

@Component({
  selector: 'mns-monitoring-incidents',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class MonitoringIncidentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly apiService = inject(ApiService);

  constructor() {
    super(INCIDENTS_CONFIG);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const status = String(row['status'] || '').toLowerCase();
    if (status === 'resolved') {
      return [VIEW_ACTION];
    }
    if (status === 'acknowledged') {
      return [VIEW_ACTION, RESOLVE_ACTION];
    }
    return [VIEW_ACTION, ACKNOWLEDGE_ACTION, RESOLVE_ACTION];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const incidentUUID = String(row['IncidentUUID'] || row['uuid'] || '');
    if (!incidentUUID) return;

    if (action.key === 'view-details') {
      await this.openIncidentDetails(incidentUUID, row);
      return;
    }

    if (action.key === 'acknowledge') {
      const confirmed = await this.confirmAction(
        'Acknowledge incident',
        `Acknowledge incident "${row['title'] || incidentUUID}"?`,
        'Acknowledge',
      );
      if (!confirmed) return;

      try {
        await this.apiService.post(`monitoring/incidents/${incidentUUID}/acknowledge`, {});
        this.snack.success(this.t('Incident acknowledged successfully.'));
        this.refreshList();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.snack.error(`Failed to acknowledge incident: ${msg}`);
      }
      return;
    }

    if (action.key === 'resolve') {
      const confirmed = await this.confirmAction(
        'Resolve incident',
        `Mark incident "${row['title'] || incidentUUID}" as resolved?`,
        'Resolve',
      );
      if (!confirmed) return;

      try {
        await this.apiService.post(`monitoring/incidents/${incidentUUID}/resolve`, {
          resolutionNotes: 'Resolved from operations dashboard',
        });
        this.snack.success(this.t('Incident resolved successfully.'));
        this.refreshList();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.snack.error(`Failed to resolve incident: ${msg}`);
      }
    }
  }

  private async openIncidentDetails(incidentUUID: string, row: ConfigurableCrudRecord) {
    let incidentData = row;
    try {
      const res = await this.apiService.get<{ data: ConfigurableCrudRecord }>(`monitoring/incidents/${incidentUUID}`);
      if (res && res.data) {
        incidentData = res.data;
      }
    } catch {
      // Fallback to row data
    }

    const events = Array.isArray(incidentData['events']) ? incidentData['events'] : [];

    openDataViewerDialog(this.dialog, {
      title: String(incidentData['title'] || 'Incident details'),
      description: String(incidentData['description'] || 'No description available.'),
      status: {
        label: 'Status',
        value: String(incidentData['status'] || '-'),
        tone: this.incidentTone(incidentData['status']),
      },
      details: [
        { label: 'Severity', value: String(incidentData['severity'] || '-') },
        { label: 'Category', value: String(incidentData['category'] || '-') },
        { label: 'Source', value: String(incidentData['source'] || '-') },
        { label: 'Resource ref', value: String(incidentData['resourceRef'] || '-') },
        { label: 'Opened', value: incidentData['openedAt'], kind: 'datetime' },
        { label: 'Last seen', value: incidentData['lastSeenAt'], kind: 'datetime' },
        { label: 'Occurrences', value: String(incidentData['occurrencesCount'] || '1') },
        { label: 'Acknowledged at', value: incidentData['acknowledgedAt'], kind: 'datetime' },
        { label: 'Acknowledged by', value: String(incidentData['acknowledgedBy'] || '-') },
        { label: 'Resolved at', value: incidentData['resolvedAt'], kind: 'datetime' },
        { label: 'Resolved by', value: String(incidentData['resolvedBy'] || '-') },
        { label: 'Resolution notes', value: String(incidentData['resolutionNotes'] || '-'), wide: true },
        { label: 'Fingerprint', value: String(incidentData['fingerprint'] || '-'), monospace: true, wide: true },
      ],
      sections: [
        {
          title: 'Context',
          code: {
            title: 'Context JSON',
            value: incidentData['context'] ?? incidentData['ContextJson'] ?? {},
            format: 'json',
            copy: true,
          },
        },
        {
          title: 'Timeline Events',
          code: {
            title: 'Events JSON',
            value: events,
            format: 'json',
            copy: true,
          },
        },
      ],
    });
  }

  private incidentTone(status: unknown): DataViewerTone {
    switch (String(status || '').toLowerCase()) {
      case 'open':
        return 'danger';
      case 'acknowledged':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'neutral';
    }
  }
}
