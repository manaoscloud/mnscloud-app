#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: node scripts/validate-crud-i18n.mjs <page-or-file> [...]');
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

function loadDictionary(language) {
  const file = resolve(root, `public/i18n/${language}.json`);
  return JSON.parse(read(file));
}

const dictionaries = {
  'en-US': loadDictionary('en-US'),
  'pt-BR': loadDictionary('pt-BR'),
  'es-ES': loadDictionary('es-ES'),
};

function hasLetters(value) {
  return /\p{L}/u.test(value);
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isDynamic(value) {
  return value.includes('{{') || value.includes('| transloco') || value.includes('@');
}

function isIconText(fullTag, text) {
  return /<mat-icon\b/i.test(fullTag) || /^[a-z0-9_]+$/.test(text.trim());
}

function collectTemplateKeys(content) {
  const keys = new Set();
  for (const match of content.matchAll(/['"]([^'"]+)['"]\s*\|\s*transloco/g)) {
    keys.add(match[1]);
  }
  return keys;
}

function collectTsKeys(content) {
  const keys = new Set();
  for (const match of content.matchAll(/\bthis\.t\(\s*['"]([^'"]+)['"]/g)) {
    keys.add(match[1]);
  }
  return keys;
}

function validateKeys(file, keys) {
  const errors = [];
  for (const key of keys) {
    for (const [language, dictionary] of Object.entries(dictionaries)) {
      if (!Object.hasOwn(dictionary, key)) {
        errors.push(`${relative(root, file)} missing ${language} translation: ${key}`);
      }
    }
  }
  return errors;
}

function isCrudComponentDirectory(directory, tsFiles) {
  return tsFiles.some((file) => {
    if (dirname(file) !== directory) return false;
    const content = read(file);
    return content.includes('@Component') && content.includes('ConfigurableCrudPageBase');
  });
}

function validateHtml(file, tsFiles) {
  const content = read(file);
  const errors = [];

  // Public invitation/account screens may live next to a CRUD page. This validator is scoped to
  // CRUD templates and their configured visible labels, not to standalone public flows.
  if (!content.includes('class="erp-page')) return errors;
  if (!isCrudComponentDirectory(dirname(file), tsFiles)) return errors;

  for (const match of content.matchAll(/<([a-zA-Z][\w:-]*)\b[^>]*>([^<>{}][^<>]*?)<\/\1>/g)) {
    const [full, tagName, rawText] = match;
    const text = normalizeText(rawText);
    if (!text || !hasLetters(text) || isDynamic(text) || isIconText(full, text)) continue;
    errors.push(`${relative(root, file)} raw visible text: ${text}`);
  }

  const rawAttrPattern =
    /\s(placeholder|matTooltip|aria-label|title|label|emptyLabel|loadingLabel)="([^"]*\p{L}[^"]*)"/gu;
  for (const match of content.matchAll(rawAttrPattern)) {
    const [, attr, value] = match;
    const before = content.slice(Math.max(0, match.index - 2), match.index + attr.length + 2);
    if (before.includes(`[${attr}]`) || isDynamic(value)) continue;
    errors.push(`${relative(root, file)} raw ${attr}: ${value}`);
  }

  errors.push(...validateKeys(file, collectTemplateKeys(content)));
  return errors;
}

function validateTs(file) {
  return validateKeys(file, collectTsKeys(read(file)));
}

let failed = false;
const files = args.flatMap(walk);
const targets = files.filter((file) => ['.html', '.ts'].includes(extname(file)));
const tsFiles = targets.filter((file) => extname(file) === '.ts');

for (const file of targets) {
  const errors = extname(file) === '.html' ? validateHtml(file, tsFiles) : validateTs(file);
  if (!errors.length) continue;
  failed = true;
  console.error(`\n${relative(root, file)}`);
  for (const error of errors) console.error(`  ${error}`);
}

if (failed) process.exit(1);
console.log(`CRUD i18n validation passed for ${args.join(', ')}`);
