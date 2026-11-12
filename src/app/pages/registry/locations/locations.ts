import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import {
  REGISTRY_NOTES_FIELD,
  registryAddressFields,
  registryAddressValues,
} from '../registry-fields';
import { plainText } from '../../website/shared/website-inbox';

export const COMPANY_LOOKUP = {
  endpoint: 'registry/companies?status=1',
  uuidField: 'CompanyUUID',
  labelField: 'Name',
  selectedLabelField: 'CompanyName',
};

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const PUBLISHED_FILTER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const HOURS_KEYS = [
  'weekdayOpens',
  'weekdayCloses',
  'saturdayOpens',
  'saturdayCloses',
  'sundayOpens',
  'sundayCloses',
] as const;

const HOURS_LABELS: Record<(typeof HOURS_KEYS)[number], string> = {
  weekdayOpens: 'Weekday opens',
  weekdayCloses: 'Weekday closes',
  saturdayOpens: 'Saturday opens',
  saturdayCloses: 'Saturday closes',
  sundayOpens: 'Sunday opens',
  sundayCloses: 'Sunday closes',
};

function sourceOf(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Opening time fields; empty means closed that day, `HH:MM` otherwise. */
const HOURS_FIELDS: ConfigurableCrudField[] = HOURS_KEYS.map((key) => ({
  key,
  source: sourceOf(key),
  label: HOURS_LABELS[key],
  type: 'time' as const,
  tab: 'hours' as const,
  span: 1 as const,
  hiddenWhen: ({ values }) => values['open24h'] === true,
}));

function text(value: unknown): string {
  return plainText(value).trim();
}

function timeOrNull(value: unknown): string | null {
  const v = text(value);
  return v ? v.slice(0, 5) : null;
}

function coordinate(value: unknown): number | null {
  const v = text(value);
  return v === '' ? null : Number(v);
}

/** API body: the same PascalCase keys as the response; unknown keys are rejected with 400. */
export function locationPayload(
  values: Record<string, unknown>,
  editing: boolean,
): Record<string, unknown> {
  const latitude = coordinate(values['latitude']);
  const longitude = coordinate(values['longitude']);
  const pair = latitude !== null && longitude !== null;
  return {
    ...(editing ? { Revision: Number(values['revision']) } : {}),
    Name: text(values['name']),
    CompanyUUID: values['companyUUID'] || null,
    Slug: text(values['slug']),
    Street: text(values['street']),
    Number: text(values['number']),
    Complement: text(values['complement']),
    District: text(values['district']),
    City: text(values['city']),
    State: text(values['state']).toUpperCase(),
    Zip: text(values['zip']),
    Country: text(values['country']).toUpperCase() || 'BR',
    Latitude: pair ? latitude : null,
    Longitude: pair ? longitude : null,
    Phone: text(values['phone']),
    Whatsapp: text(values['whatsapp']),
    Email: text(values['email']),
    Open24h: values['open24h'] === true,
    WeekdayOpens: timeOrNull(values['weekdayOpens']),
    WeekdayCloses: timeOrNull(values['weekdayCloses']),
    SaturdayOpens: timeOrNull(values['saturdayOpens']),
    SaturdayCloses: timeOrNull(values['saturdayCloses']),
    SundayOpens: timeOrNull(values['sundayOpens']),
    SundayCloses: timeOrNull(values['sundayCloses']),
    Services: plainText(values['services']).trim(),
    Published: values['published'] === true,
    Status: text(values['status']) || 'active',
    Notes: text(values['notes']),
  };
}

/** Places of the organization (stations, branches, stores) listed on the public website. */
const config = defineCrud({
  endpoint: 'registry/locations',
  uuidField: 'LocationUUID',
  pageTitle: 'Locations',
  pageDescription:
    'Places of your organization, such as stations, branches or stores, with address, opening hours and services, published on the public website.',
  createTitle: 'New location',
  editTitle: 'Edit location',
  bulkDelete: true,
  serverSidePagination: true,
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'inactive',
  statusOptions: STATUS_OPTIONS,
  initialValues: {
    status: 'active',
    name: '',
    companyUUID: '',
    slug: '',
    published: false,
    phone: '',
    whatsapp: '',
    email: '',
    services: '',
    ...registryAddressValues(''),
    country: 'BR',
    latitude: null,
    longitude: null,
    open24h: false,
    weekdayOpens: '',
    weekdayCloses: '',
    saturdayOpens: '',
    saturdayCloses: '',
    sundayOpens: '',
    sundayCloses: '',
    notes: '',
    revision: null,
  },
  tabLabels: { hours: 'Opening hours' },
  listFilters: [
    {
      key: 'companyUUID',
      label: 'Company',
      paramKey: 'companyUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: COMPANY_LOOKUP,
    },
    {
      key: 'published',
      label: 'Published',
      paramKey: 'published',
      type: 'select',
      span: 1,
      options: PUBLISHED_FILTER_OPTIONS,
    },
  ],
  columns: [
    { id: 'name', label: 'Name', field: 'Name', uuidField: 'LocationUUID', kind: 'identity' },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    {
      id: 'city',
      label: 'City / State',
      field: 'City',
      value: (row) => [text(row['City']), text(row['State'])].filter(Boolean).join(' / '),
    },
    { id: 'published', label: 'Published', field: 'Published', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status', options: STATUS_OPTIONS },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'status',
      options: STATUS_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      required: true,
      remoteLookup: COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
    },
    {
      key: 'slug',
      source: 'Slug',
      label: 'Slug',
      required: true,
      help: 'registry.locations.slugHelp',
    },
    {
      key: 'published',
      source: 'Published',
      label: 'Published',
      type: 'select',
      options: YES_NO_OPTIONS,
      fromRecord: (value) => value === true || value === 1,
      help: 'registry.locations.publishedHelp',
    },
    { key: 'phone', source: 'Phone', label: 'Phone', type: 'phone' },
    { key: 'whatsapp', source: 'Whatsapp', label: 'WhatsApp', type: 'phone' },
    { key: 'email', source: 'Email', label: 'E-mail', type: 'email' },
    // business-description: one service per line, shown on the public location page.
    {
      key: 'services',
      source: 'Services',
      label: 'Services',
      type: 'textarea',
      span: 4,
      rows: 4,
      help: 'registry.locations.servicesHelp',
    },
    ...registryAddressFields({ prefix: '' }),
    {
      key: 'latitude',
      source: 'Latitude',
      label: 'Latitude',
      type: 'number',
      tab: 'address',
      span: 1,
    },
    {
      key: 'longitude',
      source: 'Longitude',
      label: 'Longitude',
      type: 'number',
      tab: 'address',
      span: 1,
    },
    {
      key: 'open24h',
      source: 'Open24h',
      label: 'Open 24 hours',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'hours',
      fromRecord: (value) => value === true || value === 1,
      help: 'registry.locations.open24hHelp',
    },
    ...HOURS_FIELDS,
    REGISTRY_NOTES_FIELD,
    { key: 'revision', source: 'Revision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => locationPayload(values, editing),
});

@Component({
  selector: 'app-registry-locations',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegLocationPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
