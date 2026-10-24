import type {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { companyLookupButton } from '../../shared/data-lookup/company-lookup';
import { personLookupButton } from '../../shared/data-lookup/person-lookup';

/** Building blocks of the Registry forms: every record shares the same contact and address shape. */

/** Form text accepts scalar values, never object stringification. */
export function registryText(value: unknown): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' ? String(value) : '';
}

export function registryNameColumn(uuidField: string): ConfigurableCrudColumn {
  return { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField };
}

export const REGISTRY_STATUS_COLUMN: ConfigurableCrudColumn = {
  id: 'status',
  label: 'Status',
  kind: 'status',
  field: 'Status',
  className: 'status-col',
};

export const REGISTRY_TYPE_OPTIONS = [
  { value: 'company', label: 'Company' },
  { value: 'person', label: 'Person' },
];

export const REGISTRY_ADDRESS_PARTS = [
  'Zip',
  'Street',
  'Number',
  'District',
  'Complement',
  'City',
  'State',
  'Country',
] as const;

export type RegistryAddressPart = (typeof REGISTRY_ADDRESS_PARTS)[number] | 'MunicipalityCode';

export type RegistryAddressSpec = {
  /** Field key prefix: '' (`zip`), 'address' (`addressZip`) or 'addressMain' (`addressMainZip`). */
  prefix: string;
  /** Prepended to each label ('Billing ' -> 'Billing Zip'). */
  labelPrefix?: string;
  section?: string;
  required?: readonly RegistryAddressPart[];
  /** Adds the IBGE municipality code filled by the postal code search. */
  municipality?: boolean;
};

function fieldKey(prefix: string, part: string): string {
  return prefix ? `${prefix}${part}` : part.charAt(0).toLowerCase() + part.slice(1);
}

