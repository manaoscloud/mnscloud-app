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
export const SECTIONS_PATH = 'src/app/layout/navigation/nav-sections.ts';
export const WIDTHS_PATH = 'src/app/layout/navigation/nav-label-widths.json';

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
      const name = ts.isStringLiteral(prop.name) ? prop.name.text : prop.name.getText();
      value[name] = literalValue(prop.initializer, file);
    }
    return value;
  }
  const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  throw new Error(
    `${file}:${line + 1}: registry values must be literals, found "${node.getText()}"`,
  );
}

function readConstant(source, file, name) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (decl.name.getText() === name && decl.initializer) {
        return literalValue(decl.initializer, file);
      }
    }
  }
  throw new Error(`${file}: ${name} not found`);
}

export function readRegistry(source, file = REGISTRY_PATH) {
  return readConstant(source, file, 'NAV_ITEMS');
}

/** `NAV_CATEGORY_ICONS` of nav-sections.ts: the icon of each category group row. */
export function readCategoryIcons(source, file = SECTIONS_PATH) {
  return readConstant(source, file, 'NAV_CATEGORY_ICONS');
}

/** Every glossary category has one Material Symbols icon, and no icon names an unknown one. */
export function validateCategoryIcons(icons, glossary) {
  const categories = [
    ...(glossary.categories?.standard ?? []),
    ...(glossary.categories?.domain ?? []),
  ];
  const errors = [];
  for (const category of categories) {
    if (typeof icons[category] !== 'string' || !/^[a-z0-9_]+$/.test(icons[category])) {
      errors.push(
        `category "${category}": missing group icon in NAV_CATEGORY_ICONS (nav-sections.ts)`,
      );
    }
  }
  for (const key of Object.keys(icons)) {
    if (!categories.includes(key)) {
      errors.push(`NAV_CATEGORY_ICONS: "${key}" is not a category of nav-glossary.json`);
    }
  }
  return errors;
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

/**
 * Display tree of the expanded sidebar, as `withCategoryGroups` (nav-sections.ts) builds it: in
 * every group, a category with 2+ entries becomes a group row; a single-entry category is inline.
 */
export function sidebarView(items, parentId = '') {
  const sizes = new Map();
  for (const item of items) {
    if (item.category) sizes.set(item.category, (sizes.get(item.category) ?? 0) + 1);
  }
  const out = [];
  const groups = new Map();
  for (const item of items) {
    const node = {
      ...item,
      children: item.children ? sidebarView(item.children, item.id) : undefined,
    };
    if (parentId && item.category && sizes.get(item.category) > 1) {
      if (!groups.has(item.category)) {
        const group = {
          id: `${parentId}/@${item.category}`,
          label: navCategoryKey(item.category),
          categoryGroup: true,
          children: [],
        };
        groups.set(item.category, group);
        out.push(group);
      }
      groups.get(item.category).children.push(node);
    } else out.push(node);
  }
  return out;
}

/**
 * Rows that open (inner groups and category groups) are one word in every locale: they carry a
 * chevron, and a category group also its page count, so a second word is what gets cut. Root
 * modules keep their product names (checked by width only).
 */
export function validateSingleWordGroups({ items, dictionaries, glossary }) {
  const errors = [];
  const keys = new Map();
  const visit = (list, depth) => {
    for (const item of list) {
      if (item.categoryGroup || (depth > 0 && item.children?.length)) keys.set(item.label, item.id);
      if (item.children) visit(item.children, depth + 1);
    }
  };
  visit(sidebarView(items), 0);
  for (const locale of glossary.locales) {
    for (const [key, id] of keys) {
      const label = dictionaries[locale]?.[key];
      if (typeof label === 'string' && /\s/.test(label.trim())) {
        errors.push(
          `[${locale}] ${id}: "${label}" opens a group and must be one word (app.md → Navigation Label Contract 5)`,
        );
      }
    }
  }
  return errors;
}

const textWidth = (text, glyphs, fontPx) => {
  const widest = Math.max(...Object.values(glyphs));
  let em = 0;
  for (const char of text) em += glyphs[char] ?? widest;
  return em * fontPx;
};

/**
 * No label is truncated (app.md → Navigation Label Contract 5): every row of the expanded sidebar
 * (category groups included, at their real indentation) and of the compact flyouts is measured with
 * the Roboto glyph advances and layout of nav-label-widths.json, in every locale.
 */
export function validateLabelWidths({ items, dictionaries, glossary, widths }) {
  const errors = [];
  const { sidebar, flyout, safetyPx } = widths;
  const check = (locale, id, label, need, have, where) => {
    if (need + safetyPx > have) {
      errors.push(
        `[${locale}] ${id}: "${label}" needs ${Math.ceil(need)}px but the ${where} row has ${Math.floor(have)}px (app.md → Navigation Label Contract 5); shorten it`,
      );
    }
  };
  for (const locale of glossary.locales) {
    const dict = dictionaries[locale] ?? {};
    const expanded = (list, depth, indent) => {
      for (const item of list) {
        const label = dict[item.label];
        if (typeof label !== 'string') continue;
        const opens = Boolean(item.children?.length);
        let have = sidebar.width - sidebar.reserve - indent - sidebar.rowChrome;
        if (opens) have -= sidebar.chevron;
        if (item.categoryGroup) {
          have -= sidebar.countMargin + String(item.children.length).length * sidebar.countDigitPx;
        }
        check(
          locale,
          item.id,
          label,
          textWidth(label, widths.glyphs500, sidebar.fontPx),
          have,
          'sidebar',
        );
        if (!opens) continue;
        const wrapper = item.categoryGroup
          ? 'category'
          : depth === 0
            ? 'children'
            : depth === 1
              ? 'grand'
              : 'great';
        expanded(item.children, depth + 1, indent + sidebar.wrappers[wrapper]);
      }
    };
    expanded(sidebarView(items), 0, 0);

    const flyouts = (list) => {
      for (const item of list) {
        const label = dict[item.label];
        if (typeof label === 'string') {
          const opens = Boolean(item.children?.length);
          const have =
            flyout.width - flyout.reserve - flyout.rowChrome - (opens ? flyout.chevron : 0);
          check(
            locale,
            item.id,
            label,
            textWidth(label, widths.glyphs400, flyout.fontPx),
            have,
            'compact flyout',
          );
        }
        if (item.children) flyouts(item.children);
      }
    };
    for (const root of items) if (root.children) flyouts(root.children);
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
  const icons = readCategoryIcons(readFileSync(resolve(root, SECTIONS_PATH), 'utf8'));
  return {
    errors: [
      ...validateNavigation({ items, dictionaries, glossary }),
      ...validateCategoryIcons(icons, glossary),
      ...validateSingleWordGroups({ items, dictionaries, glossary }),
      ...validateLabelWidths({
        items,
        dictionaries,
        glossary,
        widths: JSON.parse(readFileSync(resolve(root, WIDTHS_PATH), 'utf8')),
      }),
    ],
    items,
  };
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
