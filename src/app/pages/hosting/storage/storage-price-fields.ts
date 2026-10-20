import { ConfigurableCrudField } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

/** Catalog values are informational; checkout validates and snapshots the price in the API/DB. */
export function storagePriceFields(resource: 'accounts' | 'buckets'): ConfigurableCrudField[] {
  const hideTerms: ConfigurableCrudField['hiddenWhen'] = ({ editing, values }) =>
    editing || !values['priceUuid'];
  return [
    {
      key: 'priceUuid',
      source: 'BillingPriceBpcUUID',
      label: 'Price',
      type: 'search-select',
      span: 1,
      requiredWhen: ({ editing }) => !editing,
      hiddenWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: `hosting/storage/${resource}/prices`,
        uuidField: 'BpcUUID',
        labelField: 'PriceLabel',
        fill: {
          priceMode: 'BpcBillingMode',
          priceCurrency: 'BpcCurrency',
          priceUnit: 'BpcUnitPrice',
          priceSetup: 'BpcSetupAmount',
          priceMinimum: 'BpcMinimumCommitment',
        },
      },
    },
    {
      key: 'priceMode',
      label: 'Billing mode',
      type: 'search-select',
      span: 1,
      hiddenWhen: hideTerms,
      disabledWhen: () => true,
      options: [
        { value: 'MONTHLY', label: 'Monthly' },
        { value: 'ONE_TIME', label: 'One-time' },
        { value: 'GB_HOUR', label: 'GB-hour' },
      ],
    },
    ...[
      ['priceCurrency', 'Currency'],
      ['priceUnit', 'Unit price'],
      ['priceSetup', 'Setup amount'],
      ['priceMinimum', 'Minimum commitment'],
    ].map(([key, label]): ConfigurableCrudField => ({
      key,
      label,
      type: 'text',
      span: 1,
      hiddenWhen: hideTerms,
      disabledWhen: () => true,
    })),
  ];
}