function sourceOf(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function addressField(
  spec: RegistryAddressSpec,
  part: RegistryAddressPart,
  label: string,
): ConfigurableCrudField {
  const key = fieldKey(spec.prefix, part);
  return {
    key,
    source: sourceOf(key),
    payloadKey: key,
    label: `${spec.labelPrefix ?? ''}${label}`,
    tab: 'address',
    ...(spec.section ? { addressSection: spec.section } : {}),
    ...(spec.required?.includes(part) ? { required: true } : {}),
    span: 1,
  };
}

/** Address fields of the address tab, with the postal code search filling the others. */
export function registryAddressFields(spec: RegistryAddressSpec): ConfigurableCrudField[] {
  const key = (part: RegistryAddressPart) => fieldKey(spec.prefix, part);
  return [
    {
      ...addressField(spec, 'Zip', 'Zip'),
      breakBefore: true,
      postalLookup: {
        enabledWhen: (values) =>
          ['', 'BR', 'BRASIL', 'BRAZIL'].includes(
            registryText(values[key('Country')]).toUpperCase(),
          ),
        streetKey: key('Street'),
        districtKey: key('District'),
        complementKey: key('Complement'),
        cityKey: key('City'),
        stateKey: key('State'),
        countryKey: key('Country'),
        ...(spec.municipality ? { municipalityCodeKey: key('MunicipalityCode') } : {}),
        numberKey: key('Number'),
      },
    },
    { ...addressField(spec, 'Street', 'Street'), span: 2 },
    addressField(spec, 'Number', 'Number'),
    addressField(spec, 'Complement', 'Complement'),
    addressField(spec, 'District', 'District'),
    addressField(spec, 'City', 'City'),
    addressField(spec, 'State', 'State'),
    addressField(spec, 'Country', 'Country'),
    ...(spec.municipality
      ? [
          {
            ...addressField(spec, 'MunicipalityCode', 'IBGE municipality code'),
            help: 'Filled by the postal code search; required on fiscal documents.',
          },
        ]
      : []),
  ];
}

/** Empty initial values of the address fields. */
export function registryAddressValues(prefix: string): ConfigurableCrudRecord {
  return Object.fromEntries(REGISTRY_ADDRESS_PARTS.map((part) => [fieldKey(prefix, part), '']));
}

export const REGISTRY_STATUS_FIELD: ConfigurableCrudField = {
  key: 'status',
  source: 'Status',
  payloadKey: 'status',
  label: 'Status',
  type: 'status',
  span: 1,
};

export const REGISTRY_TYPE_FIELD: ConfigurableCrudField = {
  key: 'type',
  source: 'Type',
  payloadKey: 'type',
  label: 'Type',
  type: 'select',
  options: REGISTRY_TYPE_OPTIONS,
  span: 1,
};

export const REGISTRY_DOCUMENT_FIELD: ConfigurableCrudField = {
  key: 'document',
  source: 'Document',
  payloadKey: 'document',
  label: 'Document',
  span: 1,
};

/**
 * Document field with the "Search CNPJ" button (platform data lookup), which fills the name, legal
 * name, opening date, contact and the address of `addressPrefix` (the keys of registryAddressFields).
 * Forms with a company/person type also get "Search CPF" for people (name and date of birth).
 */
export function registryDocumentField(spec: {
  feature: string;
  addressPrefix: string;
  typeKey?: string;
  legalNameKey?: string;
  municipality?: boolean;
}): ConfigurableCrudField {
  const key = (part: RegistryAddressPart) => fieldKey(spec.addressPrefix, part);
  return {
    ...REGISTRY_DOCUMENT_FIELD,
    suffixButtons: [
      companyLookupButton({
        feature: spec.feature,
        documentKey: 'document',
        typeKey: spec.typeKey,
        nameKey: 'name',
        // The unified Registry form has legal name and trade name on every record.
        legalNameKey: spec.legalNameKey ?? 'legalName',
        tradeNameKey: 'tradeName',
        openingDateKey: 'legalDate',
        emailKey: 'email',
        phoneKey: 'phone',
        address: {
          zip: key('Zip'),
          street: key('Street'),
          number: key('Number'),
          complement: key('Complement'),
          district: key('District'),
          city: key('City'),
          state: key('State'),
          country: key('Country'),
          ...(spec.municipality ? { municipalityCode: key('MunicipalityCode') } : {}),
        },
      }),
      ...(spec.typeKey
        ? [
            personLookupButton({
              feature: spec.feature,
              documentKey: 'document',
              typeKey: spec.typeKey,
              nameKey: 'name',
              legalNameKey: spec.legalNameKey ?? 'legalName',
              birthDateKey: 'legalDate',
            }),
          ]
        : []),
    ],
  };
}

export const REGISTRY_OPENING_DATE_FIELD: ConfigurableCrudField = {
  key: 'legalDate',
  source: 'LegalDate',
  payloadKey: 'legalDate',
  label: 'Opening date',
  type: 'date',
  span: 1,
};

/** Opening date for a company, date of birth for a person. */
export const REGISTRY_LEGAL_DATE_FIELD: ConfigurableCrudField = {
  ...REGISTRY_OPENING_DATE_FIELD,
  labelWhen: ({ values }) =>
    String(values['type'] ?? '').toLowerCase() === 'person' ? 'Date of birth' : 'Opening date',
};

export const REGISTRY_EMAIL_FIELD: ConfigurableCrudField = {
  key: 'email',
  source: 'Email',
  payloadKey: 'email',
  label: 'E-mail',
  type: 'email',
  span: 1,
};

export const REGISTRY_PHONE_FIELD: ConfigurableCrudField = {
  key: 'phone',
  source: 'Phone',
  payloadKey: 'phone',
  label: 'Phone',
  type: 'phone',
  span: 1,
};

export const REGISTRY_NOTES_FIELD: ConfigurableCrudField = {
  key: 'notes',
  source: 'Notes',
  payloadKey: 'notes',
  label: 'Notes',
  type: 'textarea',
  tab: 'notes',
  span: 4,
  rows: 4,
};

export function registryNameField(
  extra: Partial<ConfigurableCrudField> = {},
): ConfigurableCrudField {
  return {
    key: 'name',
    source: 'Name',
    payloadKey: 'name',
    label: 'Name',
    required: true,
    span: 2,
    ...extra,
  };
}

/** Name, type, document, contact, address and notes of a supplier, carrier or reseller. */
export function registryPartyFields(feature = 'registry.party'): ConfigurableCrudField[] {
  return [
    REGISTRY_STATUS_FIELD,
    REGISTRY_TYPE_FIELD,
    registryDocumentField({ feature, addressPrefix: '', typeKey: 'type' }),
    REGISTRY_LEGAL_DATE_FIELD,
    registryNameField({ breakBefore: true }),
    REGISTRY_EMAIL_FIELD,
    REGISTRY_PHONE_FIELD,
    ...registryAddressFields({ prefix: '' }),
    REGISTRY_NOTES_FIELD,
  ];
}

export function registryPartyValues(): ConfigurableCrudRecord {
  return {
    status: 1,
    type: 'company',
    name: '',
    legalDate: '',
    document: '',
    email: '',
    phone: '',
    ...registryAddressValues(''),
    notes: '',
  };
}

export function registryPartyColumns(uuidField: string): ConfigurableCrudColumn[] {
  return [
    registryNameColumn(uuidField),
    { id: 'type', label: 'Type', field: 'Type' },
    { id: 'document', label: 'Document', field: 'Document', className: 'document-col' },
    { id: 'email', label: 'E-mail', field: 'Email', className: 'email-col' },
    REGISTRY_STATUS_COLUMN,
  ];
}

/** Texts and identity of a supplier, carrier or reseller page; the form is shared. */
export type RegistryPartyTexts = Pick<
  ConfigurableCrudConfig,
  | 'endpoint'
  | 'uuidField'
  | 'pageTitle'
  | 'pageDescription'
  | 'createTitle'
  | 'editTitle'
  | 'dialogDescription'
  | 'searchPlaceholder'
  | 'emptyLabel'
  | 'deleteTitle'
  | 'deleteMessage'
  | 'deleteSelectedTitle'
  | 'deleteSelectedMessage'
  | 'savedMessage'
  | 'deletedMessage'
  | 'deleteFailedMessage'
>;

export function registryPartyConfig(texts: RegistryPartyTexts): ConfigurableCrudConfig {
  return {
    ...texts,
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    initialValues: registryPartyValues(),
    columns: registryPartyColumns(texts.uuidField),
    fields: registryPartyFields(`registry.${String(texts.endpoint).split('/').pop()}`),
  };
}
