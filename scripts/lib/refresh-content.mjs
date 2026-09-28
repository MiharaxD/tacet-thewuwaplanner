import { execFileSync } from 'node:child_process';
import { access, cp, link, mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { checkRuntimeData, loadContent, writeRuntimeData } from './content.mjs';
import { fingerprintPath, removeOwnedTemp } from './staging.mjs';

const protectedPaths = [
  'content', 'data', 'scripts/wuwa-reference.json', 'scripts/weapons-reference.json',
  'assets/materials', 'assets/weapons',
];

class ConcurrentRefreshError extends Error {
  constructor(path) {
    super(`${path} foi alterado durante o refresh. Nenhuma alteração do refresh foi aplicada. Execute novamente.`);
    this.name = 'ConcurrentRefreshError';
  }
}

const exists = async path => access(path).then(() => true, error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

async function fingerprintTargets(project) {
  const result = new Map();
  for (const name of protectedPaths) {
    const target = join(project, name);
    result.set(name, { hash: await fingerprintPath(target), present: await exists(target) });
  }
  return result;
}

async function assertUnchanged(project, baseline, names = protectedPaths) {
  for (const name of names) {
    const target = join(project, name);
    const initial = baseline.get(name);
    if (await fingerprintPath(target) !== initial.hash || await exists(target) !== initial.present)
      throw new ConcurrentRefreshError(name);
  }
}

async function assertRefreshedAssets(project, workspace) {
  for (const group of ['materials', 'weapons']) {
    if (await fingerprintPath(join(project, 'assets', group)) !== await fingerprintPath(join(workspace, 'assets', group)))
      throw new ConcurrentRefreshError(`assets/${group}`);
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

async function commitRefresh(project, workspace, baseline, { beforeCommit, afterSwap, beforeTargetSwap } = {}) {
  const prefix = '.refresh-commit-';
  const stage = await mkdtemp(join(project, prefix));
  const swaps = [];
  const addedAssets = [];
  const addedDirectories = [];
  let rollbackFailed = false;
  try {
    for (const name of ['content', 'data']) {
      const staged = join(stage, name);
      await cp(join(workspace, name), staged, { recursive: true });
      swaps.push({ name, target: join(project, name), staged, backup: join(stage, `${name}-backup`) });
    }
    for (const name of ['wuwa-reference.json', 'weapons-reference.json']) {
      const source = join(workspace, 'scripts', name);
      if (!await exists(source)) continue;
      const target = join(project, 'scripts', name);
      if (await exists(target) && (await readFile(source)).equals(await readFile(target))) continue;
      const staged = join(stage, name);
      await cp(source, staged);
      swaps.push({ name: `scripts/${name}`, target, staged, backup: join(stage, `${name}-backup`) });
    }
    const assets = [];
    for (const group of ['materials', 'weapons']) {
      const sourceRoot = join(workspace, 'assets', group);
      for (const source of await files(sourceRoot)) {
        const target = join(project, 'assets', group, relative(sourceRoot, source));
        if (await exists(target)) {
          if (!(await readFile(source)).equals(await readFile(target))) {
            if (await fingerprintPath(join(project, 'assets', group)) !== baseline.get(`assets/${group}`).hash)
              throw new ConcurrentRefreshError(`assets/${group}`);
            throw Error(`Asset existente foi alterado pelo refresh: ${target}`);
          }
        } else assets.push({ source, target });
      }
    }
    await beforeCommit?.();
    await assertUnchanged(project, baseline);
    for (const { source, target } of assets) {
      const missing = [];
      for (let dir = dirname(target); !await exists(dir); dir = dirname(dir)) missing.push(dir);
      for (const dir of missing.reverse()) {
        await mkdir(dir);
        addedDirectories.push(dir);
      }
      addedAssets.push({ target, source });
      try { await cp(source, target, { force: false, errorOnExist: true }); }
      catch (error) {
        if (error.code === 'EEXIST') {
          addedAssets.pop();
          throw new ConcurrentRefreshError(relative(project, target));
        }
        throw error;
      }
    }
    await assertRefreshedAssets(project, workspace);
    for (const swap of swaps) {
      await beforeTargetSwap?.(swap.name, swap.target);
      const initial = baseline.get(swap.name);
      swap.existed = initial.present;
      if (await exists(swap.target) !== swap.existed) throw new ConcurrentRefreshError(swap.name);
      swap.installedHash = await fingerprintPath(swap.staged);
      if (swap.existed) await rename(swap.target, swap.backup);
      try {
        if (swap.existed && await fingerprintPath(swap.backup) !== initial.hash)
          throw new ConcurrentRefreshError(swap.name);
        if (await exists(swap.target)) throw new ConcurrentRefreshError(swap.name);
        if (swap.existed || swap.name === 'content' || swap.name === 'data') await rename(swap.staged, swap.target);
        else {
          try { await link(swap.staged, swap.target); }
          catch (error) {
            if (error.code === 'EEXIST') throw new ConcurrentRefreshError(swap.name);
            throw error;
          }
          swap.linked = true;
        }
      }
      catch (error) {
        if (swap.existed) {
          try {
            if (await exists(swap.target)) throw new ConcurrentRefreshError(swap.name);
            await rename(swap.backup, swap.target);
          }
          catch (rollbackError) {
            rollbackFailed = true;
            throw new AggregateError([error, rollbackError], `Rollback incompleto; backup em ${swap.backup}`);
          }
        }
        throw error;
      }
      swap.applied = true;
      await afterSwap?.(swap.target);
    }
    await assertRefreshedAssets(project, workspace);
    await assertUnchanged(project, baseline, protectedPaths.filter(name => name.startsWith('scripts/') && !swaps.some(swap => swap.name === name)));
  } catch (error) {
    const rollbackErrors = [];
    for (const swap of swaps.filter(row => row.applied).reverse()) {
      try {
        if (await fingerprintPath(swap.target) !== swap.installedHash) throw new ConcurrentRefreshError(swap.name);
        if (swap.linked) await rm(swap.target);
        else await rename(swap.target, swap.staged);
        if (swap.existed) await rename(swap.backup, swap.target);
      } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const asset of addedAssets.reverse()) {
      try {
        if (await exists(asset.target) && await fingerprintPath(asset.target) !== await fingerprintPath(asset.source))
          throw new ConcurrentRefreshError(relative(project, asset.target));
        await rm(asset.target, { force: true });
      }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const dir of addedDirectories.reverse()) {
      try { await rmdir(dir); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      rollbackFailed = true;
      throw new AggregateError([error, ...rollbackErrors], `Rollback incompleto; backups em ${stage}`);
    }
    throw error;
  } finally {
    if (!rollbackFailed) await removeOwnedTemp(stage, project, prefix);
  }
}

export async function refreshContent({ root = '.', refreshWuwa, refreshWeapons, beforeCommit, afterSwap, beforeTargetSwap } = {}) {
  const project = resolve(root);
  const baseline = await fingerprintTargets(project);
  const parent = tmpdir();
  const prefix = 'tacet-refresh-';
  const workspace = await mkdtemp(join(parent, prefix));
  try {
    for (const name of ['content', 'data', 'assets', 'source-assets', 'scripts', 'src', 'package.json']) {
      const source = join(project, name);
      if (await exists(source)) await cp(source, join(workspace, name), { recursive: true });
    }
    const run = args => execFileSync(process.execPath, args, { cwd: workspace, stdio: 'inherit' });
    if (refreshWuwa) await refreshWuwa(workspace);
    else run(['scripts/import-wuwa.mjs', '--refresh']);
    if (refreshWeapons) await refreshWeapons(workspace);
    else run(['scripts/import-weapons.mjs']);
    const content = await loadContent(workspace);
    await writeRuntimeData(content, workspace);
    await checkRuntimeData(workspace);
    await assertUnchanged(project, baseline);
    await commitRefresh(project, workspace, baseline, { beforeCommit, afterSwap, beforeTargetSwap });
  } finally {
    await removeOwnedTemp(workspace, parent, prefix);
  }
}
