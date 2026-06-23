# CRUD Page Template

This template follows `app.md` patterns for header, filter/search, table, bulk delete, and dialog CRUD layout.
Bulk delete is part of the default CRUD contract and must follow the `Bulk Delete Baseline (Current)` section in `app.md`.
`app.md` is the source of truth. Do not use an existing page component as the canonical reference.
For DB-backed resources, only edit SQL files in the repository. Do not apply schema/procedure scripts directly to the database unless the user explicitly requests that action.

Files:

- `page.ts`
- `page.html`
- `page.scss`

How to use:

1. Copy these files into your page folder.
2. Replace `Entity` types and API endpoints.
3. Keep the Angular 22 runtime baseline intact: default change detection, `inject()`,
   signal query APIs (`viewChild`/`viewChildren`), `DestroyRef`, shared dialog event helpers, native
   `animate.enter`/`animate.leave`, and the Transloco pipe. Do not add constructor injection,
   decorator queries (`@ViewChild`/`@ViewChildren`), component-local translation maps, or
   `@angular/animations` triggers. Do not inject `ChangeDetectorRef` or call `detectChanges()`;
   model page state with signals/resources instead.
4. Keep list/read state on Angular `resource()`. The default template uses `itemsResource`,
   `resource.reload()`, and a small `effect()` to synchronize `MatTableDataSource`; do not replace
   it with ad hoc `loadItems()`, parallel `loading/error/items` signals, or constructor lifecycle
   work.
   Router events, route data, and read-model events must use `toSignal()`/`resource()`/`effect()`,
   not scattered long-lived `.subscribe()` calls.
5. Keep mutations explicit in event handlers/service calls (`POST`, `PUT`, `DELETE`, uploads,
   queue/provision actions). Mutations may call `resource.reload()` after success, but must not be
   hidden inside a resource loader.
6. Use Signal Forms for new forms. CRUD dialogs must prefer shared adapters from
   `src/app/shared/forms/` (`mns-text-field`, `mns-textarea-field`, `mns-select-field`,
   `mns-status-select-field`, and future adapters for repeated controls) before writing raw
   `mat-form-field` markup. Add missing
   repeated controls as adapters first; do not copy component-local form wiring across pages.
7. Keep the list layout structure intact (`.erp-page` → `.erp-card` → `.erp-header` → `.filter-grid` → `.table-wrapper` → `.mobile-paginator`).
8. Keep `<table mat-table [dataSource]="dataSource" matSort>`, `MatTableDataSource`, `MatPaginator`, and `MatSort`.
9. Add `mat-sort-header` to every data column; never add it to `select` or `actions`.
10. In the primary identity column, render the display name/value on the first line and the record
    UUID below it using `.record-main` and `.record-uuid`. If the record UUID field is not named
    `UUID`, add a helper such as `recordUUID(row)` and use that helper consistently.
11. Update `sortingDataAccessor` whenever a displayed column uses a derived value, related-entity label, formatted value, or a field name different from the API/model field.
12. Keep the real `<mat-paginator class="mobile-paginator" [pageSizeOptions]="[5, 10, 25, 100]" showFirstLastButtons>` after `.table-wrapper`.
13. Use `span.status-pill.status-chip.state-chip` for status values, with Activity Log palette classes such as `chip-success` and `chip-skipped`, plus `is-active`/`is-inactive` for boolean status.
14. Keep list styling aligned with the ERP baseline by using the global hook classes only. Do not
    redefine `.erp-page`, `.erp-card`, `.erp-header`, `.header-actions`, `.filter-grid`, or
    `.filter-actions` in component SCSS. Shared layout belongs in `src/styles.scss`; component SCSS
    is for resource-specific details only.
15. Keep filter button icons standardized: `Apply` uses `filter_alt`; `Clear` uses `backspace`.
16. Keep responsive breakpoints ordered `1400px` → `1200px` → `900px`.
17. Keep the leading `select` checkbox column, selected count, `Delete selected` action in `filter-actions`, and call `ApiService.delete('<resource>/bulk', { ids })`; only remove bulk delete when the resource has a documented explicit exception.
18. Keep individual delete available and use `SlowConfirmDialogComponent` for both individual and bulk delete confirmation.
19. Use `SnackbarService` for transient success/error/warning/info feedback. Do not render CRUD operation messages inline in the page, table, dialog body, or dialog footer.
20. Keep create/edit in `MatDialog`; never convert this template to an inline form section.
21. Preserve the dialog viewport fallback: `updateSize(width, height || maxHeight)` so desktop dialogs do not collapse.
22. Keep the first dialog tab label as the translated `Record` key (`[label]="'Record' | transloco`) by default. Do not use `Data`, `Date`, or `Details` for CRUD record tabs.
23. Whenever the form has a notes/anotações field (`notes`, `Notes`, `*Notes`, config notes, or equivalent annotation), keep it in a dedicated `mat-tab label="Notes"` with a full-row textarea; never mix notes into `Record`, `Config`, `Pricing`, or `Provision`.
24. Keep the dialog visual contract aligned with this CRUD template and `app.md`: root padding `1.5rem 1.75rem 1.25rem`, compact tab content, sticky translucent `.form-actions` with `margin: auto 0 0`, internal horizontal padding, blur/shadow, desktop Cancel left and Save split right, mobile Save first and Cancel second.
25. For currency defaults, resolve `DEFAULT_CURRENCY` through `SystemParameterService.resolveDefaultCurrency()`; tenant parameters must win and master parameters are the fallback. Do not hardcode `BRL`/`USD` as the source of truth for create/reset flows.
26. Add the dialog `panelClass` to global overlay styles in `src/styles.scss` when the page uses a new panel class, so `.mat-mdc-dialog-surface`, content, and actions match the shared CRUD surface.
27. Run the CRUD validators before finishing:

```bash
npm run check:crud -- src/app/pages/<area>/<component>
npm run check:crud:layout -- src/app/pages/<area>/<component>
```

The validator is mandatory because the global CSS depends on exact hook classes such as `mat-elevation-z8`, `is-loading`, `select-col`, `status-col`, `actions-col`, `save-main-button`, `save-more-button`, and `is-single-action`.
The layout validator is mandatory because it blocks local CSS overrides and enforces that `filter-actions`
stays inside `filter-grid` on a dedicated right-aligned row.
