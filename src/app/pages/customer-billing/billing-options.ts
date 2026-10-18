// Shared options of the customer billing pages (tenant bills its own customers, any module).

export const CONTRACT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export const ITEM_KINDS = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'one_off', label: 'One-off' },
  { value: 'usage', label: 'Usage' },
];

/** The nature of an item chooses its fiscal document (goods NF-e, communication NFCom, services NFS-e). */
export const ITEM_NATURES = [
  { value: 'communication', label: 'Communication (NFCom)' },
  { value: 'telephony', label: 'Telephony (NFCom)' },
  { value: 'sva', label: 'Value-added service (NFS-e)' },
  { value: 'hosting', label: 'Hosting (NFS-e)' },
  { value: 'processing', label: 'Data processing (NFS-e)' },
  { value: 'storage', label: 'Storage (NFS-e)' },
  { value: 'licensing', label: 'Software licensing (NFS-e)' },
  { value: 'support', label: 'Support (NFS-e)' },
  { value: 'goods', label: 'Goods (NF-e)' },
  { value: 'other', label: 'Other (no fiscal document)' },
];

export const CHARGE_STATUSES = [
  { value: 'issued', label: 'Issued' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const USAGE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'billed', label: 'Billed' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'void', label: 'Void' },
];

export const ADJUSTMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied' },
  { value: 'void', label: 'Void' },
];

export const LIFECYCLE_EVENTS = [
  { value: 'charge.overdue', label: 'Charge overdue' },
  { value: 'contract.suspend_requested', label: 'Suspend requested' },
  { value: 'contract.reactivate_requested', label: 'Reactivate requested' },
  { value: 'contract.cancelled', label: 'Contract cancelled' },
];

export const EVENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'acknowledged', label: 'Acknowledged' },
];

export const MODULE_LOOKUP = {
  endpoint: 'customer-billing/modules',
  uuidField: 'BsmCode',
  labelField: 'BsmName',
  descriptionField: 'BsmCode',
  selectedLabelField: 'ModuleName',
};
