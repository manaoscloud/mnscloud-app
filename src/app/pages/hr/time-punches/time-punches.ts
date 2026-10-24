import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

const PUNCH_TYPES: readonly ConfigurableCrudOption[] = [
  { value: 'clock_in', label: 'Clock in' },
  { value: 'break_start', label: 'Break start' },
  { value: 'break_end', label: 'Break end' },
  { value: 'clock_out', label: 'Clock out' },
];

const SOURCES: readonly ConfigurableCrudOption[] = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'web', label: 'Web' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'api', label: 'API' },
];

const FLAGS: Record<string, string> = {
  offline: 'Sent later (offline)',
  late_sync: 'Sent more than 72 h later',
  future_time: 'Device clock ahead (server time used)',
  clock_skew: 'Device clock off by more than 2 min',
  sequence: 'Same mark as the previous one',
};

const PERIODS: readonly ConfigurableCrudOption[] = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function flags(row: ConfigurableCrudRecord): string[] {
  return Array.isArray(row['Flags']) ? (row['Flags'] as string[]) : [];
}

// Read-only view of the immutable Pulse ledger: marks are never edited or deleted here; flags
// point the manager to marks worth checking (treatment arrives with the timesheet phase).
const config = defineCrud({
  endpoint: 'hr/time-punches',
  uuidField: 'TimePunchUUID',
  pageTitle: 'Time Punches',
  pageDescription:
    'Every Pulse mark of your employees, as recorded: official server time, sequential number (NSR) and integrity hash. Marks are never edited or deleted; flags point to the ones worth checking.',
  searchPlaceholder: 'Employee or login code',
  emptyLabel: 'No punches found.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: {},
  listFilters: [
    {
      key: 'days',
      paramKey: 'days',
      label: 'Period',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: PERIODS,
    },
    {
      key: 'employeeUUID',
      paramKey: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: {
        endpoint: 'registry/employees',
        uuidField: 'EmployeeUUID',
        labelField: 'Name',
      },
    },
    {
      key: 'source',
      paramKey: 'source',
      label: 'Source',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: SOURCES,
    },
    {
      key: 'flagged',
      paramKey: 'flagged',
      label: 'Flags',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: [{ value: '1', label: 'Flagged only' }],
    },
  ],
  columns: [
    {
      id: 'occurredAt',
      label: 'Official time',
      field: 'OccurredAt',
      uuidField: 'TimePunchUUID',
      kind: 'datetime',
      rowAction: 'details',
    },
    { id: 'employee', label: 'Employee', field: 'EmployeeName', translateValue: false },
    { id: 'type', label: 'Mark', field: 'Type', options: PUNCH_TYPES },
    { id: 'source', label: 'Source', field: 'Source', options: SOURCES },
    {
      id: 'flags',
      label: 'Flags',
      value: (row, t) =>
        flags(row)
          .map((flag) => t(FLAGS[flag] ?? flag))
          .join(', '),
    },
    {
      id: 'location',
      label: 'Location',
      value: (row, t) =>
        row['Latitude'] !== null && row['Latitude'] !== undefined ? t('Captured') : t('None'),
    },
    { id: 'nsr', label: 'NSR', field: 'NSR', kind: 'number' },
    { id: 'company', label: 'Company', field: 'CompanyName', translateValue: false, optional: true },
    {
      id: 'loginCode',
      label: 'Login code',
      field: 'LoginCode',
      translateValue: false,
      optional: true,
    },
    {
      id: 'received',
      label: 'Received at',
      field: 'ServerReceivedAt',
      kind: 'datetime',
      optional: true,
    },
  ],
  fields: [],
  rowActions: [{ key: 'details', label: 'Details', icon: 'receipt_long', tooltip: 'Details' }],
});

@Component({
  selector: 'app-hr-time-punches',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimePunchesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'details') return;
    const type = PUNCH_TYPES.find((option) => option.value === row['Type'])?.label ?? '';
    const hasLocation = row['Latitude'] !== null && row['Latitude'] !== undefined;
    openDataViewerDialog(this.dialog, {
      title: 'Punch details',
      description: 'The mark as recorded in the immutable ledger.',
      details: [
        { label: 'Employee', value: row['EmployeeName'] ?? '', translate: false },
        { label: 'Mark', value: type },
        { label: 'Official time', value: row['OccurredAt'] ?? '', kind: 'datetime' },
        { label: 'Received at', value: row['ServerReceivedAt'] ?? '', kind: 'datetime' },
        { label: 'Device time', value: row['ClientOccurredAt'] ?? '', kind: 'datetime' },
        { label: 'NSR', value: row['NSR'] ?? '', translate: false },
        {
          label: 'Location',
          value: hasLocation
            ? `${row['Latitude']}, ${row['Longitude']} (± ${row['AccuracyMeters'] ?? '?'} m)`
            : this.t('None'),
          translate: false,
          monospace: hasLocation,
        },
        {
          label: 'Flags',
          value:
            flags(row)
              .map((flag) => this.t(FLAGS[flag] ?? flag))
              .join(', ') || this.t('None'),
          translate: false,
          wide: true,
        },
      ],
      sections: [
        {
          title: 'Integrity hash (SHA-256)',
          code: { value: row['Hash'] ?? '', format: 'text', copy: true },
        },
      ],
    });
  }
}
