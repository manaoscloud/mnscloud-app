import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

const COMPANY_LOOKUP = {
  endpoint: 'hr/companies',
  uuidField: 'RcoUUID',
  labelField: 'RcoName',
  selectedLabelField: 'CompanyName',
};

const STATES: readonly ConfigurableCrudOption[] = [
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
  { value: 'inactive', label: 'Inactive' },
];

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: '0', label: 'No' },
  { value: '1', label: 'Yes' },
];

const READS: ConfigurableCrudRowAction = { key: 'reads', label: 'Who read it', icon: 'visibility' };

/** A local day (YYYY-MM-DD) as the UTC instant of its midnight in the browser time zone. */
function dayStart(value: unknown): string | null {
  const text = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** The browser-local day of a UTC instant, for the date fields. */
function localDay(value: unknown): string {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

// Company notices shown in Pulse (F6), to every employee of the HR account or to one company,
// between the publication day and the optional end day. A notice may ask for acknowledgement;
// once an employee acknowledged it, its text is frozen (publish a new notice instead).
const config = defineCrud({
  endpoint: 'hr/notices',
  uuidField: 'NoticeUUID',
  pageTitle: 'Notices',
  pageDescription:
    'Company notices the employees read in Pulse, with who read and acknowledged each one.',
  createTitle: 'New notice',
  editTitle: 'Edit notice',
  searchPlaceholder: 'Title or text',
  emptyLabel: 'No notices found.',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {
    title: '',
    body: '',
    companyUUID: '',
    requiresAck: '0',
    publishDay: '',
    expiresDay: '',
    status: 1,
    revision: null,
  },
  rowActions: [READS],
  columns: [
    {
      id: 'title',
      label: 'Title',
      field: 'Title',
      uuidField: 'NoticeUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'state', label: 'Status', field: 'State', options: STATES },
    {
      id: 'company',
      label: 'Company',
      value: (row, t) => (row['CompanyName'] ? String(row['CompanyName']) : t('All')),
    },
    { id: 'publish', label: 'Published at', field: 'PublishAt', kind: 'datetime' },
    { id: 'expires', label: 'Expires at', field: 'ExpiresAt', kind: 'datetime' },
    {
      id: 'ack',
      label: 'Acknowledgement',
      value: (row, t) => (row['RequiresAck'] ? t('Asked') : t('Not asked')),
    },
    { id: 'reads', label: 'Reads', field: 'ReadCount', kind: 'number' },
    { id: 'acks', label: 'Acknowledgements', field: 'AcknowledgedCount', kind: 'number' },
  ],
  fields: [
    {
      key: 'title',
      source: 'Title',
      label: 'Title',
      type: 'text',
      required: true,
      span: 1,
    },
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
      span: 1,
      help: 'Empty: every employee of the account.',
    },
    {
      key: 'requiresAck',
      source: 'RequiresAck',
      label: 'Ask for acknowledgement',
      type: 'select',
      options: YES_NO,
      span: 1,
      fromRecord: (value) => (value ? '1' : '0'),
    },
    {
      key: 'publishDay',
      source: 'PublishAt',
      label: 'Publish on',
      type: 'date',
      span: 1,
      help: 'Empty: now.',
      fromRecord: (value) => localDay(value),
    },
    {
      key: 'expiresDay',
      source: 'ExpiresAt',
      label: 'Show until',
      type: 'date',
      span: 1,
      help: 'Empty: no end. The notice disappears at the start of this day.',
      fromRecord: (value) => localDay(value),
    },
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    {
      key: 'body',
      source: 'Body',
      label: 'Text',
      type: 'textarea',
      required: true,
      span: 4,
      rows: 4,
    },
    { key: 'revision', source: 'Revision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  payload: (values) => ({
    title: values['title'],
    body: values['body'],
    companyUUID: values['companyUUID'] || null,
    requiresAck: values['requiresAck'] === '1',
    publishAt: dayStart(values['publishDay']),
    expiresAt: dayStart(values['expiresDay']),
    status: Number(values['status'] ?? 1) === 1 ? 1 : 0,
    revision: values['revision'],
  }),
});

@Component({
  selector: 'app-hr-notices',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrNoticesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== READS.key) return;
    const uuid = this.recordUUID(row);
    if (!uuid) return;
    try {
      const response = await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
        `hr/notices/${uuid}/reads?limit=500`,
      );
      openDataViewerDialog(this.dialog, {
        title: 'Who read it',
        description: 'Employees who opened the notice in Pulse and when they acknowledged it.',
        details: [
          { label: 'Title', value: row['Title'] ?? '', translate: false },
          { label: 'Reads', value: String(row['ReadCount'] ?? 0), translate: false },
          {
            label: 'Acknowledgements',
            value: String(row['AcknowledgedCount'] ?? 0),
            translate: false,
          },
        ],
        sections: [
          {
            title: 'Employees',
            table: {
              columns: [
                { key: 'EmployeeName', label: 'Employee', translate: false },
                { key: 'ReadAt', label: 'Read at', kind: 'datetime' },
                { key: 'AcknowledgedAt', label: 'Acknowledged at', kind: 'datetime' },
              ],
              rows: response?.data?.items ?? [],
              emptyLabel: 'Nobody read this notice yet.',
            },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
