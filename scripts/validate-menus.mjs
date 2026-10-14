#!/usr/bin/env node
// Global menu contract (app.md "Menus"): every <mat-menu> panel uses the shared `mns-menu` shell
// and every `mat-menu-item` carries `mnsMenuItem`, so titles, selection state, danger tone and
// spacing stay identical app-wide. App-wide, no allowlist.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const MENU = /<mat-menu\b[^>]*>/g;
const ITEM = /<(button|a)\b[^>]*\bmat-menu-item\b[^>]*>/g;
const CLASS = /\bclass="([^"]*)"/;
const LEGACY_CLASS =
  /\b(topbar-menu(?:-(?:title|label|check|danger|search|list|empty))?|crud-view-menu(?:-label)?|crud-menu-danger)\b(?![-\w])/g;

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/** Contract violations in one template/component source, as `{ line, message }`. */
export function findMenuViolations(source) {
  const violations = [];
  for (const match of source.matchAll(MENU)) {
    const classes = (match[0].match(CLASS)?.[1] ?? '').split(/\s+/);
    if (!classes.includes('mns-menu')) {
      violations.push({
        line: lineOf(source, match.index),
        message: '<mat-menu> without class="mns-menu"',
      });
    }
  }
  for (const match of source.matchAll(ITEM)) {
    if (!/\bmnsMenuItem\b/.test(match[0])) {
      violations.push({
        line: lineOf(source, match.index),
        message: 'mat-menu-item without mnsMenuItem',
      });
    }
  }
  for (const match of source.matchAll(LEGACY_CLASS)) {
    violations.push({
      line: lineOf(source, match.index),
      message: `legacy menu class "${match[1]}" (use the mns-menu primitives)`,
    });
  }
  return violations;
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
  let menus = 0;
  for (const file of sources(join(root, 'src/app'))) {
    const source = readFileSync(file, 'utf8');
    menus += [...source.matchAll(MENU)].length;
    for (const { line, message } of findMenuViolations(source)) {
      failures.push(`${relative(root, file)}:${line} ${message}`);
    }
  }
  if (!menus) {
    console.error('Menu check found no <mat-menu> panels; the scan is broken.');
    process.exit(1);
  }
  if (failures.length) {
    console.error('Menus must use the global mns-menu shell and primitives (app.md "Menus"):');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`Menu check passed for ${menus} menu panel(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
