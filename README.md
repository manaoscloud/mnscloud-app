# MNSCloud App

MNSCloud App is the public Angular browser client for the MNSCloud API. It is designed to run as an
independent repository so customers, partners, and contributors can work on the user interface while
the business core stays in the API/control plane.

## Requirements

Local development and GitHub release builds:

- Node.js 24 or a compatible current Node.js runtime
- npm
- Access to an MNSCloud API endpoint

Bare-metal app runtime hosts:

- Nginx, installed through `mnscloud-runtime-kit`
- `curl`, `git`, `rsync`, `tar`, and `sha256sum`
- Access to the published GitHub Release artifact

Bare-metal runtime hosts do not compile Angular and do not require Node.js or npm. The browser
bundle is built once by GitHub Actions, attached to the GitHub Release, synchronized into the
MNSCloud runtime release cache, downloaded by the agent, checksum-verified, and published to Nginx.

## Contract

- Product/runtime: `mnscloud-app`
- Project directory: `/opt/mnscloud/mnscloud-app`
- Framework: Angular
- Local development command: `npm run start`
- Build command: `npm run build`
- Browser build output: `dist/app/browser`
- Runtime config source: `public/env.js`
- Runtime config example: `public/env.example.js`
- Production Dockerfile: `Dockerfile.production`
- Production Compose file: `docker-compose.production.yml`
- Bare-metal Nginx installer: `scripts/install-nginx-runtime.sh`
- Bare-metal update command: `scripts/update-nginx-runtime.sh`
- Bare-metal rollback command: `scripts/rollback-nginx-runtime.sh`
- Bare-metal validation command: `scripts/validate-nginx-runtime.sh`
- Release manifest: `releases/manifest.json`
- Installed build metadata: `/var/www/mnscloud-app/build.json`
- Bare-metal web root: `/var/www/mnscloud-app`
- Bare-metal runtime config: `/var/www/mnscloud-app/env.js`
- Bare-metal Nginx config: `/etc/nginx/conf.d/mnscloud-app.conf`
- Bare-metal service: `nginx.service`
- Bare-metal listen address: `0.0.0.0:8080`, protected by agent-managed network policy

## Repository Access

