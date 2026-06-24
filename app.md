# APP Patterns

## Routing

- Routes are defined in `src/app/app.routes.ts`.
- ERP routes use `/erp/*` paths.

## Public API Client Boundary

- The Angular app is a public API client. By default it consumes same-origin `/api/v1`, and in
  standalone/public deployments it may point to any authorized MNSCloud API through
  `window.MNSCLOUD_APP_CONFIG.apiBaseUrl` loaded from `/env.js`.
- When the app is published behind `mnscloud-nginx`, the effective browser-facing `/env.js` may be
  served by the edge gateway from `/etc/nginx/mnscloud/runtime/env.js`, not by the app node. The
  canonical value for multi-tenant edge deployments is an explicit empty string (`apiBaseUrl: ""`)
  so every tenant/domain calls its own same-origin `/api/v1` path.
- The app must not contain server-side secrets, provider credentials, database credentials, master
  keys, private business rules, or hidden API bypasses.
- Browser-side authorization is UX only. The API remains the source of truth for roles, tenant scope,
  environment scope, billing, routing ownership, policy decisions, and secret resolution.
- Business rules must not live in the Angular app. The app may format values, validate obvious form
  shape before submit, show/hide actions for UX, and render API-provided URLs/data safely; it must
  not decide whether a user/tenant can access a resource, whether credit is sufficient, which
  provider/storage/bucket/path is used, how signed URLs are generated, which release can be
  installed, or when a workflow state is valid. Those decisions belong to DB/API contracts.
- When the API returns an authorized artifact such as a short-lived signed URL, the app must consume
  it as-is. Do not mutate signed URLs, storage object keys, tenant-scoped paths, or authorization
  material in frontend code; ask the API for a new authorized value instead.
- Tokens stored by the app are user/session tokens obtained after login. Do not add permanent service
  credentials, storage credentials, signing secrets, or master tokens to frontend code, assets, docs,
  examples, or build-time environment files.
- Public examples must use placeholders and must not include customer data, production domains,
  production IPs, provider account IDs, or private infrastructure topology.
- Full contract: `docs/public-api-clients.md`.

## Layout

- Main shell and menu are in:
  - `src/app/layout/main-layout/main-layout.ts`
  - `src/app/layout/main-layout/main-layout.html`
- Menu labels must distinguish conceptual modules from resources:
  - Product/module groups may use canonical product names, acronyms, or concepts such as `VoIP`,
    `PABX`, `DID`, `SBC`, `SMTP`, `Realtime`, `WebRTC`, and `TURN/STUN`.
  - Entries that open CRUD/list collection resources must use plural labels such as `Servers`,
    `Domains`, `Providers`, `Routes`, `Policies`, `Extensions`, `Queues`, and `Inbound Routes`.
  - Parent groups that only organize collection resources may be plural when they represent the
    same collection family, for example `Blacklists` or `Dial Plans`.
  - Every visible menu label must exist in all runtime Transloco dictionaries
    (`public/i18n/en-US.json`, `public/i18n/pt-BR.json`, and `public/i18n/es-ES.json`). Do not rely
    on untranslated label fallbacks in the menu.

## Angular Runtime Baseline

- The app targets Angular 22+ and must use the modern Angular template/runtime model for all new
  components and refactors.
- Templates must use block control flow: `@if`, `@for`, `@switch`, `@empty`, and `@defer` where
  appropriate. Do not introduce legacy structural directives such as `*ngIf`, `*ngFor`, or
  `*ngSwitch`.
- Components, directives, pipes, and services must use `inject()` for dependency injection. Do not
  add constructor-based dependency injection in new code.
- Standalone components must use the Angular default change detection strategy. Do not add
  explicit `ChangeDetectionStrategy.OnPush`, custom eager strategies, or component-local
  change-detection overrides in new components/refactors.
- Component/directive inputs must use signal inputs (`input()`) when they are externally bound
  values. If an Angular or Material interface requires a plain property, keep the external input as
  an aliased signal input and expose a compatible getter/property for the interface.
- Template/content queries must use signal query APIs (`viewChild`, `viewChildren`,
  `contentChild`, `contentChildren`). Do not introduce decorator query APIs such as `@ViewChild` or
  `@ViewChildren`.
- Use `signal`, `computed`, `linkedSignal`, and small explicit effects for UI state. Keep API/DB
  business decisions out of signals; signals only model presentation state and user interaction.
- Do not inject `ChangeDetectorRef` or call `detectChanges()` in application components. Convert
  local state to signals/resources or adapt third-party callbacks at their boundary instead of
  forcing change detection from inside page code. Unit-test fixtures may still call
  `fixture.detectChanges()`.
- Use Angular `resource()` for dashboard/read-model data that is loaded from one or more GET
  endpoints and refreshed as a unit. Keep the loader typed, return a single immutable snapshot, and
  derive UI state with `computed()` instead of maintaining parallel `loading/error/items` signals.
- `resource()` declarations must provide a stable `defaultValue` snapshot so templates do not need
  nullable fallbacks for first render. Use `params` for values that should trigger a reload, and keep
  Apply/Clear filters backed by an explicit applied-filter signal when typing/selecting should not
  reload immediately.
- `resource()` loaders may combine multiple API calls when the screen needs a consistent dashboard
  snapshot. Required panels should reject the loader on failure; optional counters/panels may use
  settled fallbacks inside the snapshot so one secondary metric does not blank the full dashboard.
- Use `resource.reload()` for explicit refresh actions. Do not duplicate resource state into manual
  mutable signals. CRUD/read-list pages must derive visible rows with `computed()` and pass the
  computed array directly to Angular Material tables. If a third-party integration truly requires a
  mutable adapter, document the exception in the component notes and keep the adapter synchronized
  at that boundary only.
- Do not scatter long-lived `.subscribe()` calls inside pages/components. Router events, route data,
  and read models must be adapted with `toSignal()`, `resource()`, and `effect()`. Keep direct
  subscriptions only in shared boundary helpers that intentionally adapt callback/event APIs. Pages
  must not create local `.subscribe()` calls for uploads; use the shared upload execution helper so
  cancellation remains centralized and testable.
