# APP Patterns

## Routing

- Routes are defined in `src/app/app.routes.ts`.
- Each tenant module routes under its own prefix (`/registry/*`, `/financial/*`, `/hr/*`, ...).

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
- Browser-side authorization is UX only. The API remains the source of truth for RBAC/ABAC
  permissions, tenant scope, environment scope, billing, routing ownership, policy decisions, and
  secret resolution.
- Business rules must not live in the Angular app. The app may format values, validate obvious form
  shape before submit, show/hide actions for UX, and render API-provided URLs/data safely; it must
  not decide whether a user/tenant can access a resource, whether credit is sufficient, which
  provider/storage/bucket/path is used, how signed URLs are generated, which release can be
  installed, or when a workflow state is valid. Those decisions belong to DB/API contracts.
- When the API returns an authorized artifact such as a short-lived signed URL, the app must consume
  it as-is. Do not mutate signed URLs, storage object keys, tenant-scoped paths, or authorization
  material in frontend code; ask the API for a new authorized value instead.
- CRUD/list clients must consume the canonical collection envelope only:
  `{ status: 'success', message, data: { items, total, limit, offset }, duration }`. Do not add
  frontend compatibility branches for bare arrays or `data` arrays; endpoints using those shapes
  must be migrated in the API instead.
- Tokens stored by the app are user/session tokens obtained after login. Do not add permanent service
  credentials, storage credentials, signing secrets, or master tokens to frontend code, assets, docs,
  examples, or build-time environment files.
- Public examples must use placeholders and must not include customer data, production domains,
  production IPs, provider account IDs, or private infrastructure topology.
- Full contract: `docs/public-api-clients.md`.

## Layout

- Main shell and menu are in:
  - `src/app/layout/main-layout/main-layout.ts` and `main-layout.html` (behavior and rendering)
  - `src/app/layout/navigation/nav-registry.ts` (menu tree, data only)
  - `src/app/layout/navigation/nav-glossary.json` (label contract data)
- Every sidebar label follows the Navigation Label Contract below.

## Touch Scroll Baseline

- A finger drag scrolls every list (sidebar, tables, mobile cards, dialogs) wherever it starts,
  including on rows and buttons with a tooltip.
- On iOS/Android `MatTooltip` writes an inline `touch-action: none` on its trigger, which blocked
  the sidebar drag on resource rows (only module rows, without a tooltip, scrolled). The global
  `src/styles/_touch-scroll.scss` rule restores `touch-action: manipulation` on every
  `.mat-mdc-tooltip-trigger`; never set `touch-action: none` on a scrollable row or button.
- Sidebar entries use `matTooltipTouchGestures="off"`: their route tooltip is a desktop hint and a
  long press while scrolling must not open it. Covered by `src/app/layout/navigation/touch-scroll.spec.ts`.

## Platform AI (Settings › AI)

- AI providers are a platform resource shared by every AI feature; only `platform.ai.manage` (or
  master) sees `Settings › AI` (`scope: 'public'` entries with that permission, no tenant needed).
  Tenants never register keys: they use AI through the features of the modules they contract.
- Providers (`/settings/ai/providers`, CRUD, `system/ai/providers`): only `anthropic`, `openai`,
  `gemini` (no base URL); write-only API key; "Test connection" row action; registered in
  `QUICK_CREATE_REGISTRY` as `AiProviderAipUUID`. The default model is never typed: the form
  loads the provider catalog (`POST system/ai/providers/models` with the typed key, which is not
  stored, or `GET system/ai/providers/:uuid/models` with the stored key) into a searchable select;
  a selected model that left the catalog stays listed.
- Features (`/settings/ai/features`, CRUD, `system/ai/feature-bindings`): one row per feature
  (`support.triage` today) with provider (FK, quick-create), model (catalog of the selected
  provider; empty = provider default), output limit, calls per hour and prompt cache (`Automatic`/`Off`, duration 5 minutes/1 hour,
  hidden when off).
- Usage (`/settings/ai/usage`, read-only list, `system/ai/usage`): every gateway call with tenant
  (empty = platform), provider, model, tokens, latency, result and list-price estimated cost (USD). Prompts are never stored.
- Dashboard (`/settings/ai/dashboard`, first entry, `mns-dashboard-page`, `system/ai/usage/summary?days=30`):
  calls, estimated cost, tokens, error rate, latency and the prompt cache saving/hit rate; consumption
  by feature and model; and
  recommendations (`aiTip.<code>` keys with API params: errors, truncated answers, hourly limit,
  cheaper model with the estimated saving, prompt cache to turn on, cache writes never read back,
  unpriced model).
- A new AI feature adds its option to `AI_FEATURE_OPTIONS` (`pages/settings/ai-features`) and its
  own behaviour settings in its module; it never asks for a provider or key.
- Speech features (`SPEECH_AI_FEATURES`, today `help.tutorial.narration`) list the provider's
  speech models (`models?capability=speech`), require a model and a voice (`OPENAI_VOICE_OPTIONS`)
  plus optional tone/style, hide max tokens and the prompt cache, and have a _Test voice_ row action
  that plays the sample returned by `test-voice` in the App.

## Navigation Label Contract

Sidebar labels are short and contextual: the tree already tells the user where they are, so a
label names only what is new at its level. Full context belongs to the tooltip, breadcrumb and
page title. `npm run check:nav` enforces this app-wide in CI (`verify:changed`); there is no
allowlist — fix the label or the tree.

1. **Keys.** Every entry's `label` is the Transloco key `nav.<id>` (`id` with `/` → `.`), defined
   in `en-US`, `pt-BR` and `es-ES`. Never reuse shared CRUD keys (`Registry`, `Accounts`) in the
   menu and never invent disambiguation keys such as `DID menu operators`; the namespace already
   disambiguates. Removing an entry removes its `nav.*` keys (orphans fail the check).
2. **No ancestor context.** A label never repeats a word or word stem of any ancestor in any
   locale (accents and plurals ignored; a shared prefix or suffix of 4+ letters counts:
   `Faturamento › Faturas`, `Webhosts › Hosts`): `Suporte › Chamados › Origens`, not `Origens de chamado`;
   `Segredos › Contas`, not `Contas de segredos`; `Suporte da plataforma › Equipes`, not
   `Equipes de suporte`.
3. **Child named like its group.** Use, in order: (a) the entity noun (`PABX › Contas`,
   `SBC › Contas`, `Softswitch › Contas`); (b) flatten groups with two or fewer children
   (`PABX › Filas`, `PABX › Agentes`); (c) the canonical `Lista` / `List` / `Lista` for the
   main collection (`Troncos › Lista`, `Chamados › Lista`, `Segredos › Lista`).
4. **Groups name the subject, children name the collections**: `Discagem › Planos, Regras`,
   `Bloqueio › Listas, Números`, `Autenticação › Acessos, Domínios`, `Tarifas › Planos,
Atribuições, Acúmulos`.
5. **Length budget** (longest of PT/EN/ES, in characters): level 1 ≤ 24, level 2 ≤ 22,
   level 3 ≤ 18, level 4 ≤ 16; aim for ≤ 16 everywhere. No label may be truncated in any locale
   at 260px desktop, the compact flyout or 360px mobile.
6. **Shortening order**: drop context already given by an ancestor → drop prepositions and
   qualifiers → use the glossary's short term → use an established acronym (DNS, CDR, URA).
   Never invent abbreviations (`Config.`, `Prior.`).
7. **Sentence case** in every locale, starting with an upper-case letter; later words, also after
   `/`, stay lower case. Acronyms, product names and proper nouns keep their form.
8. **Nouns, not verbs.** Collections are plural (`Servidores`, `Rotas`, `IPv4 fixos`); groups are a
   subject noun; no actions (`Vínculos`, not `Vincular clientes`; `Listas de acesso`, not
   `Permitir/bloquear`; `Reconciliation`, not `Reconcile`). `nav-glossary.json` `forbiddenVerbs`
   lists the actions the check rejects per locale. The dashboard entry is always `Painel` /
   `Dashboard` / `Panel` and comes first (checked).
9. **Glossary.** One term per concept, translated in each locale: `Painel` (never
   `Visão geral`), `Lista` (never `Cadastro`/`Registro` as a leaf), `Fornecedores` = Registry
   suppliers vs `Fabricantes` = ISP equipment vendors, `Assinatura` = the platform billing
   module (its subscriptions are `Adesões`), `Cibersegurança` (never `Cyber Security` in PT).
   English words stay only for product names and established terms listed in
   `nav-glossary.json` `productTerms` (for example `Custom`, the PABX custom call flow product);
   a pt-BR/es-ES word spelled like the en-US label fails unless it is a product term or a
   `sharedTerms` word that is correct in every locale (`Interfaces`, `Leads`, `Tickets`).
10. **Scope lives in the group.** Platform versus tenant is stated once by the group
    (`Suporte da plataforma`); its leaves reuse the tenant names (`Chamados`, `Equipes`, `Tipos`,
    `Prioridades`, `Origens`).
11. **Shape.** At most 4 levels (what the shell renders); a group needs at least 2 children.
12. **Menu label ≠ page title.** Leaf entries show the full localized path as tooltip
    (`Suporte › Chamados › Origens`), and the menu search matches that full path, so short labels
    stay findable by their parent words. Page titles and breadcrumbs may stay complete
    (`Prioridades de chamado`).

New menu entries: add the entry to `nav-registry.ts`, add `nav.<id>` to the three dictionaries,
run `npm run check:nav`, then validate PT/EN/ES at desktop (expanded and compact) and mobile width.

The check cannot judge meaning. Review by hand, for every new or renamed entry: the three
translations name the same thing (`Handoffs` is `Repasses`, not `Entregas` = deliveries), one
concept keeps one term in every module (`Operadoras` = `Operators`, never the freight
`Carriers`), and the label is not a generic placeholder such as `Especiais`.

## Page Description Contract

Every page header says, in one sentence, what the resource is for and how it relates to its
neighbours: the paragraph under the title (`Gerencie regras de correspondência, transformação de
número e roteamento dos planos de discagem.`). It is mandatory for every CRUD configuration
(including collection dialogs and one-shot `form` dialogs), dashboard, settings page, detail page
and metrics monitor; `defineCrud` has no default, so a missing `pageDescription` does not compile.

- Write a Transloco key (or an English source string) translated in PT/EN/ES; never an empty
  string, never the page title again, never a template with interpolated words (one key per
  variant; only record data such as `#123 · Subject` may be interpolated).
- `mns-dashboard-page`, `mns-settings-page`, `mns-detail-page`, `mns-page-shell` and
  `mns-metrics-monitor` require `description`; hand-written `app-header` blocks need the `<p>`.
- `npm run check:page-descriptions` enforces this app-wide in CI (`verify:changed`), without an
  allowlist; the CRUD/dashboard/detail/settings templates and `scripts/create-crud.mjs` start
  with a placeholder that fails the check until it is replaced and translated.

## Cyber Security navigation

Cybersecurity groups the existing resources by operator task: Dashboard; Protection
(Servers, Profiles, Services, Access lists); Threats (Alerts, Decisions, Events); Access
(Trusted nodes, API policies); and Secrets (Dashboard, List, Accounts, master-only Servers).
Menu labels follow the Navigation Label Contract; page titles keep the full names.
Groups are navigation-only and inherit existing commercial visibility. Preserve the canonical
`/cyber-security/*` and `/system/cyber-security/*` URLs, API contracts and resource permissions.
Route metadata supplies translated breadcrumbs; groups without destinations render as text.
Keep menu labels and page titles aligned in PT/EN/ES, including desktop compact and mobile menus.

## Menus

Every menu in the App (topbar, CRUD row actions, table view, contextual filter actions, split
save, and any new one) uses one global design, based on the topbar Activity Center:

- Panel: `<mat-menu class="mns-menu">` from `src/styles/_mns-menu.scss` (22rem, 12px radius,
  divided rows, viewport-bounded scrolling, 8px side margins at 480px and below). Short action
  lists add `mns-menu-compact`; lists whose rows carry identifiers that must stay on one line (the
  scope/tenant switcher) add `mns-menu-fit`, which sizes the panel by its longest row up to the
  viewport. Material renders panels in the CDK overlay, outside component
  styles, so menu styling stays global; never add per-component menu panel CSS.
- Primitives in `src/app/shared/menu/mns-menu.ts` (`MNS_MENU`):
  - `mnsMenuItem` on every `button[mat-menu-item]`: `selection="radio" | "checkbox"` with
    `[checked]` sets `menuitemradio`/`menuitemcheckbox` and `aria-checked`; `tone="danger"` for
    destructive actions (`Delete`, `Logout`); `keepOpen` for selection lists the user toggles
    without closing the panel (table view density and columns).
  - `<mns-menu-label [description]>`: the label, an optional second line (action explanation or
    the reason a disabled action is unavailable) and the trailing check of a selected item. Rich
    second lines are projected as `<span mnsMenuDescription class="mns-menu-description">`.
  - `<mns-menu-title [hint]>`: uppercase panel/section heading with a context hint (signed-in
    e-mail, record name, `visible / total`). A title after items opens a divided section; clicking
    it never closes the panel.
  - `<mns-menu-search [(value)] [label]>`: in-panel search. Typing stays in the field; Escape and
    arrow keys reach the menu. The owner resets the value when the menu closes. Lists use
    `.mns-menu-list` and `.mns-menu-empty`.
- Keep Material keyboard navigation, Escape and focus restoration; never wrap `mat-menu` items in
  another component (MatMenu only sees items projected in its own template).
- Disabled actions stay listed with their reason (`disabledReason` on CRUD row actions,
  `filterActionDisabledReason()` on contextual filter actions) instead of disappearing, unless the
  action does not apply to the record at all (`visible`). Menus remain UX only: actions stay
  server/Agent authorized.
- `npm run check:menus` (`scripts/validate-menus.mjs`, run by `verify:changed`) fails on a
  `<mat-menu>` without `mns-menu`, a `mat-menu-item` without `mnsMenuItem`, or a legacy menu class.

## Topbar menus

- Activity, notifications, language, scope (System/Tenant context and tenant), theme and profile
  menus use the global `mns-menu` design (section Menus); `src/styles/_topbar-menu.scss` keeps only
  the toolbar trigger state layers and the tenant row layout. The profile heading shows the
  signed-in e-mail.
- Order: Activity, Notifications, Language, Scope, Report problem, Theme, Avatar. Activity is the
  work the user started (queued operations); Notifications are things that happened to the user.
  Never merge the two.
- Icon-only triggers: Activity, Notifications, Language, Report problem, Theme and Avatar. Each has
  a translated tooltip and accessible name that carry the current value (`Idioma: Automático`).
- The scope trigger is the only text trigger and always names the active scope on desktop: the
  tenant display name (truncated, full name and identity line in the tooltip) or `Sistema` with a
  tonal error-container background, so the platform scope never looks like a tenant. One menu holds
  the master's context radios (`Tenant` keeps the panel open to show the list) and the tenant list;
  non-master users see only the tenant list. Below 768px it collapses to the icon.
- Each tenant row shows the name and, below it, the tax ID and tenant code on one line
  (`tenantIdentityParts()`); the panel (`mns-menu-fit`) widens instead of breaking them. When the
  viewport is narrower, the line wraps only between the parts and the separator is hidden. The
  panel width is locked on open so the tenant search does not resize it while filtering.
- Notifications bell: `NotificationInboxService` is the single unread source of the bell and the
  menu. It polls `user/notifications/unread-summary` every 60 s (tenant selected, tab visible):
  the total feeds the bell (`9+` above nine, singular/plural labels, `matBadgeDescription`, polite
  live region on increases) and the per-page counts feed the menu path (section Navigation unread
  path). Opening the bell lazily loads (`matMenuContent`) the newest eight `user/notifications`
  with an `Unread only` checkbox filter, a `New` section (unread) and an `Earlier` section (read).
  Unread rows carry three redundant signals (12% primary tonal background, 3px leading primary bar,
  trailing primary dot) plus a bold `on-surface` title and a primary icon; read rows use a regular
  `on-surface-variant` title and a muted icon. The icon follows the type, never the state
  (`forum`, `payments`, `lightbulb`); error severity keeps the error icon color. A click marks the
  item read, opens its `route` (internal path from the API) and briefly highlights the menu leaf
  (`is-notified`, no animation with reduced motion). Footer: `Marcar todas como lidas` (keeps the
  panel open) and `Ver todas as notificações` → `/user/notifications` (filter All/Unread, mark
  read/unread per row, mark all read, 25 per page with Load more; `resource()` read model).
  Types: `support.ticket.reply` (opening the conversation reads it), `billing.subscription`
  (latest dunning notice) and `feature_request.status` (author and voters). Shared display rules
  live in `src/app/services/notification-display.ts`.
