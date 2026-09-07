# Installation

This document covers the production bare-metal app runtime. Runtime hosts serve
the already built Angular browser artifact through Nginx; they do not install
Node.js, npm, or Angular CLI.

## Supported Operating Systems

- Debian 12/13
- RHEL 9/10
- Rocky Linux 9/10
- AlmaLinux 9/10

## Download Repository

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

## Prepare Environment

The latest-release helper reads `/etc/mnscloud/app.env` when it exists. The file
is optional when the default release registry and same-origin API behavior are
correct for the host.

Use it only for runtime settings that differ from the defaults:

```bash
sudo install -d -m 0750 /etc/mnscloud
sudo editor /etc/mnscloud/app.env
sudo chmod 0600 /etc/mnscloud/app.env
```

Common values:

```env
MNSCLOUD_RELEASE_API_BASE_URL=https://api.example.com/api/v1
APP_LISTEN_ADDR=0.0.0.0
APP_LISTEN_PORT=8080
APP_API_BASE_URL=
```

Keep `APP_API_BASE_URL` empty when the public edge serves the app and proxies
`/api/v1` on the same origin. Do not place private hostnames, internal IPs, or
secret values in browser-facing runtime configuration.

## Install

Fresh app runtime hosts install from the latest approved release artifact:

```bash
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-latest-nginx-runtime.sh --env /etc/mnscloud/app.env
sudo ./scripts/validate-nginx-runtime.sh
```

The helper resolves the release from the MNSCloud runtime registry, downloads
the published browser artifact, validates the SHA-256 digest, writes
`/var/www/mnscloud-app`, renders `/etc/nginx/conf.d/mnscloud-app.conf`, reloads
Nginx, and validates the local app health endpoint.

## Update

Use the same latest-release helper on existing runtime hosts:

```bash
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-latest-nginx-runtime.sh --env /etc/mnscloud/app.env
sudo ./scripts/validate-nginx-runtime.sh
```

Inspect the resolved command without applying it:

```bash
sudo ./scripts/update-latest-nginx-runtime.sh --env /etc/mnscloud/app.env --print-command
```

## Break-Glass Specific Release

Use a specific release only when the control plane or Agent update flow is not
available. Do not execute placeholders literally:

```text
sudo ./scripts/update-nginx-runtime.sh \
  --ref <release-tag> \
  --artifact-url <release-artifact-url> \
  --artifact-sha256 <release-artifact-sha256>
sudo ./scripts/validate-nginx-runtime.sh
```

## Rollback

Rollback uses the same immutable artifact contract:

```text
sudo ./scripts/rollback-nginx-runtime.sh \
  --ref <known-good-release-tag> \
  --artifact-url <known-good-release-artifact-url> \
  --artifact-sha256 <known-good-release-artifact-sha256>
sudo ./scripts/validate-nginx-runtime.sh
```

## Security Notes

- The app is a browser client only; authorization and tenant decisions stay in
  the API/control plane.
- Runtime hosts should be reachable only from the edge gateway or approved
  operators.
- Public runtime config may contain public API origins only. Never expose tokens,
  customer data, private topology, or internal service addresses through
  `/env.js`.
