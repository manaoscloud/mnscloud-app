import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { findInstallCommandViolations } from './validate-install-command-dialog.mjs';

const page = join('src', 'app', 'pages', 'realtime', 'media', 'media.ts');
const shared = join(
  'src',
  'app',
  'shared',
  'install-command-dialog',
  'open-install-command-dialog.ts',
);

test('a page using the shared helper passes', () => {
  assert.deepEqual(
    findInstallCommandViolations(
      page,
      'openInstallCommandDialog(this.dialog, data, this.destroyRef);',
    ),
    [],
  );
});

test('a page opening the component directly is reported', () => {
  const source = 'this.dialog.open(InstallCommandDialogComponent, { data });';
  assert.equal(findInstallCommandViolations(page, source).length, 1);
});

test('the retired panel class is reported anywhere, including styles', () => {
  const styles = join('src', 'styles.scss');
  assert.equal(findInstallCommandViolations(styles, '.install-command-dialog-panel {}').length, 1);
});

test('the shared helper may reference the component', () => {
  assert.deepEqual(
    findInstallCommandViolations(
      shared,
      'openCrudComponentDialog(dialog, InstallCommandDialogComponent, "crud-form-dialog")',
    ),
    [],
  );
});
