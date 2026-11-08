import {
  ConfigurableCrudColumn,
  ConfigurableCrudOption,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';

export const CONTRACT_KIND_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'contract', label: 'contracts.kindContract' },
  { value: 'amendment', label: 'contracts.kindAmendment' },
  { value: 'nda', label: 'contracts.kindNda' },
  { value: 'order', label: 'contracts.kindOrder' },
  { value: 'agreement', label: 'contracts.kindAgreement' },
];

export const SIGNATURE_LEVEL_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'simple', label: 'contracts.signatureSimple' },
  { value: 'advanced', label: 'contracts.signatureAdvanced' },
  { value: 'qualified', label: 'contracts.signatureQualified' },
];

export const CLAUSE_CATEGORY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'general', label: 'contracts.categoryGeneral' },
  { value: 'confidentiality', label: 'contracts.categoryConfidentiality' },
  { value: 'payment', label: 'contracts.categoryPayment' },
  { value: 'termination', label: 'contracts.categoryTermination' },
  { value: 'liability', label: 'contracts.categoryLiability' },
  { value: 'compliance', label: 'contracts.categoryCompliance' },
  { value: 'sla', label: 'contracts.categorySla' },
];

export const TEMPLATE_CATEGORY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'general', label: 'contracts.categoryGeneral' },
  { value: 'service', label: 'contracts.categoryService' },
  { value: 'commercial', label: 'contracts.categoryCommercial' },
  { value: 'hr', label: 'contracts.categoryHr' },
  { value: 'reseller', label: 'contracts.categoryReseller' },
  { value: 'nda', label: 'contracts.categoryNda' },
];

export const RISK_LEVEL_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'standard', label: 'contracts.riskStandard' },
  { value: 'low', label: 'contracts.riskLow' },
  { value: 'medium', label: 'contracts.riskMedium' },
  { value: 'high', label: 'contracts.riskHigh' },
];

export const LANGUAGE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pt-BR', label: 'contracts.langPtBr' },
  { value: 'en-US', label: 'contracts.langEnUs' },
  { value: 'es-ES', label: 'contracts.langEsEs' },
];

export const ADJUSTMENT_INDEX_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'IPCA', label: 'contracts.indexIpca' },
  { value: 'IGP-M', label: 'contracts.indexIgpm' },
  { value: 'INPC', label: 'contracts.indexInpc' },
  { value: 'none', label: 'contracts.adjustmentNone' },
];

export const DOCUMENT_DIRECTION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'outbound', label: 'contracts.directionOutbound' },
  { value: 'inbound', label: 'contracts.directionInbound' },
];

export const DOCUMENT_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'draft', label: 'contracts.stateDraft' },
  { value: 'review', label: 'contracts.stateReview' },
  { value: 'pending_signature', label: 'contracts.statePendingSignature' },
  { value: 'signed', label: 'contracts.stateSigned' },
  { value: 'active', label: 'contracts.stateActive' },
  { value: 'expired', label: 'contracts.stateExpired' },
  { value: 'terminated', label: 'contracts.stateTerminated' },
  { value: 'cancelled', label: 'contracts.stateCancelled' },
];

export const CONTRACT_ACCOUNT_LOOKUP = {
  endpoint: 'contracts/accounts?status=1',
  uuidField: 'CtaUUID',
  labelField: 'CtaName',
};

export const TEMPLATE_LOOKUP = {
  endpoint: 'contracts/templates?status=1',
  uuidField: 'CttUUID',
  labelField: 'CttName',
};

export const DOC_TYPE_LOOKUP = {
  endpoint: 'registry/document-types?status=1',
  uuidField: 'RdtUUID',
  labelField: 'RdtName',
};

export const COMPANY_LOOKUP = {
  endpoint: 'registry/companies?status=1',
  uuidField: 'RcoUUID',
  labelField: 'RcoLegalName',
};

export const CUSTOMER_LOOKUP = {
  endpoint: 'registry/customers?status=1',
  uuidField: 'RcuUUID',
  labelField: 'RcuName',
};

export const SUPPLIER_LOOKUP = {
  endpoint: 'registry/suppliers?status=1',
  uuidField: 'RsuUUID',
  labelField: 'RsuName',
};

export const ENVELOPE_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'draft', label: 'contracts.envelopeDraft' },
  { value: 'sent', label: 'contracts.envelopeSent' },
  { value: 'partially_signed', label: 'contracts.envelopePartiallySigned' },
  { value: 'completed', label: 'contracts.envelopeCompleted' },
  { value: 'declined', label: 'contracts.envelopeDeclined' },
  { value: 'voided', label: 'contracts.envelopeVoided' },
  { value: 'expired', label: 'contracts.envelopeExpired' },
];

export const ROUTING_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'sequential', label: 'contracts.routingSequential' },
  { value: 'parallel', label: 'contracts.routingParallel' },
];

export const DOCUMENT_LOOKUP = {
  endpoint: 'contracts/documents?status=1',
  uuidField: 'CtdUUID',
  labelField: 'CtdTitle',
};

export const TARGET_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'crm_proposal', label: 'contracts.targetCrmProposal' },
  { value: 'crm_opportunity', label: 'contracts.targetCrmOpportunity' },
  { value: 'bill_contract', label: 'contracts.targetBillContract' },
  { value: 'reg_customer', label: 'contracts.targetRegCustomer' },
  { value: 'reg_supplier', label: 'contracts.targetRegSupplier' },
  { value: 'reg_employee', label: 'contracts.targetRegEmployee' },
  { value: 'work_order', label: 'contracts.targetWorkOrder' },
  { value: 'infragis_asset', label: 'contracts.targetInfraGisAsset' },
  { value: 'website_form', label: 'contracts.targetWebsiteForm' },
];

export const APPROVAL_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'contracts.approvalPending' },
  { value: 'approved', label: 'contracts.approvalApproved' },
  { value: 'rejected', label: 'contracts.approvalRejected' },
];

export const OBLIGATION_PARTY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'company', label: 'contracts.partyCompany' },
  { value: 'customer', label: 'contracts.partyCustomer' },
  { value: 'supplier', label: 'contracts.partySupplier' },
  { value: 'guarantor', label: 'contracts.partyGuarantor' },
];

export const OBLIGATION_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'contracts.obligationPending' },
  { value: 'fulfilled', label: 'contracts.obligationFulfilled' },
  { value: 'breached', label: 'contracts.obligationBreached' },
  { value: 'waived', label: 'contracts.obligationWaived' },
];

export const OBLIGATION_RECURRENCE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'one_time', label: 'contracts.recurrenceOneTime' },
  { value: 'monthly', label: 'contracts.recurrenceMonthly' },
  { value: 'quarterly', label: 'contracts.recurrenceQuarterly' },
  { value: 'semi_annual', label: 'contracts.recurrenceSemiAnnual' },
  { value: 'annual', label: 'contracts.recurrenceAnnual' },
];

export function createColumns(
  defs: ReadonlyArray<readonly [string, string, string, ConfigurableCrudColumn['kind']?]>,
): ConfigurableCrudColumn[] {
  return defs.map(([id, field, label, kind]) =>
    kind ? { id, field, label, kind } : { id, field, label },
  );
}