- Keep mutations (`POST`, `PUT`, `DELETE`, uploads, queue actions, provisioning actions) explicit
  through service methods. Do not hide business workflow side effects inside `resource()` loaders.
- `httpResource` can be introduced for simple same-service GET resources after the endpoint typing is
  stable. Continue using `ApiService` where request headers, tenant context, auth behavior, upload
  progress, or custom error handling are required.
- Signal Forms are the default for new forms and refactors. Use shared adapters from
  `src/app/shared/forms/` before writing raw `mat-form-field` controls in CRUD dialogs. Current
  baseline adapters include `mns-text-field`, `mns-textarea-field`, `mns-select-field`,
  `mns-search-select-field`, and `mns-status-select-field`; add new adapters there for repeated
  controls such as currency, date/time, upload, phone, and JSON fields. Existing Material-heavy
  CRUDs that depend on custom control-value accessors may be migrated incrementally, but new CRUD
  code must not introduce component-local form wiring when a shared adapter exists. Do not perform a
  cosmetic migration that wraps the old form API without reducing state, validation, or template
  complexity.
- Prefer direct standalone imports (`DatePipe`, `JsonPipe`, `NgClass`, specific Material modules,
  etc.) instead of broad `CommonModule` when the component can declare the exact template
  dependency. Run the Angular unused-import cleanup after migration/refactor work.
- Use `@defer` for heavy dashboard panels, maps, charts, large optional panels, and secondary
  sections that do not need to block the first paint. Do not defer critical auth, route guards,
  tenant/environment selection, or first-screen error states.
- Route-level lazy loading remains mandatory through `loadComponent`.
- Use self-closing component tags where the element has no projected content.
- Keep `provideHttpClient(withXhr(), ...)` while upload progress depends on
  `HttpEventType.UploadProgress` / `reportProgress`. Do not switch the global client to Fetch until
  upload progress flows have a tested replacement.
- Transloco is the only runtime i18n layer. Do not add component-local translation maps, custom
  translation pipes, DOM translation fallbacks, or Angular built-in i18n for runtime CRUD labels.
- Date/time display must use the shared `DateTimeFormatService`, which resolves the effective
  `DEFAULT_TIMEZONE` from tenant/master Parameters and formats with the active app language. Do not
  show raw ISO timestamps or rely on Angular `DatePipe` defaults for user-facing table/detail
  fields. Inputs that submit date-only or date-time payloads may keep explicit API serialization
  helpers, but visible output must follow the configured timezone.
- Before finishing any Angular migration/refactor, run a residue check for:
  `*ngIf`, `*ngFor`, `*ngSwitch`, `@Input(`, `@Output(`, `@ViewChild`, `@ViewChildren`,
  `ChangeDetectionStrategy.Eager`, constructor dependency injection, `ngx-translate`,
  `TranslateService`, `TranslateModule`, and `RouterTestingModule`.
- New module/page scaffolding must start from the Angular 22 CRUD template in `templates/crud`.
  Do not copy older pages as a baseline. The template validator intentionally fails decorator
  queries, manual lifecycle teardown, old animation packages/triggers, constructor DI, the legacy
  `| t` pipe alias, and old `Data`/`Details` CRUD tab labels so new modules do not inherit Angular
  21-era patterns.

## Commercial Menu Projection

- The app may hide tenant-facing commercial modules based on API-provided billing grants, but this is
  UX only. DB/API remains the authorization and billing enforcement boundary.
- New commercial menu groups or entries must set an `entitlementCode` that matches the backend
  entitlement contract, for example `module.isp.*`, `module.voip.pabx.account`, or
  `module.hosting.vps.instance`.
- The app must obtain grants from `/api/v1/billing/entitlements/grants`; do not hardcode tenant
  commercial access, product prices, subscription state, or free module exceptions in frontend code.
- Master billing screens must obtain official product-code suggestions from
  `/api/v1/system/billing/product-definitions`. A product-code field may allow free typing to create
  a missing canonical definition, but the suggestion list must come from DB/API seeded
  `BillingProductDefinition` rows and never from page-local hardcoded arrays.
- If a feature is intentionally free/base, it must still come from an explicit API/DB grant backed
  by a zero-value product/price/subscription. Do not show commercial menus because a product/policy
  is missing.
- Adding a visible commercial route in `app.routes.ts` or `main-layout` is incomplete until the
  related API route, `BillingEntitlementPolicy`, product definition, price, OpenAPI contract, and
  backend entitlement assert behavior are present.

## Public Theme Runtime

- The app loads tenant branding at bootstrap through `PublicThemeContextService`.
- Runtime endpoint: `GET <apiBaseUrl>/public/theme/context`.
- API base resolution is centralized in `src/app/shared/runtime/app-runtime-config.ts`.
  - Empty or missing `/env.js` config falls back to same-origin `/api/v1`.
  - `apiBaseUrl` may be configured as an origin (`https://api.example.com`), `/api`, or `/api/v1`;
    the resolver normalizes it to the v1 API base.
  - Public standalone builds must use placeholders in `public/env.example.js` and never commit
    customer domains, private API URLs, tokens, or secrets.
- The API resolves the domain from the actual request host; the frontend must not hardcode tenant/domain mappings.
- The service applies public branding before normal authenticated flows:
  - `PageTitle` updates `document.title`.
  - `MetaDescription` updates the page meta description.
  - `FaviconUrl` updates the favicon link.
  - `PrimaryColor` is exposed as the CSS variable `--tenant-primary-color`.
- Optional future fields belong in `BrandingConfig` or explicit nullable ThemeDomain columns; do not move runtime branding into `.env`.
- Do not reintroduce legacy `UrlName`/`Title` frontend model fields; use `Domain` and `PageTitle`.

## ERP CRUD Baseline (Current)

- Baseline page structure:
  - `.erp-page` -> `.erp-card` -> `.erp-header` -> `.filter-grid` -> `.table-wrapper` -> `.mobile-paginator`
