# Global DID Inventory UI

The App separates DID inventory ownership from tenant consumption.

## Master UI

- `/system/did/operator`
  - Manage global DID operators.
- `/system/did/number`
  - Manage global DID numbers.

Master screens call `/api/v1/system/voip/did/*`.

- `/system/did/external`
  - Review tenant-provided external DIDs.
  - Approve, reject, suspend, or delete external DID records.

## Tenant UI

- `/voip/did`
  - Read-only list of numbers assigned to the selected tenant.
- `/voip/did/external`
  - Tenant registration for third-party DID numbers.
  - Tenants provide provider/account/source notes and platform billing metadata, then wait for validation/approval.

Tenant users do not see DID operator CRUD or global number CRUD. Assignment management is exposed through system APIs and should be wired only into master workflows. External DID rows are tenant-owned but cannot be used for inbound routing until the platform marks them active.

## Removed legacy UI

- The former DID customer-link page was removed.
- Tenant-owned DID creation/edit/delete is not supported.
