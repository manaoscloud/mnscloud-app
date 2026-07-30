# Deployment Automation

The App deployment workflow receives the API deployment event and deploys the browser client after the API is available.

## Triggers

- `repository_dispatch` with event type `api-deployed`.
- Manual `workflow_dispatch`.

The API repository dispatches this payload after API validation/deployment:

```json
{
  "environment": "dev",
  "api_repo": "manaoscloud/mnscloud-api",
  "api_sha": "commit-sha",
  "db_sha": "database-commit-sha",
  "migration": "sql/migrations/example.sql",
  "app_ref": ""
}
```

## Deployment Order

1. Install dependencies with `npm ci`.
2. Generate `public/env.js` from environment variables.
3. Build the Angular app.
4. Package `dist/app/browser` as the release browser artifact.
5. Upload the browser artifact to the GitHub Release.
6. Synchronize artifact URL, SHA-256, size, and content type to the MNSCloud runtime release cache.
7. Request deployment through the MNSCloud control plane.

The release-cache publication is retried with bounded connection and total timeouts. A separate hourly
`Reconcile Runtime Release Cache` workflow compares the latest published GitHub Release with the catalog and
republishes only when it is missing or stale. It may also be dispatched manually with a published tag; it never
rebuilds the App or creates a new release.

App runtime hosts do not install Node.js and do not run Angular builds. The Agent downloads the
published browser artifact, validates its SHA-256 digest, publishes it to Nginx, and reports the
installed runtime version back to the API.

## GitHub Environments

Create the same Environments used by DB/API:

- `dev`
- `staging`
- `production`

Production should require reviewer approval before the workflow can request deployment.

## Variables

```text
MNSCLOUD_DEPLOY_ENABLED=true
MNSCLOUD_DEPLOY_API_URL=https://api.example.com/api/v1/internal/deployments/github
MNSCLOUD_API_BASE_URL=
```

`MNSCLOUD_API_BASE_URL` may stay empty when the app and API share the same public origin and the edge gateway proxies `/api/v1`.

When `MNSCLOUD_DEPLOY_ENABLED` is not `true`, the workflow validates/builds and uploads the artifact,
but it does not modify servers.

## Secrets

```text
MNSCLOUD_DEPLOY_TOKEN=<short-lived-or-rotated-control-plane-token>
```

## Control Plane Payload

```json
{
  "sourceRepo": "manaoscloud/mnscloud-app",
  "sourceSha": "commit-sha",
  "actor": "github-user",
  "environment": "dev",
  "service": "app",
  "dbSha": "database-commit-sha",
  "apiSha": "api-commit-sha",
  "migration": "sql/migrations/example.sql"
}
```

The API/control plane should turn this into an audited agent job, run the update on the app server, validate HTTP health checks, and publish global Activity Logs.