- Navigation unread path: `navUnreadCounts()` (`src/app/layout/navigation/nav-unread.ts`) maps the
  summary onto the visible menu (`localizedNavItems`, already filtered by permission, scope and
  entitlement): a page lights the leaf whose resolved route is that page (or, failing that, the
  deepest leaf containing it) and every ancestor. The single `navIndicator` template renders a
  count pill on the leaf (`99+`) and a dot on every group above it, at all four levels of the
  expanded/mobile menu, on the compact rail (dot only) and in the three compact flyouts, with a
  visually hidden translated suffix for screen readers. Hidden items never light an ancestor and a
  page without a menu entry lights only the bell, so new notification types need no App change
  when their route is a menu page. There are no per-item badge flags in `nav-registry.ts`.
- Preserve the activity panel's 22rem desktop width, 12px radius, compact uppercase heading,
  divided rows and viewport-bounded scrolling. At 480px and below use 8px side margins.
- Text and icon triggers share the toolbar-scoped Material state-layer tokens: primary color,
  8% hover, 12% keyboard focus/press, rounded shape and 44px icon targets. Mobile rules hide only
  the scope label, never Material ripple/focus spans. Verify hover, keyboard focus, press and
  disabled states on every trigger in both themes; do not validate only the opened panels.
- All labels and accessible names use first-class PT/EN/ES translations. Selection menus expose
  checked state; keep Material keyboard navigation, Escape and focus restoration.
- Tenant default and tenant activation are independent sibling buttons, never nested interactive
  controls. Setting the default keeps the panel open and does not switch the active environment.
- Each tenant row has two lines: the display name (trade name, legal name or person name) and the
  identity line `tenantIdentityLine` (tax ID label + formatted tax ID, then the `TEN-` public code),
  so tenants with the same name stay distinguishable. Personal tax IDs arrive masked from the API;
  never unmask or rebuild them in the client. The trigger tooltip and accessible name carry both
  lines. Above 7 tenants the panel shows a search field that filters the complete `user/access`
  list by name, code or tax ID; it resets when the panel closes.
- The tenant fiscal identity is edited in `Billing > Tax identity` (`/billing/identity`, settings
  page template): tax ID, legal/trade name, billing e-mail and billing address (CEP lookup and UF
  list for Brazil). Saving it calls `TenantService.notifyAccessChanged()` so the switcher reloads.
- The identity is the only payer of wallet top-ups: the top-up form shows it read-only and sends
  no payer data; it opens only when the identity is complete, otherwise it sends the user to
  `/billing/identity`. `My profile` holds personal data only (no CPF or address).
- Theme offers explicit light/dark/system choices through ThemeService; retain persistence,
  cross-tab changes and device preference tracking. Keep existing language, tenant, permission,
  operation polling and logout/session-cleanup flows in their services.
- Validate desktop/mobile, light/dark, PT/EN/ES, long lists/names, default-versus-active selection,
  keyboard/touch, operation actions and session expiry before delivering topbar changes.

## Unified Support, My tickets and "Report problem"

- A single Support navigation group contains My tickets, Customers, Platform and Settings. Only Customers
  inherits the commercial Support entitlement; requester, platform and settings routes use their respective
  API permissions. Platform and Settings are submenus, never separate top-level modules.
- Shared catalogs (teams, types, priorities, origins) are unified under the Settings submenu,
  mapping `route: '/support/...'` and `masterRoute: '/support/platform/...'` so operators access
  the matching desk seamlessly.
- Tenant routes explicitly declare `data.supportDesk = 'tenant'`; platform routes declare
  `data.supportDesk = 'platform'`. FK quick-create forwards this same explicit context.
- Creation retries keep an idempotency key and frozen payload per draft/environment. Changing the
  environment closes overlays and clears report drafts. Ticket edits submit the loaded Revision
  as expectedRevision; a stale-edit failure preserves the user's draft and requires reopening
  with the current ticket before retrying.
- Ticket queues are server filters (unassigned, mine, my teams, waiting, due, overdue, resolved).
  Notification settings reuse the canonical notification rule form with ticket-only scope.

- One Support model, two desks. Tenant desk pages live under `/support/*` (module.support._,
  a tenant answers its own customers). The platform desk reuses the same pages under
  `/support/platform/*` with `data.supportDesk = 'platform'` (platform.support._ permissions, so support
  agents do not need platform master); they call `/system/support/*`. Pages read the desk with
  `supportDesk(route)` from `pages/support/shared/support-desk.ts`; quick-create inherits it.
- Ticket types, priorities (SLA) and origins are catalogs (`/support/ticket-types`,
  `/support/ticket-priorities`, `/support/ticket-channels`) registered in `QUICK_CREATE_REGISTRY`.
  Never hardcode ticket type/priority lists in the UI.
- Teams also use the shared desk scope (`/support/teams`, `/system/support/teams`). Their canonical
  form is registered as `SupportTeamStmUUID`; tickets offer searchable team quick-create and an
  eligible-agent selector. Team members are a shared collection dialog; creating accounts or
  granting platform permissions is intentionally outside this picker. The API validates same-desk
  teams and requires an assigned agent to belong to the selected team.
- Help center: `/support/requests` ("My tickets", Support and profile menus) lets every tenant user open and follow
  tickets to the platform team without the Support module: conversation, attachments, close.
- "Report problem" (top bar, CRUD list footer, My tickets action, and the action of API 5xx toasts)
  opens a help center ticket with origin `app_report`. `SupportReportService.openReportDialog()` opens
  `SupportReportDialogComponent` at once through `openCrudComponentDialog(..., 'crud-form-dialog')`;
  type and priority come from `help/ticket-types` and `help/ticket-priorities` (defaults
  preselected; failed-call reports prefill codes `bug`/`high`). The screenshot is captured behind
  the dialog with `html2canvas-pro` (the theme uses `color-mix()`).
- The print shows what the user sees, open dialogs included. Only overlays whose pane or backdrop
  carries `SUPPORT_REPORT_PANE_CLASS`/`SUPPORT_REPORT_BACKDROP_CLASS` (the report dialog and its
  image annotator), menus and tooltips are left out (`isExcludedFromReportCapture`). When opened
  from a dialog, the user may crop the print to that window ("This window only").
- Screenshots hide `input[type=password]`, credential `autocomplete` inputs and any element marked
  `data-report-mask` (inputs/textareas show `••••••`). Mark every element that shows secrets,
  tokens, card numbers or other sensitive values with `data-report-mask` when it can stay visible
  on screen. `ConfigurableCrudPageBase.reportMask(field)` marks `password`/`secret-content`
  fields (also while revealed) and credential-named keys automatically. Non-secret controls
  such as a boolean password-change policy may explicitly declare `reportMask: false`; actual
  `password`/`secret-content` controls always remain masked, regardless of this setting.
- Users can add up to 5 extra images (file picker/camera, paste, drag and drop). The browser
  re-encodes each one (max 2560 px, WebP or JPEG, no EXIF/GPS metadata) before anything is sent.
  The ticket is created first; extra images then go one by one to
  `POST help/tickets/:uuid/attachments`, each with its own status. A retry never creates another
  ticket and skips images the ticket already holds (unique name + size).
- The print and every extra image can be marked before sending: highlight box, arrow and blur.
  Blur is pixelated into the exported image, never an overlay.

