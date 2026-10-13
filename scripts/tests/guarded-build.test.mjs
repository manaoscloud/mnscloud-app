import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('../guarded-build.sh', import.meta.url).pathname;

function run(env) {
  return new Promise((resolve) => {
    const child = spawn('bash', [script], {
      env: { ...process.env, CI: '', MNSCLOUD_BUILD_MEMORY_MAX: '0', ...env },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

test('concurrent builds on one host run one at a time', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'guarded-build-'));
  const env = {
    MNSCLOUD_BUILD_LOCK: join(dir, 'build.lock'),
    MNSCLOUD_BUILD_COMMAND: `echo start >> ${dir}/events; sleep 1; echo end >> ${dir}/events`,
  };
  const results = await Promise.all([run(env), run(env)]);
  assert.deepEqual(
    results.map((result) => result.code),
    [0, 0],
  );
  assert.deepEqual(readFileSync(join(dir, 'events'), 'utf8').trim().split('\n'), [
    'start',
    'end',
    'start',
    'end',
  ]);
  assert.ok(
    results.some((result) => result.stderr.includes('another mnscloud-app build is running')),
  );
});

test('a build that cannot get the slot in time fails without running', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'guarded-build-'));
  const lock = join(dir, 'build.lock');
  const holder = run({ MNSCLOUD_BUILD_LOCK: lock, MNSCLOUD_BUILD_COMMAND: 'sleep 2' });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const waiting = await run({
    MNSCLOUD_BUILD_LOCK: lock,
    MNSCLOUD_BUILD_LOCK_WAIT: '0',
    MNSCLOUD_BUILD_COMMAND: `touch ${dir}/ran`,
  });
  assert.equal(waiting.code, 75);
  assert.match(waiting.stderr, /timed out waiting for the build slot/);
  assert.equal((await holder).code, 0);
});

test('build failures keep their exit status', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'guarded-build-'));
  const result = await run({
    MNSCLOUD_BUILD_LOCK: join(dir, 'build.lock'),
    MNSCLOUD_BUILD_COMMAND: 'exit 3',
  });
  assert.equal(result.code, 3);
});
