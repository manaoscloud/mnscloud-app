# AGENTS.md

This repository contains only the standalone MNSCloud Angular app.

## Commands

- Install: `npm install`
- Start: `npm run start`
- Build: `npm run build`
- CRUD validation: `npm run check:crud`
- Install bare-metal Nginx runtime: `sudo ./scripts/install-nginx-runtime.sh`

## Public Client Boundary

- This app consumes the MNSCloud API and may be public.
- Never commit secrets, customer data, private domains/IPs, provider credentials, database
  credentials, master keys, or private business rules.
- Configure the API through `public/env.js`:

```js
window.MNSCLOUD_APP_CONFIG = {
  apiBaseUrl: "https://api.example.com/api/v1",
};
```

## Frontend Pattern

- API calls go through `src/app/services/api.service.ts`.
- Runtime API URL resolution lives in `src/app/shared/runtime/app-runtime-config.ts`.
- CRUD page, dialog, table, upload, and filter behavior must follow `app.md`.
- Use Angular Material and existing shared helpers before introducing new UI patterns.
