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