- End-to-end frontend refactor completeness:
  - A full page/module refactor is not complete with layout and build only.
  - Update the app translation layer for every new or changed visible literal in the same change:
    menu labels, page headings, helper text, dialog titles, tab labels, field labels, placeholders,
    tooltips, aria-labels, empty states, confirmation text, snackbar fallback messages, and action
    labels.
  - Manual translations belong in `public/i18n/<language>.json`. Transloco is the only runtime
    i18n layer; do not add component-local translation maps, generated auto dictionaries, custom
    translation pipes, or DOM translation fallbacks.
  - If the refactor establishes or changes a reusable frontend behavior, document that behavior in
    this `app.md` baseline instead of creating product-specific docs for a single module.
  - Product/module docs are only for product semantics, operational contracts, or cross-repository
    architecture that cannot be expressed as a reusable app pattern.
  - Final validation must report translation/doc coverage explicitly alongside build results and
    visual/CRUD baseline compliance.
- List actions:
  - `Refresh` should call `refreshList()`.
  - `New` should open the create flow.
  - Header refresh actions must use `RefreshButtonComponent` (`<app-refresh-button />`) instead
    of hand-written refresh buttons. Bind the component to the page loading state so the button is
    disabled and shows its inline spinner while the refresh request is in progress.
  - `New` uses `mat-stroked-button color="primary"` with an icon.
  - Short header action buttons share the global fixed width from `--crud-action-button-width` so actions in the same group feel visually equal on desktop and mobile.
- Filter behavior:
  - Filter fields use the global 4-column `.filter-grid`; every filter input/select must declare
    `class="span-1"` unless the user explicitly requests a larger filter field. Do not leave normal
    filter width implicit, and do not use custom fractional widths such as `1.5`.
  - Do not make `Search`, `Status`, or normal filter controls `span-2`, `span-3`, or `span-4`
    unless that larger width was explicitly requested for that exact field.
  - Every CRUD list must include a `Search` filter as the first filter control.
  - If the resource has a status field/table status column, include a `Status` filter in the
    filter row. Use `''` for the `All` UI value and normalize only before API calls when needed.
  - Use explicit `Apply` and `Clear` actions.
  - Button order is mandatory: `Apply` first, `Clear` second.
  - Filter action icons are mandatory: `Apply` uses `<mat-icon>filter_alt</mat-icon>` and `Clear` uses `<mat-icon>backspace</mat-icon>`.
  - Placement is mandatory: `filter-actions` must be on its own row (`grid-column: 1 / -1`) right-aligned, never inline at the side of the search input.
  - Keep `filter-actions` right-aligned, including mobile.
  - Short filter action buttons (`Apply`, `Clear`) share the global fixed width from `--crud-action-button-width`; longer contextual actions such as `Delete selected` may grow beyond that width.
  - On mobile (`<=900px`), keep header actions (`Refresh` / `New`) right-aligned as well (`.header-actions { justify-content: flex-end; }` inside mobile media block).
- List data completeness:
  - When the API/list procedure supports `search`, `Apply` must reload from the API with the search parameter instead of filtering only the currently loaded table rows.
  - When the backend procedure has a default limit, the frontend service must pass an explicit `limit` appropriate for the workflow or implement real server-side pagination.
  - Client-side filtering over the currently loaded rows must not be the only search mechanism for
    resources where the loaded rows can be an incomplete backend window.
  - Reference bug: `VoipDid` initially loaded the procedure default of 50 rows, so valid DIDs outside that window could not be found in the app even though they existed in the database.
- Loading behavior:
  - Route/component transitions are owned by the global `RouteLoader` plus
    `NavigationLoadingService`; pages must not create their own route-change loaders.
  - Navigation feedback uses a top progress bar immediately and a delayed centered overlay only
    when the route/lazy chunk is slow enough to need explicit feedback.
  - The top progress bar must keep a short minimum visible duration so fast networks still provide
    perceptible navigation feedback without blocking the page.
  - Router terminal events must clear every navigation-loading signal, and the global service must
    keep a short watchdog so a missed lazy-load event never leaves the page blocked.
  - Layout menus may read `NavigationLoadingService.isNavigating` to prevent repeated clicks while
    the router is already processing a navigation.
  - Use list loading state + overlay (`.table-loading`) on table wrapper.
  - Keep minimum visible loading duration around `600ms`.
  - Header-level refresh actions must show local progress inside the refresh button. Do not rely
    only on the table overlay or a silent network request after the user clicks refresh.
  - Dashboard/read-model refresh buttons should use the same inline loading state and should not
    block the whole page unless the screen has no meaningful previous snapshot to keep visible.
- CRUD feedback:
  - Operational feedback (`success`, `error`, `warning`, `info`) must use `SnackbarService` / app snackbar.
  - Do not render transient CRUD success/error/warning/info messages inline in pages, tables, dialogs, or form footers.
  - Inline state blocks are reserved for persistent empty/error states that require page-level action, not save/delete/load notifications.
- Table behavior:
  - Standard list pages use signal-first tables:
    `<table mat-table [dataSource]="visibleRows()" matSort ...>`.
  - Read/list data comes from `resource()`; table state such as sorted rows, visible page rows,
    selected visible rows, and derived labels must be modeled with `computed()`.
  - Do not introduce `MatTableDataSource` in new CRUD templates/refactors. It is treated as a
    legacy adapter unless a specific third-party integration requires it and that exception is
    documented.
  - Every data column must be sortable with `mat-sort-header`.
  - `select` and `actions` columns must not be sortable.
  - The primary identity column of every CRUD list must render the human-readable main value on
    the first line and the record UUID directly below it on the second line. Use the shared
    `.record-main` and `.record-uuid` classes. The UUID line is mandatory for auditability,
    support, and fast troubleshooting; do not move it to a tooltip or hide it behind an action.
    When another column represents a related record/FK, its secondary `.record-uuid` line must show
    that related entity UUID instead of repeating the current row UUID. For example, a `Server`
    column shows the server UUID, and a `Realtime Domain` column shows the realtime domain UUID.
    If the API/model field is not literally `UUID`, expose a small component helper that returns
    the canonical record UUID and use that helper in the cell.
  - If column ids differ from API/model fields, or if displayed values are derived labels, define
    explicit signal-friendly sort logic, for example a `sortValue(row, column)` helper used by the
    sorted-row `computed()`.
  - Derived sort examples: provider label, plan label, status label, account/domain label, formatted price, region name, size/bundle display, image display.
  - After `.table-wrapper`, render a real `<mat-paginator class="mobile-paginator"
    [length]="sortedRows().length" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
    [pageSizeOptions]="[5, 10, 25, 100]" (page)="setPage($event)" showFirstLastButtons>`.
  - Do not use an empty `.mobile-paginator` placeholder.
  - Sort/filter changes must reset `pageIndex` to `0`.
  - The table header checkbox selects only `visibleRows()` from the current page/filter/sort state.
