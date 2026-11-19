import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseLeadCsv, mapLeadCsv, importRequestSize } from '../../src/app/pages/crm/import/csv.ts';
import { crmPayload } from '../../src/app/pages/crm/crm-input.ts';
import { CRM_OPTIONS } from '../../src/app/pages/crm/crm-options.ts';

function evaluate(path, bindings) {
  const source = fs
    .readFileSync(path, 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {},
    ...bindings,
    Date,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    URLSearchParams,
    encodeURIComponent,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const forms = evaluate('src/app/pages/crm/prospecting-forms.ts', {
  defineCrud: (x) => x,
  quickCreateFor: () => ({}),
  crmPayload,
  CRM_OPTIONS,
});
test('CSV preserves quoted separators, escaped quotes, multiline text and formulas as inert strings', () => {
  const csv = parseLeadCsv(
    '\uFEFFName,Need\r\n"Acme, SA","said ""hello""\nnext"\r\n=1+1,plain\r\n',
  );
  assert.deepEqual(csv, [
    ['Name', 'Need'],
    ['Acme, SA', 'said "hello"\nnext'],
    ['=1+1', 'plain'],
  ]);
  assert.deepEqual(mapLeadCsv(csv, { CleName: '0', CleNeed: '1' }), [
    { rowKey: '1', data: { CleName: 'Acme, SA', CleNeed: 'said "hello"\nnext' } },
    { rowKey: '2', data: { CleName: '=1+1', CleNeed: 'plain' } },
  ]);
});
test('CSV bounds, malformed quoting, duplicate headers and inconsistent rows fail before preview', () => {
  for (const csv of [
    'Name\n"bad',
    'Name,Name\na,b',
    'Name,Email\na',
    'Name\n"a"b',
    'Name\n' + 'a\n'.repeat(101),
    'Name\n' + 'é'.repeat(300000),
  ])
    assert.throws(() => parseLeadCsv(csv));
  assert.equal(importRequestSize({ a: 'é' }), new TextEncoder().encode('{"a":"é"}').length);
});
test('queue day boundaries are fresh, local calendar instants including DST', () => {
  const before = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const day = forms.localDayBounds(new Date('2026-03-08T16:00:00Z'));
    assert.equal(day.from, '2026-03-08T05:00:00.000Z');
    assert.equal(day.to, '2026-03-09T04:00:00.000Z');
    assert.notEqual(forms.localDayBounds(new Date('2026-03-09T16:00:00Z')).from, day.from);
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});
test('assisted conversion scopes lookups, distinguishes company/person and preserves revision', () => {
  const config = forms.assistedConversion({
    CleUUID: 'lead',
    CleRevision: 7,
    CrmWorkspaceCwsUUID: 'workspace',
    CleName: 'Name',
  });
  assert.equal(config.endpoint, 'crm/leads/lead/convert-assisted');
  assert.equal(config.initialValues.revision, 7);
  for (const key of [
    'accountUUID',
    'accountName',
    'contactUUID',
    'contactName',
    'stageUUID',
    'nextContactAt',
    'nextContactAtTime',
  ])
    assert.ok(config.fields.find((f) => f.key === key));
  assert.match(
    config.fields.find((f) => f.key === 'stageUUID').remoteLookup.endpoint,
    /CrmWorkspaceCwsUUID=workspace/,
  );
  assert.equal(
    config.fields.find((f) => f.key === 'contactUUID').remoteLookup.parameters.CrmAccountCacUUID,
    'accountUUID',
  );
  assert.equal(
    config.payload({
      revision: 7,
      nextContactAt: '2026-11-19',
      nextContactAtTime: '10:15',
      contactUUID: '',
      currency: 'usd',
    }).currency,
    'USD',
  );
});
test('completion without follow-up omits parent mutation; follow-up carries displayed revisions', () => {
  const row = { uuid: 'activity', revision: 3, parentRevision: 9 };
  const simple = forms.completeFollowUp(row, false);
  assert.equal(
    simple.fields.some((f) => f.key === 'parentRevision'),
    false,
  );
  assert.equal(
    simple.fields.some((f) => f.key === 'nextContactAt'),
    false,
  );
  const follow = forms.completeFollowUp(row, true);
  assert.equal(follow.initialValues.parentRevision, 9);
  const body = follow.payload({
    revision: 3,
    parentRevision: 9,
    notes: 'Result',
    nextContactAt: '2026-11-19',
    nextContactAtTime: '10:15',
    followUpName: 'Call',
    followUpKind: 'call',
  });
  assert.equal(body.revision, 3);
  assert.equal(body.parentRevision, 9);
  assert.match(body.nextContactAt, /Z$/);
});
test('draft CRM templates use actual event surface and node ports, leaving owner for the editor', () => {
  const templates = evaluate('src/app/pages/automation/automation-templates.ts', {
    TRIGGER_TYPE: 'core.trigger',
  });
  for (const assign of [true, false]) {
    const graph = templates.buildCrmFollowUp((x) => x, assign);
    assert.equal(graph.nodes[0].config.triggers[0].event, 'crm.lead.created');
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const edge of graph.edges) {
      assert.ok(ids.has(edge.from) && ids.has(edge.to));
      assert.ok(['next', 'missing', 'error'].includes(edge.port));
    }
    assert.equal(
      graph.nodes.some((n) => n.type.startsWith('conversations.')),
      false,
    );
    if (assign)
      assert.equal(
        graph.nodes.find((n) => n.type === 'crm.assign_owner').config.userUUID,
        undefined,
      );
  }
  assert.equal(
    templates.FLOW_TEMPLATES.filter((t) => t.key.startsWith('crm-')).every(
      (t) => t.surface === 'event',
    ),
    true,
  );
});
test('queue stays actionable and paginated; remote timeline retains server total', () => {
  const queue = fs.readFileSync('src/app/pages/crm/workbench/workbench.ts', 'utf8');
  assert.match(queue, /uuidField: 'key'/);
  assert.match(queue, /serverSidePagination: true/);
  assert.doesNotMatch(queue, /readOnly: true/);
  assert.match(queue, /listQuery: \(\) =>/);
  const base = fs.readFileSync(
    'src/app/shared/crud/configurable-crud/configurable-crud-page-base.ts',
    'utf8',
  );
  assert.match(base, /typeof this.config.listQuery === 'function'/);
  const dialog = fs.readFileSync(
    'src/app/shared/crud/configurable-crud/configurable-crud-collection-dialog.ts',
    'utf8',
  );
  assert.match(dialog, /this.canEditRow\(response.data\)/);
  assert.match(dialog, /this.startEdit\(response.data\)/);
});

test('server projections are not silently filtered again by fields absent from metric and queue rows', () => {
  const path = 'src/app/shared/crud/configurable-crud/configurable-crud-page-base.ts';
  const source = ts.createSourceFile(
    path,
    fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let body;
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'filterRows')
      body = node.body.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const code = ts.transpileModule(`exports.filter = function(rows) ${body}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(code, context);
  const rows = [
    { key: 'conversion', total: 15 },
    { key: 'leads', total: 200 },
  ];
  assert.equal(context.exports.filter.call({ config: { serverSideFiltering: true } }, rows), rows);
});

test('canonical edit dialog loads by ID and refuses a different or no-longer-editable record', async () => {
  for (const scenario of ['editable', 'different', 'closed', 'denied']) {
    let render;
    let edited = null;
    let closed = 0;
    let requested = '';
    const config = {
      formOnly: true,
      endpoint: 'resource',
      editRecordUUID: 'id',
      uuidField: 'uuid',
    };
    const host = { close: () => closed++ };
    class Base {
      constructor(config) {
        this.config = config;
      }
      destroyRef = { destroyed: false };
      api = {
        get: async (endpoint) => {
          requested = endpoint;
          if (scenario === 'denied') throw Error('denied');
          return { data: { uuid: scenario === 'different' ? 'other' : 'id', revision: 8 } };
        },
      };
      canEditRow() {
        return scenario !== 'closed';
      }
      startEdit(row) {
        edited = row;
      }
    }
    const module = evaluate(
      'src/app/shared/crud/configurable-crud/configurable-crud-collection-dialog.ts',
      {
        Component: () => (type) => type,
        afterNextRender: (callback) => {
          render = callback;
        },
        inject: (token) => (token === 'data' ? config : host),
        MAT_DIALOG_DATA: 'data',
        MatDialogRef: 'dialog',
        CONFIGURABLE_CRUD_IMPORTS: [],
        ConfigurableCrudPageBase: Base,
      },
    );
    new module.ConfigurableCrudCollectionDialog();
    await render();
    assert.equal(requested, 'resource/id');
    assert.equal(closed, scenario === 'editable' ? 0 : 1);
    if (scenario === 'editable') assert.equal(edited.revision, 8);
    else assert.equal(edited, null);
  }
});

test('missing numeric observations render unavailable while a measured zero remains zero', () => {
  const path = 'src/app/shared/crud/configurable-crud/configurable-crud-page-base.ts';
  const source = ts.createSourceFile(
    path,
    fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let body;
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'formatNumberColumn')
      body = node.body.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const code = ts.transpileModule(`exports.format = function(column, value) ${body}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, Intl };
  vm.runInNewContext(code, context);
  const host = { appI18n: { language: () => 'en-US' } };
  for (const value of [null, undefined, ''])
    assert.equal(context.exports.format.call(host, {}, value), '-');
  assert.equal(context.exports.format.call(host, {}, 0), '0');
  assert.equal(context.exports.format.call(host, {}, 1.5), '1.5');
});
