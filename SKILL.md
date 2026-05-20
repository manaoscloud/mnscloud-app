# MNSCloud App Skill

Use this repository as an independent public frontend client for the MNSCloud API.

## Runtime API Contract

- Configure the API through `public/env.js`.
- Use `window.MNSCLOUD_APP_CONFIG.apiBaseUrl` for the API v1 base URL.
- Leave `apiBaseUrl` empty only when the app is served by the same origin as `/api/v1`.
- Do not hardcode tenant domains, production API URLs, tokens, or private infrastructure details.

## Development Rules

- API calls must go through `src/app/services/api.service.ts`.
- Runtime URL resolution must stay in `src/app/shared/runtime/app-runtime-config.ts`.
- CRUD pages must follow `app.md`.
- File uploads must use the shared upload progress helpers in `src/app/shared/upload/`.
- Browser-side permission checks are UX only; enforcement belongs to the API.

## Validation

Run before committing:

```bash
npm run build
```

Use `npm run check:crud` when changing CRUD templates or CRUD baseline behavior.

For bare-metal production runtime validation, the installer is:

```bash
sudo ./scripts/install-nginx-runtime.sh
```

It supports Debian 12/13 and RHEL/Rocky/AlmaLinux 9/10, configures the official stable nginx.org
package repository, installs Nginx with the host package manager, builds the app, deploys
`dist/app/browser`, writes runtime `env.js`, and creates `/etc/nginx/conf.d/mnscloud-app.conf`.

## Contribution Governance

- External contributions must be submitted through Pull Requests.
- Follow `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, and this `SKILL.md` before proposing changes.
- Do not add secrets, customer data, private infrastructure details, production domains/IPs, or hidden bypass logic.
- MNSCloud may choose to pay, sponsor, contract, or hire contributors when work demonstrates strong value, but paid work requires explicit written agreement and is never implied by opening a Pull Request.
- Keep security-sensitive decisions, tenant scope, billing, authorization, routing ownership, and secret resolution in the MNSCloud API/control plane.
