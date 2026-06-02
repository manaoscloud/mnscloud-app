# MNSCloud App

MNSCloud App is the public Angular browser client for the MNSCloud API. It is designed to run as an
independent repository so customers, partners, and contributors can work on the user interface while
the business core stays in the API/control plane.

## Requirements

- Node.js 24 or a compatible current Node.js runtime
- npm
- Access to an MNSCloud API endpoint

The bare-metal Nginx runtime installer uses `mnscloud-runtime-kit` to install Node.js 24
automatically when a suitable `node` and `npm` are not already available.

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

Do not commit tenant, partner, staging, or production API URLs into `public/env.js`. Use one of
these environment-specific mechanisms instead:

- Local development: copy `public/env.example.js` to `public/env.js` and edit only the local file.
- Bare-metal installer: either edit local `public/env.js` before running
  `scripts/install-nginx-runtime.sh`, or pass `APP_API_BASE_URL` explicitly.
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

```bash
sudo ./scripts/install-nginx-runtime.sh
```

Useful options:

```bash
sudo APP_LISTEN_ADDR=0.0.0.0 \
  APP_LISTEN_PORT=8080 \
  APP_API_BASE_URL="" \
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

- uses `mnscloud-runtime-kit` for the base Nginx package and Node.js installation;
- runs `npm ci` and `npm run build`;
- copies `dist/app/browser` into `/var/www/mnscloud-app`;
- writes runtime config to `/var/www/mnscloud-app/env.js`;
- creates `/etc/nginx/conf.d/mnscloud-app.conf`;
- removes the official Nginx `default.conf` unless `DISABLE_DEFAULT_NGINX_CONF=0`;
- validates and reloads Nginx.

When `APP_API_BASE_URL` is not provided, the installer reads `public/env.js` and publishes that
value to `/var/www/mnscloud-app/env.js`. If `APP_API_BASE_URL` is provided, it takes precedence,
including an explicit empty value.

When the final `apiBaseUrl` is empty, the app uses same-origin `/api/v1`. That is the preferred
setup when the edge gateway exposes both the app and `/api` on the public domain. If the app must
call a separate API origin, pass the full API v1 URL:

```bash
sudo APP_API_BASE_URL=https://api.example.com/api/v1 ./scripts/install-nginx-runtime.sh
```

Update and validate the runtime later:

```bash
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-nginx-runtime.sh --ref v0.1.0
sudo ./scripts/validate-nginx-runtime.sh
```

Use this same update flow for development, staging, and production app hosts after a release tag has
been created and pushed. The command checks out the requested release, installs dependencies, builds
the Angular browser bundle, publishes it to `/var/www/mnscloud-app`, refreshes
`/var/www/mnscloud-app/env.js`, writes `/var/www/mnscloud-app/build.json`, validates Nginx, and
reloads the app runtime. If install or validation fails, the script restores the previous commit.

Recommended operator flow after a repository commit:

```bash
cd /opt/mnscloud/mnscloud-app
git status --short
sudo ./scripts/update-nginx-runtime.sh --ref v0.1.0
sudo ./scripts/validate-nginx-runtime.sh
curl -I http://127.0.0.1:8080
```

The `curl -I` response should show a fresh `Last-Modified` timestamp for the newly published
browser bundle. If the app host is behind the `mnscloud-nginx` edge, validate the public route from a
browser or with `curl` against the edge domain after the local validation passes.

Create release metadata from a clean maintainer workstation:

```bash
./scripts/release-app.sh --version 0.1.1 --channel stable --publish
```

Deploy a specific release:

```bash
sudo ./scripts/update-nginx-runtime.sh --ref v0.1.1
```

Rollback to a known-good tag or commit:

```bash
sudo ./scripts/rollback-nginx-runtime.sh --ref v0.1.0
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
