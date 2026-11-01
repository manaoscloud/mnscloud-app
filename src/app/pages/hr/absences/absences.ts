import { Component } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { ABSENCE_TYPES, formatDay, openBlob } from '../hr-time';

const EMPLOYEE_LOOKUP = {
  endpoint: 'hr/employees',
  uuidField: 'RemUUID',
  labelField: 'RemName',
  selectedLabelField: 'EmployeeName',
};

const SOURCES = [
  { value: 'manager', label: 'Recorded by HR' },
  { value: 'request', label: 'Employee request' },
] as const;

const ATTACH: ConfigurableCrudRowAction = {
  key: 'attach',
  label: 'Attach certificate',
  icon: 'upload_file',
};
const CERTIFICATE: ConfigurableCrudRowAction = {
  key: 'certificate',
  label: 'View certificate',
  icon: 'attach_file',
};

// Whole-day absences of the account's employees (medical certificate, justified absence, day off,
// leave). A covered workday has no absence, lateness or early leave in the timesheet; extra work on
// that day still counts. The certificate is a private file; no CID is recorded.
const config = defineCrud({
  endpoint: 'hr/absences',
  uuidField: 'AbsenceUUID',
  pageTitle: 'Absences',
  pageDescription:
    'Absences justified by a medical certificate, justified absences, days off and leaves. The timesheet does not count a covered workday as an absence.',
  createTitle: 'New absence',
  editTitle: 'Edit absence',
  searchPlaceholder: 'Employee or reason',
  emptyLabel: 'No absences found.',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  canEditRow: (row) => row['Source'] !== 'request',
  initialValues: {
    employeeUUID: '',
    type: 'medical_certificate',
    startDate: '',
    endDate: '',
    reason: '',
    attachmentUUID: null,
    revision: null,
  },
  listFilters: [
    {
      key: 'type',
      paramKey: 'type',
      label: 'Type',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: ABSENCE_TYPES,
    },
    {
      key: 'employeeUUID',
      paramKey: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: EMPLOYEE_LOOKUP,
    },
  ],
  rowActions: [ATTACH, CERTIFICATE],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'AbsenceUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'type', label: 'Type', field: 'Type', options: ABSENCE_TYPES },
    {
      id: 'start',
      label: 'Start date',
      field: 'StartDate',
      value: (row) => formatDay(row['StartDate']),
    },
    { id: 'end', label: 'End date', field: 'EndDate', value: (row) => formatDay(row['EndDate']) },
    { id: 'days', label: 'Days', field: 'Days', kind: 'number' },
    { id: 'certificate', label: 'Certificate', field: 'AttachmentFileName', translateValue: false },
    { id: 'source', label: 'Origin', field: 'Source', options: SOURCES },
    { id: 'reason', label: 'Reason', field: 'Reason', translateValue: false },
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
      disabledWhen: (context) => Boolean(context.editing),
    },
    {
      key: 'type',
      source: 'Type',
      label: 'Type',
      type: 'select',
      options: ABSENCE_TYPES,
      required: true,
      span: 1,
    },
    {
      key: 'startDate',
      source: 'StartDate',
      label: 'Start date',
      type: 'date',
      required: true,
      span: 1,
    },
    {
      key: 'endDate',
      source: 'EndDate',
      label: 'End date',
      type: 'date',
      span: 1,
      help: 'Empty: a single day. At most 366 days.',
    },
    {
      key: 'reason',
      source: 'Reason',
      label: 'Reason',
      type: 'textarea',
      span: 4,
      rows: 4,
      help: 'Do not write the disease or its CID.',
    },
    {
      key: 'attachmentUUID',
      source: 'AttachmentUUID',
      label: 'Certificate',
      hiddenWhen: () => true,
    },
    { key: 'revision', source: 'Revision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  payload: (values) => ({
    employeeUUID: values['employeeUUID'] || null,
    type: values['type'],
    startDate: values['startDate'],
    endDate: values['endDate'] || values['startDate'],
    reason: values['reason'] || null,
    attachmentUUID: values['attachmentUUID'] || null,
    revision: values['revision'],
  }),
});

/** Asks for one PNG, JPEG, WEBP or PDF file; null when the user closes the picker. */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/png,image/jpeg,image/webp';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

@Component({
  selector: 'app-hr-absences',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrAbsencesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return row['AttachmentUUID'] ? [ATTACH, CERTIFICATE] : [ATTACH];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!uuid) return;
    try {
      if (action.key === CERTIFICATE.key) {
        openBlob(await this.api.getBlob(`hr/absences/${uuid}/attachment`));
        return;
      }
      if (action.key !== ATTACH.key) return;
      const file = await pickFile();
      if (!file) return;
      const body = new FormData();
      body.append('revision', String(row['Revision']));
      body.append('attachmentUUID', crypto.randomUUID());
      body.append('file', file);
      await lastValueFrom(this.api.postFormWithProgress(`hr/absences/${uuid}/attachment`, body));
      this.snack.success(this.t('Certificate attached.'));
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
