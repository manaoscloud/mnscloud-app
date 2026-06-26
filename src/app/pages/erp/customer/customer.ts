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
    addressMainComplement: '',
    addressMainCity: '',
    addressMainState: '',
    addressMainZip: '',
    addressMainCountry: '',
    addressBillingStreet: '',
    addressBillingNumber: '',
    addressBillingDistrict: '',
    addressBillingComplement: '',
    addressBillingCity: '',
    addressBillingState: '',
    addressBillingZip: '',
    addressBillingCountry: '',
    addressInstallStreet: '',
    addressInstallNumber: '',
    addressInstallDistrict: '',
    addressInstallComplement: '',
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
    { key: 'document', source: 'Document', payloadKey: 'document', label: 'Document', span: 1 },
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'email', source: 'Email', payloadKey: 'email', label: 'E-mail', type: 'email', span: 1 },
    { key: 'phone', source: 'Phone', payloadKey: 'phone', label: 'Phone', type: 'phone', span: 1 },
    {
      key: 'complexUUID',
      source: 'ComplexUUID',
      payloadKey: 'complexUUID',
      label: 'Complex',
      type: 'search-select',
      placeholder: 'Search complexes',
      tab: 'address',
      span: 1,
    },
    {
      key: 'dueDayUUID',
      source: 'DueDayUUID',
      payloadKey: 'dueDayUUID',
      label: 'Due day',
      type: 'search-select',
      placeholder: 'Search due days',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'addressMainZip',
      source: 'AddressMainZip',
      payloadKey: 'addressMainZip',
      label: 'Zip',
      tab: 'address',
      span: 1,
      postalLookup: {
        streetKey: 'addressMainStreet',
        districtKey: 'addressMainDistrict',
        complementKey: 'addressMainComplement',
        cityKey: 'addressMainCity',
        stateKey: 'addressMainState',
        countryKey: 'addressMainCountry',
        numberKey: 'addressMainNumber',
      },
    },
    {
      key: 'addressMainStreet',
      source: 'AddressMainStreet',
      payloadKey: 'addressMainStreet',
      label: 'Street',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainNumber',
      source: 'AddressMainNumber',
      payloadKey: 'addressMainNumber',
      label: 'Number',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainDistrict',
      source: 'AddressMainDistrict',
      payloadKey: 'addressMainDistrict',
      label: 'District',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainComplement',
      source: 'AddressMainComplement',
      payloadKey: 'addressMainComplement',
      label: 'Complement',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainCity',
      source: 'AddressMainCity',
      payloadKey: 'addressMainCity',
      label: 'City',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainState',
      source: 'AddressMainState',
      payloadKey: 'addressMainState',
      label: 'State',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressMainCountry',
      source: 'AddressMainCountry',
      payloadKey: 'addressMainCountry',
      label: 'Country',
      tab: 'address',
      span: 1,
    },
    {
      key: 'addressBillingZip',
      source: 'AddressBillingZip',
      payloadKey: 'addressBillingZip',
      label: 'Billing Zip',
      tab: 'address',
      span: 1,
      hidden: true,
      postalLookup: {
        streetKey: 'addressBillingStreet',
        districtKey: 'addressBillingDistrict',
        complementKey: 'addressBillingComplement',
        cityKey: 'addressBillingCity',
        stateKey: 'addressBillingState',
        countryKey: 'addressBillingCountry',
        numberKey: 'addressBillingNumber',
      },
    },
    {
      key: 'addressBillingStreet',
      source: 'AddressBillingStreet',
      payloadKey: 'addressBillingStreet',
      label: 'Billing Street',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressBillingNumber',
      source: 'AddressBillingNumber',
      payloadKey: 'addressBillingNumber',
      label: 'Billing Number',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressBillingDistrict',
      source: 'AddressBillingDistrict',
      payloadKey: 'addressBillingDistrict',
      label: 'Billing District',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressBillingComplement',
      source: 'AddressBillingComplement',
      payloadKey: 'addressBillingComplement',
      label: 'Billing Complement',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressBillingCity',
      source: 'AddressBillingCity',
      payloadKey: 'addressBillingCity',
      label: 'Billing City',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressBillingState',
      source: 'AddressBillingState',
      payloadKey: 'addressBillingState',
      label: 'Billing State',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressBillingCountry',
      source: 'AddressBillingCountry',
      payloadKey: 'addressBillingCountry',
      label: 'Billing Country',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressInstallZip',
      source: 'AddressInstallZip',
      payloadKey: 'addressInstallZip',
      label: 'Installation Zip',
      tab: 'address',
      span: 1,
      hidden: true,
      postalLookup: {
        streetKey: 'addressInstallStreet',
        districtKey: 'addressInstallDistrict',
        complementKey: 'addressInstallComplement',
        cityKey: 'addressInstallCity',
        stateKey: 'addressInstallState',
        countryKey: 'addressInstallCountry',
        numberKey: 'addressInstallNumber',
      },
    },
    {
      key: 'addressInstallStreet',
      source: 'AddressInstallStreet',
      payloadKey: 'addressInstallStreet',
      label: 'Installation Street',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressInstallNumber',
      source: 'AddressInstallNumber',
      payloadKey: 'addressInstallNumber',
      label: 'Installation Number',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressInstallDistrict',
      source: 'AddressInstallDistrict',
      payloadKey: 'addressInstallDistrict',
      label: 'Installation District',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressInstallComplement',
      source: 'AddressInstallComplement',
      payloadKey: 'addressInstallComplement',
      label: 'Installation Complement',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressInstallCity',
      source: 'AddressInstallCity',
      payloadKey: 'addressInstallCity',
      label: 'Installation City',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressInstallState',
      source: 'AddressInstallState',
      payloadKey: 'addressInstallState',
      label: 'Installation State',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'addressInstallCountry',
      source: 'AddressInstallCountry',
      payloadKey: 'addressInstallCountry',
      label: 'Installation Country',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    { key: 'lat', source: 'Lat', payloadKey: 'lat', label: 'Latitude', type: 'number', tab: 'address', span: 1, hidden: true },
    { key: 'lng', source: 'Lng', payloadKey: 'lng', label: 'Longitude', type: 'number', tab: 'address', span: 1, hidden: true },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ],
  addressCopyActions: [
    {
      key: 'billingSameAsMain',
      label: 'Billing same as main',
      fromPrefix: 'addressMain',
      toPrefix: 'addressBilling',
      fields: ['Zip', 'Street', 'Number', 'District', 'Complement', 'City', 'State', 'Country'],
    },
    {
      key: 'installationSameAsMain',
      label: 'Installation same as main',
      fromPrefix: 'addressMain',
      toPrefix: 'addressInstall',
      fields: ['Zip', 'Street', 'Number', 'District', 'Complement', 'City', 'State', 'Country'],
    },
  ],
};

type ComplexRecord = {
  ComplexUUID: string;
  Name: string;
  Street?: string | null;
  Number?: string | null;
  District?: string | null;
  Complement?: string | null;
  City?: string | null;
  State?: string | null;
  Zip?: string | null;
  Country?: string | null;
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

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'complexUUID') return;

    const complex = this.complexesResource
      .value()
      .find((item) => item.ComplexUUID === String(value ?? ''));
    if (!complex) return;

    this.patchFormValues({
      addressMainZip: complex.Zip ?? '',
      addressMainStreet: complex.Street ?? '',
      addressMainNumber: complex.Number ?? '',
      addressMainDistrict: complex.District ?? '',
      addressMainComplement: complex.Complement ?? '',
      addressMainCity: complex.City ?? '',
      addressMainState: complex.State ?? '',
      addressMainCountry: complex.Country ?? '',
    });
  }
}
