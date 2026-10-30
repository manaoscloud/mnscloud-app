#!/usr/bin/env node
// Navigation Label Contract gate (app.md → Navigation Label Contract). Every sidebar entry in
// src/app/layout/navigation/nav-registry.ts is checked in every runtime locale: `nav.<id>` keys,
// no repetition of ancestor context, length budget per level, sentence case, glossary terms and
// tree shape, plus the Navigation Structure (area titles of the root modules and category titles
// inside a module, app.md). There is no allowlist: rename the label or restructure the tree instead.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

export const REGISTRY_PATH = 'src/app/layout/navigation/nav-registry.ts';
export const GLOSSARY_PATH = 'src/app/layout/navigation/nav-glossary.json';

export function navLabelKey(id) {
  return `nav.${id.replace(/\//g, '.')}`;
}

export const navAreaKey = (area) => `nav.area.${area}`;
export const navCategoryKey = (category) => `nav.category.${category}`;

/** Only the platform master sees the entry (a group: all of its children). */
export function isMasterOnly(item) {
  if (item.scope === 'master') return true;
  if (item.children?.length) return item.children.every(isMasterOnly);
  return Boolean(item.masterRoute) && !item.route && item.scope !== 'both';
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

const fold = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function tokens(label, stopWords) {
  return fold(label)
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !stopWords.has(word))
    .map((word) => word.replace(/(oes|aes|ais|eis|ns|es|s)$/, '') || word);
}

/**
 * Same word stem as an ancestor: equal, or a prefix/suffix of at least 4 letters
 * (Fatura/Faturamento, Host/Webhosts, Cliente/Clientes).
 */
