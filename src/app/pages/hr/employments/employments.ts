import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { formatDay } from '../hr-time';
import { HR_COMPANY_LOOKUP, HR_REVISION_FIELD } from '../hr-crud-shared';

const EMPLOYEE_LOOKUP = {
  endpoint: 'hr/employees',
  uuidField: 'RemUUID',
  labelField: 'RemName',
  selectedLabelField: 'EmployeeName',
};

const LOCATION_LOOKUP = {
  endpoint: 'registry/locations',
  uuidField: 'LocationUUID',
  labelField: 'Name',
  selectedLabelField: 'LocationName',
};

export const CONTRACT_TYPES: readonly ConfigurableCrudOption[] = [
  { value: 'indeterminate', label: 'Indefinite term' },
  { value: 'fixed_term', label: 'Fixed term' },
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'apprentice', label: 'Apprentice' },
  { value: 'intern', label: 'Intern' },
  { value: 'other', label: 'Other' },
];

export const SHIFT_INSTRUMENTS: readonly ConfigurableCrudOption[] = [
  { value: 'none', label: 'None' },
  { value: 'individual', label: 'Individual agreement' },
  { value: 'act', label: 'Collective agreement (ACT)' },
  { value: 'cct', label: 'Collective convention (CCT)' },
];

const ACTIVE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '1', label: 'Active' },
  { value: '0', label: 'Terminated' },
];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function digits(value: unknown): string | null {
  const clean = text(value).replace(/[\s.\-/]/g, '');
  return clean || null;
}

/** `YYYY-MM-DD` of a date column (the API may send a full instant). */
export function employmentDay(value: unknown): string {
  return text(value).slice(0, 10);
}

/** API body: PascalCase keys as in the response; only filled optional keys are sent on update. */
export function employmentPayload(
  values: Record<string, unknown>,
  editing: boolean,
): Record<string, unknown> {
  const salary = text(values['baseSalary']);
  return {
    ...(editing
      ? { Revision: Number(values['revision']) }
      : { EmployeeUUID: values['employeeUUID'] }),
    ...(text(values['companyUUID']) ? { CompanyUUID: values['companyUUID'] } : {}),
    LocationUUID: text(values['locationUUID']) || null,
    RegistrationNumber: text(values['registrationNumber']) || null,
    HireDate: employmentDay(values['hireDate']) || null,
    TerminationDate: employmentDay(values['terminationDate']) || null,
    Pis: digits(values['pis']),
    EsocialRegistration: text(values['esocialRegistration']) || null,
    Cbo: digits(values['cbo']),
    ...(text(values['contractType']) ? { ContractType: values['contractType'] } : {}),
    BaseSalary: salary === '' ? null : Number(salary),
    ...(text(values['shiftInstrument']) ? { ShiftInstrument: values['shiftInstrument'] } : {}),
    ShiftInstrumentNotes: text(values['shiftInstrumentNotes']) || null,
    Notes: text(values['notes']) || null,
  };
}

