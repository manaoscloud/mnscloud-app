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
  ['refresh action', /<app-refresh-button\b|<mat-icon>\s*refresh\s*<\/mat-icon>/],
  ['new action', /<mat-icon>\s*add\s*<\/mat-icon>/],
  ['filter grid', 'filter-grid'],
  ['filter actions row', 'filter-actions'],
  ['apply icon', /<mat-icon>\s*filter_alt\s*<\/mat-icon>/],
  ['clear icon', /<mat-icon>\s*backspace\s*<\/mat-icon>/],
  ['table wrapper elevation', /class="[^"]*\btable-wrapper\b[^"]*\bmat-elevation-z8\b[^"]*"/],
  ['table loading binding', '[class.is-loading]'],
  ['table loading overlay', 'table-loading'],
  ['mat table sort', /<table[^>]*mat-table[^>]*matSort/],
  ['signal table data source', /\[dataSource\]="visibleRows\(\)"/],
  ['select column class', 'select-col'],
  ['status column class', 'status-col'],
  ['actions column header class', 'actions-col-header'],
  ['actions column cell class', 'actions-col-cell'],
  ['actions column wrapper', 'actions-col'],
  ['record main line', 'record-main'],
  ['record uuid line', 'record-uuid'],
  ['status pill', 'status-pill'],
  ['status chip variant', 'status-chip'],
  ['status chip state class', /chip-success|chip-running|chip-queued|chip-failed|chip-skipped/],
  ['active status class', 'is-active'],
  ['inactive status class', 'is-inactive'],
  [
    'real paginator',
    /<mat-paginator[^>]*class="[^"]*\bmobile-paginator\b[^"]*"[^>]*showFirstLastButtons/,
  ],
  ['no data row', '*matNoDataRow'],
  ['crud dialog root', 'crud-dialog'],
  ['dialog header', 'dialog-header'],
  ['dialog content', 'dialog-content'],
  ['form tabs', 'form-tabs'],
  ['translated record tab label', /<mat-tab[^>]*\[label\]="'Record'\s*\|\s*transloco"/],
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
  ['default change detection baseline', /@Component\(/],
  ['DestroyRef', 'DestroyRef'],
  ['signal query api', /viewChild|viewChildren/],
  ['shared dialog closed binding', 'bindDialogClosed'],
  ['resource read model', /resource\s*\(/],
  [
    'computed visible rows',
    /visibleRows\s*=\s*computed|visibleRows\s*=\s*this\.table\.visibleRows/,
  ],
  [
    'sort state signals',
    /sortActive\s*=\s*signal|sortDirection\s*=\s*signal|sortActive\s*=\s*this\.table\.sortActive|sortDirection\s*=\s*this\.table\.sortDirection/,
  ],
  [
    'page state signals',
    /pageIndex\s*=\s*signal|pageSize\s*=\s*signal|pageIndex\s*=\s*this\.table\.pageIndex|pageSize\s*=\s*this\.table\.pageSize/,
  ],
  ['explicit sort handler', /setSort\s*\(/],
  ['explicit page handler', /setPage\s*\(/],
  ['openCrudTemplateDialog', 'openCrudTemplateDialog'],
  ['SlowConfirmDialogComponent', 'SlowConfirmDialogComponent'],
  ['bulk delete method', /removeMany|deleteMany|bulk/i],
  ['visible row selection', /visibleRows|VisibleSelection|toggleVisible/],
  ['partial failure handling', /failed/i],
];

const fkHtmlRules = [['shared FK search select adapter', '<mns-search-select-field']];

const fkTsRules = [
  ['shared FK search select import', 'MnsSearchSelectFieldComponent'],
  ['shared FK search select option type', 'MnsSearchSelectFieldOption'],
];

const forbiddenHtmlRules = [
  ['raw column label', /\{\{\s*column\s*\}\}/],
  ['native external dialog form submit', /<button\b[^>]*\btype="submit"[^>]*\bform="[^"]+"/i],
  ['legacy data tab label', /<mat-tab[^>]*\[label\]="'Data'\s*\|\s*t"/],
  ['legacy data tab transloco label', /<mat-tab[^>]*\[label\]="'Data'\s*\|\s*transloco"/],
  ['legacy details tab label', /<mat-tab[^>]*\[label\]="'Details'\s*\|\s*t"/],
  ['legacy details tab transloco label', /<mat-tab[^>]*\[label\]="'Details'\s*\|\s*transloco"/],
  ['legacy t pipe alias', /\|\s*t\b/],
  ['old inactive status class', /\[class\.inactive\]/],
  ['inline notes tab hack', /config\(\)\.fields\s*\|\s*json/],
  ['page-local searchable select block', /select-search-option|select-search-field/],
  ['browser confirm', /\bconfirm\s*\(/],
  ['browser alert', /\balert\s*\(/],
];

const forbiddenTsRules = [
  ['manual ChangeDetectorRef injection', /ChangeDetectorRef/],
  ['manual detectChanges call', /\bdetectChanges\s*\(/],
  ['decorator ViewChild query', /@ViewChild\b/],
  ['decorator ViewChildren query', /@ViewChildren\b/],
  ['legacy OnDestroy lifecycle', /\bimplements\s+OnDestroy\b|\bngOnDestroy\s*\(/],
  ['legacy AfterViewInit lifecycle', /\bimplements\s+AfterViewInit\b|\bngAfterViewInit\s*\(/],
  ['Angular animations import', /@angular\/animations/],
  [
    'constructor dependency injection',
    /constructor\s*\([^)]*(private|public|protected|readonly)\s+/s,
  ],
  ['ngx-translate residue', /ngx-translate|TranslateService|TranslateModule/],
  ['MatTableDataSource residue', /MatTableDataSource/],
];

let failed = false;
const files = args.flatMap(walk);
const htmlFiles = files.filter((file) => extname(file) === '.html');
const tsFiles = files.filter((file) => extname(file) === '.ts');
const combinedTs = tsFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const configurableCrudBase = readFileSync(
  resolve(root, 'src/app/shared/crud/configurable-crud/configurable-crud-page-base.ts'),
  'utf8',
);
const requiresFkSearchSelect =
  /\blookup\b|domainLookupEnabled|SelectOptions|UUID['"]?,\s*label|realtimeDomainUUID|serverUUID|providerUUID|customerUUID|TenantUUID|EnvironmentUUID/.test(
    combinedTs,
  );

for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  // Public pages can share a feature folder with a CRUD page without being CRUDs themselves.
  if (!content.includes('class="erp-page')) continue;
  const requiredHtmlRules = requiresFkSearchSelect ? [...htmlRules, ...fkHtmlRules] : htmlRules;
  const missing = requiredHtmlRules
    .filter(([, pattern]) => !has(content, pattern))
    .map(([name]) => name);
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
  if (!content.includes('ConfigurableCrudPageBase')) continue;
  const requiredTsRules = requiresFkSearchSelect ? [...tsRules, ...fkTsRules] : tsRules;
  const inheritedContent = `${content}\n${combinedTs}\n${configurableCrudBase}`;
  const missing = requiredTsRules
    .filter(([, pattern]) => !has(inheritedContent, pattern))
    .map(([name]) => name);
  const forbidden = forbiddenTsRules
    .filter(([, pattern]) => has(content, pattern))
    .map(([name]) => name);
  if (missing.length || forbidden.length) {
    failed = true;
    console.error(`\n${relative(root, file)}`);
    for (const name of missing) console.error(`  missing: ${name}`);
    for (const name of forbidden) console.error(`  forbidden: ${name}`);
  }
}

if (failed) process.exit(1);
console.log(`CRUD template validation passed for ${args.join(', ')}`);
