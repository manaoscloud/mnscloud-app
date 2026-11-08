#!/usr/bin/env node
// Tenant scope ratchet (app.md "Master pages and tenant data"): the endpoint and the tenant header
// come only from the route's declared scope. Counts per file the legacy forms that choose the
// scope from the URL or the master permission, against scripts/tenant-scope-baseline.json: a file
// may not gain one, a new file may not add one, and a fix lowers its baseline entry in the same PR
// (a stale entry fails). Phase T8 of the workspace tenant-scope program brings it to zero.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PATTERNS = {
  // `isMaster() ? 'system/...' : '...'` or `hasPermission('platform.master.access') ? 'system/...'`
  'endpoint-by-master':
    /(?:isMaster\(\)|'platform\.master\.access'\)?)\s*\?\s*['"`]\/?(?:api\/v1\/)?system\//g,
  // scope decided from the browser URL
  'scope-from-url':
    /window\.location\.pathname|router\.url[^;\n]*['"`]\/?system|startsWith\(\s*['"`]\/system/g,
  // scope or tenant kept in browser storage and read back as scope
  'scope-from-storage': /localStorage[^;\n]*[Ee]nvironment/g,
};

// A use that is not a scope decision (the one store of the tenant the user selected) carries
// `// tenant-scope-exempt: <reason>` at the end of its line or on a comment line right above.
const EXEMPT = /\/\/\s*tenant-scope-exempt:\s*\S/;

export function countSource(source) {
  const out = {};
  const lines = source.split('\n');
  for (const [name, re] of Object.entries(PATTERNS)) {
    let n = 0;
    for (const match of source.matchAll(new RegExp(re.source, re.flags))) {
      const line = source.slice(0, match.index).split('\n').length - 1;
      const above = (lines[line - 1] ?? '').trim();
      if (EXEMPT.test(lines[line] ?? '') || (above.startsWith('//') && EXEMPT.test(above))) continue;
      n += 1;
    }
    if (n > 0) out[name] = n;
  }
  return out;
}

export function compare(found, baseline) {
  const errors = [];
  for (const [file, counts] of Object.entries(found)) {
    for (const [name, n] of Object.entries(counts)) {
      const allowed = baseline[file]?.[name] ?? 0;
      if (n > allowed)
        errors.push(
          `${file}: ${name} ${n} > baseline ${allowed}; take the scope from route.data.scope`,
        );
    }
  }
  for (const [file, counts] of Object.entries(baseline)) {
    for (const [name, allowed] of Object.entries(counts)) {
      const n = found[file]?.[name] ?? 0;
      if (n < allowed)
        errors.push(`${file}: ${name} ${n} < baseline ${allowed}; lower the baseline entry`);
    }
  }
  return errors;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

const BASELINE = 'scripts/tenant-scope-baseline.json';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const found = {};
  for (const file of walk(join(root, 'src/app'), []).sort()) {
    const counts = countSource(readFileSync(file, 'utf8'));
    if (Object.keys(counts).length) found[relative(root, file)] = counts;
  }
  // Every legacy form is gone (phase T8): a canary proves each pattern still detects its form.
  const canary = countSource(
    "x = isMaster() ? 'system/a' : 'a';\nif (window.location.pathname) {}\n" +
      "localStorage.getItem('mc_current_env') // Environment\n",
  );
  if (Object.keys(PATTERNS).some((name) => !canary[name])) {
    console.error('check:tenant-scope canary not detected; the detector is broken');
    process.exit(1);
  }
  if (process.argv.includes('--write-baseline')) {
    writeFileSync(BASELINE, JSON.stringify(found, null, 2) + '\n');
    console.log(`wrote ${Object.keys(found).length} files`);
    process.exit(0);
  }
  const errors = compare(found, JSON.parse(readFileSync(BASELINE, 'utf8')));
  for (const e of errors) console.error(e);
  if (errors.length) {
    console.error(
      `check:tenant-scope: ${errors.length} problem(s). See app.md "Master pages and tenant data".`,
    );
    process.exit(1);
  }
  const total = Object.values(found).reduce(
    (s, c) => s + Object.values(c).reduce((a, b) => a + b, 0),
    0,
  );
  console.log(`check:tenant-scope OK (${total} legacy uses in ${Object.keys(found).length} files)`);
}
