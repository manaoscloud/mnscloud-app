#!/usr/bin/env node
/**
 * Page Description Contract (app.md): every page header explains what the resource is for.
 * Checks, app-wide and without an allowlist:
 *  - every CRUD config `pageDescription` is a non-empty, translated literal (pt-BR, en-US, es-ES)
 *    that differs from its `pageTitle`; template literals may only interpolate record data (no
 *    untranslated words) and other expressions are left to the TypeScript type;
 *  - every <mns-dashboard-page>, <mns-settings-page>, <mns-detail-page> and <mns-page-shell>
 *    declares a description (literal ones must be translated);
 *  - hand-written `erp-header` blocks contain a description paragraph.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const locales = ['pt-BR', 'en-US', 'es-ES'];
const dictionaries = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(root, 'public', 'i18n', `${locale}.json`), 'utf8')),
  ]),
);
const SHELLS = [
  'mns-dashboard-page',
  'mns-settings-page',
  'mns-detail-page',
  'mns-page-shell',
  'mns-metrics-monitor',
];

function walk(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|html)$/.test(name) && !/\.spec\.ts$/.test(name)) files.push(path);
  }
  return files;
}

/** Reads the string literal (or template literal) starting at `index`; null for other expressions. */
export function readLiteral(source, index) {
  let i = index;
  while (/\s/.test(source[i])) i++;
  const quote = source[i];
  if (!["'", '"', '`'].includes(quote)) return null;
  let value = '';
  for (i++; i < source.length; i++) {
    if (source[i] === '\\') {
      value += source[++i];
      continue;
    }
    if (source[i] === quote) return { quote, value };
    value += source[i];
  }
  return null;
}

/** Flat keys first, then Transloco nested objects (`group.key`). */
function lookup(dictionary, key) {
  if (key in dictionary) return dictionary[key];
  return key
    .split('.')
    .reduce(
      (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
      dictionary,
    );
}

function missingLocales(key) {
  return locales.filter(
    (locale) =>
      typeof lookup(dictionaries[locale], key) !== 'string' ||
      !lookup(dictionaries[locale], key).trim(),
  );
}

export function checkSource(path, source) {
  const problems = [];
  const file = relative(root, path);
  if (path.endsWith('.ts')) {
    for (const match of source.matchAll(/\bpageDescription\s*:/g)) {
      const literal = readLiteral(source, match.index + match[0].length);
      const line = source.slice(0, match.index).split('\n').length;
      if (!literal) continue;
      if (literal.quote === '`') {
        // Only record data may be interpolated: static words would never be translated.
        const statics = literal.value.replace(/\$\{[^}]*\}/g, '');
        if (/[A-Za-zÀ-ÿ]{2,}/.test(statics)) {
          problems.push(
            `${file}:${line} pageDescription interpolates untranslated text; use a translation key per variant.`,
          );
        }
        continue;
      }
      if (!literal.value.trim()) {
        problems.push(
          `${file}:${line} pageDescription is empty; describe what the resource is for.`,
        );
        continue;
      }
      const missing = missingLocales(literal.value);
      if (missing.length) {
        problems.push(
          `${file}:${line} pageDescription "${literal.value}" has no translation in ${missing.join(', ')}.`,
        );
      }
      // The nearest preceding pageTitle of the same config must not say the same thing.
      const before = source.slice(Math.max(0, match.index - 1500), match.index);
      const title = [...before.matchAll(/\bpageTitle\s*:\s*(['"])([^'"]*)\1/g)].pop()?.[2];
      if (title && translated(title) === translated(literal.value)) {
        problems.push(`${file}:${line} pageDescription repeats the page title.`);
      }
    }
  }
  // Page shells live in .html templates and in inline `template:` strings of components.
  {
    for (const shell of SHELLS) {
      for (const match of source.matchAll(new RegExp(`<${shell}\\b([^>]*)>`, 'g'))) {
        const attributes = match[1];
        const line = source.slice(0, match.index).split('\n').length;
        const plain = attributes.match(/(?:^|\s)description="([^"]*)"/);
        const bound = attributes.match(/\[description\]="([^"]*)"/);
        if (!plain && !bound) {
          problems.push(`${file}:${line} <${shell}> has no description.`);
          continue;
        }
        const value = plain ? plain[1] : bound[1].match(/^\s*'([^']*)'\s*$/)?.[1];
        if (value === undefined) continue;
        if (!value.trim()) {
          problems.push(`${file}:${line} <${shell}> description is empty.`);
          continue;
        }
        const missing = missingLocales(value);
        if (missing.length) {
          problems.push(
            `${file}:${line} <${shell}> description "${value}" has no translation in ${missing.join(', ')}.`,
          );
        }
      }
    }
    for (const match of source.matchAll(/<div class="erp-header">/g)) {
      const header = source.slice(match.index, source.indexOf('</h1>', match.index) + 400);
      const line = source.slice(0, match.index).split('\n').length;
      if (!/<p[\s>]/.test(header)) {
        problems.push(`${file}:${line} erp-header has no description paragraph.`);
      }
    }
  }
  return problems;
}

function translated(key) {
  return String(lookup(dictionaries['pt-BR'], key) ?? key)
    .trim()
    .toLowerCase();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = walk(join(root, 'src', 'app'));
  const problems = files.flatMap((path) => checkSource(path, readFileSync(path, 'utf8')));
  if (problems.length) {
    console.error(`Page descriptions failed (${problems.length}):\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log(`Page descriptions passed for ${files.length} source files.`);
}
