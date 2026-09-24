#!/usr/bin/env node
// FK quick-create contract (app.md "FK Quick-Create Baseline"): every searchable FK form field
// must offer creating the referenced record through its canonical CRUD form, or declare why not.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { directoryCrud } from './crud-discovery.mjs';

const root = process.cwd();
const registryPath = 'src/app/shared/crud/configurable-crud/quick-create.ts';
const skippedParents = new Set(['listFilters', 'columns', 'relatedCollections']);

export function registryEntries(source) {
  const entries = [];
  const pattern = /^ {2}(\w+):\s*\{[\s\S]*?import\('([^']+)'\)[\s\S]*?\(m\)\s*=>\s*m\.(\w+)/gm;
  for (const match of source.matchAll(pattern)) {
    entries.push({ key: match[1], importPath: match[2], exportName: match[3] });
  }
  return entries;
}

/** Walks object literals, skipping strings/comments, and yields each with its parent keys. */
export function objectLiterals(source) {
  const objects = [];
  const stack = [];
  let i = 0;
  const parentKey = (index) =>
    source.slice(Math.max(0, index - 80), index).match(/(\w+)\s*:\s*$/)?.[1];
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '/' && next === '/') {
      i = source.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (char === '/' && next === '*') {
      i = source.indexOf('*/', i + 2) + 2;
      if (i < 2) break;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      i += 1;
      while (i < source.length && source[i] !== char) i += source[i] === '\\' ? 2 : 1;
      i += 1;
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push({ char, start: i, key: parentKey(i) });
    } else if ((char === '}' || char === ']') && stack.length) {
      const frame = stack.pop();
      if (frame.char === '{') {
        const text = source.slice(frame.start, i + 1);
        objects.push({
          start: frame.start,
          own: ownText(text),
          parents: stack.map((item) => item.key).filter(Boolean),
        });
      }
    }
    i += 1;
  }
  return objects;
}

function ownText(text) {
  let depth = 0;
  let own = '';
  for (const char of text) {
    if (char === '{' || char === '[' || char === '(') depth += 1;
    if (depth <= 1) own += char;
    if (char === '}' || char === ']' || char === ')') depth -= 1;
  }
  return own;
}

export function fieldViolations(source, registryKeys) {
  const violations = [];
  for (const object of objectLiterals(source)) {
    if (object.parents.some((key) => skippedParents.has(key))) continue;
    const own = object.own;
    if (!/\btype:\s*'search-select'/.test(own)) continue;
    const key = own.match(/\bkey:\s*'([^']+)'/)?.[1];
    const fieldSource = own.match(/\bsource:\s*'([^']+)'/)?.[1];
    if (!key || !/UUIDs?$/.test(fieldSource ?? key)) continue;
    // List filters (paramKey / no persisted source) never offer creation.
    if (/\bparamKey:/.test(own) || (!fieldSource && !/\bpayloadKey:/.test(own))) continue;

    const quickCreate = own.match(/\bquickCreate:\s*([^\n]*)/)?.[1];
    const hasQuickCreate = /\bquickCreate:/.test(own);
    const hasReason = /\bquickCreateExemptReason:/.test(own);
    const line = source.slice(0, object.start).split('\n').length;
    if (hasQuickCreate) {
      if (/\bfalse\b/.test(quickCreate ?? '') && !hasReason) {
        violations.push({
          line,
          key,
          message: 'quickCreate: false requires quickCreateExemptReason',
        });
      }
      continue;
    }
    if (registryKeys.has(fieldSource)) continue;
    violations.push({
      line,
      key,
      message:
        `FK '${fieldSource ?? key}' has no quick-create. Register its canonical page in ` +
        `QUICK_CREATE_REGISTRY, bind quickCreateFor(<key>), or set quickCreate: false with ` +
        `quickCreateExemptReason`,
    });
  }
  return violations;
}

