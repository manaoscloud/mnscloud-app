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
import { dirname, resolve } from 'node:path';
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
      for (const key of ['scope', 'supportDesk', 'permission', 'resource']) {
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

/**
 * Static reader of helper-built fields: follows identifiers, object spreads and calls of functions
 * declared in the page or in the relative modules it imports (parameters bound to the call
 * arguments), so pages that share field builders keep their labels. Nothing is executed.
 */
const scopes = new Map();

function scopeOf(path, sf) {
  if (scopes.has(path)) return scopes.get(path);
  const tree =
    sf ?? ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const scope = { path, names: new Map(), imports: new Map() };
  scopes.set(path, scope);
  for (const statement of tree.statements) collectDeclaration(scope, statement);
  return scope;
}

function collectDeclaration(scope, statement) {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer && ts.isIdentifier(declaration.name)) {
        scope.names.set(declaration.name.text, declaration.initializer);
      }
    }
  } else if (ts.isFunctionDeclaration(statement) && statement.name) {
    scope.names.set(statement.name.text, statement);
  } else if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.startsWith('.')) {
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return;
    const file = resolve(dirname(scope.path), `${statement.moduleSpecifier.text}.ts`);
    for (const element of bindings.elements) {
      scope.imports.set(element.name.text, {
        file,
        name: (element.propertyName ?? element.name).text,
      });
    }
  }
}

function lookup(name, ctx) {
  if (ctx.bindings.has(name)) return ctx.bindings.get(name);
  if (ctx.scope.names.has(name)) {
    return { node: ctx.scope.names.get(name), ctx: { ...ctx, bindings: new Map() } };
  }
  const imported = ctx.scope.imports.get(name);
  if (!imported || !existsSync(imported.file)) return null;
  return lookup(imported.name, { ...ctx, scope: scopeOf(imported.file), bindings: new Map() });
}

function unwrap(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

/** Result of a call of a declared function, with its parameters bound to the call arguments. */
function callResult(call, ctx, depth) {
  const callee = ts.isIdentifier(call.expression) ? lookup(call.expression.text, ctx) : null;
  const fn = callee && ts.isFunctionDeclaration(callee.node) ? callee.node : null;
  const result = fn?.body?.statements.find(ts.isReturnStatement)?.expression;
  if (!result) return null;
  const bindings = new Map();
  fn.parameters.forEach((parameter, index) => {
    const argument = call.arguments[index];
    if (!ts.isIdentifier(parameter.name)) return;
    if (argument) bindings.set(parameter.name.text, { node: argument, ctx });
    else if (parameter.initializer)
      bindings.set(parameter.name.text, { node: parameter.initializer, ctx: callee.ctx });
  });
  return resolveValue(result, { ...callee.ctx, bindings }, depth + 1);
}

/** The literal node an expression stands for (identifiers, calls and property reads followed). */
function resolveValue(node, ctx, depth = 0) {
  const current = unwrap(node);
  if (!current || depth > 20) return null;
  if (ts.isIdentifier(current)) {
    const found = lookup(current.text, ctx);
    return found ? resolveValue(found.node, found.ctx, depth + 1) : null;
  }
  if (ts.isCallExpression(current)) return callResult(current, ctx, depth);
  if (ts.isPropertyAccessExpression(current)) {
    const owner = resolveValue(current.expression, ctx, depth + 1);
    const value =
      owner && ts.isObjectLiteralExpression(owner.node)
        ? property(owner.node, current.name.text)
        : null;
    return value ? resolveValue(value, owner.ctx, depth + 1) : null;
  }
  return { node: current, ctx };
}

function stringOf(node, ctx) {
  const value = resolveValue(node, ctx);
  const current = value?.node;
  if (!current) return null;
  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current))
    return current.text;
  if (ts.isTemplateExpression(current)) {
    return current.templateSpans.reduce(
      (out, span) => out + (stringOf(span.expression, value.ctx) ?? '') + span.literal.text,
      current.head.text,
    );
  }
  if (ts.isBinaryExpression(current)) {
    const operator = current.operatorToken.kind;
    if (operator !== ts.SyntaxKind.QuestionQuestionToken && operator !== ts.SyntaxKind.BarBarToken)
      return null;
    return stringOf(current.left, value.ctx) ?? stringOf(current.right, value.ctx);
  }
  if (ts.isConditionalExpression(current)) return pick(current, value.ctx.platform);
  return null;
}

