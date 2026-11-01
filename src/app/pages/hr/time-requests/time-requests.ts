import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  ABSENCE_TYPES,
  PUNCH_TYPES,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  formatDay,
  formatInstant,
  openBlob,
  optionLabel,
} from '../hr-time';

const DECISIONS = [
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
] as const;

const CERTIFICATE: ConfigurableCrudRowAction = {
  key: 'certificate',
  label: 'View certificate',
  icon: 'attach_file',
};

const readOnly = () => true;

/** What the employee asked, in one line: the mark, the contested punch or the absence days. */
function requestDetail(row: ConfigurableCrudRecord, translate: (key: string) => string): string {
  const type = String(row['Type'] ?? '');
  if (type === 'missing_punch') {
    return `${translate(optionLabel(PUNCH_TYPES, row['PunchType']))} ${formatInstant(row['OccurredAt'])}`;
  }
  if (type === 'punch_contest') {
    return `${translate(optionLabel(PUNCH_TYPES, row['ContestedPunchType']))} ${formatInstant(row['ContestedOccurredAt'])}`;
  }
  const end =
    row['EndDate'] && row['EndDate'] !== row['Date'] ? ` – ${formatDay(row['EndDate'])}` : '';
  return `${translate(optionLabel(ABSENCE_TYPES, row['AbsenceType']))}: ${formatDay(row['Date'])}${end}`;
}

// Requests sent by employees in Pulse. The reseller HR decides every request of the account; the
// App responsible of a department only those of its department (checked by the API). Approving
// records the treated mark, the disregarded punch or the absence; the original punch never changes.
const config = defineCrud({
  endpoint: 'hr/time-requests',
  uuidField: 'RequestUUID',
  pageTitle: 'Requests',
  pageDescription:
    'Missing marks, punch contests and absences sent by employees in Pulse. Approve to record the treatment or the absence in the timesheet, or reject with a note the employee will see.',
  editTitle: 'Decide request',
  searchPlaceholder: 'Employee or reason',
  emptyLabel: 'No requests found.',
  savedMessage: 'Request decided.',
  canCreate: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  canEditRow: (row) => row['CanDecide'] === true,
  initialValues: { decision: 'approve', note: '', revision: null },
  listFilters: [
    {
      key: 'status',
      paramKey: 'status',
      label: 'Status',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: REQUEST_STATUSES,
    },
    {
      key: 'type',
      paramKey: 'type',
      label: 'Type',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: REQUEST_TYPES,
    },
  ],
  rowActions: [CERTIFICATE],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'RequestUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'type', label: 'Type', field: 'Type', options: REQUEST_TYPES },
    {
      id: 'detail',
      label: 'Details',
      field: 'Date',
      value: (row, translate) => requestDetail(row, translate),
    },
    { id: 'reason', label: 'Reason', field: 'Reason', translateValue: false },
    {
      id: 'department',
      label: 'Department',
      field: 'DepartmentName',
      translateValue: false,
    },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status', options: REQUEST_STATUSES },
    { id: 'note', label: 'Decision note', field: 'DecisionNote', translateValue: false },
    {
      id: 'decidedBy',
      label: 'Decided by',
      field: 'DecidedByName',
      translateValue: false,
    },
  ],
  fields: [
    {
      key: 'employee',
      source: 'EmployeeName',
      label: 'Employee',
      span: 1,
      disabledWhen: readOnly,
    },
    {
      key: 'type',
      source: 'Type',
      label: 'Type',
      type: 'select',
      options: REQUEST_TYPES,
      span: 1,
      disabledWhen: readOnly,
    },
    {
      key: 'reason',
      source: 'Reason',
      label: 'Reason',
      type: 'textarea',
      span: 4,
      rows: 4,
      disabledWhen: readOnly,
    },
    {
      key: 'decision',
      label: 'Decision',
      type: 'select',
      options: DECISIONS,
      required: true,
      span: 1,
      breakBefore: true,
    },
    {
      key: 'note',
      label: 'Decision note',
      type: 'textarea',
      span: 4,
      rows: 4,
      help: 'Shown to the employee in Pulse. Required to reject.',
      requiredWhen: (context) => context.values['decision'] === 'reject',
    },
    { key: 'revision', source: 'Revision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  payload: (values) => ({
    decision: values['decision'],
    note: values['note'] || null,
    revision: values['revision'],
  }),
});

@Component({
  selector: 'app-hr-time-requests',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimeRequestsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return row['AttachmentUUID'] ? [CERTIFICATE] : [];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (action.key !== CERTIFICATE.key || !uuid) return;
    try {
      openBlob(await this.api.getBlob(`hr/time-requests/${uuid}/attachment`));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
