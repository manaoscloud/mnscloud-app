import { Component, computed, resource } from '@angular/core';

import {
  DirectoryConfig,
  DirectoryCrudPageBase,
  DirectoryOption,
  DirectoryRecord,
  ERP_DIRECTORY_CRUD_IMPORTS,
} from '../shared/directory-crud/directory-crud-page-base';

const TYPE_OPTIONS: readonly DirectoryOption[] = [
  { value: 'company', label: 'Company' },
  { value: 'person', label: 'Person' },
];

const CUSTOMER_CONFIG: DirectoryConfig = {
  endpoint: 'erp/customers',
  uuidField: 'CustomerUUID',
  pageTitle: 'Customers',
  pageDescription: 'Manage customer records, billing data and service addresses.',
  createTitle: 'New customer',
  editTitle: 'Edit customer',
  dialogDescription: 'Maintain customer identity, billing and installation data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No customers found.',
  deleteTitle: 'Delete customer',
  deleteMessage: 'Are you sure you want to delete this customer?',
  deleteSelectedTitle: 'Delete selected customers',
  deleteSelectedMessage: 'Delete {count} selected customers?',
  savedMessage: 'Customer saved successfully.',
  deletedMessage: 'Customer deleted successfully.',
  deleteFailedMessage: 'Failed to delete customer.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    type: 'company',
    complexUUID: '',
    dueDayUUID: '',
    name: '',
    document: '',
    email: '',
    phone: '',
    addressMainStreet: '',
    addressMainNumber: '',
    addressMainDistrict: '',
    addressMainCity: '',
    addressMainState: '',
    addressMainZip: '',
    addressMainCountry: '',
    addressBillingStreet: '',
    addressBillingNumber: '',
    addressBillingDistrict: '',
    addressBillingCity: '',
    addressBillingState: '',
    addressBillingZip: '',
    addressBillingCountry: '',
    addressInstallStreet: '',
    addressInstallNumber: '',
    addressInstallDistrict: '',
    addressInstallCity: '',
    addressInstallState: '',
    addressInstallZip: '',
    addressInstallCountry: '',
    lat: null,
    lng: null,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'CustomerUUID' },
    { id: 'type', label: 'Type', field: 'Type' },
    {
      id: 'complex',
      label: 'Complex',
      kind: 'related',
      uuidField: 'ComplexUUID',
      lookupKey: 'complexUUID',
    },
    { id: 'document', label: 'Document', field: 'Document', className: 'document-col' },
    { id: 'email', label: 'E-mail', field: 'Email', className: 'email-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'Status', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'Status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'type', source: 'Type', payloadKey: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS, span: 1 },
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'document', source: 'Document', payloadKey: 'document', label: 'Document', span: 1 },
    {
      key: 'complexUUID',
      source: 'ComplexUUID',
      payloadKey: 'complexUUID',
      label: 'Complex',
      type: 'search-select',
      placeholder: 'Search complexes',
      span: 1,
    },
    {
      key: 'dueDayUUID',
      source: 'DueDayUUID',
      payloadKey: 'dueDayUUID',
      label: 'Due day',
      type: 'search-select',
      placeholder: 'Search due days',
      span: 1,
    },
    { key: 'email', source: 'Email', payloadKey: 'email', label: 'E-mail', type: 'email', span: 1 },
    { key: 'phone', source: 'Phone', payloadKey: 'phone', label: 'Phone', type: 'phone', span: 1 },
    {
      key: 'addressMainStreet',
      source: 'AddressMainStreet',
      payloadKey: 'addressMainStreet',
      label: 'Main street',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainNumber',
      source: 'AddressMainNumber',
      payloadKey: 'addressMainNumber',
      label: 'Main number',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainDistrict',
      source: 'AddressMainDistrict',
      payloadKey: 'addressMainDistrict',
      label: 'Main district',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainCity',
      source: 'AddressMainCity',
      payloadKey: 'addressMainCity',
      label: 'Main city',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainState',
      source: 'AddressMainState',
      payloadKey: 'addressMainState',
      label: 'Main state',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainZip',
      source: 'AddressMainZip',
      payloadKey: 'addressMainZip',
      label: 'Main ZIP',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainCountry',
      source: 'AddressMainCountry',
      payloadKey: 'addressMainCountry',
      label: 'Main country',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingStreet',
      source: 'AddressBillingStreet',
      payloadKey: 'addressBillingStreet',
      label: 'Billing street',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingNumber',
      source: 'AddressBillingNumber',
      payloadKey: 'addressBillingNumber',
      label: 'Billing number',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingDistrict',
      source: 'AddressBillingDistrict',
      payloadKey: 'addressBillingDistrict',
      label: 'Billing district',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingCity',
      source: 'AddressBillingCity',
      payloadKey: 'addressBillingCity',
      label: 'Billing city',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingState',
      source: 'AddressBillingState',
      payloadKey: 'addressBillingState',
      label: 'Billing state',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingZip',
      source: 'AddressBillingZip',
      payloadKey: 'addressBillingZip',
      label: 'Billing ZIP',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingCountry',
      source: 'AddressBillingCountry',
      payloadKey: 'addressBillingCountry',
      label: 'Billing country',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressInstallStreet',
      source: 'AddressInstallStreet',
      payloadKey: 'addressInstallStreet',
      label: 'Install street',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressInstallNumber',
      source: 'AddressInstallNumber',
      payloadKey: 'addressInstallNumber',
      label: 'Install number',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressInstallDistrict',
      source: 'AddressInstallDistrict',
      payloadKey: 'addressInstallDistrict',
      label: 'Install district',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressInstallCity',
      source: 'AddressInstallCity',
      payloadKey: 'addressInstallCity',
      label: 'Install city',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressInstallState',
      source: 'AddressInstallState',
      payloadKey: 'addressInstallState',
      label: 'Install state',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressInstallZip',
      source: 'AddressInstallZip',
      payloadKey: 'addressInstallZip',
      label: 'Install ZIP',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressInstallCountry',
      source: 'AddressInstallCountry',
      payloadKey: 'addressInstallCountry',
      label: 'Install country',
      tab: 'address',
      span: 1,
    },
    { key: 'lat', source: 'Lat', payloadKey: 'lat', label: 'Latitude', type: 'number', tab: 'address', span: 1 },
    { key: 'lng', source: 'Lng', payloadKey: 'lng', label: 'Longitude', type: 'number', tab: 'address', span: 1 },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 5 },
  ],
};

