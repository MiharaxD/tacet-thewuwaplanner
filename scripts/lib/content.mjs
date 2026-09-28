import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { validateEventCatalog } from '../../src/domain/official-events.js';
import { validateAssetFields } from '../validate-assets.mjs';

const weaponGroups = { broadblade: 'Broadblade', sword: 'Sword', rectifier: 'Rectifier', pistols: 'Pistols', gauntlets: 'Gauntlets' };
const materialGroups = { currency: 'Moeda', experience: 'Experiência', enemies: 'Inimigos', forgery: 'Forja', collectibles: 'Coleta', bosses: 'Chefe', weekly: 'Semanal', special: 'Especial' };
const runtimeNames = ['catalog', 'character-art', 'rules', 'events', 'recipes', 'sources', 'forte-descriptions-pt'];
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async (root, path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const write = (root, path, value) => writeFile(resolve(root, path), json(value));

function unique(records, label) {
  const ids = new Set();
  for (const row of records) {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw Error(`${label}: ID ausente ou duplicado: ${row?.id}`);
    ids.add(row.id);
  }
  return ids;
}

function ordered(rows, ids, label) {
  const map = new Map(rows.map(row => [row.id, row]));
  if (ids.length !== rows.length || new Set(ids).size !== ids.length || ids.some(id => !map.has(id)))
    throw Error(`${label}: ordem em content/manifest.json não corresponde aos arquivos`);
  return ids.map(id => map.get(id));
}

export async function loadContent(root = '.') {
  const manifest = await read(root, 'content/manifest.json');
  const characterFiles = (await readdir(resolve(root, 'content/characters'))).filter(name => name.endsWith('.json')).sort();
  const characterRows = await Promise.all(characterFiles.map(async file => {
    const row = await read(root, `content/characters/${file}`);
    if (row.id !== file.slice(0, -5)) throw Error(`Personagem ${file}: ID diferente do nome do arquivo`);
    if (!row.art || !row.art.icon || !row.art.card || !row.art.banner) throw Error(`Personagem ${row.id}: art obrigatório ausente`);
    return row;
  }));
  unique(characterRows, 'Personagens');
  const characters = ordered(characterRows, manifest.characterOrder, 'Personagens');
  const art = {};
  for (const id of manifest.artOrder) {
    const row = characters.find(character => character.id === id);
    if (!row || art[id]) throw Error(`Ordem de arte inválida: ${id}`);
    art[id] = row.art;
  }
  if (Object.keys(art).length !== characters.length) throw Error('Arte ausente para personagem');

  const weaponRows = [];
  for (const [file, type] of Object.entries(weaponGroups)) {
    const rows = await read(root, `content/weapons/${file}.json`);
    if (!Array.isArray(rows) || rows.some(row => row.type !== type)) throw Error(`Grupo de armas inválido: ${file}`);
    weaponRows.push(...rows);
  }
  unique(weaponRows, 'Armas');
  const materialRows = [];
  for (const [file, category] of Object.entries(materialGroups)) {
    const rows = await read(root, `content/materials/${file}.json`);
    if (!Array.isArray(rows) || rows.some(row => row.category !== category)) throw Error(`Grupo de materiais inválido: ${file}`);
    materialRows.push(...rows);
  }
  unique(materialRows, 'Materiais');
  const catalog = {
    version: manifest.version,
    consultedAt: manifest.consultedAt,
    characters: characters.map(({ art: _art, ...row }) => row),
    weapons: ordered(weaponRows, manifest.weaponOrder, 'Armas'),
    materials: ordered(materialRows, manifest.materialOrder, 'Materiais'),
  };
  const progression = await read(root, 'content/config/progression.json');
  const activities = await read(root, 'content/config/activities.json');
  const servers = await read(root, 'content/config/servers.json');
  const parts = { ...progression, ...activities, ...servers };
  if (Object.keys(parts).length !== Object.keys(progression).length + Object.keys(activities).length + Object.keys(servers).length)
    throw Error('Campos de regras duplicados entre arquivos de configuração');
  const rules = Object.fromEntries(manifest.rulesOrder.map(key => [key, parts[key]]));
  if (Object.keys(parts).length !== manifest.rulesOrder.length || new Set(manifest.rulesOrder).size !== manifest.rulesOrder.length || Object.values(rules).some(value => value === undefined))
    throw Error('Ordem ou campos de regras inválidos em content/manifest.json');
  return {
    catalog, art, rules,
    events: await read(root, 'content/events.json'),
    recipes: await read(root, 'content/recipes.json'),
    sources: await read(root, 'content/sources.json'),
    forte: await read(root, 'content/forte-descriptions-pt.json'),
    manifest,
  };
}

export async function validateContent(content, root = '.') {
  const { catalog, art, rules, events, recipes, sources } = content;
  const sourceIds = unique(sources, 'Fontes');
  const materialIds = unique(catalog.materials, 'Materiais');
  unique(catalog.characters, 'Personagens');
  unique(catalog.weapons, 'Armas');
  unique(recipes, 'Receitas');
  for (const row of [...catalog.characters, ...catalog.weapons, ...catalog.materials, ...recipes]) {
    for (const id of row.sources || []) if (!sourceIds.has(id)) throw Error(`${row.id}: fonte inexistente ${id}`);
  }
  for (const recipe of recipes) {
    for (const [id, count] of Object.entries({ ...recipe.inputs, ...recipe.outputs }))
      if (!materialIds.has(id) || !Number.isSafeInteger(count) || count <= 0) throw Error(`${recipe.id}: material ou quantidade inválida: ${id}`);
    if (!Object.keys(recipe.inputs || {}).length || !Object.keys(recipe.outputs || {}).length) throw Error(`${recipe.id}: receita vazia`);
  }
  for (const key of ['caps', 'floors', 'union', 'skillCaps', 'resonatorXp', 'weaponXp', 'ascension', 'weaponAscension', 'skills'])
    if (!Array.isArray(rules[key]) || !rules[key].length) throw Error(`Regras: ${key} ausente`);
  if (!rules.activities || !rules.servers || !rules.weaponXpByRarity || !rules.unlockCosts || !rules.unlockAscensions)
    throw Error('Regras: configuração necessária ausente');
  validateEventCatalog(events);
  await validateAssetFields({ catalog, art, events }, root);
}

export function runtimeData({ catalog, art, rules, events, recipes, sources, forte }) {
  return { catalog, 'character-art': art, rules, events, recipes, sources, 'forte-descriptions-pt': forte };
}

export async function writeRuntimeData(content, root = '.') {
  await validateContent(content, root);
  for (const [name, value] of Object.entries(runtimeData(content))) {
    if (name === 'forte-descriptions-pt')
      await writeFile(resolve(root, `data/${name}.json`), await readFile(resolve(root, `content/${name}.json`)));
    else await write(root, `data/${name}.json`, value);
  }
}

export async function checkRuntimeData(root = '.') {
  const content = await loadContent(root);
  await validateContent(content, root);
  for (const name of runtimeNames) {
    let actual;
    try { actual = await read(root, `data/${name}.json`); }
    catch (error) { if (error.code === 'ENOENT') throw Error(`Dados gerados estão desatualizados. Execute npm run catalog. Arquivo ausente: ${name}`); throw error; }
    if (!isDeepStrictEqual(actual, runtimeData(content)[name]))
      throw Error(`Dados gerados estão desatualizados. Execute npm run catalog. Diferença em data/${name}.json`);
  }
}

export async function writeCuratedContent(content, root = '.') {
  const { catalog, art, rules, recipes, sources, manifest } = content;
  for (const dir of ['characters', 'weapons', 'materials', 'config']) await mkdir(resolve(root, `content/${dir}`), { recursive: true });
  manifest.version = catalog.version;
  manifest.consultedAt = catalog.consultedAt;
  manifest.characterOrder = catalog.characters.map(row => row.id);
  manifest.weaponOrder = catalog.weapons.map(row => row.id);
  manifest.materialOrder = catalog.materials.map(row => row.id);
  manifest.artOrder = [...new Set([...manifest.artOrder.filter(id => art[id]), ...manifest.characterOrder])];
  manifest.rulesOrder = Object.keys(rules);
  for (const row of catalog.characters) await write(root, `content/characters/${row.id}.json`, { ...row, art: art[row.id] });
  for (const [file, type] of Object.entries(weaponGroups)) await write(root, `content/weapons/${file}.json`, catalog.weapons.filter(row => row.type === type));
  for (const [file, category] of Object.entries(materialGroups)) await write(root, `content/materials/${file}.json`, catalog.materials.filter(row => row.category === category));
  const serverKeys = new Set(['servers', 'dailyResetHour', 'weeklyResetDay']);
  await write(root, 'content/config/progression.json', Object.fromEntries(Object.entries(rules).filter(([key]) => key !== 'activities' && !serverKeys.has(key))));
  await write(root, 'content/config/activities.json', { activities: rules.activities });
  await write(root, 'content/config/servers.json', Object.fromEntries(Object.entries(rules).filter(([key]) => serverKeys.has(key))));
  await write(root, 'content/sources.json', sources);
  await write(root, 'content/recipes.json', recipes);
  await write(root, 'content/manifest.json', manifest);
}