/** Object literals of a fields expression (array, spread, conditional or helper call). */
function fieldObjects(node, ctx) {
  const value = resolveValue(node, ctx);
  const current = value?.node;
  if (!current) return [];
  if (ts.isConditionalExpression(current)) {
    return [
      ...fieldObjects(current.whenTrue, value.ctx),
      ...fieldObjects(current.whenFalse, value.ctx),
    ];
  }
  if (ts.isObjectLiteralExpression(current)) return [value];
  if (!ts.isArrayLiteralExpression(current)) return [];
  return current.elements.flatMap((element) =>
    ts.isSpreadElement(element)
      ? fieldObjects(element.expression, value.ctx)
      : fieldObjects(element, value.ctx),
  );
}

/** A property of an object literal, falling back to the objects it spreads. */
function objectString(object, name) {
  const own = property(object.node, name);
  if (own) return stringOf(own, object.ctx) ?? '';
  for (const spread of object.node.properties.filter(ts.isSpreadAssignment).reverse()) {
    const base = resolveValue(spread.expression, object.ctx);
    if (base && ts.isObjectLiteralExpression(base.node)) {
      const text = objectString(base, name);
      if (text) return text;
    }
  }
  return '';
}

/** The fields expression of a page configuration, including one built by a helper factory. */
function configFields(node, ctx) {
  const own = property(node, 'fields');
  if (own) return { node: own, ctx };
  const call = node.parent && ts.isCallExpression(node.parent) ? node.parent : null;
  const built = call ? callResult(call, ctx, 0) : null;
  const fields =
    built && ts.isObjectLiteralExpression(built.node) ? property(built.node, 'fields') : null;
  return fields ? { node: fields, ctx: built.ctx } : null;
}

/** Title, description and field help of a hand-written page template (not the shared CRUD one). */
function readTemplateHelp(path, source, page, seen) {
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
}

/** Key of the record entry that holds a page configuration (`projects: defineCrud({...})`). */
function configKey(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isPropertyAssignment(current)) {
      const name = current.name;
      return ts.isStringLiteral(name) || ts.isIdentifier(name) ? name.text : '';
    }
    if (!ts.isCallExpression(current) && !ts.isAsExpression(current)) return '';
  }
  return '';
}

/**
 * Title, description and field help declared by a page (defineCrud or a hand-written template).
 * A page that serves several routes (route data `resource`) uses the configuration of that key.
 */
export function readPage(root, file, platform, resource = '') {
  const path = resolve(root, file);
  if (!existsSync(path)) return null;
  const source = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const page = { title: '', description: '', fields: [] };
  const seen = new Set();
  // A page may declare helper dialogs too: its own configuration is the one with the most fields.
  const candidates = [];
  const ctx = { scope: scopeOf(path, sf), bindings: new Map(), platform };
  ts.forEachChild(sf, function visit(node) {
    if (ts.isObjectLiteralExpression(node) && property(node, 'pageTitle')) {
      const fields = configFields(node, ctx);
      const objects = fields ? fieldObjects(fields.node, fields.ctx) : [];
      candidates.push({ node, objects, size: objects.length, key: configKey(node) });
    }
    ts.forEachChild(node, visit);
  });
  const keyed = resource ? candidates.find((item) => item.key === resource) : undefined;
  const main =
    keyed ??
    candidates.reduce((best, item) => (item.size > best.size ? item : best), {
      size: -1,
    });
  if (main.node) {
    page.title = pick(property(main.node, 'pageTitle'), platform);
    page.description = pick(property(main.node, 'pageDescription'), platform);
    for (const object of main.objects) {
      const label = text(objectString(object, 'label'));
      const help = text(objectString(object, 'help'));
      if (label && !seen.has(label) && page.fields.length < MAX_FIELDS) {
        seen.add(label);
        page.fields.push({ label, help });
      }
    }
  }
  readTemplateHelp(path, source, page, seen);
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
        const page = resolved
          ? readPage(root, resolved.file, platform, resolved.data.resource)
          : null;
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
