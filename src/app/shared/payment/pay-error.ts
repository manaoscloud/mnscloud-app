const messages: Record<string, string> = {
  PAY_INVALID_CREDENTIALS: 'Provide all credential fields to replace the stored secret.',
  PAY_INSUFFICIENT_CREDIT: 'Insufficient prepaid credit.',
  PAY_SETTLEMENT_CONFLICT: 'Settlement reference conflicts with recorded settlement',
  PAY_ACCOUNT_INACTIVE: 'Payment provider account is inactive.',
  PAY_INVALID_PERIOD: 'Effective end must not precede effective start',
  PAY_INVALID_AMOUNT: 'Invalid fee amount limits.',
  PAY_INVALID_VOLUME: 'Invalid fee volume threshold or period.',
  PAY_INVALID_CURRENCY: 'A valid currency is required.',
  PAY_PLAN_REQUIRED: 'An active fee plan and rate are required.',
  PAY_RATE_REQUIRED: 'An active fee plan and rate are required.',
  PAY_NOT_FOUND: 'Payment resource not found.',
  PAY_FORBIDDEN: 'Permission denied.',
  PAY_ACCOUNT_NUMBER_REQUIRED: 'The checking account number is required.',
  PAY_INVALID_ENVIRONMENT: 'Environment must be production or sandbox.',
  PAY_INVALID_RECEIVE_METHODS: 'Receive methods are invalid.',
  PAY_INVALID_CANCEL_DAYS: 'Days to cancel after due date must be between 0 and 60.',
  PAY_CREDENTIALS_REQUIRED: 'Client ID, Client Secret, certificate and private key are required.',
  PAY_CERTIFICATE_KEY_MISMATCH: 'The private key does not belong to the certificate.',
  PAY_CERTIFICATE_EXPIRED: 'The certificate has expired.',
  PAY_INVALID_CERTIFICATE: 'The certificate or private key file is invalid.',
  PAY_UNSUPPORTED_BANK: 'This bank is not supported.',
  PAY_INVALID_WEBHOOK_URL: 'The platform address for the webhook is invalid.',
  PAY_WEBHOOK_UNSUPPORTED: 'This bank does not support settlement webhooks.',
  PAY_BANK_REJECTED:
    'The bank rejected the connection. Check credentials, certificate and environment.',
  PAY_BANK_UNREACHABLE: 'The bank could not be reached. Check the certificate and try again.',
  PAY_REQUEST_REJECTED: 'Pay request could not be completed.',
};

/** Stable API codes, never arbitrary server text, select translated Pay errors. */
export function payErrorMessage(error: unknown): string | null {
  const code = (error as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === 'string' && code.startsWith('PAY_')
    ? (messages[code] ?? messages['PAY_REQUEST_REJECTED'])
    : null;
}
