import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const ENVIRONMENT_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'dsv', label: 'Development' },
  { value: 'hml', label: 'Homologation' },
  { value: 'prd', label: 'Production' },
];

const SIAD_ACCOUNT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'clinic/bradesco-siad/accounts',
  uuidField: 'CsaUUID',
  pageTitle: 'Bradesco SIAD accounts',
  pageDescription: 'Manage tenant SIAD account metadata without storing credentials or certificates.',
  createTitle: 'New Bradesco SIAD account',
  editTitle: 'Edit Bradesco SIAD account',
  dialogDescription: 'Maintain the tenant SIAD profile and identifiers agreed with Bradesco.',
  searchPlaceholder: 'Search SIAD accounts',
  emptyLabel: 'No Bradesco SIAD accounts found.',
  deleteTitle: 'Delete Bradesco SIAD account',
  deleteMessage: 'Are you sure you want to delete this Bradesco SIAD account?',
  deleteSelectedTitle: 'Delete selected Bradesco SIAD accounts',
  deleteSelectedMessage: 'Delete {count} selected Bradesco SIAD accounts?',
  savedMessage: 'Bradesco SIAD account saved successfully.',
  deletedMessage: 'Bradesco SIAD account deleted successfully.',
  deleteFailedMessage: 'Failed to delete Bradesco SIAD account.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: false,
  initialValues: {
    name: '',
    credentialProfile: '',
    environment: 'dsv',
    origin: '',
    suborigin: '',
    referenciado: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'CsaName', uuidField: 'CsaUUID' },
    { id: 'profile', label: 'Credential profile', field: 'CsaCredentialProfile' },
    { id: 'environment', label: 'Environment', field: 'CsaEnvironment' },
    { id: 'origin', label: 'Origin', field: 'CsaOrigin' },
    { id: 'referenciado', label: 'Referenciado', field: 'CsaReferenciado' },
    { id: 'status', label: 'Status', kind: 'status', field: 'CsaStatus', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'CsaStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'environment', source: 'CsaEnvironment', payloadKey: 'environment', label: 'Environment', type: 'select', options: ENVIRONMENT_OPTIONS, required: true, span: 1 },
    { key: 'credentialProfile', source: 'CsaCredentialProfile', payloadKey: 'credentialProfile', label: 'Credential profile', required: true, placeholder: 'Example: BRADESCO_TENANT_A', span: 1 },
    { key: 'name', source: 'CsaName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'origin', source: 'CsaOrigin', payloadKey: 'origin', label: 'Origin', required: true, tab: 'authentication', span: 1 },
    { key: 'suborigin', source: 'CsaSuborigin', payloadKey: 'suborigin', label: 'Suborigin', tab: 'authentication', span: 1 },
    { key: 'referenciado', source: 'CsaReferenciado', payloadKey: 'referenciado', label: 'Referenciado', required: true, tab: 'authentication', span: 1 },
  ],
  tabLabels: { record: 'Record', authentication: 'SIAD identifiers' },
};

@Component({
  selector: 'app-clinic-bradesco-siad',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ClinicBradescoSiadPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(SIAD_ACCOUNT_CONFIG);
  }
}
