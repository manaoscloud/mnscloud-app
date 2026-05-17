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
