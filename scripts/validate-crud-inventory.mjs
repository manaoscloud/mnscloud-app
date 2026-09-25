#!/usr/bin/env node
// App-wide CRUD inventory gate: every CRUD/list page must extend ConfigurableCrudPageBase.
// Legacy pages are tolerated only while listed in crud-legacy-allowlist.json, and that list
// may only shrink: a listed page that is no longer legacy (migrated or removed) fails until
// its entry is deleted, so the allowlist always matches the real migration backlog.
import { directoryCrud } from './crud-discovery.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

export function checkCrudInventory(components, pending) {
  const legacy = new Set(components.filter((c) => c.kind === 'legacy').map((c) => c.path));
  const allowed = new Set(pending);
  return {
    unlisted: [...legacy].filter((path) => !allowed.has(path)).sort(),
    stale: [...allowed].filter((path) => !legacy.has(path)).sort(),
    remaining: legacy.size,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const allowlistPath = resolve(root, 'scripts/crud-legacy-allowlist.json');
  const pending = existsSync(allowlistPath)
    ? (JSON.parse(readFileSync(allowlistPath, 'utf8')).pending ?? [])
    : [];
  const { unlisted, stale, remaining } = checkCrudInventory(crudInventory(root), pending);
  if (unlisted.length)
    console.error(
      'Legacy CRUD/list pages must extend ConfigurableCrudPageBase and use its shared HTML/SCSS:\n' +
        unlisted.map((path) => `  ${path}`).join('\n'),
    );
  if (stale.length)
    console.error(
      'Remove migrated pages from scripts/crud-legacy-allowlist.json:\n' +
        stale.map((path) => `  ${path}`).join('\n'),
    );
  if (unlisted.length || stale.length) process.exit(1);
  console.log(`CRUD inventory passed; ${remaining} legacy page(s) pending migration.`);
}
