#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const errors = [];
let staticHelp = 0;
let conditionalHelp = 0;
for (const file of walk('src')) {
  if (!/\.(ts|html|scss)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (
    /\bfield-hint\b|\bparameter-hint\b|\bcrud-form-notice\b|\bcontextualHelp\b|\btabNotices\b/.test(
      text,
    )
  ) {
    errors.push(`${file}: retired detached field-help presentation`);
  }
  if (file.endsWith('.html') && /<mat-hint\b/.test(text)) {
    errors.push(`${file}: use mns-field-help (matIconSuffix) instead of mat-hint`);
  }
  if (file.endsWith('.ts') && text.includes('ConfigurableCrud')) {
    if (/\b(?:hint|hintWhen)\??\s*:/.test(text)) {
      errors.push(`${file}: use help/helpWhen metadata`);
    }
    if (file.startsWith('src/app/pages/')) {
      staticHelp += [...text.matchAll(/\bhelp\s*:/g)].length;
      conditionalHelp += [...text.matchAll(/\bhelpWhen\s*:/g)].length;
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `Global field help contract passed: ${staticHelp} static and ${conditionalHelp} conditional definitions; no retired field-hint renderers or mat-hint.`,
);
