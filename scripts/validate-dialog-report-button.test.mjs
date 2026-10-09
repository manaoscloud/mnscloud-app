import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMissingReportButtons } from './validate-dialog-report-button.mjs';

test('a dialog header with the report button passes', () => {
  const source = `<div class="crud-dialog">
  <header class="dialog-header">
    <div><h2>Title</h2></div>
    <mns-report-problem-button />
  </header>
</div>`;
  assert.deepEqual(findMissingReportButtons(source), []);
});

test('a div header is checked up to its own closing tag, not a nested one', () => {
  const source = `<div class="dialog-header change-plan-header">
  <div><h2>Title</h2></div>
</div>
<mns-report-problem-button />`;
  assert.deepEqual(findMissingReportButtons(source), [1]);
});

test('a header without the button is reported with its line', () => {
  const source = `<div>
  <header class="dialog-header">
    <h2>Title</h2>
  </header>
</div>`;
  assert.deepEqual(findMissingReportButtons(source), [2]);
});

test('a documented exemption right above the header is accepted', () => {
  const source = `<!-- report-problem-exempt: part of the report flow -->
<header class="dialog-header"><h2>Report</h2></header>`;
  assert.deepEqual(findMissingReportButtons(source), []);
});

test('an empty exemption reason is not accepted', () => {
  const source = `<!-- report-problem-exempt: -->
<header class="dialog-header"><h2>Report</h2></header>`;
  assert.deepEqual(findMissingReportButtons(source), [2]);
});
