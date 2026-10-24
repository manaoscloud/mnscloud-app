/** Declared by every CPF lookup (LGPD); the same codes as the API. */
export const PERSON_LOOKUP_PURPOSES = [
  { value: 'registration', label: 'Customer or supplier registration' },
  { value: 'credit_analysis', label: 'Credit analysis' },
  { value: 'fraud_prevention', label: 'Fraud prevention' },
  { value: 'contract', label: 'Contract signing or execution' },
  { value: 'collection', label: 'Debt collection' },
  { value: 'legal_obligation', label: 'Legal or regulatory obligation' },
];

export const PERSON_LOOKUP_LEGAL_BASES = [
  { value: 'consent', label: 'Consent of the data subject' },
  { value: 'legal_obligation', label: 'Legal or regulatory obligation' },
  { value: 'contract', label: 'Contract with the data subject' },
  { value: 'legal_claims', label: 'Exercise of rights in legal proceedings' },
  { value: 'legitimate_interest', label: 'Legitimate interest' },
  { value: 'credit_protection', label: 'Credit protection' },
];
