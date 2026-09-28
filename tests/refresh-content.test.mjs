import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createContentWorkspace } from './fixtures/content-workspace.mjs';
import { refreshContent } from '../scripts/lib/refresh-content.mjs';
import { checkRuntimeData, loadContent, writeCuratedContent, writeRuntimeData } from '../scripts/lib/content.mjs';

const capture = async root => Promise.all(['content/manifest.json', 'content/characters/example.json', 'data/catalog.json', 'scripts/wuwa-reference.json', 'assets/icon.webp'].map(path => readFile(join(root, path), 'utf8')));
const editCharacter = async (workspace, name) => {
  const content = await loadContent(workspace);
  content.catalog.characters[0].name = name;
  await writeCuratedContent(content, workspace);
};
const clean = async root => {
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  await rm(root, { recursive: true, force: true });
};

test('refresh commits validated content, runtime data, snapshots and new assets together', async () => {
  const { root } = await createContentWorkspace();
  try {
    await refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Updated');
        await writeFile(join(workspace, 'scripts/wuwa-reference.json'), '{"updated":true}\n');
        await mkdir(join(workspace, 'assets/materials'), { recursive: true });
        await writeFile(join(workspace, 'assets/materials/new.webp'), 'new image');
      },
      refreshWeapons: async () => {},
    });
    assert.equal((await loadContent(root)).catalog.characters[0].name, 'Updated');
    await checkRuntimeData(root);
    assert.equal(await readFile(join(root, 'scripts/wuwa-reference.json'), 'utf8'), '{"updated":true}\n');
    assert.equal(await readFile(join(root, 'assets/materials/new.webp'), 'utf8'), 'new image');
  } finally { await clean(root); }
});

test('a failed second importer leaves the live workspace unchanged', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: workspace => editCharacter(workspace, 'Uncommitted'),
      refreshWeapons: async () => { throw Error('second importer failed'); },
    }), /second importer failed/);
    assert.deepEqual(await capture(root), before);
  } finally { await clean(root); }
});

test('missing character art aborts refresh before commit', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        const manifestPath = join(workspace, 'content/manifest.json');
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        manifest.characterOrder.push('new-character');
        manifest.artOrder.push('new-character');
        await writeFile(manifestPath, JSON.stringify(manifest));
        await writeFile(join(workspace, 'content/characters/new-character.json'), '{"id":"new-character"}');
      },
      refreshWeapons: async () => {},
    }), /art obrigatório ausente/);
    assert.deepEqual(await capture(root), before);
  } finally { await clean(root); }
});

test('a failure during the final swap restores content, data, snapshot and removes new assets', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Uncommitted');
        await writeFile(join(workspace, 'scripts/wuwa-reference.json'), '{"uncommitted":true}');
        await mkdir(join(workspace, 'assets/materials'), { recursive: true });
        await writeFile(join(workspace, 'assets/materials/new.webp'), 'uncommitted image');
      },
      refreshWeapons: async () => {},
      afterSwap: target => { if (target === join(root, 'scripts/wuwa-reference.json')) throw Error('swap failed'); },
    }), /swap failed/);
    assert.deepEqual(await capture(root), before);
    await assert.rejects(readFile(join(root, 'assets/materials/new.webp')), { code: 'ENOENT' });
    await assert.rejects(readdir(join(root, 'assets/materials')), { code: 'ENOENT' });
    assert.equal((await readdir(root)).some(name => name.startsWith('.refresh-commit-')), false);
  } finally { await clean(root); }
});

test('staging failures leave content and data unchanged and preserve unmanaged files', async () => {
  const { root, content } = await createContentWorkspace();
  try {
    await writeFile(join(root, 'content/manual.txt'), 'keep');
    await writeFile(join(root, 'data/weapon-stats.json'), '{}');
    await writeFile(join(root, 'data/character-fortes.json'), '{}');
    const before = await capture(root);
    content.catalog.characters[0].name = 'New';
    await assert.rejects(writeCuratedContent(content, root, { beforeSwap: () => { throw Error('staging failed'); } }), /staging failed/);
    assert.deepEqual(await capture(root), before);
    await assert.rejects(writeRuntimeData(content, root, { beforeSwap: () => { throw Error('staging failed'); } }), /staging failed/);
    assert.deepEqual(await capture(root), before);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: workspace => editCharacter(workspace, 'Uncommitted'),
      refreshWeapons: async () => {},
      beforeCommit: () => { throw Error('commit staging failed'); },
    }), /commit staging failed/);
    assert.deepEqual(await capture(root), before);
    assert.equal(await readFile(join(root, 'content/manual.txt'), 'utf8'), 'keep');
    assert.equal(await readFile(join(root, 'data/weapon-stats.json'), 'utf8'), '{}');
    assert.equal(await readFile(join(root, 'data/character-fortes.json'), 'utf8'), '{}');
    assert.equal((await readdir(root)).some(name => name.startsWith('.refresh-commit-') || name.startsWith('.content-staging-') || name.startsWith('.data-staging-')), false);
  } finally { await clean(root); }
});

test('successful staged writers retain unmanaged content and runtime caches', async () => {
  const { root, content } = await createContentWorkspace();
  try {
    await writeFile(join(root, 'content/manual.txt'), 'manual');
    await writeFile(join(root, 'data/weapon-stats.json'), 'weapon cache');
    await writeFile(join(root, 'data/character-fortes.json'), 'forte cache');
    content.catalog.characters[0].name = 'Updated';
    await writeCuratedContent(content, root);
    await writeRuntimeData(content, root);
    await checkRuntimeData(root);
    assert.equal(await readFile(join(root, 'content/manual.txt'), 'utf8'), 'manual');
    assert.equal(await readFile(join(root, 'data/weapon-stats.json'), 'utf8'), 'weapon cache');
    assert.equal(await readFile(join(root, 'data/character-fortes.json'), 'utf8'), 'forte cache');
  } finally { await clean(root); }
});
