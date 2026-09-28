import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createContentWorkspace } from './fixtures/content-workspace.mjs';
import { refreshContent } from '../scripts/lib/refresh-content.mjs';
import { checkRuntimeData, loadContent, writeCuratedContent, writeRuntimeData } from '../scripts/lib/content.mjs';
import { fingerprintPath, stableFingerprintPath } from '../scripts/lib/staging.mjs';

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
const recoveryPath = async root => {
  const names = (await readdir(root)).filter(name => name.startsWith('.refresh-conflict-recovery-'));
  assert.equal(names.length, 1);
  return join(root, names[0]);
};

test('refresh commits validated content, runtime data, snapshots and new assets together', async () => {
  const { root } = await createContentWorkspace();
  try {
    let workspacePath, expected;
    await refreshContent({ root,
      refreshWuwa: async workspace => {
        workspacePath = workspace;
        await editCharacter(workspace, 'Updated');
        await writeFile(join(workspace, 'scripts/wuwa-reference.json'), '{"updated":true}\n');
        await mkdir(join(workspace, 'assets/materials'), { recursive: true });
        await writeFile(join(workspace, 'assets/materials/new.webp'), 'new image');
      },
      refreshWeapons: async () => {},
      beforeCommit: (_workspace, fingerprints) => { expected = fingerprints; },
    });
    assert.equal((await loadContent(root)).catalog.characters[0].name, 'Updated');
    await checkRuntimeData(root);
    assert.equal(await readFile(join(root, 'scripts/wuwa-reference.json'), 'utf8'), '{"updated":true}\n');
    assert.equal(await readFile(join(root, 'assets/materials/new.webp'), 'utf8'), 'new image');
    for (const [name, value] of expected) assert.equal(await stableFingerprintPath(join(root, name)), value.hash, name);
    await assert.rejects(access(workspacePath), { code: 'ENOENT' });
    assert.equal((await readdir(root)).some(name => /staging|refresh-commit|conflict-recovery/.test(name)), false);
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

for (const scenario of [
  {
    name: 'an existing content file changes',
    path: 'content/characters/example.json',
    change: async root => {
      const path = join(root, 'content/characters/example.json');
      const row = JSON.parse(await readFile(path, 'utf8'));
      row.name = 'External edit';
      await writeFile(path, JSON.stringify(row));
    },
    area: /content/,
  },
  {
    name: 'a data cache is created', path: 'data/weapon-stats.json',
    change: root => writeFile(join(root, 'data/weapon-stats.json'), 'external cache'), area: /data/,
  },
  {
    name: 'a snapshot changes', path: 'scripts/wuwa-reference.json',
    change: root => writeFile(join(root, 'scripts/wuwa-reference.json'), '{"external":true}\n'), area: /scripts\/wuwa-reference\.json/,
  },
  {
    name: 'an existing asset changes', path: 'assets/materials/existing.webp',
    setup: async root => {
      await mkdir(join(root, 'assets/materials'));
      await writeFile(join(root, 'assets/materials/existing.webp'), 'original image');
    },
    change: root => writeFile(join(root, 'assets/materials/existing.webp'), 'external image'), area: /assets\/materials/,
  },
  {
    name: 'a new manual content file appears', path: 'content/manual-concurrent.txt',
    change: root => writeFile(join(root, 'content/manual-concurrent.txt'), 'external note'), area: /content/,
  },
]) test(`refresh preserves concurrent changes when ${scenario.name}`, async () => {
  const { root } = await createContentWorkspace();
  try {
    await scenario.setup?.(root);
    const before = await capture(root);
    let external;
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Uncommitted');
        await scenario.change(root);
        external = await readFile(join(root, scenario.path), 'utf8');
      },
      refreshWeapons: async () => {},
    }), scenario.area);
    assert.equal(await readFile(join(root, scenario.path), 'utf8'), external);
    assert.equal(await readFile(join(root, 'data/catalog.json'), 'utf8'), before[2]);
    assert.equal((await loadContent(root)).catalog.characters[0].name, scenario.path.startsWith('content/characters') ? 'External edit' : 'Example');
    assert.equal((await readdir(root)).some(name => name.startsWith('.refresh-commit-')), false);
  } finally { await clean(root); }
});

test('backup fingerprint catches a content edit between the final check and rename', async () => {
  const { root } = await createContentWorkspace();
  try {
    const dataBefore = await readFile(join(root, 'data/catalog.json'), 'utf8');
    await assert.rejects(refreshContent({ root,
      refreshWuwa: workspace => editCharacter(workspace, 'Uncommitted'),
      refreshWeapons: async () => {},
      beforeTargetSwap: async (name, target) => {
        if (name !== 'content') return;
        const path = join(target, 'characters/example.json');
        const row = JSON.parse(await readFile(path, 'utf8'));
        row.name = 'Last-second edit';
        await writeFile(path, JSON.stringify(row));
      },
    }), /content.*alterado durante o refresh/);
    assert.equal((await loadContent(root)).catalog.characters[0].name, 'Last-second edit');
    assert.equal(await readFile(join(root, 'data/catalog.json'), 'utf8'), dataBefore);
  } finally { await clean(root); }
});

