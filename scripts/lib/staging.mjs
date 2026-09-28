import { createHash } from 'node:crypto';
import { cp, link, lstat, mkdir, mkdtemp, readFile, readlink, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

export async function fingerprintPath(path) {
  const hash = createHash('sha256');
  const visit = async (current, relative) => {
    let stat;
    try { stat = await lstat(current); }
    catch (error) {
      if (error.code === 'ENOENT') {
        hash.update(JSON.stringify(['missing', relative]));
        return;
      }
      throw error;
    }
    if (stat.isDirectory()) {
      hash.update(JSON.stringify(['directory', relative]));
      const entries = (await readdir(current)).sort();
      for (const name of entries) await visit(join(current, name), `${relative}/${name}`);
    } else if (stat.isFile()) {
      const bytes = await readFile(current);
      hash.update(JSON.stringify(['file', relative, bytes.length]));
      hash.update(bytes);
    } else if (stat.isSymbolicLink()) {
      hash.update(JSON.stringify(['symlink', relative, await readlink(current)]));
    } else hash.update(JSON.stringify(['other', relative, stat.mode]));
  };
  await visit(path, '.');
  return hash.digest('hex');
}

export class ConcurrentWriteError extends Error {
  constructor(area, operation = 'atualização') {
    super(`${area} foi alterado durante o ${operation}. A operação foi cancelada.`);
    this.name = 'ConcurrentWriteError';
  }
}

export async function pathExists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function stableFingerprintPath(path, afterFirst) {
  let first, second;
  try {
    first = await fingerprintPath(path);
    await afterFirst?.();
    second = await fingerprintPath(path);
  } catch (error) {
    if (error.code === 'ENOENT') throw new ConcurrentWriteError(path);
    throw error;
  }
  if (first !== second) throw new ConcurrentWriteError(path);
  return first;
}

export async function assertFingerprint(path, expected, area, operation) {
  if (await stableFingerprintPath(path) !== expected) throw new ConcurrentWriteError(area, operation);
}

export async function preserveExternal(project, recovery, source, relativePath) {
  if (!recovery.path) recovery.path = await mkdtemp(join(project, '.refresh-conflict-recovery-'));
  const destination = resolve(recovery.path, relativePath);
  if (!destination.startsWith(resolve(recovery.path) + '\\') && !destination.startsWith(resolve(recovery.path) + '/'))
    throw Error(`Caminho de recuperação inválido: ${relativePath}`);
  await mkdir(dirname(destination), { recursive: true });
  if (await pathExists(source)) await rename(source, destination);
  else await writeFile(`${destination}.deleted.txt`, `Removido externamente durante a atualização: ${relativePath}\n`);
  return destination;
}

// Captures the installed version before deciding whether it is safe to discard.
export async function rollbackSwap(project, swap, stageRoot, recovery) {
  if (swap.applied) {
    const discarded = join(stageRoot, `rollback-${swap.name.replaceAll(/[\\/]/g, '-')}`);
    if (await pathExists(swap.target)) {
      await rename(swap.target, discarded);
      let matches = false;
      try { matches = await stableFingerprintPath(discarded) === swap.expectedHash; }
      catch (error) { if (!(error instanceof ConcurrentWriteError)) throw error; }
      if (!matches) await preserveExternal(project, recovery, discarded, swap.name);
    } else await preserveExternal(project, recovery, swap.target, swap.name);
  }
  if (swap.captured) {
    if (await pathExists(swap.target)) await preserveExternal(project, recovery, swap.target, swap.name + '-created-during-rollback');
    await rename(swap.backup, swap.target);
  }
}

export function transactionFailure(error, recovery, backupPath) {
  const recovered = recovery.path ? ` Alteração externa preservada em ${recovery.path}.` : '';
  return new Error(`${error.message}${recovered}${backupPath ? ` Backups preservados em ${backupPath}.` : ''}`, { cause: error });
}

export async function removeOwnedTemp(path, parent, prefix) {
  if (dirname(resolve(path)) !== resolve(parent) || !basename(path).startsWith(prefix))
    throw Error(`Diretório temporário inválido: ${path}`);
  await rm(path, { recursive: true, force: true });
}

export async function withStagedDirectory(root, name, fill, { expectedBaseline, afterBaseline, afterCopy, beforeSwap, beforeTargetSwap, afterSwap } = {}) {
  const project = resolve(root);
  const prefix = `.${name}-staging-`;
  const destination = join(project, name);
  const baseline = await stableFingerprintPath(destination);
  if (expectedBaseline !== undefined && baseline !== expectedBaseline) throw new ConcurrentWriteError(name);
  const hadOriginal = await pathExists(destination);
  await afterBaseline?.();
  const stageRoot = await mkdtemp(join(project, prefix));
  const staged = join(stageRoot, name);
  const backup = join(stageRoot, `${name}-backup`);
  const swap = { name, target: destination, backup, expectedHash: null, captured: false, applied: false };
  const recovery = {};
  let preserveBackup = false;
  try {
    if (hadOriginal) await cp(destination, staged, { recursive: true });
    else await mkdir(staged);
    await afterCopy?.();
    if (hadOriginal) await assertFingerprint(staged, baseline, name);
    await assertFingerprint(destination, baseline, name);
    await fill(stageRoot);
    await beforeSwap?.();
    await assertFingerprint(destination, baseline, name);
    swap.expectedHash = await stableFingerprintPath(staged);
    await beforeTargetSwap?.(destination);
    if (hadOriginal) {
      await rename(destination, backup);
      swap.captured = true;
      await assertFingerprint(backup, baseline, name);
    } else if (await pathExists(destination)) throw new ConcurrentWriteError(name);
    if (await pathExists(destination)) throw new ConcurrentWriteError(name);
    await rename(staged, destination);
    swap.applied = true;
    await assertFingerprint(destination, swap.expectedHash, name);
    await afterSwap?.();
    await assertFingerprint(destination, swap.expectedHash, name);
  } catch (error) {
    try { await rollbackSwap(project, swap, stageRoot, recovery); }
    catch (rollbackError) {
      preserveBackup = true;
      throw new AggregateError([error, rollbackError], `Rollback incompleto; backups em ${stageRoot}${recovery.path ? `; recuperação em ${recovery.path}` : ''}`);
    }
    if (recovery.path) throw transactionFailure(error, recovery);
    throw error;
  } finally {
    if (!preserveBackup) await removeOwnedTemp(stageRoot, project, prefix);
  }
}

export async function writeStagedFile(root, relativePath, bytes, { expectedBaseline, beforeSwap, afterSwap } = {}) {
  const project = resolve(root);
  const target = resolve(project, relativePath);
  const parent = dirname(target);
  const prefix = '.file-staging-';
  const baseline = await stableFingerprintPath(target);
  if (expectedBaseline !== undefined && baseline !== expectedBaseline) throw new ConcurrentWriteError(relativePath);
  const hadOriginal = await pathExists(target);
  const stageRoot = await mkdtemp(join(parent, prefix));
  const staged = join(stageRoot, basename(target));
  const swap = { name: relativePath, target, backup: join(stageRoot, 'backup'), captured: false, applied: false };
  const recovery = {};
  let preserveBackup = false;
  try {
    await writeFile(staged, bytes);
    swap.expectedHash = await stableFingerprintPath(staged);
    await beforeSwap?.();
    await assertFingerprint(target, baseline, relativePath);
    if (hadOriginal) {
      await rename(target, swap.backup);
      swap.captured = true;
      await assertFingerprint(swap.backup, baseline, relativePath);
    } else if (await pathExists(target)) throw new ConcurrentWriteError(relativePath);
    if (await pathExists(target)) throw new ConcurrentWriteError(relativePath);
    if (hadOriginal) await rename(staged, target);
    else {
      try { await link(staged, target); }
      catch (error) {
        if (error.code === 'EEXIST') throw new ConcurrentWriteError(relativePath);
        throw error;
      }
    }
    swap.applied = true;
    await assertFingerprint(target, swap.expectedHash, relativePath);
    await afterSwap?.();
    await assertFingerprint(target, swap.expectedHash, relativePath);
    return swap.expectedHash;
  } catch (error) {
    try { await rollbackSwap(project, swap, stageRoot, recovery); }
    catch (rollbackError) {
      preserveBackup = true;
      throw new AggregateError([error, rollbackError], `Rollback incompleto; backups em ${stageRoot}${recovery.path ? `; recuperação em ${recovery.path}` : ''}`);
    }
    if (recovery.path) throw transactionFailure(error, recovery);
    throw error;
  } finally {
    if (!preserveBackup) await removeOwnedTemp(stageRoot, parent, prefix);
  }
}
