#!/usr/bin/env node
// App-wide CRUD inventory gate: every CRUD/list page must extend ConfigurableCrudPageBase and use
// its shared HTML/SCSS. There is no allowlist: a table-based page that is not a record CRUD opts
// out only through a documented `// crud-template-exempt: <reason>` marker (see crud-discovery).
import { directoryCrud } from './crud-discovery.mjs';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export function crudInventory(root) {
  const directories = [];
  const walk = (directory) => {
    directories.push(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true }))
      if (entry.isDirectory()) walk(join(directory, entry.name));
  };
  walk(resolve(root, 'src/app'));
  return directories
    .flatMap(directoryCrud)
    .map(({ path, kind }) => ({ path: relative(root, path).split('\\').join('/'), kind }));
}

export function legacyCrudPages(components) {
  return components
    .filter((component) => component.kind === 'legacy')
    .map((component) => component.path)
    .sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const components = crudInventory(process.cwd());
  const legacy = legacyCrudPages(components);
  if (legacy.length) {
    console.error(
      'Legacy CRUD/list pages must extend ConfigurableCrudPageBase and use its shared HTML/SCSS:\n' +
        legacy.map((path) => `  ${path}`).join('\n'),
    );
    process.exit(1);
  }
  console.log(`CRUD inventory passed; ${components.length} generic CRUD page(s), no legacy pages.`);
}
