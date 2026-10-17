#!/usr/bin/env node
// Global Table Component Baseline (app.md): there is one table in the App, ConfigurableCrudPageBase
// with its shared template. Pages, tabs, dialogs, dashboards and result panels render rows through
// it (page, ConfigurableCrudCollectionDialog, relatedCollections, or the read-only
// <mns-global-table>). App-wide, no per-page opt-out: the only files allowed to use table
// primitives are listed in NOT_TABLE_SURFACES below, and each one is documented in app.md.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RULES = [
  { name: '<table> element', pattern: /<table\b/g },
  { name: 'mat-table', pattern: /\bmat-table\b|\bmatColumnDef\b|\bmatHeaderRowDef\b/g },
  { name: 'MatTableModule/MatTableDataSource', pattern: /\bMatTable(?:Module|DataSource)\b/g },
  { name: 'page-local paginator', pattern: /<mat-paginator\b|\bMatPaginatorModule\b/g },
];

/**
 * The global table itself and the documented surfaces that are not record tables (app.md "Global
 * Table Component Baseline" -> "Not tables"). Adding an entry needs the same change in app.md.
 */
export const NOT_TABLE_SURFACES = {
  'src/app/shared/crud/configurable-crud/configurable-crud-page.html': 'the global table',
  'src/app/shared/crud/configurable-crud/configurable-crud-page-base.ts': 'the global table',
  'src/app/shared/data-viewer-dialog/data-viewer-dialog.html': 'read-only payload viewer',
  'src/app/shared/dashboard/dashboard-record-list.ts': 'dashboard record cards',
  'src/app/pages/monitoring/telemetry/overview.html':
    'server paginator of the fleet explorer modes',
  'src/app/pages/monitoring/telemetry/overview.ts': 'server paginator of the fleet explorer modes',
};

/** Source without comments, keeping line breaks so reported lines stay correct. */
export function stripComments(source) {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (match, lead) => lead + blank(match.slice(lead.length)));
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/** Table primitives used in one source file, as `{ rule, line }`. */
export function findTablePrimitives(source) {
  const code = stripComments(source);
  const found = [];
  for (const rule of RULES) {
    for (const match of code.matchAll(rule.pattern)) {
      found.push({ rule: rule.name, line: lineOf(code, match.index) });
    }
  }
  return found.sort((left, right) => left.line - right.line);
}

function sources(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

function main() {
  const root = process.cwd();
  const failures = [];
  let files = 0;
  for (const file of sources(join(root, 'src/app'))) {
    files += 1;
    const path = relative(root, file).split(sep).join('/');
    if (NOT_TABLE_SURFACES[path]) continue;
    for (const { rule, line } of findTablePrimitives(readFileSync(file, 'utf8'))) {
      failures.push(`${path}:${line} ${rule}`);
    }
  }
  if (!files) {
    console.error('Global table check found no sources; the scan is broken.');
    process.exit(1);
  }
  if (failures.length) {
    console.error(
      'Table primitives outside the global table (app.md "Global Table Component Baseline").\n' +
        'Render the rows with ConfigurableCrudPageBase: a CRUD page, ConfigurableCrudCollectionDialog,\n' +
        'relatedCollections, or the read-only <mns-global-table [config]="defineGlobalTable({...})">.\n' +
        'Missing capability? Add it to the shared base, never to the page:',
    );
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`Global table check passed for ${files} source file(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