- ERP directory CRUDs:
  - Simple directory-style ERP resources such as customers, companies, suppliers, resellers,
    carriers, and complexes should use the shared base in
    `src/app/pages/erp/shared/directory-crud/`.
  - The resource component should only declare its endpoint, UUID field, columns, fields, labels,
    and optional lookup resources. Do not recreate page-local CRUD HTML/SCSS for these resources.
  - This keeps the app.md CRUD contract centralized: signal-first `resource()` lists,
    `computed()` table state, searchable FK selects, UUID secondary lines, bulk delete, standard
    dialog footer, and filter grid behavior all come from the shared base.
  - If a directory resource needs behavior outside this base, document the reason in the component
    before adding a local extension.
- Delete behavior:
  - Use `SlowConfirmDialogComponent` (`panelClass: 'slow-confirm-dialog'`, `disableClose: true`).
  - Individual row delete remains available even when bulk delete exists.

## Bulk Delete Baseline (Current)

- Use bulk delete by default on every ERP-style CRUD list page.
- Exception: remove bulk delete only when the resource has a documented explicit reason, and record that exception in the page notes/refactor briefing.
- Table selection:
  - Add a leading `select` column with `mat-checkbox`.
  - Row checkbox toggles one record by UUID.
  - Header checkbox selects/deselects only the currently visible page/filter result shown in the table.
  - Do not implement "select all filtered records across every page" unless the backend has an explicit filter-based bulk endpoint.
- Contextual action:
  - Show selected count only when selection is non-empty.
  - Show `Delete selected` next to the count in the dedicated `filter-actions` row.
  - Keep `Apply` then `Clear` order intact after contextual actions.
- Confirmation:
  - Must use `SlowConfirmDialogComponent` with `panelClass: 'slow-confirm-dialog'` and `disableClose: true`.
  - Message must include selected count and may include up to three record labels.
- API contract:
  - Frontend service calls `ApiService.delete('<resource>/bulk', { ids })`.
  - `ApiService.delete(endpoint, body?)` is the standard helper for DELETE requests with JSON bodies.
  - Endpoint pattern: `DELETE /api/v1/<resource>/bulk`.
  - Request body: `{ ids: string[] }`.
  - Response data: `{ deleted: string[], failed: { <Entity>UUID, message }[] }`.
- After response:
  - Remove deleted rows from the local table or reload the list.
  - Clear deleted UUIDs from selection.
  - If failures are returned, keep failed UUIDs selected when possible and show a concise error message.
- Suggested page structure:
  - component state: `selected<Entity>UUIDs = signal<Set<string>>(new Set())`
  - table columns: `['select', ...dataColumns, 'actions']`
  - service method: `removeMany(ids: string[])`
  - handler method: `removeSelected<Entities>()`
  - helper methods: selected count, row toggle, visible-row toggle, selection reconciliation after reload

## Searchable Select Baseline (Current)

- Any `mat-select` bound to records from another table/entity (FK-like fields) must be searchable.
- CRUD validators should enforce searchable selects only when the page actually contains FK-like
  dynamic relationship fields. Pages with static enum selects only, or no related-record selects,
  must not add fake searchable adapters just to satisfy the template.
- Signal Forms CRUD dialogs must use the shared `mns-search-select-field` adapter for FK-like
  selects instead of hand-written page-local `mat-select` search blocks. The adapter owns
  `select-search-option`, `select-search-field`, real-time filtering, option spacing, empty state,
  selected trigger labels, optional option descriptions, loading state, and clearing the search text
  when the panel closes.
- Any free-text code field backed by a canonical DB/API registry, such as Billing Product Code, must
  use `mat-autocomplete` with API-provided suggestions and still preserve manual typing when the
  workflow intentionally creates a new registry entry.
- Mandatory implementation pattern:
  - page templates use `<mns-search-select-field ... />`, never inline `select-search-option` /
    `select-search-field` blocks
  - options are provided as `MnsSearchSelectFieldOption[]` from `resource()`/`computed()` state
  - option `value`, `label`, optional `description`, and optional `searchText` must be enough for
    users to identify the related record without opening another screen
  - selected triggers, dropdown options, loading labels, empty labels, and translated static values
    must be owned by the adapter/component, not by browser auto-translation
  - spacing, option padding, and search field sizing come from the global `src/styles.scss`
    contract; do not add page-local layout overrides for these classes
- Exception: small static enum selects (for example `Active/Inactive`, `Yes/No`) can remain without search.
- Static enum/control selects still must be fully internationalized by the component, not by the DOM
  translation fallback.
  - Define a canonical option list in the component for commercial/status/mode enums.
  - The selected trigger, dropdown options, table columns, filters, and confirmation text must all
    use the same label helper/source.
  - Do not leave raw English literals inside `mat-option` content for enum values.
  - For nullable/all filters, prefer a stable empty-string UI value (`''`) for the `All` option and
    normalize it to `null` only when calling the API. Avoid binding `null` directly to a
    `mat-option` when the selected checkmark must be visible.
  - Validate both closed and opened select states in PT/EN/ES during CRUD creation/refactor.
  - The DOM translation service is a safety net only; it is not the source of truth for CRUD
    component labels.

## System Parameter Defaults

- Every monetary input/display in CRUD flows must follow the platform default currency contract.
- When a CRUD/page needs the system default currency, do not hardcode `BRL`, `USD`, a blank string, or a locale-derived currency as the source of truth.
- Resolve `DEFAULT_CURRENCY` through `SystemParameterService.resolveDefaultCurrency()`.
- The resolver must use tenant parameters first and fall back to master parameters when the tenant value is missing, empty, or inactive.
- Create forms with monetary fields must initialize their currency from the resolved `DEFAULT_CURRENCY`.
- Existing record values still win in edit mode; the resolved default is only a fallback display/form value when the record has no currency.
- All monetary inputs in the same commercial record must use the same resolved/default currency unless the business flow explicitly supports multiple currencies.
- Numeric monetary fields should show the effective currency in the input itself, usually through
  `matTextPrefix`, using the record currency or resolved `DEFAULT_CURRENCY`.
