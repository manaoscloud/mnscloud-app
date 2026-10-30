const messages: Record<string, string> = {
  COMMERCE_ACCOUNT_FORBIDDEN: 'commerceAccount.forbidden',
  COMMERCE_ACCOUNT_CONFLICT: 'commerceAccount.conflict',
  COMMERCE_ACCOUNT_NOT_FOUND: 'commerceAccount.notFound',
  COMMERCE_ACCOUNT_UNAVAILABLE: 'commerceAccount.failed',
};

/** Stable server codes select translations without displaying server implementation details. */
export function commerceAccountErrorMessage(error: unknown): string | null {
  const code = (error as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === 'string' ? (messages[code] ?? null) : null;
}
