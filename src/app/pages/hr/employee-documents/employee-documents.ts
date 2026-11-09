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
import { openBlob } from '../hr-time';

const EMPLOYEE_LOOKUP = {
  endpoint: 'hr/employees',
  uuidField: 'RemUUID',
  labelField: 'RemName',
  selectedLabelField: 'EmployeeName',
};

export const DOCUMENT_KINDS: readonly ConfigurableCrudOption[] = [
  { value: 'document', label: 'Document' },
  { value: 'warning', label: 'Warning' },
  { value: 'payslip', label: 'Payslip' },
  { value: 'employee', label: 'Sent by the employee' },
];

const PUBLISH_KINDS = DOCUMENT_KINDS.filter((kind) => kind.value !== 'employee');

export const DOCUMENT_STATES: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Acknowledgement pending' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'received', label: 'To review' },
  { value: 'reviewed', label: 'Reviewed' },
];

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: '0', label: 'No' },
  { value: '1', label: 'Yes' },
];

const FILE: ConfigurableCrudRowAction = { key: 'file', label: 'Open file', icon: 'attach_file' };
const REVIEW: ConfigurableCrudRowAction = {
  key: 'review',
  label: 'Mark as reviewed',
  icon: 'fact_check',
};
const DETAILS: ConfigurableCrudRowAction = {
  key: 'details',
  label: 'Acknowledgement',
  icon: 'verified',
};

const kindOf = (values: ConfigurableCrudRecord) => String(values['kind'] ?? '');

