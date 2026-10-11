#!/usr/bin/env node
// Install Command Dialog Baseline (app.md): generated install/enrollment commands open only through
// `openInstallCommandDialog` (CRUD geometry with `crud-form-dialog`, Escape, binding release and
// close on page destroy). App-wide, no allowlist.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHARED_DIR = ['src', 'app', 'shared', 'install-command-dialog'].join(sep);
const LEGACY_PANEL = 'install-command-dialog-panel';

/** Violations in one source file (`path` relative to the app root). */
export function findInstallCommandViolations(path, source) {
  const violations = [];
  const lines = source.split('\n');
  const shared = path.startsWith(SHARED_DIR + sep);
  lines.forEach((line, index) => {
    if (line.includes(LEGACY_PANEL)) {
      violations.push(`${path}:${index + 1} uses the retired "${LEGACY_PANEL}" panel class`);
    }
    if (!shared && /\bInstallCommandDialogComponent\b/.test(line)) {
      violations.push(
        `${path}:${index + 1} references InstallCommandDialogComponent; use openInstallCommandDialog`,
      );
    }
  });
  return violations;
}

function sources(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(html|ts|scss)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

function main() {
  const root = process.cwd();
  const violations = [];
  let openers = 0;
  for (const file of sources(join(root, 'src'))) {
    const path = relative(root, file);
    const source = readFileSync(file, 'utf8');
    if (!path.startsWith(SHARED_DIR + sep)) {
      openers += (source.match(/\bopenInstallCommandDialog\(/g) ?? []).length;
    }
    violations.push(...findInstallCommandViolations(path, source));
  }
  if (!openers) {
    console.error(
      'Install command dialog check found no openInstallCommandDialog call; the scan is broken.',
    );
    process.exit(1);
  }
  if (violations.length) {
    console.error(
      'Install command dialogs outside the shared helper (app.md "Install Command Dialog Baseline"):',
    );
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }
  console.log(
    `Install command dialog check passed for ${openers} openInstallCommandDialog call(s).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
