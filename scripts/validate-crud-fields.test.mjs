import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findFieldViolations, findTemplateViolations } from './validate-crud-fields.mjs';

const config = (fields) =>
  `export const CONFIG = defineCrud({\n  fields: [\n${fields}\n  ],\n});\n`;

test('single-line controls are span 1 and text areas span 4 with four rows', () => {
  const source = config(`
    { key: 'name', label: 'Name', span: 1 },
    { key: 'customerUUID', label: 'Customer', type: 'search-select', span: 1 },
    { key: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
    { key: 'logo', label: 'Logo', type: 'file', span: 2 },
    { key: 'kind', label: 'Kind', typeWhen: () => 'text', span: 2 },`);
  assert.deepEqual(findFieldViolations('ok.ts', source), []);
});

test('wide inputs, FK selects and short or narrow text areas are reported', () => {
  const source = config(`
    { key: 'name', label: 'Name', span: 2 },
    { key: 'customerUUID', label: 'Customer', type: 'search-select', span: 4 },
    { key: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 1, rows: 2 },`);
  const problems = findFieldViolations('bad.ts', source).map((p) =>
    p.replace(/^bad\.ts:\d+: /, ''),
  );
  assert.deepEqual(problems, [
    'text field must be span 1 (single-line controls take one column)',
    'search-select field must be span 1 (single-line controls take one column)',
    'textarea must be span 4 (full row)',
    'textarea keeps the default four rows (remove rows)',
  ]);
});

test('annotations use Notes in the Notes tab; descriptions must justify themselves', () => {
  const bad = config(`
    { key: 'notes', label: 'Notes', type: 'textarea', span: 4 },
    { key: 'description', label: 'Description', type: 'textarea', span: 4 },`);
  assert.equal(findFieldViolations('bad.ts', bad).length, 2);
  const ok = config(`
    // notes-tab-exempt: the review reason is the only input of this action dialog.
    { key: 'notes', label: 'Notes', type: 'textarea', span: 4 },
    // business-description: the body of the support request.
    { key: 'description', label: 'Description', type: 'textarea', span: 4 },`);
  assert.deepEqual(findFieldViolations('ok.ts', ok), []);
});

test('list filters are left to the filter baseline', () => {
  const source = `const c = { listFilters: [{ key: 'search', label: 'Search', span: 1 }] };`;
  assert.deepEqual(findFieldViolations('filters.ts', source), []);
});

test('hand-written templates: inputs span-1, textareas span-4', () => {
  const html = `
<mat-form-field appearance="outline" class="span-2"><input matInput /></mat-form-field>
<mat-form-field appearance="outline" class="span-1"><input matInput /></mat-form-field>
<mat-form-field appearance="outline" class="span-2"><textarea matInput></textarea></mat-form-field>
<mns-search-select-field fieldClass="span-4" />
<mns-secret-content-field class="span-4" />`;
  assert.deepEqual(
    findTemplateViolations('page.html', html).map((p) => p.replace(/^page\.html:/, '')),
    [
      '2: single-line control must be span-1',
      '4: textarea must be span-4',
      '5: single-line control must be span-1',
    ],
  );
});
