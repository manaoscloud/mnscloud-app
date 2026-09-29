# Generic CRUD configuration

All new CRUD/list resources use `ConfigurableCrudPageBase`, its shared HTML/SCSS and
`app.md`. This template creates only a resource configuration; there is no page-local
HTML/SCSS to copy. Never use an existing screen as a template.

```bash
node scripts/create-crud.mjs src/app/pages/area/resources area/resources ResourceUUID ResourcesPage
```

The generator refuses existing directories. Configure the endpoint, field/source mappings,
columns, translated labels, statuses and authorized actions. Use resources for FK lookups,
searchable shared fields, `type: 'currency'` and system currency defaults. Add keys in PT/EN/ES.
The shared base owns filters, sorting, pagination, dialogs, selection and notifications.
Bulk deletion requires a real authorized API contract; document lifecycle exceptions.

Related CRUDs use declarative row actions with a `collection` factory. Each child receives
its parent endpoint and may itself expose another child collection. One-shot operations
use a `form` factory and the same shared form dialog; they never grant extra permissions.
Enhance the shared layer for missing capabilities instead of adding local markup.

```bash
npm run check:crud -- src/app/pages/area/resources
npm run check:crud:layout -- src/app/pages/area/resources
npm run check:crud:i18n -- src/app/pages/area/resources
npm run build
```

Validation must recognize at least one CRUD and reject copied/legacy implementations.
The changed-app CI checks new and modified resource pages, including SCSS-only changes.
Schema delivery uses the enrolled Agent reconciliation path described by the workspace.

## Contextual field help (opt-in pilot)

Global styles live in `src/styles/_field-help.scss`; `FieldHelpComponent` owns the
accessible interaction. Do not add page-local sizing, positioning, color, or tooltip CSS.
Only Hosting / DNS / Domains currently opts in; leave other resources unchanged until
this pilot is approved. New templates do not enable it automatically.

- `contextualHelp: true` on the CRUD configuration opts into uniformly aligned field cells.
- `help: 'Translation key'` is optional supplementary text. The generic normal field tabs
  render an inline `matIconSuffix` help button inside the outline without changing `--form-control-height` (40px baseline).
- `tabNotices: { network: 'Essential instruction' }` keeps prerequisites visible.
- Existing `hint`/`hintWhen` and validation messages are never automatically hidden or converted.
- Text is escaped Angular interpolation; do not accept arbitrary HTML. Translate help,
  notices, titles and accessible labels in PT/EN/ES.
- Hover/focus provides a short tooltip; click, Enter/Space or touch opens persistent help.
  Escape/backdrop/close dismiss it, return focus, and must not dismiss the parent CRUD dialog.
- The icon must reserve suffix space inside the full-width control, independently of select arrows, password toggles and quick-create actions. Do not allocate an external grid column or absolutely position an icon over the field value.
  Mobile must fit the viewport; help must remain available on disabled fields.
- The generic address and inline related-collection editors retain their existing presentation;
  use the shared help component when those editors are explicitly migrated.
- Verify dark/light themes, desktop/mobile, keyboard focus, Escape, visible prerequisites,
  equal control heights and unchanged save payloads before extending adoption.
- Hover and click help must both have an opaque surface, readable theme text (at least 4.5:1 contrast), border, padding and shadow. Include the Material tooltip theme in the global theme mixin. Test computed background opacity and contrast over underlying form content; checking that a tooltip exists is insufficient.