- AI assistant (platform desk): `Support › Platform › AI` holds Settings (`/support/platform/ai/settings`,
  `mns-settings-page`, `platform.support.settings.manage`; the provider and model are read-only there,
  with a link to Settings › AI › Features) and Articles (`/support/platform/knowledge-articles`, CRUD,
  `platform.support.settings.manage`). Platform tickets show an `AI` column (classification) and
  the row actions `AI analysis` (data viewer: summary, team report, copyable fix prompt, citations),
  `Analyse again with AI` (internal note only) and `Mark as fixed` (public reply + `resolved`).
  Assistant messages have `AuthorKind = system` and read as "Support assistant". The fix prompt and
  the team report are API data for agents only; the help center never receives them.
  Settings also hold what the assistant may read from requester attachments (images, PDFs, text
  files, attachments per analysis) and the analyses per requester and hour; they are saved by a
  second `PUT system/support/ai/settings/attachments` only when one of them changed. The AI analysis
  lists the attachments read or skipped (audit, no content) and the action `clarify` ("More details
  requested"). The Report problem dialog tells the requester that the description, prints, files
  and diagnostics may be analysed by the support assistant (AI).
- Unread answers: the `support.ticket.reply` inbox notifications light My tickets through the
  navigation unread path and the bell (section Topbar menus). Opening the conversation marks it
  read (API) and refreshes the inbox; My tickets lists `New replies`.
  Background reads pass `api.get(..., { silent: true })` (`SILENT_ERRORS` context): failures throw
  without a toast, a 401 still expires the session.
- App screen catalog: `public/app-catalog.json` (menu path in pt-BR, scope, title, page
  description and field help of every routed screen) is generated by
  `npm run catalog:app` (`scripts/generate-app-catalog.mjs`) from `nav-registry.ts`,
  `app.routes.ts`, the page configurations and `pt-BR.json`. The API fetches it from
  `URL_FRONTEND/app-catalog.json` as the assistant's knowledge of the App. `verify:changed` runs
  `--check`: a change to the menu, routes, page titles/descriptions or field help must commit the
  regenerated file. Never put record data or secrets in labels/help (they are public anyway).

### List Report Problem Baseline

- Standalone editable CRUD pages place `ReportProblemButtonComponent` in the shared
  `.crud-list-footer`, below the rows: a neutral text button with the bug icon on the left,
  pagination on the right. Header actions remain Refresh/New and any configured Back link.
- At `<=900px`, pagination takes a full row and support follows below it, with a minimum
  44px touch target. The support action remains available with empty/failed lists and when
  pagination is disabled. Read-only global tables do not gain a support action.
- Use `variant="footer"`, pass `reportContext()` and the translated `pageTitle` explicitly;
  moving outside the header must not lose the report's title/resource context. Tutorial video
  access, when available, accompanies the report button in the footer.
- Embedded collections and dialog headers retain the existing icon variant. The topbar keeps
  its global report action; the profile menu does not duplicate it and retains My tickets.

### Dialog Report Problem Baseline

- Every dialog header (`.dialog-header`) ends with `<mns-report-problem-button />`, so a problem
  inside a dialog is reported without closing it, with the dialog visible in the print. The
  generic CRUD form/collection dialogs already include it and pass resource, mode and record UUID
  (`reportContext()`); component dialogs add the element and import `ReportProblemButtonComponent`
  (included in `CONFIGURABLE_CRUD_IMPORTS`).
- The report records the window title and these details in `systemInfo.context`, never form values.
- `npm run check:dialog-report` (part of `verify:changed`, app-wide, no allowlist) fails on a
  header without the button. A header that must not carry it documents
  `report-problem-exempt: <reason>` right above it (only the report flow itself today).
- `ClientDiagnosticsService` keeps a bounded, redacted in-memory trail (console errors, uncaught
  errors/rejections, failed API calls with `X-Correlation-ID`, last routes). The dialog shows
  exactly what is sent and the user can turn diagnostics off; the API stores them as an internal
  attachment visible only to the support team.
- A created report can return `AttachmentWarnings`. Show the warning beside its protocol and link
  to My tickets so users can retry attachments without opening a duplicate ticket.
- Ticket conversation and attachments use CRUD collection dialogs (`agentTimelineCollection`,
  `helpConversationCollection`, `attachmentsCollection`); private files open through
  `openPrivateFile` (authorized API stream, never a storage URL).

### Help Videos

- A tutorial video (YouTube) teaches one App page in one language. The platform registers it in
  Settings › Tutorial videos (`/settings/help-videos`, `platform.help.videos.manage`): App page
  (Angular Router pattern from the route config, e.g. `/voip/pabx/trunks`), language
  (`pt-BR`/`en-US`/`es-ES`), title and YouTube link (the API keeps only the video id).
- `HelpVideoService` reads `GET /help/videos` once per session (and every 10 minutes, no
  environment needed) and exposes `current()`: the video of the open route pattern in the user
  language, else English, Portuguese, Spanish.
- `<mns-help-video-button />` shows only when `current()` exists. `ReportProblemButtonComponent`
  renders it right before "Report problem", so every CRUD list footer, CRUD dialog and component
  dialog gets it without extra markup; the topbar has it beside its bug button and the profile menu
  has a "Tutorial video" item. The video dialog passes `[helpVideo]="false"`.
- The video plays in `HelpVideoDialogComponent` (`openHelpVideo`) over the current window,
  embedded from `https://www.youtube-nocookie.com/embed/<id>` built from a validated id, never a
  stored URL. The edge CSP of the App allows only that frame origin (`frame-src`).

### Release notes (Novidades)

- Contract: workspace `docs/release-notes.md` (every PR carries a `## Release note` block; the
  pipeline ingests it after each rollout). API: `GET /release-notes`, `GET/PUT /system/release-notes`.
- `/user/release-notes` (`ReleaseNotesPage`, user menu › Novidades) is a feed on `PageShellComponent`,
  one card per feature (type, modules, date, text, "action required", component versions), not a
  table. Filters: My modules / All modules (tenant entitlements, API side), type and module chips.
  The platform master gets the tabs "In this environment" and "Being deployed" (`status=pending`) and
  sees each component marked deployed or not.
- Public changelog `/release-notes` (same `ReleaseNotesPage`, `data.publicFeed`, `publicReleaseNotesGuard`
  sends signed-in users to `/user/release-notes`): every module, no sign-in, with the RSS link
  (`/api/v1/public/release-notes/rss?lang=`). Signed-in users get the "weekly e-mail digest" toggle
  (`/release-notes/subscription`); `/release-notes/unsubscribe?s=&t=` is the one-click unsubscribe page
  of the e-mail link. A delivered idea shows in the bell as `release_note.published`.
- Every signed-in user has the tabs "In this environment" / "Coming soon" (`status=pending`: received,
  not deployed here; no security entries for non-masters). `?tab=upcoming` opens "Coming soon", the
  route of the `release_note.upcoming` notice ("Idea … being deployed").
- `/settings/release-notes` (`ReleaseNotesAdminPage`, platform master) is a generic CRUD without
  create/delete: edit type, audience, modules, texts in three languages or hide. Texts come from the
  API per language; `localizedText` falls back to English, Portuguese, Spanish.

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
- Date inputs in CRUD forms must use Angular Material Datepicker with touch UI enabled
  (`<mat-datepicker #picker touchUi />`) and must also allow manual typing in the date format for
  the effective system locale. Pair datepicker inputs with the shared `appDateMask` behavior and
  the application `MnsNativeDateAdapter`, so users can either pick a date or type it according to
  the app/system locale. The effective locale resolves in this order: manually selected app
  language, tenant `DEFAULT_LANGUAGE` while language mode is automatic, browser language, then
  `en-US`. The adapter and mask must react to an effective language change; do not cache a locale
  per component. Do not replace CRUD date fields with plain
  `type="date"` inputs unless the datepicker interaction is explicitly not available for that
  control and the exception is documented in the component.
- All standalone pages/components that render a Material datepicker must import the shared
  `MnsDateAdapterModule`, never `MatNativeDateModule`. The shared module provides both the
  locale-aware `MnsNativeDateAdapter` and Material date formats to the component/dialog injector;
  this is required for `TemplateRef` forms opened through `MatDialog`.
- In the shared CRUD template, a `MatDatepickerInput` value binding must always receive a `Date`
  or `null`, never the locale-formatted text currently being typed. Keep incomplete manual input as
  an internal draft and commit it only after a valid `dateInput` event or explicit save validation;
  rebinding partial text makes Material deserialize it as invalid and clears the field.
- Date-only inputs must serialize at the CRUD/API boundary as a validated `YYYY-MM-DD` value. The
  shared adapter must reject calendar-invalid manual dates before save. Never use timezone-based ISO
  timestamps for date-only data; locale formatting belongs only to the form. The adapter must keep
  partial manual input editable while the user types and only mark a value invalid after it is a
  complete date-shaped value that fails calendar validation.
- Before finishing any Angular migration/refactor, run a residue check for:
  `*ngIf`, `*ngFor`, `*ngSwitch`, `@Input(`, `@Output(`, `@ViewChild`, `@ViewChildren`,
  `ChangeDetectionStrategy.Eager`, constructor dependency injection, `ngx-translate`,
  `TranslateService`, `TranslateModule`, and `RouterTestingModule`.
- New CRUD/list scaffolding must use `scripts/create-crud.mjs` and the configuration-only template in `templates/crud`. Every module, including System/Pay, must extend `ConfigurableCrudPageBase` and reference its shared HTML/SCSS.
  Do not copy older pages as a baseline. The template validator intentionally fails decorator
  queries, manual lifecycle teardown, old animation packages/triggers, constructor DI, the legacy
  `| t` pipe alias, and old `Data`/`Details` CRUD tab labels so new modules do not inherit Angular
  21-era patterns.

## Page Template Catalog (Current)

Paginated APIs with global sorting can opt into `serverSideSorting` alongside
`serverSidePagination`. The shared renderer sends the selected column's canonical `field`
as `sortBy` and `asc`/`desc` as `sortDirection`; it preserves the API order instead of sorting
only the current page. APIs must validate the field and use a deterministic tie-breaker.
Revision-aware bulk APIs can use `bulkDeletePayload(rows)` to include the selected records'
displayed preconditions alongside `ids`; never fetch newer revisions to silently retry a conflict.

"Template" in this document always means one of the shared page bases below. Copying the global
CSS hook classes (`.app-page`, `.filter-grid`, `.crud-dialog`, ...) or calling
`openCrudTemplateDialog` from a page-local component does **not** make a page template-compliant;
the page must use the shared base named here.

| Scenario                                                                                                                                       | Template (scaffold)                            | Shared base                                                                   | Validator                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Any list of records with filters, table, create/edit dialog, delete/bulk delete, row actions or child collections (every module) | `templates/crud` via `scripts/create-crud.mjs` | `ConfigurableCrudPageBase` + `configurable-crud-page.html/.scss`              | `check:crud`, `check:crud:layout`, `check:crud:i18n`, `check:crud:inventory` |
| Read-only summary with indicators and record inventories; Refresh is the only action                                                           | `templates/dashboard`                          | `DashboardPageComponent`, `dashboardResource`, `DashboardRecordListComponent` | `check:dashboard`                                                            |
| Singleton configuration with dirty/cancel/save                                                                                                 | `templates/settings-page`                      | `SettingsPageComponent` (on `PageShellComponent`)                             | `scripts/validate-content-pages.mjs`                                         |
| Read-only page for one resource                                                                                                                | `templates/detail-page`                        | `DetailPageComponent` (on `PageShellComponent`)                               | `scripts/validate-content-pages.mjs`                                         |

- A page that needs behavior the shared base lacks gets a generic extension point in the base
  (row actions, `collection`/`form` factories, related collections, hooks); never page-local
  CRUD HTML/SCSS, `MatTableDataSource`, or a parallel module base class.
- A page that renders a table but is not a record CRUD (for example the Metrics fleet explorer)
  opts out with a `// crud-template-exempt: <reason>` comment in its component. The reason is
  mandatory (a bare marker stays legacy) and must point to the contract that defines the page.
- List filters may be `type: 'text'` (free input applied like Search) and may declare
  `match(row, value)`: a client-side predicate over the loaded rows that is never sent to the API
  (for example the Dial pattern examples `Test number`, which keeps only the regexes that match).
- Columns may declare `value(row, translate, filters)` for a computed display/sort value (`filters`
  holds the applied list filter values, for example the test result of each regex) and
  `detail(row, translate)` for the secondary line of `identity`/`related` cells (shown instead of the
  UUID), for example a PABX with its engine and domain, or a route type with its target name.
- Shared base capabilities for non-trivial resources (prefer these over page code):
  `rowActions[].collection` (full child CRUD), `rowActions[].form` (one-shot form),
  `rowActions[].request` (declarative PUT/POST with optional confirmation, e.g. "set cover"),
  `createUpload` (create sends a file field as multipart with the shared upload progress, e.g.
  product images), column `kind: 'image'` (thumbnail), `addressSections`/`addressCopyActions`,
  `relatedCollections`, `afterSave`/`keepDialogOpenAfterSave` + `runManagedFileUpload`.
- Form tabs include `fiscal` (field `tab: 'fiscal'`, label `Fiscal`) for the fiscal group of a
  record (product classification, customer IE/indicators); the database owns the fiscal rules.
  `postalLookup.municipalityCodeKey` receives the IBGE code returned by the postal code search,
  so fiscal documents get the municipality without manual typing.
- `check:crud:inventory` scans the whole app in CI (`verify:changed`) and fails on any CRUD/list
  page that does not extend `ConfigurableCrudPageBase`. There is no allowlist; the only opt-out is
  the documented `crud-template-exempt` marker for non-CRUD table pages.

## Global Table Component Baseline (Mandatory)

There is exactly one table in the App: `ConfigurableCrudPageBase` with its shared
`configurable-crud-page.html/.scss`. Every list of rows, in a page, tab, dialog, dashboard panel or
result panel, is rendered by it. Pick the surface by where the rows live:

| Rows                                                                                                                       | Surface                              | How                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| A resource list page                                                                                                       | `ConfigurableCrudPageBase` page      | `defineCrud`/config + shared template (`templates/crud`)                                                   |
| Child records of a resource, in a dialog                                                                                   | `ConfigurableCrudCollectionDialog`   | `rowActions[].collection`, or `openCrudTemplateDialog(this.dialog, ConfigurableCrudCollectionDialog, ...)` |
| Child records inside a parent form tab                                                                                     | `ConfigurableCrudEmbeddedCollection` | `relatedCollections` (rendered automatically)                                                              |
| Rows the page already holds (dashboard inventory, operation result, measurements, the current page of an analysis surface) | `mns-global-table` (read-only)       | `<mns-global-table [config]="defineGlobalTable({...})" [rows]="rows()" [loading]="loading()" />`           |

- Creating `<table>`, `<table mat-table>`, `MatTableDataSource`, `createSignalCrudTable`, a
  page-local `mat-paginator` for rows, or any page-local list table is prohibited for any AI/LLM or
  human developer. A missing capability is added to the shared base (generic option, column kind,
  hook), never to a page.
- All table capabilities come from the shared base: density toggle and column menu (`tune`),
  sorting, pagination, responsive mobile cards, loading indicator, empty label, row actions, column
  links (`column.rowAction`), copy, chips (`kind: 'status'` + `chipClass`/`options`/`value`), dates,
  numbers, icons (`column.icon`). Editable surfaces also get Search, Status/list filters,
  selection/bulk delete, create/edit dialogs and the report problem button.
- If tabular data needs to be presented inside a modal or dialog, use `ConfigurableCrudCollectionDialog` or a component extending `ConfigurableCrudPageBase`. Never construct a custom table dialog.
- Child records inside a parent form tab (`relatedCollections`: package items, queue/group
  members, IVR options, network instances, firewall rules) render
  `ConfigurableCrudEmbeddedCollection`: the same global table (Refresh, create button named by
  `addLabel`, report problem, Search, Status when a column has `kind: 'status'`, density, columns,
  pagination, mobile cards, loading) with the standard create/edit dialog for the declared
  `fields` (`createTitle`, `editTitle`; editing only when `updateEndpoint` exists). The parent page
  keeps the lookups and hooks: `lookupOptions`/`lookupLabel`/`fieldLoading`,
  `relatedCollectionFieldOptions(field, collection, values)` for options that depend on the child
  form, `relatedCollectionFieldChange` for dependent child values, `relatedCollectionColumnValue`
  for cell text, `afterRelatedCollectionRowAdded` and `reloadRelatedCollection`. Never render a
  plain `<table>` or an inline add form for child records again.
- Read-only tables (`mns-global-table`, `src/app/shared/crud/configurable-crud/global-table.ts`)
  take a constant `defineGlobalTable({ key, uuidField, columns, emptyLabel, rowActions? })`: `key`
  names the table for the per-user column preferences, `uuidField` must be unique per row (add a
  computed `key` when the data has none). The base runs with `readOnly` (no filters, header
  actions, create, edit, delete or selection) over local `rows`; `pagination: false` when the page
  paginates on the server itself (Metrics fleet explorer). Navigation from a row is a row action
  (`run: (row) => router.navigate(...)`), never a link inside a custom cell.
- In collection dialogs (`ConfigurableCrudCollectionDialog`), header actions (`Refresh`, `New` if `canCreate()`, and `<mns-report-problem-button>`) belong in `.dialog-header .header-actions`, while `Close` belongs in `.form-actions .secondary-actions` at the bottom of the dialog, preserving the standard dialog action footer.
- Not tables (allowed): `DataViewerDialogComponent` sections (read-only key/value payload viewer,
  see `Read-Only Data Viewer Dialog Baseline`), `DashboardRecordListComponent` (dashboard record
  cards) and the server paginator shared by the Cards/List/Compact modes of the Metrics fleet
  explorer.
- Enforced in CI (`verify:changed`) by `npm run check:tables`
  (`scripts/validate-global-table.mjs`): any `<table>`, `mat-table`/`matColumnDef`,
  `MatTableModule`/`MatTableDataSource`, `<mat-paginator>` or `MatPaginatorModule` outside the
  global table fails the build. There is no per-page opt-out marker: the only exceptions are the
  `NOT_TABLE_SURFACES` of the validator (the global table and the "Not tables" list above), and a new
  one needs the same change here. `crud-template-exempt` does not exempt a page from this check.
- Before writing any list, an AI agent answers in its plan which of the four surfaces above renders
  it. "The page already has the data", "it is read-only", "it is a dashboard", "it is a small
  sub-table" or "it is inside a dialog" are not reasons to hand-roll a table: those are exactly the
  cases `mns-global-table`, `ConfigurableCrudCollectionDialog` and `relatedCollections` exist for.

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

## Live Update Notice

- A tab left open must learn that a newer App was deployed without a page refresh. Detection lives
  in `src/app/services/app-update.service.ts`; the notice is `mns-app-update-notice`
  (`src/app/shared/app-update/`), rendered once by the root component.
- Source of truth is the same-origin `/build.json` written by `scripts/install-nginx-runtime.sh`
  on every App node (served `no-store`), never the release catalog: a promoted release is not yet
  installed, and only the App nodes know what a reload would load. The service compares its
  `version` with `APP_BUILD_INFO.version` of the running bundle.
- Reads happen on start, every ~5 min (jittered) while the tab is visible, and on focus,
  visibility, `online` and route changes (at most once a minute). Nodes behind the edge answer
  different versions during a rolling rollout, so a different version is accepted only after two
  reads agree at least 45 s apart; a rollback to the running version clears the notice the same way.
  Tabs share the accepted version (`BroadcastChannel`) and the postpone choice (`localStorage`).
- The notice is informative (primary color, `auto_awesome`, `role="status"`, `aria-live="polite"`),
  never a modal, warning or error, and never reloads by itself while the user works. Actions:
  `Update now` (asks first when a dialog is open, then `Update anyway`) and `Later` (hides it for
  4 h for that version; a newer version shows it again). The sidebar version footer turns primary
  and reopens the notice.
- With an update pending, a router navigation to a different path (menu, link, back button) with no
  open dialog and no navigation `state` becomes a full page load of the same URL, so users move to
  the new version between tasks without losing work. A lazy chunk that fails to load reloads the
  target route once.
- Critical updates: a release that fixes a serious problem sets `minimumVersion` in
  `public/update-policy.json` (normally to its own version, in the same PR). The installer copies it
  into `/build.json`; tabs running below it get `Important update` without `Later`/close. It still
  never reloads by itself. Leave it `null` for regular releases; raising it is a review decision.
- Faster detection without extra requests: every API response carries `X-Mns-App-Version` (App
  version installed on every App node, from the Agent inventory). The interceptor passes it to
  `AppUpdateService.hint()`, which reads `/build.json` at once when it differs; the header is only
  a hint and `/build.json` stays the source of truth. The topbar bell polls every 60 s, so a
  signed-in user learns of a release within about a minute. There is no push channel today.
- Every API request sends `X-Mns-Client: mnscloud-app/<version>`; the API stores it on the login
  session when it changes. `System > Monitoring > Versions in use`
  (`/system/monitoring/client-versions`) lists active sessions per client version and flags App
  sessions on an outdated version.
- All texts use `appUpdate.*` keys in PT/EN/ES. Validate desktop and mobile (full-width card above
  the safe area), light/dark, and keyboard access before changing it.

## Session Expiration UI

- When a user session expires or logout is executed, the app must leave only the unauthenticated
  route visible. Close all open dialogs, menus, popovers, select panels, and CDK/Material overlays
  before navigating to `/signin`.
- Session cleanup is global behavior and belongs in the auth/session flow. Do not make individual
  CRUD pages responsible for closing their own dialogs on 401 responses.
- Sensitive one-time artifacts shown in dialogs, such as install commands and runtime tokens, must
  never remain visible behind the sign-in screen after a 401 redirect.
- Deep links survive sign-in: `authGuard`, `userResolver` and session expiry send the user to
  `/signin?returnUrl=<path>` (`core/navigation/return-url.ts`), and sign-in (or an already signed-in
  visit to `/signin`) opens that path instead of `/dashboard`. Only App-internal paths are accepted
  (`safeReturnUrl`: one leading slash, no scheme/host/backslash/control characters, never `/signin`);
  an explicit logout carries no return path. E-mail links (tickets `?ticket=<uuid>`) rely on this.

## CRUD Baseline (Current)

- Baseline page structure:
  - `.app-page` -> `.app-card` -> `.app-header` -> `.filter-grid` -> `.table-wrapper` -> `.crud-list-footer` (support + `.mobile-paginator`)
- End-to-end frontend refactor completeness:
  - A full page/module refactor is not complete with layout and build only.
  - Update the app translation layer for every new or changed visible literal in the same change:
    menu labels, page headings, helper text, dialog titles, tab labels, field labels, placeholders,
    tooltips, aria-labels, empty states, confirmation text, snackbar fallback messages, and action
    labels.
  - Manual translations belong in `public/i18n/<language>.json`. Transloco is the only runtime
    i18n layer; do not add component-local translation maps, generated auto dictionaries, custom
    translation pipes, or DOM translation fallbacks.
  - This translation step is not a narrative checklist item only: every full CRUD refactor must run
    `npm run check:crud:i18n -- <component-folder-or-html>` for each touched CRUD page. A refactor
    is incomplete if visible labels, headings, placeholders, tooltips, aria labels, confirmations,
    snackbar messages, or enum labels remain as raw template/component literals instead of going
    through Transloco keys present in `en-US`, `pt-BR`, and `es-ES`.
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
  - Contextual diagnostics or page-specific commands use the optional declarative
    `filterActionMenu` contract. The generic template renders it only when the page declares it,
    on the left side of the dedicated filter-actions row; `Apply` and `Clear` remain right-aligned
    for every other CRUD page. Menu actions must remain server/Agent authorized and may not be
    inferred from a visible client-side control.
  - Placement is mandatory: `filter-actions` must be on its own row (`grid-column: 1 / -1`), never inline at the side of the search input.
  - Standard `Apply` and `Clear` actions remain grouped and right-aligned, including mobile. Render the shared `filter-actions-start` slot only when the page has contextual actions; those actions may depend on an active filter (for example, a status inspection for the selected PABX) and must be disabled until their prerequisite filter is selected.
  - Short filter action buttons (`Apply`, `Clear`) share the global fixed width from `--crud-action-button-width`. Contextual actions in `filter-actions-start` use intrinsic width with concise scope labels (for example, `Ramais`), so they never inherit the Apply/Clear width.
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
  - Use list loading state + overlay (`.table-loading`) on table wrapper. `.table-wrapper` is the
    non-scrolling frame; the list content scrolls horizontally inside its child `.table-scroll`, and
    `.table-loading` stays a direct child of `.table-wrapper` (outside `.table-scroll`) so the
    overlay and spinner cover the visible area at any horizontal scroll position.
  - The desktop table `Actions` column is `stickyEnd`: it stays pinned to the right edge while the
    other columns scroll horizontally inside `.table-scroll`, with an opaque background that follows
    row hover and a left separator shadow. Mobile cards are unaffected.
  - Keep minimum visible loading duration around `600ms`.
  - Header-level refresh actions must show local progress inside the refresh button. Do not rely
    only on the table overlay or a silent network request after the user clicks refresh.
  - Dashboard/read-model refresh buttons should use the same inline loading state and should not
    block the whole page unless the screen has no meaningful previous snapshot to keep visible.
- CRUD feedback:
  - Operational feedback (`success`, `error`, `warning`, `info`) must use `SnackbarService` / app snackbar.
  - Do not render transient CRUD success/error/warning/info messages inline in pages, tables, dialogs, or form footers.
  - Inline state blocks are reserved for persistent empty/error states that require page-level action, not save/delete/load notifications.
  - API error text is English and is not a translation key. When an API family returns stable
    codes, translate by code in one shared map (`shared/payment/pay-error.ts` for `PAY_*`,
    `shared/billing/billing-error.ts` for `BILLING_*`) consulted by `api.interceptor.ts` and
    `ConfigurableCrudPageBase.errorMessage`, with every message in `en-US`, `pt-BR` and `es-ES`.
    Billing requirement codes name the module through `commercial.module.<module>`.
- Dashboard visual baseline:
  - **Catalog and recipe:** `docs/dashboards.md` lists every shared dashboard component, where the
    numbers come from (database aggregate → API route with the list's permissions → page) and the
    steps for a new module dashboard. Use it before writing any dashboard.
  - Summary dashboards MUST instantiate `DashboardPageComponent` (`mns-dashboard-page`) and
    `dashboardResource` from `src/app/shared/dashboard`. Start new pages from `templates/dashboard`.
  - The shell owns the title, subtitle and exactly one action: the shared Refresh button.
    Do not project competing headers/toolbars.
    Do not render a metadata strip with last update, period or inventory-limit notices between
    the header and indicators. Internal snapshot timestamps remain part of the read model.
  - Dashboard inventories (servers, queues, trunks, providers, domains, activity) are read-only
    global tables (`mns-global-table`, Global Table Component Baseline), never `mat-table` markup.
  - No Search/Status forms, Apply/Clear, New/Edit/Delete, bulk actions or commercial action buttons
    belong in summary dashboards. Use the existing authorized management/detail routes. A plain
    contextual navigation link is permitted; it is not a mutation or a second action toolbar.
  - Fixed history windows belong in the relevant indicator/section description, not a generic
    metadata strip. Resource/period selection belongs to an analysis
    page. The Metrics fleet explorer is an analysis surface, retains its Cards/List/Compact modes,
    pagination and Monitor action, and is not classified as a summary dashboard.
  - Shared visual identity is mandatory across the application: a screen must look like the same
    product on first opening. Reuse shared components, theme tokens, typography, surfaces, spacing,
    density, state colors and responsive rules. If a necessary reusable style does not exist, CREATE
    it in the shared layer first; then consume it. Future refinements belong there so all consumers
    inherit them. Never copy styles into a page to create a visually similar private variant.
  - Dashboard page-local SCSS and inline `styles` are prohibited. Shared dashboard primitives live
    in `src/styles/_dashboard.scss`, loaded once by `src/styles.scss`; existing shared helpers retain
    ownership of their own presentation. No per-module shell/grid/card CSS or raw fixed theme colors.
  - The shared shell uses `app-page dashboard-page`, `app-card dashboard-shell`, `app-header`, and
    `header-actions`. KPI content uses `dashboard-grid`, `dashboard-metric`, `dashboard-metric-label`,
    `dashboard-metric-value`, `dashboard-metric-hint`. Use `dashboard-sections` for two-column panels
    and `dashboard-panel` for their surface. Do not nest decorative cards or force empty grid slots.
  - KPI columns adapt from four to two to one. Panels collapse to one column. Keep page width within
    the viewport; wide detail tables scroll within their own wrapper. Charts/maps use shared panel
    surfaces and data-driven geometry only. States need accessible text/icons, not color alone.
  - The read-model adapter owns guarded resource reads and retains the last successful snapshot on
    refresh failure. Initial placeholders are not loaded data and must not imply healthy zeroes.
    Initial loading uses the shared skeleton; refresh shows progress inside the disabled button and
    leaves useful content visible. No table-style full-page refresh overlay.
  - Retained snapshots are page-local memory, never localStorage. Identity/environment changes clear
    them immediately; a late result from the previous scope must never populate the current scope.
    API permissions and entitlement checks remain authoritative; the template grants no access.
  - Required inventory reads fail the snapshot if unavailable. Optional observations must use
    explicit unavailable/null states, never silently convert a failed request to a successful zero.
  - Real totals should come from authorized aggregate endpoints. Existing bounded inventory reads
    must not be presented as complete global totals; document their limits with the relevant
    module contract rather than adding a generic dashboard metadata strip. Removing a
    filter must not cause an unbounded download. Do not change server API contracts just to remove
    an unused frontend filter; remove the page fields, handlers, option requests and dependencies.
  - Keep all indicators, business data, sorting, pagination and authorized navigation. Tables use
    signal-derived rows and the shared sorting/pagination helper, not `MatTableDataSource` adapters.
  - Validate `npm run check:dashboard`, dashboard state tests and `npm run build`; verify desktop and
    mobile, light/dark themes, PT/EN/ES, empty/populated/error/reload and master/tenant behavior.
    The dashboard validator is separate from the CRUD filter contract and runs in changed-app CI.
  - Current adoption: all 23 `pages/**/dashboard/dashboard.ts` summary pages use this shell,
    including tenant/master Cyber Security. Operational Cyber Security sections retain their own
    routes and controls; their forms are not projected into the dashboard.
  - **App home (`/dashboard`).** The home is exclusively for the modules the tenant contracted
    (platform areas in System context): header → "Needs attention" (all modules, most severe
    first, collapsible with severity count badges, each item an `<a>` to the resource) → one panel with one tab per module
    (`mat-tab-nav-bar` links, selected module in `?module=`, badge = icon + count) → per tab:
    status line, KPI tiles, at most five highlight rows (`DashboardRecordListComponent`) and the
    module dashboard link. A contracted module without resources shows the onboarding state with
    its create link; an unavailable section says so, never zero. Nothing about the subscription
    (wallet, top-ups, renewals, ledger, entitlements) appears on the home: `/billing/dashboard` owns
    it. Data comes only from `GET /dashboard/overview` or `GET /system/dashboard/overview`
    (`ContextModeService.effectiveMode()`), which decides module visibility server-side; codes are
    translated under `home.*` in PT/EN/ES. Tab, badge, onboarding and alert-link styles are the
    shared `.dashboard-tabs`, `.dashboard-tab-*`, `.dashboard-onboarding` and
    `.dashboard-alert-link` primitives. The home is the only dashboard with a second header
    action, **Customize** (`[customizable]`/`(customize)` on `mns-dashboard-page`, enforced by
    `check:dashboard`): `DashboardLayoutDialogComponent` reorders (up/down buttons, keyboard and
    touch friendly) and hides tabs, saved per user through `PUT /user/dashboard-layouts/home.<scope>`
    and read with the overview. It is display only: hidden tabs keep their items in "Needs
    attention", and a home with every tab hidden says how to show them again. Plan and phases:
    `docs/handoffs/2026-10-18-main-dashboard-contracted-modules.md` (workspace).
  - **Charts.** Every dashboard chart is `mns-trend-chart` (`src/app/shared/charts`): daily
    columns, stacked columns or lines with the shared styles (`src/styles/_charts.scss`) and the
    validated series tokens `--mns-chart-1/2` (light and dark). Two or more series always show a
    legend, values are in the hover tooltip and a screen-reader list, text never takes the series
    color. Data comes from the API already filled day by day (home: `tab.chart` from the
    `DashboardMetricDaily` rollup); render it under `@defer (on viewport)` with a placeholder of the
    chart height. Never add a chart library or page-local chart markup.
  - Read-only record inventories use `DashboardRecordListComponent` from `shared/dashboard`.
    Pass a title, items and empty label; each item provides identity, status/tone and typed details.
    Dates declare `format: 'datetime'`; only enum values declare `translate: true`. Never infer
    formatting from a label or translate hostnames, addresses, versions or other raw data.
    The component owns markup and shared styles own presentation; pages only map authorized data.
    Realtime overview, Media and TURN share this component for inventory/certificate/domain panels.
  - Editing the shared shell updates every consumer automatically. Only remove obsolete bindings
    when its public inputs change; never copy a shell into pages to apply a visual adjustment.
- Table behavior:
  - Shared base internals (the `ConfigurableCrudPageBase` template renders these; pages never write
    them, see Global Table Component Baseline and `check:tables`): signal-first tables
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
    support, and fast troubleshooting; do not remove it or hide it behind an action. The shared
    CRUD table shows the first 8 characters of the UUID on that line (one line, never wrapped);
    the full value is in its tooltip and a click copies it.
    When another column represents a related record/FK, its secondary `.record-uuid` line must show
    that related entity UUID instead of repeating the current row UUID. For example, a `Server`
    column shows the server UUID, and a `Realtime Domain` column shows the realtime domain UUID.
    If the API/model field is not literally `UUID`, expose a small component helper that returns
    the canonical record UUID and use that helper in the cell.
  - Shared CRUD rows stay compact: every cell renders on one line, long values end in an ellipsis
    and show the full text in a tooltip only when truncated (`mnsOverflowTooltip`), and columns may
    set `width: 'xs' | 'sm' | 'md' | 'lg' | 'xl'` (default `lg`) for the truncation limit. Copy
    buttons appear on row hover/keyboard focus and stay visible on touch screens. The actions
    column keeps `Edit` inline; row actions and `Delete` live in the `more_vert` menu (compact
    `mns-menu` titled `Actions` with the record name as hint; an action `tooltip` is shown as the
    second line, and `disabledReason(row)` keeps an action listed but disabled with its reason).
  - Every desktop table ends with the sticky actions column, also when there are no row actions
    (then it is a narrow column without the `Actions` label and with empty cells). Never render the
    `tune` button in a separate bar above the table header; on phones it sits in the card toolbar.
  - The `tune` button in the actions header opens the table view menu: row density (comfortable or
    compact) and visible columns, saved per resource in the browser (`crud-view-preferences.ts`,
    key `mns.crud.view.<endpoint>` with record ids normalized). The first (identity) column cannot
    be hidden; columns with `optional: true` start hidden. Preferences are UX only.
    The menu shows density as a radio section and columns as a checkbox section with a
    `visible / total` hint; it stays open while toggling, offers a column search above 8 columns,
    and the locked identity column reads `Always visible`. Density applies at once; column choices
    are staged (`columnDraft`) and applied when the menu closes, because mat-table re-creates the
    header row (and the menu trigger inside it) whenever the displayed columns change.
  - At `<=900px` the shared CRUD lists records as cards (`mobileLayout()`): the first visible column
    as title, the status chip and the same row actions in the header, every other visible column
    as a label/value pair. Cards reuse the table cell template (`#crudCell`), so copy and show
    actions stay available (always visible on touch) for configuring apps from a phone. A toolbar
    keeps select-all (bulk delete) and the table view menu.
  - Credentials shown in a list use column `kind: 'secret'`: masked by default, a show toggle per
    row that hides again after 10 seconds, and the copy action when `copyable` is set. A secret
    that is not in the list (for example a generated password behind an audited reveal endpoint)
    declares `secretLoader(row)` and `secretAvailable(row)`: it is fetched only on show/copy, kept
    only while shown, marked `data-report-mask`, and dropped after a row action replaces it.
  - If column ids differ from API/model fields, or if displayed values are derived labels, define
    explicit signal-friendly sort logic, for example a `sortValue(row, column)` helper used by the
    sorted-row `computed()`.
  - Derived sort examples: provider label, plan label, status label, account/domain label, formatted price, region name, size/bundle display, image display.
  - Shared base internals (never in a page): after `.table-wrapper`, the template renders a real `<mat-paginator class="mobile-paginator"
[length]="sortedRows().length" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
[pageSizeOptions]="[5, 10, 25, 100]" (page)="setPage($event)" showFirstLastButtons>`.
  - Do not use an empty `.mobile-paginator` placeholder.
  - Sort/filter changes must reset `pageIndex` to `0`.
  - The table header checkbox selects only `visibleRows()` from the current page/filter/sort state.
- Generic CRUDs (all modules):
  - CRUD/list resources in every module (including System and Registry) must use the standard shared CRUD component contract in
    `src/app/shared/crud/configurable-crud/`.
  - Create/edit must open through the generic `crud-form-dialog` panel class and the shared
    `.crud-dialog` template surface. Do not add resource-specific overlay panel classes or
    resource-specific dialog shell classes for normal CRUD forms.
  - The resource component should only declare its endpoint, UUID field, columns, fields, labels,
    and optional lookup resources. Do not recreate page-local CRUD HTML/SCSS for these resources.
  - This keeps the app.md CRUD contract centralized: signal-first `resource()` lists,
    `computed()` table state, searchable FK selects, UUID secondary lines, bulk delete, standard
    dialog footer, and filter grid behavior all come from the shared base.
  - Parent CRUDs that own operational child collections, such as PABX IVR options, group members,
    queue members, or routing destination rows, must expose those child collections through the
    shared configurable CRUD `relatedCollections` contract. Do not remove these nested
    configuration tabs during refactors, and do not recreate page-local HTML/SCSS for them when the
    generic related-collection surface can handle the child endpoint.
  - If a directory resource needs behavior outside this base, document the reason in the component
    before adding a local extension.
- Delete behavior:
  - Use `SlowConfirmDialogComponent` (`panelClass: 'slow-confirm-dialog'`, `disableClose: true`).
  - Individual row delete remains available even when bulk delete exists.

## Bulk Delete Baseline (Current)

- Use bulk delete by default on every CRUD list page.
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

- A relationship that permits multiple records must use the shared searchable-select adapter with
  `multiple: true`. Its form value is always an ordered UUID array; never use free text or a
  comma-separated string for a persisted relation. The API validates and persists the order.

- Any normal combobox/select must provide the same searchable dropdown experience, including
  FK-like fields, dynamic records, static enums, status fields, boolean-like lists, timezones,
  currencies, units, modes, and other fixed option lists. There is no minimum option count
  exception; the project keeps one visual/interaction identity for selects.
- CRUD validators should enforce searchable selects for FK-like, dynamic, static enum, and status
  selects. Native `mat-select` without search should be reserved only for exceptional framework
  constraints documented in the component.
- Signal Forms CRUD dialogs must use the shared `mns-search-select-field` adapter for select fields
  instead of hand-written page-local `mat-select` search blocks. The adapter owns
  `select-search-option`, `select-search-field`, real-time filtering, option spacing, empty state,
  selected trigger labels, optional option descriptions, loading state, and clearing the search text
  when the panel closes.
- Search focus and keyboard (adapter-owned, every select at once): opening the panel focuses the
  search input (except on coarse/touch pointers, where the on-screen keyboard would hide the list);
  a printable key on the focused closed select opens the panel with that key as the search text
  (no silent typeahead pick); inside the search, arrows/Page keys/Enter/Escape/Tab reach
  `mat-select`, Enter picks the first visible match, and text keys (including space) stay in the
  input. Remote searches (`remoteSearch`) emit `searchChange` after a 250 ms typing pause, and the
  CRUD base reuses each remote field's last page when only another field's query changed.
  Searchable-select labels and placeholders must be passed through Transloco by the consuming
  template/config. Do not pass untranslated placeholder literals into shared select adapters.
- FK quick-create is mandatory for every searchable FK form field. See
  `FK Quick-Create Baseline (Current)`; it is part of the Definition Of Done and enforced by
  `npm run check:crud:fk`.
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

## Required Field Feedback Baseline (Current)

Clicking Save with a missing or invalid field must show which field is wrong: the field turns red,
its reason appears under it, a toast names it and the first one receives focus.

- Save/Confirm/Submit buttons are never disabled by form validity (only while saving, loading or
  for a non-field gate such as a captcha). The click reveals the invalid fields instead.
- Generic CRUD (`ConfigurableCrudPageBase`): `validatePayload` collects every invalid visible
  field (required, invalid date, invalid JSON, `positive: true` numbers not greater than zero —
  `form.validation.positive`) into `fieldErrors()`; the toast names the first
  (`form.validation.missingOne` / `missingMany`); the form switches to the tab of the first
  invalid field in visual order (tab order, then declaration order), expands a compact address
  section and focuses it. Tabs holding errors get `crud-tab-invalid` (red label + dot). Errors
  clear as the field is filled and re-flag a required field emptied again; they reset when the
  dialog opens/closes or after Save/New.
- Page rules in `validatePayload` overrides call `super.validatePayload` first and then
  `return this.rejectField('<fieldKey>', '<translated message key>')`; a rule about a group of
  fields points at one with `firstVisibleField([...])`. Flows that bypass the base save use
  `reportFieldErrors(new Map([[key, fieldError('required')]]))`. Never a toast without a field.
- Related collection rows are created and edited in the standard create/edit dialog of their
  embedded global table, so they get the same Required Field Feedback with no extra code.
- API validation failures may return `{ error, code: 'VALIDATION_FAILED', fields: [...] }`
  (mnscloud-api `docs/api-patterns.md`); the base marks those fields
  (`form.validation.serverRejected`) and focuses the first. The API stays the enforcement layer.
- Template contract (`configurable-crud-page.html`): every `matInput` binds
  `[mnsInvalid]="hasFieldError(field)"` (`FieldInvalidDirective`: Material has no `NgControl`
  here, so the directive installs the matcher and refreshes the error state) and
  `[attr.data-field-key]`; every field `mat-form-field` has
  `<mat-error>{{ fieldErrorText(field) }}</mat-error>`; shared field components
  (`mns-search-select-field`, `mns-checkbox-group-field`, `mns-permission-tree-field`,
  `mns-secret-content-field`, `app-phone-input`) take `[invalid]` (+ `[errorMessage]`) and the
  marker; field tabs bind `[labelClass]="tabLabelClass('<tab>')"`.
- Forms outside the generic CRUD use `src/app/shared/forms/`:
  - signal forms: keep the button enabled and on submit
    `if (!this.form().valid()) return this.revealInvalid(this.form());` with
    `private readonly revealInvalid = injectRevealInvalidFields();`; show messages with
    `<mat-error>{{ form.x().errors() | mnsFieldErrorKey | transloco }}</mat-error>`;
  - plain signal dialogs: `rules = new FieldRules({ x: () => ... })`, bind
    `[mnsInvalid]="rules.invalid('x')"` + `<mat-error>`, and on save
    `if (!this.rules.check()) return this.revealInvalid();`.
- Messages use only field labels, never values (secrets and `data-report-mask` fields included).
- `npm run check:required-fields` (part of `verify:changed`, app-wide, no allowlist) fails on a
  CRUD field control without the bindings, on the anonymous "Required fields are missing." toast
  and on a button disabled by form validity. A button that must stay disabled documents
  `required-feedback-exempt: <reason>` in the three lines above it.

## FK Quick-Create Baseline (Current)

Users must be able to create a missing related record from the FK select itself, without leaving
or cancelling the form they are filling.

- Every searchable FK form field (`type: 'search-select'`, persisted value is a related record UUID)
  must offer quick-create: the `+` suffix button and the `Create <resource>` option in the empty
  state of `mns-search-select-field`.
- Quick-create always opens the referenced resource's canonical configurable CRUD page in
  quick-create mode. Never build a lightweight dialog, a duplicated field list, or a
  resource-specific host subclass.
- Registry: `src/app/shared/crud/configurable-crud/quick-create.ts` (`QUICK_CREATE_REGISTRY`) maps
  the canonical FK column (`ReferencedTableName` + `ReferencedTableField`, e.g. `RegCustomerRcuUUID`)
  to the page class (lazy `loadComponent`), the translated `Create <resource>` label, an optional
  `permission` (master-only `system/*` resources use `platform.master.access`), and optional
  `routeData` for pages that pick a variant from route data (catalog kind, database resource).
- Binding a field:
  - `source` equal to a registry key: nothing to add, the field gets quick-create automatically.
  - non-canonical `source`/key (legacy `pabxUUID`, `accountUUID`, ...): add
    `quickCreate: quickCreateFor('<RegistryKey>')`.
  - genuinely not creatable in place (tenants/users provisioned by onboarding or invitation,
    polymorphic targets, read-only pages, non-configurable forms): `quickCreate: false` plus
    `quickCreateExemptReason: '<why>'`. An exemption without a reason fails validation.
- New configurable CRUD resource: register its page in `QUICK_CREATE_REGISTRY` in the same task so
  every form that references it gets quick-create. A new referenced resource without a registry
  entry is incomplete work, not a reason to disable quick-create.
- Hand-written Signal Forms dialogs bind the adapter directly: `[canCreate]`, `[createLabel]` and
  `(createRecord)` calling `openQuickCreate(dialog, quickCreateRegistryEntry('<RegistryKey>'))`,
  then add the returned option to the options list and set the form value. Use
  `data-quick-create-exempt="<reason>"` on the tag only for the same exemption cases above.
- Quick-create mode (`CONFIGURABLE_CRUD_QUICK_CREATE`, provided by the invisible
  `ConfigurableCrudQuickCreateHostComponent`) is owned by `ConfigurableCrudPageBase`: the page does
  not load its list, opens the create dialog directly, hides `Save/New`, and returns the created
  option on save or `null` on cancel. The requesting field merges that option into its options and
  selects it (appends it for `multiple`), preserving everything already typed in the parent form.
- The created option is taken from the create response; when the response has no record, the base
  finds it by the label through the list endpoint. Override `quickCreateOption()` in the page only
  to enrich `description`/`searchText`.
- Filters (`listFilters`) never offer quick-create.
- Dependent remote FK selects declare `remoteLookup.parameters` as query-parameter → parent-field mappings. The shared renderer waits for every parent value, resets the child selection/search/page when a parent changes, and preserves other typed values. APIs must validate the relationship again; this filtering is UX only.
- UI gating is UX only: the API still authorizes the create request.

## System Parameter Defaults

- Every monetary input/display in CRUD flows must follow the platform default currency contract.
- When a CRUD/page needs the system default currency, do not hardcode `BRL`, `USD`, a blank string, or a locale-derived currency as the source of truth.
- Resolve `DEFAULT_CURRENCY` through `SystemParameterService.resolveDefaultCurrency()`.
- The resolver must use tenant parameters first and fall back to master parameters when the tenant value is missing, empty, or inactive.
- Create forms with monetary fields must initialize their currency from the resolved `DEFAULT_CURRENCY`.
- Existing record values still win in edit mode; the resolved default is only a fallback display/form value when the record has no currency.
- All monetary inputs in the same commercial record must use the same resolved/default currency unless the business flow explicitly supports multiple currencies.
- Numeric monetary fields should show the effective ISO currency in their label, using the record
  currency or resolved `DEFAULT_CURRENCY`.
- Editable monetary fields must use `type="text"` with the shared `appCurrencyMask` directive,
  not `type="number"`, so values such as `4.598,00` and `4,598.00` are accepted and converted to
  numeric payloads consistently.
- In `ConfigurableCrudPageBase`, declare monetary values as `type: 'currency'`. The generic form
  supplies `appCurrencyMask`, a visible ISO currency label, and numeric payload normalization.
  Use `currencyKey` when the record has its own currency field; otherwise the shared default
  currency resolver is used.
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
  - the generic CRUD template supports optional semantic tabs `Network`, `Match`, `Authentication`,
    `Codecs`, `Financial`, `Address`, and `Notes`; use `Match` for routing/selection criteria such
    as source IP, destination pattern, DID/prefix, From/To pattern, auth username, domain, priority,
    or equivalent match rules.
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
  - create/edit dialogs must be opened with `openCrudTemplateDialog(..., 'crud-form-dialog')` by default
  - dialog template root must be `<div class="crud-dialog">`; do not add resource-specific root classes such as `<thing>-dialog` for normal CRUD layout
  - dialog root uses `width: 100%`, `max-width: 100%`, `max-height: 100%`, desktop `height: 100%`, and padding `1.5rem 1.75rem`. The pane (`openCrudTemplateDialog`/`openCrudComponentDialog`) owns the viewport size; never cap the root with a fixed height (a `1100px` cap left a blank band under the footer on tall screens). The inset above the header equals the inset below the footer, so every generic dialog (CRUD form, collection, picker, settings dialog such as Personalize dashboard) frames its header and footer at the same distance from the surface edge
  - `.crud-dialog` owns `--dialog-section-gap: 0.5rem` and `row-gap` between header, scrolling
    content and action footer, on desktop and mobile. The header has no extra bottom margin.
    Keep this spacing outside the scrolling element so its vertical scrollbar stops before the
    action footer; content padding alone does not create that separation. Consumers inherit this
    rule without local footer/content margins.
  - dialog surface uses the global CRUD surface: outline border, `1.2rem` radius, `surface-container-high` background, and hidden overflow
  - `.dialog-content` uses `position: relative`, flex column layout, `flex: 1 1 auto`, `min-height: 0`, no max-height of its own (the dialog root bounds it), `overflow: hidden`, and zero Material margin/padding
  - `.form-tabs` is a flex column with `height: 100%`, `flex: 1 1 auto`, `min-height: 0`, `overflow: hidden`, and zero bottom margin (the dialog owns section spacing)
  - tab headers stay sticky inside the dialog content, and the tab body wrapper owns vertical scroll with `overflow: auto`
  - dialogs without tabs (pickers, step editors, ordered lists) put their body in
    `.dialog-content > .dialog-scroll`, the global scrolling body; never leave content directly in
    `.dialog-content`, whose `overflow: hidden` would cut it off
  - `.tab-content` starts compactly with `padding: 0.65rem 0 0.25rem`
  - `.form-grid` uses compact density: `gap: 0.5rem 0.75rem` and `margin-bottom: 0.35rem`; every field/control inside the grid must be `min-width: 0` and fill its grid track
  - `.form-actions` uses `margin: auto 0 0` on desktop and mobile, for `<div class="form-actions">` and `<mat-dialog-actions class="form-actions">` alike (no side margin for either), `padding: 0.85rem 0.75rem 0.75rem`, translucent surface background, `backdrop-filter: blur(8px)`, top border, and top shadow
  - mobile dialog pane/root uses a 12px viewport inset from `openCrudTemplateDialog`, dialog root padding `1rem` on every side, `height: 100%`, and `min-height: 0`; the footer has no bottom margin (the root padding is the only bottom inset); `.form-tabs` removes bottom margin
  - CSS must not globally override `.cdk-overlay-pane` positioning for CRUD dialogs; positioning, width and height are owned by `openCrudTemplateDialog`
  - resource-specific `panelClass` values and resource-specific dialog root classes are exceptions only for real custom surfaces/widgets; they must not be used for normal CRUD density, footer, viewport, field sizing, or responsive behavior
  - local panelClass overrides must not force edge-to-edge `100vw`/`100dvh` or replace the shared tab scroll behavior; update the global CRUD baseline when the standard needs to evolve
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
  - when the `Save/New` arrow is not rendered (edit mode, `formOnly` row-action forms such as
    one-shot migrations, and quick-create), the wrapper must carry `.is-single-action` so the single
    `Save` button is fully rounded; never leave a squared right edge without the arrow.
- Save menu:
  - use Angular Material `mat-menu` for the `Save/New` action.
  - label must be `Save/New`.
  - align the menu below the split button; for right-aligned split buttons, prefer `xPosition="before"` and `yPosition="below"`.
  - the panel uses `class="mns-menu mns-menu-compact save-more-menu"`; `save-more-menu` in global `styles.scss` only sets its width, because Material renders it in the CDK overlay, outside the component stylesheet.
  - on mobile, make the menu panel visually extend under the save button instead of opening as a tiny panel under only the arrow.
- Edit mode:
  - hide the arrow and `Save/New` menu.
  - keep the same `Save` command.
  - restore full rounded radius on `Save`.
  - on mobile, make `Save` full width like `Cancel`.
  - on mobile, the two-column split belongs to `.save-split-action`, never to `.primary-actions`;
    `.primary-actions` is only the full-width action group wrapper. This prevents the arrow segment
    from wrapping below the main `Save` button.

## Install Command Dialog Baseline (Current)

- Any modal that renders generated installation, enrollment, runtime, or provisioning shell commands
  must use `InstallCommandDialogComponent` from `src/app/shared/install-command-dialog`.
- Install command dialogs open only through `openInstallCommandDialog(dialog, data, destroyRef,
onClosed?)` (`src/app/shared/install-command-dialog/open-install-command-dialog.ts`). It uses
  `openCrudComponentDialog` with `crud-form-dialog`, so viewport size, position, resize behavior,
  footer density and mobile behavior match CRUD dialogs; it also binds Escape, releases the
  responsive binding on close, closes the dialog when the owning page is destroyed, keeps a single
  command dialog open at a time, and calls `onClosed` so the page can clear the generated token.
  Pages never call `dialog.open`/`openCrud*Dialog` with `InstallCommandDialogComponent` and never
  use a dedicated panel class (the former `install-command-dialog-panel` is retired).
- `npm run check:install-command-dialog` (part of `verify:changed`, app-wide, no allowlist) fails on
  any page referencing `InstallCommandDialogComponent` or on the retired panel class.
- Footer actions must follow the CRUD action contract: `Copy command` is the primary action,
  `Close` is secondary, desktop keeps secondary left and primary right, and mobile stacks both
  actions at equal full width with the primary action first.
- Install command footers must use the same `.crud-dialog .form-actions` margin, padding, desktop
  alignment, mobile stacking, and button inset as CRUD form dialogs. Do not define install-command
  footer margin or padding values that differ from the CRUD footer contract.
- The command dialog body must own vertical scrolling with `overflow-y: auto` and keep the footer
  fixed at the bottom of the dialog when the viewport becomes short.
- The shared `InstallCommandDialogComponent` owns copy feedback: successful copy must show the
  standard success snackbar and failed copy must show the standard error snackbar. Pages must not
  wire page-local `(copied)` handlers just to show the same notification.
- Pages must not define page-local `*-token-dialog`, fixed-width script modals, local clipboard
  markup, or local command-shell SCSS.
- The API/DB remains the source of truth for generated enrollment/runtime tokens and command
  payloads. The frontend only renders command context and the copy action.
- Resources that generate installation, enrollment, runtime, or provisioning commands must treat
  command generation as part of the lifecycle:
  - after a successful create, close the create/edit dialog and immediately open the generated
    command dialog when the API returns the created UUID/item;
  - the first command shown immediately after create does not need an extra confirmation because the
    user is already in the creation flow;
  - row actions that generate a new command for an existing record must confirm first through
    `confirmInstallCommandGeneration(dialog, translate, serverName, runtime)`
    (`runtime-install-token.ts`, a `SlowConfirmDialogComponent`) before calling the API, because the
    previous runtime token or enrollment secret will be replaced;
  - the confirmation text must explicitly say that the previous token/secret will be replaced and
    the target runtime may need to be reinstalled or reconfigured with the new command.
- Generic CRUD pages that need this lifecycle must use a generic post-save hook/configuration point
  instead of local inline-form overlays or page-specific command markup.
- Visible labels, warnings, context fields, and copy/close actions must be present in every runtime
  Transloco dictionary.

## Template Picker Dialog Baseline (Current)

- Any modal that lets the user start a record from a predefined template must use
  `openTemplatePickerDialog` from `src/app/shared/template-picker-dialog`. It renders searchable
  cards (name, category, description, metadata and an ordered step preview) inside the standard
  CRUD dialog surface and returns the selected template id.
- Name, description, category, metadata labels and step labels are Transloco keys (English source
  text) and must exist in every dictionary. Step details are shown as given, so they may contain
  `{{placeholders}}`.
- Pages must not define page-local template dialogs, card SCSS or fixed colors; the shared component
  owns scrolling, theme tokens, the `Close` footer and mobile layout.

## Read-Only Data Viewer Dialog Baseline (Current)

- Any modal that renders read-only technical details, event payloads, JSON records, logs,
  INVITE/CDR details, activity/audit details, runtime responses, or integration diagnostics must use
  `DataViewerDialogComponent` from `src/app/shared/data-viewer-dialog`.
- Data viewer dialogs must open through `openDataViewerDialog`, which delegates to
  `openCrudTemplateDialog(..., 'crud-form-dialog')`, so viewport size, resize behavior, scrolling,
  footer density, desktop alignment, and mobile behavior match CRUD dialogs.
- Footer actions must follow the CRUD action contract: `Close` is secondary, desktop keeps it on the
  left, and mobile renders it at full width using the shared `.form-actions` behavior.
- Pages must pass structured `details`, `sections`, and optional `code` blocks to the viewer. Pages
  must not define page-local `ng-template` detail modals, local `*-detail-dialog` wrappers, local
  clipboard handlers, or resource-specific SCSS for read-only payload viewing.
- Human-written conversation text (ticket replies, AI answers, notes) uses a section `message`, never
  a `code` block: the viewer lays it out with `shared/message-layout` (paragraphs, numbered and
  bulleted items on their own lines, including `1) ... 2) ...` written inside one sentence). The API
  e-mails apply the same rules (`mnscloud-api` `services/messageLayout.ts`). A list column showing
  such text binds `rowAction` to a `View message` action that opens it, so the whole message is
  never reachable only through the truncation tooltip (support conversations do this).
- Copy buttons are allowed only on explicitly safe code/payload blocks. The shared viewer owns copy
  feedback with the standard success/error snackbar.
- JSON/code payloads that contain multiline strings such as `stdout`, `stderr`, logs, command
  output, or script traces must be rendered with readable line breaks inside the shared viewer; do
  not display escaped `\n` sequences as one long JSON string when the content is meant for human
  troubleshooting.
- The caller remains responsible for authorization, tenant scope, and masking/redacting secrets
  before passing data into the viewer. The viewer must not fetch privileged data by itself.
- Read-only runtime diagnostics that queue a typed Agent job must use the shared
  `runRuntimeDiagnostic` helper and render the completed result via `openDataViewerDialog`. They
  may poll only a fixed resource-specific status endpoint; never expose free-form command input or
  browser-provided shell arguments.
- Visible labels, section names, copy/close actions, and snackbar messages must be present in every
  Transloco dictionary.

## Definition Of Done (Refatoração Completa)

- A task requested as `refatoração completa` is only accepted when ALL items below are met.
- Layout and list:
  - use `.app-page`, `.app-card`, `.app-header`, `.filter-grid`, `.table-wrapper`, `.mobile-paginator`
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
  - every searchable FK form field offers quick-create per `FK Quick-Create Baseline (Current)`
    (registry entry, `quickCreateFor(...)`, or `quickCreate: false` with a documented reason); a
    new resource referenced by other forms is registered in `QUICK_CREATE_REGISTRY`
- Styling and responsiveness:
  - use `span.status-pill.status-chip.state-chip` with Activity Log palette classes (`chip-success`, `chip-running`, `chip-queued`, `chip-failed`, `chip-skipped`) plus `is-active`/`is-inactive`
  - do not use `::ng-deep` for table column alignment; use local classes on `th/td` (for example: `.status-col`, `.actions-col-cell`)
  - table list styling must follow the CRUD baseline: `.app-card` radius `1rem`, 4-column desktop `.filter-grid`, right-aligned `.filter-actions`, equal-width short action buttons, table header background, cell borders, row hover, and fixed status/actions widths
  - form grids must follow `4/3/2/1` (`desktop`, `<=1400`, `<=1200`, `<=900`)
  - on `<=900`, span classes collapse to 1 column
- Validation:
  - must pass `npm run check:crud -- <component-folder-or-html>` for every CRUD page touched
  - must pass `npm run check:crud:i18n -- <component-folder-or-html>` for every CRUD page touched
  - must pass `npm run check:crud:fk -- <component-folder-or-html>` for every CRUD page touched
  - the production build passes in the PR CI (locally run `npm run typecheck`; `npm run build` only
    in the cases of the workspace `docs/delivery-pipeline.md` → section 1)
  - delivery must explicitly list each changed file and confirm checklist compliance, including
    translation coverage for all new/changed visible strings in `en-US`, `pt-BR`, and `es-ES`

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
  that the root page uses the global hooks (`.app-page`, `.app-card`, `.app-header`,
  `.header-actions`, `.filter-grid`, `.filter-actions`), that `filter-actions` is inside
  `filter-grid`, and that filter buttons use `filter_alt`/`backspace`.
- The layout validator also blocks component-local SCSS definitions for shared CRUD layout hooks:
  `.app-page`, `.app-card`, `.app-header`, `.header-actions`, `.filter-grid`, and
  `.filter-actions`. If one of those needs a reusable adjustment, change `src/styles.scss`, not a
  page component.
- `npm run check:crud:fk -- <path>` (or `-- --all`) enforces `FK Quick-Create Baseline (Current)`
  and validates that every registry entry loads a configurable CRUD page. `verify:changed` (CI)
  runs it with `--all`, so any FK field anywhere without quick-create blocks the merge.
- CI runs `npm run check:crud:layout -- --changed <base> HEAD` before build so newly touched CRUD
  pages cannot drift from the global layout baseline.
- `npm run check:crud:inventory` runs app-wide in `verify:changed` (CI). Any CRUD/list page that
  does not extend `ConfigurableCrudPageBase` blocks the merge; passing the per-page validators
  alone never proves a page uses the generic template.

## Non-negotiables (Blockers)

- Consider task incomplete if any one of these occurs:
  - input density differs from baseline
  - dialog size/position ignores viewport rules
  - CRUD kept inline instead of dialog
  - missing `Apply/Clear`, `Refresh/New`, or loading overlay
  - `Apply/Clear` order or placement differs from baseline
  - `confirm()` browser dialog used instead of `SlowConfirmDialogComponent`
  - a searchable FK form field without quick-create and without a documented exemption
  - any list of rows rendered without the global table (`<table>`, `mat-table`, page-local
    paginator, custom list markup); `npm run check:tables` must pass

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

- Conditional/repeated `suffixButtons` must be wrapped in a single `matIconSuffix` element
  outside their loop. The shared `.crud-field-suffix-actions` keeps them on one line. Do not
  rely on suffix directives nested inside loops to project into Material’s suffix slot: they
  can render inside the input area and increase the control height. Preserve action visibility,
  disabled state and the standard password generate/reveal controls.

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
- CRUD create/edit dialogs must use the generic `crud-form-dialog` panel class unless the component has a documented, resource-specific surface requirement.
- A resource-specific panel class or dialog root class is considered layout drift when it only repeats generic CRUD surface, density, footer, tab scrolling, or mobile viewport rules.
- CRUD-specific features must be derived from the resource requirements:
  - tabs only when the form has distinct groups of fields
  - authentication credentials and registration identity fields (`username`, `password`,
    `from domain`, `register`, tokens, or equivalent) belong in an `Authentication` tab when they
    would otherwise mix with routing, network, or record identity fields
  - routing or selection criteria fields belong in a `Match` tab when they decide which rule,
    destination, tenant, policy, or pipe applies; domain matching must be optional and must not be
    the only supported routing criterion for telecom/SBC resources
  - every select is a searchable select (see `Searchable Select Baseline (Current)`); FK selects
    also offer quick-create (see `FK Quick-Create Baseline (Current)`)
  - shared inputs such as phone fields should use existing shared components when available
  - maps, copy flows, and auxiliary sections are optional resource features, not global CRUD requirements
- Visual validation must confirm that the dialog opens as a dialog overlay with visible content, not as an inline form or collapsed top band.
- Visual validation must confirm the dialog content fills the available horizontal space without large empty gutters while still preserving visible horizontal margin from the dialog edges on desktop and mobile.
- Visual validation must confirm responsive field layouts preserve the same declaration order inside
  each tab across every breakpoint and device; only the column span/count changes.

## Styling Baseline (Current)

- Global theme variables are in `src/styles.scss`.
- The reusable CRUD visual baseline is global and must live in `src/styles.scss`.
- New/refactored CRUD components must use the baseline classes instead of duplicating the common layout SCSS locally.
- Component SCSS should be limited to resource-specific details such as unusual column widths, custom visual widgets, or domain-specific helper classes.
- Normal CRUD dialogs must rely on `crud-form-dialog` + `.crud-dialog`; do not create `.cdk-overlay-pane.<resource>-form-dialog` or `.<resource>-dialog` selectors for shared dialog behavior.
- Layout classes styled globally across CRUD pages:
  - `.app-page`, `.app-card`, `.filter-grid`, `.form-grid`, `.table-wrapper`, `.mobile-paginator`
- Shared global CRUD classes also include:
  - `.app-header`, `.header-actions`, `.filter-actions`, `.table-loading`, `.selection-count`, `.actions-col`, `.actions-col-cell`, `.status-col`, `.status-pill`, `.status-chip`, `.state-chip`, `.crud-dialog`, `.dialog-header`, `.dialog-content`, `.form-tabs`, `.tab-content`, `.form-actions`, `.primary-actions`, `.secondary-actions`, `.save-split-action`, `.span-2`, `.span-3`, `.span-4`
- Shared global dashboard classes include:
  - `.dashboard-page`, `.dashboard-shell`, `.dashboard-grid`, `.dashboard-metric`,
    `.dashboard-metric-label`, `.dashboard-metric-value`, and `.dashboard-metric-hint`
- Shared CRUD action button sizing:
  - `--crud-action-button-width` is the global fixed width for short header/filter action buttons.
  - `.header-actions button` and regular `.filter-actions-end button` use this width by default on desktop and mobile. Contextual buttons in `.filter-actions-start` may use their intrinsic width.
  - Longer contextual filter actions, such as `Delete selected`, must override to `width: auto` while keeping the same minimum width.
- Input density is mandatory and must follow compact baseline in `styles.scss`:
  - page forms (`.app-page mat-form-field`) and dialog forms (`.cdk-overlay-pane.<panelClass> .crud-dialog mat-form-field`)
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
  - center the status text horizontally and vertically inside the chip
  - do not style column alignment using `::ng-deep .mat-column-status`; use local classes on `th/td` (example: `.status-col`) to avoid style leakage between pages
- Form grid breakpoints in current baseline:
  - desktop: 4 columns
  - `<=1400px`: 3 columns
  - `<=1200px`: 2 columns
  - `<=900px`: 1 column
- On mobile (`<=900px`), span classes should collapse to 1 column.
- Responsive breakpoints must preserve the exact declaration order of fields within each tab.
  Do not use CSS `order`, breakpoint-specific field blocks, or alternative arrays that reorder
  fields on tablet, mobile, ultrawide, or any intermediate viewport. A field sequence such as
  `Status`, `Document`, `Name`, `Legal name`, `Email`, `Phone` on desktop must read in that same
  sequence at every responsive size; only the number of columns and field spans may change.
- Filter grid baseline:
  - desktop: 4 equal columns, each filter control explicitly declaring `span-1` and occupying 1
    column.
  - mobile (`<=900px`): 1 column.
  - `filter-actions` is the only full-row element inside `.filter-grid`.
  - Do not add component-local filter width overrides; update `src/styles.scss` if the reusable
    filter baseline needs to evolve.
- Dialog CRUD form grids must follow the same breakpoint rule (`4/3/2/1`) and span behavior (`.span-2/.span-3/.span-4`) as page forms.
- When a dialog row intentionally leaves columns empty, use the shared field config `breakBefore: true`
  on the next field instead of adding invisible spacer controls or local CSS.
  `breakBefore` must collapse with the same responsive span rules as normal fields, so it never
  changes the declared field order or leaks a wider span into smaller breakpoints.
- Dialog form density/layout standard (mandatory):
  - vertical spacing: use compact form rows (`.form-grid { gap: 0.5rem 0.75rem; margin-bottom: 0.35rem; }`)
  - tab content top spacing: keep compact (`.tab-content { padding-top: 0.65rem; }`)
  - form fields and custom field components must fill their grid track and keep `min-width: 0`
  - tab content must scroll inside the tab body wrapper, not by expanding the dialog past its viewport
  - mobile CRUD dialogs keep the 12px viewport inset from `openCrudTemplateDialog` instead of forcing edge-to-edge `100vw`
  - avoid `Name` or `Street` full-width by default when 4-column grid is available; use `span-2` unless business context requires full row.
- Notes/anotações rule:
  - whenever a CRUD dialog has a free-text annotation field, the canonical technical name is `Notes`.
  - use `notes` in frontend form keys, API payloads, DTOs, and response fields; use `<TablePrefix>Notes` in database columns when the value is a free-text operational observation.
  - keep `Description` only for business descriptions that are part of the resource identity, commercial meaning, or public/API documentation text, not for operational observations.
  - render notes fields in their own `mat-tab label="Notes"`; the PT-BR translation for `Notes` is `Anotações`.
  - do not place notes fields in `Record`, `Config`, `Pricing`, `Provision`, or other mixed-purpose tabs.
  - the notes field must use a full-row textarea (`mat-form-field.span-4`) with `rows: 4` inside that tab unless a documented exception exists.
- Input distribution baseline for partner forms (`carrier`, `supplier`, `reseller`, `complex`).
  Superseded by "Unified Registry forms" below where they differ; kept for the tab/notes rules:
  - Record tab desktop row pattern for resources with `Type`/`Company` and no
    `Alias/Nickname` (`carrier`, `supplier`, `reseller`):
    - row 1: `Status`, `Type/Company selector`, `Document`
    - row 2: `Name (span-2)`, `Email`, `Phone`
  - Record tab desktop row pattern for resources without `Type`:
    - row 1: `Status`, `Document`, `Alias/Nickname`
    - row 2: `Name (span-2)`, `Email`, `Phone`
  - Notes tab:
    - `Notes (span-4, rows-4)`
  - Addresses tab desktop row pattern:
    - row 1: `Zip`, `Street`, `Number`, `District`
    - row 2: `Complement`, `City`, `State`, `Country`
  - Customer address groups (`Main`, `Billing`, `Installation`) must repeat the same order inside
    the address tab:
    - row 1: `<Group> Zip`, `<Group> Street`, `<Group> Number`, `<Group> District`
    - row 2: `<Group> Complement`, `<Group> City`, `<Group> State`, `<Group> Country`
  - Address forms must keep the same declared field order at every responsive breakpoint. The
    responsive grid may collapse columns, but it must not reorder address fields differently on
    desktop, tablet, or mobile.
- CEP/Postal code UX baseline (mandatory when address has `Zip`):
  - `Zip` input must have a suffix search icon button (`matSuffix`) and also support `Enter` key.
  - shared CRUD forms must enable this through field config `postalLookup` instead of custom
    component-local postal lookup code.
  - trigger `GET postal-codes/:postalCode` through `ApiService`.
  - on success, autofill `Street`, `District`, `Complement` when returned by the provider,
    `City`, `State`.
  - after autofill, focus `Number` field automatically.

## API Access

- Use `ApiService` from `src/app/services/api.service.ts`.
- Use relative endpoints (example: `registry/customers`).

## Maps (MapLibre)

- Maps render with MapLibre GL (`maplibre-gl`); `mapbox-gl` is not used. The base map comes from
  the API (`GET infragis/map/config`, master edits it in System › InfraGIS › Base map) and goes through
  the MapProvider boundary `src/app/pages/infragis/map/map-base.ts`: `style` (MapLibre style URL),
  `pmtiles` (own PMTiles file, Protomaps light flavor, `pmtiles://` protocol), `mapbox` (https style;
  the public token resolved by the API is appended only to `api.mapbox.com` requests) or `none`.
- Asset overlays are GeoJSON sources fed by the API per viewport; drawing and vertex editing use
  Terra Draw (`terra-draw` + `terra-draw-maplibre-gl-adapter`). New records open the canonical CRUD
  form through `openQuickCreate` with the drawn geometry; never a page-local create dialog.
- The App host nginx (`scripts/install-nginx-runtime.sh`) serves `.mjs` as `application/javascript`: the
  MapLibre module worker is refused under `nosniff` when served as `application/octet-stream`.
- Other modules that show points on a map reuse the same boundary (`infraGisMapBase` +
  `ensureMapLibreAssets` from `map-base.ts`), never a new map library or tile provider. HR ›
  Punches (`pages/hr/time-punches/punch-map-dialog.ts`) reads `infragis/map/config` silently and
  draws the punch locations over a plain background when the user cannot read it; it shows only
  rows the list already returned.
- A CRUD list opened with `?search=<text>` starts already searched (links from maps and other pages).
- InfraGIS › Import/export (`src/app/pages/infragis/transfer`) reads files in the browser
  (`import-parsers.ts`: GeoJSON, KML and KMZ through `@tmcw/togeojson` + `fflate` (KML parsed by
  `@xmldom/xmldom` into a detached document, never the page `DOMParser`), CSV with
  latitude/longitude, WKT or GeoJSON columns, zipped Shapefile through `shpjs`, reprojected from the
  `.prj`; geometries leave two-dimensional), maps the columns (name, external ID, layer/type/status
  codes, the rest as properties coerced by the asset type schema) and sends batches of at most 500 rows
  / ~3 MB to `infragis/imports/:uuid/rows`. Parsers are lazy imports, so the libraries load only on
  that page. Exports download `infragis/export?format=…` (built by the API).
- Asset types carry a properties schema (JSON Schema subset); the asset form shows its fields in the
  Properties help and can fill the required ones (`src/app/pages/infragis/infragis-properties.ts`).
  System › InfraGIS › Vertical packages edits the platform packages a project applies by copy.
- InfraGIS › Network (`src/app/pages/infragis/network`, opened from the map with `?asset=`): ports
  (fibers with tube and ABNT colors, customer ports, splitter presets with typical loss), connections
  (fusion/connector/patch/drop), relations, a printable SVG splice diagram (`network-model.ts`, print
  CSS keeps only the diagram, the browser saves it as PDF) and the trace with power budget from the API.
  The map colors boxes by customer port occupancy and has a feasibility tool (radius around a click).
- Network › Platform links the asset to the ISP POP/OLT and a customer port to the customer and the
  authentication access; Network › Outage impact simulates a failure (asset or port) and opens the
  canonical support ticket form prefilled (`openQuickCreate` of `SupportTicketsPage`). The map shows
  outage alerts (boxes whose accesses dropped together), refreshed every minute while on.
- InfraGIS › Assets row actions (`management/asset-field.ts`): Photos and documents (upload through
  `createUpload` with kind and caption, open through `openPrivateFile`, delete) and History (read-only
  who/when/what changed, `historySummary` prints `{field: {from, to}}`).
- Work orders (`src/app/pages/workorders/orders.ts`, `/workorders` and `/workorders/mine`,
  entitlement `module.workorders.*`): generic CRUD with links (technician from `workorders/assignees`,
  InfraGIS asset, customer, support ticket), place and dates; row actions Change status (only the
  moves `allowedTransitions` offers; the API decides), Add note and Timeline.
  `workOrderQuickForm` creates an order from an InfraGIS asset or a tenant support ticket (row action).
- InfraGIS utility pages (`src/app/pages/infragis/utilities/utilities.ts`, route data `resource`):
  Public lighting (read-only summary), Pole attachments, Pole prices and Pole invoices (row actions Add
  invoice lines, parsed from pasted text by `parseInvoiceLines`, and Reconciliation). Import/export
  offers the sanitation network cadastre CSV (`infragis/sanitation/export`).
- Outage actions: Network › Outage impact opens "Notify customers" and "Credit contracts" (the
  `outage-notices`/`outage-credits` utility pages through `openQuickCreate`, prefilled with the failed
  asset or port); the pages list the notices (recipients per customer) and the credits. Work orders
  have Materials (Stock product, location, quantity; return to stock) and "Issue materials from stock".

## Auth/Guards

- Tenant routes use `environmentGuard`.
- Platform routes use `permissionGuard` with `data.permission`; `platform.master.access` is the
  root platform permission and is not sourced from `UserAccess`.
- Tenant routes require an active environment stored as a real UUID in `mc_current_env` or in the
  authenticated user state. Do not treat empty strings, `null`, `undefined`, or any non-UUID value
  as a selected tenant.
- `ApiService` must send `X-Environment-UUID` only when the selected environment is a valid UUID.
  If no valid tenant is selected, tenant-scoped calls must be blocked in the browser before the API
  request is sent.
- Menu items must declare or inherit one explicit navigation scope: `public`, `tenant`, `master`,
  or `both`. Do not infer global access from the user role alone.
- Users with `platform.master.access` have an explicit context mode: `master` for global
  `/system/...` routes and `tenant` for tenant routes using the selected `EnvironmentUUID`. Master
  context mode must not fall through to tenant routes when a `masterRoute` is missing.
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
- CRUD TypeScript feedback/confirmation text must use `TranslocoService` (or the shared app i18n
  service) and must be checked by `npm run check:crud:i18n -- <component-folder-or-html>`.

## Read-only metrics dashboards

- Read-only monitoring uses the dashboard baseline (`app-page dashboard-page`,
  `app-card dashboard-shell`, `app-header`, `header-actions`), not a create/edit CRUD.
  Do not add New/Save/Delete/bulk actions or artificial Search/Status filters to a
  read-only summary whose API does not support those mutations or filters.
- Header display modes may offer Cards, List and Compact as icon buttons with
  translated tooltips, accessible labels and `aria-pressed`. The shared
  `dashboard-view-switch` owns their styling; preferences may store only the mode,
  never telemetry/customer data. All modes retain the same server pagination.
- List mode is the read-only global table (`mns-global-table`, `pagination: false` because the
  page keeps the shared server paginator): identity plus UUID, status chips,
  sortable data columns and icon-only actions. If sorting is limited to the current
  server page, label that scope explicitly. Do not present local sorting/filtering as
  a fleet-wide query. Cards and compact mode must retain freshness, metrics, network
  rates and the same Monitor action; detailed history stays available in every mode.
- `dashboard-metric dashboard-panel` is the shared compact chart/panel surface.
  `dashboard-grid-compact` is the denser dashboard grid. Do not repeat these generic
  grid/panel definitions in component SCSS.
- Read-only operation dialogs use `openCrudComponentDialog` with `crud-form-dialog`,
  `crud-dialog`, `dialog-header`, `dialog-content`, `read-panel-scroll`, and the fixed
  `mat-dialog-actions.form-actions` footer. Close is the secondary action; an optional
  full-page action occupies the primary group. No Save action is invented. Escape,
  viewport positioning, mobile 12px inset and responsive observer cleanup come from
  the shared dialog helper. Full-page navigation preserves resource/period selection.
- Use shared searchable-select adapters for Resource/Period with explicit span-1,
  shared refresh buttons with loading feedback, configured date/time formatting and
  translated labels/units. Keep a meaningful snapshot visible during reload, and
  guard resource.value() reads with hasValue() on error.
- Icon-only actions need translated tooltips and accessible names. Use icon names
  available in the loaded Material Icons font (for example show_chart for metrics),
  rather than names exclusive to a different Material Symbols family.

- Dynamic entity breadcrumb segments use `BreadcrumbLabelsService` with the exact
  segment URL. Register only names already loaded through the authorized page API;
  retain UUIDs in navigation. Page effects must unregister on cleanup/destroy, and
  dialogs must not override the underlying page breadcrumb. Labels are in memory
  only and rendered as text; unavailable names retain the normal segment fallback.

- The Monitoring Dashboard is refresh-only: no search form or Apply/Clear actions.
  Keep its operational summaries and the sortable/paginated recent activity read-only global
  table (`mns-global-table`).
  Guard resource values with hasValue(); a derived linkedSignal may retain the last
  successful snapshot on refresh errors. Initial failures must show an error rather
  than healthy zero counters. Label retained data and unavailable optional counts.
  Dashboard HTTP reads use a bounded timeout (30 seconds) so users can retry via
  the shared refresh button; do not add automatic retry storms.

## Detail and settings pages

Use `DetailPageComponent` (`mns-detail-page`) for a focused read-only resource view,
and `SettingsPageComponent` (`mns-settings-page`) for singleton configuration forms.
Both instantiate `PageShellComponent`; changes to its header, spacing and content
structure propagate to both consumers. Scaffolds in `templates/detail-page` and
`templates/settings-page` are starting examples, not independent shell implementations.

- Detail pages have Refresh and contextual selectors/sections; no Save/Cancel footer.
  Agent telemetry full-page uses this template; modal telemetry retains the generic dialog.
- Settings pages own a shared Cancel/Save footer. Callers provide loading, saving, dirty,
  valid and feedback state, and handle refresh/save/cancel events. No Save-and-new exists.
  Refresh is disabled while dirty/saving; fields and actions are locked while loading/saving.
  Cancel restores the confirmed baseline. Domain validation and API permissions stay in the page/API.
- Headings accept translated title/description; raw entity identity is rendered as text.
  Use authorized names in breadcrumbs, preserving UUID routes.
- Shared styles live in `src/styles/_content-page.scss` and reuse the existing app shell,
  form controls, theme tokens and grids. Do not use `crud-dialog` to style an inline page.
  Do not redefine shared grids, tabs or action footers in page-local SCSS.
- The normal page owns vertical scrolling. Wide tables may scroll horizontally inside their
  own container. Content/footer spacing must remain visible at desktop and mobile widths.
- Preserve existing API scope, fields, tabs, masking and submission behavior when adopting
  these templates. Schema/API changes and production deployment are separate scopes.
- Validate both consumers at desktop/mobile widths, translated labels and light/dark themes;
  verify no detail edit footer, settings dirty/cancel/save/refresh behavior and unchanged dialog.

## Supported Hosting DNS platforms

Create/edit and platform filters expose the platforms of the authorized API catalog: cPanel
DNSOnly (`cpanel_dnsonly`), Amazon Route 53 (`route53`) and the managed MNSCloud DNS
(`mnscloud_dns`, not editable as a provider credential). The bounded fallback catalog contains the
same options. Unsupported values from an older API must not
reappear in dropdowns. cPanel is the explicit initial form selection; API/DB validate the
submitted platform. Preserve scope, required credentials and connection tests.

### DNSOnly live zone records

The Domains row action opens the DNS records CRUD using the shared configurable template.
It uses shared styles only. Static DNS record-type options remain protocol literals; labels,
confirmations and validation text use the PT/EN/ES dictionaries. Search precedes any filters;
live DNS records have no active/inactive flag, so this resource has no Status filter.
Every data column is sortable and the shared paginator applies to the complete bounded snapshot.
Create/edit use the generic MatDialog and shared desktop/mobile save controls.

The shared configurable CRUD supports `canEditRow` alongside `canDeleteRow`. DNS uses these
hooks to hide mutation actions on SOA, apex NS and unsupported provider-managed types. This is
UX only; the API enforces protection. Form submissions retain their original snapshot serial;
refresh cannot silently change the version being edited. Delete carries the row's serial.
Do not turn a stale-record failure into an automatic retry with a new version.

A DNS zone is public or private according to its dedicated server network. The UI must never
claim that a label or private record address makes a public zone private. The distinct zone
removal action uses SlowConfirmDialog and explicitly includes ALL external records. Normal
registration archival retains the server zone. Provider credentials and arbitrary WHM commands
never enter the browser contract.

## Route 53 provider credential form

The DNS provider shared CRUD renders only AWS access key ID and secret access key for
Route 53. No region, hosted zone ID or provider TTL belongs in its credential tab. Keep
the local fallback aligned with the API catalog. DNSOnly fields keep their provider-specific
behavior. Empty secrets on edit preserve saved credentials through the API contract.
The read-only connectivity test can succeed with no hosted zones and does not verify writes.

DNS providers and domains do not expose blueprint/template selection. DNS record actions
belong to the domain; provider-generated initial records are read from the provider.

Domain DNS settings expose Zone IP followed by Default TTL. Provider zone IDs are assigned
by provisioning, never entered in the registration form or its create/update payload.
Existing provider-zone imports belong to a future dedicated workflow.

Verified DNSOnly and Route 53 domains expose the same Records and Delete DNS zone actions.
The shared record page preserves the opaque snapshot revision without numeric coercion:
DNSOnly uses a numeric SOA serial; Route 53 uses a string revision. Advanced Route 53 rows
remain visible with mutation actions suppressed by `editable`. These controls preserve the
existing shared table, filter, dialog, paginator and responsive action contracts.

Nested configurable CRUD pages may override `backLink()` with an explicit parent URL. The
shared header renders the translated Back action using existing button styles. Do not use
browser history for a parent action: direct links and reloads must work identically.
Only the DNS records management page overrides this parent link. Back returns directly to
the domains list; the list must never show Back or open a form automatically. Domain UUID
breadcrumb URLs redirect to that same list in tenant and System contexts, including older
bookmarks. Editing a domain requires an explicit Edit action. Record child URLs are built
from the domains collection path to avoid duplicating the UUID.

## Secret value management

Secret Accounts and Secrets inherit the configurable CRUD template. Customer on a Secret Account
is optional. The account Record tab contains Status, Server, Customer and Name (one column each).
Annotations belong to the Notes tab (full-width textarea, four rows). Account identification uses
its UUID; secret types belong to individual secrets. Do not offer account key, default type or a
separate description. Account annotations support 1024 characters. Storage paths and ownership are server-managed; the UI must not offer these fields.
A stored version of zero represents metadata without a verified secret value.

Secret values use the shared `SecretValueDialogComponent`, opened through `openCrudComponentDialog`
with `crud-form-dialog`, fixed shared header/content/footer and one existing-record Save action.
The dialog retains its idempotency UUID across a retry of unchanged content and clears sensitive
state when closed/destroyed. No localStorage/sessionStorage persistence is allowed. Explicit reveal
uses the shared Data Viewer, no copy/download controls, closes after 30 seconds and clears its data.
The owning page closes these dialogs on navigation. Tenant reveal is a distinct permission.

Queued writes/deletes use the shared operation status chips. Failed deletions remain visible until
confirmed remotely and expose retry; they cannot be edited as active secrets. Secrets intentionally
disable bulk delete: each deletion confirms a separately observed value version and durable intent.
This exception does not remove bulk delete from ordinary metadata resources. New UI strings must be
translated in all three runtime dictionaries, with no local overrides of shared layout hooks.

### Structured secret content

Secrets use the generic CRUD dialog with Record, Content and Notes tabs. Record
holds ownership, name, status and managerial validity. Content holds the type and
shared `secret-content` field; the type selects its schema. Shared form-grid,
Material controls, actions and responsive dialog sizing remain authoritative.
The editor uses `contentTypeKey` to select the discriminator field.

Editing defaults to keeping stored content and never requests a reveal. Explicit
replacement starts with blank fields. Close/destroy clears sensitive form state.
Queued resources may override `reflectSavedRecord` to avoid optimistic list updates;
secret content must never be reflected into list caches. Save accepts a durable
operation and the list shows its status until confirmation. Validity is managerial,
not automatic rotation or remote revocation. All labels use PT/EN/ES dictionaries.

## Asynchronous business operations

Queue-backed mutations return an accepted operation, not a completed provider action. Use
`AsyncOperationsService` with snackbars for immediate feedback and the shell Activity Center
(`mns-async-operation-activity` in `main-layout` topbar) for in-flight and attention status. Do not
mount per-page chip strips or build local polling loops; do not announce success from the mutation
HTTP response alone. Keep shared activity styles in `styles/_operations.scss`.

The service follows the owned `/user/operations` endpoints, bounds polling, and resumes only
non-terminal plus `blocked`/`failed` (recheckable) operations when the shell opens. Succeeded items
are cleared from the panel after a short retention window; badge count is in-flight + attention only.
Never resubmit a mutation because polling failed. `ApiService` retains a request key after an
uncertain HTTP response. Tenant/session changes clear local operation state.

Each Activity Center item names the work, never only an identifier: `<kind> · <action>` from the
API `kind`/`action` fields (PT/EN/ES `operations.kind.*` and `operations.action.*` keys, with a
humanized fallback for an action not yet translated), the target `resourceLabel` when present, and
the short id plus acceptance time for support (full UUID in the tooltip). Acceptance and recheck
receipts carry no identity, so the service keeps what the last status read reported. Activity log
writes (`kind = activityLog`) are request side effects and are never resumed into the panel.

The server advertises `canRecheck` for supported readback. The Activity Center action requests
verification; it does not force a provider retry or invent completion. Backend permissions and
immutable intent remain authoritative. Render states and safe error labels through PT/EN/ES
translations. DNS reads use cached observations; disable editing while the observation is pending or
blocked, and require a fresh revision before submitting another change. Preserve the existing
CRUD/dialog templates and soft-delete semantics. No recovery/billing interface is introduced.
The deprecated `showAsyncOperationStatus` Configurable CRUD flag is ignored.

## Hosting / Webhost scope

- Providers and Plans are Master-only administrative pages.
- Dashboard exists in both Master and tenant contexts.
- Hosts, Emails, Databases (including users and grants), Mailing Lists and Zone Editor
  are tenant-only pages. Master users must switch to a selected tenant to use them.
- Operational pages always call `hosting/webhost/...`; do not recreate System route aliases.
- Host plan selection uses the read-only tenant catalog at `hosting/webhost/plans`.
  Catalog administration remains in System; do not send provider settings to tenants.
- Situation remains an automatic list column, never an editable CRUD field.

## CRUD creation and validation coverage

The canonical scaffold is configuration-only (`scripts/create-crud.mjs`). No standalone
CRUD page HTML/SCSS template is maintained. New/changed legacy CRUDs must fail CI even
when they do not inherit the generic base; explicit validation with zero recognized
components is an error. Dashboard/detail/settings pages keep their own shared contracts.

Declarative row actions may open a child `collection` configuration, recursively, or a
single-operation `form` configuration. Both reuse the shared renderer and dialog sizing.
Parent identity is captured in endpoints, and API/DB still enforce ownership/permissions.
Use collection actions for nested configurations such as plan/rate/volume-tier management.
One-shot financial operations expose only their allowed action, never arbitrary create/delete.

## Shared navigation and paginated relationship fields

Material paginator labels and ranges use the shared Transloco-backed MatPaginatorIntl;
all languages react without reload. Breadcrumb segment labels and route title segments use
runtime translations, preserving authorized entity names and UUID URLs. CI checks every menu
label, paginator keys and tuple-driven credential labels against all three dictionaries.

Configurable fields may declare `remoteLookup` with endpoint, uuidField, labelField and optional
selectedLabelField/searchParam. The shared searchable select owns server search and explicit
previous/next pages (50 options per page), loading/error state, and clearing search on close.
The current selection remains identifiable outside the current page. Do not preload unlimited
foreign-key datasets or silently filter just the first backend window. API remains authoritative.

Lists with paginated endpoints must set `serverSidePagination`. Only the canonical items/total/
limit/offset envelope is accepted. Parent-specific nested collections retain the same renderer.
Per-record lifecycle guards use canEditRow/canDeleteRow; server enforcement remains mandatory.

A CRUD with `defaultCurrencyScope` resolves its default from that explicit master/tenant
Parameter endpoint before enabling creation. Missing/invalid configuration is an error; it must
not silently become BRL. Currency is never inferred from the browser's language.

## Contextual field help (global)

Global styles live in `src/styles/_field-help.scss`; `FieldHelpComponent` owns the
accessible interaction. Do not add page-local sizing, positioning, color, or tooltip CSS.
All generic CRUD forms use this contract by default, including collection dialogs,
address fields and the create/edit dialogs of related collections. No per-page opt-in is required.

- `help: 'Translation key'` provides supplementary guidance inside the field outline.
- `helpWhen: ({ editing, values }) => 'Translation key'` supplies conditional guidance.
  An empty result hides the help button; it does not fall back to the static text.
  Related-collection guidance uses the child form values, never the parent form values.
- Related columns should display a name returned by the child list (for example `BprName`)
  instead of relying on a parent lookup that can miss and show the UUID.
- Use `matIconSuffix` on Material fields and the shared `help` input on searchable
  relation fields. Native file controls place help inside their existing outline;
  the selected filename remains visible as operational state.
- Keep the full control width and `--form-control-height` (40px baseline), independently
  of select arrows, password toggles and quick-create actions. Never place help in an
  external grid column or over the field value. Multiline/upload controls retain their
  existing heights.
- Hand-written settings/Parameters pages and other non-CRUD forms use the same component:
  import `FieldHelpComponent` and place `<mns-field-help matIconSuffix [label] [text]>` inside
  the `mat-form-field`. `<mat-hint>` below a field and explanatory `placeholder` text are not
  help surfaces; `npm run check:field-help` (run by CI) rejects `<mat-hint>`.
- Do not reintroduce detached field-hint paragraphs or tab-level help notices. Put field
  prerequisites into the relevant help text. Validation errors, loading/provisioning
  states and resource-level safety confirmations remain visible in their own components.
- Text is escaped Angular interpolation; do not accept arbitrary HTML. Translate help,
  titles and accessible labels in PT/EN/ES. The i18n validator checks static `help` keys.
- Hover/focus shows a short tooltip; click, Enter/Space or touch opens persistent help.
  Escape/backdrop/close dismisses it and returns focus without closing the CRUD dialog.
  Help must remain available on disabled fields and fit mobile viewports.
- Both surfaces must be opaque, with text contrast at least 4.5:1, border, padding and
  shadow. Include the Material tooltip theme in the global theme mixin. Test computed
  opacity and contrast, not only tooltip existence.
- Verify dark/light, desktop/mobile, keyboard, all languages, conditional guidance,
  unchanged values/payloads and normal create/edit behavior when adding new consumers.

## Tenant authorization context and failed CRUD reads

Tenant-scoped membership and permission calls under `user/access` and `user/permissions`
carry the selected `X-Environment-UUID`; `user/me` also receives the selected tenant so its
permission projection matches the screen. Platform permission calls and public invitation
accept/validate calls remain independent of that selection. On tenant switch, discard the
previous permission projection and reload it before enabling navigation.

Member invitation choices come from `user/access/roles`, with no hardcoded fallback. The
server filters assignable profiles. Editing member roles requires `tenant.permissions.manage`;
membership/invitation management requires `tenant.access.manage`.

The configurable CRUD renderer must guard resource reads with `hasValue()`, show a translated
load error separately from an empty result, and retain a usable Refresh action after failure.

The shared access-profile definition catalog is read-only for tenant administrators. Only
effective platform master authority enables create, edit, delete and duplicate actions. Tenant
administrators assign approved profiles through the tenant membership page. API/DB enforce
the same boundary independently of these UI controls.

### Remote relationship list filters

`ConfigurableCrudListFilter.remoteLookup` uses the same canonical API UUID/name mapping as form
relationships, with independent search and paging state. The shared searchable adapter requests
50 records at a time, uses the API total, and exposes loading/errors plus previous/next controls.
Selected UUIDs are forwarded to the list endpoint; filtering must remain server-side. Static
enum filters declare `translateOptions: true`. Form drafts and filter search state are independent.

## Independent CRM sales module

CRM lives under `crm/*` with its own `module.crm.*` navigation grant. Its accounts,
contacts, catalogs, leads, opportunities, activities, proposals and handoffs use
`ConfigurableCrudPageBase`; no other module is required. Industry and assignee
filters query the backend before pagination. All FK forms use canonical registry
quick-create; assignees intentionally use existing tenant memberships only.

The proposals page opens the canonical proposal-items CRUD in a collection dialog.
Drafts can be edited; sent versions expose lifecycle transitions and private
printable downloads. Qualified leads expose conversion, and pipeline settings
expose idempotent initialization. API/DB permissions and subscription checks remain
the authority. Dashboard counts come from the CRM summary endpoint, not local rows.

## Explicit master fields and FK scope

Master-aware resources use the guarded route's explicit `scope: 'master'` data to
select system endpoints and form configuration. Missing tenant selection does not imply
master scope. The API remains authoritative for effective permissions and FK ownership.
Reuse the canonical configurable CRUD and propagate route scope to FK quick-create;
never mount an unrelated tenant module or create a fake Registry customer to satisfy a field.

DNS master registers/zones omit the customer form, filter and column. Tenant forms retain
the required customer. `pages/hosting/dns/dns-scope.ts` composes the shared configuration
and remote searchable FK lookups; nested register/provider forms receive the same scope.
Do not validate relationships against a constructor-only first page of loaded options.
Use remote search/pagination and preserve selected quick-created records. Async operation
watchers must retain platform/tenant scope. These rules apply to desktop and mobile forms.

When expanding to another resource, document its API ownership contract and follow the
workspace `docs/platform-resource-ownership.md`; this DNS support is not an entitlement
or master bypass for unrelated tenant modules.

## CRM form baseline

CRM uses the shared configurable CRUD renderer for all fourteen resources and action forms.
Record fields start with Status and workflow/ownership controls, followed by Name (span-2),
related records and scheduling. Accounts keep City/State in Address. Activities, accounts and
handoffs use the canonical frontend `notes` key in a dedicated Notes tab (span-4, rows-4);
`source`/`payloadKey` map to the existing prefixed API fields without changing the wire contract.
Commercial descriptions, qualification needs, closure reasons and acceptance evidence retain
business-specific names. Their multiline controls use full rows, four lines, after the compact
controls; opportunity values and proposal conditions belong in Financial, not Notes.

CRM scheduling composes the shared locale-aware Material datepicker (`type: 'date'`, touch UI,
manual date mask) with the generic `type: 'time'` input. Each occupies one grid column. Both parts
are required together; only the resulting UTC instant is sent to the existing API timestamp field.
Date-only validity/forecast fields remain calendar dates. Date and time use browser-local input
semantics as before; displayed timestamps still use DateTimeFormatService and DEFAULT_TIMEZONE.

Shared form grids align controls at the start: a multiline neighbor must never stretch a date,
currency or text field. The generic Record renderer uses PhoneInputComponent for `type: 'phone'`.
Currency overrides are supported by CRM commercial records. Create defaults resolve through
SystemParameterService; existing record currency wins on edit. Amounts use `type: 'currency'`
and the record currency key. Proposal item dialogs inherit their parent proposal currency.

CRM currently exposes individual audited deletion, without a bulk API contract. Its explicit
bulk-delete exception keeps per-record confirmation until a canonical bulk endpoint is available;
it does not change the shared default for other modules.

Run `node --test scripts/tests/crm-form-contract.test.mjs` alongside the CRUD template, layout,
i18n, FK and inventory validators. Visually check create/edit, Notes, compact date/time controls,
monetary input and FK quick-create at desktop/mobile widths in PT/EN/ES.

### Hidden scope-derived form values

The configurable CRUD renderer initializes only configured fields. If a guarded route removes a
field, compute its required request value from the route context when building the payload; do not
read it back from `formValues()`. For master DNS PABX policy forms, availability is derived from the
master route. Keep the loaded comparison signature consistent with that effective value so unrelated
edits do not resend the policy. Normalize numeric API flags to boolean select values when loading.
The API remains responsible for authorization and scope validation.

### Authentication CRUD extensions

The shared configurable CRUD template supports `deletePayload(row)` for an optimistic revision
precondition. Resources that use it must publish that DELETE body in OpenAPI and cannot use bulk
delete without a per-record revision contract. Password and secret-content values preserve their
exact whitespace; an empty credential is normalized to null and the resource payload decides
whether omission means preserve. Never populate a write-only credential from a read response.

Canonical FK quick-create supports `initialValues` (a record or parent-context callback). Pass
only explicit related-resource context, such as the Authentication account, through the generic
host/session; do not copy the entire parent form or credentials. The referenced canonical page
still owns its fields, validation and submission. This context is a convenience, never authority:
API/DB ownership validation remains mandatory. The parent keeps its unsaved values and selects
the new option when the nested dialog completes.

Password fields may declare `generatedPasswordLength` when the API requires a specific credential
length. The shared generator uses Web Crypto with rejection sampling. Authentication access
passwords generate 20 characters and NAS shared secrets generate 32; field policy never replaces
server-side validation. Existing fields retain their configured/default length.

## Phone dock (PhoneWeb inside the App)

- `mns-phone-dock` lives in `main-layout` outside `<router-outlet>`, so the phone survives
  navigation. It frames PhoneWeb at `/phoneweb/?embed=app` (same origin) and is shown from the
  topbar phone button only when the tenant has `module.voip.phone.user` (never in master context).
- Never build a second softphone in Angular: pages call `PhoneDockService` (`dial(number)`,
  `answer()`, `hangup()`, `state()`, `callActive()`), which speaks Phone Bridge v1
  (`shared/phone-dock/phone-bridge.ts`; contract in `mnscloud-phoneweb/docs/phone-bridge.md`):
  exact origin and frame checks, versioned messages, no secret or token on the bridge.
- Sign-in uses a single-use App handoff code in the frame URL fragment; App sign-out sends
  `phone.signOut` before unloading the frame. One browser registers the lines once: the tab
  holding the Web Lock `mnscloud-phone-dock` owns the phone, other tabs show where it is and can
  take it over (refused during a call). Pop-out opens standalone PhoneWeb in its own window.
- Minimizing hides the panel without unloading the frame. While a tab holds the phone, the App
  update notice never reloads it on its own (`AppUpdateService.registerBusySource`).
- The edge must allow it: App `Permissions-Policy: microphone=(self)`, `/phoneweb/` CSP
  `frame-ancestors 'self'` with `microphone=(self)` (mnscloud-agent vhosts, mnscloud-nginx).
- Phone numbers in any table use `kind: 'phone'`: the shared base renders a Call button that
  dials through the dock (`PhoneDialer`, no other dependency) when the tenant has PhoneWeb. Never
  add page-local tel: links or call buttons. The dock records every call at `/voip/phone/calls`
  (VoIP › PhoneWeb › Chamadas, wrap-up there) and shows who is calling from the E.164 index.

## Themed access experience

- `shared/auth-shell` owns the responsive split/compact layout, brand panel, accessible links,
  language menu and form styles for sign-in, sign-up, password recovery/reset and email verification.
  Do not copy this shell or its SCSS into pages. Language changes preserve typed credentials.
- `PublicThemeContextService` supplies the host brand and API-resolved `LoginAppearance`. Missing
  configuration uses translated product defaults; a broken image never blocks access. The brand
  color drives the primary button, with a computed contrasting foreground; links have independent
  readable tones. Light/dark/system appearance is scoped to the access shell.
- Settings › Themes retains its `ConfigurableCrudPageBase` surface. Its App/Pulse/POS/PhoneWeb login tabs
  edit structured presentation and PT/EN/ES copy inside `BrandingConfig.login`. Empty Pulse/POS/PhoneWeb
  layout, appearance, HTTPS image and links inherit App; instructional copy stays product-specific.
  The POS brand tab is labelled `POS` in every language (`access.tabPos`), matching its login tab.
- The eye action beside the panel image URL previews unsaved values. The read-only preview has App/Pulse/POS/PhoneWeb,
  desktop/mobile, language and light/dark controls; it never submits credentials or saves a theme.
- Images in the panel use optional HTTPS URLs; logo/favicon continue using the existing upload
  contract. Public presentation never changes session policy, authentication methods or permissions.

### Contact-center routing profiles and contact notes

Routing profiles (`VoipPabxAgentProfile` / `VoipPabxAgentProfileQueue`) group queues, penalties and ACW seconds. A linked agent uses the profile's effective memberships; direct memberships are ignored while a profile is selected. The App provides the canonical profile CRUD and queue collection with FK quick-create. Queue selection is filtered by tenant and customer ownership in the database. Profile edits affect all linked agents on reconciliation.

Runtime queue snapshots carry only aggregate waiting count/longest wait, never caller identity. Counters become unavailable after 30 seconds without observation. SSE sends authoritative snapshots as well as durable transition IDs; PhoneWeb does not poll queue state. `VoipPabxAgentContact` records a runtime-authenticated agent participation, with optional disposition and spelling-preserving notes. Notes are limited to 4000 characters and revision-checked against the originating phone session.

Agent creation/enabling checks the active entitlement and passes its quota to the tenant-serialized configure routine, which counts enabled phone-linked agents. Standalone resource contracts without a package limit retain the billing system's unlimited quantity semantics. No prices or paid subscriptions are created by the schema seed. Revoked/expired sessions, disabled identities, lost line assignments and released/expired claims leave the routing set; hot-desk stations are cleared.
## Unified Registry forms

Customers, complexes, companies, suppliers, carriers and resellers use
`registryUnifiedConfig` on top of the shared configurable CRUD. Their identity layout is
Status / Country / Person type / Document type; Document / Legal or full name (two columns) /
Trade name; Display name (two columns) / opening or birth date. Display name is never silently
converted into a legal or trade name. Companies are business entities. Identity country and
address country are separate fields. An explicit same-country option controls copying from identity;
legacy missing countries remain missing when editing. Foreign regions accept text, and CEP lookup is Brazil-only.
The address grid uses Zip / Street (two columns) / Number, then Complement / District / City / State.

`contacts` is a shared form tab: general email/phone fields plus the `relatedCollections` global
table. Related collections can opt into server pagination, list filters and bulk deletion.
Sector selection uses a remote lookup and the canonical contact-sector quick-create page.
Each contact is saved independently; cancelling its parent form does not roll back saved contacts.
For a new parent, explicit **Save and continue** persists the record and loads its canonical detail
before enabling contacts. It retains the returned UUID even if detail refresh fails, preventing a
retry from creating another parent. There is no implicit parent autosave.

Dynamic field options/types use `optionsWhen` and `typeWhen` in the shared field renderer.
`formTabActions` exposes canonical related workflows in Fiscal/Limits/Contacts tabs without fake fields.
The Contacts action manages the same sector catalog used by quick-create. New links offer active
sectors; existing contacts can retain a sector that has since been deactivated.
Company Fiscal shows a read-only summary and opens the existing issuer profile and per-state
registrations with the company preselected. Fiscal API permissions/entitlements remain authoritative; Registry editing is independent.
Annotations retain `Notes` translated as **Anotações**, `notes` in payloads, a full-width textarea
and four rows. No observation field or new annotation-history model is introduced.

### Support submission readiness

Report a problem declares expected attachments before upload and explicitly finalizes submission.
Keep retry and continue-without-missing actions on the saved ticket; never open a duplicate ticket
for upload failures. My tickets offers completion for the creator of preparing/abandoned submissions.
The platform AI panel exposes evidence revisions, preparation timing, manifest and discarded analyses.
