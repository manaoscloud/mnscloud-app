// Shared option lists of the fiscal pages.
export const FISCAL_ENVIRONMENTS = [
  { value: 'homologation', label: 'Homologation (test)' },
  { value: 'production', label: 'Production' },
];

export const FISCAL_MODELS = [
  { value: '65', label: 'NFC-e (65)' },
  { value: '55', label: 'NF-e (55)' },
  { value: '62', label: 'NFCom (62)' },
  { value: 'nfse', label: 'NFS-e' },
];

export const FISCAL_DOCUMENT_STATES = [
  { value: 'prevalidating', label: 'Pre-validating' },
  { value: 'generated', label: 'Generated' },
  { value: 'signed', label: 'Signed' },
  { value: 'sent', label: 'Sent' },
  { value: 'authorized', label: 'Authorized' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'denied', label: 'Denied' },
  { value: 'unknown', label: 'Awaiting authority answer' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'voided', label: 'Voided' },
];

export const COMPANY_LOOKUP = {
  endpoint: 'erp/companies',
  uuidField: 'CompanyUUID',
  labelField: 'Name',
  descriptionField: 'Document',
  selectedLabelField: 'CompanyName',
};
