# AGENTS.md

This repository contains only the standalone MNSCloud Angular app.

## Commands

- Install: `npm install`
- Start: `npm run start`
- Build: `npm run build`
- CRUD validation: `npm run check:crud`
- FK quick-create validation: `npm run check:crud:fk -- <page-folder>` (or `-- --all`)
- Install/update bare-metal Nginx runtime: `sudo ./scripts/update-latest-nginx-runtime.sh`

## Public Client Boundary

- This app consumes the MNSCloud API and may be public.
- Never commit secrets, customer data, private domains/IPs, provider credentials, database
  credentials, master keys, or private business rules.
- Configure the API through `public/env.js`:

```js
window.MNSCLOUD_APP_CONFIG = {
  apiBaseUrl: 'https://api.example.com/api/v1',
};
```

## Frontend Pattern

- API calls go through `src/app/services/api.service.ts`.
- Runtime API URL resolution lives in `src/app/shared/runtime/app-runtime-config.ts`.
- CRUD page, dialog, table, upload, and filter behavior must follow `app.md`.
- Pick the page template from `app.md` → `Page Template Catalog (Current)`. Every CRUD/list page
  extends `ConfigurableCrudPageBase`; matching CSS hook classes alone is not compliance.
  `npm run check:crud:inventory` enforces this app-wide against `scripts/crud-legacy-allowlist.json`,
  which may only shrink.
- Use Angular Material and existing shared helpers before introducing new UI patterns.

## Shared visual identity

Every screen inherits the project identity from shared components and styles. If a reusable
style is missing, create it in the shared layer first; future improvements must propagate to
all consumers. Do not duplicate the shared shell, cards, spacing, typography, colors or
responsive rules inside a page. Summary dashboards use templates/dashboard and the app.md
refresh-only contract. Run npm run check:dashboard; CRUD filter rules do not apply to them.

## Detail and settings pages

Use DetailPageComponent for read-only resource pages and SettingsPageComponent for
singleton configuration pages. Both inherit PageShellComponent. Follow app.md and
templates/detail-page or templates/settings-page; shared styles belong in
src/styles/_content-page.scss. Never style a routed configuration page as a dialog.
Run node scripts/validate-content-pages.mjs and the build; verify both responsive
layouts and settings dirty/cancel/save behavior before release.

## Canonical CRUD creation

For every CRUD/list resource, use `scripts/create-crud.mjs` and extend
`ConfigurableCrudPageBase`; reuse its shared HTML/SCSS. Do not copy older pages or
create local CRUD shells. The template is configuration-only. Enhance shared capabilities
when needed. Explicit CRUD validation must fail on legacy or unrecognized targets.
Run template, layout and i18n checks, the build and desktop/mobile PT/EN/ES validation.
