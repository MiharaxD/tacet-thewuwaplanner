import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeCuratedContent, writeRuntimeData } from '../../scripts/lib/content.mjs';

export async function createContentWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'tacet-content-test-'));
  for (const dir of ['content', 'assets', 'scripts']) await mkdir(join(root, dir));
  await writeFile(join(root, 'assets/icon.webp'), 'fixture');
  await writeFile(join(root, 'content/events.json'), '{"version":1,"events":[]}\n');
  await writeFile(join(root, 'content/forte-descriptions-pt.json'), '{}\n');
  await writeFile(join(root, 'scripts/wuwa-reference.json'), '{}\n');
  const rules = { caps: [20], floors: [1], union: [1], skillCaps: [1], resonatorXp: [0], weaponXp: [0], ascension: [[1]], weaponAscension: [[1]], skills: [[1]], activities: {}, servers: {}, weaponXpByRarity: {}, unlockCosts: {}, unlockAscensions: {} };
  const character = { id: 'example', name: 'Example', image: './assets/icon.webp', sources: [] };
  const art = { icon: './assets/icon.webp', card: './assets/icon.webp', banner: './assets/icon.webp' };
  const content = {
    catalog: { version: 1, consultedAt: '2026-09-15', characters: [character], weapons: [], materials: [] },
    art: { example: art }, rules, events: { version: 1, events: [] }, recipes: [], sources: [], forte: {},
    manifest: { version: 1, consultedAt: '2026-09-15', characterOrder: ['example'], weaponOrder: [], materialOrder: [], artOrder: ['example'], rulesOrder: Object.keys(rules) },
  };
  await writeCuratedContent(content, root);
  await writeRuntimeData(content, root);
  return { root, content };
}