- Editable monetary fields must use `type="text"` with the shared `appCurrencyMask` directive,
  not `type="number"`, so values such as `4.598,00` and `4,598.00` are accepted and converted to
  numeric payloads consistently.
- CRUD forms that use the system default currency must not render a currency field unless the business flow explicitly allows per-record currency override.
- When the currency is not user-editable, omit it from create/update payloads so the API/DB resolves it from tenant Parameters and then master Parameters.
- When a business flow does allow per-record currency override, keep API payload currency normalized to uppercase 3-letter ISO-style codes.
- Currency selection/defaulting is UX only. API/DB remains responsible for validating the effective currency, applying tenant/master parameter fallback, and rejecting unsupported currency values.

## Hosting VPS Image Placement

- VPS provider catalogs must expose image options from the provider catalog, including marketplace/application images when the provider supports them.
- VPS plans define commercial and capacity defaults only: provider account, region, size/bundle, price, setup fee, capacity metadata, notes, and status.
- VPS image selection belongs to VPS instances, persisted in `HviConfig.providerImageId`.
- VPS instance dialogs must use a searchable image `mat-select` backed by the selected plan provider catalog, with a free text fallback when catalog images are unavailable.
- Existing legacy `HostingVpsPlan.HvpImage` values may be shown only as a backward-compatible fallback for older data; new plan forms must not ask for an image.

## Dialog CRUD Baseline (Current)

- Create/Edit form runs in `MatDialog` (not inline form section).
- Dialog behavior:
  - `disableClose: true`
  - close by `Esc`
  - when using the shared CRUD dialog helper, pass the `onEscape` callback so `Esc` uses the same cleanup path as `Cancel`
  - explicit `Cancel` action
  - support `Save/New` action on create mode to persist and keep dialog open with form reset
- Dialog structure:
  - header (`.dialog-header`)
  - content (`.dialog-content`) with `MatTabGroup`
  - first tab label must be the translated `Record` key (`[label]="'Record' | transloco`) by default, because it contains the primary record fields. Do not use `Data`, `Date`, or `Details` for CRUD record tabs.
  - footer (`.form-actions`) with `Cancel`, `Save`, and create-only `Save/New` in the save split menu
  - footer must stay fixed at the bottom of dialog (`mat-dialog-actions` cannot move with content length)
- Dialog form submission:
  - CRUD dialog save actions must be controlled by Angular component methods, not by browser-native
    external form submission.
  - The primary `Save` button must use `type="button"` and `(click)="save...()"`.
  - `Save/New` must use `type="button"` and call the create-and-reset method directly.
  - Do not use a dialog footer button with `type="submit"` plus a `form="..."` attribute. That
    pattern can trigger a native GET submit, append form values to the route as query text, break
    breadcrumbs, and prevent a second `Save/New` save from running through the Angular flow.
  - If a form handles Enter-key submit, bind native `(submit)` and call `$event.preventDefault()`
    before delegating to the same save method. Avoid relying on `(ngSubmit)` for CRUD dialogs with
    footer actions outside the `<form>`.
- Action labels:
  - list create action: `New`
  - dialog primary action: `Save`
  - secondary create action: `Save/New`

## File Upload Progress Baseline (Current)

- Any CRUD or execution flow that sends a user-selected file must show explicit upload progress.
- The shared upload contract lives in `src/app/shared/upload/file-upload-progress.ts`.
  - Use `FileUploadProgress<T>` for upload state.
  - Use `buildFileUploadViewModel(progress, active)` for UI title, detail, percent label, progress
    mode, progress value, and busy state.
  - Use `UploadCancelledError` to distinguish user cancellation from real upload failure.
  - Use the shared progress factory helpers for initial, failed, and cancelled states.
- Browser upload services must call `ApiService.postFormWithProgress<T>(endpoint, formData)` instead
  of the plain `post()` helper.
- Component contract:
  - keep `uploading`, `selectedFile`, and `uploadProgress` state
  - expose a computed view model with `buildFileUploadViewModel()`
  - create uploads with `runFileUploadExecution()` and keep only its `FileUploadExecution` handle
  - call `FileUploadExecution.cancel()` on user cancellation; the helper unsubscribes and rejects
    with `UploadCancelledError`
  - keep saved metadata when the upload is cancelled or fails, when the API workflow creates
    metadata before uploading the binary
- The progress UI must include:
  - an upload title/state such as `Preparing upload`, `Uploading file`, `Processing uploaded file`,
    `Upload completed`, `Upload failed`, or `Upload cancelled`
  - a `mat-progress-bar`
  - percent when the browser reports total bytes
  - uploaded bytes and total bytes when available
  - transfer speed and estimated remaining time when available
  - `aria-live="polite"` and `aria-busy` while the upload is active or processing
- If the browser does not expose total bytes, use an indeterminate progress bar and still show the
  uploaded byte count.
- While a file upload is active:
  - disable file selection and save actions
  - keep the dialog open
  - convert `Cancel` to `Cancel upload` when cancellation is supported
  - show `Processing` after the request body finishes and before the API response returns
  - do not leave the user with only a spinner or a frozen save button
- On real failure, keep the dialog open, show a snackbar error, and show the inline failed state.
- On cancellation, keep the dialog open, show the inline cancelled state, and use a warning snackbar
  instead of a technical failure message.
- New upload screens must reuse this shared upload contract; do not copy local byte formatting,
  progress title/detail, cancellation, or ETA logic into the component.
- Required validation for upload screens:
  - small file upload
  - larger file upload with visible progress
  - cancellation during upload
  - API/upload failure
  - metadata save without a selected file, when the feature supports it
  - successful upload closes or resets the dialog according to the page workflow

## Dialog Action Footer Baseline (Current)

