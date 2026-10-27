import { MatDialog } from '@angular/material/dialog';
import { registryDocuments } from './documents';
import { registryText } from './registry-fields';
import { TranslocoService } from '@jsverse/transloco';
import { CONTACT_SECTORS_CONFIG } from './contact-sectors/contact-sectors';
import { AuthService } from '../../services/auth.service';
import { hasEffectivePermission } from '../../core/guards/permission.guard';
import { companyFiscalConfig } from '../fiscal/issuers';
import { inject, resource } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { AppI18nService } from '../../services/app-i18n.service';
import { countryOptions } from '../../shared/i18n/countries';
import type {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';

interface TaxIdType {
  TaxIdType: string;
  CountryCode: string;
  PartyType: string;
  Label: string;
}
const states = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'
  .split(' ')
  .map((value) => ({ value, label: value }));
const identityKeys = new Set([
  'status',
  'countryCode',
  'type',
  'taxIdType',
  'document',
  'legalName',
  'tradeName',
  'name',
  'legalDate',
  'alias',
]);
const field = (
  key: string,
  label: string,
  extra: Partial<ConfigurableCrudField> = {},
): ConfigurableCrudField => ({
  key,
  source: key[0].toUpperCase() + key.slice(1),
  payloadKey: key,
  label,
  span: 1,
  ...extra,
});

const sectorLookup = {
  endpoint: 'registry/contact-sectors',
  uuidField: 'ContactSectorUUID',
  labelField: 'Name',
  selectedLabelField: 'SectorName',
};
export function registryContacts(endpoint: string): ConfigurableCrudRelatedCollection {
  return {
    key: 'contacts',
    label: 'registry.contacts',
    emptyLabel: 'registry.noContacts',
    createTitle: 'registry.newContact',
    editTitle: 'registry.editContact',
    addLabel: 'registry.newContact',
    dialogDescription: 'registry.contactDescription',
    uuidField: 'ContactUUID',
    serverSidePagination: true,
    bulkDelete: true,
    endpoint: (parent) => `${endpoint}/${parent}/contacts`,
    updateEndpoint: (parent) => `${endpoint}/${parent}/contacts`,
    deleteEndpoint: (parent, row) => `${endpoint}/${parent}/contacts/${row['ContactUUID']}`,
    listFilters: [
      {
        key: 'RegContactSectorRseUUID',
        label: 'registry.sector',
        type: 'search-select',
        remoteLookup: sectorLookup,
        span: 1,
      },
    ],
    initialValues: {
      name: '',
      status: 1,
      RegContactSectorRseUUID: '',
      phone: '',
      extension: '',
      email: '',
    },
    fields: [
      field('status', 'Status', { type: 'status' }),
      field('name', 'Name', { required: true, span: 2 }),
      {
        key: 'RegContactSectorRseUUID',
        source: 'RegContactSectorRseUUID',
        label: 'registry.sector',
        type: 'search-select',
        required: true,
        span: 1,
        remoteLookup: { ...sectorLookup, endpoint: 'registry/contact-sectors?status=1' },
        quickCreate: quickCreateFor('RegContactSectorRseUUID'),
      },
      field('phone', 'Phone', {
        type: 'phone',
        requiredWhen: ({ values }) => !registryText(values['email']).trim(),
        help: 'registry.phoneOrEmail',
      }),
      field('extension', 'registry.extension'),
      field('email', 'E-mail', {
        type: 'email',
        span: 2,
        requiredWhen: ({ values }) => !registryText(values['phone']).trim(),
      }),
    ],
    columns: [
      { id: 'name', label: 'Name', field: 'Name', kind: 'identity' },
      { id: 'sector', label: 'registry.sector', field: 'SectorName' },
      { id: 'phone', label: 'Phone', field: 'Phone' },
      { id: 'extension', label: 'registry.extension', field: 'Extension' },
      { id: 'email', label: 'E-mail', field: 'Email' },
      { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
    ],
  };
}

/** Applied in the page injection context: one fiscal catalog and one layout for all six records. */
export function registryUnifiedConfig(original: ConfigurableCrudConfig): ConfigurableCrudConfig {
  const api = inject(ApiService);
  const dialog = inject(MatDialog);
  const auth = inject(AuthService);
  const i18n = inject(AppI18nService);
  const translations = inject(TranslocoService);
  const company = original.endpoint === 'registry/companies';
  const complex = original.endpoint === 'registry/customer-complexes';
  const customer = original.endpoint === 'registry/customers';
  const catalog = resource({
    loader: async () => {
      const response = await api.get<{ data?: { items?: TaxIdType[] } }>('registry/tax-id-types');
      return response.data?.items ?? [];
    },
    defaultValue: [],
  });
  const types = (values: ConfigurableCrudRecord) => {
    const country = registryText(values['countryCode']);
    if (!country) return [];
    const party = values['type'] === 'person' ? 'individual' : 'business';
    const local = catalog.value().filter((item) => item.CountryCode === country);
    return (
      local.length ? local : catalog.value().filter((item) => item.CountryCode === '*')
    ).filter((item) => item.PartyType === party || item.PartyType === 'any');
  };
  const existing = (key: string): Partial<ConfigurableCrudField> =>
    original.fields.find((item) => item.key === key) ?? {};
  const identity: ConfigurableCrudField[] = [
    field('status', 'Status', { ...existing('status'), breakBefore: false, span: 1 }),
    field('countryCode', 'Country', {
      type: 'search-select',
      translateOptions: false,
      optionsWhen: () => countryOptions(i18n.language()),
      requiredWhen: ({ editing }) => !editing && !complex,
      fromRecord: (_value, row) => row['CountryCode'] ?? '',
    }),
    field('type', 'registry.personType', {
      type: 'select',
      options: [
        { value: 'company', label: 'registry.business' },
        ...(!company ? [{ value: 'person', label: 'registry.individual' }] : []),
      ],
      disabledWhen: () => company,
    }),
    field('taxIdType', 'registry.documentType', {
      type: 'select',
      translateOptions: false,
      optionsWhen: ({ values }) => [
        {
          value: '',
          label: translations.translate('Automatic', {}, i18n.language()),
        },
        ...types(values).map((item) => ({ value: item.TaxIdType, label: item.Label })),
      ],
      loading: () => catalog.isLoading(),
    }),
    field('document', 'Document', {
      ...existing('document'),
      labelWhen: ({ values }) =>
        types(values).find((item) => item.TaxIdType === values['taxIdType'])?.Label ?? 'Document',
      span: 1,
      breakBefore: true,
    }),
    field('legalName', 'Legal name', {
      ...existing('legalName'),
      labelWhen: ({ values }) => (values['type'] === 'person' ? 'registry.fullName' : 'Legal name'),
      span: 2,
      breakBefore: false,
    }),
    field('tradeName', 'registry.tradeName', {
      hiddenWhen: ({ values }) => values['type'] === 'person',
    }),
    field('name', 'registry.displayName', {
      ...existing('name'),
      label: complex ? 'registry.complexName' : 'registry.displayName',
      span: 2,
      breakBefore: true,
    }),
    field('legalDate', 'Opening date', { ...existing('legalDate'), span: 1, breakBefore: false }),
    ...(complex
      ? [field('alias', 'Alias', { ...existing('alias'), span: 1, breakBefore: false })]
      : []),
  ];
  const remainder = original.fields
    .filter((item) => !identityKeys.has(item.key))
    .map((item) => {
      if (item.key === 'email' || item.key === 'phone')
        return {
          ...item,
          tab: 'contacts' as const,
          span: 2 as const,
          breakBefore: false,
          help: 'registry.generalChannelsHelp',
        };
      if (item.tab !== 'address') return item;
      if (/country$/i.test(item.key))
        return {
          ...item,
          type: 'search-select' as const,
          translateOptions: false,
          optionsWhen: ({ values }: { values: ConfigurableCrudRecord }) => {
            const options = countryOptions(i18n.language());
            const value = registryText(values[item.key]);
            return value && !options.some((option) => option.value === value)
              ? [{ value, label: value }, ...options]
              : options;
          },
          fromRecord: (_value: unknown, row: ConfigurableCrudRecord) =>
            row[item.source ?? item.key] ?? '',
          disabledWhen: ({ values }: { values: ConfigurableCrudRecord }) =>
            values[`sameCountry_${item.key}`] === true,
        };
      if (/state$/i.test(item.key)) {
        const countryKey = item.key.replace(
          /state$/i,
          item.key === 'state' ? 'country' : 'Country',
        );
        return {
          ...item,
          type: 'search-select' as const,
          translateOptions: false,
          typeWhen: ({ values }: { values: ConfigurableCrudRecord }) =>
            ['BR', 'BRASIL', 'BRAZIL'].includes(registryText(values[countryKey]).toUpperCase())
              ? ('search-select' as const)
              : ('text' as const),
          options: states,
        };
      }
      return item;
    });
  const addressCountries = remainder.filter(
    (item) => item.tab === 'address' && /country$/i.test(item.key),
  );
  const addressFields = remainder.flatMap((item) => {
    if (!addressCountries.includes(item)) return [item];
    return [
      {
        key: `sameCountry_${item.key}`,
        label: 'registry.sameCountry',
        type: 'select' as const,
        tab: 'address' as const,
        addressSection: item.addressSection,
        span: 1 as const,
        options: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' },
        ],
        fromRecord: (_value: unknown, row: ConfigurableCrudRecord) =>
          Boolean(row['CountryCode']) && row[item.source ?? item.key] === row['CountryCode'],
      },
      item,
    ];
  });
  const fiscal =
    customer || company || complex
      ? []
      : [
          field('ieIndicator', 'State registration indicator', {
            tab: 'fiscal',
            type: 'select',
            options: [
              { value: '', label: 'Not informed' },
              { value: 1, label: 'Taxpayer with state registration' },
              { value: 2, label: 'Exempt from state registration' },
              { value: 9, label: 'Non-taxpayer' },
            ],
          }),
          field('stateRegistration', 'State registration', {
            tab: 'fiscal',
            requiredWhen: ({ values }) =>
              values['countryCode'] === 'BR' && Number(values['ieIndicator']) === 1,
          }),
          field('municipalRegistration', 'Municipal registration', { tab: 'fiscal' }),
        ];
  const initialValues = {
    ...original.initialValues,
    ...Object.fromEntries(
      addressCountries.flatMap((item) => [
        [item.key, 'BR'],
        [`sameCountry_${item.key}`, true],
      ]),
    ),
    countryCode: 'BR',
    type: 'company',
    taxIdType: '',
    tradeName: '',
    legalName: '',
    ieIndicator: '',
    stateRegistration: '',
    municipalRegistration: '',
  };
  const config: ConfigurableCrudConfig = {
    ...original,
    saveAndContinue: true,
    authenticationAfterFiscal: customer,
    ...(company
      ? {
          formTabActions: [
            {
              tab: 'fiscal' as const,
              label: 'registry.openFiscalProfile',
              help: 'registry.fiscalProfileHelp',
              icon: 'account_balance',
              disabled: () =>
                !hasEffectivePermission(
                  auth.user()?.permissions ?? [],
                  'tenant.fiscal.issuers.read',
                ),
              run: (
                host: import('../../shared/crud/configurable-crud/configurable-crud-page-base').ConfigurableCrudPageBase<any>,
              ) => {
                const row = host.editingRecord();
                if (!row) return;
                return host.runRowAction(
                  {
                    key: 'fiscalProfile',
                    label: 'registry.fiscalProfile',
                    icon: 'account_balance',
                    collection: (company) =>
                      companyFiscalConfig(
                        company,
                        hasEffectivePermission(
                          auth.user()?.permissions ?? [],
                          'tenant.fiscal.issuers.write',
                        ),
                      ),
                  },
                  row,
                );
              },
            },
          ],
        }
      : {}),
    initialValues,
    ...(original.initialValuesFactory
      ? {
          initialValuesFactory: () => ({
            ...initialValues,
            ...original.initialValuesFactory!(),
            countryCode: 'BR',
            ...Object.fromEntries(
              addressCountries.flatMap((item) => [
                [item.key, 'BR'],
                [`sameCountry_${item.key}`, true],
              ]),
            ),
          }),
        }
      : {}),
    fields: [...identity, ...addressFields, ...fiscal],
    relatedCollections: [
      ...(original.relatedCollections ?? []),
      registryContacts(original.endpoint),
      ...(['registry/customers', 'registry/companies', 'registry/suppliers', 'registry/resellers'].includes(original.endpoint)
        ? [registryDocuments(original.endpoint, api, dialog, () => hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.registry.documents.review'), () => hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.registry.documents.ai'))] : []),
      ...(company
        ? [
            {
              key: 'fiscalProfile',
              tab: 'fiscal' as const,
              label: 'Fiscal',
              emptyLabel: 'registry.noFiscalProfile',
              visible: () =>
                hasEffectivePermission(
                  auth.user()?.permissions ?? [],
                  'tenant.fiscal.issuers.read',
                ),
              uuidField: 'FipUUID',
              endpoint: (parent: string) => `fiscal/issuers?companyUUID=${parent}`,
              deleteEndpoint: (_parent: string, row: ConfigurableCrudRecord) =>
                `fiscal/issuers/${row['FipUUID']}`,
              fields: [],
              columns: [],
              initialValues: {},
              config: (parent: string) => ({
                ...companyFiscalConfig({ CompanyUUID: parent }, false),
                readOnly: true,
                rowActions: [],
                pageTitle: 'registry.fiscalProfile',
                emptyLabel: 'registry.noFiscalProfile',
              }),
            },
          ]
        : []),
    ],
    fieldChange: (key, value, values) => {
      const next = original.fieldChange?.(key, value, values) ?? values;
      if (key === 'countryCode' || key === 'type') return { ...next, taxIdType: '' };
      return next;
    },
  };
  config.formTabActions = [
    ...(config.formTabActions ?? []),
    {
      tab: 'contacts',
      label: 'registry.manageSectors',
      help: 'registry.sectorDescription',
      icon: 'category',
      disabled: () =>
        !hasEffectivePermission(
          auth.user()?.permissions ?? [],
          'tenant.registry.contact-sectors.read',
        ),
      run: (host) =>
        host.runRowAction(
          {
            key: 'sectors',
            label: 'registry.sectors',
            icon: 'category',
            collection: () => CONTACT_SECTORS_CONFIG,
          },
          host.editingRecord() ?? {},
        ),
    },
  ];
  const originalChange = config.fieldChange;
  config.fieldChange = (key, value, values) => {
    const next = { ...(originalChange?.(key, value, values) ?? values) };
    for (const item of addressCountries) {
      if (
        (key === 'countryCode' || key === `sameCountry_${item.key}`) &&
        next[`sameCountry_${item.key}`] === true
      ) {
        next[item.key] = next['countryCode'] ?? '';
      }
    }
    return next;
  };
  config.payload = (payload, editing) => {
    const next = Object.fromEntries(
      Object.entries(payload).filter(([key]) => !key.startsWith('sameCountry_')),
    );
    if (company) delete next['type'];
    return original.payload?.(next, editing) ?? next;
  };
  return config;
}
