import { execFileSync } from 'node:child_process';

for (const args of [
  ['scripts/import-wuwa.mjs', '--refresh'],
  ['scripts/import-weapons.mjs'],
  ['scripts/expand-recipes.mjs'],
  ['scripts/catalog.mjs'],
]) execFileSync(process.execPath, args, { stdio: 'inherit' });