- Use a stable `mat-dialog-actions.form-actions` footer for every CRUD dialog.
- Use the repository CRUD template (`templates/crud`) as the concrete baseline for CRUD dialogs:
  - dialog root uses `width: 100%`, `max-width: 100%`, `max-height: min(92vh, 1100px)`, desktop `height: 100%`, and padding `1.5rem 1.75rem 1.25rem`
  - `.dialog-content` uses `flex: 1 1 auto`, `min-height: 0`, `max-height: min(82vh, 980px)`, `overflow: hidden`, and zero Material margin/padding
  - `.form-tabs` is a flex column with `height: 100%`, `min-height: 0`, and `margin-bottom: 1.25rem`
  - `.tab-content` starts compactly with `padding: 0.65rem 0 0.25rem`
  - `.form-actions` uses `margin: auto 0 0`, `padding: 0.85rem 0.75rem 0.75rem`, translucent surface background, `backdrop-filter: blur(8px)`, top border, and top shadow
  - mobile dialog root uses `padding: 1rem 1rem 0.25rem`, `height: 100%`, and `min-height: 0`; `.dialog-content` removes max-height; `.form-tabs` removes bottom margin
- Footer actions:
  - `Cancel` is the secondary action.
  - `Save` is the primary action.
  - `Save/New` exists only in create mode and is exposed through a split save button menu, not as a third standalone footer button.
  - footer must align its left/right edges with the dialog content inset, while keeping internal horizontal padding so buttons do not touch the footer corners; do not add external horizontal margin that makes the footer itself sit inside the form grid corners.
- Desktop layout (`>900px`):
  - `Cancel` stays on the left.
  - `Save` or split `Save` stays on the right.
  - both action groups must be on the same horizontal row.
  - when using CSS grid, footer columns must be `minmax(0, 1fr) auto`: the secondary action sits at the start of the flexible left column, and the primary save/split action sits in the fixed right column.
  - action placement must be enforced by action-group classes (`.secondary-actions` / `.primary-actions`) and must not depend on the order these groups appear in the template.
  - when using CSS grid, pin both groups to `grid-row: 1` so a `mat-menu` declaration in the template cannot push one action to another row.
- Mobile layout (`<=900px`):
  - footer actions stack vertically.
  - `Save` / split `Save` appears first.
  - `Cancel` appears below it.
  - buttons occupy the available footer width and keep the same horizontal margins as the dialog content.
  - in edit mode, where `Save/New` is hidden, `Save` must be the same width as `Cancel`.
- Split save button:
  - use one wrapper such as `.save-split-action`.
  - inside the wrapper, render the main `Save` button and a narrow arrow button with `[matMenuTriggerFor]`.
  - remove visual spacing between the two internal buttons (`gap: 0` and cancel Material dialog action margin on the arrow with `margin-left: 0 !important`).
  - desktop wrapper uses `display: grid`, `grid-template-columns: minmax(160px, auto) 44px`, `border-radius: 999px`, and `overflow: hidden`.
  - save button height is `40px`; arrow width/height is `44px` by `40px`; footer buttons use `min-width: 136px`.
  - main button radius: left rounded, right square (`999px 0 0 999px`).
  - arrow button radius: left square, right rounded (`0 999px 999px 0`).
  - add only a thin internal divider between `Save` and the arrow.
  - do not apply generic primary button classes that force full border radius to the main `Save` button inside the split wrapper.
- Save menu:
  - use Angular Material `mat-menu` for the `Save/New` action.
  - label must be `Save/New`.
  - align the menu below the split button; for right-aligned split buttons, prefer `xPosition="before"` and `yPosition="below"`.
  - style the `mat-menu` panel in global `styles.scss` because Material renders it in the CDK overlay, outside the component stylesheet.
  - on mobile, make the menu panel visually extend under the save button instead of opening as a tiny panel under only the arrow.
- Edit mode:
  - hide the arrow and `Save/New` menu.
  - keep the same `Save` command.
  - restore full rounded radius on `Save`.
  - on mobile, make `Save` full width like `Cancel`.

## Install Command Dialog Baseline (Current)

- Any modal that renders generated installation, enrollment, runtime, or provisioning shell commands
  must use `InstallCommandDialogComponent` from `src/app/shared/install-command-dialog`.
- Install command dialogs must open through `openCrudTemplateDialog` so their viewport size,
  position, resize behavior, footer density, and mobile behavior match CRUD dialogs.
- Footer actions must follow the CRUD action contract: `Copy command` is the primary action,
  `Close` is secondary, desktop keeps secondary left and primary right, and mobile stacks both
  actions at equal full width with the primary action first.
- Pages must not define page-local `*-token-dialog`, fixed-width script modals, local clipboard
  markup, or local command-shell SCSS.
- The API/DB remains the source of truth for generated enrollment/runtime tokens and command
  payloads. The frontend only renders command context and the copy action.
- Visible labels, warnings, context fields, and copy/close actions must be present in every runtime
  Transloco dictionary.

## Definition Of Done (Refatoração Completa)

- A task requested as `refatoração completa` is only accepted when ALL items below are met.
- Layout and list:
  - use `.erp-page`, `.erp-card`, `.erp-header`, `.filter-grid`, `.table-wrapper`, `.mobile-paginator`
  - list actions must include `Refresh` and `New`
  - filters must explicitly declare `span-1` controls only; `Search` is first, and `Status` is
    present when the resource has status
  - filters must expose explicit `Apply` and `Clear`
  - filters must keep mandatory order/placement: `Apply` then `Clear`, in a dedicated right-aligned `filter-actions` row
  - filter buttons must use the standard icons: `filter_alt` for `Apply` and `backspace` for `Clear`
  - list loading must use `.table-loading` overlay with minimum `600ms`
  - delete must use `SlowConfirmDialogComponent` (`panelClass: 'slow-confirm-dialog'`, `disableClose: true`)
  - bulk delete must be present and follow the `Bulk Delete Baseline (Current)` section unless an explicit documented exception exists
- Dialog and form:
  - create/edit must run in `MatDialog` (no inline form)
  - `disableClose: true`, close by `Esc`, explicit `Cancel`
  - include `Save/New` in create mode through the dialog save split menu
  - dialog must follow viewport rules from `Dialog Viewport Rules (Current)` section
  - dialog footer must follow `Dialog Action Footer Baseline (Current)` for desktop/mobile action placement
  - dialog content must use compact density baseline from `styles.scss` (no local size inflation)
