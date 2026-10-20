#!/usr/bin/env node
// App screen catalog for the support AI assistant (mnscloud-api services/supportAi/knowledge.ts).
// Built from the sidebar registry, the routes and each page's declared title, description and
// field help, translated to pt-BR (the language of the platform desk). Only data already shipped
// in the public App bundle goes in: labels, descriptions and help texts. Never secrets or records.
//
//   node scripts/generate-app-catalog.mjs          writes public/app-catalog.json
//   node scripts/generate-app-catalog.mjs --check  fails when the committed file is stale
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { navLabelKey, readRegistry, REGISTRY_PATH } from './validate-nav-labels.mjs';

export const CATALOG_PATH = 'public/app-catalog.json';
const ROUTES_PATH = 'src/app/app.routes.ts';
const LOCALE_PATH = 'public/i18n/pt-BR.json';
const SHARED_CRUD_TEMPLATE = 'configurable-crud-page.html';
const MAX_FIELDS = 40;

const text = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** Literal string(s) of an expression; a ternary yields [whenTrue, whenFalse]. */
function literals(node) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return literals(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [literals(node.whenTrue)[0] ?? '', literals(node.whenFalse)[0] ?? ''];
  }
  return [];
}

/** Picks the platform or tenant branch of a desk/scope ternary. */
function pick(node, platform) {
  const values = literals(node);
  if (values.length < 2) return values[0] ?? '';
  const condition = ts.isConditionalExpression(node) ? node.condition.getText() : '';
  const truthyIsPlatform = /platform|master|system/i.test(condition);
  return platform === truthyIsPlatform ? values[0] : values[1];
}

function property(objectNode, name) {
  for (const prop of objectNode.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name.getText().replace(/['"]/g, '') === name) {
      return prop.initializer;
    }
  }
  return undefined;
}

/** Full route path -> { file, data } for every lazily loaded page. */
export function readRoutes(source) {
  const sf = ts.createSourceFile(ROUTES_PATH, source, ts.ScriptTarget.Latest, true);
  const routes = new Map();
  const arrays = new Map();
  ts.forEachChild(sf, function collect(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      arrays.set(node.name.getText(), node.initializer);
    }
    ts.forEachChild(node, collect);
  });
  function walkArray(array, prefix, visiting = new Set()) {
    if (visiting.has(array)) throw new Error('Cyclic route array');
    const next = new Set([...visiting, array]);
    for (const element of array.elements) walkElement(element, prefix, next);
  }
  function routeData(element) {
    const dataNode = property(element, 'data');
    const data = {};
    if (dataNode && ts.isObjectLiteralExpression(dataNode)) {
      for (const key of ['scope', 'supportDesk', 'permission']) {
        const value = literals(property(dataNode, key))[0];
        if (value) data[key] = value;
      }
    }
    return data;
  }
  function walkElement(element, prefix, visiting) {
    if (ts.isSpreadElement(element) && ts.isIdentifier(element.expression)) {
      const shared = arrays.get(element.expression.text);
      if (shared) walkArray(shared, prefix, visiting);
      return;
    }
    if (!ts.isObjectLiteralExpression(element)) return;
    const path = literals(property(element, 'path'))[0] ?? '';
    const full = [prefix, path].filter(Boolean).join('/');
    const load = property(element, 'loadComponent');
    const importMatch = load ? /import\('(\.\/pages\/[^']+)'\)/.exec(load.getText()) : null;
    if (importMatch) {
      routes.set(`/${full}`, {
        file: `src/app/${importMatch[1].slice(2)}.ts`,
        data: routeData(element),
      });
    }
    const children = property(element, 'children');
    if (children && ts.isArrayLiteralExpression(children)) walkArray(children, full, visiting);
  }

  ts.forEachChild(sf, function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'routes' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      walkArray(node.initializer, '');
    }
    ts.forEachChild(node, visit);
  });
  return routes;
}

