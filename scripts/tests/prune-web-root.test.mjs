import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'prune-web-root.sh');
const HOUR = 3600;
let root;
let web;
let state;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-web-root-'));
  web = join(root, 'web');
  state = join(root, 'state');
  mkdirSync(web);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Writes the files of one release into the web root (like rsync) and returns its list path. */
function deployFiles(id, files) {
  for (const file of files) {
    mkdirSync(dirname(join(web, file)), { recursive: true });
    writeFileSync(join(web, file), `${id}:${file}`);
  }
  const list = join(root, `${id}.list`);
  writeFileSync(list, files.join('\n') + '\n');
  return list;
}

function run(args, now) {
  const out = execFileSync('bash', [script, '--web-root', web, '--state-dir', state, ...args], {
    env: { ...process.env, PRUNE_WEB_ROOT_NOW: String(now) },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').at(-1));
}

function deploy(id, files, now, extra = []) {
  return run(['--record', id, '--files-from', deployFiles(id, files), ...extra], now);
}

const release = (id) => ['index.html', `main-${id}.js`, `chunk-${id}.js`, `media/font-${id}.woff2`];

test('first run only starts the clock and keeps unlisted files', () => {
  writeFileSync(join(web, 'chunk-legacy.js'), 'old');
  const summary = deploy('1.0.0', release('a'), 1_000_000);
  assert.equal(summary.transition, true);
  assert.equal(summary.removedFiles, 0);
  assert.ok(existsSync(join(web, 'chunk-legacy.js')));
});

test('after the grace period, files of no kept release leave the web root', () => {
  writeFileSync(join(web, 'chunk-legacy.js'), 'old');
  writeFileSync(join(web, 'env.js'), 'runtime');
  writeFileSync(join(web, 'build.json'), '{}');
  mkdirSync(join(web, '.well-known'));
  writeFileSync(join(web, '.well-known', 'x'), 'keep');
  let now = 1_000_000;
  deploy('1.0.0', release('a'), now);
  now += 49 * HOUR;
  const summary = deploy('1.0.1', release('b'), now, ['--keep', '1', '--grace-hours', '48']);
  assert.equal(summary.removedFiles, 4); // legacy chunk + main/chunk/font of release a
  assert.ok(!existsSync(join(web, 'chunk-legacy.js')));
  assert.ok(!existsSync(join(web, 'main-a.js')));
  assert.ok(existsSync(join(web, 'main-b.js')));
  assert.ok(existsSync(join(web, 'index.html')));
  assert.ok(existsSync(join(web, 'env.js')), 'installer-written files are protected');
  assert.ok(existsSync(join(web, 'build.json')));
  assert.ok(existsSync(join(web, '.well-known', 'x')), 'hidden paths are never pruned');
  assert.equal(readdirSync(state).filter((n) => n.endsWith('.files')).length, 1);
});

test('keeps the newest N releases and every release inside the grace window', () => {
  let now = 1_000_000;
  deploy('1.0.0', release('a'), now);
  now += 100 * HOUR;
  deploy('1.0.1', release('b'), now, ['--keep', '2']);
  now += 100 * HOUR;
  deploy('1.0.2', release('c'), now, ['--keep', '2']);
  assert.ok(!existsSync(join(web, 'main-a.js')), 'third oldest release is pruned');
  assert.ok(existsSync(join(web, 'main-b.js')));
  // Two quick deploys inside the grace window keep b even with --keep 1.
  now += 1 * HOUR;
  deploy('1.0.3', release('d'), now, ['--keep', '1', '--grace-hours', '48']);
  assert.ok(existsSync(join(web, 'main-c.js')), 'release inside the grace window is kept');
  assert.ok(!existsSync(join(web, 'main-b.js')));
});

test('a redeploy of the same release keeps a single list', () => {
  let now = 1_000_000;
  deploy('1.0.0', release('a'), now);
  now += HOUR;
  deploy('1.0.0', release('a'), now);
  assert.equal(readdirSync(state).filter((n) => n.endsWith('.files')).length, 1);
});

test('dry run reports without removing', () => {
  let now = 1_000_000;
  deploy('1.0.0', release('a'), now);
  now += 100 * HOUR;
  deploy('1.0.1', release('b'), now, ['--keep', '1']);
  writeFileSync(join(web, 'chunk-stale.js'), 'x'.repeat(10));
  const summary = run(['--dry-run', '--keep', '1'], now);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.removedFiles, 1);
  assert.equal(summary.freedBytes, 10);
  assert.ok(existsSync(join(web, 'chunk-stale.js')));
});

test('symlinks are never followed', () => {
  const outside = join(root, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'secret.txt'), 'keep');
  symlinkSync(outside, join(web, 'link'));
  let now = 1_000_000;
  deploy('1.0.0', release('a'), now);
  deploy('1.0.1', release('b'), now + 100 * HOUR, ['--keep', '1']);
  assert.ok(existsSync(join(outside, 'secret.txt')));
});

test('refuses unsafe input', () => {
  const list = deployFiles('1.0.0', ['main-a.js']);
  assert.throws(() => run(['--record', '1.0.0', '--files-from', list], 1), /no index.html/);
  assert.throws(() => run(['--record', '../x', '--files-from', list], 1));
  assert.throws(() =>
    execFileSync('bash', [script, '--web-root', '/', '--state-dir', state], { stdio: 'pipe' }));
  assert.throws(() =>
    execFileSync('bash', [script, '--web-root', web, '--state-dir', join(web, 'state')], { stdio: 'pipe' }));
});

test('without any recorded release nothing is pruned', () => {
  writeFileSync(join(web, 'index.html'), 'x');
  assert.throws(() => run([], 1_000_000), /no release list/);
  assert.ok(existsSync(join(web, 'index.html')));
});
