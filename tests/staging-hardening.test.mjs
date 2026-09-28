import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createContentWorkspace } from './fixtures/content-workspace.mjs';
import { writeCuratedContent, writeRuntimeData } from '../scripts/lib/content.mjs';
import { stableFingerprintPath, withStagedDirectory, writeStagedFile } from '../scripts/lib/staging.mjs';

const clean = async root => {
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  await rm(root, { recursive: true, force: true });
};
const assertNoStage = async root => assert.equal((await readdir(root)).some(name => /staging|conflict-recovery/.test(name)), false);

test('a changing file cannot produce a stable fingerprint', async () => {
  const { root } = await createContentWorkspace();
  try {
    const file = join(root, 'assets/icon.webp');
    await assert.rejects(stableFingerprintPath(file, () => writeFile(file, 'changed')), /alterado durante/);
  } finally { await clean(root); }
});

test('standalone catalog staging preserves a concurrently updated cache', async () => {
  const { root, content } = await createContentWorkspace();
  try {
    const cache = join(root, 'data/weapon-stats.json');
    await writeFile(cache, 'old cache');
    const runtimeBefore = await readFile(join(root, 'data/catalog.json'), 'utf8');
    await assert.rejects(writeRuntimeData(content, root, {
      beforeSwap: () => writeFile(cache, 'new cache'),
    }), /data.*alterado durante/);
    assert.equal(await readFile(cache, 'utf8'), 'new cache');
    assert.equal(await readFile(join(root, 'data/catalog.json'), 'utf8'), runtimeBefore);
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('standalone catalog cannot publish data from content changed during staging', async () => {
  const { root, content } = await createContentWorkspace();
  try {
    const file = join(root, 'content/characters/example.json');
    const dataBefore = await readFile(join(root, 'data/catalog.json'), 'utf8');
    await assert.rejects(writeRuntimeData(content, root, {
      beforeSwap: async () => {
        const row = JSON.parse(await readFile(file, 'utf8'));
        row.name = 'Manual source edit';
        await writeFile(file, JSON.stringify(row));
      },
    }), /content.*alterado durante/);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).name, 'Manual source edit');
    assert.equal(await readFile(join(root, 'data/catalog.json'), 'utf8'), dataBefore);
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('standalone curated writing preserves a manual edit during staging', async () => {
  const { root, content } = await createContentWorkspace();
  try {
    const file = join(root, 'content/characters/example.json');
    const manifestBefore = await readFile(join(root, 'content/manifest.json'), 'utf8');
    content.catalog.characters[0].name = 'Generated';
    await assert.rejects(writeCuratedContent(content, root, {
      beforeSwap: async () => {
        const row = JSON.parse(await readFile(file, 'utf8'));
        row.name = 'Manual edit';
        await writeFile(file, JSON.stringify(row));
      },
    }), /content.*alterado durante/);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).name, 'Manual edit');
    assert.equal(await readFile(join(root, 'content/manifest.json'), 'utf8'), manifestBefore);
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('standalone staging rejects a copy made from a transient edit', async () => {
  const { root } = await createContentWorkspace();
  try {
    const cache = join(root, 'data/weapon-stats.json');
    await writeFile(cache, 'AAAA');
    let filled = false;
    await assert.rejects(withStagedDirectory(root, 'data', async () => { filled = true; }, {
      afterBaseline: () => writeFile(cache, 'BBBB'),
      afterCopy: () => writeFile(cache, 'AAAA'),
    }), /data.*alterado durante/);
    assert.equal(filled, false);
    assert.equal(await readFile(cache, 'utf8'), 'AAAA');
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('standalone backup check catches an edit between comparison and rename', async () => {
  const { root } = await createContentWorkspace();
  try {
    const cache = join(root, 'data/weapon-stats.json');
    await writeFile(cache, 'AAAA');
    await assert.rejects(withStagedDirectory(root, 'data', async stage => {
      await writeFile(join(stage, 'data/weapon-stats.json'), 'generated');
    }, { beforeTargetSwap: () => writeFile(cache, 'BBBB') }), /data.*alterado durante/);
    assert.equal(await readFile(cache, 'utf8'), 'BBBB');
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('standalone staging moves a post-install edit to recovery before restoring baseline', async () => {
  const { root } = await createContentWorkspace();
  try {
    const cache = join(root, 'data/weapon-stats.json');
    await writeFile(cache, 'baseline');
    await assert.rejects(withStagedDirectory(root, 'data', async stage => {
      await writeFile(join(stage, 'data/weapon-stats.json'), 'generated');
    }, { afterSwap: () => writeFile(cache, 'external') }), /\.refresh-conflict-recovery-/);
    assert.equal(await readFile(cache, 'utf8'), 'baseline');
    const recovery = (await readdir(root)).find(name => name.startsWith('.refresh-conflict-recovery-'));
    assert.ok(recovery);
    assert.equal(await readFile(join(root, recovery, 'data/weapon-stats.json'), 'utf8'), 'external');
    assert.equal((await readdir(root)).some(name => name.startsWith('.data-staging-')), false);
  } finally { await clean(root); }
});

test('a normal standalone staging error leaves no recovery directory', async () => {
  const { root } = await createContentWorkspace();
  try {
    await assert.rejects(withStagedDirectory(root, 'data', async () => {}, {
      beforeSwap: () => { throw Error('write failed'); },
    }), /write failed/);
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('staged snapshot writing rejects target creation and removal races', async () => {
  const { root } = await createContentWorkspace();
  try {
    const created = join(root, 'scripts/new-reference.json');
    await assert.rejects(writeStagedFile(root, 'scripts/new-reference.json', 'generated', {
      beforeSwap: () => writeFile(created, 'external'),
    }), /alterado durante/);
    assert.equal(await readFile(created, 'utf8'), 'external');
    const existing = join(root, 'scripts/wuwa-reference.json');
    await assert.rejects(writeStagedFile(root, 'scripts/wuwa-reference.json', 'generated', {
      beforeSwap: () => rm(existing),
    }), /alterado durante/);
    await assert.rejects(access(existing), { code: 'ENOENT' });
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('a writer rejects a stale input baseline captured before a long fetch', async () => {
  const { root } = await createContentWorkspace();
  try {
    const original = await stableFingerprintPath(join(root, 'scripts/wuwa-reference.json'));
    await writeFile(join(root, 'scripts/wuwa-reference.json'), '{"manual":true}');
    await assert.rejects(writeStagedFile(root, 'scripts/wuwa-reference.json', '{"generated":true}', {
      expectedBaseline: original,
    }), /alterado durante/);
    assert.equal(await readFile(join(root, 'scripts/wuwa-reference.json'), 'utf8'), '{"manual":true}');
    await assertNoStage(root);
  } finally { await clean(root); }
});

test('staged snapshot writing recovers an edit made after installation', async () => {
  const { root } = await createContentWorkspace();
  try {
    const snapshot = join(root, 'scripts/wuwa-reference.json');
    const original = await readFile(snapshot, 'utf8');
    await assert.rejects(writeStagedFile(root, 'scripts/wuwa-reference.json', '{"generated":true}', {
      afterSwap: () => writeFile(snapshot, '{"external":true}'),
    }), /\.refresh-conflict-recovery-/);
    assert.equal(await readFile(snapshot, 'utf8'), original);
    const recovery = (await readdir(root)).find(name => name.startsWith('.refresh-conflict-recovery-'));
    assert.ok(recovery);
    assert.equal(await readFile(join(root, recovery, 'scripts/wuwa-reference.json'), 'utf8'), '{"external":true}');
    assert.equal((await readdir(join(root, 'scripts'))).some(name => name.startsWith('.file-staging-')), false);
  } finally { await clean(root); }
});
