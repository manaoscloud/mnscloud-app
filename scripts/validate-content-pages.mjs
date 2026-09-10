import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = (path) => readFileSync(path, 'utf8');
for (const kind of ['detail', 'settings']) {
  assert.match(read(`src/app/shared/pages/${kind}-page.ts`), /<mns-page-shell/);
}
const settings = read('src/app/pages/settings/parameters/parameters.html');
assert.match(settings, /<mns-settings-page/);
assert.doesNotMatch(settings, /crud-dialog|dialog-content|<footer/);
assert.match(read('src/app/pages/monitoring/telemetry/telemetry.html'), /<mns-detail-page/);
assert.doesNotMatch(read('src/app/pages/settings/parameters/parameters.scss'), /\.(form-grid|form-actions|form-tabs|erp-card)\b/);
console.log('Detail/settings shared shell contract passed.');
