import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const template = readFileSync(
  new URL(
    '../../src/app/shared/crud/configurable-crud/configurable-crud-page.html',
    import.meta.url,
  ),
  'utf8',
);
const styles = readFileSync(new URL('../../src/styles.scss', import.meta.url), 'utf8');

function cssBlock(selector) {
  const start = styles.indexOf(`\n${selector} {`);
  assert.notEqual(start, -1, `${selector} rule not found in styles.scss`);
  return styles.slice(start, styles.indexOf('\n}', start));
}

test('the loading overlay sits in the table frame, outside the horizontal scroll', () => {
  const wrapper = template.indexOf('class="table-wrapper');
  const overlay = template.indexOf('class="table-loading"');
  const scroll = template.indexOf('class="table-scroll"');
  const table = template.indexOf('mat-table');
  assert.ok(wrapper !== -1 && overlay > wrapper, 'overlay must be inside .table-wrapper');
  assert.ok(scroll > overlay, '.table-scroll must come after the overlay, as its sibling');
  assert.ok(table > scroll, 'the table must render inside .table-scroll');
});

test('only .table-scroll scrolls horizontally; the frame anchors the overlay', () => {
  const wrapper = cssBlock('.table-wrapper');
  assert.match(wrapper, /\n  position: relative;/);
  assert.match(wrapper, /\n  overflow: hidden;/);
  assert.doesNotMatch(wrapper, /\n  overflow-x: auto;/);
  assert.match(wrapper, /\.table-scroll \{[^}]*overflow-x: auto;/);
  assert.match(cssBlock('.table-loading'), /position: absolute;\s+inset: 0;/);
});

test('no stylesheet makes .table-wrapper itself scroll horizontally', () => {
  const root = new URL('../../src/', import.meta.url);
  const offenders = readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith('.scss') || file.endsWith('.css'))
    .filter((file) =>
      /\.table-wrapper\s*\{[^{}]*overflow(-x)?:\s*(auto|scroll)/.test(
        readFileSync(new URL(file, root), 'utf8'),
      ),
    );
  assert.deepEqual(offenders, []);
});
