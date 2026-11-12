import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { COMPANY_LOOKUP } from '../../registry/locations/locations';
import { text } from '../../website/shared/website-inbox';
import { HR_REVISION_FIELD, HR_YES_NO } from '../hr-crud-shared';

export const HR_OPENING_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export const HR_EMPLOYMENT_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'clt', label: 'CLT' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'internship', label: 'Internship' },
  { value: 'apprentice', label: 'Apprentice' },
  { value: 'contractor', label: 'Contractor' },
];

const PUBLISHED_FILTER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const LOCATION_LOOKUP = {
  endpoint: 'registry/locations',
  uuidField: 'LocationUUID',
  labelField: 'Name',
  selectedLabelField: 'LocationName',
};

/** A date column value (`YYYY-MM-DD` or an ISO instant) as the day the date field edits. */
export function dayOf(value: unknown): string {
  return text(value).slice(0, 10);
}

/** API body: camelCase `pData` keys; `revision` only when updating. */
export function openingPayload(
  values: Record<string, unknown>,
  editing: boolean,
): Record<string, unknown> {
  const openings = Number(values['openings']);
  return {
    ...(editing ? { revision: Number(values['revision']) } : {}),
    title: text(values['title']),
    companyUUID: values['companyUUID'] || null,
    locationUUID: values['locationUUID'] || null,
    slug: text(values['slug']),
    department: text(values['department']),
    employmentType: text(values['employmentType']) || 'clt',
    workSchedule: text(values['workSchedule']),
    openings: Number.isFinite(openings) && openings > 0 ? Math.trunc(openings) : 1,
    salaryText: text(values['salaryText']),
    description: text(values['description']),
    requirements: text(values['requirements']),
    benefits: text(values['benefits']),
    status: text(values['status']) || 'draft',
    published: values['published'] === true,
    closesOn: dayOf(values['closesOn']) || null,
    notes: text(values['notes']),
  };
}

function longText(key: string, label: string, help: string) {
  return {
    key,
    source: sourceOf(key),
    label,
    type: 'textarea' as const,
    span: 4 as const,
    rows: 4,
    help,
  };
}

function sourceOf(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Job openings of the organization, published on the careers page of the tenant website. */
const config = defineCrud({
  endpoint: 'hr/recruiting/openings',
  uuidField: 'OpeningUUID',
  pageTitle: 'Job openings',
  pageDescription:
    'Job openings of your organization, published on the careers page of your website, where candidates send their applications.',
  createTitle: 'New job opening',
  editTitle: 'Edit job opening',
  searchPlaceholder: 'Title, department or slug',
  emptyLabel: 'No job openings found',
  bulkDelete: true,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {
    title: '',
    companyUUID: '',
    locationUUID: '',
    slug: '',
    department: '',
    employmentType: 'clt',
    workSchedule: '',
    openings: 1,
    salaryText: '',
    description: '',
    requirements: '',
    benefits: '',
    status: 'draft',
    published: false,
    closesOn: '',
    notes: '',
    revision: null,
  },
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: HR_OPENING_STATUS_OPTIONS,
    },
    {
      key: 'companyUUID',
      label: 'Company',
      paramKey: 'companyUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: COMPANY_LOOKUP,
    },
    {
      key: 'locationUUID',
      label: 'Location',
      paramKey: 'locationUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: LOCATION_LOOKUP,
    },
    {
      key: 'published',
      label: 'Published',
      paramKey: 'published',
      type: 'select',
      span: 1,
      options: PUBLISHED_FILTER_OPTIONS,
    },
  ],
  columns: [
    { id: 'title', label: 'Title', field: 'Title', uuidField: 'OpeningUUID', kind: 'identity' },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    { id: 'location', label: 'Location', field: 'LocationName' },
    { id: 'department', label: 'Department', field: 'Department' },
    {
      id: 'employmentType',
      label: 'Employment type',
      field: 'EmploymentType',
      options: HR_EMPLOYMENT_TYPE_OPTIONS,
    },
    { id: 'applications', label: 'Applications', field: 'ApplicationCount' },
    { id: 'closesOn', label: 'Closes on', field: 'ClosesOn', kind: 'date' },
    { id: 'published', label: 'Published', field: 'Published', kind: 'boolean' },
    {
      id: 'status',
      label: 'Status',
      field: 'Status',
      kind: 'status',
      options: HR_OPENING_STATUS_OPTIONS,
    },
  ],
  fields: [
    { key: 'title', source: 'Title', label: 'Title', required: true, span: 1 },
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      required: true,
      remoteLookup: COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
    },
    {
      key: 'locationUUID',
      source: 'LocationUUID',
      label: 'Location',
      type: 'search-select',
      remoteLookup: LOCATION_LOOKUP,
      quickCreate: quickCreateFor('RegLocationRlcUUID'),
      help: 'hr.recruiting.locationHelp',
    },
    {
      key: 'slug',
      source: 'Slug',
      label: 'Slug',
      required: true,
      help: 'hr.recruiting.slugHelp',
    },
    { key: 'department', source: 'Department', label: 'Department', span: 1 },
    {
      key: 'employmentType',
      source: 'EmploymentType',
      label: 'Employment type',
      type: 'select',
      options: HR_EMPLOYMENT_TYPE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'workSchedule',
      source: 'WorkSchedule',
      label: 'Work schedule',
      span: 1,
      help: 'hr.recruiting.workScheduleHelp',
    },
    { key: 'openings', source: 'Openings', label: 'Positions', type: 'number', span: 1 },
    {
      key: 'salaryText',
      source: 'SalaryText',
      label: 'Salary',
      span: 1,
      help: 'hr.recruiting.salaryHelp',
    },
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'select',
      options: HR_OPENING_STATUS_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'published',
      source: 'Published',
      label: 'Published',
      type: 'select',
      options: HR_YES_NO,
      fromRecord: (value) => value === true || value === 1,
      help: 'hr.recruiting.publishedHelp',
    },
    {
      key: 'closesOn',
      source: 'ClosesOn',
      label: 'Closes on',
      type: 'date',
      span: 1,
      fromRecord: (value) => dayOf(value),
      help: 'hr.recruiting.closesOnHelp',
    },
    longText('description', 'Description', 'hr.recruiting.descriptionHelp'),
    longText('requirements', 'Requirements', 'hr.recruiting.requirementsHelp'),
    longText('benefits', 'Benefits', 'hr.recruiting.benefitsHelp'),
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
  payload: (values, editing) => openingPayload(values, editing),
});

@Component({
  selector: 'app-hr-recruiting-openings',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrRecruitingOpeningsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
