import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { COMPANY_LOOKUP, FISCAL_ENVIRONMENTS } from './fiscal-options';

// The CSC (Codigo de Seguranca do Contribuinte) is issued by the state tax authority for the NFC-e
// QR Code; the API stores it encrypted.
const config = defineCrud({
  endpoint: 'fiscal/credentials',
  uuidField: 'FcrUUID',
  listQuery: { kind: 'nfce_csc' },
  pageTitle: 'NFC-e CSC',
  pageDescription:
    'Taxpayer security codes (CSC) issued by the state for the NFC-e QR Code, per establishment and environment.',
  createTitle: 'New CSC',
  editTitle: 'Edit CSC',
  bulkDelete: false,
  initialValues: {
    status: 1,
    companyUUID: '',
    environment: 'homologation',
    label: '',
    cscId: '',
    csc: '',
    revision: null,
  },
  columns: [
    { id: 'label', label: 'Name', field: 'FcrLabel', uuidField: 'FcrUUID', kind: 'identity' },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    {
      id: 'environment',
      label: 'Environment',
      field: 'FcrEnvironment',
      options: FISCAL_ENVIRONMENTS,
    },
    { id: 'cscId', label: 'CSC id', field: 'FcrCscId' },
    { id: 'status', label: 'Status', field: 'FcrStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'FcrStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'label', source: 'FcrLabel', label: 'Name', required: true, span: 3 },
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
      source: 'FcrEnvironment',
      label: 'Environment',
      type: 'select',
      options: FISCAL_ENVIRONMENTS,
      required: true,
      span: 2,
    },
    {
      key: 'cscId',
      source: 'FcrCscId',
      label: 'CSC id',
      required: true,
      help: 'The cIdToken, for example 000001.',
      span: 2,
    },
    {
      key: 'csc',
      label: 'CSC',
      type: 'password',
      requiredWhen: ({ editing }) => !editing,
      autocomplete: 'new-password',
      help: 'Leave empty when editing to keep the stored code.',
      span: 2,
    },
    { key: 'revision', source: 'FcrRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    kind: 'nfce_csc',
    companyUUID: values['companyUUID'],
    environment: values['environment'],
    label: values['label'],
    cscId: values['cscId'],
    csc: String(values['csc'] ?? '').trim() || null,
    status: Number(values['status'] ?? 1),
    ...(editing ? { revision: Number(values['revision']) } : {}),
  }),
});

@Component({
  selector: 'app-fiscal-csc',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FiscalCscPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
