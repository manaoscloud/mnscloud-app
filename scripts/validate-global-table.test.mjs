import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findTablePrimitives, stripComments } from './validate-global-table.mjs';

test('a page-local <table> is reported with its line', () => {
  const source = `<section>
  <table>
    <tr><td>1</td></tr>
  </table>
</section>`;
  assert.deepEqual(findTablePrimitives(source), [{ rule: '<table> element', line: 2 }]);
});

test('mat-table markup and its module are reported', () => {
  const source = `import { MatTableModule } from '@angular/material/table';
@Component({ imports: [MatTableModule], template: \`
  <table mat-table [dataSource]="rows()"><ng-container matColumnDef="name"></ng-container></table>
\` })
export class Page {}`;
  const rules = findTablePrimitives(source).map((item) => item.rule);
  assert.ok(rules.includes('MatTableModule/MatTableDataSource'));
  assert.ok(rules.includes('mat-table'));
  assert.ok(rules.includes('<table> element'));
});

test('a page-local paginator is reported', () => {
  assert.deepEqual(findTablePrimitives('<mat-paginator [length]="10" />'), [
    { rule: 'page-local paginator', line: 1 },
  ]);
});

test('the read-only global table and comments that mention tables pass', () => {
  const source = `<!-- never a <table> here -->
<mns-global-table [config]="workloadTable" [rows]="rows()" />`;
  assert.deepEqual(findTablePrimitives(source), []);
  const ts = `// Never render a <table> or mat-table for these lists.
/** <table> is prohibited */
const url = 'https://example.com/table';`;
  assert.deepEqual(findTablePrimitives(ts), []);
});

test('comment stripping keeps line numbers', () => {
  const source = `/* line 1
line 2 */
<table>`;
  assert.equal(stripComments(source).split('\n').length, 3);
  assert.deepEqual(findTablePrimitives(source), [{ rule: '<table> element', line: 3 }]);
});