export function templateViolations(html) {
  const violations = [];
  for (const match of html.matchAll(/<mns-search-select-field\b[\s\S]*?\/?>/g)) {
    const tag = match[0];
    if (!/\[(field|value)\]="[^"]*UUIDs?\b/.test(tag)) continue;
    if (/\[canCreate\]=/.test(tag) || /\bdata-quick-create-exempt="[^"]+"/.test(tag)) continue;
    violations.push({
      line: html.slice(0, match.index).split('\n').length,
      key: tag.match(/\[(?:field|value)\]="([^"]+)"/)?.[1] ?? 'field',
      message:
        'FK search select has no [canCreate]/(createRecord); use openQuickCreate() or add ' +
        'data-quick-create-exempt="<reason>"',
    });
  }
  return violations;
}

function registryViolations(entries) {
  const violations = [];
  const base = resolve(root, dirname(registryPath));
  for (const entry of entries) {
    const target = resolve(base, `${entry.importPath}.ts`);
    if (!existsSync(target)) {
      violations.push(`${registryPath}: ${entry.key} imports missing ${entry.importPath}`);
      continue;
    }
    const page = readFileSync(target, 'utf8');
    // Realtime pages extend an intermediate configurable base declared in the same file.
    const exported =
      new RegExp(`export class ${entry.exportName} extends \\w+`).test(page) &&
      page.includes('ConfigurableCrudPageBase');
    if (!exported) {
      violations.push(
        `${registryPath}: ${entry.key} must load a ConfigurableCrudPageBase page; ` +
          `${entry.exportName} not found in ${relative(root, target)}`,
      );
    }
  }
  return violations;
}

function isLegacyCrudTemplate(file) {
  return directoryCrud(dirname(file)).some(
    (component) =>
      component.kind === 'legacy' &&
      readFileSync(component.path, 'utf8').includes(file.split('/').pop()),
  );
}

function collectFiles(target, files) {
  if (!existsSync(target)) throw new Error(`Target does not exist: ${target}`);
  if (statSync(target).isFile()) {
    if (/\.(ts|html)$/.test(target) && !target.endsWith('.spec.ts')) files.add(target);
    return;
  }
  for (const item of readdirSync(target, { withFileTypes: true })) {
    collectFiles(join(target, item.name), files);
  }
}

function main(argv) {
  const all = argv.includes('--all');
  const targets = argv.filter((arg) => !arg.startsWith('--'));
  if (!all && !targets.length) {
    console.error('Usage: node scripts/validate-crud-fk-quick-create.mjs (--all | <path>...)');
    process.exit(2);
  }

  const entries = registryEntries(readFileSync(resolve(root, registryPath), 'utf8'));
  const registryKeys = new Set(entries.map((entry) => entry.key));
  const problems = registryViolations(entries);

  const backlog = [];
  const files = new Set();
  for (const target of all ? ['src/app/pages'] : targets)
    collectFiles(resolve(root, target), files);
  for (const file of [...files].sort()) {
    const content = readFileSync(file, 'utf8');
    if (file.endsWith('.html') && isLegacyCrudTemplate(file)) {
      // Legacy CRUDs are blocked by the ConfigurableCrudPageBase migration gate as soon as they
      // are touched; they gain quick-create through the configurable base once migrated.
      if (templateViolations(content).length) backlog.push(relative(root, file));
      continue;
    }
    const found = file.endsWith('.html')
      ? templateViolations(content)
      : fieldViolations(content, registryKeys);
    for (const violation of found) {
      problems.push(
        `${relative(root, file)}:${violation.line} [${violation.key}] ${violation.message}`,
      );
    }
  }

  if (backlog.length) {
    console.log('FK quick-create backlog (legacy CRUD, migrate to ConfigurableCrudPageBase):');
    for (const file of backlog) console.log(`  - ${file}`);
  }
  if (problems.length) {
    console.error(`FK quick-create contract failed (${problems.length}):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `FK quick-create contract passed for ${files.size} file(s), ${entries.length} registry entries.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
