import { Component } from '@angular/core';

import {
  DirectoryConfig,
  DirectoryCrudPageBase,
  DirectoryRecord,
  ERP_DIRECTORY_CRUD_IMPORTS,
} from '../shared/directory-crud/directory-crud-page-base';

const TYPE_OPTIONS = [
  { value: 'company', label: 'Company' },
  { value: 'person', label: 'Person' },
];

const RESELLER_CONFIG: DirectoryConfig = {
  endpoint: 'erp/resellers',
  uuidField: 'ResellerUUID',
  pageTitle: 'Resellers',
  pageDescription: 'Manage reseller records and contact data.',
  createTitle: 'New reseller',
  editTitle: 'Edit reseller',
  dialogDescription: 'Maintain reseller registration, contact and address data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No resellers found.',
  deleteTitle: 'Delete reseller',
  deleteMessage: 'Are you sure you want to delete this reseller?',
  deleteSelectedTitle: 'Delete selected resellers',
  deleteSelectedMessage: 'Delete {count} selected resellers?',
  savedMessage: 'Reseller saved successfully.',
  deletedMessage: 'Reseller deleted successfully.',
  deleteFailedMessage: 'Failed to delete reseller.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    type: 'company',
    name: '',
    document: '',
    email: '',
    phone: '',
    street: '',
    number: '',
    district: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'ResellerUUID' },
    { id: 'type', label: 'Type', field: 'Type' },
    { id: 'document', label: 'Document', field: 'Document', className: 'document-col' },
    { id: 'email', label: 'E-mail', field: 'Email', className: 'email-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'Status', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'Status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'type', source: 'Type', payloadKey: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS, span: 1 },
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'document', source: 'Document', payloadKey: 'document', label: 'Document', span: 1 },
    { key: 'email', source: 'Email', payloadKey: 'email', label: 'E-mail', type: 'email', span: 1 },
    { key: 'phone', source: 'Phone', payloadKey: 'phone', label: 'Phone', type: 'phone', span: 1 },
    { key: 'street', source: 'Street', payloadKey: 'street', label: 'Street', tab: 'address', span: 1 },
    { key: 'number', source: 'Number', payloadKey: 'number', label: 'Number', tab: 'address', span: 1 },
    { key: 'district', source: 'District', payloadKey: 'district', label: 'District', tab: 'address', span: 1 },
    { key: 'city', source: 'City', payloadKey: 'city', label: 'City', tab: 'address', span: 1 },
    { key: 'state', source: 'State', payloadKey: 'state', label: 'State', tab: 'address', span: 1 },
    { key: 'zip', source: 'Zip', payloadKey: 'zip', label: 'ZIP', tab: 'address', span: 1 },
    { key: 'country', source: 'Country', payloadKey: 'country', label: 'Country', tab: 'address', span: 1 },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 5 },
  ],
};

@Component({
  selector: 'app-erp-reseller',
  standalone: true,
  imports: ERP_DIRECTORY_CRUD_IMPORTS,
  templateUrl: '../shared/directory-crud/directory-crud-page.html',
  styleUrls: ['../shared/directory-crud/directory-crud-page.scss'],
})
export class ErpResellerPage extends DirectoryCrudPageBase<DirectoryRecord> {
  constructor() {
    super(RESELLER_CONFIG);
  }
}