/** Title, description and field help declared by a page (defineCrud or a hand-written template). */
export function readPage(root, file, platform) {
  const path = resolve(root, file);
  if (!existsSync(path)) return null;
  const source = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const page = { title: '', description: '', fields: [] };
  const seen = new Set();
  // A page may declare helper dialogs too: its own configuration is the one with the most fields.
  const candidates = [];
  ts.forEachChild(sf, function visit(node) {
    if (ts.isObjectLiteralExpression(node) && property(node, 'pageTitle')) {
      const fields = property(node, 'fields');
      const size = fields && ts.isArrayLiteralExpression(fields) ? fields.elements.length : 0;
      candidates.push({ node, fields, size });
    }
    ts.forEachChild(node, visit);
  });
  const main = candidates.reduce((best, item) => (item.size > best.size ? item : best), {
    size: -1,
  });
  if (main.node) {
    page.title = pick(property(main.node, 'pageTitle'), platform);
    page.description = pick(property(main.node, 'pageDescription'), platform);
    for (const field of main.fields && ts.isArrayLiteralExpression(main.fields)
      ? main.fields.elements
      : []) {
      if (!ts.isObjectLiteralExpression(field)) continue;
      const label = pick(property(field, 'label'), platform);
      const help = pick(property(field, 'help'), platform);
      if (label && !seen.has(label) && page.fields.length < MAX_FIELDS) {
        seen.add(label);
        page.fields.push({ label, help });
      }
    }
  }
  const template = /templateUrl:\s*'([^']+)'/.exec(source)?.[1];
  if (template && !template.endsWith(SHARED_CRUD_TEMPLATE)) {
    const html = readFileSync(resolve(path, '..', template), 'utf8').replace(/\s+/g, ' ');
    const quoted = (attr) =>
      new RegExp(`\\[${attr}\\]="\\s*'((?:[^'\\\\]|\\\\.)*)'\\s*\\|\\s*transloco\\s*"`).exec(
        html,
      )?.[1];
    page.title ||= quoted('title') ?? '';
    page.description ||= quoted('description') ?? /\sdescription="([^"]+)"/.exec(html)?.[1] ?? '';
    const helpRe =
      /\[label\]="\s*'((?:[^'\\]|\\.)*)'\s*\|\s*transloco\s*"[^>]*?\[(?:text|help)\]="\s*\(?\s*'((?:[^'\\]|\\.)*)'/g;
    for (const match of html.matchAll(helpRe)) {
      if (!seen.has(match[1]) && page.fields.length < MAX_FIELDS) {
        seen.add(match[1]);
        page.fields.push({ label: match[1], help: match[2] });
      }
    }
  }
  return page;
}

/** Every navigable screen with its pt-BR menu path; platform screens are marked as such. */
export function buildCatalog(root = process.cwd()) {
  const items = readRegistry(readFileSync(resolve(root, REGISTRY_PATH), 'utf8'));
  const routes = readRoutes(readFileSync(resolve(root, ROUTES_PATH), 'utf8'));
  const locale = JSON.parse(readFileSync(resolve(root, LOCALE_PATH), 'utf8'));
  const t = (key) => text(locale[key] ?? key);
  const entries = [];
  function walk(list, trail, inherited) {
    for (const item of list) {
      const labels = [...trail, t(navLabelKey(item.id))];
      const platformItem =
        inherited ||
        item.scope === 'master' ||
        (item.permissions ?? []).some((code) => code.startsWith('platform.'));
      if (item.children?.length)
        walk(item.children, labels, platformItem && item.scope === 'master');
      const targets = [
        ...(item.route ? [{ route: item.route, platform: platformItem }] : []),
        ...(item.masterRoute ? [{ route: item.masterRoute, platform: true }] : []),
      ];
      for (const target of targets) {
        const resolved = routes.get(target.route);
        const platform =
          target.platform ||
          target.route.startsWith('/system/') ||
          resolved?.data.scope === 'master' ||
          resolved?.data.supportDesk === 'platform';
        const page = resolved ? readPage(root, resolved.file, platform) : null;
        entries.push({
          route: target.route,
          menuPath: labels.join(' › '),
          scope: platform ? 'platform' : item.scope === 'public' ? 'public' : 'tenant',
          title: t(page?.title || labels[labels.length - 1]),
          description: t(page?.description ?? ''),
          fields: (page?.fields ?? [])
            .map((field) => ({ label: t(field.label), help: t(field.help) }))
            .filter((field) => field.label),
        });
      }
    }
  }
  walk(items, [], false);
  const unique = [...new Map(entries.map((entry) => [entry.route, entry])).values()].sort((a, b) =>
    a.route.localeCompare(b.route),
  );
  const version = createHash('sha256').update(JSON.stringify(unique)).digest('hex').slice(0, 12);
  return { schemaVersion: 1, version, language: 'pt-BR', entries: unique };
}

export function serializeCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const expected = serializeCatalog(buildCatalog(root));
  const target = resolve(root, CATALOG_PATH);
  if (process.argv.includes('--check')) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== expected) {
      console.error(
        `${CATALOG_PATH} is stale: run "npm run catalog:app" and commit the result (menu, routes, page titles, descriptions or field help changed).`,
      );
      process.exit(1);
    }
    console.log(`App catalog is current (${JSON.parse(expected).entries.length} screens).`);
  } else {
    writeFileSync(target, expected);
    console.log(`Wrote ${CATALOG_PATH} (${JSON.parse(expected).entries.length} screens).`);
  }
}
