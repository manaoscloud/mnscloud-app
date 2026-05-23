# Global DID Inventory UI

The App separates DID inventory ownership from tenant consumption.

## Master UI

- `/system/did/operator`
  - Manage global DID operators.
- `/system/did/number`
  - Manage global DID numbers.

Master screens call `/api/v1/system/voip/did/*`.

## Tenant UI

- `/voip/did`
  - Read-only list of numbers assigned to the selected tenant.

Tenant users do not see DID operator CRUD or global number CRUD. Assignment management is exposed through system APIs and should be wired only into master workflows.

## Removed legacy UI

- The former DID customer-link page was removed.
- Tenant-owned DID creation/edit/delete is not supported.
