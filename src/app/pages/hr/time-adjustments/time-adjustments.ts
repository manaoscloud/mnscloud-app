import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { PUNCH_TYPES, formatDay, formatInstant, optionLabel } from '../hr-time';

const EMPLOYEE_LOOKUP = {
  endpoint: 'hr/employees',
  uuidField: 'RemUUID',
  labelField: 'RemName',
  selectedLabelField: 'EmployeeName',
};

const KINDS = [
  { value: 'include', label: 'Included mark' },
  { value: 'disregard', label: 'Disregarded punch' },
] as const;

const STATES = [
  { value: 'active', label: 'Active' },
  { value: 'revoked', label: 'Revoked' },
] as const;

const SOURCES = [
  { value: 'manager', label: 'Recorded by HR' },
  { value: 'request', label: 'Employee request' },
] as const;

const SHOW_REVOKED = [{ value: '1', label: 'Yes' }] as const;

/** The mark the treatment adds, or the original punch it disregards. */
function markOf(row: ConfigurableCrudRecord, translate: (key: string) => string): string {
  const included = row['Kind'] === 'include';
  const type = included ? row['PunchType'] : row['DisregardedPunchType'];
  const at = included ? row['OccurredAt'] : row['DisregardedOccurredAt'];
  return `${translate(optionLabel(PUNCH_TYPES, type))} ${formatInstant(at)}`;
}

// Treated marks of the timesheet (Portaria 671): a mark included by HR or by an approved request,
// or a punch disregarded after a contest. The original punch is never changed; a treatment is not
// edited, it is revoked with a reason and stays as trail.
const config = defineCrud({
  endpoint: 'hr/time-adjustments',
  uuidField: 'AdjustmentUUID',
  pageTitle: 'Treated marks',
  pageDescription:
    'Marks included in the timesheet and punches disregarded, with author and reason. The original punches never change; revoke a treatment to undo it.',
  createTitle: 'Include mark',
  editTitle: 'Revoke treatment',
  searchPlaceholder: 'Employee or reason',
  emptyLabel: 'No treated marks found.',
  savedMessage: 'Treatment saved.',
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  canEditRow: (row) => row['Status'] === 'active',
  initialValues: {
    employeeUUID: '',
    date: '',
    time: '',
    punchType: 'clock_out',
    reason: '',
    revokeReason: '',
    revision: null,
  },
  listFilters: [
    {
      key: 'employeeUUID',
      paramKey: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: EMPLOYEE_LOOKUP,
    },
    {
      key: 'includeRevoked',
      paramKey: 'includeRevoked',
      label: 'Show revoked',
      type: 'select',
      span: 1,
      emptyLabel: 'No',
      options: SHOW_REVOKED,
    },
  ],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'AdjustmentUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'date', label: 'Date', field: 'Date', value: (row) => formatDay(row['Date']) },
    { id: 'kind', label: 'Treatment', field: 'Kind', options: KINDS },
    { id: 'mark', label: 'Mark', field: 'Kind', value: (row, translate) => markOf(row, translate) },
    { id: 'reason', label: 'Reason', field: 'Reason', translateValue: false },
    { id: 'source', label: 'Origin', field: 'Source', options: SOURCES },
    { id: 'author', label: 'Author', field: 'CreatedByName', translateValue: false },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status', options: STATES },
  ],
  fields: [
    {
      key: 'employeeUUID',
      source: 'EmployeeUUID',
      label: 'Employee',
      type: 'search-select',
      remoteLookup: EMPLOYEE_LOOKUP,
      quickCreate: quickCreateFor('RegEmployeeRemUUID'),
      required: true,
      span: 1,
      hiddenWhen: (context) => context.editing,
    },
    {
      key: 'date',
      label: 'Date',
      type: 'date',
      required: true,
      span: 1,
      hiddenWhen: (context) => context.editing,
    },
    {
      key: 'time',
      label: 'Time',
      type: 'time',
      required: true,
      span: 1,
      help: 'Local time of the employee time policy.',
      hiddenWhen: (context) => context.editing,
    },
    {
      key: 'punchType',
      label: 'Mark',
      type: 'select',
      options: PUNCH_TYPES,
      required: true,
      span: 1,
      hiddenWhen: (context) => context.editing,
    },
    {
      key: 'reason',
      label: 'Reason',
      type: 'textarea',
      required: true,
      span: 4,
      rows: 4,
      hiddenWhen: (context) => context.editing,
    },
    {
      key: 'revokeReason',
      label: 'Reason for revoking',
      type: 'textarea',
      span: 4,
      rows: 4,
      requiredWhen: (context) => context.editing,
      hiddenWhen: (context) => !context.editing,
    },
    { key: 'revision', source: 'Revision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  payload: (values, editing) =>
    editing
      ? { reason: values['revokeReason'], revision: values['revision'] }
      : {
          employeeUUID: values['employeeUUID'],
          kind: 'include',
          date: values['date'],
          time: values['time'],
          punchType: values['punchType'],
          reason: values['reason'],
        },
});

@Component({
  selector: 'app-hr-time-adjustments',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimeAdjustmentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
