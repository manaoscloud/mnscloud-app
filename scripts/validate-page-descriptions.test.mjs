import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSource } from './validate-page-descriptions.mjs';

const ts = join(process.cwd(), 'src/app/pages/example/example.ts');
const html = join(process.cwd(), 'src/app/pages/example/example.html');

test('CRUD descriptions must be present, translated and different from the title', () => {
  assert.deepEqual(
    checkSource(
      ts,
      "defineCrud({ pageTitle: 'authentication.accesses', pageDescription: 'authentication.accessesDescription' })",
    ),
    [],
  );
  assert.match(checkSource(ts, "x({ pageTitle: 'A', pageDescription: '' })")[0], /is empty/);
  assert.match(
    checkSource(ts, "x({ pageTitle: 'A', pageDescription: 'Untranslated sentence here.' })")[0],
    /no translation/,
  );
  assert.match(
    checkSource(
      ts,
      "x({ pageTitle: 'authentication.accesses', pageDescription: 'authentication.accesses' })",
    )[0],
    /repeats the page title/,
  );
});

test('template descriptions may interpolate data but not untranslated words', () => {
  assert.deepEqual(checkSource(ts, 'x({ pageDescription: `#${id} · ${subject}` })'), []);
  assert.match(
    checkSource(ts, 'x({ pageDescription: `Manage ${noun}.` })')[0],
    /untranslated text/,
  );
});

test('page shells declare a translated description', () => {
  assert.deepEqual(
    checkSource(html, '<mns-dashboard-page title="T" description="crm.description.dashboard">'),
    [],
  );
  assert.deepEqual(checkSource(html, '<mns-detail-page [title]="t()" [description]="d()">'), []);
  assert.match(checkSource(html, '<mns-dashboard-page title="T" description="">')[0], /is empty/);
  assert.match(checkSource(html, '<mns-detail-page title="T">')[0], /has no description/);
  assert.match(
    checkSource(html, '<div class="erp-header"><div><h1>T</h1></div></div>')[0],
    /no description paragraph/,
  );
});

test('inline component templates are checked too', () => {
  assert.match(
    checkSource(ts, 'template: `<mns-metrics-monitor title="T">`')[0],
    /has no description/,
  );
  assert.deepEqual(
    checkSource(
      ts,
      'template: `<mns-metrics-monitor title="T" description="crm.description.dashboard">`',
    ),
    [],
  );
});