export function sharesStem(word, ancestor) {
  if (word === ancestor) return true;
  const [short, long] = word.length <= ancestor.length ? [word, ancestor] : [ancestor, word];
  return short.length >= 4 && (long.startsWith(short) || long.endsWith(short));
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
  const areas = glossary.areas ?? [];
  const standard = glossary.categories?.standard ?? [];
  const categories = new Set([...standard, ...(glossary.categories?.domain ?? [])]);
  const smallListCategories = new Set(glossary.smallListCategories ?? []);

  // Every label rule of the contract, for an entry, an area title or a category title.
  const checkLabel = ({ where, key, depth, ancestorKeys, leaf }) => {
    usedKeys.add(key);
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
        ancestorKeys.flatMap((ancestor) =>
          tokens(dictionaries[locale]?.[ancestor] ?? '', stopWords),
        ),
      );
      const repeated = tokens(label, stopWords).filter((t) =>
        [...ancestorTokens].some((ancestor) => sharesStem(t, ancestor)),
      );
      if (repeated.length) {
        errors.push(
          `${at}: repeats ancestor context (${repeated.join(', ')}); the parent already implies it`,
        );
      }

      // Sentence case: the first word starts upper case; later words (also after "/") do not.
      const first = label.split(/\s+/)[0];
      if (/^\p{Ll}/u.test(first) && !isAllowedCapital(first, allowedCapitals)) {
        errors.push(`${at}: start with an upper-case letter`);
      }
      const words = label
        .split(/\s+/)
        .flatMap((word, index) =>
          allowedCapitals.has(word) ? [] : word.split('/').slice(index === 0 ? 1 : 0),
        );
      const badCase = words.filter(
        (w) => /^\p{Lu}/u.test(w) && !isAllowedCapital(w, allowedCapitals),
      );
      if (badCase.length) errors.push(`${at}: use sentence case (${badCase.join(', ')})`);

      // Collections are nouns: no actions such as "Allow/block" or "Reconcile".
      const verbs = new Set((glossary.forbiddenVerbs?.[locale] ?? []).map(fold));
      const actions = fold(label)
        .split(/[^a-z0-9]+/)
        .filter((word) => verbs.has(word));
      if (actions.length) {
        errors.push(`${at}: use a noun, not the action (${actions.join(', ')})`);
      }

      // English leftovers: a pt-BR/es-ES word equal to the en-US one must be a glossary term.
      if (locale !== 'en-US') {
        const english = new Set(
          fold(dictionaries['en-US']?.[key] ?? '')
            .split(/[^a-z0-9]+/)
            .filter((word) => word.length >= 3),
        );
        const glossaryWords = new Set(
          [...allowedCapitals, ...(glossary.sharedTerms ?? [])].map(fold),
        );
        const leftovers = label
          .split(/[\s/]+/)
          .filter(
            (word) =>
              english.has(fold(word)) &&
              !glossaryWords.has(fold(word)) &&
              !/\d/.test(word) &&
              (word.match(/\p{Lu}/gu) ?? []).length < 2,
          );
        if (leftovers.length) {
          errors.push(
            `${at}: English word without a glossary entry (${leftovers.join(', ')}); translate it or add it to productTerms/sharedTerms`,
          );
        }
      }

      for (const forbidden of glossary.forbiddenLabels[locale] ?? []) {
        if (fold(label) === fold(forbidden))
          errors.push(`${at}: "${forbidden}" is not a glossary term`);
      }
      for (const term of glossary.forbiddenTerms[locale] ?? []) {
        if (fold(` ${label} `).includes(fold(term))) {
          errors.push(`${at}: contains forbidden term "${term.trim()}"`);
        }
      }

      const canonical = leaf ? glossary.canonicalLeaves[leaf]?.[locale] : undefined;
      if (canonical && label !== canonical)
        errors.push(`${at}: must use the canonical "${canonical}"`);
    }
  };

  // Category titles of one sibling list: vocabulary, one block per category, uncategorized
  // entries only before the first title, standard order, small lists and master-only Plataforma.
  const checkCategories = (where, list, depth, ancestorKeys) => {
    const firstTitled = list.findIndex((child) => child.category);
    if (firstTitled < 0) return;
    const seen = new Set();
    let previous;
    let lastStandard = -1;
    for (const [index, child] of list.entries()) {
      const at = `${where} › ${child.id}`;
      if (!child.category) {
        if (index > firstTitled)
          errors.push(`${at}: entries without a category go before the first category title`);
        continue;
      }
      if (!categories.has(child.category)) {
        errors.push(`${at}: unknown category "${child.category}" (nav-glossary.json categories)`);
        continue;
      }
      if (child.category !== previous) {
        if (seen.has(child.category))
          errors.push(`${at}: category "${child.category}" is split; keep its entries together`);
        seen.add(child.category);
        checkLabel({
          where: `${where} category ${child.category}`,
          key: navCategoryKey(child.category),
          depth,
          ancestorKeys,
        });
      }
      previous = child.category;
      const rank = standard.indexOf(child.category);
      if (rank >= 0) {
        if (rank < lastStandard)
          errors.push(
            `${at}: category "${child.category}" is out of the standard order (${standard.join(' → ')})`,
          );
        lastStandard = Math.max(lastStandard, rank);
      }
      if (list.length <= glossary.smallListMax && !smallListCategories.has(child.category)) {
        errors.push(
          `${at}: a list of ${list.length} entries only uses the ${[...smallListCategories].join('/')} categories`,
        );
      }
      if (child.category === 'platform' && !isMasterOnly(child)) {
        errors.push(`${at}: the platform category holds only master-only entries`);
      }
    }
  };

  const visit = (item, ancestors) => {
    const depth = ancestors.length;
    const where = item.id ?? '(missing id)';
    if (!item.id) errors.push(`entry without id under ${ancestors.map((a) => a.id).join('/')}`);
    if (ids.has(item.id)) errors.push(`${where}: duplicate id`);
    ids.add(item.id);
    if (/^(area|category)(\/|$)/.test(item.id ?? ''))
      errors.push(`${where}: "area" and "category" are reserved key namespaces`);

    const key = navLabelKey(item.id ?? '');
    if (item.label !== key) errors.push(`${where}: label must be the key "${key}"`);
    if (depth + 1 > glossary.maxDepth) {
      errors.push(`${where}: level ${depth + 1} exceeds the ${glossary.maxDepth}-level limit`);
    }
    if (item.children && item.children.length < 2) {
      errors.push(`${where}: a group needs at least 2 children; flatten it into its parent`);
    }
    if (depth > 0 && item.area) errors.push(`${where}: only root modules have an area`);
    if (depth === 0 && item.category)
      errors.push(`${where}: root modules have an area, not a category`);

    const ancestorKeys = [
      ...ancestors.map((a) => navLabelKey(a.id)),
      ...(item.category ? [navCategoryKey(item.category)] : []),
    ];
    checkLabel({ where, key, depth, ancestorKeys, leaf: item.id?.split('/').pop() });

    // The dashboard entry always comes first in its module.
    const dashboard = (item.children ?? []).findIndex((child) => child.id?.endsWith('dashboard'));
    if (dashboard > 0) errors.push(`${where}: the dashboard entry must be the first child`);

    if (item.children) {
      checkCategories(where, item.children, depth + 1, [
        ...ancestors.map((a) => navLabelKey(a.id)),
        key,
      ]);
    }
    for (const child of item.children ?? []) visit(child, [...ancestors, item]);
  };

  // Root modules: every module after the first (Painel) sits under an area, in area order.
  let lastArea = -1;
  const seenAreas = new Set();
  let previousArea;
  for (const [index, item] of items.entries()) {
    if (!item.area) {
      if (index > 0) errors.push(`${item.id}: root modules after the first need an area`);
      continue;
    }
    const rank = areas.indexOf(item.area);
    if (rank < 0) {
      errors.push(`${item.id}: unknown area "${item.area}" (nav-glossary.json areas)`);
      continue;
    }
    if (item.area !== previousArea) {
      if (seenAreas.has(item.area)) errors.push(`${item.id}: area "${item.area}" is split`);
      seenAreas.add(item.area);
      checkLabel({
        where: `area ${item.area}`,
        key: navAreaKey(item.area),
        depth: 0,
        ancestorKeys: [],
      });
    }
    if (rank < lastArea)
      errors.push(`${item.id}: area "${item.area}" is out of order (${areas.join(' → ')})`);
    lastArea = Math.max(lastArea, rank);
    previousArea = item.area;
  }

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
