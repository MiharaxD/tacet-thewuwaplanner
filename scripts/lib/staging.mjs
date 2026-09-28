import { cp, mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

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
