import assert from 'node:assert/strict';
import test from 'node:test';
import { findMenuViolations } from './validate-menus.mjs';

test('accepts a menu built from the mns-menu primitives', () => {
  const source = `
    <mat-menu #menu="matMenu" class="mns-menu mns-menu-compact" xPosition="before">
      <mns-menu-title>Actions</mns-menu-title>
      <button mat-menu-item mnsMenuItem type="button" tone="danger">
        <mat-icon>delete</mat-icon>
        <mns-menu-label>Delete</mns-menu-label>
      </button>
    </mat-menu>`;
  assert.deepEqual(findMenuViolations(source), []);
});

test('rejects a menu panel without the shell class', () => {
  const violations = findMenuViolations('<mat-menu #menu="matMenu" xPosition="before">');
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /mns-menu/);
});

test('rejects a menu item without mnsMenuItem, multi-line attributes included', () => {
  const source = `<button\n  mat-menu-item\n  type="button"\n  (click)="run()"\n>Run</button>`;
  const violations = findMenuViolations(source);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 1);
});

test('rejects legacy menu classes but not unrelated names', () => {
  const source = `
    <div class="topbar-menu-title">Theme</div>
    <button mat-menu-item mnsMenuItem class="crud-menu-danger">Delete</button>
    <span class="topbar-tenant-row"></span>`;
  const messages = findMenuViolations(source).map((item) => item.message);
  assert.equal(messages.length, 2);
  assert.match(messages[0], /topbar-menu-title/);
  assert.match(messages[1], /crud-menu-danger/);
});
