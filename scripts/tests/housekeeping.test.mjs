import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scripts = join(dirname(fileURLToPath(import.meta.url)), '..');
let root, repo, web, state, env;
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { env, encoding: 'utf8', stdio: 'pipe' }).trim();
const run = (args = ['--apply'], overrides = {}) => spawnSync('bash', [join(scripts, 'housekeeping.sh'), ...args], {
  env: { ...env, ...overrides }, encoding: 'utf8',
});
function summaries(result) {
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(lines.map((line) => line.kind), ['web-root', 'git']);
  for (const line of lines) assert.ok(Number.isInteger(line.freedBytes) && line.freedBytes >= 0);
  return lines;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'housekeeping-'));
  repo = join(root, 'repo');
  web = join(root, 'web');
  state = join(root, 'state');
  mkdirSync(repo);
  mkdirSync(web);
  env = {
    ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
    MNSCLOUD_APP_REPO_DIR: repo, APP_WEB_ROOT: web, APP_RELEASE_STATE_DIR: state,
    MNSCLOUD_APP_KEEP_TAGS: '2', APP_KEEP_RELEASES: '2', APP_ASSET_GRACE_HOURS: '48',
    PRUNE_WEB_ROOT_NOW: '2000000',
  };
  git('init', '-b', 'main');
  for (let n = 1; n <= 6; n++) {
    writeFileSync(join(repo, 'tracked'), `commit ${n}`);
    git('add', 'tracked');
    git('-c', 'commit.gpgsign=false', 'commit', '-m', `commit ${n}`);
    git('-c', 'tag.gpgsign=false', 'tag', '-a', `v1.0.${n}`, '-m', `release ${n}`);
  }
  git('checkout', '--detach', 'v1.0.6');
  git('update-ref', 'refs/remotes/origin/release/x', 'HEAD~4');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
  for (const version of ['1.0.5', '1.0.6']) {
    writeFileSync(join(web, 'index.html'), version);
    writeFileSync(join(web, `${version}.js`), version);
    const list = join(root, 'files');
    writeFileSync(list, `index.html\n${version}.js\n`);
    execFileSync('bash', [join(scripts, 'prune-web-root.sh'), '--web-root', web, '--state-dir', state,
      '--record', version, '--files-from', list], {
      env: { ...env, PRUNE_WEB_ROOT_NOW: '1000000' }, stdio: 'pipe',
    });
  }
  writeFileSync(join(web, 'build.json'), JSON.stringify({ version: '1.0.6' }));
  writeFileSync(join(web, 'stale.js'), 'stale');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test('dry-run reports counts without changing refs, reflogs, index, or files', () => {
  const refs = git('show-ref');
  const reflog = git('reflog', 'show', '--all');
  const index = readFileSync(join(repo, '.git', 'index'));
  const lists = readdirSync(state);
  const [webResult, result] = summaries(run(['--dry-run']));
  assert.equal(webResult.removedFiles, 1);
  assert.equal(result.tagsRemoved, 3);
  assert.equal(result.refsRemoved, 1);
  assert.equal(result.dryRun, true);
  assert.equal(result.freedBytes, 0);
  assert.equal(result.bytesBefore, result.bytesAfter);
  assert.equal(git('show-ref'), refs);
  assert.equal(git('reflog', 'show', '--all'), reflog);
  assert.deepEqual(readFileSync(join(repo, '.git', 'index')), index);
  assert.deepEqual(readdirSync(state), lists);
  assert.ok(existsSync(join(web, 'stale.js')));
});

test('apply keeps HEAD tags and newest other versions, preserving branches and dirty work tree', () => {
  git('-c', 'tag.gpgsign=false', 'tag', '-a', 'live-alias', '-m', 'live');
  git('tag', 'obsolete', 'HEAD~4');
  git('tag', 'v99.0.0-rc1', 'HEAD~4');
  const head = git('rev-parse', 'HEAD');
  const branches = git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads');
  writeFileSync(join(repo, 'tracked'), 'staged');
  git('add', 'tracked');
  writeFileSync(join(repo, 'tracked'), 'unstaged');
  writeFileSync(join(repo, 'untracked'), 'keep');
  const index = readFileSync(join(repo, '.git', 'index'));
  const [webResult, result] = summaries(run());
  assert.equal(webResult.removedFiles, 1);
  assert.equal(result.tagsRemoved, 5);
  assert.equal(result.refsRemoved, 1);
  assert.equal(result.dryRun, false);
  assert.equal(result.freedBytes, Math.max(0, result.bytesBefore - result.bytesAfter));
  assert.deepEqual(git('tag').split('\n'), ['live-alias', 'v1.0.4', 'v1.0.5', 'v1.0.6']);
  assert.equal(git('rev-parse', 'HEAD'), head);
  assert.equal(git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'), branches);
  assert.equal(git('rev-parse', 'refs/remotes/origin/main'), head);
  assert.equal(git('symbolic-ref', 'refs/remotes/origin/HEAD'), 'refs/remotes/origin/main');
  assert.equal(git('for-each-ref', 'refs/remotes/origin/release/'), '');
  assert.equal(git('reflog', 'show', '--all'), '');
  assert.deepEqual(readFileSync(join(repo, '.git', 'index')), index);
  assert.equal(readFileSync(join(repo, 'tracked'), 'utf8'), 'unstaged');
  assert.equal(readFileSync(join(repo, 'untracked'), 'utf8'), 'keep');
  assert.ok(!existsSync(join(web, 'stale.js')));
  assert.ok(existsSync(join(web, '1.0.5.js')));
});

test('passes live release to pruning so an unrecorded rollback removes nothing', () => {
  writeFileSync(join(web, 'build.json'), '{"version":"0.9.0"}');
  const [result] = summaries(run());
  assert.equal(result.transition, true);
  assert.ok(existsSync(join(web, 'stale.js')));
});

test('missing web root and non-repository are optional', () => {
  rmSync(web, { recursive: true });
  const lines = summaries(run(['--apply'], { MNSCLOUD_APP_REPO_DIR: join(root, 'absent') }));
  assert.match(lines[0].skipped, /missing/);
  assert.match(lines[1].skipped, /not a git work tree/);
});

test('no recorded lists skips pruning and continues git housekeeping', () => {
  rmSync(state, { recursive: true });
  const [webResult, result] = summaries(run());
  assert.match(webResult.skipped, /no release list/);
  assert.equal(result.tagsRemoved, 3);
  assert.ok(existsSync(join(web, 'stale.js')));
});

test('invalid arguments exit 2 with usage only on stderr', () => {
  for (const args of [[], ['--bad'], ['--apply', '--dry-run'], ['--apply', '--apply']]) {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage:/);
  }
});

test('invalid keep counts and real pruning failures exit nonzero', () => {
  for (const value of ['0', '-1', 'abc']) {
    assert.notEqual(run(['--apply'], { MNSCLOUD_APP_KEEP_TAGS: value }).status, 0);
  }
  const result = run(['--apply'], { APP_KEEP_RELEASES: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--keep/);
  assert.equal(git('tag').split('\n').length, 6);
});

test('keep count override selects versions numerically', () => {
  git('tag', 'v1.0.10', 'HEAD~3');
  summaries(run(['--apply'], { MNSCLOUD_APP_KEEP_TAGS: '01' }));
  assert.deepEqual(git('tag').split('\n'), ['v1.0.10', 'v1.0.6']);
});
