import { execFileSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { checkRuntimeData, loadContent, writeRuntimeData } from './content.mjs';
import { removeOwnedTemp } from './staging.mjs';

const exists = async path => access(path).then(() => true, error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

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

async function commitRefresh(project, workspace, beforeCommit, afterSwap) {
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
      swaps.push({ target: join(project, name), staged, backup: join(stage, `${name}-backup`) });
    }
    for (const name of ['wuwa-reference.json', 'weapons-reference.json']) {
      const source = join(workspace, 'scripts', name);
      if (!await exists(source)) continue;
      const target = join(project, 'scripts', name);
      if (await exists(target) && (await readFile(source)).equals(await readFile(target))) continue;
      const staged = join(stage, name);
      await cp(source, staged);
      swaps.push({ target, staged, backup: join(stage, `${name}-backup`) });
    }
    const assets = [];
    for (const group of ['materials', 'weapons']) {
      const sourceRoot = join(workspace, 'assets', group);
      for (const source of await files(sourceRoot)) {
        const target = join(project, 'assets', group, relative(sourceRoot, source));
        if (await exists(target)) {
          if (!(await readFile(source)).equals(await readFile(target)))
            throw Error(`Asset existente foi alterado pelo refresh: ${target}`);
        } else assets.push({ source, target });
      }
    }
    await beforeCommit?.();
    for (const { source, target } of assets) {
      const missing = [];
      for (let dir = dirname(target); !await exists(dir); dir = dirname(dir)) missing.push(dir);
      for (const dir of missing.reverse()) {
        await mkdir(dir);
        addedDirectories.push(dir);
      }
      addedAssets.push(target);
      await cp(source, target, { force: false, errorOnExist: true });
    }
    for (const swap of swaps) {
      swap.existed = await exists(swap.target);
      if (swap.existed) await rename(swap.target, swap.backup);
      try { await rename(swap.staged, swap.target); }
      catch (error) {
        if (swap.existed) {
          try { await rename(swap.backup, swap.target); }
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
  } catch (error) {
    const rollbackErrors = [];
    for (const swap of swaps.filter(row => row.applied).reverse()) {
      try {
        await rename(swap.target, swap.staged);
        if (swap.existed) await rename(swap.backup, swap.target);
      } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const asset of addedAssets.reverse()) {
      try { await rm(asset, { force: true }); }
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

export async function refreshContent({ root = '.', refreshWuwa, refreshWeapons, beforeCommit, afterSwap } = {}) {
  const project = resolve(root);
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
    await commitRefresh(project, workspace, beforeCommit, afterSwap);
  } finally {
    await removeOwnedTemp(workspace, parent, prefix);
  }
}
