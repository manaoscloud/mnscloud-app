#!/usr/bin/env node
// Required Field Feedback Baseline (app.md): after a save attempt every invalid field turns red,
// shows its reason and the first one receives focus. App-wide, no allowlist:
// - every field control of the generic CRUD form binds its error state and focus marker;
// - no page shows the anonymous "Required fields are missing." toast;
// - no save/confirm button is disabled by form validity (the click must reveal the fields).
//   A button that must stay disabled documents why with `required-feedback-exempt: <reason>`
//   in the three lines above it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const CRUD_TEMPLATE = 'src/app/shared/crud/configurable-crud/configurable-crud-page.html';
const FORM_START = '<ng-template #simpleFieldTab';
const FORM_END = '<div class="form-actions">';
const FLAGGED_COMPONENTS = [
  'mns-search-select-field',
  'mns-checkbox-group-field',
  'mns-permission-tree-field',
  'mns-secret-content-field',
  'app-phone-input',
];
const VALIDITY_DISABLED =
  /\[disabled\]="[^"]*(?:[Vv]alid\(\)|\.valid\b|isFormValid|FormValid)[^"]*"/g;
const EXEMPT = /required-feedback-exempt:[ \t]*[A-Za-z]/;

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/** Opening tag text starting at `index` (attributes may span lines). */
function openingTag(source, index) {
  let quote = null;
  for (let i = index; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return source.slice(index, i + 1);
  }
  return source.slice(index);
}

/** Field controls of the generic CRUD form missing their error state, marker or message. */
export function findCrudFieldGaps(template) {
  const start = template.indexOf(FORM_START);
  const end = template.indexOf(FORM_END, start);
  if (start < 0 || end < 0) return [{ line: 1, problem: 'form region not found' }];
  const region = template.slice(start, end);
  const gaps = [];
  const report = (offset, problem) =>
    gaps.push({ line: lineOf(template, start + offset), problem });

  for (const match of region.matchAll(/<(input|textarea)\b/g)) {
    const tag = openingTag(region, match.index);
    if (!/\bmatInput\b/.test(tag)) continue;
    if (!tag.includes('[mnsInvalid]')) report(match.index, `${match[1]} without [mnsInvalid]`);
    if (!tag.includes('data-field-key')) report(match.index, `${match[1]} without data-field-key`);
  }
  for (const component of FLAGGED_COMPONENTS) {
    for (const match of region.matchAll(new RegExp(`<${component}\\b`, 'g'))) {
      const tag = openingTag(region, match.index);
      if (!tag.includes('[invalid]')) report(match.index, `${component} without [invalid]`);
      if (!tag.includes('data-field-key'))
        report(match.index, `${component} without data-field-key`);
    }
  }
  for (const match of region.matchAll(/<mat-form-field\b[\s\S]*?<\/mat-form-field>/g)) {
    const block = match[0];
    if (!/\bmatInput\b|<app-phone-input\b/.test(block)) continue;
    if (!block.includes('<mat-error')) report(match.index, 'mat-form-field without <mat-error>');
  }
  for (const match of region.matchAll(/<mat-tab\b/g)) {
    const tag = openingTag(region, match.index);
    if (!/tabLabel\(|collection\.label/.test(tag)) continue;
    if (!tag.includes('[labelClass]')) report(match.index, 'field tab without [labelClass]');
  }
  return gaps;
}

/** Lines of the anonymous required toast and of buttons disabled by form validity. */
export function findSourceViolations(source) {
  const violations = [];
  for (const match of source.matchAll(/['"]Required fields are missing\.['"]/g)) {
    violations.push({ line: lineOf(source, match.index), problem: 'anonymous required toast' });
  }
  for (const match of source.matchAll(VALIDITY_DISABLED)) {
    const before = source.slice(0, match.index).split('\n').slice(-4).join('\n');
    if (EXEMPT.test(before)) continue;
    violations.push({ line: lineOf(source, match.index), problem: 'button disabled by validity' });
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
  for (const gap of findCrudFieldGaps(readFileSync(join(root, CRUD_TEMPLATE), 'utf8'))) {
    failures.push(`${CRUD_TEMPLATE}:${gap.line} ${gap.problem}`);
  }
  for (const file of sources(join(root, 'src/app'))) {
    for (const violation of findSourceViolations(readFileSync(file, 'utf8'))) {
      failures.push(`${relative(root, file)}:${violation.line} ${violation.problem}`);
    }
  }
  if (failures.length) {
    console.error(
      'Required field feedback gaps (app.md "Required Field Feedback Baseline").\n' +
        'Bind the error state ([mnsInvalid] / [invalid], data-field-key, <mat-error>), name the\n' +
        'field (rejectField / reportFieldErrors) and keep save buttons enabled:',
    );
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('Required field feedback check passed.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
