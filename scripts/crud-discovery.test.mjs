import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyCrud, assertCrudTargets } from './crud-discovery.mjs';

test('legacy Pay-style CRUD is detected without inheriting the generic base', () => {
  assert.equal(
    classifyCrud('@Component({}) export class FeePlans { dataSource = new MatTableDataSource(); }'),
    'legacy',
  );
  assert.equal(
    classifyCrud(
      '@Component({}) export class FeePlans {}',
      '<section class="erp-page"><table mat-table>',
    ),
    'legacy',
  );
  assert.equal(
    classifyCrud('@Component({}) export class Dashboard {}', '<mns-dashboard-page />'),
    null,
  );
});
test('explicit validation rejects empty, legacy and copied templates', () => {
  const root = mkdtempSync(join(tmpdir(), 'crud-coverage-'));
  try {
    assert.throws(() => assertCrudTargets(['.'], root), /No CRUD/);
    writeFileSync(
      join(root, 'page.ts'),
      '@Component({}) class Page { data = new MatTableDataSource(); }',
    );
    assert.throws(() => assertCrudTargets(['.'], root), /must extend/);
    writeFileSync(
      join(root, 'page.ts'),
      "@Component({templateUrl:'page.html'}) class Page extends ConfigurableCrudPageBase<X> {}",
    );
    assert.throws(() => assertCrudTargets(['.'], root), /shared HTML/);
    writeFileSync(
      join(root, 'page.ts'),
      "@Component({templateUrl:'../configurable-crud-page.html',styleUrls:['../configurable-crud-page.scss']}) class Page extends ConfigurableCrudPageBase<X> {}",
    );
    assert.equal(assertCrudTargets(['.'], root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('documented crud-template-exempt marker opts a non-CRUD table page out', () => {
  const html = '<section class="erp-page"><table mat-table>';
  assert.equal(
    classifyCrud(
      '// crud-template-exempt: metrics fleet explorer keeps its display modes\n@Component({}) class A {}',
      html,
    ),
    null,
  );
  assert.equal(classifyCrud('// crud-template-exempt:\n@Component({}) class A {}', html), 'legacy');
});
