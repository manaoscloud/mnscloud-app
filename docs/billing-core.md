# Billing Core UI

The Billing UI is split by context mode.

## Tenant

Route: `/billing`

The tenant page shows:

- Prepaid wallet balances by currency.
- Active billing catalog exposed by the API.
- Tenant subscriptions.
- Immutable ledger entries.

Tenants can create subscriptions from active catalog prices and cancel their own subscriptions.
Tenant users cannot create prices, manipulate credit, or alter ledger history.

## Master

Route: `/system/billing`

The master page shows:

- Global billable products.
- Global price book.
- All tenant subscriptions.
- Manual prepaid credit dialog.

Product, price, and manual credit actions use `MatDialog` CRUD flows. Manual credit requires a target tenant UUID, amount, reason, and optional idempotency key/reference.

Products expose open master-managed fields for canonical codes, entitlement patterns, prerequisite
entitlements, resource type, and public catalog metadata. The frontend only captures those values;
DB/API remain responsible for validating codes, evaluating entitlements, enforcing prepaid credit,
and publishing sanitized public offer data.

## API Contract

The page consumes only the Billing API:

- Tenant: `/billing/*`
- Master: `/system/billing/*`
- Public website/catalog: `/public/billing/offers`

No pricing authority, ledger mutation, token generation, or balance arithmetic is implemented in the frontend.