// Employments (vinculos): one row per CPF and company period. Rehiring is a new employment after
// the previous one ended; an employee can hold simultaneous employments in different companies.
// Punches record the employment they were made for; the location is the one the employee is
// assigned to (lotacao) and carries the geofence.
const config = defineCrud({
  listExport: true,
  endpoint: 'hr/employments',
  uuidField: 'EmploymentUUID',
  pageTitle: 'Employments',
  pageDescription:
    'Employments of your employees by company: registration number, dates, PIS, contract, 12x36 instrument and the location where each one works. A new hire after a termination is a new employment.',
  createTitle: 'New employment',
  editTitle: 'Edit employment',
  searchPlaceholder: 'Employee or registration number',
  emptyLabel: 'No employments found.',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  deletePayload: (row) => ({ Revision: row['Revision'] }),
  initialValues: {
    employeeUUID: '',
    companyUUID: '',
    locationUUID: '',
    registrationNumber: '',
    hireDate: '',
    terminationDate: '',
    pis: '',
    esocialRegistration: '',
    cbo: '',
    contractType: 'indeterminate',
    baseSalary: '',
    shiftInstrument: 'none',
    shiftInstrumentNotes: '',
    notes: '',
    revision: null,
  },
  tabLabels: { financial: 'Employment contract' },
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
      key: 'companyUUID',
      paramKey: 'companyUUID',
      label: 'Company',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: HR_COMPANY_LOOKUP,
    },
    {
      key: 'locationUUID',
      paramKey: 'locationUUID',
      label: 'Location',
      type: 'search-select',
      span: 1,
      emptyLabel: 'All',
      remoteLookup: LOCATION_LOOKUP,
    },
    {
      key: 'active',
      paramKey: 'active',
      label: 'Situation',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: ACTIVE_OPTIONS,
    },
  ],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'EmploymentUUID',
      kind: 'identity',
      translateValue: false,
    },
    {
      id: 'registration',
      label: 'Registration number',
      field: 'RegistrationNumber',
      translateValue: false,
    },
    { id: 'company', label: 'Company', field: 'CompanyName', translateValue: false },
    { id: 'location', label: 'Location', field: 'LocationName', translateValue: false },
    {
      id: 'hireDate',
      label: 'Admission date',
      field: 'HireDate',
      value: (row) => formatDay(row['HireDate']),
    },
    {
      id: 'terminationDate',
      label: 'Termination date',
      field: 'TerminationDate',
      value: (row) => (row['TerminationDate'] ? formatDay(row['TerminationDate']) : '—'),
    },
    { id: 'active', label: 'Active', field: 'Active', kind: 'boolean' },
    { id: 'contractType', label: 'Contract type', field: 'ContractType', options: CONTRACT_TYPES },
    { id: 'cbo', label: 'CBO', field: 'Cbo', translateValue: false, optional: true },
    { id: 'pis', label: 'PIS', field: 'Pis', translateValue: false, optional: true },
    {
      id: 'shiftInstrument',
      label: '12x36 instrument',
      field: 'ShiftInstrument',
      options: SHIFT_INSTRUMENTS,
      optional: true,
    },
  ],
  fields: [
    {
      key: 'employeeUUID',
      source: 'EmployeeUUID',
      label: 'Employee',
      type: 'search-select',
      required: true,
      span: 1,
      help: 'Person of the Registry. One employee can have several employments, one per company and period.',
      remoteLookup: {
        ...EMPLOYEE_LOOKUP,
        // The employee company is suggested; a company chosen by the operator is kept.
        fill: { companyUUID: 'RegCompanyRcoUUID' },
      },
      quickCreate: quickCreateFor('RegEmployeeRemUUID'),
      disabledWhen: ({ editing }) => Boolean(editing),
    },
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      required: true,
      span: 1,
      help: 'Company that employs the person in this employment. Its punches follow the numbering (NSR) of this company.',
      remoteLookup: HR_COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
    },
    {
      key: 'locationUUID',
      source: 'LocationUUID',
      label: 'Location',
      type: 'search-select',
      span: 1,
      help: 'Where the employee works (lotação). Only locations of the chosen company. With a fence radius on the location, punches made farther away are flagged.',
      remoteLookup: {
        ...LOCATION_LOOKUP,
        parameters: { companyUUID: 'companyUUID' },
      },
      quickCreate: quickCreateFor('RegLocationRlcUUID'),
    },
    {
      key: 'registrationNumber',
      source: 'RegistrationNumber',
      label: 'Registration number',
      span: 1,
      help: 'Matrícula in the company. It must be unique among the employments of the company.',
    },
    {
      key: 'hireDate',
      source: 'HireDate',
      label: 'Admission date',
      type: 'date',
      required: true,
      span: 1,
      fromRecord: (value) => employmentDay(value),
    },
    {
      key: 'terminationDate',
      source: 'TerminationDate',
      label: 'Termination date',
      type: 'date',
      span: 1,
      help: 'Empty while the employment is in force. It cannot be before the admission date, and employments of the same person in the same company cannot overlap.',
      fromRecord: (value) => employmentDay(value),
    },
    {
      key: 'pis',
      source: 'Pis',
      label: 'PIS',
      tab: 'financial',
      span: 1,
      help: '11 digits with the check digit; used in the electronic journey file (AEJ).',
    },
    {
      key: 'esocialRegistration',
      source: 'EsocialRegistration',
      label: 'eSocial registration',
      tab: 'financial',
      span: 1,
      help: 'Registration code of the worker in eSocial, when different from the registration number.',
    },
    {
      key: 'cbo',
      source: 'Cbo',
      label: 'CBO',
      tab: 'financial',
      span: 1,
      help: 'Brazilian occupation code, 6 digits.',
    },
    {
      key: 'contractType',
      source: 'ContractType',
      label: 'Contract type',
      type: 'select',
      options: CONTRACT_TYPES,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'baseSalary',
      source: 'BaseSalary',
      label: 'Base salary',
      type: 'currency',
      currencyCode: 'BRL',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'shiftInstrument',
      source: 'ShiftInstrument',
      label: '12x36 instrument',
      type: 'select',
      options: SHIFT_INSTRUMENTS,
      tab: 'financial',
      span: 1,
      help: 'Legal instrument that allows the 12x36 shift for this employment.',
    },
    {
      key: 'shiftInstrumentNotes',
      source: 'ShiftInstrumentNotes',
      label: '12x36 instrument notes',
      type: 'textarea',
      tab: 'financial',
      span: 4,
      rows: 4,
      help: 'Number or reference of the agreement or convention.',
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
  payload: (values, editing) => employmentPayload(values, editing),
});

@Component({
  selector: 'app-hr-employments',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrEmploymentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
