import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { inboxOptionLabel, openInboxViewer, text } from '../../website/shared/website-inbox';
import { HR_REVISION_FIELD } from '../hr-crud-shared';

export const HR_APPLICATION_STAGE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'new', label: 'New' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export const HR_APPLICATION_RATING_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Not rated' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
];

const VIEW: ConfigurableCrudRowAction = { key: 'view', label: 'View details', icon: 'visibility' };
const CV: ConfigurableCrudRowAction = { key: 'cv', label: 'Download CV', icon: 'download' };

const OPENING_LOOKUP = {
  endpoint: 'hr/recruiting/openings',
  uuidField: 'OpeningUUID',
  labelField: 'Title',
  selectedLabelField: 'OpeningTitle',
};

/** Rating 1..5 or null when empty or out of range. */
export function ratingOf(value: unknown): number | null {
  const raw = text(value);
  if (raw === '') return null;
  const rating = Number(raw);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

/**
 * Update sends only the revision, stage, rating and notes; creating (a candidate typed by HR,
 * sent as multipart with the CV file) sends the candidate fields.
 */
export function applicationPayload(
  values: Record<string, unknown>,
  editing: boolean,
): Record<string, unknown> {
  if (editing) {
    return {
      revision: Number(values['revision']),
      stage: text(values['stage']),
      rating: ratingOf(values['rating']),
      notes: text(values['notes']),
    };
  }
  return {
    openingUUID: values['openingUUID'] || null,
    name: text(values['name']),
    email: text(values['email']),
    phone: text(values['phone']),
    city: text(values['city']),
    linkedinUrl: text(values['linkedinUrl']),
    message: text(values['message']),
    file: values['file'] ?? null,
  };
}

/** Saves a blob through the browser download, named after the CV file. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Candidate data is typed only when HR adds a candidate; editing follows up the application. */
const HIDE_WHEN_EDITING = ({ editing }: { editing: boolean }) => editing;
const CANDIDATE_TEXT = (key: string, label: string, extra: object = {}) => ({
  key,
  source: key.charAt(0).toUpperCase() + key.slice(1),
  label,
  span: 1 as const,
  hiddenWhen: HIDE_WHEN_EDITING,
  ...extra,
});

/** Applications sent from the careers page or typed by HR, followed through the hiring stages. */
const config = defineCrud({
  endpoint: 'hr/recruiting/applications',
  uuidField: 'ApplicationUUID',
  pageTitle: 'Applications',
  pageDescription:
    'Candidates who applied through your careers page or were added by HR. Follow each one through the hiring stages and download the CV.',
  createTitle: 'Add candidate',
  editTitle: 'Follow up application',
  dialogDescription: 'Update the stage and rating of the candidate and keep internal notes.',
  searchPlaceholder: 'Name, e-mail, phone or city',
  emptyLabel: 'No applications found',
  deleteTitle: 'Delete application',
  deleteMessage: 'Delete this application?',
  deleteSelectedTitle: 'Delete applications',
  deleteSelectedMessage: 'Delete {count} selected applications?',
  savedMessage: 'Application saved.',
  deletedMessage: 'Application deleted.',
  deleteFailedMessage: 'Failed to delete application.',
  bulkDelete: true,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  rowActions: [VIEW, CV],
  createUpload: { fileField: 'file', formField: 'file', includeFields: true },
  initialValues: {
    openingUUID: '',
    name: '',
    email: '',
    phone: '',
    city: '',
    linkedinUrl: '',
    message: '',
    file: null,
    stage: 'new',
    rating: '',
    notes: '',
    revision: null,
  },
  listFilters: [
    {
      key: 'openingUUID',
      label: 'Job opening',
      paramKey: 'openingUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: OPENING_LOOKUP,
    },
    {
      key: 'stage',
      label: 'Stage',
      paramKey: 'stage',
      type: 'select',
      span: 1,
      options: HR_APPLICATION_STAGE_OPTIONS,
    },
  ],
  columns: [
    {
      id: 'name',
      field: 'Name',
      label: 'Name',
      kind: 'identity',
      uuidField: 'ApplicationUUID',
      rowAction: 'view',
    },
    { id: 'opening', field: 'OpeningTitle', label: 'Job opening' },
    {
      id: 'contact',
      field: 'Email',
      label: 'Contact',
      value: (row) => [text(row['Email']), text(row['Phone'])].filter(Boolean).join(' · '),
    },
    { id: 'city', field: 'City', label: 'City' },
    { id: 'rating', field: 'Rating', label: 'Rating' },
    { id: 'dateCreated', field: 'DateCreated', label: 'Created at', kind: 'datetime' },
    {
      id: 'stage',
      field: 'Stage',
      label: 'Stage',
      kind: 'status',
      options: HR_APPLICATION_STAGE_OPTIONS,
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'stage',
      source: 'Stage',
      label: 'Stage',
      type: 'select',
      options: HR_APPLICATION_STAGE_OPTIONS,
      required: true,
      span: 1,
      hiddenWhen: ({ editing }) => !editing,
    },
    {
      key: 'rating',
      source: 'Rating',
      label: 'Rating',
      type: 'select',
      options: HR_APPLICATION_RATING_OPTIONS,
      span: 1,
      fromRecord: (value) => (value === null || value === undefined ? '' : value),
      hiddenWhen: ({ editing }) => !editing,
    },
    {
      key: 'openingUUID',
      source: 'OpeningUUID',
      label: 'Job opening',
      type: 'search-select',
      remoteLookup: OPENING_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason:
        'Job openings are written in full in Recruiting > Openings before candidates apply.',
      help: 'hr.applications.openingHelp',
      hiddenWhen: HIDE_WHEN_EDITING,
    },
    CANDIDATE_TEXT('name', 'Name', { required: true }),
    CANDIDATE_TEXT('email', 'E-mail', { type: 'email', required: true }),
    CANDIDATE_TEXT('phone', 'Phone', { type: 'phone' }),
    CANDIDATE_TEXT('city', 'City'),
    CANDIDATE_TEXT('linkedinUrl', 'LinkedIn', { help: 'hr.applications.linkedinHelp' }),
    {
      key: 'file',
      label: 'CV',
      type: 'file',
      accept:
        'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      help: 'hr.applications.cvHelp',
      span: 1,
      required: true,
      hiddenWhen: HIDE_WHEN_EDITING,
    },
    {
      key: 'message',
      source: 'Message',
      label: 'Message',
      type: 'textarea',
      span: 4,
      rows: 4,
      hiddenWhen: HIDE_WHEN_EDITING,
    },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
    HR_REVISION_FIELD,
  ],
  payload: (values, editing) => applicationPayload(values, editing),
});

@Component({
  selector: 'app-hr-recruiting-applications',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrRecruitingApplicationsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return row['HasCv'] ? [VIEW, CV] : [VIEW];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === CV.key) return this.downloadCv(row);
    if (action.key !== VIEW.key) return;
    openInboxViewer(this.dialog, {
      title: text(row['Name']) || 'Applications',
      status: { value: inboxOptionLabel(HR_APPLICATION_STAGE_OPTIONS, row['Stage']) },
      details: [
        { label: 'Job opening', value: row['OpeningTitle'] },
        { label: 'E-mail', value: row['Email'] },
        { label: 'Phone', value: row['Phone'] },
        { label: 'City', value: row['City'] },
        { label: 'LinkedIn', value: row['LinkedinUrl'], wide: true },
        { label: 'Rating', value: row['Rating'] },
        { label: 'Site', value: row['SiteName'] },
        { label: 'CV', value: row['CvFileName'], monospace: true },
        { label: 'Consent given at', value: row['ConsentAt'], kind: 'datetime' },
        { label: 'Created at', value: row['DateCreated'], kind: 'datetime' },
      ],
      sections: [
        { title: 'Message', message: row['Message'] },
        { title: 'Notes', message: row['Notes'] },
      ],
    });
  }

  private async downloadCv(row: ConfigurableCrudRecord): Promise<void> {
    const uuid = this.recordUUID(row);
    if (!uuid) return;
    try {
      const blob = await this.api.getBlob(`hr/recruiting/applications/${uuid}/cv`);
      saveBlob(blob, text(row['CvFileName']) || 'cv');
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
