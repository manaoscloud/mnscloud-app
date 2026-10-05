#!/usr/bin/env node
// Navigation Label Contract gate (app.md → Navigation Label Contract). Every sidebar entry in
// src/app/layout/navigation/nav-registry.ts is checked in every runtime locale: `nav.<id>` keys,
// no repetition of ancestor context, length budget per level, sentence case, glossary terms and
// tree shape. There is no allowlist: rename the label or restructure the tree instead.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

export const REGISTRY_PATH = 'src/app/layout/navigation/nav-registry.ts';
export const GLOSSARY_PATH = 'src/app/layout/navigation/nav-glossary.json';

export function navLabelKey(id) {
  return `nav.${id.replace(/\//g, '.')}`;
}

function literalValue(node, file) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((el) => literalValue(el, file));
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop))
        throw new Error(`${file}: registry entries must be data only`);
      value[prop.name.getText()] = literalValue(prop.initializer, file);
    }
    return value;
  }
  const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  throw new Error(
    `${file}:${line + 1}: registry values must be literals, found "${node.getText()}"`,
  );
}

export function readRegistry(source, file = REGISTRY_PATH) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (decl.name.getText() === 'NAV_ITEMS' && decl.initializer) {
        return literalValue(decl.initializer, file);
      }
    }
  }
  throw new Error(`${file}: NAV_ITEMS array not found`);
}

const fold = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function tokens(label, stopWords) {
  return fold(label)
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !stopWords.has(word))
    .map((word) => word.replace(/(oes|aes|ais|eis|ns|es|s)$/, '') || word);
}

function isAllowedCapital(word, allowed) {
  const bare = word.replace(/[^\p{L}\p{N}/]/gu, '');
  if (!bare || allowed.has(bare)) return true;
  // Acronyms and technical identifiers: two or more capitals or a digit (IPv4, PPPoE, SIP).
  return (bare.match(/\p{Lu}/gu) ?? []).length > 1 || /\d/.test(bare);
}

export function validateNavigation({ items, dictionaries, glossary }) {
  const errors = [];
  const ids = new Set();
  const usedKeys = new Set();
  const allowedCapitals = new Set([...glossary.properNouns, ...glossary.productTerms]);

  const visit = (item, ancestors) => {
    const depth = ancestors.length;
    const where = item.id ?? '(missing id)';
    if (!item.id) errors.push(`entry without id under ${ancestors.map((a) => a.id).join('/')}`);
    if (ids.has(item.id)) errors.push(`${where}: duplicate id`);
    ids.add(item.id);

    const key = navLabelKey(item.id ?? '');
    usedKeys.add(key);
    if (item.label !== key) errors.push(`${where}: label must be the key "${key}"`);
    if (depth + 1 > glossary.maxDepth) {
      errors.push(`${where}: level ${depth + 1} exceeds the ${glossary.maxDepth}-level limit`);
    }
    if (item.children && item.children.length < 2) {
      errors.push(`${where}: a group needs at least 2 children; flatten it into its parent`);
    }

    for (const locale of glossary.locales) {
      const label = dictionaries[locale]?.[key];
      if (typeof label !== 'string' || !label.trim()) {
        errors.push(`${where}: missing ${locale} translation for "${key}"`);
        continue;
      }
      const at = `${where} [${locale}] "${label}"`;
      const stopWords = new Set(glossary.stopWords[locale] ?? []);

      const budget =
        glossary.maxLengthByLevel[Math.min(depth, glossary.maxLengthByLevel.length - 1)];
      if ([...label].length > budget) {
        errors.push(
          `${at}: ${[...label].length} chars exceeds the level ${depth + 1} budget of ${budget}`,
        );
      }

      const ancestorTokens = new Set(
        ancestors.flatMap((a) =>
          tokens(dictionaries[locale]?.[navLabelKey(a.id)] ?? '', stopWords),
        ),
      );
      const repeated = tokens(label, stopWords).filter((t) => ancestorTokens.has(t));
      if (repeated.length) {
        errors.push(
          `${at}: repeats ancestor context (${repeated.join(', ')}); the parent already implies it`,
        );
      }

      const words = label.split(/\s+/).slice(1);
      const badCase = words.filter(
        (w) => /^\p{Lu}/u.test(w) && !isAllowedCapital(w, allowedCapitals),
      );
      if (badCase.length) errors.push(`${at}: use sentence case (${badCase.join(', ')})`);

      for (const forbidden of glossary.forbiddenLabels[locale] ?? []) {
        if (fold(label) === fold(forbidden))
          errors.push(`${at}: "${forbidden}" is not a glossary term`);
      }
      for (const term of glossary.forbiddenTerms[locale] ?? []) {
        if (fold(` ${label} `).includes(fold(term))) {
          errors.push(`${at}: contains forbidden term "${term.trim()}"`);
        }
      }

      const leaf = item.id?.split('/').pop();
      const canonical = glossary.canonicalLeaves[leaf]?.[locale];
      if (canonical && label !== canonical)
        errors.push(`${at}: must use the canonical "${canonical}"`);
    }

    for (const child of item.children ?? []) visit(child, [...ancestors, item]);
  };

  for (const item of items) visit(item, []);

  for (const locale of glossary.locales) {
    for (const key of Object.keys(dictionaries[locale] ?? {})) {
      if (key.startsWith('nav.') && !usedKeys.has(key)) {
        errors.push(`[${locale}] orphan navigation key "${key}" is not in the registry`);
      }
    }
  }
  return errors;
}

export function validateNavigationAt(root) {
  const glossary = JSON.parse(readFileSync(resolve(root, GLOSSARY_PATH), 'utf8'));
  const items = readRegistry(readFileSync(resolve(root, REGISTRY_PATH), 'utf8'));
  const dictionaries = {};
  for (const locale of glossary.locales) {
    const path = resolve(root, `public/i18n/${locale}.json`);
    dictionaries[locale] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  }
  return { errors: validateNavigation({ items, dictionaries, glossary }), items };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, items } = validateNavigationAt(process.cwd());
  if (errors.length) {
    console.error(
      'Navigation Label Contract violations (app.md → Navigation Label Contract):\n' +
        errors.map((error) => `  ${error}`).join('\n'),
    );
    process.exit(1);
  }
  const count = (list) => list.reduce((n, i) => n + 1 + count(i.children ?? []), 0);
  console.log(`Navigation labels passed for ${count(items)} menu entries.`);
}
