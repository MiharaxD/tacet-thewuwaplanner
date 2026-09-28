import { execFileSync } from 'node:child_process';
import { access, cp, link, mkdir, mkdtemp, readFile, readdir, rename, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { checkRuntimeData, loadContent, writeRuntimeData } from './content.mjs';
import { assertFingerprint, ConcurrentWriteError, pathExists, preserveExternal, removeOwnedTemp, rollbackSwap, stableFingerprintPath, transactionFailure } from './staging.mjs';

const protectedPaths = [
  'content', 'data', 'scripts/wuwa-reference.json', 'scripts/weapons-reference.json',
  'assets/materials', 'assets/weapons',
];

const exists = async path => access(path).then(() => true, error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

async function fingerprintTargets(project) {
  const result = new Map();
  for (const name of protectedPaths) {
    const target = join(project, name);
    result.set(name, { hash: await stableFingerprintPath(target), present: await pathExists(target) });
  }
  return result;
}

async function assertUnchanged(project, baseline, names = protectedPaths) {
  for (const name of names) {
    const target = join(project, name);
    const initial = baseline.get(name);
    if (await stableFingerprintPath(target) !== initial.hash || await pathExists(target) !== initial.present)
      throw new ConcurrentWriteError(name, 'refresh');
  }
}

async function assertExpected(project, expected, names = protectedPaths) {
  for (const name of names) {
    await assertFingerprint(join(project, name), expected.get(name).hash, name, 'refresh');
    if (await pathExists(join(project, name)) !== expected.get(name).present)
      throw new ConcurrentWriteError(name, 'refresh');
  }
}

async function files(dir) {
  if (!await exists(dir)) return [];
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function commitRefresh(project, workspace, baseline, expected, { beforeCommit, afterSwap, beforeTargetSwap, beforeFinalValidation, afterPhysicalValidation } = {}) {
  const prefix = '.refresh-commit-';
  const stage = await mkdtemp(join(project, prefix));
  const swaps = [];
  const addedAssets = [];
  const addedDirectories = [];
  const recovery = {};
  let rollbackFailed = false;
  try {
    for (const name of ['content', 'data']) {
      const staged = join(stage, name);
      await cp(join(workspace, name), staged, { recursive: true });
      await assertFingerprint(staged, expected.get(name).hash, name, 'refresh');
      swaps.push({ name, target: join(project, name), staged, backup: join(stage, `${name}-backup`) });
    }
    for (const name of ['wuwa-reference.json', 'weapons-reference.json']) {
      const source = join(workspace, 'scripts', name);
      if (!await pathExists(source)) {
        if (baseline.get(`scripts/${name}`).present) throw Error(`Snapshot ausente na workspace: ${name}`);
        continue;
      }
      const target = join(project, 'scripts', name);
      if (await exists(target) && (await readFile(source)).equals(await readFile(target))) continue;
      const staged = join(stage, name);
      await cp(source, staged);
      await assertFingerprint(staged, expected.get(`scripts/${name}`).hash, `scripts/${name}`, 'refresh');
      swaps.push({ name: `scripts/${name}`, target, staged, backup: join(stage, `${name}-backup`) });
    }
    const assets = [];
    for (const group of ['materials', 'weapons']) {
      const sourceRoot = join(workspace, 'assets', group);
      for (const source of await files(sourceRoot)) {
        const target = join(project, 'assets', group, relative(sourceRoot, source));
        if (await exists(target)) {
          if (!(await readFile(source)).equals(await readFile(target))) {
            if (await stableFingerprintPath(join(project, 'assets', group)) !== baseline.get(`assets/${group}`).hash)
              throw new ConcurrentWriteError(`assets/${group}`, 'refresh');
            throw Error(`Asset existente foi alterado pelo refresh: ${target}`);
          }
        } else {
          const staged = join(stage, 'new-assets', group, relative(sourceRoot, source));
          await mkdir(dirname(staged), { recursive: true });
          await cp(source, staged);
          const expectedHash = await stableFingerprintPath(source);
          await assertFingerprint(staged, expectedHash, relative(project, target), 'refresh');
          assets.push({ staged, target, expectedHash });
        }
      }
    }
    await beforeCommit?.(workspace, expected);
    await assertUnchanged(project, baseline);
    for (const asset of assets) {
      const { staged, target } = asset;
      const missing = [];
      for (let dir = dirname(target); !await exists(dir); dir = dirname(dir)) missing.push(dir);
      for (const dir of missing.reverse()) {
        try { await mkdir(dir); }
        catch (error) {
          if (error.code === 'EEXIST') throw new ConcurrentWriteError(relative(project, dir), 'refresh');
          throw error;
        }
        addedDirectories.push(dir);
      }
      try { await link(staged, target); }
      catch (error) {
        if (error.code === 'EEXIST') {
          throw new ConcurrentWriteError(relative(project, target), 'refresh');
        }
        throw error;
      }
      addedAssets.push(asset);
      await assertFingerprint(target, asset.expectedHash, relative(project, target), 'refresh');
    }
    await assertExpected(project, expected, ['assets/materials', 'assets/weapons']);
    for (const swap of swaps) {
      await assertExpected(project, expected, swaps.filter(row => row.applied).map(row => row.name));
      await beforeTargetSwap?.(swap.name, swap.target);
      const initial = baseline.get(swap.name);
      swap.existed = initial.present;
      if (await pathExists(swap.target) !== swap.existed) throw new ConcurrentWriteError(swap.name, 'refresh');
      swap.expectedHash = expected.get(swap.name).hash;
      await assertFingerprint(swap.staged, swap.expectedHash, swap.name, 'refresh');
      if (swap.existed) {
        await rename(swap.target, swap.backup);
        swap.captured = true;
        await assertFingerprint(swap.backup, initial.hash, swap.name, 'refresh');
      }
      if (await pathExists(swap.target)) throw new ConcurrentWriteError(swap.name, 'refresh');
      if (swap.existed || swap.name === 'content' || swap.name === 'data') await rename(swap.staged, swap.target);
      else {
        try { await link(swap.staged, swap.target); }
        catch (error) {
          if (error.code === 'EEXIST') throw new ConcurrentWriteError(swap.name, 'refresh');
          throw error;
        }
      }
      swap.applied = true;
      await assertFingerprint(swap.target, swap.expectedHash, swap.name, 'refresh');
      await afterSwap?.(swap.target);
      await assertExpected(project, expected, swaps.filter(row => row.applied).map(row => row.name));
    }
    await beforeFinalValidation?.();
    await assertExpected(project, expected);
    await afterPhysicalValidation?.();
    await checkRuntimeData(project);
    await assertExpected(project, expected);
  } catch (error) {
    const rollbackErrors = [];
    const applied = swaps.some(row => row.applied);
    for (const swap of swaps.filter(row => row.applied || row.captured).reverse()) {
      try { await rollbackSwap(project, swap, stage, recovery); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const asset of addedAssets.reverse()) {
      try {
        if (!await pathExists(asset.target)) {
          await preserveExternal(project, recovery, asset.target, relative(project, asset.target));
          continue;
        }
        const discarded = join(stage, 'asset-rollback', relative(project, asset.target));
        await mkdir(dirname(discarded), { recursive: true });
        await rename(asset.target, discarded);
        if (await stableFingerprintPath(discarded) !== asset.expectedHash)
          await preserveExternal(project, recovery, discarded, relative(project, asset.target));
      }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const dir of addedDirectories.reverse()) {
      try { await rmdir(dir); }
      catch (rollbackError) {
        if (rollbackError.code === 'ENOENT') continue;
        if (rollbackError.code === 'ENOTEMPTY' || rollbackError.code === 'EEXIST') {
          try { await preserveExternal(project, recovery, dir, relative(project, dir) + '-remaining'); }
          catch (preserveError) { rollbackErrors.push(preserveError); }
        } else rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      rollbackFailed = true;
      throw new AggregateError([error, ...rollbackErrors], `Rollback incompleto; backups em ${stage}${recovery.path ? `; recuperação em ${recovery.path}` : ''}`);
    }
    if (recovery.path) throw transactionFailure(error, recovery);
    if (applied && error instanceof ConcurrentWriteError)
      throw new Error(`${error.message} As alterações do refresh foram revertidas.`, { cause: error });
    throw error;
  } finally {
    if (!rollbackFailed) await removeOwnedTemp(stage, project, prefix);
  }
}

export async function refreshContent({ root = '.', refreshWuwa, refreshWeapons, afterBaseline, afterWorkspaceCopy, beforeCommit, afterSwap, beforeTargetSwap, beforeFinalValidation, afterPhysicalValidation } = {}) {
  const project = resolve(root);
  const baseline = await fingerprintTargets(project);
  await afterBaseline?.(project);
  const parent = tmpdir();
  const prefix = 'tacet-refresh-';
  const workspace = await mkdtemp(join(parent, prefix));
  try {
    for (const name of ['content', 'data', 'assets', 'source-assets', 'scripts', 'src', 'package.json']) {
      const source = join(project, name);
      if (await exists(source)) await cp(source, join(workspace, name), { recursive: true });
    }
    await afterWorkspaceCopy?.(workspace, project);
    await assertExpected(workspace, baseline);
    await assertUnchanged(project, baseline);
    const run = args => execFileSync(process.execPath, args, { cwd: workspace, stdio: 'inherit' });
    if (refreshWuwa) await refreshWuwa(workspace);
    else run(['scripts/import-wuwa.mjs', '--refresh']);
    if (refreshWeapons) await refreshWeapons(workspace);
    else run(['scripts/import-weapons.mjs']);
    const content = await loadContent(workspace);
    await writeRuntimeData(content, workspace);
    await checkRuntimeData(workspace);
    const expected = await fingerprintTargets(workspace);
    await assertUnchanged(project, baseline);
    await commitRefresh(project, workspace, baseline, expected, { beforeCommit, afterSwap, beforeTargetSwap, beforeFinalValidation, afterPhysicalValidation });
  } finally {
    await removeOwnedTemp(workspace, parent, prefix);
  }
}
