import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseTemplate } from '@angular/compiler';

// Inspect the real shared template: repeated roots are not eligible for Angular's
// single-root control-flow content projection into Material's suffix slot.
test('every dynamic field action loop has a projectable icon suffix ancestor', () => {
  const path = 'src/app/shared/crud/configurable-crud/configurable-crud-page.html';
  const parsed = parseTemplate(fs.readFileSync(path, 'utf8'), path);
  assert.equal(parsed.errors, null);
  let loops = 0;
  function walk(nodes, ancestors = []) {
    for (const node of nodes ?? []) {
      if (node.item?.name === 'sBtn') {
        loops++;
        const parent = ancestors.at(-1);
        assert.equal(parent.name, 'span');
        assert.ok(parent.attributes.some((a) => a.name === 'matIconSuffix'));
        const branch = ancestors.at(-2);
        assert.equal(branch.children.filter((c) => c.name || c.children).length, 1);
      }
      for (const key of ['children', 'branches', 'cases', 'groups']) {
        walk(node[key], [...ancestors, node]);
      }
    }
  }
  walk(parsed.nodes);
  assert.equal(loops, 6, 'Simple/brand tabs, Record, Network, Match, Codecs and Authentication');
});
