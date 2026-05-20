# MNSCloud App

MNSCloud App is the public Angular browser client for the MNSCloud API. It is designed to run as an
independent repository so customers, partners, and contributors can work on the user interface while
the business core stays in the API/control plane.

## Requirements

- Node.js 24 or a compatible current Node.js runtime
- npm
- Access to an MNSCloud API endpoint

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
the built app from `/var/www/mnscloud-app` and listens on `127.0.0.1:8080`, so the external
`mnscloud-nginx` edge can proxy to it without sharing the app files.

```bash
sudo ./scripts/install-nginx-runtime.sh
```

Useful options:

```bash
sudo APP_LISTEN_ADDR=127.0.0.1 \
  APP_LISTEN_PORT=8080 \
  APP_API_BASE_URL="" \
  ./scripts/install-nginx-runtime.sh
```

Supported operating systems match the `mnscloud-nginx` edge module:

- Debian 12/13
- RHEL 8/9
- Rocky Linux 8/9
- AlmaLinux 8/9

The installer:

- installs Nginx with `apt` or `dnf`;
- runs `npm ci` and `npm run build`;
- copies `dist/app/browser` into `/var/www/mnscloud-app`;
- writes runtime config to `/var/www/mnscloud-app/env.js`;
- creates `/etc/nginx/conf.d/mnscloud-app.conf`;
- validates and reloads Nginx.

When `APP_API_BASE_URL` is empty, the app uses same-origin `/api/v1`. That is the preferred setup
when the edge gateway exposes both the app and `/api` on the public domain. If the app must call a
separate API origin, pass the full API v1 URL:

```bash
sudo APP_API_BASE_URL=https://api.example.com/api/v1 ./scripts/install-nginx-runtime.sh
```

Example edge proxy to the app runtime:

```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
}
```

## Security Boundary

This repository is a public API client. Do not commit tokens, customer data, provider credentials,
database credentials, private infrastructure details, master keys, or server-side authorization
logic. The API remains the source of truth for authentication, tenant scope, permissions, billing,
routing ownership, and secret resolution.
