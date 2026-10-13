# AGENTS.md

This repository contains only the standalone MNSCloud Angular app.

## Commands

- Install: `npm install`
- Start: `npm run start`
- Build: `npm run build` (guarded: one build per host at a time, 14G memory cap; see below)
- Type check (fast local gate): `npm run typecheck`
- CRUD validation: `npm run check:crud`
- Menu label validation: `npm run check:nav`
- FK quick-create validation: `npm run check:crud:fk -- <page-folder>` (or `-- --all`)
- Install/update bare-metal Nginx runtime: `sudo ./scripts/update-latest-nginx-runtime.sh`

## Shared Host Builds

- A production build uses ~11.5 GB of RAM. Several AI agents building at once froze the shared
  developer host, so `npm run build` runs `scripts/guarded-build.sh`: a machine-wide queue (lock
  `/var/lock/mnscloud-app-build.lock`, shared by every worktree), a per-build memory cap in its own
  systemd scope (`MNSCLOUD_BUILD_MEMORY_MAX`, default `14G`, no swap) and lower CPU priority.
- A waiting build prints `[build-guard] another mnscloud-app build is running (...)`; this is normal,
  keep it waiting. Exit `75` means the slot did not free up in time; exit `137` with
  `exceeded MNSCLOUD_BUILD_MEMORY_MAX` means the build hit the cap.
- Never bypass the guard on a shared host (`MNSCLOUD_BUILD_GUARD=0`) and never call
  `ng build` / `node .../ng.js build` directly. CI (`CI` set) and Docker builds skip the guard.
- Routine local gate: Prettier, the `check:*` validators, `npm run verify:changed -- origin/main HEAD`
  and `npm run typecheck`. The PR CI always runs the production build. Run `npm run build` locally
  only when the change touches `angular.json`, budgets, build/release scripts, dependencies, or
  a CI build failure must be reproduced.

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
- Every dialog header ends with `<mns-report-problem-button />` (`app.md` → Dialog Report Problem
  Baseline, enforced by `npm run check:dialog-report`); mark visible secrets with `data-report-mask`.
- Pick the page template from `app.md` → `Page Template Catalog (Current)`. Every CRUD/list page
  extends `ConfigurableCrudPageBase`; matching CSS hook classes alone is not compliance.
  `npm run check:crud:inventory` enforces this app-wide (no allowlist).
- Use Angular Material and existing shared helpers before introducing new UI patterns.

## Sidebar navigation labels

The menu tree lives in `src/app/layout/navigation/nav-registry.ts` (data only) and every label
follows `app.md` → `Navigation Label Contract`: `nav.<id>` keys in en-US/pt-BR/es-ES, no word
repeated from any ancestor (`Suporte › Chamados › Origens`), per-level length budget, sentence
case, glossary terms and at least two children per group. `npm run check:nav` enforces it in CI;
there is no allowlist. Validate PT/EN/ES at desktop (expanded and compact) and mobile widths.

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

## Master-aware fields

Follow `app.md` → Explicit master fields and FK scope. Use explicit route scope and
canonical quick-create forms, keep child FKs in that scope, and use remote searchable
lookups. Never infer master authority from a missing environment or add fake customers.