// Documents of the employees in Pulse (F6): HR publishes documents, warnings and payslips (PDF per
// competence); warnings and payslips always ask for the employee acknowledgement, which is
// recorded with the time, the device and a checksum of what was seen. Employees also send
// documents to HR here. An acknowledged document is final and cannot be withdrawn.
const config = defineCrud({
  endpoint: 'hr/employee-documents',
  uuidField: 'DocumentUUID',
  pageTitle: 'Employee documents',
  pageDescription:
    'Documents, warnings and payslips the employees see and acknowledge in Pulse, and the documents they send to HR.',
  createTitle: 'Publish document',
  searchPlaceholder: 'Employee, title or competence',
  emptyLabel: 'No documents found.',
  canEdit: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  canDeleteRow: (row) => row['Source'] === 'app' && !row['AcknowledgedAt'],
  createUpload: { fileField: 'file', formField: 'file', includeFields: true, optional: true },
  initialValuesFactory: () => ({
    documentUUID: crypto.randomUUID(),
    employeeUUID: '',
    kind: 'payslip',
    title: '',
    competence: '',
    requiresAck: '0',
    description: '',
    file: null,
  }),
  listFilters: [
    {
      key: 'kind',
      paramKey: 'kind',
      label: 'Type',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: DOCUMENT_KINDS,
    },
    {
      key: 'state',
      paramKey: 'state',
      label: 'Status',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: DOCUMENT_STATES,
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
  rowActions: [FILE, REVIEW, DETAILS],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'DocumentUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'kind', label: 'Type', field: 'Kind', options: DOCUMENT_KINDS },
    { id: 'title', label: 'Title', field: 'Title', translateValue: false },
    { id: 'competence', label: 'Competence', field: 'Competence', translateValue: false },
    { id: 'state', label: 'Status', field: 'State', options: DOCUMENT_STATES },
    { id: 'acknowledged', label: 'Acknowledged at', field: 'AcknowledgedAt', kind: 'datetime' },
    { id: 'created', label: 'Sent at', field: 'DateCreated', kind: 'datetime' },
    {
      id: 'file',
      label: 'File',
      field: 'FileName',
      translateValue: false,
      optional: true,
    },
  ],
  fields: [
    {
      key: 'employeeUUID',
      label: 'Employee',
      type: 'search-select',
      remoteLookup: EMPLOYEE_LOOKUP,
      required: true,
      span: 1,
    },
    {
      key: 'kind',
      label: 'Type',
      type: 'select',
      options: PUBLISH_KINDS,
      required: true,
      span: 1,
    },
    {
      key: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      span: 1,
    },
    {
      key: 'competence',
      label: 'Competence',
      type: 'text',
      placeholder: 'YYYY-MM',
      help: 'Month of the payslip, for example 2026-10.',
      span: 1,
      hiddenWhen: ({ values }) => kindOf(values) !== 'payslip',
      requiredWhen: ({ values }) => kindOf(values) === 'payslip',
    },
    {
      key: 'requiresAck',
      label: 'Ask for acknowledgement',
      type: 'select',
      options: YES_NO,
      span: 1,
      help: 'Warnings and payslips always ask for it.',
      hiddenWhen: ({ values }) => kindOf(values) !== 'document',
    },
    {
      key: 'file',
      label: 'File',
      type: 'file',
      accept: 'application/pdf,image/jpeg,image/png,image/webp',
      help: 'PDF or image up to 10 MB. Optional for a warning.',
      span: 1,
      requiredWhen: ({ values }) => kindOf(values) !== 'warning',
    },
    {
      key: 'description',
      label: 'Text',
      type: 'textarea',
      span: 4,
      rows: 4,
      help: 'Required for a warning: the employee reads it before acknowledging.',
      requiredWhen: ({ values }) => kindOf(values) === 'warning',
    },
    { key: 'documentUUID', label: 'Document', hiddenWhen: () => true },
  ],
  payload: (values) => ({
    documentUUID: values['documentUUID'],
    employeeUUID: values['employeeUUID'] || null,
    kind: values['kind'],
    title: values['title'],
    competence: kindOf(values) === 'payslip' ? values['competence'] || null : null,
    requiresAck: kindOf(values) === 'document' ? values['requiresAck'] === '1' : null,
    description: values['description'] || null,
    file: values['file'] ?? null,
  }),
});

@Component({
  selector: 'app-hr-employee-documents',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrEmployeeDocumentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return [
      ...(row['HasFile'] ? [FILE] : []),
      ...(row['State'] === 'received' ? [REVIEW] : []),
      ...(row['Kind'] !== 'employee' ? [DETAILS] : []),
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!uuid) return;
    try {
      if (action.key === FILE.key) {
        openBlob(await this.api.getBlob(`hr/employee-documents/${uuid}/file`));
        return;
      }
      if (action.key === REVIEW.key) {
        await this.api.post(`hr/employee-documents/${uuid}/review`, {
          revision: row['Revision'],
        });
        this.snack.success(this.t('Document reviewed.'));
        this.refreshList();
        return;
      }
      if (action.key !== DETAILS.key) return;
      const state = DOCUMENT_STATES.find((s) => s.value === row['State'])?.label ?? '';
      openDataViewerDialog(this.dialog, {
        title: 'Acknowledgement',
        description: 'What the employee saw and when, as recorded by Pulse.',
        details: [
          { label: 'Employee', value: row['EmployeeName'] ?? '', translate: false },
          { label: 'Title', value: row['Title'] ?? '', translate: false },
          { label: 'Status', value: state },
          { label: 'Sent at', value: row['DateCreated'] ?? '', kind: 'datetime' },
          { label: 'Viewed at', value: row['ViewedAt'] ?? '', kind: 'datetime' },
          { label: 'Acknowledged at', value: row['AcknowledgedAt'] ?? '', kind: 'datetime' },
          { label: 'IP address', value: row['AckIp'] ?? '—', translate: false, monospace: true },
          { label: 'Device', value: row['AckUserAgent'] ?? '—', translate: false, wide: true },
        ],
        sections: [
          ...(row['Description'] ? [{ title: 'Text', message: String(row['Description']) }] : []),
          ...(row['AckChecksum']
            ? [
                {
                  title: 'Acknowledgement checksum (SHA-256)',
                  code: { value: row['AckChecksum'], format: 'text' as const, copy: true },
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