- Styling and responsiveness:
  - use `span.status-pill.status-chip.state-chip` with Activity Log palette classes (`chip-success`, `chip-running`, `chip-queued`, `chip-failed`, `chip-skipped`) plus `is-active`/`is-inactive`
  - do not use `::ng-deep` for table column alignment; use local classes on `th/td` (for example: `.status-col`, `.actions-col-cell`)
  - table list styling must follow the ERP baseline: `.erp-card` radius `1rem`, 4-column desktop `.filter-grid`, right-aligned `.filter-actions`, equal-width short action buttons, table header background, cell borders, row hover, and fixed status/actions widths
  - form grids must follow `4/3/2/1` (`desktop`, `<=1400`, `<=1200`, `<=900`)
  - on `<=900`, span classes collapse to 1 column
- Validation:
  - must pass `npm run check:crud -- <component-folder-or-html>` for every CRUD page touched
  - must pass `npm run build`
  - delivery must explicitly list each changed file and confirm checklist compliance

## CRUD Template Validator

- The global CRUD CSS only applies fully when the component uses the exact template hook classes. A page that is visually similar but misses small hooks is not compliant.
- For every CRUD creation/refactor, run:

```bash
npm run check:crud -- src/app/pages/<area>/<component>
npm run check:crud:layout -- src/app/pages/<area>/<component>
```

- The validator checks the required global CSS hooks, including:
  - `.table-wrapper mat-elevation-z8` with `[class.is-loading]`
  - `.select-col`, `.status-col`, `.actions-col-header`, `.actions-col-cell`, `.actions-col`
  - `.record-main` and `.record-uuid` in the primary table cell
  - `span.status-pill.status-chip.state-chip` with `is-active`/`is-inactive` and Activity Log palette classes
  - `matNoDataRow`
  - `.save-split-action`, `.save-main-button`, `.save-more-button`, and `is-single-action`
  - `openCrudTemplateDialog`, `SlowConfirmDialogComponent`, visible-row bulk selection, and partial-failure handling
- A component must not be considered "100% template" until this validator passes and `npm run build` passes.
- The layout validator is the lightweight enforcement layer for every changed CRUD page. It checks
  that the root page uses the global hooks (`.erp-page`, `.erp-card`, `.erp-header`,
  `.header-actions`, `.filter-grid`, `.filter-actions`), that `filter-actions` is inside
  `filter-grid`, and that filter buttons use `filter_alt`/`backspace`.
- The layout validator also blocks component-local SCSS definitions for shared CRUD layout hooks:
  `.erp-page`, `.erp-card`, `.erp-header`, `.header-actions`, `.filter-grid`, and
  `.filter-actions`. If one of those needs a reusable adjustment, change `src/styles.scss`, not a
  page component.
- CI runs `npm run check:crud:layout -- --changed <base> HEAD` before build so newly touched CRUD
  pages cannot drift from the global layout baseline.

## Non-negotiables (Blockers)

- Consider task incomplete if any one of these occurs:
  - input density differs from baseline
  - dialog size/position ignores viewport rules
  - CRUD kept inline instead of dialog
  - missing `Apply/Clear`, `Refresh/New`, or loading overlay
  - `Apply/Clear` order or placement differs from baseline
  - `confirm()` browser dialog used instead of `SlowConfirmDialogComponent`

## Request Template (recommended)

- `Refatoração completa do(s) componente(s) <nomes>. Aplique 100% o Definition Of Done do app.md, sem simplificações. Só finalize após build e checklist de conformidade item a item.`

## Dialog Viewport Rules (Current)

- Desktop:
  - dialog size is computed from `.page-content` bounds with inner spacing `8px`
  - fallback if `.page-content` is unavailable:
    - `width: min(1280px, calc(100vw - 1.5rem))`
    - `maxWidth: 99vw`
    - `maxHeight: 95vh`
  - clamp:
    - min width `320px`
    - min maxHeight `420px`
- Mobile (`<= 900px`):
  - keep `12px` viewport spacing on all sides
  - `width: calc(100vw - 24px)`
  - `maxWidth: calc(100vw - 24px)`
  - `height: calc(100dvh - 24px)`
  - `maxHeight: calc(100dvh - 24px)`
  - position with `top: 12px` and `left: 12px`
- While open:
  - observe `.page-content` with `ResizeObserver`
  - update dialog size/position dynamically

## Generic CRUD Implementation Contract

- This document is the source of truth for frontend CRUD behavior.
- Do not use any existing page/component as the canonical reference for a refactor or new CRUD page.
- Existing components may be inspected only to understand local APIs or shared utilities, never to override this contract.
- If an existing component conflicts with this document, follow this document and update the component toward the generic contract.
- Do not copy/paste viewport, footer, density, or filter logic from a component without checking every rule in this document.
- For create/edit dialogs, implement the viewport algorithm directly from `Dialog Viewport Rules (Current)`:
  - mobile config includes explicit `height` and `maxHeight`
  - desktop config may include only `maxHeight`
  - `dialogRef.updateSize(width, height)` must receive `height` when present, otherwise fallback to `maxHeight`
  - missing this fallback is a blocker because it can collapse the dialog into a top overlay band
- CRUD-specific features must be derived from the resource requirements:
  - tabs only when the form has distinct groups of fields
  - searchable selects only for FK-like dynamic data
  - shared inputs such as phone fields should use existing shared components when available
  - maps, copy flows, and auxiliary sections are optional resource features, not global CRUD requirements
- Visual validation must confirm that the dialog opens as a dialog overlay with visible content, not as an inline form or collapsed top band.
- Visual validation must confirm footer actions have visible horizontal margin from the dialog edges on desktop and mobile.

## Styling Baseline (Current)

- Global theme variables are in `src/styles.scss`.
- The reusable CRUD visual baseline is global and must live in `src/styles.scss`.
- New/refactored CRUD components must use the baseline classes instead of duplicating the common layout SCSS locally.
- Component SCSS should be limited to resource-specific details such as unusual column widths, custom visual widgets, or domain-specific helper classes.
- Layout classes styled globally across CRUD pages:
  - `.erp-page`, `.erp-card`, `.filter-grid`, `.form-grid`, `.table-wrapper`, `.mobile-paginator`
