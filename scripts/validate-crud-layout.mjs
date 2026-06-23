#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const args = process.argv.slice(2);

if (!args.length) {
  console.error(
    'Usage: node scripts/validate-crud-layout.mjs <page-or-file> [...] | --changed <base> <head>',
  );
  process.exit(2);
}

function walk(target) {
  const full = resolve(root, target);
  if (!existsSync(full)) return [];
  const stat = statSync(full);
  if (stat.isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const path = join(full, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function changedFiles(base, head) {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
    cwd: root,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function nearestCrudRoot(file) {
  let current = dirname(resolve(root, file));
  while (current.startsWith(resolve(root, 'src/app/pages'))) {
    const htmlFiles = readdirSync(current, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
      .map((entry) => join(current, entry.name));
    if (htmlFiles.some((html) => read(html).includes('class="erp-page'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function targetsFromArgs() {
  if (args[0] !== '--changed') return args.map((arg) => resolve(root, arg));
  const [, base, head] = args;
  if (!base || !head) {
    console.error('Usage: node scripts/validate-crud-layout.mjs --changed <base> <head>');
    process.exit(2);
  }
  const roots = new Set();
  for (const file of changedFiles(base, head)) {
    if (!/^src\/app\/pages\/.*\.(html|scss|ts)$/.test(file)) continue;
    const rootDir = nearestCrudRoot(file);
    if (rootDir) roots.add(rootDir);
  }
  return [...roots];
}

function classRule(name) {
  return new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`);
}

const requiredHtmlRules = [
  ['page root', classRule('erp-page')],
  ['card root', /<mat-card[^>]*class="[^"]*\berp-card\b[^"]*"/],
  ['header', classRule('erp-header')],
  ['header actions', classRule('header-actions')],
];

const requiredFilterRules = [
  ['filter grid', classRule('filter-grid')],
  ['filter actions row', classRule('filter-actions')],
];

const forbiddenLocalScssRules = [
  ['erp-page local layout override', /^\s*\.erp-page\s*[{,]/m],
  ['erp-card local layout override', /^\s*\.erp-card\s*[{,]/m],
  ['erp-header local layout override', /^\s*\.erp-header\s*[{,]/m],
  ['header-actions local layout override', /^\s*\.header-actions\s*[{,]/m],
  ['filter-grid local layout override', /^\s*\.filter-grid\s*[{,]/m],
  ['filter-actions local layout override', /^\s*\.filter-actions\s*[{,]/m],
];

const forbiddenHtmlRules = [
  [
    'native external dialog form submit',
    /<button\b[^>]*\btype="submit"[^>]*\bform="[^"]+"/i,
  ],
];

function filterGridBlocks(content) {
  const blocks = [];
  const openTag = /<([a-zA-Z][\w:-]*)[^>]*class="[^"]*\bfilter-grid\b[^"]*"[^>]*>/g;
  let match;
  while ((match = openTag.exec(content))) {
    const gridTagName = match[1];
    let cursor = openTag.lastIndex;
    let depth = 1;
    const tag = new RegExp(`<\\/?${gridTagName}\\b[^>]*>`, 'g');
    tag.lastIndex = cursor;
    let tagMatch;
    while ((tagMatch = tag.exec(content))) {
      if (tagMatch[0].startsWith('</')) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        blocks.push(content.slice(match.index, tag.lastIndex));
        cursor = tag.lastIndex;
        break;
      }
    }
    openTag.lastIndex = cursor;
  }
  return blocks;
}

function withoutFilterActions(block) {
  return block.replace(/<div[^>]*class="[^"]*\bfilter-actions\b[^"]*"[\s\S]*?<\/div>/g, '');
}

function hasSearchFilter(block) {
  const fieldsOnly = withoutFilterActions(block);
  const firstField = fieldsOnly.match(/<mat-form-field\b[\s\S]*?<\/mat-form-field>/)?.[0] ?? '';
  return (
    /(['"])Search\1\s*\|\s*transloco/.test(firstField) ||
    />\s*Search\s*</i.test(firstField) ||
    /placeholder\]?\s*=\s*(['"])[^'"]*Search[^'"]*\1/i.test(firstField)
  );
}

function hasStatusSurface(content) {
  return (
    /matColumnDef="status"/i.test(content) ||
    /\bstatusOptions\b/.test(content) ||
    /\brecordStatusOptions\b/.test(content) ||
    /\bstatus-col\b/.test(content)
  );
}

function hasStatusFilter(block) {
  const fieldsOnly = withoutFilterActions(block);
  return (
    /(['"])Status\1\s*\|\s*transloco/.test(fieldsOnly) ||
    />\s*Status\s*</i.test(fieldsOnly)
  );
}

function hasForbiddenFilterSpan(block) {
  const fieldsOnly = withoutFilterActions(block);
  return /class="[^"]*\bspan-[234]\b[^"]*"/.test(fieldsOnly);
}

function hasImplicitFilterSpan(block) {
  const fieldsOnly = withoutFilterActions(block);
  const fieldTags = [
    ...fieldsOnly.matchAll(/<(mat-form-field|mns-[\w-]*field)\b([^>]*)>/g),
  ];
  return fieldTags.some(
    ([, , attrs]) =>
      !/\bclass="[^"]*\bspan-1\b[^"]*"/.test(attrs) &&
      !/\bfieldClass="[^"]*\bspan-1\b[^"]*"/.test(attrs),
  );
}

function validateTarget(target) {
  const files = walk(relative(root, target));
  const htmlFiles = files.filter((file) => extname(file) === '.html');
  const scssFiles = files.filter((file) => extname(file) === '.scss');
  const rootHtmlFiles = htmlFiles.filter((file) => read(file).includes('class="erp-page'));
  const errors = [];

  for (const htmlFile of rootHtmlFiles) {
    const content = read(htmlFile);
    for (const [name, pattern] of requiredHtmlRules) {
      if (!pattern.test(content)) errors.push(`${relative(root, htmlFile)} missing: ${name}`);
    }
    for (const [name, pattern] of forbiddenHtmlRules) {
      if (pattern.test(content)) errors.push(`${relative(root, htmlFile)} forbidden: ${name}`);
    }

    const requiresFilters =
      content.includes('filter-grid') ||
      content.includes('mat-table') ||
      content.includes('mat-paginator');
    if (requiresFilters) {
      for (const [name, pattern] of requiredFilterRules) {
        if (!pattern.test(content)) errors.push(`${relative(root, htmlFile)} missing: ${name}`);
      }
    }

    if (content.includes('filter-grid')) {
      const blocks = filterGridBlocks(content);
      const hasActionsInsideGrid = blocks.some((block) => classRule('filter-actions').test(block));
      if (!hasActionsInsideGrid) {
        errors.push(
          `${relative(root, htmlFile)} invalid: filter-actions must be inside filter-grid`,
        );
      }
      const missingSearch = blocks.some((block) => !hasSearchFilter(block));
      if (missingSearch) {
        errors.push(
          `${relative(root, htmlFile)} invalid: first filter control must be Search`,
        );
      }
      if (hasStatusSurface(content) && blocks.some((block) => !hasStatusFilter(block))) {
        errors.push(
          `${relative(root, htmlFile)} invalid: resources with status must include a Status filter`,
        );
      }
      if (blocks.some((block) => hasForbiddenFilterSpan(block))) {
        errors.push(
          `${relative(root, htmlFile)} invalid: normal filter controls must not use span-2/span-3/span-4 unless explicitly requested`,
        );
      }
      if (blocks.some((block) => hasImplicitFilterSpan(block))) {
        errors.push(
          `${relative(root, htmlFile)} invalid: normal filter controls must explicitly declare span-1`,
        );
      }
      if (!/<mat-icon>\s*filter_alt\s*<\/mat-icon>/.test(content)) {
        errors.push(`${relative(root, htmlFile)} missing: apply filter_alt icon`);
      }
      if (!/<mat-icon>\s*backspace\s*<\/mat-icon>/.test(content)) {
        errors.push(`${relative(root, htmlFile)} missing: clear backspace icon`);
      }
    }
  }

  for (const scssFile of scssFiles) {
    const content = read(scssFile);
    for (const [name, pattern] of forbiddenLocalScssRules) {
      if (pattern.test(content)) errors.push(`${relative(root, scssFile)} forbidden: ${name}`);
    }
  }

  return errors;
}

const targets = targetsFromArgs();
let failed = false;
for (const target of targets) {
  const errors = validateTarget(target);
  if (!errors.length) continue;
  failed = true;
  console.error(`\n${relative(root, target) || '.'}`);
  for (const error of errors) console.error(`  ${error}`);
}

if (failed) process.exit(1);
console.log(`CRUD layout validation passed for ${targets.length} target(s).`);
