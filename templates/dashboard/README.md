# Dashboard template

Start from page.ts/page.html and the dashboard contract in app.md. Adjust imports,
route scope, translations and authorized API summary endpoint. There is no page.scss:
reusable presentation belongs in src/styles/_dashboard.scss or an existing shared
component. A missing visual primitive is added there first so every consumer inherits
future improvements. Domain geometry may use data-driven CSS variables, never a new
page-local copy of the shell, grid, card, typography, colors or responsive behavior.

Use DashboardPageComponent and dashboardResource. The shell owns its only action,
Refresh, plus loading/error states. Do not add a metadata strip below the header;
snapshot timestamps stay internal to the read model. Do not project search, Apply/Clear,
mutation buttons or a competing toolbar. Links to authorized details are permitted;
management forms and selectable history belong on separate routes. Metrics fleet
exploration is not a summary dashboard and retains its existing display modes.

The adapter retains a successful snapshot on failure, clears it when user/environment
changes, and ignores stale results from earlier loads. Required reads reject; optional
panels must represent unavailable values explicitly, not successful zero counts.
Use bounded API calls and aggregate endpoints for actual totals. If existing endpoints
return a bounded inventory window, document that limitation in the module contract; do not claim a global total.

Run npm run check:dashboard, npm run build and the dashboard state tests. Validate
light/dark themes, PT/EN/ES, desktop/mobile, populated/empty/error/reload states and
master/tenant isolation. Development rollout precedes production approval.
