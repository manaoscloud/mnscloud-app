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

## Contextual field help (global)

Global styles live in `src/styles/_field-help.scss`; `FieldHelpComponent` owns the
accessible interaction. Do not add page-local sizing, positioning, color, or tooltip CSS.
All generic CRUD forms use this contract by default, including collection dialogs,
address fields and inline related-collection editors. No per-page opt-in is required.

- `help: 'Translation key'` provides supplementary guidance inside the field outline.
- `helpWhen: ({ editing, values }) => 'Translation key'` supplies conditional guidance.
  An empty result hides the help button; it does not fall back to the static text.
  Related-collection guidance uses its own draft values, never the parent form values.
- Use `matIconSuffix` on Material fields and the shared `help` input on searchable
  relation fields. Native file controls place help inside their existing outline;
  the selected filename remains visible as operational state.
- Keep the full control width and `--form-control-height` (40px baseline), independently
  of select arrows, password toggles and quick-create actions. Never place help in an
  external grid column or over the field value. Multiline/upload controls retain their
  existing heights.
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
