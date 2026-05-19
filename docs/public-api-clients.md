# Public API Client Boundary

`mnscloud-app` is a public browser client for the MNSCloud API. It may be published,
forked, audited, and deployed independently from the API/control plane.

The app may document API endpoints, request/response shapes, runtime configuration, and local
development workflows. It must not contain permanent secrets, customer data, private domains/IPs,
provider credentials, database credentials, master keys, private infrastructure topology, or
server-side authorization logic.

Configure the API endpoint through `public/env.js`:

```js
window.MNSCLOUD_APP_CONFIG = {
  apiBaseUrl: "https://api.example.com/api/v1",
};
```

Use placeholders in examples. The API remains the source of truth for authentication, tenant scope,
permissions, billing, routing ownership, policy decisions, and secret resolution.
