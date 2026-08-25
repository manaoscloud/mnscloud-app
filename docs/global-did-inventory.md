# Global DID Inventory UI

The App separates DID inventory ownership from tenant consumption.

## Master UI

- `/system/did/operator`
  - Manage global DID operators/providers.
- `/system/did/number`
  - Manage global MNSCloud DID numbers.
- `/system/did/external`
  - Review tenant-owned external DIDs across tenants.

Master screens call `/api/v1/system/voip/did/*`.

## Tenant UI

- `/voip/did`
  - Read-only list of numbers assigned to the selected tenant.
- `/voip/did/external`
  - Tenant registration for third-party DID numbers.
  - The form contains only status, number, provider, and notes. Technical SIP validation belongs to trunks/peers/pipes/routes.
  - Saving an external DID is fail-closed by billing: if the tenant cannot subscribe to `module.voip.did.external`, creation fails.

Tenant users do not see DID operator CRUD or global number CRUD. Assignment management is exposed through system APIs and should be wired only into master workflows. External DID rows are tenant-owned and can be consumed by PABX/Softswitch inbound routing when active.

## Removed legacy UI

- The former DID customer-link page was removed.
- The former PABX-specific external-number registry was removed; PABX consumes canonical `VoipDid` rows.
- The former external DID validation/start-approval UI was removed because SIP source/domain validation belongs to trunk/peer/pipe/route policy, not DID inventory.
