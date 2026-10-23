# Dashboards: components and recipe

Every dashboard in the App is built from the same pieces. A new module dashboard **reuses them as
they are**; it never copies markup or styles into the page, never adds a chart library and never
counts list pages in the browser. If something is missing, add it to the shared piece first (then
every dashboard inherits it). `npm run check:dashboard` enforces the rules marked ✔.

The rules live in `app.md` (Dashboard visual baseline); this page is the catalog and the
step-by-step recipe.

## 1. Component catalog

| Need | Use | Where | Notes |
| --- | --- | --- | --- |
| Page shell: title, description, Refresh, loading skeleton, error message, retained data | `<mns-dashboard-page>` (`DashboardPageComponent`) | `src/app/shared/dashboard/dashboard-page.ts` | ✔ exactly one per page; bind `[loading]`, `[error]`, `[hasData]`, `(refresh)`. Refresh is the only action (the App home alone adds Customize). |
| Data loading | `dashboardResource({ defaultValue, params?, loader })` | `src/app/shared/dashboard/dashboard-resource.ts` | ✔ required. Clears on user/tenant change, ignores stale results, keeps the last good snapshot on refresh failure. |
| KPI tiles | CSS: `dashboard-grid` › `dashboard-metric` (`-label`, `-value`, `-hint`), optional `state-good/warn/bad/neutral` | `src/styles/_dashboard.scss` | 4 → 2 → 1 columns. A missing value is `—`, never a fake `0`. |
| Panels | CSS: `dashboard-sections` (two columns) › `dashboard-panel` › `panel-header` (`h2` + `p`) | `src/styles/_dashboard.scss` | No nested decorative cards. |
| Record lists (servers, domains, issues…) with status chip and details | `<mns-dashboard-record-list>` (`DashboardRecordListComponent`, `DashboardRecord`) | `src/app/shared/dashboard/dashboard-record-list.ts` | `tone`: `success`/`danger`/`running`/`skipped`; details declare `format: 'datetime'`; only enum values `translate: true`. Optional sort/pagination inputs. |
| Inventory tables | `<mns-global-table>` + `defineGlobalTable` | `src/app/shared/crud/configurable-crud/global-table` | Read-only; row action = navigation only. Shared columns: `serverHealthColumn`, active/inactive helpers in `src/app/shared/dashboard/dashboard-table-columns.ts`. |
| Daily trend (30 days) | `<mns-trend-chart>` (`kind`: `bars`, `stacked`, `line`) | `src/app/shared/charts/trend-chart.ts`, styles `src/styles/_charts.scss` | ✔ the only chart. Render under `@defer (on viewport)` with `dashboard-chart-placeholder`. Series colors `--mns-chart-1/2`; ≥ 2 series show a legend. |
| Tabs inside a dashboard (sub-areas) | `mat-tab-nav-bar` links + `dashboard-tabs`, `dashboard-tab-badge`, `dashboard-tab-status` | `src/styles/_dashboard.scss` | Selected tab in the URL (`?module=` or equivalent). |
| Alerts / attention list | `dashboard-alert dashboard-alert-link` (`alert-error`/`alert-warning`) | `src/styles/_dashboard.scss` | Each item is an `<a>` to the resource. |
| Empty module (nothing created yet) | `empty-state dashboard-onboarding` + create link | `src/styles/_dashboard.scss` | Onboarding, not zero KPIs. |
| Messages (unavailable / partial) | `dashboard-message` (`role="status"`) | `src/styles/_dashboard.scss` | "Unavailable" is never shown as `0`. |
| Instance totals of VPS-like modules | `instanceDashboard`, `instanceStatusRecords`, `planInstanceCount`, `providerInstances`, `loadInstanceDashboard`, formatting helpers | `src/app/pages/hosting/shared/instance-dashboard.ts` | Example of module-family helpers: shared by VPS, VPS Container and the Hosting overview. Do the same for a new family instead of duplicating code. |
| Home personalization | `DashboardLayoutDialogComponent`, `applyDashboardLayout` | `src/app/shared/dashboard/dashboard-layout-dialog.ts` | App home only (✔). |
| Page scaffold | `templates/dashboard/page.ts` + `page.html` | `templates/dashboard/` | Start every new dashboard here; never copy another module's dashboard. |

