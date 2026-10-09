#!/usr/bin/env node
// Dialog Report Problem Baseline (app.md): every dialog header offers "Report problem", so a
// problem inside a dialog is reported without closing it. App-wide, no allowlist: a header that
// must not carry the button documents why with `report-problem-exempt: <reason>` right above it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const HEADER = /<(header|div)\b[^>]*\bclass="[^"]*\bdialog-header\b[^"]*"[^>]*>/g;
const EXEMPT = /report-problem-exempt:[ \t]*[A-Za-z]/;

/** End index of the element opened at `start` (same-tag nesting aware). */
function elementEnd(source, tag, start) {
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  pattern.lastIndex = start;
  let depth = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match[0].endsWith('/>')) continue;
    depth += match[1] ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return source.length;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/** Dialog headers in one template/component source without the button or an exemption. */
export function findMissingReportButtons(source) {
  const missing = [];
  for (const match of source.matchAll(HEADER)) {
    const end = elementEnd(source, match[1], match.index);
    if (source.slice(match.index, end).includes('<mns-report-problem-button')) continue;
    const before = source.slice(0, match.index).split('\n').slice(-3).join('\n');
    if (EXEMPT.test(before)) continue;
    missing.push(lineOf(source, match.index));
  }
  return missing;
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
  let headers = 0;
  for (const file of sources(join(root, 'src/app'))) {
    const source = readFileSync(file, 'utf8');
    headers += [...source.matchAll(HEADER)].length;
    for (const line of findMissingReportButtons(source)) {
      failures.push(`${relative(root, file)}:${line}`);
    }
  }
  if (!headers) {
    console.error('Dialog report button check found no dialog headers; the scan is broken.');
    process.exit(1);
  }
  if (failures.length) {
    console.error(
      'Dialog headers without <mns-report-problem-button /> (app.md "Dialog Report Problem Baseline").\n' +
        'Add the button, or document `report-problem-exempt: <reason>` right above the header:',
    );
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`Dialog report button check passed for ${headers} dialog header(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
