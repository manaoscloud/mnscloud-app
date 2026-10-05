import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/** API-authorized composition, displayed through the same shared list/dialog renderer. */
export function billingComposition(endpoint: string, contracted: boolean) {
  return defineCrud({
    endpoint,
    uuidField: contracted ? 'BsiUUID' : 'BkiUUID',
    pageTitle: contracted ? 'Contracted composition' : 'Package composition',
    pageDescription: contracted
      ? 'Products and quantities accepted when this contract was created.'
      : 'Products and quantities included in this offer.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    serverSidePagination: true,
    columns: [
      { id: 'product', label: 'Product', field: contracted ? 'ProductName' : 'BprName' },
      { id: 'code', label: 'Code', field: contracted ? 'ProductCode' : 'BprCode' },
      { id: 'entitlement', label: 'Item entitlement', field: 'EntitlementCode' },
      {
        id: 'quantity',
        label: 'Included quantity',
        field: 'IncludedQuantity',
        value: (row, t) =>
          Number(row['IncludedQuantity']) === -1 ? t('Unlimited') : String(row['IncludedQuantity']),
      },
    ],
    fields: [],
  });
}

export function billingCycles(endpoint: string) {
  return defineCrud({
    endpoint,
    uuidField: 'BscUUID',
    pageTitle: 'Paid cycles',
    pageDescription:
      'Cycle history recorded by this billing version. Earlier charges remain in the wallet ledger.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    serverSidePagination: true,
    columns: [
      { id: 'number', label: 'Cycle', field: 'BscNumber', kind: 'number' },
      { id: 'start', label: 'Period start', field: 'BscPeriodStart', kind: 'datetime' },
      { id: 'end', label: 'Period end', field: 'BscPeriodEnd', kind: 'datetime' },
      {
        id: 'amount',
        label: 'Amount',
        field: 'BscAmount',
        kind: 'currency',
        currencyField: 'BscCurrency',
      },
    ],
    fields: [],
  });
}