Forbidden in a dashboard page (✔): page `.scss`/`styles`, `<button>`/form fields/Search/Apply/
New/Edit/Delete, `<app-refresh-button>` outside the shell, `mat-table`/`MatTableDataSource`,
`<svg>`/`<canvas>` or a chart library, a "last updated"/metadata strip.

## 2. Where the numbers come from

1. **Database aggregate.** One procedure per dashboard returns one JSON document with real totals
   over every row in scope (`Proc<Module>DashboardGet`): counts, active, issues, breakdowns and at
   most a few highlight rows. Same scope rule as the module's list procedure (tenant rows; platform
   master without tenant where the list allows it). Never a list page counted in the browser.
   See `mnscloud-db/docs/db-patterns.md`.
2. **API route.** `GET /<module>/dashboard` (tenant) and, when the module has a System view,
   `GET /system/<module>/dashboard`. The route requires exactly the permissions of the list it
   replaces (contract test `openapi/moduleDashboardContract_test.ts`). An aggregate that spans
   several modules (Hosting overview) is authenticated-only and gates each section with
   `canReadModuleRoute`, returning `null` for sections the caller may not read. See
   `mnscloud-api/docs/api-patterns.md` (Module dashboards).
3. **Trends.** A 30-day chart is a rollup metric in `DashboardMetricDaily`
   (`ProcDashboardMetricDailyRefresh` `WHEN` + permission in `ProcDashboardMetricSeriesGet`), read by
   the API already filled day by day. Chart only events that happen over time (calls, messages,
   jobs, sales); an inventory-only module (ISP) has no chart.

## 3. Recipe: dashboard for a new module

1. **DB:** `Proc<Module>DashboardGet` + `tests/<module>-dashboard.py` (scope, totals, isolation;
   remove fixtures at the end because the bootstrap DB is shared) registered in
   `tests/canonical-bootstrap.sh`.
2. **API:** add the module to `routes/moduleDashboardRoute.ts` (or its own route with the list's
   permissions) and to the contract test; document it in `docs/api-patterns.md`.
3. **App page:** copy `templates/dashboard/` into `src/app/pages/<module>/dashboard/`, keep
   `mns-dashboard-page` + `dashboardResource`, compose KPI tiles, panels, `mns-dashboard-record-list`
   / `mns-global-table` and, when there is a trend, `mns-trend-chart`. Map API codes to translation
   keys; add PT/EN/ES. One failed optional section shows "unavailable", the rest stays visible.
4. **App home (contracted modules):** one provider in `mnscloud-api`
   `services/dashboard/overviewProviders.ts` (tab, KPIs, attention codes, rows, optional `chart`)
   reusing the module aggregate, plus `home.*` translations. The home picks the module up by itself
   (tabs, attention, chart, personalization).
5. **Validate:** `npm run typecheck`, `npm run check:dashboard`, `npm run check:tables`,
   `npm run verify:changed -- origin/main HEAD`, specs; desktop/mobile, light/dark, PT/EN/ES,
   empty/populated/error/reload, tenant/master.

## 4. Current dashboards and their data

| Dashboard | Data |
| --- | --- |
| App home | `GET {,/system/}dashboard/overview` (+ `user/dashboard-layouts/home.<scope>`) |
| Softswitch | `GET voip/softswitch/dashboard` + server list |
| SBC | `GET {,system/}voip/sbc/dashboard` |
| VPS / VPS Container | `GET {,system/}hosting/vps{,-container}/dashboard` + provider/plan catalogs |
| Hosting overview | `GET {,system/}hosting/dashboard` + VPS/container dashboards |
| Monitoring | `GET monitoring/agents/summary`, runtime products, activity logs |
| InfraGIS | `GET infragis/dashboard` + `GET infragis/map/assets` (preview framed to the loaded assets) |
| PABX, VoIP, DNS, Webhost, SMTP, Storage, Cyber Security, AI, Billing, Realtime, Secrets | their module `.../dashboard` or summary endpoints |
