import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { FISCAL_MODELS } from './fiscal-options';

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
];
const VALIDATIONS = [
  { value: 'unverified', label: 'Not validated' },
  { value: 'validated_homologation', label: 'Validated in homologation' },
  { value: 'validated_production', label: 'Validated for production' },
];
const OPERATIONS = [
  { value: 'sale', label: 'Sale' },
  { value: 'return', label: 'Return' },
  { value: 'transfer', label: 'Transfer' },
];
const REGIMES = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'simples_excess', label: 'Simples Nacional (excess)' },
  { value: 'normal', label: 'Normal regime' },
  { value: 'mei', label: 'MEI' },
];
const RECIPIENTS = [
  { value: 'consumer', label: 'Final consumer' },
  { value: 'company', label: 'Company' },
];

const rulesCollection = (row: ConfigurableCrudRecord) =>
  defineCrud({
    endpoint: `fiscal/rule-packages/${row['FrpUUID']}/rules`,
    deleteEndpoint: (rule) => `fiscal/rules/${rule['FruUUID']}`,
    uuidField: 'FruUUID',
    pageTitle: 'Fiscal rules',
    pageDescription:
      'Selectors decide when a rule applies (empty = any); the lowest priority wins, then the most specific rule.',
    createTitle: 'New fiscal rule',
    canEdit: false,
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    initialValues: {
      name: '',
      priority: 100,
      model: '65',
      operation: 'sale',
      originState: '',
      destinationState: '',
      taxRegime: '',
      nature: 'goods',
      ncmPrefix: '',
      recipientType: '',
      cfop: '5102',
      icmsCst: '102',
      icmsRate: 0,
      icmsBaseReduction: 0,
      fcpRate: 0,
      pisCst: '49',
      pisRate: 0,
      cofinsCst: '49',
      cofinsRate: 0,
      legalText: '',
    },
    columns: [
      { id: 'name', label: 'Name', field: 'FruName', uuidField: 'FruUUID', kind: 'identity' },
      { id: 'priority', label: 'Priority', field: 'FruPriority', kind: 'number' },
      { id: 'model', label: 'Model', field: 'FruModel', options: FISCAL_MODELS },
      { id: 'regime', label: 'Tax regime', field: 'FruTaxRegime', options: REGIMES },
      { id: 'ncm', label: 'NCM prefix', field: 'FruNcmPrefix' },
      { id: 'cfop', label: 'CFOP', field: 'FruCfop' },
      { id: 'cst', label: 'CST/CSOSN', field: 'FruIcmsCst' },
      { id: 'rate', label: 'ICMS (%)', field: 'FruIcmsRate', kind: 'number' },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true, span: 1 },
      { key: 'priority', label: 'Priority', type: 'number', span: 1 },
      { key: 'model', label: 'Model', type: 'select', options: FISCAL_MODELS, span: 1 },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: OPERATIONS,
        required: true,
        span: 1,
      },
      { key: 'taxRegime', label: 'Tax regime', type: 'select', options: REGIMES, span: 1 },
      { key: 'originState', label: 'Origin state (UF)', span: 1 },
      { key: 'destinationState', label: 'Destination state (UF)', span: 1 },
      { key: 'nature', label: 'Item nature', span: 1 },
      { key: 'ncmPrefix', label: 'NCM prefix', span: 1 },
      { key: 'recipientType', label: 'Recipient', type: 'select', options: RECIPIENTS, span: 1 },
      { key: 'cfop', label: 'CFOP', required: true, span: 1 },
      { key: 'icmsCst', label: 'ICMS CST or CSOSN', required: true, span: 1 },
      { key: 'icmsRate', label: 'ICMS (%)', type: 'number', span: 1 },
      { key: 'icmsBaseReduction', label: 'ICMS base reduction (%)', type: 'number', span: 1 },
      { key: 'fcpRate', label: 'FCP (%)', type: 'number', span: 1 },
      { key: 'pisCst', label: 'PIS CST', required: true, span: 1 },
      { key: 'pisRate', label: 'PIS (%)', type: 'number', span: 1 },
      { key: 'cofinsCst', label: 'COFINS CST', required: true, span: 1 },
      { key: 'cofinsRate', label: 'COFINS (%)', type: 'number', span: 1 },
      { key: 'legalText', label: 'Legal text', type: 'textarea', span: 4 },
    ],
  });