- Shared global CRUD classes also include:
  - `.erp-header`, `.header-actions`, `.filter-actions`, `.table-loading`, `.selection-count`, `.actions-col`, `.actions-col-cell`, `.status-col`, `.status-pill`, `.status-chip`, `.state-chip`, `.crud-dialog`, `.dialog-header`, `.dialog-content`, `.form-tabs`, `.tab-content`, `.form-actions`, `.primary-actions`, `.secondary-actions`, `.save-split-action`, `.span-2`, `.span-3`, `.span-4`
- Shared CRUD action button sizing:
  - `--crud-action-button-width` is the global fixed width for short header/filter action buttons.
  - `.header-actions button` and regular `.filter-actions button` use this width by default on desktop and mobile.
  - Longer contextual filter actions, such as `Delete selected`, must override to `width: auto` while keeping the same minimum width.
- Input density is mandatory and must follow compact baseline in `styles.scss`:
  - page forms (`.erp-page mat-form-field`) and dialog forms (`.cdk-overlay-pane.<panelClass> .crud-dialog mat-form-field`)
  - keep `--mat-form-field-container-height`, `--mdc-outlined-text-field-container-height`, and `.mat-mdc-form-field-infix` aligned with `var(--form-control-height)`
  - avoid per-component overrides that increase field height/padding outside this baseline
- Status badge visual pattern (tables):
  - use `span.status-pill.status-chip.state-chip` with compact chip size (align using local column class per page)
  - use the Activity Log palette classes globally:
    - `chip-success`: successful/active/answered states
    - `chip-running`: processing/running states
    - `chip-queued`: queued/pending/default waiting states
    - `chip-failed`: failed/error/canceled states
    - `chip-skipped`: inactive/skipped/neutral states
  - boolean status must keep `is-active` and `is-inactive` bindings alongside the palette class for semantic compatibility
  - keep uppercase label and compact chip dimensions
  - do not style column alignment using `::ng-deep .mat-column-status`; use local classes on `th/td` (example: `.status-col`) to avoid style leakage between pages
- Form grid breakpoints in current baseline:
  - desktop: 4 columns
  - `<=1400px`: 3 columns
  - `<=1200px`: 2 columns
  - `<=900px`: 1 column
- On mobile (`<=900px`), span classes should collapse to 1 column.
- Filter grid baseline:
  - desktop: 4 equal columns, each filter control explicitly declaring `span-1` and occupying 1
    column.
  - mobile (`<=900px`): 1 column.
  - `filter-actions` is the only full-row element inside `.filter-grid`.
  - Do not add component-local filter width overrides; update `src/styles.scss` if the reusable
    filter baseline needs to evolve.
- Dialog CRUD form grids must follow the same breakpoint rule (`4/3/2/1`) and span behavior (`.span-2/.span-3/.span-4`) as page forms.
- Dialog form density/layout standard (mandatory):
  - vertical spacing: prefer compact form rows (`.form-grid { gap: 0.5rem 0.75rem; margin-bottom: 0.35rem; }`)
  - tab content top spacing: keep compact (`.tab-content { padding-top: 0.65rem; }`)
  - avoid `Name` or `Street` full-width by default when 4-column grid is available; use `span-2` unless business context requires full row.
- Notes/anotações rule:
  - whenever a CRUD dialog has a notes/anotações field (`notes`, `Notes`, `*Notes`, config notes, or equivalent free-text annotation), render it in its own `mat-tab label="Notes"`.
  - do not place notes fields in `Record`, `Config`, `Pricing`, `Provision`, or other mixed-purpose tabs.
  - the notes field should normally use a full-row textarea (`mat-form-field.span-4`) inside that tab.
- Input distribution baseline for partner forms (`carrier`, `supplier`, `reseller`, `complex`):
  - Record tab desktop row pattern:
    - row 1: `Type`, `Status`, `Name (span-2)`
    - row 2: `Document (span-2)`, `Email`, `Phone`
  - Notes tab:
    - `Notes (span-4)`
  - Addresses tab desktop row pattern:
    - row 1: `Zip`, `Country`, `City`, `State`
    - row 2: `Street (span-2)`, `Number`, `District`
- CEP/Postal code UX baseline (mandatory when address has `Zip`):
  - `Zip` input must have a suffix search icon button (`matSuffix`) and also support `Enter` key.
  - trigger `GET postal-codes/:postalCode` through `ApiService`.
  - on success, autofill `Street`, `District`, `City`, `State`.
  - after autofill, focus `Number` field automatically.

## API Access

- Use `ApiService` from `src/app/services/api.service.ts`.
- Use relative endpoints (example: `erp/customers`).

## Maps (Mapbox)

- Token is resolved from system parameters (`MAPBOX_TOKEN`) via API.

## Auth/Guards

- Tenant routes use `environmentGuard`.
- Master-only routes use `masterGuard`.
- Tenant routes require an active environment stored as a real UUID in `mc_current_env` or in the
  authenticated user state. Do not treat empty strings, `null`, `undefined`, or any non-UUID value
  as a selected tenant.
- `ApiService` must send `X-Environment-UUID` only when the selected environment is a valid UUID.
  If no valid tenant is selected, tenant-scoped calls must be blocked in the browser before the API
  request is sent.
- Menu items must declare or inherit one explicit navigation scope: `public`, `tenant`, `master`,
  or `both`. Do not infer global access from the user role alone.
- `MASTER` users have an explicit context mode: `master` for global `/system/...` routes and
  `tenant` for tenant routes using the selected `EnvironmentUUID`. `MASTER` in `master` mode must
  not fall through to tenant routes when a `masterRoute` is missing.
- Mixed master/tenant resources use `scope: 'both'`, `route`, and `masterRoute`. Tenant-only
  resources, such as Webhost until a `/system/hosting/webhost` API exists, must stay
  `scope: 'tenant'` and only appear in tenant context.

## I18n

- Glossary: `i18n-glossary.md`
- Runtime service: `src/app/services/app-i18n.service.ts`
- Translation files: `public/i18n/pt-BR.json`, `public/i18n/en-US.json`, and
  `public/i18n/es-ES.json`
- Angular templates must use the Transloco pipe (`| transloco`). Do not add custom translation
  pipes, generated auto dictionaries, or DOM translation observers.
