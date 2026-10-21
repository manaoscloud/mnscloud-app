import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { COMPANY_LOOKUP, FISCAL_ENVIRONMENTS, FISCAL_MODELS } from './fiscal-options';

const MODES = [
  { value: 'online', label: 'Online' },
  { value: 'offline_range', label: 'Offline range (device)' },
];

const config = defineCrud({
  endpoint: 'fiscal/series',
  uuidField: 'FseUUID',
  pageTitle: 'Fiscal series',
  pageDescription:
    'Numbering of the fiscal documents per establishment, model and environment; a register may have its own series.',
  createTitle: 'New fiscal series',
  editTitle: 'Edit fiscal series',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    companyUUID: '',
    model: '65',
    series: 1,
    environment: 'homologation',
    terminalUUID: '',
    mode: 'online',
    nextNumber: 1,
    revision: null,
  },
  columns: [
    { id: 'series', label: 'Series', field: 'FseSeries', uuidField: 'FseUUID', kind: 'identity' },
    { id: 'model', label: 'Model', field: 'FseModel', options: FISCAL_MODELS },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    {
      id: 'environment',
      label: 'Environment',
      field: 'FseEnvironment',
      options: FISCAL_ENVIRONMENTS,
    },
    { id: 'terminal', label: 'Terminal', field: 'TerminalName' },
    { id: 'next', label: 'Next number', field: 'FseNextNumber', kind: 'number' },
    { id: 'status', label: 'Status', field: 'FseStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'FseStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'model',
      source: 'FseModel',
      label: 'Model',
      type: 'select',
      options: FISCAL_MODELS,
      required: true,
      span: 1,
    },
    {
      key: 'series',
      source: 'FseSeries',
      label: 'Series',
      type: 'number',
      required: true,
      span: 1,
    },
    {
      key: 'nextNumber',
      source: 'FseNextNumber',
      label: 'Next number',
      type: 'number',
      help: 'Never below a number already used.',
      span: 1,
    },
    {
      key: 'companyUUID',
      source: 'RegCompanyRcoUUID',
      label: 'Company',
      type: 'search-select',
      required: true,
      remoteLookup: COMPANY_LOOKUP,
      span: 2,
    },
    {
      key: 'environment',
      source: 'FseEnvironment',
      label: 'Environment',
      type: 'select',
      options: FISCAL_ENVIRONMENTS,
      required: true,
      span: 2,
    },
    {
      key: 'terminalUUID',
      source: 'PosTerminalPtmUUID',
      label: 'Terminal',
      type: 'search-select',
      help: 'Optional: the series of one register (used before the establishment series).',
      remoteLookup: {
        endpoint: 'pos/terminals',
        uuidField: 'PtmUUID',
        labelField: 'PtmName',
        selectedLabelField: 'TerminalName',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Terminals are configured in POS › Terminals.',
      span: 2,
    },
    { key: 'mode', source: 'FseMode', label: 'Mode', type: 'select', options: MODES, span: 2 },
    { key: 'revision', source: 'FseRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    companyUUID: values['companyUUID'],
    model: values['model'],
    series: Number(values['series']),
    environment: values['environment'],
    terminalUUID: values['terminalUUID'] || null,
    mode: values['mode'],
    nextNumber: values['nextNumber'] === '' ? null : Number(values['nextNumber']),
    status: Number(values['status'] ?? 1),
  }),
});

@Component({
  selector: 'app-fiscal-series',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FiscalSeriesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
