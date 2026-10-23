import { registryUnifiedConfig } from '../registry-unified';
import { Component, computed, resource } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { generateCrudPassword } from '../../../shared/crud/configurable-crud/password-generation';
import {
  REGISTRY_DOCUMENT_FIELD,
  REGISTRY_EMAIL_FIELD,
  REGISTRY_LEGAL_DATE_FIELD,
  REGISTRY_PHONE_FIELD,
  REGISTRY_STATUS_FIELD,
  REGISTRY_TYPE_FIELD,
  registryAddressFields,
  registryNameField,
} from '../registry-fields';

const PORTAL_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

// Same catalog codes as the tenant fiscal identity (FuncTaxIdCatalog in the database).
const TAX_ID_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Automatic' },
  { value: 'br_cpf', label: 'CPF' },
  { value: 'br_cnpj', label: 'CNPJ' },
  { value: 'other', label: 'Other' },
];

const IE_INDICATOR_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Not informed' },
  { value: 1, label: 'Taxpayer with state registration' },
  { value: 2, label: 'Exempt from state registration' },
  { value: 9, label: 'Non-taxpayer' },
];

const FINAL_CONSUMER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Decide by state registration' },
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

export function customerOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractCustomerRecord(response) ?? payload;
  const uuid =
    stringValue(record['CustomerUUID']) ??
    stringValue(record['RcuUUID']) ??
    stringValue(record['RegCustomerRcuUUID']) ??
    stringValue(record['uuid']);
  if (!uuid) return null;
  const label =
    stringValue(record['Name']) ??
    stringValue(record['RcuName']) ??
    stringValue(record['CustomerName']) ??
    stringValue(payload['name']) ??
    stringValue(payload['legalName']) ??
    uuid;
  const description = [record['Document'], record['Email'], record['Phone']]
    .map((value) => stringValue(value))
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  return {
    value: uuid,
    label,
    description,
    searchText: `${label} ${description} ${uuid}`,
  };
}

function extractCustomerRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as
    | {
        data?: unknown;
        item?: unknown;
        record?: unknown;
      }
    | null
    | undefined;
  const candidates = [
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).item,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).record,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).data,
    value?.data,
    value?.item,
    value?.record,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate as ConfigurableCrudRecord;
    }
  }
  return null;
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

