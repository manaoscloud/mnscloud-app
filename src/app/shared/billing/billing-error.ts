const messages: Record<string, string> = {
  BILLING_IDEMPOTENCY_CONFLICT:
    'This purchase request was already used for a different offer. Reload the page and try again.',
  BILLING_OFFER_ALREADY_SUBSCRIBED: 'You already subscribe to this offer.',
  BILLING_RESOURCE_ALREADY_SUBSCRIBED: 'This resource already has a subscription.',
  BILLING_SUBSCRIPTION_NOT_FOUND: 'Subscription not found.',
  BILLING_PRICE_NOT_FOUND: 'The selected price is no longer available.',
  BILLING_RENEWAL_UNSUPPORTED: 'This subscription does not support automatic renewal.',
  BILLING_OFFER_NOT_FOR_TENANTS: 'This offer is not available to tenants.',
  BILLING_REQUIRED_ENTITLEMENT_MISSING:
    'This offer requires the {{module}} module. Subscribe to {{module}} first.',
  BILLING_PACKAGE_EMPTY: 'This package has no active items.',
  BILLING_PACKAGE_UNAVAILABLE_ITEM: 'This package contains an item that is no longer available.',
  BILLING_PACKAGE_REQUIREMENT_MISSING:
    'This package includes a resource that requires the {{module}} module. Subscribe to {{module}} first or choose a package that includes it.',
  BILLING_ENVIRONMENT_REQUIRED: 'Select an environment to subscribe.',
  BILLING_OFFER_REQUIRED: 'Select the product or package to subscribe.',
  BILLING_IDEMPOTENCY_KEY_REQUIRED: 'Reload the page and try the purchase again.',
  BILLING_QUANTITY_INVALID: 'The quantity must be greater than zero.',
  BILLING_OFFER_UNAVAILABLE: 'This offer is not available for new subscriptions.',
  BILLING_PRICE_MISMATCH: 'The selected price does not belong to this offer.',
  BILLING_QUANTITY_ONE_REQUIRED: 'Modules and packages are subscribed with quantity one.',
  BILLING_RESOURCE_REQUIRED: 'Select the resource for this subscription.',
  BILLING_PROMOTION_INVALID: 'The promotion or coupon is not valid for this price.',
  BILLING_PROMOTION_LIMIT: 'This promotion reached its redemption limit.',
  BILLING_PROMOTION_TENANT_LIMIT: 'You reached the redemption limit of this promotion.',
  BILLING_COUPON_LIMIT: 'This coupon reached its redemption limit.',
  BILLING_COUPON_TENANT_LIMIT: 'You reached the redemption limit of this coupon.',
  BILLING_INSUFFICIENT_CREDIT: 'Insufficient prepaid credit.',
  BILLING_PACKAGE_ITEM_REQUIREMENT_MISSING:
    'This product requires the {{module}} module. Add {{module}} to the package first.',
  BILLING_PACKAGE_ITEM_REQUIRED_BY_OTHER:
    'Another item of this package requires the {{module}} module. Remove that item first.',
  BILLING_FAILED: 'Unable to complete the billing operation.',
};

/** Modules with a `commercial.module.<module>` label; others show the raw entitlement. */
const LABELED_MODULES = new Set([
  'erp',
  'isp',
  'voip',
  'hosting',
  'sale',
  'support',
  'monitoring',
  'cyber-security',
  'infragis',
  'realtime',
]);

export interface BillingErrorText {
  key: string;
  /** `module` is either `i18n:<key>` (translate it) or a raw entitlement code. */
  params?: Record<string, string>;
}

/** Stable API codes, never arbitrary server text, select translated billing errors. */
export function billingErrorText(error: unknown): BillingErrorText | null {
  const body = (error as { error?: Record<string, unknown> } | null)?.error;
  const code = typeof body?.['code'] === 'string' ? body['code'] : null;
  if (!code?.startsWith('BILLING_')) return null;
  const key = messages[code] ?? messages['BILLING_FAILED'];
  if (!key.includes('{{module}}')) return { key };
  const module = typeof body?.['requiredModule'] === 'string' ? body['requiredModule'] : '';
  const entitlement =
    typeof body?.['requiredEntitlement'] === 'string' ? body['requiredEntitlement'] : '';
  const label = LABELED_MODULES.has(module)
    ? `i18n:commercial.module.${module}`
    : entitlement || module || '-';
  return { key, params: { module: label } };
}

/** Snackbar form (`key|module=...`) used by the API interceptor. */
export function billingErrorMessage(error: unknown): string | null {
  const text = billingErrorText(error);
  if (!text) return null;
  return text.params ? `${text.key}|module=${text.params['module']}` : text.key;
}
