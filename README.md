# MNSCloud App

MNSCloud App is the public Angular browser client for the MNSCloud API. It is designed to run as an
independent repository so customers, partners, and contributors can work on the user interface while
the business core stays in the API/control plane.

## Requirements

- Node.js 24 or a compatible current Node.js runtime
- npm
- Access to an MNSCloud API endpoint

## API Configuration

The app reads runtime configuration from `public/env.js` before Angular starts:

```js
window.MNSCLOUD_APP_CONFIG = {
  apiBaseUrl: "https://api.example.com/api/v1",
};
```

If `apiBaseUrl` is empty, the app falls back to same-origin `/api/v1`. For a contributor working
from another country or network, only this API URL should need to change.

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

```bash
npm run build
```

## Docker

```bash
docker compose up --build
```

The standalone Compose file mounts the project into `/app` and keeps `node_modules` in a container
volume, so Angular hot reload works through the standard `npm run start` script. Configure the API
endpoint in `public/env.js`.

## Security Boundary

This repository is a public API client. Do not commit tokens, customer data, provider credentials,
database credentials, private infrastructure details, master keys, or server-side authorization
logic. The API remains the source of truth for authentication, tenant scope, permissions, billing,
routing ownership, and secret resolution.
