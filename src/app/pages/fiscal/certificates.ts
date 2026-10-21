import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { COMPANY_LOOKUP, FISCAL_ENVIRONMENTS } from './fiscal-options';

// The PFX and its password are sent once and stored encrypted by the API; they are never shown again.
const config = defineCrud({
  endpoint: 'fiscal/credentials',
  uuidField: 'FcrUUID',
  listQuery: { kind: 'a1_certificate' },
  pageTitle: 'A1 certificates',
  pageDescription:
    'ICP-Brasil A1 certificates that sign the fiscal documents of each establishment, per environment.',
  createTitle: 'New A1 certificate',
  editTitle: 'Edit A1 certificate',
  bulkDelete: false,
  createUpload: { fileField: 'pfx', formField: 'pfx', includeFields: true },
  initialValues: {
    kind: 'a1_certificate',
    status: 1,
    companyUUID: '',
    environment: 'homologation',
    label: '',
    pfx: null,
    password: '',
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
    { id: 'document', label: 'CNPJ', field: 'FcrDocument' },
    { id: 'until', label: 'Valid until', field: 'FcrValidUntil', kind: 'datetime' },
    { id: 'expires', label: 'Expires in 30 days', field: 'ExpiresSoon', kind: 'boolean' },
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
      key: 'pfx',
      label: 'Certificate file (.pfx)',
      type: 'file',
      accept: '.pfx,.p12,application/x-pkcs12',
      required: true,
      help: 'The certificate of the establishment CNPJ. It is stored encrypted and never shown again.',
      hiddenWhen: ({ editing }) => editing,
      span: 2,
    },
    {
      key: 'password',
      label: 'Certificate password',
      type: 'password',
      required: true,
      autocomplete: 'new-password',
      hiddenWhen: ({ editing }) => editing,
      span: 2,
    },
    { key: 'kind', label: 'Kind', hidden: true },
    { key: 'revision', source: 'FcrRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    kind: 'a1_certificate',
    companyUUID: values['companyUUID'],
    environment: values['environment'],
    label: values['label'],
    status: Number(values['status'] ?? 1),
    ...(editing
      ? { revision: Number(values['revision']) }
      : { pfx: values['pfx'], password: values['password'] }),
  }),
});

@Component({
  selector: 'app-fiscal-certificates',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FiscalCertificatesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
