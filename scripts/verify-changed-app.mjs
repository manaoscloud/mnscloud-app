#!/usr/bin/env node
import { directoryCrud } from './crud-discovery.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const [base, head] = process.argv.slice(2);

if (!base || !head) {
  console.error('Usage: node scripts/verify-changed-app.mjs <base-sha> <head-sha>');
  process.exit(2);
}

const root = process.cwd();
const changedFiles = execFileSync('git', ['diff', '--name-only', `${base}..${head}`], {
  encoding: 'utf8',
})
  .split('\n')
  .map((path) => path.trim())
  .filter(Boolean);

const appFiles = changedFiles.filter(
  (path) => path.startsWith('src/app/') && ['.ts', '.html', '.json'].includes(extname(path)),
);

function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit' });
}

function hasCrudTemplate(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) return false;
  return directoryCrud(path).length > 0;
}

function findCrudRoot(file) {
  let current = dirname(resolve(root, file));
  const pagesRoot = resolve(root, 'src/app/pages');

  while (current.startsWith(pagesRoot)) {
    if (hasCrudTemplate(current)) return relative(root, current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

if (appFiles.length) {
  run('node', ['scripts/check-angular-baseline.mjs', '--strict', ...appFiles]);
}

run('node', [
  '--test',
  'scripts/crud-discovery.test.mjs',
  'scripts/validate-crud-fk-quick-create.test.mjs',
  'scripts/pay-payment-crud.test.mjs',
  'scripts/pay-i18n-coverage.test.mjs',
  'scripts/pay-error.test.mjs',
]);
run('node', ['scripts/pay-i18n-coverage.mjs']);
if (
  changedFiles.some(
    (path) => path.startsWith('src/app/shared/payment/') || path.endsWith('/define-crud.ts'),
  )
) {
  run('node', [
    'scripts/validate-crud-i18n.mjs',
    '--shared',
    'src/app/shared/crud/configurable-crud/define-crud.ts',
  ]);
}
// Pay bank partners and tenant gateways own their CRUD configs (independent domains).
for (const page of [
  'src/app/pages/system/pay/bank-partners',
  'src/app/pages/erp/financial/payment/gateway',
]) {
  if (changedFiles.some((path) => path.startsWith(page + '/'))) {
    run('node', ['scripts/validate-crud-i18n.mjs', page]);
  }
}
run('node', ['scripts/validate-dashboard-template.mjs']);
run('node', ['scripts/validate-content-pages.mjs']);

const crudRoots = [
  ...new Set(
    changedFiles
      .filter((path) => path.startsWith('src/app/'))
      .map(findCrudRoot)
      .filter(Boolean),
  ),
].sort();
for (const crudRoot of crudRoots) {
  run('node', ['scripts/validate-crud-template.mjs', crudRoot]);
  run('node', ['scripts/validate-crud-layout.mjs', crudRoot]);
  run('node', ['scripts/validate-crud-i18n.mjs', crudRoot]);
}
// FK quick-create is enforced app-wide: every searchable FK form field offers in-place creation
// or documents its exemption, and every registry entry loads a configurable CRUD page.
run('node', ['scripts/validate-crud-fk-quick-create.mjs', '--all']);

console.log(
  `Changed-app validation passed for ${appFiles.length} Angular file(s) and ${crudRoots.length} CRUD root(s).`,
);
