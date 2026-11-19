import { computed, signal } from '@angular/core';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { zonedDayBounds } from '../../src/app/shared/date-time/zoned-day-bounds.ts';
import { mapLeadCsv } from '../../src/app/pages/crm/import/csv.ts';
import {
  importFeedbackKey,
  duplicateReasonKey,
} from '../../src/app/pages/crm/import/import-feedback.ts';

test('tenant day boundaries ignore browser UTC and cover both DST transitions', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'UTC';
  try {
    assert.deepEqual(zonedDayBounds('America/Sao_Paulo', new Date('2026-11-19T01:00:00Z')), {
      from: '2026-11-18T03:00:00.000Z',
      to: '2026-11-19T03:00:00.000Z',
    });
    for (const [now, from, to, hours] of [
      ['2026-03-08T16:00:00Z', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', 23],
      ['2026-11-01T16:00:00Z', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', 25],
    ]) {
      const bounds = zonedDayBounds('America/New_York', new Date(now));
      assert.deepEqual(bounds, { from, to });
      assert.equal((Date.parse(bounds.to) - Date.parse(bounds.from)) / 3600000, hours);
    }
    assert.throws(() => zonedDayBounds('invalid-zone'));
    assert.throws(() => zonedDayBounds('UTC', new Date('invalid')));
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

function parameterFixture() {
  let environment = 'tenant-a';
  const identity = signal({ actor: 'operator', generation: 0, environment, metadata: 0 });
  let routeScope = 'tenant';
  const navigation = signal(null);
  const requests = [];
  const api = {
    get: (path) => new Promise((resolve) => requests.push({ path, environment, resolve })),
  };
  const auth = {
    user: () => ({
      uuid: identity().actor,
      EnvironmentUUID: identity().environment,
      metadata: identity().metadata,
    }),
    sessionGeneration: () => identity().generation,
  };
  const scope = { current: () => routeScope, isSystemTree: () => routeScope === 'master' };
  const tenants = { selectedTenant: () => ({ EnvironmentUUID: environment }) };
  const router = { events: { pipe: () => null } };
  const source = fs
    .readFileSync('src/app/services/system-parameter.service.ts', 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
  }).outputText;
  const context = {
    exports: {},
    Injectable: () => (target) => target,
    ApiService: 'api',
    AuthService: 'auth',
    RouteScopeService: 'scope',
    TenantService: 'tenants',
    Router: 'router',
    NavigationEnd: class {},
    filter: () => null,
    computed,
    toSignal: () => navigation,
    inject: (token) => ({ api, auth, scope, tenants, router })[token],
    readStoredEnvironmentUUID: () => environment,
    isAppLanguage: () => true,
  };
  vm.runInNewContext(code, context);
  return {
    service: new context.exports.SystemParameterService(),
    requests,
    navigate: (next) => {
      routeScope = next;
      navigation.set({});
    },
    metadataUpdate: () => identity.update((value) => ({ ...value, metadata: value.metadata + 1 })),
    storageOnly: () => {
      environment = 'storage-tenant';
    },
    switchTenant: () => {
      environment = 'tenant-b';
      identity.update((value) => ({ ...value, environment }));
    },
    switchActor: () => {
      identity.update((value) => ({ ...value, actor: 'other' }));
    },
    signInAgain: () => {
      identity.update((value) => ({ ...value, generation: value.generation + 1 }));
    },
  };
}
const parameterResponse = (value) => ({ data: { items: [{ SprValue: value, SprIsActive: 1 }] } });
test('parameter cache isolates tenant, actor and session and rejects a late former-tenant response', async () => {
  const fixture = parameterFixture();
  const old = fixture.service.resolveDefaultTimezone();
  const rejection = assert.rejects(old, /context changed/);
  fixture.switchTenant();
  const current = fixture.service.resolveDefaultTimezone();
  fixture.requests[1].resolve(parameterResponse('America/New_York'));
  assert.equal(await current, 'America/New_York');
  fixture.requests[0].resolve(parameterResponse('America/Sao_Paulo'));
  await rejection;
  assert.equal(await fixture.service.resolveDefaultTimezone(), 'America/New_York');
  assert.equal(fixture.requests.length, 2);
  fixture.switchActor();
  const actor = fixture.service.resolveDefaultTimezone();
  fixture.requests[2].resolve(parameterResponse('Europe/Lisbon'));
  assert.equal(await actor, 'Europe/Lisbon');
  fixture.signInAgain();
  const session = fixture.service.resolveDefaultTimezone();
  fixture.requests[3].resolve(parameterResponse('UTC'));
  assert.equal(await session, 'UTC');
});
test('CSV rejects stale/out-of-bounds mappings and translates API feedback using safe keys', () => {
  const csv = [
    ['Name', 'Email'],
    ['Company', 'demo@example.invalid'],
  ];
  for (const mapping of [
    {},
    { CleName: '0', CleEmail: '4' },
    { CleName: '-1' },
    { CleName: '1.5' },
  ])
    assert.throws(() => mapLeadCsv(csv, mapping), /mapping/);
  assert.equal(importFeedbackKey('CleEmail'), 'Email');
  assert.equal(importFeedbackKey('CRM_IMPORT_CONFLICT'), 'crm.prospect.importError.conflict');
  assert.equal(importFeedbackKey('arbitrary server text'), 'crm.prospect.importError.invalid');
  assert.equal(duplicateReasonKey('batch'), 'crm.prospect.duplicateReason.batch');
  assert.equal(duplicateReasonKey('<script>'), 'crm.prospect.importError.duplicate');
});

test('workbench waits for the tenant timezone before resolving its first query', async () => {
  const path = 'src/app/pages/crm/workbench/workbench.ts';
  const source = ts.createSourceFile(
    path,
    fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'workbenchConfig',
  );
  const code = ts.transpileModule(declaration.getText(source), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {},
    defineCrud: (value) => value,
    crmWorkspaceFilter: {},
    CRM_OPTIONS: { leadStates: [], stageKinds: [], activityStates: [], activityKinds: [] },
    completeFollowUp: () => ({}),
    zonedDayBounds,
  };
  vm.runInNewContext(code, context);
  let resolve;
  const timezone = new Promise((done) => {
    resolve = done;
  });
  const config = context.exports.workbenchConfig(
    {},
    { resolveDefaultTimezone: () => timezone },
    false,
  );
  let settled = false;
  const query = config.listQuery().then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(settled, false, 'No provisional UTC/browser query is allowed');
  resolve('America/Sao_Paulo');
  assert.deepEqual(await query, zonedDayBounds('America/Sao_Paulo'));
});

test('NavigationEnd updates scope without auth changes; irrelevant identity metadata is deduplicated', async () => {
  const fixture = parameterFixture();
  let observed = 0;
  const consumer = computed(() => {
    observed++;
    return fixture.service.context();
  });
  const initial = consumer();
  fixture.metadataUpdate();
  assert.equal(consumer(), initial);
  assert.equal(observed, 1, 'Unchanged context must not reset displayed timezone');
  fixture.navigate('master');
  assert.notEqual(consumer(), initial);
  assert.equal(observed, 2);
  const master = fixture.service.resolveDefaultTimezone();
  fixture.requests[0].resolve(parameterResponse('UTC'));
  assert.equal(await master, 'UTC');
  fixture.navigate('tenant');
  assert.equal(consumer(), initial);
  const tenant = fixture.service.resolveDefaultTimezone();
  fixture.requests[1].resolve(parameterResponse('America/Sao_Paulo'));
  assert.equal(await tenant, 'America/Sao_Paulo');
  const before = fixture.service.contextKey();
  fixture.storageOnly();
  assert.notEqual(
    fixture.service.contextKey(),
    before,
    'Safety checks must read effective storage even without notification',
  );
});

function loaderFixture() {
  const path = 'src/app/shared/crud/configurable-crud/configurable-crud-page-base.ts';
  const source = ts.createSourceFile(
    path,
    fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let body;
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'fetchItems')
      body = node.body.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const code = ts.transpileModule(
    `exports.fetchItems = async function(filters, abortSignal) ${body}`,
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const context = { exports: {}, URLSearchParams, DOMException };
  vm.runInNewContext(code, context);
  let scope = 'tenant-a';
  const requests = [];
  const host = {
    config: {},
    listRequestGeneration: 0,
    parameters: { contextKey: () => scope },
    destroyRef: { destroyed: false },
    serverSidePagination: () => true,
    statusFilterEnabled: () => false,
    listFilters: () => [],
    listEndpoint: () => 'crm/workbench',
    api: { get: (url) => new Promise((resolve) => requests.push({ url, resolve })) },
    serverTotal: {
      value: 0,
      set(value) {
        this.value = value;
      },
    },
  };
  const filters = { limit: 25, offset: 0, search: '', status: '', extra: {} };
  return {
    host,
    requests,
    run: (signal) => context.exports.fetchItems.call(host, filters, signal),
    switchTenant: () => {
      scope = 'tenant-b';
    },
  };
}
test('list loader prevents a request after query wait when destroyed, aborted or tenant changed', async () => {
  for (const event of ['destroy', 'abort', 'context']) {
    const fixture = loaderFixture();
    let resolve;
    fixture.host.config.listQuery = () =>
      new Promise((done) => {
        resolve = done;
      });
    const controller = new AbortController();
    const request = fixture.run(controller.signal);
    const rejected = assert.rejects(request, { name: 'AbortError' });
    if (event === 'destroy') fixture.host.destroyRef.destroyed = true;
    if (event === 'abort') controller.abort();
    if (event === 'context') fixture.switchTenant();
    resolve({ from: '2026-11-19T03:00:00Z' });
    await rejected;
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.host.serverTotal.value, 0);
  }
});
test('out-of-order list responses cannot overwrite the current total', async () => {
  const fixture = loaderFixture();
  const old = fixture.run();
  const rejected = assert.rejects(old, { name: 'AbortError' });
  const current = fixture.run();
  fixture.requests[1].resolve({ data: { items: [{ key: 'new' }], total: 7 } });
  assert.equal((await current)[0].key, 'new');
  fixture.requests[0].resolve({ data: { items: [], total: 99 } });
  await rejected;
  assert.equal(fixture.host.serverTotal.value, 7);
});
test('board content is inert while loading, without disabling the Refresh header', () => {
  const template = fs.readFileSync(
    'src/app/shared/crud/configurable-crud/configurable-crud-page.html',
    'utf8',
  );
  assert.match(template, /class="crud-board"\s+\[attr\.inert\]="loading\(\) \? '' : null"/);
  assert.doesNotMatch(template, /<app-refresh-button[^>]*inert/);
});
