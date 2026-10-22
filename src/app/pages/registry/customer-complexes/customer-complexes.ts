import { registryUnifiedConfig } from '../registry-unified';
import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  REGISTRY_DOCUMENT_FIELD,
  REGISTRY_EMAIL_FIELD,
  REGISTRY_LEGAL_DATE_FIELD,
  REGISTRY_NOTES_FIELD,
  REGISTRY_PHONE_FIELD,
  REGISTRY_STATUS_FIELD,
  REGISTRY_TYPE_FIELD,
  registryAddressFields,
  registryNameField,
  registryPartyValues,
} from '../registry-fields';

const COMPLEX_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'registry/customer-complexes',
  uuidField: 'ComplexUUID',
  pageTitle: 'Complexes',
  pageDescription: 'Manage buildings, condominiums and service complexes.',
  createTitle: 'New complex',
  editTitle: 'Edit complex',
  dialogDescription: 'Maintain complex identity, address and contact data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No complexes found.',
  deleteTitle: 'Delete complex',
  deleteMessage: 'Are you sure you want to delete this complex?',
  deleteSelectedTitle: 'Delete selected complexes',
  deleteSelectedMessage: 'Delete {count} selected complexes?',
  savedMessage: 'Complex saved successfully.',
  deletedMessage: 'Complex deleted successfully.',
  deleteFailedMessage: 'Failed to delete complex.',
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'inactive',
  initialValues: { ...registryPartyValues(), status: 'active', alias: '' },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'ComplexUUID' },
    { id: 'type', label: 'Type', field: 'Type' },
    { id: 'alias', label: 'Alias', field: 'Alias' },
    { id: 'document', label: 'Document', field: 'Document', className: 'document-col' },
    { id: 'city', label: 'City', field: 'City' },
    { id: 'status', label: 'Status', kind: 'status', field: 'Status', className: 'status-col' },
  ],
  fields: [
    REGISTRY_STATUS_FIELD,
    REGISTRY_TYPE_FIELD,
    REGISTRY_DOCUMENT_FIELD,
    REGISTRY_LEGAL_DATE_FIELD,
    {
      key: 'alias',
      source: 'Alias',
      payloadKey: 'alias',
      label: 'Alias',
      span: 2,
      breakBefore: true,
    },
    registryNameField(),
    REGISTRY_EMAIL_FIELD,
    REGISTRY_PHONE_FIELD,
    ...registryAddressFields({ prefix: '' }),
    REGISTRY_NOTES_FIELD,
  ],
};

@Component({
  selector: 'app-registry-customer-complexes',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegCustomerComplexPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(registryUnifiedConfig(COMPLEX_CONFIG));
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const street = String(payload['street'] ?? '').trim();
    const number = String(payload['number'] ?? '').trim();
    const district = String(payload['district'] ?? '').trim();
    const complement = String(payload['complement'] ?? '').trim();
    return {
      ...super.augmentPayload(payload),
      address: [street, number, district, complement].filter(Boolean).join(', ') || null,
    };
  }
}
