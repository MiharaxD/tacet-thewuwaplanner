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

export function deriveRecipes(catalog, curatedRecipes) {
  const recipes = [...curatedRecipes];
  for (const material of catalog.materials.filter(row => ['Forja', 'Inimigos'].includes(row.category) && /-[1-3]$/.test(row.id))) {
    const tier = Number(material.id.at(-1));
    const input = material.id.slice(0, -1) + (tier - 1);
    if (!catalog.materials.some(row => row.id === input && row.category === material.category && row.rarity === material.rarity - 1)) continue;
    if (!recipes.some(row => row.outputs?.[material.id])) recipes.push({
      id: `purify-${material.id}`, inputs: { [input]: 3 }, outputs: { [material.id]: 1 }, verified: true, sources: ['synthesis-purification'],
    });
  }
  return recipes;
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
  const { catalog, art, rules, events, recipes, sources, manifest } = content;
  const sourceIds = unique(sources, 'Fontes');
  for (const source of sources) {
    if (typeof source.url !== 'string' || !source.url.trim() ||
        typeof source.scope !== 'string' || !source.scope.trim() ||
        typeof source.consultedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.consultedAt) ||
        Number.isNaN(Date.parse(source.consultedAt)) ||
        new Date(source.consultedAt).toISOString().slice(0, 10) !== source.consultedAt ||
        !(source.gameVersion === null || typeof source.gameVersion === 'string') ||
        typeof source.note !== 'string' || 'title' in source || 'notes' in source)
      throw Error(`Fonte ${source.id}: schema inválido; use url, scope, consultedAt, gameVersion e note`);
  }
  const materialIds = unique(catalog.materials, 'Materiais');
  unique(catalog.characters, 'Personagens');
  unique(catalog.weapons, 'Armas');
  if (manifest) {
    ordered(catalog.characters, manifest.characterOrder, 'Personagens');
    ordered(catalog.weapons, manifest.weaponOrder, 'Armas');
    ordered(catalog.materials, manifest.materialOrder, 'Materiais');
  }
  for (const character of catalog.characters) {
    if (!/^[a-z0-9-]+$/.test(character.id) || !art?.[character.id] ||
        ['icon', 'card', 'banner'].some(key => typeof art[character.id][key] !== 'string' || !art[character.id][key]))
      throw Error(`Novo personagem ${character.id} não possui art configurada em content/characters.`);
  }
  if (Object.keys(art || {}).length !== catalog.characters.length) throw Error('Arte sem personagem correspondente');
  if (catalog.weapons.some(weapon => !Object.values(weaponGroups).includes(weapon.type)) ||
      catalog.materials.some(material => !Object.values(materialGroups).includes(material.category)))
    throw Error('Grupo de arma ou material inválido');
  unique(recipes, 'Receitas');
  if (recipes.some(recipe => recipe.id.startsWith('purify-'))) throw Error('Receitas purify-* devem ser derivadas, não editadas em content/');
  const compiledRecipes = deriveRecipes(catalog, recipes);
  unique(compiledRecipes, 'Receitas compiladas');
  for (const row of [...catalog.characters, ...catalog.weapons, ...catalog.materials, ...compiledRecipes]) {
    for (const id of row.sources || []) if (!sourceIds.has(id)) throw Error(`${row.id}: fonte inexistente ${id}`);
  }
  for (const recipe of compiledRecipes) {
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
  return { catalog, 'character-art': art, rules, events, recipes: deriveRecipes(catalog, recipes), sources, 'forte-descriptions-pt': forte };
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
  const nextManifest = {
    ...manifest,
    version: catalog.version,
    consultedAt: catalog.consultedAt,
    characterOrder: catalog.characters.map(row => row.id),
    weaponOrder: catalog.weapons.map(row => row.id),
    materialOrder: catalog.materials.map(row => row.id),
    artOrder: [...new Set([...manifest.artOrder.filter(id => art[id]), ...catalog.characters.map(row => row.id)])],
    rulesOrder: Object.keys(rules),
  };
  let existing = [];
  try { existing = (await readdir(resolve(root, 'content/characters'))).filter(name => name.endsWith('.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const expected = new Set(nextManifest.characterOrder.map(id => `${id}.json`));
  const stale = existing.filter(name => !expected.has(name));
  if (stale.length) throw Error(`Arquivos de personagem obsoletos em content/characters: ${stale.join(', ')}. Remova-os explicitamente antes do refresh.`);
  await validateContent({ ...content, manifest: nextManifest }, root);
  for (const dir of ['characters', 'weapons', 'materials', 'config']) await mkdir(resolve(root, `content/${dir}`), { recursive: true });
  for (const row of catalog.characters) await write(root, `content/characters/${row.id}.json`, { ...row, art: art[row.id] });
  for (const [file, type] of Object.entries(weaponGroups)) await write(root, `content/weapons/${file}.json`, catalog.weapons.filter(row => row.type === type));
  for (const [file, category] of Object.entries(materialGroups)) await write(root, `content/materials/${file}.json`, catalog.materials.filter(row => row.category === category));
  const serverKeys = new Set(['servers', 'dailyResetHour', 'weeklyResetDay']);
  await write(root, 'content/config/progression.json', Object.fromEntries(Object.entries(rules).filter(([key]) => key !== 'activities' && !serverKeys.has(key))));
  await write(root, 'content/config/activities.json', { activities: rules.activities });
  await write(root, 'content/config/servers.json', Object.fromEntries(Object.entries(rules).filter(([key]) => serverKeys.has(key))));
  await write(root, 'content/sources.json', sources);
  await write(root, 'content/recipes.json', recipes);
  await write(root, 'content/manifest.json', nextManifest);
  Object.assign(manifest, nextManifest);
}