Install GitHub CLI if needed:
[cli/cli installation](https://github.com/cli/cli#installation).

Authenticate GitHub CLI:

```bash
gh auth login
```

Clone the private repository:

```bash
sudo install -d -m 0755 /opt/mnscloud
cd /opt/mnscloud
gh repo clone manaoscloud/mnscloud-app
cd /opt/mnscloud/mnscloud-app
```

## API Configuration

The app reads runtime configuration from `public/env.js` before Angular starts. This file is a
runtime/build input, not the permanent source of truth for any environment:

```js
window.MNSCLOUD_APP_CONFIG = {
  apiBaseUrl: "https://api.example.com/api/v1",
};
```

If `apiBaseUrl` is empty, the app falls back to same-origin `/api/v1`. This is the recommended
production default when an edge gateway serves the app and proxies `/api` to MNSCloud API.

When the app is accessed through `mnscloud-nginx`, the browser-facing `/env.js` is served by the
edge gateway from `/etc/nginx/mnscloud/runtime/env.js`. That edge runtime file must also keep
`apiBaseUrl` empty unless the deployment intentionally uses a separate public API origin. Do not use
private host DNS names, internal IPs, or edge hostnames in browser-facing `env.js`.

Do not commit tenant, partner, staging, or production API URLs into `public/env.js`. Use one of
these environment-specific mechanisms instead:

- Local development: copy `public/env.example.js` to `public/env.js` and edit only the local file.
- Bare-metal installer: keep the default same-origin behavior, or pass `APP_API_BASE_URL`
  explicitly when the app must call a separate public API origin.
- GitHub static build: pass `api_base_url` when manually running the `CI` workflow, or configure the
  `MNSCLOUD_API_BASE_URL` GitHub Actions variable.
- Docker production runtime: keep `apiBaseUrl` empty for same-origin `/api/v1`, or mount an
  environment-specific `/usr/share/nginx/html/env.js` at deploy time.

The API must allow the app origin through CORS when the frontend and API run on different domains,
for example `http://localhost:4200` during local development.

## Local Development

```bash
cp public/env.example.js public/env.js
npm install
npm run start
```

Open `http://localhost:4200`.

## Build

Create the Angular production bundle locally:

```bash
npm run build
```

The browser files are generated at `dist/app/browser`.

## GitHub Build Configuration

GitHub Actions generates `public/env.js` during CI, so environment-specific API URLs do not need to
be committed. By default the value is empty and the browser uses same-origin `/api/v1`.

For repository-wide builds, create this GitHub Actions variable under
`Settings -> Secrets and variables -> Actions -> Variables`:

```text
MNSCLOUD_API_BASE_URL=https://api.example.com/api/v1
```

For one-off builds, run the `CI` workflow manually and fill the optional `api_base_url` input. The
workflow uploads the generated browser bundle as the `mnscloud-app-browser` artifact.

GitHub-driven deployment automation for the DB -> API -> App cascade is documented in
`docs/deployment-automation.md`.

Recommended build choices:

- Use an empty API URL when the final domain also exposes `/api/v1` through the edge gateway.
- Use `api_base_url` or `MNSCLOUD_API_BASE_URL` only when the app must call a separate API origin.
- Treat public API URLs as deploy configuration. Never use secrets, tokens, customer identifiers, or
  private infrastructure details in `env.js`.

## Development Docker

```bash
docker compose up --build
```

The standalone Compose file mounts the project into `/app` and keeps `node_modules` in a container
volume, so Angular hot reload works through the standard `npm run start` script. Configure the API
endpoint in `public/env.js`.

## Production Runtime

The production image is autonomous: it builds the Angular app and serves the generated static files
with an internal Nginx runtime. The edge gateway should proxy the app domain to this service, while
`/api` remains owned by the API edge route.

There are two supported production runtime paths:

- Docker image with internal Nginx.
- Bare-metal Nginx installed by this repository.

### Docker Runtime

```bash
docker build -f Dockerfile.production -t mnscloud-app:production .
docker run --rm -p 8080:80 mnscloud-app:production
```

Or with Compose:

```bash
docker compose -f docker-compose.production.yml up --build
```

Open `http://localhost:8080`. In production behind `mnscloud-nginx`, configure the edge like:

```nginx
location /api/ {
  proxy_pass http://mnscloud-api:8000/api/;
}

location / {
  proxy_pass http://mnscloud-app:80;
}
```

The app container intentionally serves only the browser client. If `public/env.js` leaves
`apiBaseUrl` empty, the browser uses same-origin `/api/v1`, so the edge must keep the API route
available on the same public origin. For a separate API domain, provide a custom `public/env.js`
before building or mount one over `/usr/share/nginx/html/env.js` at runtime.

Example runtime override:

```bash
docker run --rm -p 8080:80 \
  -v /etc/mnscloud/app/env.js:/usr/share/nginx/html/env.js:ro \
  mnscloud-app:production
```

### Bare-Metal Nginx Runtime

Use the installer when this module owns its own Nginx process on the app host. By default it serves
the built app from `/var/www/mnscloud-app` and listens on `0.0.0.0:8080`, so an external
`mnscloud-nginx` edge on another host can proxy to it without sharing the app files.

#### Install

Resolve the latest approved release from the MNSCloud API registry when installing from a published
artifact. On a full MNSCloud workspace host, this can be inspected with:

```bash
cd /opt/mnscloud
scripts/runtime/latest-release.sh mnscloud-app --format env
```

Then pass the release artifact URL and SHA-256 digest to the installer.

Useful options:

```bash
sudo APP_LISTEN_ADDR=0.0.0.0 \
  APP_LISTEN_PORT=8080 \
  APP_API_BASE_URL="" \
  APP_ARTIFACT_URL=<release-artifact-url> \
  APP_ARTIFACT_SHA256=<release-artifact-sha256> \
  ./scripts/install-nginx-runtime.sh
```

Use `APP_LISTEN_ADDR=127.0.0.1` only when the app runtime and the edge gateway are on the same host.
When the edge is on another host, keep the listener on the private interface and use
mnscloud-agent/cyber security network policies so only the edge can connect to the app runtime port.
Firewall/nftables ownership stays with the agent/security layer, not this app installer.

Supported operating systems match the `mnscloud-nginx` edge module:

- Debian 12/13
- RHEL 9/10
- Rocky Linux 9/10
- AlmaLinux 9/10

The installer:

- uses `mnscloud-runtime-kit` for the base Nginx package;
- requires `APP_ARTIFACT_URL` or `APP_ARTIFACT_PATH`;
- requires `APP_ARTIFACT_SHA256` and validates the browser artifact before publishing;
- extracts the verified browser artifact into `/var/www/mnscloud-app`;
- writes runtime config to `/var/www/mnscloud-app/env.js`;
- creates `/etc/nginx/conf.d/mnscloud-app.conf`;
- removes the official Nginx `default.conf` unless `DISABLE_DEFAULT_NGINX_CONF=0`;
- validates and reloads Nginx.

When `APP_API_BASE_URL` is not provided, the installer writes an empty runtime value so the browser
uses same-origin `/api/v1`. It does not preserve a previous `/var/www/mnscloud-app/env.js` value,
because stale internal hostnames or private API URLs must not leak back into browser-facing runtime
configuration. If `APP_API_BASE_URL` is provided, it takes precedence.

When the final `apiBaseUrl` is empty, the app uses same-origin `/api/v1`. That is the preferred
setup when the edge gateway exposes both the app and `/api` on the public domain. If the app must
call a separate API origin, pass the full API v1 URL:

```bash
sudo APP_API_BASE_URL=https://api.example.com/api/v1 \
  APP_ARTIFACT_URL=<release-artifact-url> \
  APP_ARTIFACT_SHA256=<release-artifact-sha256> \
  ./scripts/install-nginx-runtime.sh
```

#### Update

Preferred manual update on App runtime hosts that already have
`scripts/update-latest-nginx-runtime.sh`:

```bash
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-latest-nginx-runtime.sh --api-base <api-base-url>
```

Inspect without applying:

```bash
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-latest-nginx-runtime.sh --api-base <api-base-url> --print-command
```

Example development API base:

```text
https://dev.publichost.cloud/api/v1
```

#### First Update On Older Hosts

Older App hosts may not have `scripts/update-latest-nginx-runtime.sh` yet. On those hosts, generate
the full command from a full MNSCloud workspace host and run the generated command on the App host:

```bash
cd /opt/mnscloud
scripts/runtime/update-command.sh mnscloud-app
```

The generated command includes the latest approved release tag, artifact URL, and SHA-256 digest.
After that first update, the App host will include `scripts/update-latest-nginx-runtime.sh`, and
future manual updates can use the shorter module-local helper from the Update section.

If both helpers are unavailable, use the same shape manually with values copied from the published
release registry.

Do not execute the placeholder command below literally. Replace every `<...>` value first:

```text
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-nginx-runtime.sh \
  --ref <release-tag> \
  --artifact-url <release-artifact-url> \
  --artifact-sha256 <release-artifact-sha256>
sudo ./scripts/validate-nginx-runtime.sh
```

Use this same update flow for development, staging, and production app hosts after a release tag has
been created and pushed. In normal MNSCloud operation the Agent receives the artifact URL and SHA
from the API, so operators do not type those values manually. The command checks out the requested
release, downloads the browser artifact, validates the SHA-256 digest, publishes it to
`/var/www/mnscloud-app`, refreshes `/var/www/mnscloud-app/env.js`, writes
`/var/www/mnscloud-app/build.json`, validates Nginx, and reloads the app runtime. If install or
validation fails, the script restores the previous commit and previous web root.

#### Validation

```text
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/validate-nginx-runtime.sh
curl -I http://127.0.0.1:8080
```

The `curl -I` response should show a fresh `Last-Modified` timestamp for the newly published
browser bundle. If the app host is behind the `mnscloud-nginx` edge, validate the public route from a
browser or with `curl` against the edge domain after the local validation passes.

Production App releases are published by the repository `Auto Release` GitHub
Actions workflow after validated changes are committed and pushed to `main`.
The workflow uses `scripts/release-app.sh` as the canonical release engine,
updates release metadata, creates the tag, and publishes the GitHub Release.
Run the script manually only as a break-glass maintainer operation.

#### Break-Glass Specific Release

Deploy a specific release manually only when the control plane/Agent flow is unavailable.
Do not execute this placeholder command literally. Replace every `<...>` value first:

```text
sudo ./scripts/update-nginx-runtime.sh \
  --ref <release-tag> \
  --artifact-url <release-artifact-url> \
  --artifact-sha256 <release-artifact-sha256>
```

#### Rollback

Rollback to a known-good release uses the same artifact contract:

```text
sudo ./scripts/rollback-nginx-runtime.sh \
  --ref <known-good-release-tag> \
  --artifact-url <known-good-release-artifact-url> \
  --artifact-sha256 <known-good-release-artifact-sha256>
```

Example edge proxy to the app runtime:

```nginx
location / {
  proxy_pass http://app-private-ip-or-dns:8080;
}
```

## Security Boundary

This repository is a public API client. Do not commit tokens, customer data, provider credentials,
database credentials, private infrastructure details, master keys, or server-side authorization
logic. The API remains the source of truth for authentication, tenant scope, permissions, billing,
routing ownership, and secret resolution.
