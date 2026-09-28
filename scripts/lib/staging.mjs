import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readlink, readdir, rename, rm } from 'node:fs/promises';
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

export async function removeOwnedTemp(path, parent, prefix) {
  if (dirname(resolve(path)) !== resolve(parent) || !basename(path).startsWith(prefix))
    throw Error(`Diretório temporário inválido: ${path}`);
  await rm(path, { recursive: true, force: true });
}

export async function withStagedDirectory(root, name, fill, { beforeSwap } = {}) {
  const project = resolve(root);
  const prefix = `.${name}-staging-`;
  const stageRoot = await mkdtemp(join(project, prefix));
  const destination = join(project, name);
  const staged = join(stageRoot, name);
  const backup = join(stageRoot, `${name}-backup`);
  let hadOriginal = false;
  let preserveBackup = false;
  try {
    try { await readdir(destination); hadOriginal = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (hadOriginal) await cp(destination, staged, { recursive: true });
    else await mkdir(staged);
    await fill(stageRoot);
    await beforeSwap?.();
    if (hadOriginal) await rename(destination, backup);
    try { await rename(staged, destination); }
    catch (error) {
      if (hadOriginal) {
        try { await rename(backup, destination); }
        catch (rollbackError) {
          preserveBackup = true;
          throw new AggregateError([error, rollbackError], `Falha ao restaurar ${name}; backup em ${backup}`);
        }
      }
      throw error;
    }
  } finally {
    if (!preserveBackup) await removeOwnedTemp(stageRoot, project, prefix);
  }
}