test('a later data conflict restores an already swapped content directory and new assets', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Uncommitted');
        await mkdir(join(workspace, 'assets/materials'), { recursive: true });
        await writeFile(join(workspace, 'assets/materials/new.webp'), 'refresh image');
      },
      refreshWeapons: async () => {},
      beforeTargetSwap: async name => {
        if (name === 'data') await writeFile(join(root, 'data/weapon-stats.json'), 'external cache');
      },
    }), /data.*alterado durante o refresh/);
    assert.deepEqual(await capture(root), before);
    assert.equal(await readFile(join(root, 'data/weapon-stats.json'), 'utf8'), 'external cache');
    await assert.rejects(readdir(join(root, 'assets/materials')), { code: 'ENOENT' });
    assert.equal((await readdir(root)).some(name => name.startsWith('.refresh-commit-')), false);
  } finally { await clean(root); }
});

test('fingerprints detect equal-sized edits, removed files and empty directories', async () => {
  const { root } = await createContentWorkspace();
  try {
    const file = join(root, 'content/manual.txt');
    await writeFile(file, 'AAAA');
    const first = await fingerprintPath(join(root, 'content'));
    await writeFile(file, 'BBBB');
    const second = await fingerprintPath(join(root, 'content'));
    assert.notEqual(second, first);
    await rm(file);
    assert.notEqual(await fingerprintPath(join(root, 'content')), second);
    const missing = await fingerprintPath(join(root, 'assets/materials'));
    await mkdir(join(root, 'assets/materials'));
    assert.notEqual(await fingerprintPath(join(root, 'assets/materials')), missing);
    const typed = join(root, 'assets/type-change');
    await writeFile(typed, 'file');
    const fileHash = await fingerprintPath(typed);
    await rm(typed);
    await mkdir(typed);
    assert.notEqual(await fingerprintPath(typed), fileHash);
  } finally { await clean(root); }
});

test('removing a real file during refresh is a conflict', async () => {
  const { root } = await createContentWorkspace();
  try {
    const manual = join(root, 'content/manual.txt');
    await writeFile(manual, 'original');
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Uncommitted');
        await rm(manual);
      },
      refreshWeapons: async () => {},
    }), /content.*alterado durante o refresh/);
    await assert.rejects(readFile(manual), { code: 'ENOENT' });
    assert.equal((await loadContent(root)).catalog.characters[0].name, 'Example');
  } finally { await clean(root); }
});

test('a snapshot edit between check and backup is preserved after earlier swaps roll back', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Uncommitted');
        await writeFile(join(workspace, 'scripts/wuwa-reference.json'), '{"refresh":true}');
      },
      refreshWeapons: async () => {},
      beforeTargetSwap: async name => {
        if (name === 'scripts/wuwa-reference.json') await writeFile(join(root, 'scripts/wuwa-reference.json'), '{"external":true}');
      },
    }), /scripts\/wuwa-reference\.json.*alterado durante o refresh/);
    assert.equal(await readFile(join(root, 'scripts/wuwa-reference.json'), 'utf8'), '{"external":true}');
    assert.equal(await readFile(join(root, 'content/characters/example.json'), 'utf8'), before[1]);
    assert.equal(await readFile(join(root, 'data/catalog.json'), 'utf8'), before[2]);
  } finally { await clean(root); }
});

test('an asset edit after refresh adds images is detected before finishing swaps', async () => {
  const { root } = await createContentWorkspace();
  try {
    await mkdir(join(root, 'assets/materials'));
    const existing = join(root, 'assets/materials/existing.webp');
    await writeFile(existing, 'original image');
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Uncommitted');
        await writeFile(join(workspace, 'assets/materials/new.webp'), 'new image');
      },
      refreshWeapons: async () => {},
      beforeTargetSwap: async name => {
        if (name === 'content') await writeFile(existing, 'external image');
      },
    }), /assets\/materials.*alterado durante o refresh/);
    assert.deepEqual(await capture(root), before);
    assert.equal(await readFile(existing, 'utf8'), 'external image');
    await assert.rejects(readFile(join(root, 'assets/materials/new.webp')), { code: 'ENOENT' });
  } finally { await clean(root); }
});

test('workspace copied from a transient edit is rejected even when the real file returns to baseline', async () => {
  const { root } = await createContentWorkspace();
  try {
    const path = join(root, 'content/characters/example.json');
    const original = await readFile(path, 'utf8');
    let imported = false;
    await assert.rejects(refreshContent({ root,
      afterBaseline: async () => writeFile(path, original.replace('Example', 'Changed')),
      afterWorkspaceCopy: async () => writeFile(path, original),
      refreshWuwa: async () => { imported = true; },
      refreshWeapons: async () => {},
    }), /content.*alterado durante o refresh/);
    assert.equal(imported, false);
    assert.equal(await readFile(path, 'utf8'), original);
    assert.equal((await readdir(root)).some(name => name.startsWith('.refresh-commit-')), false);
  } finally { await clean(root); }
});

