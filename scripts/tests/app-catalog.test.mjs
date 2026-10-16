import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import {
  buildCatalog,
  CATALOG_PATH,
  readPage,
  readRoutes,
  serializeCatalog,
} from '../generate-app-catalog.mjs';

test('the committed App catalog matches the menu, routes and page help', () => {
  assert.equal(readFileSync(CATALOG_PATH, 'utf8'), serializeCatalog(buildCatalog()));
});

test('catalog entries carry pt-BR menu paths and mark platform screens', () => {
  const { schemaVersion, entries } = buildCatalog();
  assert.equal(schemaVersion, 1);
  const byRoute = new Map(entries.map((entry) => [entry.route, entry]));
  const requests = byRoute.get('/support/requests');
  assert.equal(requests.menuPath, 'Suporte › Meus chamados');
  assert.notEqual(requests.scope, 'platform');
  assert.ok(requests.description.length > 10);
  assert.equal(byRoute.get('/support/platform/tickets').scope, 'platform');
  assert.equal(byRoute.get('/support/platform/ai/settings').scope, 'platform');
  for (const entry of entries) {
    assert.match(entry.route, /^\/[A-Za-z0-9/_:.-]*$/);
    if (entry.route.startsWith('/system/')) assert.equal(entry.scope, 'platform', entry.route);
  }
});

test('route walker resolves nested paths and route data', () => {
  const routes = readRoutes(`export const routes = [
    { path: 'a', children: [
      { path: 'b', loadComponent: () => import('./pages/x/y').then((m) => m.Y), data: { scope: 'master' } },
    ] },
  ];`);
  assert.deepEqual(routes.get('/a/b'), { file: 'src/app/pages/x/y.ts', data: { scope: 'master' } });
  assert.ok(ts.version);
});

test('page reader takes the main configuration and the desk branch', () => {
  const page = readPage(process.cwd(), 'src/app/pages/support/tickets/tickets.ts', true);
  assert.equal(page.title, 'Platform tickets');
  assert.ok(page.fields.some((field) => field.label === 'Subject'));
  const tenant = readPage(process.cwd(), 'src/app/pages/support/tickets/tickets.ts', false);
  assert.equal(tenant.title, 'Support tickets');
});
