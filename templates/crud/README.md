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
3. Keep the list layout structure intact (`.erp-page` → `.erp-card` → `.erp-header` → `.filter-grid` → `.table-wrapper` → `.mobile-paginator`).
4. Keep `<table mat-table [dataSource]="dataSource" matSort>`, `MatTableDataSource`, `MatPaginator`, and `MatSort`.
5. Add `mat-sort-header` to every data column; never add it to `select` or `actions`.
6. Update `sortingDataAccessor` whenever a displayed column uses a derived value, related-entity label, formatted value, or a field name different from the API/model field.
7. Keep the real `<mat-paginator class="mobile-paginator" [pageSizeOptions]="[5, 10, 25, 100]" showFirstLastButtons>` after `.table-wrapper`.
8. Use `span.status-pill.status-chip.state-chip` for status values, with Activity Log palette classes such as `chip-success` and `chip-skipped`, plus `is-active`/`is-inactive` for boolean status.
9. Keep list styling aligned with the ERP baseline: card radius `1rem`, 3-column desktop filters, dedicated right-aligned `filter-actions`, equal-width short action buttons, table header background, row hover, cell borders, and fixed status/actions widths.
10. Keep filter button icons standardized: `Apply` uses `filter_alt`; `Clear` uses `backspace`.
11. Keep responsive breakpoints ordered `1400px` → `1200px` → `900px`.
12. Keep the leading `select` checkbox column, selected count, `Delete selected` action in `filter-actions`, and call `ApiService.delete('<resource>/bulk', { ids })`; only remove bulk delete when the resource has a documented explicit exception.
13. Keep individual delete available and use `SlowConfirmDialogComponent` for both individual and bulk delete confirmation.
14. Use `SnackbarService` for transient success/error/warning/info feedback. Do not render CRUD operation messages inline in the page, table, dialog body, or dialog footer.
15. Keep create/edit in `MatDialog`; never convert this template to an inline form section.
16. Preserve the dialog viewport fallback: `updateSize(width, height || maxHeight)` so desktop dialogs do not collapse.
17. Keep the first dialog tab label as `Data` by default; change it only when the resource domain has a documented, explicit reason.
18. Whenever the form has a notes/anotações field (`notes`, `Notes`, `*Notes`, config notes, or equivalent annotation), keep it in a dedicated `mat-tab label="Notes"` with a full-row textarea; never mix notes into `Data`, `Config`, `Pricing`, or `Provision`.
19. Keep the dialog visual contract aligned with this CRUD template and `app.md`: root padding `1.5rem 1.75rem 1.25rem`, compact tab content, sticky translucent `.form-actions` with `margin: auto 0 0`, internal horizontal padding, blur/shadow, desktop Cancel left and Save split right, mobile Save first and Cancel second.
20. For currency defaults, resolve `DEFAULT_CURRENCY` through `SystemParameterService.resolveDefaultCurrency()`; tenant parameters must win and master parameters are the fallback. Do not hardcode `BRL`/`USD` as the source of truth for create/reset flows.
21. Add the dialog `panelClass` to global overlay styles in `src/styles.scss` when the page uses a new panel class, so `.mat-mdc-dialog-surface`, content, and actions match the shared CRUD surface.
22. Run the CRUD template validator before finishing:

```bash
npm run check:crud -- src/app/pages/<area>/<component>
```

The validator is mandatory because the global CSS depends on exact hook classes such as `mat-elevation-z8`, `is-loading`, `select-col`, `status-col`, `actions-col`, `save-main-button`, `save-more-button`, and `is-single-action`.
