#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, basename, sep } from 'node:path';
const [directory, endpoint, uuid, className] = process.argv.slice(2);
if (
  !directory ||
  !/^[a-z0-9/-]+$/.test(endpoint ?? '') ||
  !/^[A-Za-z][A-Za-z0-9]*$/.test(uuid ?? '') ||
  !/^[A-Z][A-Za-z0-9]*$/.test(className ?? '')
)
  throw new Error(
    'Usage: node scripts/create-crud.mjs src/app/pages/area/resource area/resources ResourceUUID ResourcePage',
  );
const root = resolve('src/app/pages'),
  target = resolve(directory);
if (!target.startsWith(root + sep) || existsSync(target))
  throw new Error(
    'Choose a new directory below src/app/pages; existing resources are never overwritten.',
  );
const selector = basename(target);
if (!/^[a-z][a-z0-9-]*$/.test(selector)) throw new Error('Use a kebab-case resource directory.');
const prefix = relative(target, resolve('src/app')).split(sep).join('/') + '/';
let source = readFileSync('templates/crud/page.ts', 'utf8');
for (const [key, value] of Object.entries({
  ROOT: prefix,
  ENDPOINT: endpoint,
  UUID: uuid,
  CLASS: className,
  SELECTOR: selector,
}))
  source = source.replaceAll('__' + key + '__', value);
mkdirSync(target, { recursive: true });
writeFileSync(resolve(target, selector + '.ts'), source);
console.log('Created generic CRUD configuration: ' + directory);