for (const changed of ['content', 'data', 'scripts/wuwa-reference.json'])
  test(`an external edit to installed ${changed} is recovered and baseline restored`, async () => {
    const { root } = await createContentWorkspace();
    try {
      const before = await capture(root);
      await assert.rejects(refreshContent({ root,
        refreshWuwa: async workspace => {
          await editCharacter(workspace, 'Uncommitted');
          await writeFile(join(workspace, 'scripts/wuwa-reference.json'), '{"refresh":true}');
        },
        refreshWeapons: async () => {},
        afterSwap: async target => {
          if (target !== join(root, changed)) return;
          if (changed === 'content') {
            const file = join(target, 'characters/example.json');
            const row = JSON.parse(await readFile(file, 'utf8'));
            row.name = 'External after install';
            await writeFile(file, JSON.stringify(row));
          } else if (changed === 'data') await writeFile(join(target, 'weapon-stats.json'), 'external cache');
          else await writeFile(target, '{"external":true}');
        },
      }), /\.refresh-conflict-recovery-/);
      assert.deepEqual(await capture(root), before);
      await checkRuntimeData(root);
      const saved = await recoveryPath(root);
      if (changed === 'content') assert.equal(JSON.parse(await readFile(join(saved, 'content/characters/example.json'), 'utf8')).name, 'External after install');
      else if (changed === 'data') assert.equal(await readFile(join(saved, 'data/weapon-stats.json'), 'utf8'), 'external cache');
      else assert.equal(await readFile(join(saved, 'scripts/wuwa-reference.json'), 'utf8'), '{"external":true}');
    } finally { await clean(root); }
  });

test('an edited new asset is moved to recovery during rollback', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: async workspace => {
        await editCharacter(workspace, 'Uncommitted');
        await mkdir(join(workspace, 'assets/materials'), { recursive: true });
        await writeFile(join(workspace, 'assets/materials/new.webp'), 'refresh image');
      },
      refreshWeapons: async () => {},
      afterSwap: async target => {
        if (target === join(root, 'content')) await writeFile(join(root, 'assets/materials/new.webp'), 'external image');
      },
    }), /\.refresh-conflict-recovery-/);
    assert.deepEqual(await capture(root), before);
    await assert.rejects(access(join(root, 'assets/materials/new.webp')), { code: 'ENOENT' });
    const saved = await recoveryPath(root);
    assert.equal(await readFile(join(saved, 'assets/materials/new.webp'), 'utf8'), 'external image');
  } finally { await clean(root); }
});

test('an earlier installed target is rechecked while a later swap begins', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: workspace => editCharacter(workspace, 'Uncommitted'),
      refreshWeapons: async () => {},
      beforeTargetSwap: async name => {
        if (name !== 'data') return;
        const file = join(root, 'content/characters/example.json');
        const row = JSON.parse(await readFile(file, 'utf8'));
        row.name = 'Edited during data swap';
        await writeFile(file, JSON.stringify(row));
      },
    }), /\.refresh-conflict-recovery-/);
    assert.deepEqual(await capture(root), before);
    assert.equal(JSON.parse(await readFile(join(await recoveryPath(root), 'content/characters/example.json'), 'utf8')).name, 'Edited during data swap');
  } finally { await clean(root); }
});

test('real-project semantic validation can reject a late data edit and recover it', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: workspace => editCharacter(workspace, 'Uncommitted'),
      refreshWeapons: async () => {},
      afterPhysicalValidation: async () => writeFile(join(root, 'data/catalog.json'), '{invalid json'),
    }), /\.refresh-conflict-recovery-/);
    assert.deepEqual(await capture(root), before);
    assert.equal(await readFile(join(await recoveryPath(root), 'data/catalog.json'), 'utf8'), '{invalid json');
    await checkRuntimeData(root);
  } finally { await clean(root); }
});

test('final validation catches an unchanged snapshot edited after all swaps', async () => {
  const { root } = await createContentWorkspace();
  try {
    const before = await capture(root);
    await assert.rejects(refreshContent({ root,
      refreshWuwa: workspace => editCharacter(workspace, 'Uncommitted'),
      refreshWeapons: async () => {},
      beforeFinalValidation: () => writeFile(join(root, 'scripts/wuwa-reference.json'), '{"late":true}'),
    }), /scripts\/wuwa-reference\.json.*alterado durante o refresh/);
    assert.equal(await readFile(join(root, 'scripts/wuwa-reference.json'), 'utf8'), '{"late":true}');
    assert.equal(await readFile(join(root, 'content/characters/example.json'), 'utf8'), before[1]);
    assert.equal(await readFile(join(root, 'data/catalog.json'), 'utf8'), before[2]);
    assert.equal((await readdir(root)).some(name => name.startsWith('.refresh-conflict-recovery-')), false);
  } finally { await clean(root); }
});
