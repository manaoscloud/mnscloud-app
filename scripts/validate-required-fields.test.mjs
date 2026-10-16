import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCrudFieldGaps, findSourceViolations } from './validate-required-fields.mjs';

const wrap = (body) => `<ng-template #simpleFieldTab let-tabFields>${body}</ng-template>
<div class="form-actions"></div>`;

test('a fully bound CRUD field passes', () => {
  const template = wrap(`
<mat-tab [label]="tabLabel('record', 'Record') | transloco" [labelClass]="tabLabelClass('record')">
  <mat-form-field>
    <input
      matInput
      [mnsInvalid]="hasFieldError(field)"
      [attr.data-field-key]="field.key"
    />
    <mat-error>{{ fieldErrorText(field) }}</mat-error>
  </mat-form-field>
  <mns-search-select-field [attr.data-field-key]="field.key" [invalid]="hasFieldError(field)" />
</mat-tab>`);
  assert.deepEqual(findCrudFieldGaps(template), []);
});

test('missing error state, marker, message and tab class are reported', () => {
  const template = wrap(`
<mat-tab [label]="tabLabel('network', 'Network') | transloco">
  <mat-form-field>
    <input matInput type="datetime-local" />
  </mat-form-field>
  <mns-checkbox-group-field [label]="x" />
</mat-tab>`);
  const problems = findCrudFieldGaps(template).map((gap) => gap.problem);
  assert.deepEqual(problems.sort(), [
    'field tab without [labelClass]',
    'input without [mnsInvalid]',
    'input without data-field-key',
    'mat-form-field without <mat-error>',
    'mns-checkbox-group-field without [invalid]',
    'mns-checkbox-group-field without data-field-key',
  ]);
});

test('search inputs inside a field (not matInput) are not field controls', () => {
  assert.deepEqual(findCrudFieldGaps(wrap('<input type="file" [attr.data-field-key]="k" />')), []);
});

test('the anonymous toast and validity-disabled buttons are violations', () => {
  const source = `this.snack.warning('Required fields are missing.');
<button [disabled]="!valid() || saving()">Save</button>
<button [disabled]="saving()">Save</button>`;
  assert.deepEqual(
    findSourceViolations(source).map((item) => [item.line, item.problem]),
    [
      [1, 'anonymous required toast'],
      [2, 'button disabled by validity'],
    ],
  );
});

test('a documented exemption keeps a validity-disabled button', () => {
  const source = `<!-- required-feedback-exempt: wizard step gate -->
<button [disabled]="!stepValid()">Next</button>`;
  assert.deepEqual(findSourceViolations(source), []);
});