const sourcesCollection = (row: ConfigurableCrudRecord) =>
  defineCrud({
    endpoint: `fiscal/rule-packages/${row['FrpUUID']}/sources`,
    deleteEndpoint: (source) => `fiscal/rule-sources/${source['FrsUUID']}`,
    uuidField: 'FrsUUID',
    pageTitle: 'Official sources',
    pageDescription:
      'Norms and manuals the rules come from, with the consultation date; production needs validated sources.',
    createTitle: 'New source',
    canEdit: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: { title: '', url: '', consultedAt: null, validation: 'unverified', notes: '' },
    columns: [
      { id: 'title', label: 'Title', field: 'FrsTitle', uuidField: 'FrsUUID', kind: 'identity' },
      { id: 'consulted', label: 'Consulted at', field: 'FrsConsultedAt', kind: 'date' },
      { id: 'validation', label: 'Validation', field: 'FrsValidation', options: VALIDATIONS },
      { id: 'url', label: 'Address', field: 'FrsUrl', optional: true },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true, span: 1 },
      { key: 'url', label: 'Address (https)', required: true, span: 1 },
      { key: 'consultedAt', label: 'Consulted at', type: 'date', required: true, span: 1 },
      { key: 'validation', label: 'Validation', type: 'select', options: VALIDATIONS, span: 1 },
      { key: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
    ],
  });

const config = defineCrud({
  endpoint: 'fiscal/rule-packages',
  uuidField: 'FrpUUID',
  pageTitle: 'Fiscal rule packages',
  pageDescription:
    'Versioned tax rules with their official sources; a validated package is frozen and only packages validated for production issue in production.',
  createTitle: 'New rule package',
  editTitle: 'Edit rule package',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: {
    code: '',
    version: 1,
    description: '',
    validFrom: null,
    validUntil: null,
    status: 'draft',
    validation: 'unverified',
    revision: null,
  },
  columns: [
    { id: 'code', label: 'Code', field: 'FrpCode', uuidField: 'FrpUUID', kind: 'identity' },
    { id: 'version', label: 'Version', field: 'FrpVersion', kind: 'number' },
    { id: 'status', label: 'Status', field: 'FrpStatus', options: STATUSES },
    { id: 'validation', label: 'Validation', field: 'FrpValidation', options: VALIDATIONS },
    { id: 'rules', label: 'Rules', field: 'RuleCount', kind: 'number' },
    { id: 'from', label: 'Valid from', field: 'FrpValidFrom', kind: 'datetime', optional: true },
  ],
  fields: [
    { key: 'code', source: 'FrpCode', label: 'Code', required: true, span: 1 },
    { key: 'version', source: 'FrpVersion', label: 'Version', type: 'number', span: 1 },
    {
      key: 'status',
      source: 'FrpStatus',
      label: 'Status',
      type: 'select',
      options: STATUSES,
      span: 1,
    },
    { key: 'description', source: 'FrpDescription', label: 'Description', span: 1 },
    { key: 'validFrom', source: 'FrpValidFrom', label: 'Valid from', type: 'datetime', span: 1 },
    { key: 'validUntil', source: 'FrpValidUntil', label: 'Valid until', type: 'datetime', span: 1 },
    {
      key: 'validation',
      source: 'FrpValidation',
      label: 'Validation',
      type: 'select',
      options: VALIDATIONS,
      help: 'Validated packages are frozen; changing a rule then needs a new version.',
    },
    { key: 'revision', source: 'FrpRevision', label: 'Revision', hidden: true },
  ],
  rowActions: [
    { key: 'rules', label: 'Rules', icon: 'rule', collection: rulesCollection },
    { key: 'sources', label: 'Official sources', icon: 'menu_book', collection: sourcesCollection },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    code: values['code'],
    version: Number(values['version'] ?? 1),
    description: values['description'] || null,
    validFrom: values['validFrom'] || null,
    validUntil: values['validUntil'] || null,
    status: values['status'],
    validation: values['validation'],
  }),
});

@Component({
  selector: 'app-fiscal-rule-packages',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FiscalRulePackagesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
