import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync('src/app/pages/voip/pabx/media-files/media-playback.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { resolveMediaPlayback } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const uuid = '11111111-2222-4333-8444-555555555555';
const endpoint = `voip/pabx/media-files/${uuid}/content`;

test('local audio uses the authenticated API reader and releases its object URL', async () => {
  const bytes = new Uint8Array([82, 73, 70, 70, 0, 255]);
  const requests = [];
  const playback = await resolveMediaPlayback(
    uuid,
    { url: `/api/v1/${endpoint}` },
    async (path) => {
      requests.push(path);
      return new Blob([bytes], { type: 'audio/wav' });
    },
  );
  assert.deepEqual(requests, [endpoint]);
  assert.equal(playback.downloadUrl, playback.url);
  assert.deepEqual(new Uint8Array(await (await fetch(playback.url)).arrayBuffer()), bytes);
  playback.release();
  playback.release();
  await assert.rejects(() => fetch(playback.url));
});

test('storage capability URLs never receive the authenticated API reader', async () => {
  const source = { url: '/api/v1/storage/transfers/synthetic', downloadUrl: '/download/synthetic' };
  const playback = await resolveMediaPlayback(uuid, source, () => {
    throw new Error('Credentials must not be forwarded to capability URLs');
  });
  assert.equal(playback.url, source.url);
  assert.equal(playback.downloadUrl, source.downloadUrl);
  playback.release();
});

test('mismatched local file identity and rejected reads cannot open a player', async () => {
  await assert.rejects(() =>
    resolveMediaPlayback(
      uuid,
      {
        url: '/api/v1/voip/pabx/media-files/other/content',
      },
      () => {
        throw new Error('Wrong file must not be fetched');
      },
    ),
  );
  await assert.rejects(
    () =>
      resolveMediaPlayback(uuid, { url: `/api/v1/${endpoint}` }, () => {
        throw new Error('Forbidden');
      }),
    /Forbidden/,
  );
});
