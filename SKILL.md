# MNSCloud App Skill

Use this repository as an independent public frontend client for the MNSCloud API.

## Runtime API Contract

- Configure the API through `public/env.js`.
- Use `window.MNSCLOUD_APP_CONFIG.apiBaseUrl` for the API v1 base URL.
- Leave `apiBaseUrl` empty only when the app is served by the same origin as `/api/v1`.
- In edge-served environments, the browser may receive `/env.js` from `mnscloud-nginx` instead of
  the app node. Keep both app runtime and edge runtime `env.js` explicit and same-origin by default:
  `apiBaseUrl: ""`.
- Do not hardcode tenant domains, production API URLs, tokens, or private infrastructure details.

## Development Rules

- API calls must go through `src/app/services/api.service.ts`.
- Runtime URL resolution must stay in `src/app/shared/runtime/app-runtime-config.ts`.
- CRUD pages must follow `app.md`.
- CRUD list filters must use the canonical filter row from `app.md`: `Search` as the first
  explicit `span-1` control, `Status` present when the resource has a status field/column, no
  implicit widths or custom fractional widths, and `filter-actions` as the only full-row element.
- CRUD dialog primary record tabs must use the translated `Record` key (`[label]="'Record' | t`).
  Do not use `Data`, `Date`, or `Details` for CRUD record tabs.
- Searchable `mat-select` controls must use the global `select-search-option` and
  `select-search-field` layout from `src/styles.scss`; do not add page-local spacing overrides for
  those classes. The search field and its Material wrappers must keep the editable text cursor.
- Monetary CRUD inputs must follow the `app.md` system parameter defaults contract: resolve
  `DEFAULT_CURRENCY` with `SystemParameterService.resolveDefaultCurrency()`, initialize create forms
  from that value, let existing record currency win in edit mode, and normalize editable currency
  payloads to uppercase 3-letter codes. Do not hardcode `BRL`, `USD`, blank currency defaults, or
  locale-derived currency as the UI source of truth. Editable monetary amount fields must use
  `type="text"` with `appCurrencyMask`, not `type="number"`, so locale values such as `4.598,00`
  are accepted and converted to numeric API payloads.
- File uploads must use the shared upload progress helpers in `src/app/shared/upload/`.
- Browser-side permission checks are UX only; enforcement belongs to the API.

## Validation

Run before committing:

```bash
npm run build
```

Use `npm run check:crud` when changing CRUD templates or CRUD baseline behavior.

For bare-metal production runtime install/update, use the module-local latest-release helper:

```bash
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-latest-nginx-runtime.sh
```

It supports Debian 12/13 and RHEL/Rocky/AlmaLinux 9/10, resolves the latest approved release from
the MNSCloud release registry, downloads the prebuilt browser artifact, validates its SHA-256 and
referenced assets, deploys it to `/var/www/mnscloud-app`, writes runtime `env.js`, and creates
`/etc/nginx/conf.d/mnscloud-app.conf`. Runtime hosts do not install Node.js, npm, Angular CLI, or
run local Angular builds. The app runtime listens on `0.0.0.0:8080` by default so a separate
`mnscloud-nginx` edge host can reach it; use mnscloud-agent/cyber security network policies to
restrict access to the edge host, or use `APP_LISTEN_ADDR=127.0.0.1` for same-host edge
deployments. Do not manage nftables in this installer.

Fresh runtime hosts use the same helper after cloning the repository:

```bash
sudo install -d -m 0755 /opt/mnscloud
cd /opt/mnscloud
gh repo clone manaoscloud/mnscloud-app
cd /opt/mnscloud/mnscloud-app
sudo ./scripts/update-latest-nginx-runtime.sh
```

Use `sudo ./scripts/rollback-nginx-runtime.sh --ref <known-good-release-tag> --artifact-url <url>
--artifact-sha256 <sha256>` only for explicit emergency rollback to a known-good release artifact.

Production App releases are created by the repository `Auto Release` GitHub Actions workflow after
validated changes are committed and pushed to `main`. The workflow uses
`scripts/release-app.sh` as the canonical release engine. Do not mark a new App version as available
to operators until the matching release commit, Git tag, and GitHub Release exist on GitHub.
The runtime release cache `buildRef` must be the commit resolved by that immutable release tag; it
must not use the source SHA from `main`, because Agents report the installed release checkout.

## Contribution Governance

- External contributions must be submitted through Pull Requests.
- Follow `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, and this `SKILL.md` before proposing changes.
- Do not add secrets, customer data, private infrastructure details, production domains/IPs, or hidden bypass logic.
- MNSCloud may choose to pay, sponsor, contract, or hire contributors when work demonstrates strong value, but paid work requires explicit written agreement and is never implied by opening a Pull Request.
- Keep security-sensitive decisions, tenant scope, billing, authorization, routing ownership, and secret resolution in the MNSCloud API/control plane.

## Resource telemetry visualization

The Agent monitoring panel is available as a shared dialog and full page, with a
paginated fleet overview. API/DB enforce effective master authority or tenant Agent
read permission and persisted ownership; resource names are private scoped data.
Network counter deltas provide receive/send bits per second, packets per second,
errors/drops per second and optional Linux interface link state. Warmup, counter
reset, interface recreation and gaps over five minutes omit rates instead of
fabricating zero. The Linux collector reads fixed local commands only, excludes
loopback, and bounds discovery to 32 interfaces and 32 local filesystem mounts.
The first version adds resource observations on Linux; other platforms retain their
existing host CPU/memory/system-disk measurements and report no resource series.
Link capacity, active latency/loss probes, SNMP, disk I/O throughput and alert rules
are not implemented by this collector. Link state is optional when `ip` is missing
or the OS reports unknown. Filesystem observations are space usage, not block I/O.

Canonical SQL owns twelve resource metric seeds and four new procedures. Existing
production DBs apply the `agent-resource-metrics` scope via `scripts/update-schema.py`
from mnscloud-db, using reviewed plan/apply and backup. DB must precede API and Agent;
the App follows after endpoint validation. Catalog promotion never applies SQL.
There is no separate persistent migration definition.

Per-Agent active network/filesystem resources are capped at 64. New resource names
beyond the cap require administrator review; resources are not automatically deleted.
Ingestion is serialized on the Agent row and throttled to 30 seconds per resource.
History accepts only 1,24,168 hours, groups on read into approximately 120 buckets
per series and returns at most 2048 points for one owned resource. A seven-day filter
bounds reads. Cleanup remains bounded per resource on ingestion; disconnected
resources do not trigger cleanup. A global retention worker and persistent rollups
remain future work; do not claim unlimited scale or offline-resource cleanup.

Fleet pages contain at most 25 Agents; the App requests 12 in one SQL-backed request.
Latest host observations older than three minutes are visibly stale; samples older
than 15 minutes are omitted in the fleet view. Interface sums use recent observations
and may count traffic on both physical and virtual interfaces. Network/detail history
supports both directions on one scale, missing intervals stay gaps, and a measurement
table is available for accessibility. Read polling pauses in hidden tabs, stops on
component destruction and backs off after failures. No SSH or runtime jobs are sent
when opening a visualization. Raw measurements remain authoritative; displayed bucket
averages are not claimed as instantaneous values.
