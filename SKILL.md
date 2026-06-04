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
- CRUD dialog primary record tabs must use the translated `Record` key (`[label]="'Record' | t`).
  Do not use `Data`, `Date`, or `Details` for CRUD record tabs.
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

It supports Debian 12/13 and RHEL/Rocky/AlmaLinux 9/10, uses `mnscloud-runtime-kit` for the base
Nginx package installation, installs Node.js 24 from NodeSource when needed, builds the app,
deploys `dist/app/browser`, writes runtime `env.js`, and creates
`/etc/nginx/conf.d/mnscloud-app.conf`. The app runtime listens on `0.0.0.0:8080` by
default so a separate `mnscloud-nginx` edge host can reach it; use mnscloud-agent/cyber security
network policies to restrict access to the edge host, or use `APP_LISTEN_ADDR=127.0.0.1` for
same-host edge deployments. Do not manage nftables in this installer.

After a repository commit has been pushed, update an existing app host with:

```bash
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-nginx-runtime.sh --ref v0.1.0
sudo ./scripts/validate-nginx-runtime.sh
curl -I http://127.0.0.1:8080
```

The update script requires an explicit semver release tag, checks out that release, rebuilds the
Angular bundle, deploys it to `/var/www/mnscloud-app`, writes runtime `env.js` and `build.json`,
validates Nginx, reloads the service, and restores the previous commit if validation fails. Use
`sudo ./scripts/rollback-nginx-runtime.sh --ref <known-good-release-tag>` for rollback.

Production App releases are created by the repository `Auto Release` GitHub Actions workflow after
validated changes are committed and pushed to `main`. The workflow uses
`scripts/release-app.sh` as the canonical release engine. Do not mark a new App version as available
to operators until the matching release commit, Git tag, and GitHub Release exist on GitHub.

## Contribution Governance

- External contributions must be submitted through Pull Requests.
- Follow `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, and this `SKILL.md` before proposing changes.
- Do not add secrets, customer data, private infrastructure details, production domains/IPs, or hidden bypass logic.
- MNSCloud may choose to pay, sponsor, contract, or hire contributors when work demonstrates strong value, but paid work requires explicit written agreement and is never implied by opening a Pull Request.
- Keep security-sensitive decisions, tenant scope, billing, authorization, routing ownership, and secret resolution in the MNSCloud API/control plane.
