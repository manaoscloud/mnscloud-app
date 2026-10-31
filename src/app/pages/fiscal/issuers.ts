import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const taxRegimes = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'simples_excess', label: 'Simples Nacional, revenue sublimit exceeded' },
  { value: 'normal', label: 'Normal regime' },
  { value: 'mei', label: 'MEI' },
];

const environments = [
  { value: 'homologation', label: 'Homologation' },
  { value: 'production', label: 'Production' },
];

const states = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
].map((value) => ({ value, label: value }));

// One state registration (IE) per UF; ISENTO when the establishment is exempt.
function registrations(issuer: ConfigurableCrudRecord) {
  const issuerUUID = String(issuer['FipUUID']);
  return defineCrud({
    endpoint: `fiscal/issuers/${issuerUUID}/state-registrations`,
    uuidField: 'FsrUUID',
    pageTitle: 'State registrations',
    pageDescription: 'State registrations (IE) of the issuer, one per state.',
    createTitle: 'New state registration',
    editTitle: 'Edit state registration',
    bulkDelete: false,
    initialValues: { status: 1, state: '', registration: '', isSubstitute: 0 },
    columns: [
      { id: 'state', label: 'State', field: 'FsrState', uuidField: 'FsrUUID', kind: 'identity' },
      { id: 'registration', label: 'State registration', field: 'FsrRegistration' },
      { id: 'substitute', label: 'Tax substitute', field: 'FsrIsSubstitute', kind: 'boolean' },
      { id: 'status', label: 'Status', field: 'FsrStatus', kind: 'status' },
    ],
    fields: [
      { key: 'status', source: 'FsrStatus', label: 'Status', type: 'status', span: 1 },
      {
        key: 'state',
        source: 'FsrState',
        label: 'State',
        type: 'select',
        options: states,
        translateOptions: false,
        required: true,
        span: 1,
      },
      {
        key: 'registration',
        source: 'FsrRegistration',
        label: 'State registration',
        required: true,
        help: 'Digits only, or ISENTO when the establishment is exempt.',
        span: 1,
      },
      {
        key: 'isSubstitute',
        source: 'FsrIsSubstitute',
        label: 'Tax substitute',
        type: 'select',
        options: [
          { value: 0, label: 'No' },
          { value: 1, label: 'Yes' },
        ],
        fromRecord: (value) => Number(value ?? 0),
        help: 'Registration as tax substitute (IE ST) in a destination state.',
        span: 1,
      },
    ],
    payload: (values) => ({
      state: values['state'],
      registration: values['registration'],
      isSubstitute: Number(values['isSubstitute'] ?? 0),
      status: Number(values['status'] ?? 1),
    }),
  });
}

const config = defineCrud({
  endpoint: 'fiscal/issuers',
  uuidField: 'FipUUID',
  pageTitle: 'Fiscal issuers',
  pageDescription:
    'Fiscal profile of each establishment that issues fiscal documents for Sales, POS, ISP, Hosting and VoIP.',
  createTitle: 'New fiscal issuer',
  editTitle: 'Edit fiscal issuer',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    companyUUID: '',
    taxRegime: 'simples_nacional',
    cnae: '',
    municipalityCode: '',
    municipalRegistration: '',
    environment: 'homologation',
    revision: null,
    notes: '',
  },
  columns: [
    {
      id: 'company',
      label: 'Company',
      field: 'CompanyName',
      uuidField: 'FipUUID',
      kind: 'identity',
    },
    { id: 'document', label: 'CNPJ', field: 'CompanyDocument' },
    { id: 'regime', label: 'Tax regime', field: 'FipTaxRegime', options: taxRegimes },
    { id: 'state', label: 'State', field: 'CompanyState' },
    { id: 'environment', label: 'Environment', field: 'FipEnvironment', options: environments },
    {
      id: 'registrations',
      label: 'State registrations',
      field: 'StateRegistrationCount',
      kind: 'number',
    },
    { id: 'status', label: 'Status', field: 'FipStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'FipStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'companyUUID',
      source: 'RegCompanyRcoUUID',
      label: 'Company',
      type: 'search-select',
      required: true,
      disabledWhen: ({ editing }) => editing,
      help: 'The company must have a valid CNPJ; each company has one fiscal profile.',
      remoteLookup: {
        endpoint: 'registry/companies',
        uuidField: 'CompanyUUID',
        labelField: 'Name',
        descriptionField: 'Document',
        selectedLabelField: 'CompanyName',
      },
    },
    {
      key: 'environment',
      source: 'FipEnvironment',
      label: 'Environment',
      type: 'select',
      options: environments,
      required: true,
      help: 'Homologation documents have no fiscal value; switch to production only after the homologation tests.',
      span: 1,
    },
    {
      key: 'taxRegime',
      source: 'FipTaxRegime',
      label: 'Tax regime',
      type: 'select',
      options: taxRegimes,
      required: true,
      breakBefore: true,
    },
    { key: 'cnae', source: 'FipCnae', label: 'CNAE', translateLabel: false, span: 1 },
    {
      key: 'municipalityCode',
      source: 'FipMunicipalityCode',
      label: 'IBGE municipality code',
      required: true,
      help: 'Seven digits of the municipality of the establishment.',
      span: 1,
    },
    {
      key: 'municipalRegistration',
      source: 'FipMunicipalRegistration',
      label: 'Municipal registration',
      span: 1,
    },
    { key: 'revision', source: 'FipRevision', label: 'Revision', hidden: true },
    {
      key: 'notes',
      source: 'FipNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  rowActions: [
    {
      key: 'registrations',
      label: 'State registrations',
      icon: 'account_balance',
      collection: registrations,
    },
  ],
  payload: (values, editing) => ({
    ...(editing
      ? { revision: Number(values['revision']) }
      : { companyUUID: values['companyUUID'] }),
    taxRegime: values['taxRegime'],
    cnae: String(values['cnae'] ?? '').trim() || null,
    municipalityCode: String(values['municipalityCode'] ?? '').trim(),
    municipalRegistration: String(values['municipalRegistration'] ?? '').trim() || null,
    environment: values['environment'],
    status: Number(values['status'] ?? 1),
    notes: String(values['notes'] ?? '').trim() || null,
  }),
});

/** Company editor opens this same canonical profile and its per-state registrations. */
export function companyFiscalConfig(company: ConfigurableCrudRecord, canWrite: boolean) {
  const companyUUID = String(company['CompanyUUID']);
  return {
    ...config,
    listQuery: { companyUUID },
    canCreate: canWrite,
    canEdit: canWrite,
    initialValues: { ...config.initialValues, companyUUID },
    fields: config.fields.map((field) =>
      field.key === 'companyUUID' ? { ...field, disabledWhen: () => true } : field,
    ),
  };
}

@Component({
  selector: 'app-fiscal-issuers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FiscalIssuersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
