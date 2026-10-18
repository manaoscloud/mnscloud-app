// Shared options of the accounting integration pages.

export const ACCOUNTING_EVENT_TYPES = [
  { value: 'receivable.issued', label: 'Receivable issued' },
  { value: 'receivable.cancelled', label: 'Receivable cancelled' },
  { value: 'receivable.settled', label: 'Receivable settled' },
  { value: 'receivable.settlement_reversed', label: 'Receipt reversed' },
  { value: 'payable.issued', label: 'Payable issued' },
  { value: 'payable.cancelled', label: 'Payable cancelled' },
  { value: 'payable.settled', label: 'Payable settled' },
  { value: 'payable.settlement_reversed', label: 'Payment reversed' },
  { value: 'fiscal.authorized', label: 'Fiscal document authorized' },
  { value: 'fiscal.cancelled', label: 'Fiscal document cancelled' },
  { value: 'stock.movement', label: 'Stock movement' },
];

export const ACCOUNTING_EVENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'posted', label: 'Posted' },
  { value: 'exported', label: 'Exported' },
  { value: 'error', label: 'Error' },
];

export const COST_CENTER_LOOKUP = {
  endpoint: 'accounting/cost-centers?status=1',
  uuidField: 'AccUUID',
  labelField: 'AccName',
  descriptionField: 'AccCode',
  selectedLabelField: 'CostCenterName',
};
