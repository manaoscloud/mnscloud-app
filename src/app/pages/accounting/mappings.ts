import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { COMPANY_LOOKUP } from '../fiscal/fiscal-options';
import { ACCOUNTING_EVENT_TYPES, COST_CENTER_LOOKUP } from './accounting-options';

const config = defineCrud({
  endpoint: 'accounting/mappings',
  uuidField: 'AamUUID',
  pageTitle: 'Account mappings',
  pageDescription:
    'Debit and credit accounts of each accounting event; a mapping for a company or attribute wins over the general one.',
  createTitle: 'New account mapping',
  editTitle: 'Edit account mapping',
  bulkDelete: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'eventType',
      label: 'Event',
      paramKey: 'eventType',
      type: 'select',
      span: 1,
      options: ACCOUNTING_EVENT_TYPES,
      emptyLabel: 'All',
    },
  ],
  initialValues: {
    status: 1,
    eventType: 'receivable.issued',
    companyUUID: '',
    attribute: '',
    debitAccount: '',
    creditAccount: '',
    costCenterUUID: '',
    revision: null,
  },
  columns: [
    {
      id: 'event',
      label: 'Event',
      field: 'AamEventType',
      uuidField: 'AamUUID',
      kind: 'identity',
      options: ACCOUNTING_EVENT_TYPES,
    },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    { id: 'attribute', label: 'Attribute', field: 'AamAttribute' },
    { id: 'debit', label: 'Debit account', field: 'AamDebitAccount' },
    { id: 'credit', label: 'Credit account', field: 'AamCreditAccount' },
    { id: 'costCenter', label: 'Cost center', field: 'CostCenterName', optional: true },
    { id: 'status', label: 'Status', field: 'AamStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'AamStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'eventType',
      source: 'AamEventType',
      label: 'Event',
      type: 'select',
      options: ACCOUNTING_EVENT_TYPES,
      required: true,
      span: 3,
    },
    {
      key: 'companyUUID',
      source: 'RegCompanyRcoUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: COMPANY_LOOKUP,
      help: 'Empty applies to every company.',
      span: 2,
    },
    {
      key: 'attribute',
      source: 'AamAttribute',
      label: 'Attribute',
      help: 'Empty applies to every event of the type. Otherwise the title source (manual, bill_charge, pos_sale), settlement origin (manual, gateway, pos), fiscal model (55, 65, 62, nfse) or stock movement kind (receipt, issue, sale...).',
      span: 2,
    },
    {
      key: 'debitAccount',
      source: 'AamDebitAccount',
      label: 'Debit account',
      required: true,
      span: 1,
    },
    {
      key: 'creditAccount',
      source: 'AamCreditAccount',
      label: 'Credit account',
      required: true,
      span: 1,
    },
    {
      key: 'costCenterUUID',
      source: 'AccCostCenterAccUUID',
      label: 'Cost center',
      type: 'search-select',
      remoteLookup: COST_CENTER_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: 'Cost centers are kept in Accounting › Cost centers.',
      span: 2,
    },
    { key: 'revision', source: 'AamRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    eventType: values['eventType'],
    companyUUID: values['companyUUID'] || null,
    attribute: values['attribute'] || null,
    debitAccount: values['debitAccount'],
    creditAccount: values['creditAccount'],
    costCenterUUID: values['costCenterUUID'] || null,
    status: Number(values['status'] ?? 1),
  }),
});

@Component({
  selector: 'app-accounting-mappings',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AccountingMappingsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