type ComplexRecord = {
  ComplexUUID: string;
  Name: string;
  City?: string | null;
  State?: string | null;
};

type DueDayRecord = {
  ErpFinInvDueDayUUID: string;
  Name: string;
  DueDay?: number | null;
  BillingDay?: number | null;
};

@Component({
  selector: 'app-erp-customer',
  standalone: true,
  imports: ERP_DIRECTORY_CRUD_IMPORTS,
  templateUrl: '../shared/directory-crud/directory-crud-page.html',
  styleUrls: ['../shared/directory-crud/directory-crud-page.scss'],
})
export class ErpCustomerPage extends DirectoryCrudPageBase<DirectoryRecord> {
  private readonly complexesResource = resource({
    defaultValue: [] as ComplexRecord[],
    loader: async () => {
      const response = await this.api.get('erp/complexes?status=active&limit=500');
      return ((response as { data?: { items?: ComplexRecord[] } })?.data?.items ?? []) as ComplexRecord[];
    },
  });
  private readonly dueDaysResource = resource({
    defaultValue: [] as DueDayRecord[],
    loader: async () => {
      const response = await this.api.get('erp/financial/invoicing/duedays?status=active&limit=500');
      return ((response as { data?: { items?: DueDayRecord[] } })?.data?.items ?? []) as DueDayRecord[];
    },
  });

  private readonly complexOptions = computed<DirectoryOption[]>(() =>
    this.complexesResource.value().map((item) => ({
      value: item.ComplexUUID,
      label: item.Name,
      description: [item.City, item.State].filter(Boolean).join(' / '),
      searchText: `${item.Name} ${item.City ?? ''} ${item.State ?? ''} ${item.ComplexUUID}`,
    })),
  );
  private readonly dueDayOptions = computed<DirectoryOption[]>(() =>
    this.dueDaysResource.value().map((item) => ({
      value: item.ErpFinInvDueDayUUID,
      label: item.Name,
      description: [item.DueDay ? `Due ${item.DueDay}` : '', item.BillingDay ? `Billing ${item.BillingDay}` : '']
        .filter(Boolean)
        .join(' / '),
      searchText: `${item.Name} ${item.DueDay ?? ''} ${item.BillingDay ?? ''} ${item.ErpFinInvDueDayUUID}`,
    })),
  );

  constructor() {
    super(CUSTOMER_CONFIG);
  }

  protected override lookupOptions(key: string): readonly DirectoryOption[] {
    if (key === 'complexUUID') return this.complexOptions();
    if (key === 'dueDayUUID') return this.dueDayOptions();
    return [];
  }
}
