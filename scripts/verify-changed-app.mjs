#!/usr/bin/env node
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
  return readdirSync(path).some((entry) => {
    const file = join(path, entry);
    if (!statSync(file).isFile() || !['.html', '.ts'].includes(extname(file))) return false;
    const source = readFileSync(file, 'utf8');
    return (
      source.includes('ConfigurableCrudPageBase') ||
      (source.includes('crud-dialog') && source.includes('erp-page'))
    );
  });
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

const crudRoots = [...new Set(appFiles.map(findCrudRoot).filter(Boolean))].sort();
for (const crudRoot of crudRoots) {
  run('node', ['scripts/validate-crud-template.mjs', crudRoot]);
  run('node', ['scripts/validate-crud-layout.mjs', crudRoot]);
  run('node', ['scripts/validate-crud-i18n.mjs', crudRoot]);
}

console.log(
  `Changed-app validation passed for ${appFiles.length} Angular file(s) and ${crudRoots.length} CRUD root(s).`,
);
