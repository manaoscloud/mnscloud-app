# Security Policy

MNSCloud App is a public browser client. Treat everything in this repository as visible to customers,
partners, and contributors.

Do not commit:

- API tokens, JWTs, passwords, private keys, signing secrets, or service credentials.
- Customer data, production IPs/domains, provider account IDs, or private topology.
- API-side authorization, billing, tenant-scope, or secret-resolution logic.

Use placeholders in examples. Runtime configuration belongs in `public/env.js`; it must contain only
non-secret endpoint configuration such as `apiBaseUrl`.

Report security issues privately through the project maintainers.
