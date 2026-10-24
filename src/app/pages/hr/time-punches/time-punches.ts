import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { PUNCH_FLAGS, PUNCH_TYPES } from '../hr-time';
import { openPunchMapDialog, punchLocations } from './punch-map-dialog';

const SOURCES: readonly ConfigurableCrudOption[] = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'web', label: 'Web' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'api', label: 'API' },
];

const PERIODS: readonly ConfigurableCrudOption[] = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const hasLocation = (row: ConfigurableCrudRecord) =>
  row['Latitude'] !== null && row['Latitude'] !== undefined;

/** Map of the punches of the current page that carry a captured location. */
const MAP_ACTION: ConfigurableCrudFilterAction = {
  key: 'map',
  label: 'Map',
  icon: 'map',
  tooltip: 'Locations of the punches on this page',
};

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
    { id: 'type', label: 'Punch type', field: 'Type', options: PUNCH_TYPES },
    { id: 'source', label: 'Source', field: 'Source', options: SOURCES },
    {
      id: 'flags',
      label: 'Flags',
      value: (row, t) =>
        flags(row)
          .map((flag) => t(PUNCH_FLAGS[flag] ?? flag))
          .join(', '),
    },
    {
      id: 'location',
      label: 'Location',
      value: (row, t) => (hasLocation(row) ? t('Captured') : t('None')),
      rowAction: 'map',
    },
    { id: 'nsr', label: 'NSR', field: 'NSR', kind: 'number' },
    {
      id: 'company',
      label: 'Company',
      field: 'CompanyName',
      translateValue: false,
      optional: true,
    },
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
  filterActions: [MAP_ACTION],
  rowActions: [
    { key: 'details', label: 'Details', icon: 'receipt_long', tooltip: 'Details' },
    {
      key: 'map',
      label: 'Show on map',
      icon: 'location_on',
      tooltip: 'Location captured with this punch',
      visible: hasLocation,
    },
  ],
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

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== MAP_ACTION.key) return;
    const punches = punchLocations(this.visibleRows(), (type) => this.punchType(type));
    if (!punches.length) {
      this.snack.info(this.t('No punch on this page has a captured location.'));
      return;
    }
    await openPunchMapDialog(this.dialog, { title: 'Punch locations', punches });
  }

  private punchType(type: unknown): string {
    return this.t(PUNCH_TYPES.find((option) => option.value === type)?.label ?? String(type ?? ''));
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'map') {
      const punches = punchLocations([row], (type) => this.punchType(type));
      if (punches.length)
        await openPunchMapDialog(this.dialog, { title: 'Punch location', punches });
      return;
    }
    if (action.key !== 'details') return;
    const type = PUNCH_TYPES.find((option) => option.value === row['Type'])?.label ?? '';
    const located = hasLocation(row);
    openDataViewerDialog(this.dialog, {
      title: 'Punch details',
      description: 'The mark as recorded in the immutable ledger.',
      details: [
        { label: 'Employee', value: row['EmployeeName'] ?? '', translate: false },
        { label: 'Punch type', value: type },
        { label: 'Official time', value: row['OccurredAt'] ?? '', kind: 'datetime' },
        { label: 'Received at', value: row['ServerReceivedAt'] ?? '', kind: 'datetime' },
        { label: 'Device time', value: row['ClientOccurredAt'] ?? '', kind: 'datetime' },
        { label: 'NSR', value: row['NSR'] ?? '', translate: false },
        {
          label: 'Location',
          value: located
            ? `${row['Latitude']}, ${row['Longitude']} (± ${row['AccuracyMeters'] ?? '?'} m)`
            : this.t('None'),
          translate: false,
          monospace: located,
        },
        {
          label: 'Flags',
          value:
            flags(row)
              .map((flag) => this.t(PUNCH_FLAGS[flag] ?? flag))
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
