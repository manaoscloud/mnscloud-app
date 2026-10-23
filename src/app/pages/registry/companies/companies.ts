import { registryUnifiedConfig } from '../registry-unified';
import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  registryDocumentField,
  REGISTRY_EMAIL_FIELD,
  REGISTRY_NOTES_FIELD,
  REGISTRY_OPENING_DATE_FIELD,
  REGISTRY_PHONE_FIELD,
  REGISTRY_STATUS_FIELD,
  registryAddressFields,
  registryAddressValues,
  registryNameField,
} from '../registry-fields';

const COMPANY_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'registry/companies',
  uuidField: 'CompanyUUID',
  pageTitle: 'Companies',
  pageDescription: 'Manage official companies and fiscal registration data.',
  createTitle: 'New company',
  editTitle: 'Edit company',
  dialogDescription: 'Maintain company registration, contact and address data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No companies found.',
  deleteTitle: 'Delete company',
  deleteMessage: 'Are you sure you want to delete this company?',
  deleteSelectedTitle: 'Delete selected companies',
  deleteSelectedMessage: 'Delete {count} selected companies?',
  savedMessage: 'Company saved successfully.',
  deletedMessage: 'Company deleted successfully.',
  deleteFailedMessage: 'Failed to delete company.',
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'inactive',
  initialValues: {
    status: 'active',
    name: '',
    legalName: '',
    legalDate: '',
    document: '',
    email: '',
    phone: '',
    ...registryAddressValues('address'),
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'CompanyUUID' },
    { id: 'document', label: 'Document', field: 'Document', className: 'document-col' },
    { id: 'email', label: 'E-mail', field: 'Email', className: 'email-col' },
    { id: 'phone', label: 'Phone', field: 'Phone', className: 'phone-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'Status', className: 'status-col' },
  ],
  fields: [
    REGISTRY_STATUS_FIELD,
    registryDocumentField({
      feature: 'registry.company',
      addressPrefix: 'address',
      legalNameKey: 'legalName',
    }),
    REGISTRY_OPENING_DATE_FIELD,
    registryNameField({ breakBefore: true }),
    {
      key: 'legalName',
      source: 'LegalName',
      payloadKey: 'legalName',
      label: 'Legal name',
      span: 2,
    },
    { ...REGISTRY_EMAIL_FIELD, breakBefore: true },
    REGISTRY_PHONE_FIELD,
    ...registryAddressFields({ prefix: 'address' }),
    REGISTRY_NOTES_FIELD,
  ],
};

@Component({
  selector: 'app-registry-companies',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegCompanyPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(registryUnifiedConfig(COMPANY_CONFIG));
  }
}
