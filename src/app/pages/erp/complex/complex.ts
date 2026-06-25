import { Component } from '@angular/core';

import {
  DirectoryConfig,
  DirectoryCrudPageBase,
  DirectoryRecord,
  ERP_DIRECTORY_CRUD_IMPORTS,
} from '../shared/directory-crud/directory-crud-page-base';

const COMPLEX_CONFIG: DirectoryConfig = {
  endpoint: 'erp/complexes',
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
  initialValues: {
    status: 'active',
    name: '',
    alias: '',
    document: '',
    email: '',
    phone: '',
    street: '',
    number: '',
    district: '',
    complement: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'ComplexUUID' },
    { id: 'alias', label: 'Alias', field: 'Alias' },
    { id: 'document', label: 'Document', field: 'Document', className: 'document-col' },
    { id: 'city', label: 'City', field: 'City' },
    { id: 'status', label: 'Status', kind: 'status', field: 'Status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'document', source: 'Document', payloadKey: 'document', label: 'Document', span: 1 },
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'alias', source: 'Alias', payloadKey: 'alias', label: 'Alias', span: 1 },
    { key: 'email', source: 'Email', payloadKey: 'email', label: 'E-mail', type: 'email', span: 1 },
    { key: 'phone', source: 'Phone', payloadKey: 'phone', label: 'Phone', type: 'phone', span: 1 },
    {
      key: 'zip',
      source: 'Zip',
      payloadKey: 'zip',
      label: 'Zip',
      tab: 'address',
      span: 1,
      postalLookup: {
        streetKey: 'street',
        districtKey: 'district',
        complementKey: 'complement',
        cityKey: 'city',
        stateKey: 'state',
        countryKey: 'country',
        numberKey: 'number',
      },
    },
    {
      key: 'street',
      source: 'Street',
      payloadKey: 'street',
      label: 'Street',
      tab: 'address',
      span: 1,
    },
    {
      key: 'number',
      source: 'Number',
      payloadKey: 'number',
      label: 'Number',
      tab: 'address',
      span: 1,
    },
    {
      key: 'district',
      source: 'District',
      payloadKey: 'district',
      label: 'District',
      tab: 'address',
      span: 1,
    },
    {
      key: 'complement',
      source: 'Complement',
      payloadKey: 'complement',
      label: 'Complement',
      tab: 'address',
      span: 1,
    },
    { key: 'city', source: 'City', payloadKey: 'city', label: 'City', tab: 'address', span: 1 },
    { key: 'state', source: 'State', payloadKey: 'state', label: 'State', tab: 'address', span: 1 },
    {
      key: 'country',
      source: 'Country',
      payloadKey: 'country',
      label: 'Country',
      tab: 'address',
      span: 1,
    },
    {
      key: 'notes',
      source: 'Notes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-erp-complex',
  standalone: true,
  imports: ERP_DIRECTORY_CRUD_IMPORTS,
  templateUrl: '../shared/directory-crud/directory-crud-page.html',
  styleUrls: ['../shared/directory-crud/directory-crud-page.scss'],
})
export class ErpComplexPage extends DirectoryCrudPageBase<DirectoryRecord> {
  constructor() {
    super(COMPLEX_CONFIG);
  }

  protected override augmentPayload(payload: DirectoryRecord): DirectoryRecord {
    const street = String(payload['street'] ?? '').trim();
    const number = String(payload['number'] ?? '').trim();
    const district = String(payload['district'] ?? '').trim();
    const complement = String(payload['complement'] ?? '').trim();
    return {
      ...payload,
      address: [street, number, district, complement].filter(Boolean).join(', ') || null,
    };
  }
}