/** Portal login: `cli` + 8 lowercase letters or digits (the database enforces the format). */
function generateAlphanumericUsername(): string {
  return `cli${generateCrudPassword(8, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
}

const DEFAULT_CUSTOMER_INITIAL_VALUES: ConfigurableCrudRecord = {
  status: 1,
  type: 'company',
  complexUUID: '',
  name: '',
  legalName: '',
  legalDate: '',
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
  addressMainMunicipalityCode: '',
  addressBillingMunicipalityCode: '',
  addressInstallMunicipalityCode: '',
  taxIdType: '',
  countryCode: '',
  stateRegistration: '',
  ieIndicator: '',
  municipalRegistration: '',
  finalConsumer: '',
  lat: null,
  lng: null,
  notes: '',
  portalStatus: 1,
  portalUsername: '',
  portalPassword: '',
  portalMustChangePassword: false,
  sendWelcomeEmail: true,
};

const CUSTOMER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'registry/customers',
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
  tabLabels: {
    authentication: 'Customer Portal',
  },
  initialValues: DEFAULT_CUSTOMER_INITIAL_VALUES,
  initialValuesFactory: () => ({
    ...DEFAULT_CUSTOMER_INITIAL_VALUES,
    portalUsername: generateAlphanumericUsername(),
    portalPassword: generateCrudPassword(10),
    portalMustChangePassword: false,
    sendWelcomeEmail: true,
  }),
  rowActions: [
    {
      key: 'resendPortalCredentials',
      label: 'Resend portal credentials',
      icon: 'mark_email_read',
      tooltip: 'crud.customer.resendWelcomeEmail',
      visible: (row) => Boolean(row['Email']),
      request: {
        method: 'post',
        endpoint: (row) =>
          `registry/customers/${row['CustomerUUID'] ?? row['RcuUUID'] ?? row['uuid']}/portal/resend-welcome-email`,
        successMessage: 'Welcome email with credentials resent successfully.',
        confirm: {
          title: 'Resend portal credentials',
          message: 'Resend portal credentials to this customer by email?',
          confirmLabel: 'Send',
        },
      },
    },
  ],
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
    REGISTRY_STATUS_FIELD,
    { ...REGISTRY_TYPE_FIELD, required: true },
    { ...REGISTRY_DOCUMENT_FIELD, required: true },
    { ...REGISTRY_LEGAL_DATE_FIELD, required: true },
    registryNameField(),
    {
      key: 'legalName',
      source: 'LegalName',
      payloadKey: 'legalName',
      label: 'Legal name',
      required: true,
      span: 2,
    },
    { ...REGISTRY_EMAIL_FIELD, required: true },
    { ...REGISTRY_PHONE_FIELD, required: true },
    {
      key: 'complexUUID',
      source: 'ComplexUUID',
      payloadKey: 'complexUUID',
      label: 'Complex',
      type: 'search-select',
      quickCreate: quickCreateFor('RegCustomerComplexRcxUUID'),
      placeholder: 'Search complexes',
      tab: 'address',
      addressSection: 'main',
      span: 1,
    },
    ...registryAddressFields({
      prefix: 'addressMain',
      section: 'main',
      required: ['Zip', 'Street', 'Number', 'District', 'City', 'State'],
      municipality: true,
    }),
    ...registryAddressFields({
      prefix: 'addressBilling',
      labelPrefix: 'Billing ',
      section: 'billing',
      municipality: true,
    }),
    ...registryAddressFields({
      prefix: 'addressInstall',
      labelPrefix: 'Installation ',
      section: 'installation',
      municipality: true,
    }),
    {
      key: 'lat',
      source: 'Lat',
      payloadKey: 'lat',
      label: 'Latitude',
      type: 'number',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'lng',
      source: 'Lng',
      payloadKey: 'lng',
      label: 'Longitude',
      type: 'number',
      tab: 'address',
      span: 1,
      hidden: true,
    },
    {
      key: 'taxIdType',
      source: 'TaxIdType',
      payloadKey: 'taxIdType',
      label: 'Tax ID type',
      type: 'select',
      options: TAX_ID_TYPE_OPTIONS,
      fromRecord: (value) => String(value ?? ''),
      help: 'Automatic infers CPF or CNPJ from the document of Brazilian customers.',
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'countryCode',
      source: 'CountryCode',
      payloadKey: 'countryCode',
      label: 'Country code',
      placeholder: 'BR',
      help: 'ISO 3166-1 alpha-2 code; empty uses the country of the tenant.',
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'ieIndicator',
      source: 'IeIndicator',
      payloadKey: 'ieIndicator',
      label: 'State registration indicator',
      type: 'select',
      options: IE_INDICATOR_OPTIONS,
      fromRecord: (value) => (value === null || value === undefined ? '' : Number(value)),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'stateRegistration',
      source: 'StateRegistration',
      payloadKey: 'stateRegistration',
      label: 'State registration',
      requiredWhen: ({ values }) => Number(values['ieIndicator']) === 1,
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'municipalRegistration',
      source: 'MunicipalRegistration',
      payloadKey: 'municipalRegistration',
      label: 'Municipal registration',
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'finalConsumer',
      source: 'FinalConsumer',
      payloadKey: 'finalConsumer',
      label: 'Final consumer',
      type: 'select',
      options: FINAL_CONSUMER_OPTIONS,
      fromRecord: (value) => (value === null || value === undefined ? '' : Number(value)),
      tab: 'fiscal',
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
    {
      key: 'portalStatus',
      source: 'PortalStatus',
      payloadKey: 'portalStatus',
      label: 'Portal access',
      type: 'select',
      options: PORTAL_STATUS_OPTIONS,
      fromRecord: (value) => (value !== null && value !== undefined ? Number(value) : 1),
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'portalUsername',
      source: 'PortalUsername',
      payloadKey: 'portalUsername',
      label: 'Portal login (Username)',
      tab: 'authentication',
      span: 1,
      placeholder: 'Unique portal username',
      // Customers created before every customer had a portal identity get one from the API.
      requiredWhen: ({ editing }) => !editing,
      suffixButtons: [
        {
          icon: 'autorenew',
          tooltip: 'crud.generateUsername',
          visibleWhen: ({ editing }) => !editing,
          onClick: (_ctx, host) => {
            host.setFieldValue('portalUsername', generateAlphanumericUsername());
          },
        },
      ],
    },
    {
      key: 'portalPassword',
      payloadKey: 'portalPassword',
      label: 'Portal password',
      type: 'password',
      tab: 'authentication',
      span: 1,
      placeholder: 'Set or change password',
      autocomplete: 'new-password',
      requiredWhen: ({ editing }) => !editing,
      suffixButtons: [
        {
          icon: 'send',
          tooltip: 'crud.customer.resendWelcomeEmail',
          visibleWhen: ({ editing }) => editing,
          onClick: async ({ values }, host) => {
            const row = host.editingRecord();
            const customerUUID = row
              ? String(row['CustomerUUID'] ?? row['RcuUUID'] ?? row['uuid'] ?? '')
              : '';
            if (!customerUUID) {
              host.snack.warning('Customer must be saved before resending credentials.');
              return;
            }
            try {
              const body: { password?: string } = {};
              if (values['portalPassword']) {
                body.password = String(values['portalPassword']);
              }
              await host.api.post(
                `registry/customers/${customerUUID}/portal/resend-welcome-email`,
                body,
              );
              host.snack.success('Welcome email with credentials resent successfully.');
            } catch (err: unknown) {
              const msg =
                err && typeof err === 'object' && 'message' in err
                  ? String((err as { message: unknown }).message)
                  : 'Failed to resend credentials.';
              host.snack.error(msg);
            }
          },
        },
      ],
    },
    {
      key: 'portalMustChangePassword',
      // This is a boolean policy choice, never the credential itself.
      reportMask: false,
      source: 'PortalMustChangePassword',
      payloadKey: 'portalMustChangePassword',
      label: 'Must change password on next login',
      type: 'select',
      options: YES_NO_OPTIONS,
      fromRecord: (value) => Number(value) === 1,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'sendWelcomeEmail',
      payloadKey: 'sendWelcomeEmail',
      label: 'Send welcome email with credentials',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
  ],
  addressSections: [
    { key: 'main', label: 'Main Address' },
    { key: 'billing', label: 'Billing Address' },
    { key: 'installation', label: 'Installation Address' },
  ],
  addressCopyActions: [
    {
      key: 'billingSameAsMain',
      label: 'Same as main address option',
      addressSection: 'billing',
      defaultEnabled: true,
      summaryLabel: 'Same as main address',
      fromPrefix: 'addressMain',
      toPrefix: 'addressBilling',
      fields: [
        'Zip',
        'Street',
        'Number',
        'District',
        'Complement',
        'City',
        'State',
        'Country',
        'MunicipalityCode',
      ],
    },
    {
      key: 'installationSameAsMain',
      label: 'Same as main address option',
      addressSection: 'installation',
      defaultEnabled: true,
      summaryLabel: 'Same as main address',
      fromPrefix: 'addressMain',
      toPrefix: 'addressInstall',
      fields: [
        'Zip',
        'Street',
        'Number',
        'District',
        'Complement',
        'City',
        'State',
        'Country',
        'MunicipalityCode',
      ],
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

@Component({
  selector: 'app-registry-customers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegCustomerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected override async quickCreateOption(
    response: unknown,
    payload: ConfigurableCrudRecord,
  ): Promise<ConfigurableCrudOption | null> {
    return (
      customerOptionFromResponse(response, payload) ?? super.quickCreateOption(response, payload)
    );
  }

  private readonly complexesResource = resource({
    defaultValue: [] as ComplexRecord[],
    loader: async () => {
      const response = await this.api.get('registry/customer-complexes?status=active&limit=500');
      return ((response as { data?: { items?: ComplexRecord[] } })?.data?.items ??
        []) as ComplexRecord[];
    },
  });

  private readonly complexOptions = computed<ConfigurableCrudOption[]>(() =>
    this.complexesResource.value().map((item) => ({
      value: item.ComplexUUID,
      label: item.Name,
      description: [item.City, item.State].filter(Boolean).join(' / '),
      searchText: `${item.Name} ${item.City ?? ''} ${item.State ?? ''} ${item.ComplexUUID}`,
    })),
  );

  constructor() {
    super(registryUnifiedConfig(CUSTOMER_CONFIG));
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'complexUUID') return this.complexOptions();
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
      sameCountry_addressMainCountry:
        Boolean(complex.Country) && complex.Country === this.formValues()['countryCode'],
    });
  }
}
