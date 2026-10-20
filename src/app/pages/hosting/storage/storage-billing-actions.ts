import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import type {
  ConfigurableCrudOption,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { storagePriceFields } from './storage-price-fields';

const STATES: readonly ConfigurableCrudOption[] = [
  { value: 'PLATFORM', label: 'Platform infrastructure' },
  { value: 'NOT_CONTRACTED', label: 'Not contracted' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_CANCEL', label: 'Pending cancellation' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CANCELED', label: 'Canceled' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
];
const MODES: readonly ConfigurableCrudOption[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ONE_TIME', label: 'One-time' },
  { value: 'GB_HOUR', label: 'GB-hour' },
];

/** Both dialogs use the shared CRUD form/collection surfaces. No separate billing editor. */
export function storageBillingActions(
  resource: 'accounts' | 'buckets',
  master: boolean,
): ConfigurableCrudRowAction[] {
  const prefix = master ? 'system/hosting/storage' : 'hosting/storage';
  const uuid = resource === 'accounts' ? 'HsaUUID' : 'HsbUUID';
  return [
    {
      key: 'storage-billing',
      label: 'Billing and usage',
      icon: 'receipt_long',
      collection: (row) =>
        defineCrud({
          endpoint: `${prefix}/${resource}/${row[uuid]}/billing`,
          uuidField: 'ResourceUUID',
          pageTitle: 'Billing and usage',
          pageDescription: 'Review prepaid billing, measured usage and preserved storage debt.',
          dialogDescription:
            'Preserved files continue to incur storage charges. Buckets have no fixed capacity limit.',
          createTitle: 'Billing and usage',
          editTitle: 'Billing and usage',
          readOnly: true,
          fields: [],
          initialValues: {},
          columns: [
            { id: 'name', field: 'Name', label: 'Name' },
            {
              id: 'state',
              label: 'Billing status',
              value: (item, translate) =>
                translate(
                  STATES.find((option) => option.value === item['BillingState'])?.label ??
                    'Unknown',
                ),
            },
            {
              id: 'mode',
              label: 'Billing mode',
              value: (item, translate) =>
                item['BillingMode']
                  ? translate(
                      MODES.find((option) => option.value === item['BillingMode'])?.label ??
                        'Unknown',
                    )
                  : '-',
            },
            {
              id: 'unit',
              field: 'UnitPrice',
              label: 'Unit price',
              kind: 'currency',
              currencyField: 'Currency',
              maximumFractionDigits: 6,
            },
            {
              id: 'debt',
              field: 'Debt',
              label: 'Preserved usage debt',
              kind: 'currency',
              currencyField: 'Currency',
              maximumFractionDigits: 6,
            },
            ...(resource === 'buckets'
              ? [
                  { id: 'bytes', field: 'UsedBytes', label: 'Measured bytes' },
                  {
                    id: 'measured',
                    field: 'MeasuredAt',
                    label: 'Last measurement',
                    kind: 'datetime' as const,
                  },
                ]
              : []),
            {
              id: 'preserve',
              field: 'PreserveUntil',
              label: 'Subscription preservation until',
              kind: 'datetime',
            },
          ],
        }),
    },
    ...(!master
      ? [
          {
            key: 'storage-activate',
            label: 'Activate prepaid billing',
            icon: 'payments',
            form: (row: Record<string, unknown>) =>
              defineCrud({
                endpoint: `${prefix}/${resource}/${row[uuid]}/activate`,
                uuidField: 'ResourceUUID',
                pageTitle: 'Activate prepaid billing',
                pageDescription:
                  'Choose and confirm a prepaid price for an existing storage resource.',
                dialogDescription:
                  'Use this action for migrated resources without a contract. Confirming charges the selected price. Existing contracts are managed in Billing.',
                createTitle: 'Activate prepaid billing',
                editTitle: 'Activate prepaid billing',
                savedMessage: 'Storage billing activated successfully.',
                fields: storagePriceFields(resource),
                columns: [],
                initialValues: { priceUuid: '' },
                payload: (values) => ({ priceUuid: values['priceUuid'] }),
              }),
          },
        ]
      : []),
  ];
}
