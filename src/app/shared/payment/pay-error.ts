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
  PAY_REQUEST_REJECTED: 'Pay request could not be completed.',
};

/** Stable API codes, never arbitrary server text, select translated Pay errors. */
export function payErrorMessage(error: unknown): string | null {
  const code = (error as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === 'string' && code.startsWith('PAY_')
    ? (messages[code] ?? messages['PAY_REQUEST_REJECTED'])
    : null;
}
