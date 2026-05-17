#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: node scripts/validate-crud-template.mjs <page-or-file> [...]');
  process.exit(2);
}

function walk(target) {
  const full = resolve(root, target);
  if (!existsSync(full)) return [];
  const stat = statSync(full);
  if (stat.isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const path = join(full, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}

function has(content, pattern) {
  return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
}

const htmlRules = [
  ['page root', '<section class="erp-page'],
  ['card root', '<mat-card class="erp-card'],
  ['header', 'erp-header'],
  ['header actions', 'header-actions'],
  ['refresh action', /<mat-icon>\s*refresh\s*<\/mat-icon>/],
  ['new action', /<mat-icon>\s*add\s*<\/mat-icon>/],
  ['filter grid', 'filter-grid'],
  ['filter actions row', 'filter-actions'],
  ['apply icon', /<mat-icon>\s*filter_alt\s*<\/mat-icon>/],
  ['clear icon', /<mat-icon>\s*backspace\s*<\/mat-icon>/],
  ['table wrapper elevation', /class="[^"]*\btable-wrapper\b[^"]*\bmat-elevation-z8\b[^"]*"/],
  ['table loading binding', '[class.is-loading]'],
  ['table loading overlay', 'table-loading'],
  ['mat table sort', /<table[^>]*mat-table[^>]*matSort/],
  ['select column class', 'select-col'],
  ['status column class', 'status-col'],
  ['actions column header class', 'actions-col-header'],
  ['actions column cell class', 'actions-col-cell'],
  ['actions column wrapper', 'actions-col'],
  ['status pill', 'status-pill'],
  ['status chip variant', 'status-chip'],
  ['status chip state class', /chip-success|chip-running|chip-queued|chip-failed|chip-skipped/],
  ['active status class', 'is-active'],
  ['inactive status class', 'is-inactive'],
  ['real paginator', /<mat-paginator[^>]*class="[^"]*\bmobile-paginator\b[^"]*"[^>]*showFirstLastButtons/],
  ['no data row', '*matNoDataRow'],
  ['crud dialog root', 'crud-dialog'],
  ['dialog header', 'dialog-header'],
  ['dialog content', 'dialog-content'],
  ['form tabs', 'form-tabs'],
  ['tab content', 'tab-content'],
  ['form actions', 'form-actions'],
  ['secondary actions', 'secondary-actions'],
  ['primary actions', 'primary-actions'],
  ['split save wrapper', 'save-split-action'],
  ['single action binding', 'is-single-action'],
  ['save main button class', 'save-main-button'],
  ['save more button class', 'save-more-button'],
  ['save/new label', 'Save/New'],
];

const tsRules = [
  ['MatTableDataSource', 'MatTableDataSource'],
  ['MatPaginator view child', /ViewChild\(MatPaginator\)/],
  ['MatSort view child', /ViewChild\(MatSort\)/],
  ['sortingDataAccessor', 'sortingDataAccessor'],
  ['openCrudTemplateDialog', 'openCrudTemplateDialog'],
  ['SlowConfirmDialogComponent', 'SlowConfirmDialogComponent'],
  ['bulk delete method', /removeMany|deleteMany|bulk/i],
  ['visible row selection', /visibleRows|VisibleSelection|toggleVisible/],
  ['partial failure handling', /failed/i],
];

const forbiddenHtmlRules = [
  ['raw column label', /\{\{\s*column\s*\}\}/],
  ['old inactive status class', /\[class\.inactive\]/],
  ['inline notes tab hack', /config\(\)\.fields\s*\|\s*json/],
  ['browser confirm', /\bconfirm\s*\(/],
  ['browser alert', /\balert\s*\(/],
];

let failed = false;
const files = args.flatMap(walk);
const htmlFiles = files.filter((file) => extname(file) === '.html');
const tsFiles = files.filter((file) => extname(file) === '.ts');

for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const missing = htmlRules.filter(([, pattern]) => !has(content, pattern)).map(([name]) => name);
  const forbidden = forbiddenHtmlRules
    .filter(([, pattern]) => has(content, pattern))
    .map(([name]) => name);
  if (missing.length || forbidden.length) {
    failed = true;
    console.error(`\n${relative(root, file)}`);
    for (const name of missing) console.error(`  missing: ${name}`);
    for (const name of forbidden) console.error(`  forbidden: ${name}`);
  }
}

for (const file of tsFiles) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes('@Component')) continue;
  if (!content.includes('erp-page') && !htmlFiles.length) continue;
  const missing = tsRules.filter(([, pattern]) => !has(content, pattern)).map(([name]) => name);
  if (missing.length) {
    failed = true;
    console.error(`\n${relative(root, file)}`);
    for (const name of missing) console.error(`  missing: ${name}`);
  }
}

if (failed) process.exit(1);
console.log(`CRUD template validation passed for ${args.join(', ')}`);
