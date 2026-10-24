import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { formatDay } from '../hr-time';

const SCOPES: readonly ConfigurableCrudOption[] = [
  { value: 'state', label: 'State' },
  { value: 'city', label: 'City' },
  { value: 'company', label: 'Company' },
];

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const COMPANY_LOOKUP = {
  endpoint: 'registry/companies?status=1',
  uuidField: 'CompanyUUID',
  labelField: 'Name',
  selectedLabelField: 'CompanyName',
};

const THIS_YEAR = new Date().getFullYear();
const YEARS: readonly ConfigurableCrudOption[] = [-1, 0, 1, 2].map((delta) => ({
  value: String(THIS_YEAR + delta),
  label: String(THIS_YEAR + delta),
}));

/** National holidays are computed by the API (fixed dates and Good Friday): read-only here. */
const NATIONAL: ConfigurableCrudFilterAction = {
  key: 'national',
  label: 'National holidays',
  icon: 'flag',
  tooltip:
    'National holidays of the selected year (or the current one), already applied to every timesheet.',
};

function nationalHolidaysConfig(year: string) {
  return defineCrud({
    endpoint: 'hr/holidays/national',
    listQuery: { year },
    uuidField: 'Date',
    pageTitle: 'National holidays',
    pageDescription:
      'Brazilian national holidays the timesheet already applies to every employee; they cannot be edited. Add state, city and company holidays on this page.',
    searchPlaceholder: 'Name',
    emptyLabel: 'No holidays found.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialPageSize: 25,
    columns: [
      {
        id: 'date',
        label: 'Date',
        field: 'Date',
        uuidField: 'Date',
        kind: 'identity',
        value: (row) => formatDay(row['Date'], true),
      },
      { id: 'name', label: 'Name', field: 'Name', translateValue: false },
    ],
    fields: [],
  });
}

// Holidays of the tenant beyond the national ones: state, city or company holidays, recurring
// every year or on a single date. The timesheet treats them as non-working days.
const config = defineCrud({
  endpoint: 'hr/holidays',
  uuidField: 'HolidayUUID',
  pageTitle: 'Holidays',
  pageDescription:
    'State, city and company holidays the timesheet treats as non-working days, in addition to the national holidays computed by the platform.',
  createTitle: 'New holiday',
  editTitle: 'Edit holiday',
  searchPlaceholder: 'Name',
  emptyLabel: 'No holidays found.',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: {
    date: '',
    name: '',
    scope: 'city',
    recurring: true,
    companyUUID: '',
    notes: '',
  },
  listFilters: [
    {
      key: 'year',
      paramKey: 'year',
      label: 'Year',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: YEARS,
      translateOptions: false,
    },
    {
      key: 'companyUUID',
      paramKey: 'companyUUID',
      label: 'Company',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: COMPANY_LOOKUP,
    },
  ],
  filterActions: [NATIONAL],
  columns: [
    {
      id: 'date',
      label: 'Date',
      field: 'Date',
      uuidField: 'HolidayUUID',
      kind: 'identity',
      value: (row) => formatDay(row['Date']),
    },
    { id: 'name', label: 'Name', field: 'Name', translateValue: false },
    { id: 'scope', label: 'Scope', field: 'Scope', options: SCOPES },
    { id: 'recurring', label: 'Every year', field: 'Recurring', kind: 'boolean' },
    {
      id: 'company',
      label: 'Company',
      field: 'CompanyName',
      value: (row, translate) => String(row['CompanyName'] ?? '') || translate('All companies'),
    },
  ],
  fields: [
    { key: 'date', source: 'Date', label: 'Date', type: 'date', required: true, span: 1 },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 3 },
    {
      key: 'scope',
      source: 'Scope',
      label: 'Scope',
      type: 'select',
      options: SCOPES,
      required: true,
      span: 1,
      breakBefore: true,
    },
    {
      key: 'recurring',
      source: 'Recurring',
      label: 'Every year',
      type: 'select',
      options: YES_NO,
      help: 'Yes: the holiday repeats every year on the same day and month. No: only on this date (movable holidays such as Corpus Christi are registered each year).',
      span: 1,
    },
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
      help: 'Empty applies the holiday to every company of the tenant.',
      span: 2,
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
  ],
  payload: (values) => ({
    date: values['date'],
    name: values['name'],
    scope: values['scope'] || 'city',
    recurring: values['recurring'] !== false,
    companyUUID: values['companyUUID'] || null,
    notes: values['notes'] ?? null,
  }),
});

@Component({
  selector: 'app-hr-holidays',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrHolidaysPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== NATIONAL.key) return;
    const year = String(this.listFilterValues()['year'] || THIS_YEAR);
    const { ConfigurableCrudCollectionDialog } =
      await import('../../../shared/crud/configurable-crud/configurable-crud-collection-dialog');
    const binding = openCrudTemplateDialog(
      this.dialog,
      ConfigurableCrudCollectionDialog,
      ['crud-form-dialog', 'crud-collection-dialog'],
      { data: { ...nationalHolidaysConfig(year), collectionDialog: true, formOnly: false } },
    );
    await firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
  }
}
